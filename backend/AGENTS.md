# ProAvenir backend (NestJS)

REST API for ProAvenir. Read `README.md` for setup. The frontend lives at the repository root (see `../AGENTS.md`).

## Stack

- NestJS 12 (ESM only, like this project): relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), tests run on Vitest (`vi.fn()`, not `jest.fn()`).
- PostgreSQL 17 in Docker (`docker-compose.yml`, port `127.0.0.1:5434`). Other projects on this machine use 5432/5433 and port 3000: never touch their containers.
- Prisma ORM 7.10 (stable; do not upgrade to 8.x pre-releases):
  - `prisma.config.ts` holds the datasource URL and loads `.env` via `dotenv/config`.
  - The client is generated into `src/generated/prisma` (git-ignored) and imported from `../generated/prisma/client.js`.
  - `PrismaService` uses the `PrismaPg` driver adapter (mandatory in Prisma 7).
- NestJS docs index: https://docs.nestjs.com/llms.txt (the installed version may be newer than your knowledge).

## Structure

- `src/main.ts` - starts the server; `src/app.setup.ts` - shared HTTP setup (`/api` prefix, CORS, shutdown hooks) used by `main.ts` and e2e tests
- `src/app.module.ts` - root module (ConfigModule with `validateEnv`, PrismaModule, feature modules)
- `src/config/env.validation.ts` - validates `.env` at startup
- `src/prisma/` - global `PrismaService`
- `src/health/` - `GET /api/health` (200 when PostgreSQL answers, 503 otherwise, no technical details in the response)
- `src/auth/` - authentication (B3): `auth.controller.ts` (`/api/auth/register|login|refresh|logout|me`), `auth.service.ts` (argon2id, refresh-token rotation with reuse detection, 30 s grace for concurrent tabs), `auth.guards.ts` (global `JwtAuthGuard` + `RolesGuard`, `CsrfGuard` on cookie routes), `auth.decorators.ts` (`@Public()`, `@Roles()`, `@CurrentUser()`), `password.ts` (shared with `prisma/set-password.ts`), `refresh-cookie.ts`
- `src/common/api-error.ts` - error body format `{ statusCode, error, code, message, details? }`: `apiError(status, code, message, details?)` for business errors (stable codes, see `OFFER_ERROR_CODES` in `company-offers/offer-rules.ts` and the table in README) and `validationException` (global ValidationPipe `exceptionFactory`, code `VALIDATION_FAILED`, `message` unchanged). `validationPipeOptions` is exported from `app.setup.ts` for DTO unit tests.
- `src/common/clock.service.ts` - today's date in Africa/Conakry (override it in tests); `src/common/dates.ts` - `toIsoDate` for DATE columns
- `src/reference/`, `src/offers/` - public `GET /api/cities|domains|offers`
- `src/company-offers/` - company space (B4), role `COMPANY`: `GET|POST /api/companies/me/offers`, `PATCH /api/companies/me/offers/:id/status` (DRAFT→PUBLISHED, PUBLISHED→CLOSED, CLOSED→PUBLISHED; other transitions 409; offer of another company 404). `CompanyMembershipService.currentCompany(userId)` is the ONLY source of the company id (from `CompanyMember`, never from the URL or body; 403 if none). `companyOfferSelect` lists the returned columns; `isPubliclyVisible` mirrors `publicOffersWhere`. Company status rules: `APPROVED` drafts + publish, `PENDING` drafts only, `REJECTED` read-only — pure functions in `offer-rules.ts` (`creationRefusal`, `statusChangeRefusal`, `statusChangeDates`, `contractErrors`, `publicationErrors`, same limits/messages as the frontend `validateOffer`). Writes run in a transaction using `lockCurrentCompany` (`SELECT … FOR SHARE` on the company row) so a concurrent status change cannot be bypassed; status changes also lock the offer row (`FOR UPDATE`). Always lock company first, then offer.
- `prisma/schema.prisma` - data model (User, CandidateProfile, Company, CompanyMember, City, Domain, Offer, Application, RefreshToken). Extra CHECK constraints live in the migration SQL (Prisma ignores them, keep them when editing).
- `prisma/migrations/` - versioned SQL; never edit an applied migration. Create new ones with `prisma migrate dev --create-only`, review, then `npm run db:migrate`.
- `prisma/seed.ts` + `seed-data.ts` - idempotent demo data (fixed UUIDs, upserts, no deletes, no passwords: `passwordHash` is null). Run `npm run db:seed`.
- Public offer rule: `status = PUBLISHED AND deadline >= today` (drafts and closed/expired offers are never public). Publishing also requires the company to be `APPROVED` (enforced in services, B4).

## Rules

- Never commit secrets: `.env` is git-ignored; document every variable in `.env.example`.
- All authorization is enforced server-side (roles + ownership checks), never trust the frontend.
- Routes are **closed by default**: the global `JwtAuthGuard` requires a valid access token unless the controller or handler has `@Public()`. Use `@Roles(...)` for role checks and verify resource ownership in services (e.g. a company only edits its own offers).
- Never return `passwordHash`, token hashes or internal data: use explicit Prisma `select`s.
- e2e tests that create data use dedicated prefixes (`e2e-auth-…@proavenir.test`, `[e2e-auth]`, `e2e-b4-…`, `[e2e-b4]`, test UUIDs `9…`: `90000000-…` public API, `94000000-…` company offers, `94000000-…01xx` + `e2e-b42-` offer creation, `94000000-…02xx` + `e2e-b43-` status changes) and delete only those rows; reset the throttler storage between tests (see `test/auth.e2e-spec.ts`).
- Never run destructive database commands (`prisma migrate reset`, `db push --force-reset`, `docker compose down -v`) without explicit user approval.
- Before finishing a change: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e` (needs the database running), `npm run build`.
