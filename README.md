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

Open the web app at **http://localhost:3000**. API docs (OpenAPI/Swagger) are at **http://localhost:3333/api/docs** (served outside production only).

Run API and web separately with `npm run dev:api` / `npm run dev:web`.

### Run everything in Docker

Prefer one command? The whole stack - Postgres, the API (migrations run on start) and the web app - comes up together:

```bash
docker compose up --build      # or: npm run docker:up
```

- Web **http://localhost:3000** · API **http://localhost:3333/api** · Postgres `localhost:5433`
- Startup ordering is handled by health checks: the API waits for the database, applies `prisma migrate deploy`, then serves; the web app waits for the API to answer.
- **URL wiring** (why two variables): the _browser_ calls the API on the published host port (`NEXT_PUBLIC_API_URL=http://localhost:3333/api`, inlined at build time), while the _web server_ doing SSR reaches it by the compose service name (`API_INTERNAL_URL=http://api:3333/api`). Both are set explicitly in `docker-compose.yml`, so there is no silent fallback.
- Images are multi-stage production builds (`Dockerfile.api`, `Dockerfile.web`): deps installed and the apps built inside the image, the Prisma client generated for Linux.

Tear down with `docker compose down` (add `-v` to also drop the database volume). `npm run db:up` still starts **only** Postgres, for the local-dev flow above.

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
        audit/         AuditRepository (append-only audit_logs, same-tx writes)
      features/
        participants/  controller · dto · service · repository · type · error · module
  api-e2e/             HTTP smoke tests against a running API
  web/                 Next.js App Router app (Tailwind v4)
    src/
      app/             routing only (layout, page = Server Component, error)
      entities/        participant: model · api · display · BandChip
      features/        participant-form · participant-list
      widgets/         participant-page (the composed screen)
      shared/          http · constants · report-error · ui/ (primitives)
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

### Web architecture (feature-sliced)

The frontend uses a Feature-Sliced layout: dependencies flow strictly downward
(`app → widgets → features → entities → shared`) and each slice exposes a public
API via `index.ts`.

- **entities/participant** - the domain noun: model + validation, the API client (which validates the response shape), display helpers, and the band chip.
- **features/** - user interactions: `participant-form` (create/edit) and `participant-list` (search, filter, sort, paginate, delete).
- **widgets/participant-page** - composes the features into the screen.
- **shared/** - framework-agnostic building blocks: the fetch wrapper (`ApiError` + `request`), the error sink, and the UI primitives.

The layering is **lint-enforced** (`import/no-restricted-paths`): `entities/`, for example, cannot import a feature. Cross-slice imports use the `@/` alias. The layout is deliberately feature-sliced-_lite_ (no full `pages`/`views` ceremony) - right-sized for one feature, not gold-plated.

Conventions: React components are `PascalCase.tsx`, everything else is `kebab/lowercase.ts`, and each slice re-exports its public surface through `index.ts`. `shared/` is the exception - imported by submodule (`@/shared/http`, `@/shared/ui`) rather than a root barrel, since its parts are independent leaf utilities.

**Server/client boundary.** `app/page.tsx` is a Server Component that fetches the first list page on the server for a data-complete first paint, then hands it to the client widget as `initialData`; `useParticipantList` seeds from it and skips the initial client fetch (falling back to a client load if the SSR fetch fails). Dates are formatted in UTC so the server markup hydrates without a mismatch. Interactive code (`'use client'`) stays in the leaves.

---

## Data model

`users 1-1 profiles` (PII) and `users 1-1 participants` (measurements). Current-state model: one participant row per user, edited in place.

| table          | notable columns                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| `users`        | id, timestamps, `deleted_at`                                                 |
| `profiles`     | user_id, first/last name, email, phone, `deleted_at`                         |
| `participants` | user_id, weight, height, `unit` (US\|METRIC), `bmi_value`, age, `deleted_at` |
| `audit_logs`   | actor, action, entity, entity_id, before, after (append-only)                |

- **BMI**: `US = 703·lb/in²`, `METRIC = kg/m²` (height entered in cm). Computed server-side, stored to 2dp, **recomputed on every update**, displayed to 1dp. WHO bands: `<18.5` under · `<25` normal · `<30` over · `≥30` obese; `null` under age 18 (no pediatric curves).
- **Soft-delete only**: nothing is ever hard-deleted. A **partial unique index** (`profiles.email WHERE deleted_at IS NULL`) enforces one active email while still allowing a deleted email to be re-registered.

### Endpoints

| method   | path                    | notes                                                                                                  |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/participants`     | creates user+profile+participant in one tx; duplicate email → `409`                                    |
| `GET`    | `/api/participants`     | filter (`search`, `unit`, `minBmi`/`maxBmi`, `minAge`/`maxAge`), `sortBy`/`sortDir`, `page`/`pageSize` |
| `GET`    | `/api/participants/:id` | `404` if missing/deleted                                                                               |
| `PUT`    | `/api/participants/:id` | partial update; recomputes BMI on a measurement change                                                 |
| `DELETE` | `/api/participants/:id` | soft-delete (`204`)                                                                                    |
| `GET`    | `/api/health`           | liveness                                                                                               |

Every error returns one envelope: `{ statusCode, code, message, details?, timestamp, path }`, with a stable machine `code`.

---

## Testing

```bash
npm run db:up      # the api tests include repository integration tests (real Postgres)
npm run verify     # typecheck + lint + test (all projects)
npm run test       # tests only
npm run e2e        # API HTTP e2e (needs: db up + `npm run dev:api` running)
```

Coverage is collected on every `nx test` and enforced via `coverageThreshold`, so a drop below the bar fails the build (and the pre-commit). The table below is the **enforced gate**, not the latest measured coverage:

| project   | statements | branches | functions | lines |
| --------- | ---------- | -------- | --------- | ----- |
| contracts | 95%        | 90%      | 90%       | 95%   |
| api       | 92%        | 70%\*    | 92%       | 94%   |
| web       | 93%        | 85%      | 88%       | 94%   |

\* The api **global** branch gate is 70% because Nest/Swagger method decorators generate branch points that can't be meaningfully exercised; the service additionally carries its own per-path threshold of 100% statements/functions/lines and 80% branches.

- **contracts** - BMI formulas (checked against the brief's own examples), bands, conversions, bounds.
- **api** - service domain logic, exception filter, controller, DTO validation, audit; plus **repository + Prisma integration tests against the real Postgres** (they `TRUNCATE` between tests and refuse to run against a non-local host, so point them at a local throwaway DB. The host guard does not detect local tunnels or distinguish a disposable database from other local databases).
- **web** - form model, API client, and the React components (form, table, filters) via Testing Library, plus the page orchestration.
- **api-e2e** - full HTTP path against a running server: create → duplicate 409 → validation 400 → update recompute → search → soft-delete 404.

A **Husky pre-commit** hook formats staged files and runs `nx affected -t typecheck lint test` (so the coverage gate runs on every commit; the DB must be up).

---

## Key decisions & alternatives considered

**Where is input validated?** In two layers, on purpose. _Structural_ validation (types, format, presence, generic ranges) happens at the DTO boundary with **class-validator** + a global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` strip/reject unknown fields - defence against over-posting). _Domain_ rules that class-validator can't express cleanly (per-unit plausibility bounds, a cross-field rule) live in the service and reuse the shared `measurementErrors()` so the web and API agree.

**How is user input handled safely?** Prisma parameterises every query (no string-built SQL). DTO whitelisting drops unexpected fields. Request logs record only the id, method and path - never the query string (which can carry PII like `?search=<email>`) and never request headers; sensitive headers are additionally redacted as defence in depth. Ids are validated as UUIDs (`ParseUUIDPipe`).

**Error handling.** A single `AppException` base carries a stable `code` + HTTP status; a global filter converts everything (domain errors, Nest `HttpException`, unknown bugs) into one envelope. 4xx carry a safe, client-caused message; every 5xx (including a thrown `HttpException`) is flattened to a generic message with no `details`, so an internal or PII-bearing message is never echoed to the client. The full error is logged server-side only. `@Throws(...)` on controllers declares expected errors and feeds OpenAPI, so the docs can't drift from the code.

**Transport hardening.** `helmet` sets the standard security headers (CSP is left off because the only HTML served is the dev Swagger UI; a browser-facing app would ship a real policy). CORS is an explicit origin allow-list (`WEB_ORIGIN`), not a wildcard. The Swagger UI is served outside production only, so a deployed instance does not publish its full API surface.

**BMI as stored vs computed.** Stored (and recomputed on every write) from server-side inputs, so the table/export never recomputes and the value can't drift from weight/height. Classification is done on the raw value; rounding is display-only.

**Pagination.** Offset pagination - simple, addressable pages with a total count, which is what a human-browsed table wants. Keyset pagination would scale better and is the natural next step if the dataset grows large.

**Soft-delete.** Enforced per-query with an explicit `deleted_at IS NULL` filter (clear and greppable). A global Prisma Client Extension would centralise it further; it was left out to keep the data access obvious to read.

**Auditability.** An app-level, append-only `audit_logs` written in the **same transaction** as each mutation (actor + before/after). It intentionally keeps real values (PII) and is exempt from log redaction and soft-delete. DB-trigger history would be tamper-proof against raw SQL - a good hardening step.

**Why `age` as an integer?** It matches the given schema. Date-of-birth (deriving age at read) is the clinically correct choice and would be the first schema change I'd propose.

### Deliberately out of scope (and how I'd add them)

Auth/authorization (the `actor` comes from an `x-actor-id` header, defaulting to `anonymous`); consent capture and subject/study IDs; PII/measurement separation for de-identified export; optimistic-concurrency `version` columns; OpenTelemetry tracing; keyset pagination. Each is a small, well-understood addition on top of the current layering.

### Measurement precision and BMI filters

Weight and total height accept at most two decimal places, matching their database precision. Excess precision is rejected in both API writes and form validation, rather than silently changing measurements on save. Classification uses the unrounded BMI derived from these measurements; `bmiValue` remains rounded to two decimals for storage and numeric filtering (the UI displays one decimal). Thus `minBmi=25` can include a NORMAL record whose raw BMI is 24.9965 but stored value is 25.00. This is a numeric filter, not a category filter. Existing records written before this precision rule may need reconciliation if their stored BMI was calculated from higher-precision inputs.

### Canonical email migration

Email is trimmed and lowercased before API and form validation. Apply migrations when deploying this policy: the partial unique index now compares `lower(btrim(email))`, and existing emails are normalized. If active legacy rows collide under this policy, the migration rolls back; reconcile their identities before retrying, without silently merging participants. Soft-deleted emails remain reusable. Numeric sort ties use ascending participant id in both directions; offset pages are deterministic for an unchanged dataset, not a snapshot across concurrent writes.

Prisma query diagnostics are enabled outside production at `LOG_LEVEL=debug`: they log the parameterized SQL template (Postgres prepared statements carry `$1` placeholders, never values) with its duration, so slow queries are actually identifiable. Parameters, engine warn/error messages and rejected rows are never logged - they can contain PII or audit snapshots - and two fail-closed defences keep it that way: quoted string literals in a template are redacted before logging, and a template that does not start with a known SQL keyword degrades to an allow-listed operation name. Production emits no query events, even with debug logging enabled; warn/error events retain their severity with a generic message.
