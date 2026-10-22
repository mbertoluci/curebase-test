# Revisão 360 de estrutura - Curebase BMI

Data: 22/10/2026. Projeto: `/Users/mbertoluci/Developer/exercises/curebase-bmi`.

## Escopo e método

O README foi a primeira fonte lida. A revisão cobre código de produção, schema e migrações, contratos, frontend, testes e configuração Nx/Jest/ESLint/Husky presentes no diretório, incluindo arquivos ainda não versionados. As referências abaixo são relativas à raiz do projeto e correspondem ao conteúdo observado nesta revisão.

Esta é uma análise estática, não uma certificação de funcionamento. Foram consultados `nx show projects --json` e a configuração resolvida de `@org/api`, além da implementação instalada de `PartialType`. Foram conferidos numericamente exemplos de BMI/conversão, sem acessar o banco. Não foram executados build, lint, testes, fluxos HTTP ou navegador. Particularmente, os testes de repositório fazem `TRUNCATE` no banco configurado. Os cenários abaixo são derivados do código e sugestões de reprodução, não relatos de E2E executado. Nenhum arquivo de código foi alterado; a entrega é este relatório. Não foram inicializados arquivos de telemetria de desenvolvimento, preservando o escopo de somente análise.

Severidades: **ALTA** para perda de dados, classificação inconsistente, exposição de PII ou risco operacional destrutivo; **MEDIA** para contratos incorretos, inconsistências funcionais e riscos relevantes de manutenção; **BAIXA** para clareza, ergonomia e endurecimento proporcional. Itens explicitamente fora do take-home são distinguidos de defeitos no comportamento já oferecido.

## Avaliação geral

A arquitetura é adequada ao tamanho do take-home: feature vertical pequena, controller enxuto, serviço de aplicação, persistência concentrada, funções puras compartilhadas e transações com auditoria. Não há justificativa para substituí-la por DDD cerimonial, repositório genérico ou uma grande camada de abstrações.

O problema principal está nas garantias que atravessam camadas. A mesma função compartilhada não garante a mesma classificação se cada consumidor arredonda em uma etapa diferente. Uma transação não garante que duas edições concorrentes usem o mesmo estado. Um DTO TypeScript não garante que JSON recebido respeite nullability. E o comentário “append-only” não é uma restrição de banco.

As correções prioritárias são a política de precisão/classificação, a concorrência de escrita, o update nullable, a sugestão de edição do participante duplicado, a redaction de URLs e o isolamento dos testes destrutivos. Depois disso, corrigir OpenAPI e fortalecer os testes de composição traz mais valor do que criar novas camadas.

## Pontos fortes

- **Fronteira HTTP pequena:** `apps/api/src/features/participants/participants.controller.ts:40` delega os casos de uso sem calcular BMI ou construir queries. `ParseUUIDPipe` protege os identificadores antes da persistência.
- **Validação em duas camadas bem escolhida:** `apps/api/src/app/app.module.ts:37` rejeita propriedades extras; `apps/api/src/features/participants/participants.service.ts:177` aplica plausibilidade ao conjunto completo. O merge antes de validar updates é uma boa decisão.
- **Domínio compartilhado sem Nest/React/Prisma:** `libs/contracts/src/lib/bmi.ts:34` e `libs/contracts/src/lib/units.ts:94` oferecem funções puras, fáceis de testar. A unidade como união estrutural em `units.ts:17` evita casts desnecessários ao conversar com Prisma.
- **Tipos de entrada separados da persistência:** `apps/api/src/features/participants/participants.type.ts:10` inclui `bmiValue` derivado, enquanto o contrato de criação não aceita esse campo. Isso dificulta over-posting do valor calculado.
- **Mapeamento explícito:** `apps/api/src/features/participants/participants.repository.ts:159` converte Decimal e Date e enumera os campos expostos. Não retorna a entidade Prisma inteira nem os tombstones.
- **Atomicidade de agregado e auditoria:** `participants.service.ts:63`, `:81` e `:160` passam o mesmo cliente transacional para a mutação e para `AuditService.record`. Uma rejeição da gravação do audit aborta a transação, pela composição implementada.
- **Integridade de email no banco:** `apps/api/prisma/migrations/20261022185727_partial_unique_email_active/migration.sql:5` resolve unicidade concorrente e reuso após soft-delete sem um check-then-insert vulnerável.
- **Erros organizados por feature:** `apps/api/src/common/errors/app-exception.ts:13` e `features/participants/participants.error.ts` fornecem códigos estáveis e um ponto central de formatação. Erros inesperados não-HTTP recebem mensagem genérica.
- **Soft-delete do agregado em uma transação:** `participants.repository.ts:141` usa o mesmo instante para participante, perfil e usuário. O fluxo normal não deixa metade do agregado excluída.
- **Frontend com lógica pura extraída:** `apps/web/src/lib/form-model.ts:128` concentra transformação e validação; `Filters`, `ParticipantsTable` e `BandChip` têm interfaces pequenas. `aria-sort`, labels e fieldsets são bons fundamentos de acessibilidade.
- **Testes em níveis diferentes:** há testes de domínio, serviço, DTO, UI, repositório com PostgreSQL real e smoke HTTP. Testar o índice parcial em banco real (`participants.repository.spec.ts:77`) é particularmente valioso.
- **Decisões documentadas:** current-state, offset, age inteiro, ausência de auth e ausência de versionamento são escolhas declaradas, não omissões escondidas. O problema é algumas garantias documentadas serem mais fortes que o código.

## Achados de integridade, domínio e entidades

### A01 - Classificação usa três precisões diferentes

**Severidade: ALTA | Arquivo:linha: `apps/web/src/lib/form-model.ts:87`, `apps/api/src/features/participants/participants.service.ts:185`, `apps/api/src/features/participants/participants.repository.ts:173`**

**Problema:** o preview arredonda para uma casa antes de classificar; o serviço grava duas casas; o mapper classifica esse valor já arredondado. O README promete classificação no valor bruto. Exemplo com adulto, 74 kg e 172,1 cm: BMI bruto ≈ 24,98446; preview classifica 25,0 como `OVERWEIGHT`, enquanto a API classifica 24,98 como `NORMAL`. Com 74,99 kg e 173,2 cm, o bruto ≈ 24,99813 é normal pela regra implementada, mas a API arredonda para 25,00 e muda a faixa.

**Sugestão concreta:** definir uma única operação de domínio que calcule o bruto, classifique o bruto e arredonde exclusivamente o valor numérico retornado/exibido. Na leitura, derivar a faixa das medidas canônicas persistidas ou persistir explicitamente a faixa/precisão necessária. Testar preview, POST e GET juntos nos dois exemplos e ao redor de 18,5/25/30. Compartilhar apenas `classifyBmi` não basta.

### A02 - BMI aceito pelo domínio excede a coluna

**Severidade: ALTA | Arquivo:linha: `libs/contracts/src/lib/units.ts:38`, `apps/api/prisma/schema.prisma:89`**

**Problema:** os limites aceitam 500 kg e 50 cm, cujo BMI é 2000, e 1100 lb e 20 in, cujo BMI é 1933,25. `Decimal(5,2)` suporta somente três dígitos inteiros. DTO e serviço aceitam o conjunto, mas a gravação falha e termina como erro interno.

**Sugestão concreta:** alinhar o domínio representável à coluna. Se esses extremos são intencionais, ampliar `bmi_value`, por exemplo para `Decimal(6,2)`. Caso contrário, formular uma regra explícita para a combinação e retornar 400 antes do banco. Cobrir mínimo/máximo combinados em integração, não somente cada limite isolado.

### A03 - BMI é calculado antes da normalização das medidas persistidas

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.dto.ts:64`, `apps/api/src/features/participants/participants.service.ts:45`, `apps/api/prisma/schema.prisma:86`**

**Problema:** o DTO aceita precisão arbitrária em peso/altura; o banco os arredonda para duas casas, mas o BMI já foi calculado sobre o número original. Exemplo: peso 70,0049 e altura 50,0049 produzem aproximadamente BMI 279,96; a linha guarda 70,00 e 50,00, que implicam BMI 280,00. Atualizar somente a idade recalcula a partir das medidas persistidas e pode mudar o BMI. Decimal no banco não elimina os cálculos IEEE-754 usados antes da gravação.

**Sugestão concreta:** escolher a precisão canônica das entradas e rejeitar casas excedentes ou normalizar antes de calcular, gravar e auditar. Testar ida e volta e alteração apenas de idade. Corrigir a promessa de ausência de drift no comentário do schema.

### A04 - Atualizações concorrentes perdem alterações e comprometem o before da auditoria

**Severidade: ALTA | Arquivo:linha: `apps/api/src/features/participants/participants.service.ts:81`, `apps/api/src/features/participants/participants.repository.ts:125`**

**Problema:** leitura, merge e escrita acontecem em transação, mas sem versão, lock de leitura ou isolamento explicitado. No isolamento usual Read Committed, duas operações leem 70 kg/175 cm; A muda peso para 80; B muda altura para 180. B grava também o peso antigo por causa de `Object.assign` em `service.ts:100`, perdendo A. O before de B não representa necessariamente o estado imediatamente anterior à sua escrita. Um update concorrente com delete também pode atingir a linha por `id` sem `deletedAt:null`; a releitura então retorna null mascarado por cast. O README reconhece versionamento fora do escopo, mas isso não torna a auditoria consistente sob concorrência.

**Sugestão concreta:** para atualizações parciais no servidor, serializar a leitura/merge/escrita com lock da linha ou usar versão e update condicional. Para detectar formulários antigos, devolver uma versão ao cliente e exigir a versão esperada no update/delete; conflito deve ter código próprio. Auditar somente a alteração efetivamente aceita. Testar duas conexões com interleaving controlado e update versus delete.

### A05 - `PartialType` permite null em campos não anuláveis

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.dto.ts:89`, `apps/api/src/features/participants/participants.service.ts:188`**

**Problema:** a implementação instalada de `PartialType` aplica `IsOptional` por padrão, ignorando validação também para null. Assim `{firstName:null}` ou `{email:null}` chega ao repositório e conflita com os campos obrigatórios de Prisma, produzindo 500. Para `{weight:null}`, o merge `??` conserva o valor antigo, aceitando silenciosamente um payload fora do contrato. Apenas phone deveria admitir null.

**Sugestão concreta:** usar `PartialType(CreateParticipantDto, { skipNullProperties: false })` ou condições equivalentes, preservando explicitamente a nulabilidade de phone. Adicionar testes HTTP de null para cada campo, distinguindo ausência, null e string vazia. A opção foi confirmada no código instalado de `@nestjs/swagger/dist/type-helpers/partial-type.helper.js:14`.

### A06 - Trocar somente a unidade reinterpreta números antigos

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.service.ts:95`, `libs/contracts/src/lib/participant.ts:32`**

**Problema:** o update permite qualquer subconjunto. Um registro US de 150 lb e 70 in atualizado com `{unit:'METRIC'}` vira 150 kg e 70 cm, ambos aceitos pelos limites, com BMI radicalmente diferente. O frontend converte, mas o contrato HTTP não estabelece que as medidas sejam obrigatórias ao mudar unidade.

**Sugestão concreta:** exigir peso e altura quando a unidade mudar, ou converter explicitamente os valores omitidos antes do merge. Documentar uma única semântica e testá-la em HTTP. Não assumir que todos os clientes usarão o formulário atual.

### A07 - Arredondamento de conversão altera a medida ao alternar unidades

**Severidade: MEDIA | Arquivo:linha: `libs/contracts/src/lib/units.ts:62`, `apps/web/src/lib/form-model.ts:106`, `apps/web/src/lib/form-model.ts:60`**

**Problema:** 70 in viram 178 cm e voltam como 70,1 in. O comentário diz que o arredondamento evita drift, mas a primeira ida e volta já altera a medida. Além disso, `fromView` divide a altura US usando uma função que arredonda para uma casa; uma altura armazenada de 70,04 in perde precisão ao editar e salvar apenas contato, pois o formulário envia todas as medidas.

**Sugestão concreta:** manter valores canônicos com precisão suficiente no estado e arredondar apenas apresentação, ou preservar campos originais e enviar somente os realmente modificados. Testar alternância sem edição e edição exclusiva de contato sobre dados com duas casas.

### A08 - Soft-delete é consistente no fluxo normal, mas não na leitura de relações

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.repository.ts:41`, `:180`, `:195`**

**Problema:** GET por id e listagem normal filtram apenas `participant.deletedAt`. A busca textual acrescenta filtro de usuário ativo, mas não de perfil ativo. Se outro escritor ou futura feature excluir só o usuário/perfil, dados logicamente excluídos ainda podem ser retornados, e adicionar `search` muda a regra de visibilidade.

**Sugestão concreta:** centralizar um predicado de agregado ativo e usá-lo em todos os reads, incluindo relações, ou tornar a exclusão um estado único autoritativo no agregado. Testar combinações de tombstones. Não é necessário começar por uma extensão global de Prisma.

### A09 - Perfil opcional vira silenciosamente um participante vazio

**Severidade: MEDIA | Arquivo:linha: `apps/api/prisma/schema.prisma:54`, `apps/api/src/features/participants/participants.repository.ts:160`**

**Problema:** `userId @unique` garante no máximo um perfil/participante, mas não que todo User tenha ambos. O mapper aceita ausência de perfil e fabrica nome/email vazios. Isso mascara violação da invariante necessária ao formulário. Os casts de `findByIdTx` em `repository.ts:110` e `:137` também declaram não-null sem checagem real.

**Sugestão concreta:** documentar que a totalidade é invariante do caso de uso de criação, verificar explicitamente os resultados e tratar agregado incompleto como erro interno de integridade, sem fabricar dados válidos. Se User puder existir independentemente, o contrato deve distinguir esse estado.

### A10 - Política de identidade do email é indefinida

**Severidade: MEDIA | Arquivo:linha: `apps/api/prisma/migrations/20261022185727_partial_unique_email_active/migration.sql:5`, `apps/api/src/features/participants/participants.dto.ts:53`**

**Problema:** o índice parcial compara o texto armazenado; a API não normaliza email, enquanto a busca é case-insensitive. `Ada@example.com` e `ada@example.com` podem coexistir como perfis ativos. A política pode ser legítima, mas diverge da expectativa prática de “pessoa já cadastrada” usada na UI.

**Sugestão concreta:** definir explicitamente a política de comparação. Se for case-insensitive, usar uma chave normalizada ou índice parcial sobre `lower(email)`, normalizar consistentemente na API e tratar colisões antes de migrar. Testar diferenças de caixa e reuso após exclusão. Não depender apenas do frontend.

### A11 - Current-state e idade não registram o momento da medição

**Severidade: BAIXA | Arquivo:linha: `apps/api/prisma/schema.prisma:83`, `:90`, `:92`**

**Problema:** uma linha por usuário é coerente com o escopo, mas não representa visitas ou medições longitudinais. `updatedAt` mistura edição de contato e de medidas; age permanece congelada sem indicar a data à qual se refere. Derivar a idade atual de DOB, isoladamente, também não resolve a idade correspondente a uma medição antiga.

**Sugestão concreta:** manter o current-state neste take-home, documentando age como idade na coleta. Em evolução longitudinal, criar Measurement/Visit com `measuredAt`, unidade e idade na medição ou DOB conforme requisito, mantendo o estado atual como consulta/projeção. Não usar snapshots de auditoria como substituto da entidade clínica de histórico.

### A12 - “Soft-delete only” e “append-only” são convenções da aplicação

**Severidade: MEDIA | Arquivo:linha: `apps/api/prisma/schema.prisma:28`, `:73`, `:95`, `apps/api/prisma/migrations/20261022190200_audit_log/migration.sql:2`**

**Problema:** FKs permitem hard-delete em cascata. A migração do audit não restringe UPDATE/DELETE nem define permissões; action/entity são strings livres. Os comentários afirmam controle de acesso sem evidência dessas permissões no código revisado. O fluxo atual só insere audit e só faz soft-delete, o que é um ponto positivo, mas não uma garantia contra outros escritores.

**Sugestão concreta:** qualificar a documentação como garantia dos casos de uso atuais. Para uso real, separar role de migração e runtime, restringir operações destrutivas e definir política de retenção/acesso dos snapshots PII. Se forem adicionados triggers, não chamá-los automaticamente de “tamper-proof”: privilégios e administração continuam relevantes. Uma action enum/check é suficiente se o conjunto permanecer fechado.

## Achados de contratos, validação, erros e observabilidade

### A13 - OpenAPI descreve array onde a API entrega envelope

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.controller.ts:52`**

**Problema:** `isArray:true` descreve `ParticipantDto[]`, mas a resposta real é `{data,pageInfo}`. Clientes gerados a partir do Swagger terão formato incorreto.

**Sugestão concreta:** declarar DTO concreto de página com `data: ParticipantDto[]` e `pageInfo`, usá-lo em `ApiOkResponse` e verificar o documento OpenAPI gerado em teste de contrato.

### A14 - `@Throws` não impede drift e omite erros esperados

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/common/errors/throws.decorator.ts:8`, `apps/api/src/features/participants/participants.controller.ts:43`, `:68`**

**Problema:** o decorator só adiciona status e descrição; não verifica exceções emitidas nem descreve o envelope. Create/update omitem `InputValidationError` e os 400 estruturais; rotas com UUID também podem retornar 400. A promessa de documentação incapaz de divergir já não se sustenta.

**Sugestão concreta:** manter o decorator simples, documentar 400 e um schema comum de erro, adicionar testes de OpenAPI e retirar a promessa absoluta. Se dois códigos compartilharem um status, agrupá-los sob esse status em vez de depender de múltiplos decorators independentes.

### A15 - Infraestrutura de erro conhece semântica específica de participants

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/common/errors/all-exceptions.filter.ts:106`, `apps/api/src/features/participants/participants.repository.ts:242`**

**Problema:** qualquer HttpException 404 vira `PARTICIPANT_NOT_FOUND`, inclusive rota inexistente; qualquer 409 vira `EMAIL_ALREADY_EXISTS`. No repository, todo P2002 também vira conflito de email, mesmo que a unicidade violada seja id/userId. Isso induz clientes a ações erradas e acopla `common` a uma feature.

**Sugestão concreta:** usar códigos genéricos no fallback HTTP e reservar códigos de domínio às respectivas AppExceptions. Em P2002, inspecionar os metadados reais da constraint/target para o índice de email, mantendo erro inesperado para os demais casos. Confirmar esse metadado em teste com PostgreSQL.

### A16 - A promessa de sanitização não cobre HttpException 5xx

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/common/errors/all-exceptions.filter.ts:62`**

**Problema:** exceções desconhecidas viram 500 genérico, mas `InternalServerErrorException` passa pelo ramo HTTP e tem sua mensagem propagada. Não foi encontrado um lançamento atual com segredo; é uma fragilidade da infraestrutura frente a novos chamadores, não vazamento demonstrado em produção.

**Sugestão concreta:** sanitizar por padrão mensagens de HttpException 5xx, permitindo exposição somente de erros explicitamente classificados como seguros. Adicionar teste com mensagem interna sentinela e verificar que ela aparece somente na telemetria autorizada.

### A17 - PII em URLs não é removida pelos redactors

**Severidade: ALTA | Arquivo:linha: `apps/api/src/app/app.module.ts:21`, `apps/api/src/common/errors/all-exceptions.filter.ts:34`**

**Problema:** somente authorization e cookie são redigidos. A busca envia nome/email na query string; o filtro concatena `request.url` à mensagem de log e pino-http pode registrar a URL de requisição. Redaction de headers não altera uma string como `/participants?search=ada@example.com`. Stack de erro também não é sanitizada pelo simples redactor de headers. Portanto, a garantia geral de PII redigida no README é falsa.

**Sugestão concreta:** registrar método, rota sem query, status e requestId em campos estruturados; sanitizar URL no serializer de requisições e não embutir URLs brutas em mensagens. Testar logs com email sentinela, inclusive em 4xx/5xx, e validar o que o serializer efetivamente emite. Não adicionar logging de bodies com PII por padrão.

### A18 - Actor não é identidade verificável

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.controller.ts:46`, `:88`, `apps/web/src/lib/api.ts:28`**

**Problema:** qualquer cliente escolhe `x-actor-id`, e o web nem o envia; logo as ações usuais ficam como anonymous. A aplicação também oferece leitura e mutação de PII sem auth. Isso está explicitamente fora do take-home, portanto não é descumprimento oculto do escopo, mas impede tratar o audit como atribuição confiável ou expor o produto com dados reais.

**Sugestão concreta:** manter esse limite explícito na entrega. Antes de exposição real, derivar actor de identidade autenticada, aplicar autorização por recurso e registrar separadamente eventual identificação declarada pelo cliente. Não usar CORS como controle de acesso.

### A19 - Validação estrutural e normalização divergem entre clientes

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.dto.ts:41`, `:81`, `apps/web/src/lib/form-model.ts:133`**

**Problema:** a UI rejeita nome apenas com espaços e faz trim; a API aceita espaços com `IsNotEmpty`. O frontend não replica limites de 100/255/30 caracteres. `@Type(() => Number)` no body também transforma entradas como age `''` em 0 e `true` em 1 antes de validar. Strings numéricas são intencionais segundo os testes, mas booleanos/vazios não têm política explícita.

**Sugestão concreta:** normalizar texto no servidor antes de validar, compartilhar constantes de comprimento e restringir coerção numérica aos formatos escolhidos. Separar query string, necessariamente textual, de body JSON. Adicionar casos de espaços, limites, booleanos e string vazia. As duas camadas devem ter responsabilidades complementares, não falsas promessas de equivalência total.

### A20 - Query DTO tem limites documentados que não valida

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.dto.ts:93`, `:133`**

**Problema:** minAge/maxAge exibem 0..120 no Swagger, mas só usam `IsInt`; intervalos invertidos de age/BMI são aceitos. `page` não tem limite superior nem garantia explícita de inteiro seguro; páginas extremas tornam offset inválido ou caro. O serviço limita pageSize, mas depende do DTO para o restante.

**Sugestão concreta:** usar AGE_BOUNDS também nos filtros, validar min <= max e limitar page/offset a um domínio seguro. Compartilhar DEFAULT/MAX_PAGE_SIZE em vez de repetir 25/100 nos decorators. Decidir se intervalo vazio é erro de entrada ou resultado vazio e documentar a decisão.

### A21 - `@Exists` é uma abstração genérica sem consumidor e com contrato amplo demais

**Severidade: BAIXA | Arquivo:linha: `apps/api/src/common/validation/exists.constraint.ts:28`, `:51`**

**Problema:** nenhum DTO de produção o utiliza. O parâmetro model aceita qualquer string; o cast apaga a tipagem e assume que todo delegate tem `id` e `deletedAt`, o que não vale para AuditLog. Erros de configuração viram false ou exceção de consulta. A mensagem ainda inclui o valor recebido. O comentário sobre TOCTOU é correto, mas o serviço atual também não resolve toda concorrência apenas por abrir transação, como mostra A04.

**Sugestão concreta:** se o decorator não for requisito explícito da avaliação, removê-lo até surgir consumidor. Se for, restringir a modelos suportados com mapa tipado, validar o formato do id antes da query, selecionar somente id e tratar configuração inválida como erro de programação. Nunca substituir FK, constraint ou controle concorrente por esse validator.

## Achados no frontend e em Clean Code

### A22 - Recuperação de duplicado pode oferecer a pessoa errada

**Severidade: ALTA | Arquivo:linha: `apps/web/src/components/ParticipantForm.tsx:83`, `apps/api/src/features/participants/participants.repository.ts:190`**

**Problema:** após 409, a UI busca por substring com pageSize 1 e assume que o primeiro resultado é o dono do email. Se existem `ana@x.com` e `joana@x.com`, buscar `ana@x.com` encontra ambos, e a ordenação padrão pode devolver Joana. A UI afirma que “esta pessoa já existe” e oferece editar o registro errado.

**Sugestão concreta:** usar consulta exata pela chave de email normalizada, com autorização equivalente à leitura do participante, ou informação explícita do conflito quando apropriado. Não escolher `data[0]` de busca textual. Testar colisões por substring, caixa e ordenação temporal.

### A23 - Debounce não evita respostas fora de ordem

**Severidade: MEDIA | Arquivo:linha: `apps/web/src/app/page.tsx:34`, `:49`**

**Problema:** limpar timeout cancela apenas requisições ainda não iniciadas. Uma busca A lenta pode concluir depois de B e sobrescrever a página, o erro e o loading atuais. O mesmo vale para refresh após excluir: uma resposta anterior pode reintroduzir visualmente um registro apagado.

**Sugestão concreta:** usar geração/id da requisição para ignorar resultados antigos ou AbortController com signal no cliente API. Distinguir cancelamento de NETWORK_ERROR. Testar promises resolvidas na ordem inversa. Uma biblioteca de cache é opcional, não requisito para resolver esse problema pequeno.

### A24 - Estado de edição pode mudar enquanto o submit está em voo

**Severidade: MEDIA | Arquivo:linha: `apps/web/src/components/ParticipantForm.tsx:59`, `:108`, `:269`**

**Problema:** somente o botão submit é desabilitado. O usuário pode cancelar ou selecionar outro participante enquanto o save anterior aguarda resposta. Quando ele termina, `onSaved` limpa a edição atual (`page.tsx:85`), descartando o contexto novo. A criação também pode limpar dados digitados enquanto a primeira requisição estava em andamento.

**Sugestão concreta:** bloquear troca de contexto durante uma mutação ou associar o resultado à identidade/geração do formulário que iniciou a operação. Limpar estado apenas se ainda pertence àquela operação. Testar edição A, seleção B e conclusão tardia de A.

### A25 - Cliente tipado aceita resposta inválida como sucesso

**Severidade: MEDIA | Arquivo:linha: `apps/web/src/lib/api.ts:42`**

**Problema:** JSON inválido vira null e, se o status é 2xx, retorna como T. Um proxy que entregue HTML 200 pode fazer um create parecer bem-sucedido ou uma listagem sumir. Os tipos compartilhados desaparecem em runtime e os casts não validam o envelope.

**Sugestão concreta:** rejeitar body inválido em sucessos que exigem JSON, separar explicitamente respostas 204 e validar ao menos os envelopes críticos. Gerar validadores a partir de uma fonte comum se o contrato crescer; não duplicar manualmente todo o schema sem necessidade.

### A26 - Campos e erros dependem de textos humanos

**Severidade: BAIXA | Arquivo:linha: `apps/web/src/lib/form-model.ts:155`, `apps/web/src/components/ParticipantForm.tsx:76`**

**Problema:** a UI decide o campo a partir de `message.startsWith('weight')`, `height` e `age`. Traduzir ou reescrever uma frase quebra o roteamento. O código de email é um literal, embora exista ErrorCode compartilhado. Há duplicação real na conversão de altura de `display.ts:28` em relação a `inchesToFeetInches`.

**Sugestão concreta:** retornar erros de domínio estruturados `{field,code,message}` e usar ErrorCode no frontend. Reutilizar o helper de altura após definir sua política de precisão. Manter DTO HTTP e tipos de persistência separados é uma duplicação útil; não os fundir apenas para reduzir linhas.

### A27 - Wrapper de campo promete ligação acessível que não implementa

**Severidade: BAIXA | Arquivo:linha: `apps/web/src/components/ParticipantForm.tsx:282`**

**Problema:** o wrapper cria `${id}-error`, mas os inputs não recebem `aria-describedby` nem `aria-invalid`. `role=alert` anuncia o surgimento da mensagem, mas não mantém a associação ao campo quando ele recebe foco. O comentário “accessible error wiring” exagera a implementação.

**Sugestão concreta:** passar props de acessibilidade aos inputs explicitamente ou por uma pequena API de Field, inclusive para os dois controles da altura US. Adicionar teste de relação label/input/erro e foco no primeiro campo inválido após submit.

### A28 - Componente de formulário concentra orquestração além do markup

**Severidade: BAIXA | Arquivo:linha: `apps/web/src/components/ParticipantForm.tsx:25`**

**Problema:** cerca de 280 linhas combinam sincronização de edição, estado, gravação, recuperação de duplicado e JSX. O tamanho por si só não é defeito, e extrair `form-model` já foi uma boa escolha. A responsabilidade de procurar e selecionar outro participante dentro do tratamento de erro é a parte que mais acopla fluxos diferentes.

**Sugestão concreta:** após corrigir A22/A24, extrair a orquestração de submit/conflito para um hook ou caso de uso pequeno, deixando o componente cuidar de interação e renderização. Não criar um componente para cada input só para cumprir um limite de linhas. Preferir nomes específicos como `setField` e `parseNumber` a `set` e `num` ao tocar nesses trechos.

## Achados de paginação, arquitetura e testes

### A29 - Ordenação não é total e count não tem snapshot explicitamente consistente

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.repository.ts:67`, `:209`**

**Problema:** sort por idade/BMI/sobrenome/data não tem desempate por id. Valores iguais podem aparecer em ordem diferente entre páginas. A transação que faz findMany e count não especifica isolamento; sob Read Committed, os comandos podem observar conjuntos distintos com escritas concorrentes. Offset também desloca páginas quando há inserção/exclusão, o que é uma limitação conhecida, não motivo automático para abandoná-lo.

**Sugestão concreta:** adicionar id como critério secundário em todos os sorts. Se total e dados precisarem refletir o mesmo snapshot, usar Repeatable Read nessa operação ou uma consulta única apropriada. Após exclusão da última linha da última página, o frontend deve ajustar a página válida em vez de mostrar “Page 2 of 1” (`page.tsx:102`, `ParticipantsTable.tsx:149`).

### A30 - Busca e índices precisam evoluir juntos, conforme volume

**Severidade: BAIXA | Arquivo:linha: `apps/api/src/features/participants/participants.repository.ts:190`, `apps/api/prisma/schema.prisma:77`, `:97`**

**Problema:** substring case-insensitive em três campos, join, count exato e offset profundo tornam o custo crescente. Os índices B-tree simples existentes não resolvem de forma geral busca `%texto%`; tombstones continuam nos índices comuns. Não há medição de lentidão nesta revisão.

**Sugestão concreta:** conservar offset para o take-home. Com volume representativo, medir EXPLAIN ANALYZE e latência; então avaliar trigram para texto e índices parciais/combinados para consultas frequentes, por exemplo `(created_at,id) WHERE deleted_at IS NULL`. Só adotar keyset quando o requisito de navegação e as medições justificarem.

### A31 - Dependência de Prisma atravessa a fronteira declarada

**Severidade: BAIXA | Arquivo:linha: `apps/api/src/features/participants/participants.service.ts:36`, `apps/api/src/common/audit/audit.service.ts:24`**

**Problema:** o README diz que só o repository conhece Prisma, mas o serviço injeta PrismaService e administra `$transaction`; AuditService recebe Prisma.TransactionClient e grava diretamente. O serviço ainda depende de classes concretas, não de portas. Isso é uma arquitetura em camadas pragmática, não uma aplicação plenamente independente da infraestrutura.

**Sugestão concreta:** primeiro corrigir a descrição para refletir a decisão. Se isolamento de infraestrutura se tornar objetivo real, introduzir uma pequena porta de unidade de trabalho que ofereça operações transacionais de participants e audit, sem expor todo Prisma. Não criar repositório genérico por entidade nem abstrações vazias. Preservar a atomicidade existente.

### A32 - Nx não codifica as fronteiras de domínio/framework

**Severidade: BAIXA | Arquivo:linha: `eslint.config.mjs:18`**

**Problema:** a regra de boundaries permite qualquer tag depender de qualquer tag. Ela ainda fornece verificações gerais do Nx, mas não impede especificamente que contracts passe a depender de bibliotecas de UI/infraestrutura. A configuração resolvida de API tem somente a tag `npm:private`.

**Sugestão concreta:** adicionar poucas tags arquiteturais, por exemplo shared/client/server, e restrições compatíveis. Para contracts, restringir imports de frameworks/infraestrutura. Não criar uma matriz complexa para quatro projetos.

### A33 - Testes de integração podem apagar o banco errado

**Severidade: ALTA | Arquivo:linha: `apps/api/src/features/participants/participants.repository.spec.ts:48`, `.husky/pre-commit:3`**

**Problema:** a suíte usa o PrismaService com DATABASE_URL ambiente e trunca todas as tabelas relevantes com CASCADE. Não há verificação de que o destino seja descartável. Como o hook roda test automaticamente, um commit pode apagar dados de desenvolvimento importantes ou outro banco configurado. O aviso no README não impede o erro operacional.

**Sugestão concreta:** usar banco/schema exclusivo de teste, com credencial sem acesso aos demais, e uma verificação explícita de destino antes de limpar. Separar target de integração do unitário e serializar suítes que compartilham o mesmo schema. Não rodar essa suíte contra a aplicação usada manualmente.

### A34 - Cobertura alta não cobre garantias de composição

**Severidade: MEDIA | Arquivo:linha: `apps/api/src/features/participants/participants.service.spec.ts:35`, `apps/api-e2e/src/api/participants.spec.ts:20`, `apps/web/src/app/page.spec.tsx:6`**

**Problema:** o mock transacional só executa callback; não comprova rollback real quando audit falha. Integração de repository não passa pelo serviço/audit. Smoke HTTP cobre o caminho feliz e erros básicos, sem concorrência, limiares de arredondamento ou null em update. UI usa API mockada e não há suíte de navegador que una formulário, API e banco. Por isso, linhas cobertas convivem com A01/A04/A05/A22.

**Sugestão concreta:** priorizar testes de comportamento: falha do audit revertendo todo o agregado; ausência de órfãos após conflito; null no update; precisão e categorias; conflito concorrente; duplicado por substring; respostas fora de ordem. Adicionar um E2E de navegador de criar/editar/converter/buscar/excluir com banco isolado. Não elevar thresholds como substituto desses casos.

### A35 - README confunde percentuais apresentados com gates efetivos

**Severidade: MEDIA | Arquivo:linha: `README.md:106`, `apps/api/jest.config.cts:29`, `apps/web/jest.config.cts:22`, `libs/contracts/jest.config.cts:22`**

**Problema:** a tabela é apresentada como barra cuja queda falha o build, mas os limites reais são menores. Não foi executada coleta de cobertura nesta revisão; os números do README podem ser resultados de uma execução anterior, mas não são os gates configurados.

| Projeto | README: statements/branches/functions/lines | Gate global configurado |
|---|---|---|
| contracts | 99/100/97/99 | 95/90/90/95 |
| api | 97/75/97/99 | 92/70/92/94 |
| web | 96/89/91/98 | 93/85/88/94 |

A API também tem gate específico para service: statements/functions/lines 100 e branches 80. Main e módulos estão excluídos da coleta. Isso é razoável para wiring, mas não prova que bootstrap e DI foram exercitados. A justificativa genérica de branches baixos por decorators não substitui inspeção do relatório de ramos.

**Sugestão concreta:** separar “resultado da última execução” de “threshold exigido”, incluir comando/data do resultado e manter a configuração como fonte autoritativa. Documentar também o gate específico do service. Garantir wiring com smoke/integração em vez de tentar obter cobertura artificial de decorators.

### A36 - Cache de testes não representa o estado externo do banco

**Severidade: MEDIA | Arquivo:linha: `nx.json:60`, `apps/api/jest.config.cts:11`**

**Problema:** a configuração resolvida de `@org/api:test` tem `cache:true`, enquanto a mesma suíte contém integração com banco externo. Os inputs incluem código e dependências, mas não representam disponibilidade, migração aplicada nem conteúdo do banco. Um cache hit pode apresentar sucesso sem reconectar ao banco atual.

**Sugestão concreta:** separar testes unitários cacheáveis de integração com banco efêmero ou target sem cache. Evitar tentar representar todo estado de banco como hash. Registrar claramente quando CI usa resultados reaproveitados e quando valida o ambiente real.

### A37 - E2E depende de ordem entre testes e usa configuração de porta diferente

**Severidade: BAIXA | Arquivo:linha: `apps/api-e2e/src/api/participants.spec.ts:11`, `apps/api-e2e/src/support/global-setup.ts:11`, `apps/api-e2e/src/support/test-setup.ts:5`, `apps/api/src/main.ts:41`**

**Problema:** id é preenchido por um `it` anterior e o cleanup é outro `it`, não teardown; execução isolada/falha intermediária torna os testes frágeis e pode deixar registros. Além disso, API prioriza API_PORT, mas E2E só lê PORT, contrariando a separação de portas documentada.

**Sugestão concreta:** modelar o fluxo sequencial como um único cenário com cleanup em finally/afterAll, ou criar fixtures independentes por teste. Usar a mesma resolução de API_PORT/PORT nos dois lados e prontidão HTTP de health, não apenas porta aberta.

## Leitura de SOLID aplicada ao projeto

| Princípio | Onde é respeitado | Limitação concreta e ação |
|---|---|---|
| SRP | Controller delega (`participants.controller.ts:40`); domínio numérico é puro (`bmi.ts:34`); modelo de formulário separado (`form-model.ts:128`). | O repository deriva categoria (`participants.repository.ts:173`) e o formulário coordena recuperação de outra entidade (`ParticipantForm.tsx:71`). Extrair a política comum de classificação e separar a orquestração de conflito conforme A01/A28. Mapping e query building no mesmo repository pequeno não são, sozinhos, violação de SRP. |
| OCP | Novos AppExceptions entram no filtro sem branch por classe (`all-exceptions.filter.ts:50`); limiares usam tabela (`bmi.ts:22`). | Fallbacks 404/409 hardcodificados (`all-exceptions.filter.ts:106`) exigem editar infraestrutura ao crescer o domínio. A15 remove esse acoplamento. US/METRIC é conjunto fechado do requisito; não precisa de plugin/Strategy só para satisfazer OCP. |
| LSP | As subclasses de AppException preservam code/status/message; PrismaService acrescenta lifecycle sem redefinir operações CRUD (`prisma.service.ts:15`). | Não há hierarquia de implementações intercambiáveis suficiente para alegar uma violação clássica de LSP. `PartialType` amplia nullability runtime e casts prometem view não-null, mas são quebras de contrato de dados, não prova automática de LSP. Corrigir A05/A09 sem inventar hierarquias. |
| ISP | Tipos ProfileInput/MeasurementInput são pequenos (`participant.ts:13`/`:21`); props de Filters/BandChip são específicas. | Serviço recebe o PrismaService inteiro para usar transação (`participants.service.ts:36`); audit recebe cliente amplo para um único insert (`audit.service.ts:24`). A31 sugere porta pequena se a independência se justificar. Não é necessário dividir toda interface com mais de um método. |
| DIP | Controller usa serviço e repository concentra queries; contracts não depende de frameworks. | Injeção de dependência não é inversão de dependência por si só: serviço depende de Prisma e classes concretas. `AppException` também importa HttpStatus do Nest (`app-exception.ts:1`), portanto erros não são domínio agnóstico a HTTP. Isso é aceitável para este serviço de aplicação; documentar ou introduzir portas somente no limite que precisa variar (A31). |

## Modelagem como conjunto e evolução proporcional

**User/Profile/Participant:** a separação física PII/medidas é limpa e permite evolução, mas a API junta ambos em toda leitura. Não existe hoje uma fronteira de autorização ou exportação desidentificada só porque as tabelas estão separadas. User funciona como raiz de identidade, mesmo sem autenticação; não há motivo para removê-lo se faz parte do schema solicitado. O relacionamento é 1:0..1 de User para cada dependente, não obrigatoriamente 1:1 completo no banco (A09).

**Current-state:** `Participant.userId @unique` é uma expressão correta de uma linha por usuário e deve ser mantida para este escopo. Excluir e recriar o mesmo email cria nova identidade e novo encadeamento de audit por participant id, não restaura o mesmo usuário. Uma eventual política de restauração ou reconciliação de identidade precisa ser explícita; email sozinho não deve servir como identificação longitudinal.

**BMI e unidades:** guardar medida com sua unidade é coerente e evita conversões silenciosas na persistência. Decimal ajuda a definir precisão de armazenamento, mas não resolve cálculo antes da quantização, classificação após rounding, limites combinados ou semântica de troca de unidade (A01-A03/A06-A07). Essas são invariantes do domínio, não detalhes cosméticos.

**AuditLog:** snapshots before/after em JSON permitem evolução sem schema por evento, e entityId sem FK preserva independência do histórico. Em contrapartida, `unknown` convertido por cast em `audit.service.ts:37` não assegura JSON serializável para futuros consumidores. Hoje os callers passam views simples, então não há falha atual demonstrada. Ao generalizar, tipar snapshots serializáveis, versionar seu formato e decidir quais campos são autoritativos; uma view destinada à UI não deve virar acidentalmente o contrato histórico eterno.

**Índices e integridade:** a migração parcial é a fonte autoritativa da unicidade ativa; `prisma db push` não deve substituir a aplicação dessas migrações. O banco não tem checks de ranges de idade/medidas ou consistência do BMI. Isso é aceitável como escolha app-level em um único escritor, desde que não se prometa proteção contra SQL direto; se houver importadores ou múltiplos escritores, acrescentar constraints simples e reutilizar a operação canônica de domínio.

## Ordem recomendada de trabalho posterior

1. **Integridade e proteção operacional:** A01-A05, A17, A22 e A33. Adicionar primeiro os cenários que revelam cada defeito em ambiente isolado; só então alterar implementação.
2. **Semântica do contrato:** A06-A10, A13-A16 e A19-A20. Fixar o significado de unidade, nulabilidade, identidade e visibilidade antes de reorganizar classes.
3. **Comportamento assíncrono e evidência:** A23-A25, A29 e A34-A37. Garantir UI coerente, paginação determinística e testes que comprovem composição transacional.
4. **Manutenção proporcional:** A21, A26-A28, A31-A32. Melhorar nomes, mensagens estruturadas e limites reais sem transformar o take-home em framework.
5. **Evolução condicionada a uso real:** A11-A12, A18 e A30. Autorização e proteção de PII são pré-condições para dados reais; histórico longitudinal e índices adicionais devem acompanhar requisitos e medições.

O desenho base merece ser preservado. A prioridade é tornar verdadeiras as invariantes já anunciadas e verificá-las nas fronteiras entre UI, API e banco.
