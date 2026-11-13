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
- `prisma/schema.prisma` - data model; migrations go in `prisma/migrations/`

## Rules

- Never commit secrets: `.env` is git-ignored; document every variable in `.env.example`.
- All authorization is enforced server-side (roles + ownership checks), never trust the frontend.
- Never run destructive database commands (`prisma migrate reset`, `db push --force-reset`, `docker compose down -v`) without explicit user approval.
- Before finishing a change: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e` (needs the database running), `npm run build`.
