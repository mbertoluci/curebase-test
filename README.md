# Curebase BMI - Participant Capture

A small but complete full-stack app that captures demographic + health data, computes and stores **BMI**, and lets you browse, filter, sort and paginate the records.

- **API**: NestJS 11 (layered: controller → service → repository), Prisma 6, PostgreSQL
- **Web**: Next.js 16 (App Router, React 19)
- **Shared**: a framework-free `@org/contracts` library holding the BMI domain logic, unit rules and wire types - used by **both** apps so they can never disagree on a calculation
- **Monorepo**: Nx 24, with ESLint + Prettier + Jest and a Husky pre-commit gate

---

## Quickstart

```bash
# 0) prerequisites: Node 20+ (22 recommended), Docker, npm
npm install
cp .env.example .env

# 1) database
npm run db:up          # starts Postgres (docker-compose) on localhost:5433
npm run db:migrate     # applies migrations + generates the Prisma client

# 2) run both apps
npm run dev            # API on :3333, web on :3000
```

Open the web app at **http://localhost:3000**. API docs (OpenAPI/Swagger) are at **http://localhost:3333/api/docs**.

Run API and web separately with `npm run dev:api` / `npm run dev:web`.

---

## Project layout

```
apps/
  api/                 NestJS API
    prisma/            schema + migrations (incl. the partial unique index)
    src/
      database/        PrismaService (connection lifecycle) + global module
      common/
        errors/        AppException base, global exception filter, @Throws
        validation/    generic @Exists validator (+ module)
        audit/         AuditService (append-only audit_log, same-tx writes)
      features/
        participants/  controller · dto · service · repository · type · error · module
  api-e2e/             HTTP smoke tests against a running API
  web/                 Next.js app (form + table)
libs/
  contracts/           shared BMI logic, unit rules, wire types, error codes
```

### Request flow (one layer, one job)

```
HTTP → Controller → Service → Repository → Prisma → Postgres
        (DTOs)      (domain,    (queries,
                     tx, audit)  entity→DTO)
```

- **Controller** - (de)serializes DTOs, derives the actor, declares expected errors with `@Throws`. No logic.
- **Service** - owns the domain: BMI derivation, the per-unit plausibility rule, the transaction boundary, and the audit write (same transaction as the mutation).
- **Repository** - the only place that knows Prisma. Builds queries, maps `Decimal`/`Date` entities to the plain `ParticipantView` DTO, and translates DB errors (unique violation → domain error).
- **contracts** - pure functions (`computeBmi`, `classifyBmi`, `convertMeasurements`, `measurementErrors`) and types shared by API + web.

---

## Data model

`users 1-1 profiles` (PII) and `users 1-1 participants` (measurements). Current-state model: one participant row per user, edited in place.

| table | notable columns |
|---|---|
| `users` | id, timestamps, `deleted_at` |
| `profiles` | user_id, first/last name, email, phone, `deleted_at` |
| `participants` | user_id, weight, height, `unit` (US\|METRIC), `bmi_value`, age, `deleted_at` |
| `audit_log` | actor, action, entity, entity_id, before, after (append-only) |

- **BMI**: `US = 703·lb/in²`, `METRIC = kg/m²` (height entered in cm). Computed server-side, stored to 2dp, **recomputed on every update**, displayed to 1dp. WHO bands: `<18.5` under · `<25` normal · `<30` over · `≥30` obese; `null` under age 18 (no pediatric curves).
- **Soft-delete only**: nothing is ever hard-deleted. A **partial unique index** (`profiles.email WHERE deleted_at IS NULL`) enforces one active email while still allowing a deleted email to be re-registered.

### Endpoints

| method | path | notes |
|---|---|---|
| `POST` | `/api/participants` | creates user+profile+participant in one tx; duplicate email → `409` |
| `GET` | `/api/participants` | filter (`search`, `unit`, `minBmi`/`maxBmi`, `minAge`/`maxAge`), `sortBy`/`sortDir`, `page`/`pageSize` |
| `GET` | `/api/participants/:id` | `404` if missing/deleted |
| `PUT` | `/api/participants/:id` | partial update; recomputes BMI on a measurement change |
| `DELETE` | `/api/participants/:id` | soft-delete (`204`) |
| `GET` | `/api/health` | liveness |

Every error returns one envelope: `{ statusCode, code, message, details?, timestamp, path }`, with a stable machine `code`.

---

## Testing

```bash
npm run db:up      # the api tests include repository integration tests (real Postgres)
npm run verify     # typecheck + lint + test (all projects)
npm run test       # tests only
npm run e2e        # API HTTP e2e (needs: db up + `npm run dev:api` running)
```

**136 tests.** Coverage is collected on every `nx test` and enforced via `coverageThreshold`, so a drop below the bar fails the build (and the pre-commit):

| project | statements | branches | functions | lines |
|---|---|---|---|---|
| contracts | 99% | 100% | 97% | 99% |
| api | 97% | 75%\* | 97% | 99% |
| web | 96% | 89% | 91% | 98% |

\* API branch % is lower because Nest/Swagger method decorators generate branch points that can't be meaningfully exercised; the logic layers (service, filter, repository) are ~100%.

- **contracts** - BMI formulas (checked against the brief's own examples), bands, conversions, bounds.
- **api** - service domain logic, exception filter, controller, DTO validation, audit, `@Exists`; plus **repository + Prisma integration tests against the real Postgres** (they `TRUNCATE` between tests, so point them at a throwaway DB - the dev DB is fine).
- **web** - form model, API client, and the React components (form, table, filters) via Testing Library, plus the page orchestration.
- **api-e2e** - full HTTP path against a running server: create → duplicate 409 → validation 400 → update recompute → search → soft-delete 404.

A **Husky pre-commit** hook formats staged files and runs `nx affected -t typecheck lint test` (so the coverage gate runs on every commit; the DB must be up).

---

## Key decisions & alternatives considered

**Where is input validated?** In two layers, on purpose. *Structural* validation (types, format, presence, generic ranges) happens at the DTO boundary with **class-validator** + a global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` strip/reject unknown fields - defence against over-posting). *Domain* rules that class-validator can't express cleanly (per-unit plausibility bounds, a cross-field rule) live in the service and reuse the shared `measurementErrors()` so the web and API agree.

**How is user input handled safely?** Prisma parameterises every query (no string-built SQL). DTO whitelisting drops unexpected fields. PII is redacted from logs (`pino` redact) and never leaves the repository unmapped. Ids are validated as UUIDs (`ParseUUIDPipe`).

**Error handling.** A single `AppException` base carries a stable `code` + HTTP status; a global filter converts everything (domain errors, Nest `HttpException`, unknown bugs) into one envelope and guarantees no stack/PII leaks. `@Throws(...)` on controllers declares expected errors and feeds OpenAPI, so the docs can't drift from the code.

**BMI as stored vs computed.** Stored (and recomputed on every write) from server-side inputs, so the table/export never recomputes and the value can't drift from weight/height. Classification is done on the raw value; rounding is display-only.

**Pagination.** Offset pagination - simple, addressable pages with a total count, which is what a human-browsed table wants. Keyset pagination would scale better and is the natural next step if the dataset grows large.

**Soft-delete.** Enforced per-query with an explicit `deleted_at IS NULL` filter (clear and greppable). A global Prisma Client Extension would centralise it further; it was left out to keep the data access obvious to read.

**Auditability.** An app-level, append-only `audit_log` written in the **same transaction** as each mutation (actor + before/after). It intentionally keeps real values (PII) and is exempt from log redaction and soft-delete. DB-trigger history would be tamper-proof against raw SQL - a good hardening step.

**Why `age` as an integer?** It matches the given schema. Date-of-birth (deriving age at read) is the clinically correct choice and would be the first schema change I'd propose.

### Deliberately out of scope (and how I'd add them)

Auth/authorization (the `actor` comes from an `x-actor-id` header, defaulting to `anonymous`); consent capture and subject/study IDs; PII/measurement separation for de-identified export; optimistic-concurrency `version` columns; OpenTelemetry tracing; keyset pagination. Each is a small, well-understood addition on top of the current layering.
