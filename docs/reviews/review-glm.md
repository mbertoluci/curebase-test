# Review 360 - Arquitetura e Estrutura de Código

**Projeto:** curebase-bmi (monorepo Nx: NestJS 11 em `apps/api`, Next 16 em `apps/web`, domínio compartilhado em `libs/contracts`)
**Foco:** exclusivamente estrutura de código e arquitetura (camadas, fronteiras, SOLID, modelagem, coesão/acoplamento). Bugs de runtime, arredondamento de BMI, nulabilidade de update, redaction de PII, mapeamento de erro HTTP e README estão fora de escopo.
**Método:** leitura integral do código-fonte (não apenas dos docblocks), incluindo `schema.prisma`, migrações, configs do workspace e testes.

---

## 1. Mapa real de dependências (o que o código importa, não o que os comentários dizem)

```
apps/web ──────────────> libs/contracts          (única dependência externa da UI; zero Nest, zero Prisma)
apps/api/features ─────> libs/contracts
                     ├──> common/ (errors, audit)
                     └──> database/ (PrismaService p/ $transaction)
apps/api/common ───────> libs/contracts, Nest
                     ├──> audit: conhece tipos e client do Prisma
                     └──> validation: conhece PrismaService
apps/api/database ─────> Nest, Prisma            (@Global, infraestrutura)
libs/contracts ────────> (nada; package.json com dependencies {})
```

**Quem conhece Prisma de fato:** `database/prisma.service.ts`, `features/participants/participants.repository.ts`, `common/audit/audit.service.ts` (tipo `Prisma.TransactionClient` + `tx.auditLog`), `common/validation/exists.constraint.ts` (injeta `PrismaService`) e `features/participants/participants.service.ts` (injeta `PrismaService` para `$transaction`). O docblock do repository ("It is the ONLY place that knows the Prisma schema", `participants.repository.ts:21`) é verdadeiro para o *schema*, mas não para o *cliente/transação*: o Prisma vaza para 4 lugares além do repositório. Isso é o achado central G01.

**Quem conhece Nest:** apenas `apps/api` (correto). `contracts` e `web` não importam nada do Nest.

---

## 2. Pontos fortes da arquitetura

1. **Feature-vertical slice completa e consistentemente nomeada.** `features/participants/` tem controller/service/repository/dto/type/error/module, todos com o prefixo `participants.<camada>.ts` e specs colocalizados. Sem sufixos `.impl`, sem mistura de responsabilidades entre arquivos. É o padrão que o restante do código consegue copiar sem pensar.

2. **`libs/contracts` como ponto de inversão de dependência real.** A lib tem zero dependências (`libs/contracts/package.json:15`), contém só tipos + funções puras, e é a única coisa que API e web compartilham. API e UI nunca driftam: os DTOs do Nest `implements CreateParticipantInput` (`participants.dto.ts:40`) e a view do repositório retorna `ParticipantView`. Structural typing usado como teste de conformidade em tempo de compilação - padrão excelente e raro.

3. **Mapeamento entidade -> DTO em um único ponto.** `ParticipantsRepository.toView()` (`participants.repository.ts:159-177`) é a única fronteira onde `Decimal`/`Date` viram `number`/ISO e onde `bmiBand` é derivado. Nada acima do repositório vê tipos do Prisma nas *entradas e saídas* (o vazamento é só no tipo do `tx`, ver G01).

4. **Três fronteiras de tipo distintas por feature:** DTO HTTP (class-validator), tipos de repositório (`participants.type.ts`), entidades Prisma. Muitos projetos do tamanho deste colapsam as três numa só; aqui estão explicitamente separadas e documentadas.

5. **Arquitetura de erros extensível.** `AppException` base + erros concretos colocalizados com a feature (`participants.error.ts`) + filtro global único + `@Throws()` que gera OpenAPI a partir dos próprios erros (`throws.decorator.ts`). Adicionar um erro novo não toca em neném um arquivo fora da feature - OCP de verdade (com a ressalva de G03).

6. **Auditoria transacional.** `AuditService.record(tx, ...)` recebe o client da transação, então mutação + audit commitam juntos (`participants.service.ts:63-73`). O design do `audit_log` (append-only, sem `deleted_at`) está coerente entre schema, serviço e migração.

7. **Modelagem numérica do dado clínico.** `Decimal(6,2)`/`Decimal(5,2)` no Prisma + conversão para `number` só na saída do repositório (`schema.prisma:86-89`), com o índice único parcial de email resolvido em migração manual documentada (`20261022185727_partial_unique_email_active/migration.sql`) - decisão de schema com o tradeoff escrito no lugar certo.

8. **Frontend com separação lógica/apresentação honesta.** `lib/` (`api.ts`, `form-model.ts`, `display.ts`) é 100% pura e testável; `components/` são presentational (props + callbacks); `app/page.tsx` é o único container com estado. `form-model.ts` é um view-model de verdade (estado bruto de string -> payload validado), não lógica escondida no JSX.

9. **Pirâmide de testes estruturada:** unit tests colocalizados por camada, integration tests do repositório contra Postgres real (`participants.repository.spec.ts`), e um app `apps/api-e2e` separado para HTTP e2e. Cada nível testa a camada a que pertence.

---

## 3. Achados

Nenhum achado de severidade **alta**: não há violação estrutural que comprometa o sistema hoje. Os seguintes são os que valem atenção, ordenados por severidade.

### G01 - Prisma vaza para a service e para o common/ via `TransactionClient` (média)

**Arquivos:** `apps/api/src/features/participants/participants.service.ts:36,63,81,160`; `apps/api/src/common/audit/audit.service.ts:2,24-35`; `apps/api/src/features/participants/participants.repository.ts:48-49,81,118,141`.

**Problema:** a decisão "service é o dono da fronteira de transação" (correta) foi implementada deixando a service injetar `PrismaService` para chamar `$transaction` e passar `Prisma.TransactionClient` para `createTx/updateTx/softDeleteTx/findByIdTx` e para `AuditService.record`. Consequências estruturais:

- `common/audit` virou um segundo data-access object que fala Prisma direto (`tx.auditLog.create`) morando em `common/` - o acoplamento `common -> ORM` existiria mesmo que a feature mudasse de banco.
- O padrão de orquestração "abre tx, lê before, escreve, audita" está duplicado à mão em três métodos da service (`create` 63-73, `update` 81-113, `remove` 160-171). A segunda feature que precisar de audit vai copiar e colar isso.
- O contrato declarado no docblock do repository ("ONLY place that knows Prisma") não bate com o código: o tipo do Prisma aparece na assinatura de service e audit.

**Sugestão (sem cerimônia):** mantenha o `$transaction` na service - abstrair UnitOfWork aqui seria over-engineering - mas: (a) mova o tipo do tx para um alias próprio (`type Tx = Prisma.TransactionClient` exportado de `database/`) para que `common/audit` e a feature dependam do alias, não do símbolo do Prisma importado direto; e/ou (b) extraia um helper privado `mutateWithAudit(entry, write)` na service para os três métodos deixarem de repetir o ritual. A alternativa purista (repository expor `withTransaction(fn)` que esconde o Prisma inteiro) só vale a pena quando surgir a segunda feature.

### G02 - Posse da transação inconsistente entre service e repository (baixa)

**Arquivo:** `apps/api/src/features/participants/participants.repository.ts:67-76`.

**Problema:** o docblock da service diz "the transaction boundary" pertence a ela (`participants.service.ts:30`), mas `repository.list()` abre o próprio `$transaction([...])` (findMany + count). Regra arquitetural declarada ≠ regra seguida: um leitor vai procurar a posse das transações num lugar só e não vai achar.

**Sugestão:** ou documente a exceção no repository ("read-consistency tx local ao list"), ou mova o count+page para fora. Não muda comportamento; alinha contrato escrito e código.

### G03 - Filtro global conhece semântica de domínio da feature (média)

**Arquivo:** `apps/api/src/common/errors/all-exceptions.filter.ts:106-110`.

**Problema:** `codeForStatus()` mapeia *qualquer* 404 para `PARTICIPANT_NOT_FOUND` e *qualquer* 409 para `EMAIL_ALREADY_EXISTS`. Isso inverte a fronteira `common <-> feature`: o componente cross-cutting contém conhecimento hardcoded de uma feature específica. Na primeira segunda entidade, um 404 alheio vira "participant not found" - bug estrutural de fronteira, não de mapeamento (a quebra é o acoplamento, o efeito HTTP é sintoma).

**Sugestão:** remova os dois `if`s e deixe o fallback genérico (`HTTP_${status}`); os `AppException` de domínio já carregam o código certo e passam pelo ramo 1 do filtro. Com isso, `common/` volta a ser 100% agnóstico de feature - e o design de erros (ponto forte 5) fica completo.

### G04 - `ExistsConstraint`: infraestrutura genérica especulativa, não usada, com convenção embutida (média)

**Arquivos:** `apps/api/src/common/validation/exists.constraint.ts:23-48`; `validation.module.ts`; `apps/api/src/main.ts:16` (`useContainer`).

**Problema:** nenhum campo usa `@Exists` hoje. Para sustentar um validador sem uso, o projeto carrega: um módulo dedicado, wiring de `useContainer` no bootstrap e um design com três fragilidades estruturais: (a) lookup de modelo por string não tipada (`this.prisma as unknown as Record<string, ...>`, linhas 31-36); (b) a convenção de soft-delete (`deletedAt: null`, linha 39) embutida num validador "genérico" - falharia para qualquer tabela sem `deletedAt` (ex.: `audit_log`); (c) o comentário próprio admite o gap TOCTOU. É speculative generality: código que antecipa o futuro e paga juros no presente.

**Sugestão:** para um take-home, delete `common/validation/` inteiro e o `useContainer` do `main.ts`. Se mantê-lo, tipem-se as chaves de modelo (`keyof PrismaService` via `Object.keys`) e remova a suposição de `deletedAt` (parâmetro de escopo opcional).

### G05 - Dependências entre projetos não declaradas nos `package.json` (média)

**Arquivos:** `apps/api/package.json:71-81`; `apps/web/package.json:8-12`; raiz `package.json:76-99` (todas as deps reais hoisted); `apps/web/tsconfig.json` (referencia `../../libs/contracts` via project reference).

**Problema:** `apps/api` importa `@org/contracts`, `@prisma/client`, `class-validator`, `class-transformer`, `@nestjs/swagger`, `nestjs-pino`, `@nestjs/config` - nenhum declarado no seu `package.json`; tudo resolve pelo hoisting do workspace raiz (o symlink `node_modules/@org/contracts` existe só por isso). O mesmo no web com `@org/contracts`. Consequências estruturais: o grafo do Nx fica cego à aresta `api -> contracts` (afeta `nx affected`, `enforceBuildableLibDependency`, e os targets `prune-lockfile`/`copy-workspace-modules` que pressupõem deps declaradas); e qualquer projeto pode importar qualquer coisa sem deixar rastro.

**Sugestão:** declarar `"@org/contracts": "*"` nos dois apps (e as demais libs de runtime no api). É uma linha por dependência que torna o grafo real.

### G06 - `enforce-module-boundaries` configurado como no-op (baixa)

**Arquivo:** `eslint.config.mjs:18-24`.

**Problema:** a única `depConstraint` é `sourceTag: '*' -> onlyDependOnLibsWithTags: ['*']`, ou seja, a regra existe mas não proíbe nada. As fronteiras do desenho (apps -> contracts; contracts -> nada) não estão codificadas em lugar algum - só na disciplina de quem escreve.

**Sugestão:** barato e de alto valor documental: taggear `libs/contracts` com `scope:shared` e adicionar uma constraint `sourceTag: scope:app -> onlyDependOnLibsWithTags: [scope:shared]` (e `scope:shared -> []`). Junto com G05, o desenho passa a ser enforceável em vez de aspiracional.

### G07 - Default de paginação/ordenção triplicado (baixa)

**Arquivos:** `apps/web/src/app/page.tsx:16-21` (`DEFAULT_QUERY`); `apps/api/src/features/participants/participants.service.ts:125-142`; `apps/api/src/features/participants/participants.dto.ts:100,145,150` (`default:` no OpenAPI).

**Problema:** "page=1, pageSize=25, sortBy=createdAt, sortDir=desc" vive em três lugares (dois lados da fronteira + doc). As constantes `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` estão compartilhadas (bom), mas o *sort default* não existe em `contracts` - se a API mudar o default, o web envia explicitamente o antigo e a divergência fica silenciosa.

**Sugestão:** exportar `DEFAULT_SORT = { field: 'createdAt', direction: 'desc' } const` de `libs/contracts/src/lib/participant.ts` e consumir nos três pontos. Pequeno, mas elimina uma categoria inteira de drift.

### G08 - `UpdateParticipantData` aceita `bmiValue` vindo de fora (baixa)

**Arquivo:** `apps/api/src/features/participants/participants.type.ts:19-24`.

**Problema:** o comentário do campo diz "Derived server-side by the service; the repository only stores it", mas `UpdateParticipantData = Partial<CreateParticipantData>` reabre `bmiValue` como input opcional de qualquer chamador de `updateTx`. O invariant declarado não está expresso no tipo - está confiado ao comportamento.

**Sugestão:** `type UpdateParticipantData = Partial<Omit<CreateParticipantData, 'bmiValue'>> & { bmiValue?: number }` não resolve (mesma coisa). O que expressa o intento: `Omit<CreateParticipantData,'bmiValue'>` parcial para os campos de input + `bmiValue` como campo separado adicionado só pela service (ex.: `DerivedBmi = { bmiValue: number }`, e `updateTx(tx, id, patch: UpdateParticipantData, derived?: DerivedBmi)` ou um campo `derived` agrupado). Ganho pequeno de precisão; fazer só se tocar nesses tipos por outro motivo.

### G09 - Guarda de existência duplicada e re-leitura pós-escrita no repository (baixa)

**Arquivo:** `apps/api/src/features/participants/participants.repository.ts:141-154` (`softDeleteTx` refaz `findFirst` e retorna silenciosamente se não achar) e `:106-110` (`createTx` faz `select id` e depois re-lê via `findByIdTx`).

**Problema:** a service já verifica existência dentro da mesma tx (`findByIdTx` + `ParticipantNotFoundError`); `softDeleteTx` verifica de novo e *engole* o miss (`if (!row) return`). Dois pontos de verdade para a mesma invariant na mesma transação, um deles mudo - se algum dia o re-check falhar, a auditoria registra um DELETE de algo que não foi deletado. A re-leitura pós-create/update (query extra para reconstituir o agregado) é um custo aceitável pelo isolamento do `toView`, mas vale saber que ela existe por design.

**Sugestão:** no `softDeleteTx`, remova o re-check (a service é a dona da invariant) ou deixe-o lançar em vez de retornar. Não criar camada de mapper nova por causa disso.

### G10 - `audit_log.entity_id` tipado como UUID restringe o domínio auditável (baixa)

**Arquivo:** `apps/api/prisma/schema.prisma:37`.

**Problema:** `entityId String @db.Uuid` acopla a tabela de auditoria - pensada como genérica (`entity: String` livre) - a chaves UUID. Qualquer entidade futura com id não-UUID não poderá ser auditada sem migração.

**Sugestão:** para o escopo atual (todas as entidades são UUID) está correto e mais compacto; anote a restrição no comentário do model. Se o audit for desenhado como serviço transversal de longo prazo, `String` puro é mais fiel ao intento.

### G11 - Estratégia de configuração mista: ConfigModule registrado mas bypassado (baixa)

**Arquivos:** `apps/api/src/app/app.module.ts:16` (`ConfigModule.forRoot({ isGlobal: true })`) vs. `:12,19-22` e `apps/api/src/main.ts:12,19,41` lendo `process.env` direto.

**Problema:** duas formas de acessar configuração coexistem sem motivo. `ConfigModule` hoje só carrega o `.env`; ninguém injeta `ConfigService`. Não é bug - é inconsistência de fronteira de infraestrutura (a config deveria ter um único ponto de acesso).

**Sugestão:** ou remova o `ConfigModule.forRoot` (e documente o `.env` como responsabilidade do runtime), ou migre as leituras de `main.ts`/`app.module` para `ConfigService`. Qualquer um dos dois; não os dois.

### G12 - Placement inconsistente de spec no web (baixa)

**Arquivo:** `apps/web/specs/form-model.spec.ts` (todo o resto colocalizado: `src/lib/api.spec.ts`, `src/lib/display.spec.ts`, `src/components/*.spec.tsx`).

**Problema:** o projeto tem uma convenção clara (spec ao lado do fonte, visível no api e nos demais arquivos do web) e um arquivo fora dela, num diretório `specs/` que existe só para ele.

**Sugestão:** mover para `apps/web/src/lib/form-model.spec.ts`. Mudança de 1 linha de config no máximo.

### G13 - Único acesso a dados fora do container está no `ParticipantForm` (baixa)

**Arquivo:** `apps/web/src/components/ParticipantForm.tsx:83-87` (`api.list(...)` dentro do handler de erro 409).

**Problema:** a arquitetura do web é "page.tsx é o único owner de acesso à API; componentes são presentational". O componente quebra isso uma vez, para o fluxo de "email duplicado -> achar o registro existente". É um compromisso defensável (o fetch é detalhe do tratamento de erro), mas cria um segundo lugar onde a UI fala com a rede.

**Sugestão:** aceitável como está; se incomodar, o `onDuplicateFound` poderia ser um callback prop e o lookup subiria para a page. Não fazer agora.

### G14 - `libs/contracts` mistura contrato de fio e lógica de domínio (baixa, informacional)

**Arquivos:** `libs/contracts/src/lib/bmi.ts`, `units.ts` (funções com comportamento) vs. `participant.ts`, `errors.ts` (tipos/constantes de contrato); `index.ts:1-4` (barrel `export *`).

**Problema:** o nome "contracts" promete tipos; a lib também entrega o núcleo clínico da aplicação (`computeBmi`, `classifyBmi`, `measurementErrors`, conversões). Isso é uma decisão *boa* (uma única implementação da regra clínica, preview no client e autoridade no server bebem da mesma fonte) mas com duas consequências: o barrel `export *` faz cada consumidor ver o domínio inteiro (ISP de módulo; mitigado no runtime por tree-shaking, não no nível de navegação), e se as regras clínicas um dia precisarem de dependências (tabelas pediatricas, i18n), a lib "sem dependências" vira o ponto de maior atrito do monorepo.

**Sugestão:** hoje, não dividir. No máximo, renomear mentalmente para "shared domain + contracts" na documentação e manter a regra de ouro: nada entra em `contracts` que precise de dependency. Quando (se) dividir, o corte natural é `contracts/` (tipos) e `domain/` (funções).

### G15 - Raiz do agregado invertida entre schema e código (baixa, informacional)

**Arquivos:** `apps/api/prisma/schema.prisma:48-59` (User raiz, dono de Profile e Participant) vs. `participants.repository.ts:86-107` (createTx cria User como *veículo* para o Participant) e `:141-154` (soft-delete dirigido de Participant para cima).

**Problema:** no schema, o dono é `User`; no código, o agregado que o domínio manipula é `Participant` (e a API nem expõe o conceito de User). Não é um defeito - `User` é raiz imposta pelo enunciado, e a feature trata o triângulo 1:1:1 como um aggregate só - mas quem ler o schema esperará features de user/profile que não existem, e vice-versa.

**Sugestão:** nada para mudar no código. Deixe a nota "aggregate manipulated as Participant" no comentário do model User (o schema já tem design notes; é uma linha).

---

## 4. Tabela SOLID (aplicado à estrutura real)

| Princípio | Veredito | Evidência concreta | Ressalva |
|---|---|---|---|
| **SRP** | Bom | Controller só (de)serializa e delega (`participants.controller.ts:30-34`); mapeamento ent->DTO só em `toView`; BMI só em `contracts/bmi.ts`; form só renderiza, lógica só em `form-model.ts`. | `page.tsx` concentra 7 estados (query, page, loading, error, editing, toast, refresh) - aceitável num container único; `service.list` acumula normalização de query + default + montagem de pageInfo. |
| **OCP** | Bom | Erro novo = subclasse de `AppException` + entrada no `@Throws`, sem tocar no filtro (`app-exception.ts`, `throws.decorator.ts`); feature nova = novo module. | `codeForStatus` no filtro global quebra a extensibilidade para a 2ª feature (G03). `ExistsConstraint` tenta ser aberto p/ futuro mas fecha errado (G04). |
| **LSP** | Bom | Toda subclasse de `AppException` é substituível pelo base (o filtro opera só sobre o base); DTOs Nest substituem os tipos de `contracts` structuralmente (`implements`). | Nenhuma observável. |
| **ISP** | Bom | `contracts` segmentado por arquivo (`units`, `bmi`, `participant`, `errors`); testes da service consomem `Pick<ParticipantsRepository, ...>` e `Pick<AuditService, 'record'>` (`participants.service.spec.ts:21-32`) - consumir só a fatia necessária é ISP aplicado, não teoria. | Barrel `export *` em `index.ts` dilui a segmentação no nível de import (G14). |
| **DIP** | Misto | O grande ganho: API e web dependem de abstrações em `contracts`, não um do outro. | Service depende da classe concreta `ParticipantsRepository` (idiomático no Nest; interface aqui seria cerimônia - ok). `common/audit` e a service dependem do tipo concreto `Prisma.TransactionClient` (G01) - a abstração de persistência furou exatamente na transação. |

---

## 5. Modelagem das entidades e fronteiras (users/profiles/participants/audit_log)

**O que está bem resolvido:**

- **Separação PII/medida** (`profiles` vs `participants`) cria fronteira natural para access control e para o `search` (que consulta só campos de profile).
- **Soft-delete uniforme** com índice único parcial de email = re-registro pós-delete sem perder histórico, garantido no banco (não na aplicação).
- **`bmiValue` armazenado + recomputado a cada mutação** (compute-and-store) com `bmiBand` derivado só na leitura: a coluna é cache auditável, a banda nunca envelhece. Decisão coerente e bem documentada em `bmi.ts:8-9`.
- **`audit_log` como tabela de sistema** (sem FK para as entidades - `entityId` solto): desacoplada do ciclo de vida das tabelas de negócio, append-only.

**Fronteiras que merecem atenção:** a inversão de raiz User/Participant (G15, informacional), o `entity_id` como UUID (G10) e o invariant de `bmiValue` não expresso no tipo do repository (G08). Nada que pague refactor agora.

---

## 6. Coesão/acoplamento estrutural do frontend (`apps/web/src`)

- **Estrutura:** `app/` (rota/container), `components/` (apresentação), `lib/` (api client, view-model do form, formatadores). Coesão alta por pasta, acoplamento unidirecional `app -> components -> lib -> contracts`. Nenhum componente importa outro componente "por dentro" além de `BandChip` (folha reutilizável) - grafo limpo.
- **`api.ts`** é a única fronteira de rede: `ApiError` carrega o `code` do contrato compartilhado, e a UI ramifica por código, não por texto - o par com `libs/contracts/errors.ts` fecha o circuito de erro ponta a ponta.
- **`form-model.ts`** concentra validação estrutural + regra de domínio compartilhada (`measurementErrors`) + conversão de unidades: o formulário não tem regra própria, só reusa a do domínio. Essa é a maior vitória estrutural do web.
- Ressalvas menores já cobertas: acesso a dados no `ParticipantForm` (G13), spec fora do lugar (G12), e `page.tsx` como container único de 157 linhas - que é o design certo para 1 página (ver veredicto).

---

## 7. Veredito: o que NÃO deve ser mudado (anti-cerimônia)

1. **Não introduzir `IParticipantsRepository` + injection token.** DI por classe concreta é o idiomático do Nest; a interface aqui só adicionaria um arquivo e zero flexibilidade real (o mock de teste já usa `Pick<...>` estrutural).
2. **Não extrair uma "domain layer" separada da feature.** O vertical slice `features/participants` já é a organização certa; um `libs/domain` com entidades anêmicas seria cargo cult hexagonal num CRUD de uma entidade.
3. **Não abstrair o `$transaction` atrás de um UnitOfWork/`withTransaction` genérico agora.** O vazamento do tipo (G01) resolve-se com um alias de tipo + helper; a abstração completa só se justifica com a segunda feature auditada.
4. **Não quebrar o `page.tsx` em hooks/contextos.** Um container explícito com o estado todo visível num arquivo é mais auditável que `useParticipantsStore` espalhado. Extrair só se nascer a segunda página.
5. **Não dividir `libs/contracts` em contracts/domain hoje** (G14 é informacional). A lib sem dependências é o melhor asset do monorepo; a divisão é decisão para quando houver dor.
6. **Não adicionar camadas de mapper além do `toView`.** A re-leitura pós-write (G09) é o preço de uma fronteira de mapeamento única - tradeoff bom.
7. **Não trocar `Decimal` por float nem mover `bmiBand` para coluna.** A modelagem numérica e a banda derivada-na-leitura estão certas.

**Priorização dos achados, se for tocar em algo:** G03 (fronteira common->feature, correção de 5 linhas) > G05+G06 (declarar deps + tag de boundary: torna a arquitetura enforceável) > G01 (alias de tx + helper de audit) > G02/G07/G09/G12 (higiene de contrato e convenção) > demais (informacionais).

**Nota final:** para um take-home, este é um código estruturalmente acima da média: as decisões que importam (contrato compartilhado, uma fronteira de mapeamento, erro com código estável, audit transacional) estão todas certas, e os achados são de consistência e higiene - não de desenho. Os itens G03/G04 são os únicos onde o código contradiz a própria arquitetura declarada; o resto é polimento.
