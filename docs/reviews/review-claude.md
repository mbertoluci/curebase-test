# Revisão 360 - Claude (Opus 4.8)

Data: 22/10/2026. Segunda perspectiva, complementar ao `review-codex.md`. Análise estática; nenhum arquivo de código foi alterado.

Como fui o autor do código, esta revisão foca em **(1) verificar** os achados do Codex contra o código real, **(2) priorizar para o contexto da entrega** (take-home avaliado por "explicar cada linha"), e **(3) adicionar** o que faltou. Onde concordo com o Codex não repito o detalhe - aponto o ID dele.

## Verdict arquitetural

A base está certa e deve ser preservada: feature vertical enxuta, controller fino, serviço de aplicação, repositório como única fronteira de persistência, domínio puro compartilhado, transação+auditoria atômica. O Codex chega à mesma conclusão. **O risco real não é a arquitetura - são invariantes que o README/comentários prometem mais forte do que o código garante.** Num processo onde "explicar cada linha" conta, essas promessas falsas são o que mais pode comprometer.

## Verificação dos achados críticos do Codex (confirmo todos)

| ID Codex | Confirmado? | Nota da verificação |
|---|---|---|
| A01 precisão tripla na classificação | **SIM, bug real** | `participants.repository.ts:toView` faz `classifyBmi(row.bmiValue.toNumber(), ...)` sobre o valor **armazenado (2 casas)**, não o bruto. O preview (`form-model.ts`) classifica o valor já em 1 casa. O README afirma "classify on the unrounded value" - **falso na API**. Correção barata e importante. |
| A13 OpenAPI `isArray:true` | **SIM, bug real** | `controller.list` anota `ParticipantDto[]` mas devolve `{data,pageInfo}`. Cliente gerado quebra. Fix trivial (DTO de página). |
| A05 `PartialType` aceita null | **SIM** | `UpdateParticipantDto = PartialType(CreateParticipantDto)` → `IsOptional` deixa `null` passar; `{firstName:null}` vira update Prisma com campo obrigatório null → 500. Fix de 1 linha (`skipNullProperties:false`) + preservar phone nullable. |
| A17 PII em URL nos logs | **SIM** | O filtro loga `${method} ${request.url}` e pino-http registra a URL; `search=ada@email` vaza. `redact` só cobre headers. O README promete "PII redaction in logs" de forma ampla - **exagero**. |
| A15 mapeamento de erro genérico | **SIM** | `codeForStatus` transforma qualquer 404→`PARTICIPANT_NOT_FOUND`, 409→`EMAIL_ALREADY_EXISTS`; `translateWriteError` transforma qualquer P2002→email. Acopla `common/` à feature e engana o cliente. |
| A22 duplicado por substring | **SIM** | `ParticipantForm` no 409 faz `api.list({search:email})` e usa `data[0]` - busca por substring pode oferecer a pessoa errada. |
| A33 testes truncam o banco do ambiente | **SIM, risco operacional** | `repository.spec` dá `TRUNCATE ... CASCADE` em `DATABASE_URL`, e o pre-commit roda `test`. Sem guarda de destino, um commit pode apagar dados de dev. |
| A35 README vs gates reais | **SIM** | A tabela do README mostra os números **atingidos**, não os `coverageThreshold` **configurados** (menores). Apresentar um como o outro é impreciso. |
| A02 BMI estoura `Decimal(5,2)` | **SIM** | Limites (500kg/50cm → BMI 2000) excedem 3 dígitos inteiros → erro 500 na gravação em vez de 400. |

Também confirmo A03 (BMI calculado antes da quantização do Decimal), A16 (5xx HttpException propaga mensagem), A31 (serviço conhece Prisma, contrariando o README), A29 (sort sem desempate por id).

## Prioridade para a ENTREGA (não "um dia")

Separo o que corrigiria **antes de enviar** (barato + seria constrangedor se o entrevistador achar) do que é **discurso de "trabalho futuro"** (já documentado como fora de escopo).

**Corrigir agora (correções pequenas, alto retorno na banca):**
1. **A13** - DTO de página no `@ApiOkResponse` (10 min). OpenAPI mentindo é fácil de pegar.
2. **A01/A03** - classificar sempre o valor **bruto** e arredondar só na borda; alinhar os 3 consumidores. Ou persistir a banda. Corrige a invariante que o README anuncia.
3. **A05** - `skipNullProperties:false` no `PartialType` + manter phone nullable + teste de null por campo.
4. **A15** - fallback HTTP com códigos genéricos (`HTTP_404`); reservar `PARTICIPANT_NOT_FOUND`/`EMAIL_ALREADY_EXISTS` às AppExceptions; no P2002, checar o target da constraint.
5. **A17** - logar rota sem query + requestId em campos estruturados; não embutir `request.url` cru; **corrigir a frase do README** sobre redaction.
6. **A22** - lookup de duplicado por email exato (não `data[0]` de substring).
7. **A35** - no README, separar "resultado da última execução" de "gate exigido".
8. **A33** - guarda de destino nos testes de integração (ex.: exigir nome de banco terminando em `_test`) OU banco/schema dedicado.

**Ajustes rápidos de consistência (média):** A14 (documentar 400 no `@Throws`), A20 (usar `AGE_BOUNDS` nos filtros, validar min<=max, compartilhar `DEFAULT/MAX_PAGE_SIZE`), A29 (desempate por `id` em todo sort), A37 (E2E usar `API_PORT` como o resto).

**Deixar como "futuro" documentado (já é a postura da entrega):** A04 (concorrência/versionamento), A11 (histórico longitudinal/DOB), A18 (auth/autorização), A30 (keyset/trigram), A12 (triggers/retention). Estão corretamente marcados como fora de escopo - a ação é só **não prometer mais do que entregam** nos comentários.

## Adições minhas (não cobertas ou subenfatizadas pelo Codex)

- **C1 (BAIXA) - `AuditModule` não é `@Global` mas `DatabaseModule` é.** Inconsistência de convenção: auditoria é tão transversal quanto o banco. Ou os dois globais, ou os dois importados explicitamente. `apps/api/src/common/audit/audit.module.ts` vs `database/database.module.ts:12`.
- **C2 (BAIXA) - `ValidationModule`/`@Exists` existe só para ser testado.** Reforça o A21: há um módulo + `useContainer` no `main.ts` mantidos para um validator sem consumidor. Para a banca, ou wire num caso real ou remova e cite como "mecanismo que eu adicionaria quando houvesse FK no body".
- **C3 (MÉDIA) - O comentário do schema "recorded value can't drift" é desmentido por A03.** `apps/api/prisma/schema.prisma` - o BMI é calculado sobre o número pré-quantização, então pode divergir das medidas gravadas. Comentário forte demais.
- **C4 (BAIXA) - Mensagem do `confirm()` de delete fala em "audited", mas não há auth/actor confiável.** `page.tsx` - "This can be audited" soa como garantia; com actor=anonymous é frágil (liga-se a A18).
- **C5 (processo) - O GLM não participou desta rodada** (sem acesso ao modelo no plano atual). A revisão 360 saiu de 2 perspectivas (Codex + Claude), não 3. Recomendo refazer com GLM num modelo disponível se quiser o terceiro ângulo.

## Onde eu discordaria de "corrigir"

- **A28 (tamanho do ParticipantForm) / A31 (porta de unidade de trabalho):** concordo com o Codex que **não** se deve introduzir porta/hexagonal ou quebrar o form em N componentes só por SOLID num take-home. A ação certa é corrigir A22/A24 (o acoplamento real do fluxo de conflito) e **ajustar o README** (A31) em vez de abstrair. Simplicidade > cerimônia aqui.
- **Elevar thresholds de cobertura** não resolve A34 (garantias de composição). Concordo: faltam testes de comportamento (rollback de audit, null em update, limiar de classificação, duplicado), não mais % de linhas.

## Síntese

O código é sólido e bem acima do nível de um take-home típico. Os achados não pedem rearquitetura - pedem **tornar verdadeiras as invariantes anunciadas** (precisão/classificação, nulabilidade, redaction, mapeamento de erro, identidade de duplicado) e **calibrar a documentação** para não prometer mais do que o código garante. Isso é exatamente o que mais pesa quando o critério é "explicar e defender cada linha".
