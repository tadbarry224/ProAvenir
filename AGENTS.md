# ProAvenir

Job platform (candidates, companies, administration) made of two separate applications. Each one is its own npm project, with its own `package.json`, `package-lock.json`, `node_modules`, `.env` and tooling. Install, start, test and build them independently.

| Folder      | Application                                       | Port            | Detailed guide                                   |
| ----------- | ------------------------------------------------- | --------------- | ------------------------------------------------ |
| `frontend/` | React 19 + Vite 8 + TypeScript + Tailwind CSS v4  | 8443            | `frontend/AGENTS.md` (read before editing there) |
| `backend/`  | NestJS + Prisma + PostgreSQL 17 (Docker) REST API | 3001 (DB: 5434) | `backend/AGENTS.md` (read before editing there)  |

## Repository root

- `package.json` - Command shortcuts only, no dependencies: `dev` (frontend), `dev:api`, `db:up`, `build`, `check` (= `check:front` + `check:api`), `install:all`. They call `npm --prefix frontend|backend run …`.
- `README.md` - Setup from scratch, environment variables, database, servers, checks, troubleshooting (French)
- `.figma/` - Figma Make tooling, kept at the root on purpose (Figma expects it there). `frontend/vite.config.ts` reads `.figma/make/site.json`. Its scripts still call `pnpm` at the root; the project itself uses npm (see README, "Figma Make").
- `.mise.toml` - Toolchain version (Node.js 24). The project uses **npm** (no pnpm); `engines` in every `package.json` requires Node ^24.15 and npm >=11
- `.gitattributes` (LF line endings), `.gitignore` (applies to both applications)
- `.vscode/` - Shared editor settings (LF, TypeScript from `frontend/node_modules`, Tailwind CSS) and recommended extensions

## Rules

- Never import code across the two applications: they only talk over HTTP (`VITE_API_URL` → `/api`, CORS allowed by `CORS_ORIGIN` in `backend/.env`).
- Frontend variables (`frontend/.env`, `VITE_*` only) end up in the browser: never put secrets there. Secrets live only in `backend/.env`. Both `.env` files are git-ignored; document variables in each `.env.example`.
- Keep the ports: frontend 8443, API 3001, PostgreSQL 5434.
- Before a commit, run `npm run check` at the root (PostgreSQL must be running for the backend e2e tests).
