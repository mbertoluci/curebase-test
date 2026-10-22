# Revisão de código 360 - Curebase BMI (consolidado)

Data: 22/10/2026. Revisão multiagente da estrutura do código: design arquitetural, SOLID, clean code, modelagem de entidades, boas práticas e escolhas. **Somente análise - nenhum código foi alterado.**

## Participantes e método

| Agente | Papel | Resultado | Documento |
|---|---|---|---|
| **Codex** | Revisão 360 completa e independente (lógica + invariantes + estrutura) | ✅ Concluída - 37 achados (A01-A37) | [`reviews/review-codex.md`](reviews/review-codex.md) |
| **GLM (GLM-5.3)** | Crítica focada 100% em estrutura de código e arquitetura | ✅ Concluída - 15 achados (G01-G15) | [`reviews/review-glm.md`](reviews/review-glm.md) |
| **Claude (Opus 4.8)** | Verificação dos achados dos dois + priorização para a entrega + adições | ✅ Concluída | [`reviews/review-claude.md`](reviews/review-claude.md) |

Orquestração via Herdr (agentes em tabs separadas do mesmo workspace). A revisão saiu com **3 perspectivas**: Codex (análise ampla de lógica, invariantes e estrutura), GLM (recorte exclusivo de arquitetura/estrutura, a pedido) e Claude (autor do código, verificando os dois e priorizando). O GLM rodou no modelo `GLM-5.3` do Coding Plan (a primeira tentativa havia caído no `GLM-5.3-Highspeed`, fora do plano).

## Veredito

A arquitetura está **certa para o tamanho do problema e deve ser preservada** - feature vertical enxuta, controller fino, serviço de aplicação, repositório como única fronteira de persistência, domínio puro compartilhado, transação + auditoria atômica. Não há motivo para DDD cerimonial, repositório genérico ou hexagonal.

Os dois agentes convergem no mesmo ponto central: **o risco não está no desenho, está nas invariantes que o README e os comentários prometem mais forte do que o código garante.** As correções de maior valor tornam verdadeiras as promessas já anunciadas (precisão/classificação do BMI, nulabilidade no update, redaction de PII, mapeamento de erro, identidade do duplicado) - exatamente o que mais pesa quando o critério é "explicar e defender cada linha".

## Pontos fortes (consenso)

- Fronteira HTTP pequena; controller não calcula BMI nem monta query; `ParseUUIDPipe` protege ids.
- Validação em duas camadas bem escolhida (class-validator na borda + regra de domínio por unidade); merge antes de validar no update.
- Domínio compartilhado puro (sem Nest/React/Prisma) em `libs/contracts`; `Unit` como união estrutural evita casts com Prisma.
- Tipos de persistência separados dos DTOs HTTP; mapeamento entity→DTO explícito (não vaza entidade Prisma nem tombstone).
- Atomicidade agregado + auditoria no mesmo `$transaction`; soft-delete do agregado com o mesmo instante.
- Integridade de email no banco via índice único parcial (resolve concorrência e reuso pós-delete).
- Erros por feature com códigos estáveis + filtro global central; frontend com lógica pura extraída (`form-model`) e bons fundamentos de acessibilidade.
- Testes em múltiplos níveis (domínio, serviço, DTO, UI, repositório com Postgres real, smoke HTTP) e decisões documentadas.

## Plano de ação priorizado

### Corrigir ANTES de enviar (barato + visível na banca)

| # | Achado | Ação | Esforço |
|---|---|---|---|
| 1 | **A13** OpenAPI `isArray:true` mente (devolve envelope `{data,pageInfo}`) | DTO de página concreto no `@ApiOkResponse` | ~10 min |
| 2 | **A01/A03** classificação usa 3 precisões; README diz "classify on unrounded" | Classificar sempre o valor **bruto**, arredondar só na borda; alinhar preview/POST/GET | médio |
| 3 | **A05** `PartialType` aceita `null` em campo obrigatório → 500 | `PartialType(dto,{skipNullProperties:false})` + manter phone nullable + teste de null por campo | pequeno |
| 4 | **A15** 404→`PARTICIPANT_NOT_FOUND`/409→`EMAIL_ALREADY_EXISTS`/P2002→email genéricos demais | fallback HTTP com código genérico; reservar códigos de domínio às AppExceptions; checar target do P2002 | pequeno |
| 5 | **A17** PII (email/nome na query) vaza em `request.url` nos logs; README promete redaction | logar rota sem query + requestId estruturado; **corrigir a frase do README** | pequeno |
| 6 | **A22** recuperação de duplicado usa `data[0]` de busca por substring → pessoa errada | lookup por email exato normalizado | pequeno |
| 7 | **A02** BMI de limites extremos estoura `Decimal(5,2)` → 500 | regra explícita (400 antes do banco) ou ampliar para `Decimal(6,2)` | pequeno |
| 8 | **A33** testes de integração dão `TRUNCATE` no banco do ambiente; pre-commit roda test | guarda de destino (ex.: exigir DB `*_test`) ou banco/schema dedicado | pequeno |
| 9 | **A35** README mostra cobertura atingida como se fossem os gates (que são menores) | separar "última execução" de "threshold exigido" | ~10 min |

### Consistência de contrato (médio)

- **A14** documentar 400 estrutural no `@Throws`; **A20** usar `AGE_BOUNDS` nos filtros, validar `min<=max`, compartilhar `DEFAULT/MAX_PAGE_SIZE` (hoje 25/100 hardcoded); **A06** exigir peso+altura ao trocar unidade; **A10/A19** definir política de email (case) e normalização no servidor; **A08/A09** predicado de "agregado ativo" único em todos os reads e tratar agregado incompleto como erro de integridade (não fabricar nome/email vazios); **A29** desempate por `id` em todo sort; **A16** sanitizar 5xx HttpException por padrão.

### Estrutura e arquitetura enforceável (GLM - novos, verificados no código)

O GLM, revisando só a estrutura, trouxe achados que o recorte de lógica do Codex não cobriu. Confirmei cada um contra o código:

| # | Achado | Ação | Esforço |
|---|---|---|---|
| G05 | deps entre projetos **não declaradas** nos `package.json` dos apps (`@org/contracts`, `@prisma/client`, class-validator/transformer, swagger, pino, config só resolvem por hoisting) → grafo do Nx cego à aresta `api→contracts` | declarar `"@org/contracts":"*"` + libs de runtime nos dois apps | pequeno |
| G06 | `@nx/enforce-module-boundaries` é **no-op** (`sourceTag:'*'→['*']`) → fronteiras do desenho não são impostas | taggear `libs/contracts` como `scope:shared` e `scope:app→[scope:shared]`, `scope:shared→[]` | pequeno |
| G02 | `repository.list` abre `$transaction` próprio, contrariando "service é dona da fronteira de transação" | documentar a exceção de read-consistency OU mover count+page | ~5 min |
| G11 | `ConfigModule.forRoot({isGlobal})` registrado mas **bypassado** - tudo lê `process.env` direto, ninguém injeta `ConfigService` | escolher um caminho: ou remover o `ConfigModule`, ou migrar as leituras para `ConfigService` | pequeno |
| G12 | `form-model.spec.ts` isolado em `apps/web/specs/` enquanto todo o resto é colocalizado em `src/` | mover para `apps/web/src/lib/form-model.spec.ts` | ~2 min |
| G08 | `UpdateParticipantData = Partial<CreateParticipantData>` reabre `bmiValue` (derivado no server) como input | separar `bmiValue` derivado do patch de input no tipo | pequeno |
| G09 | `softDeleteTx` refaz `findFirst` e **engole** o miss (`if(!row) return`), duplicando a invariant que a service já garante | remover o re-check ou fazê-lo lançar | pequeno |

G05+G06 são a dupla de maior valor: juntos tornam a arquitetura **enforceável** (hoje é só disciplina). Convergências com o Codex (mesmo achado, outro ângulo): **G01≈A31** (Prisma vaza para service/`common/audit` via `TransactionClient`), **G03≈A15** (filtro global conhece semântica da feature), **G04≈A21/C2** (`@Exists` especulativo sem uso), **G13≈A22** (acesso a dados dentro do `ParticipantForm`).

### Comportamento assíncrono do frontend (médio)

- **A23** respostas fora de ordem (geração/AbortController); **A24** troca de contexto durante submit em voo; **A25** validar envelope em respostas 2xx que exigem JSON; **A27** `aria-describedby`/`aria-invalid` nos inputs; **A26** erros de domínio estruturados `{field,code}` em vez de `message.startsWith`.

### Deixar como "futuro" documentado (já é a postura da entrega - só não prometer demais)

- **A04** concorrência/versionamento · **A11** histórico longitudinal/DOB · **A18** auth/autorização · **A30** keyset/trigram · **A12** triggers/retention/tamper-proof. Corretamente marcados fora de escopo; a única ação é **calibrar comentários/README** para não anunciar garantias que o código não dá (**A31**: o serviço conhece Prisma, contrariando "só o repository conhece Prisma").

## Leitura SOLID (resumo do consenso)

- **SRP** respeitado no geral; exceções: repository deriva a banda (ligar a A01) e o form orquestra recuperação de outra entidade (A22/A28). Mapping + query building no mesmo repository pequeno **não** é violação.
- **OCP** bom (novos AppExceptions sem branch por classe; bandas por tabela); fraqueza nos fallbacks 404/409 hardcoded (A15).
- **LSP** sem hierarquia intercambiável relevante; os "problemas de LSP" são na verdade quebras de contrato de dados (A05/A09), não de substituição.
- **ISP** tipos de entrada pequenos; serviço/audit recebem o `PrismaService`/`TransactionClient` inteiros (A31 - porta pequena só se a independência virar objetivo real).
- **DIP** injeção ≠ inversão: o serviço depende de Prisma concreto e `AppException` importa `HttpStatus` do Nest. Aceitável para um serviço de aplicação; documentar em vez de abstrair.

## Modelagem das entidades (resumo)

Separação física PII (`Profile`) × medidas (`Participant`) é limpa e evolutiva, mas a API junta as duas em toda leitura - não existe fronteira de autorização/exportação desidentificada só porque as tabelas estão separadas. `Participant.userId @unique` expressa corretamente o current-state. `AuditLog` com before/after JSON e `entityId` sem FK é bom para independência, mas (a) as strings `action`/`entity` poderiam ser enum/check, (b) uma view destinada à UI não deveria virar o contrato histórico eterno (tipar snapshots serializáveis ao generalizar). "Soft-delete only" e "append-only" são **convenções da aplicação**, não restrições do banco (FKs permitem cascade; a migração do audit não restringe UPDATE/DELETE) - ok para um único escritor, desde que o README não prometa proteção contra SQL direto.

## Onde NÃO mexer (consenso dos dois)

- Não introduzir hexagonal/porta de unidade de trabalho nem quebrar o `ParticipantForm` em N componentes só por SOLID - corrigir o acoplamento real (A22/A24) e ajustar o README.
- Não trocar offset por keyset agora - medir com volume real primeiro (A30).
- Não elevar thresholds de cobertura como substituto de testes de comportamento (A34): faltam casos (rollback de audit, null no update, limiar de classificação, duplicado concorrente), não mais % de linhas.

---

Detalhe completo por achado em [`reviews/review-codex.md`](reviews/review-codex.md) (A01-A37) e a verificação + priorização em [`reviews/review-claude.md`](reviews/review-claude.md).
