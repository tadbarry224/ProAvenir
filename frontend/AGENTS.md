# ProAvenir frontend

React + Vite + TypeScript + Tailwind CSS application, in the `frontend/` folder (a separate npm project). Paths below are relative to `frontend/`. The repository overview is in `../AGENTS.md`; the API is in `../backend/` (see `../backend/AGENTS.md`).

## Development Server

Start it with `npm run dev` in `frontend/` (or `npm run dev` at the repository root). It listens on `$PORT` (default 8443, `strictPort`).

- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Root component only: current page (`page` state, no router yet), shared state (offers via `useOffers`, applications) and page selection
- `src/pages/` - One file per screen: `Home`, `JobsPage`, `JobDetails` (real offer content only; applying requires a CANDIDATE session via `viewerRole`, visitors get « Se connecter pour postuler », companies/admins a notice; the application itself stays a demo until B5), `AuthPage`, plus `candidate/`, `company/` and `admin/` dashboards
- `src/components/` - Reusable UI without business logic: `layout/` (Logo, Header, Footer, DashboardLayout, DashboardTop), `ui/` (StatCard, CardHeading, FieldError), `jobs/` (JobLogo, JobCard, MiniJob)
- `src/features/offers/` - Offer business logic: validation (`validateOffer`), rules (`offerRules`), display mapping (`toJobView`, `publicOfferToJob`), public data hooks (`usePublicOffers`, `useReferenceLists`: API), company space hook (`useOffers`: real offers of the session's company via `companyOffersService`, per-user state so switching accounts never shows another company's offers, silent reload after each change + `onChanged` to refresh the public list, `pending` to block double submits, city/domain options = API references kept in the current order/labels), `PublishModal`, `companyOfferMapping` (API ↔ `Offer`: `companyOfferFromApi` keeps display labels and throws `UnexpectedApiDataError` on unknown values; `toCreateOfferPayload` turns form labels into API ids using `/api/cities|domains`; `offerErrorFromApi` maps 400/401/403/404/409 + stable codes to `{ kind, code, message, fieldErrors }`)
- `src/features/applications/` - Application tables and status styles
- `src/features/auth/` - Session state: `AuthProvider` (restores the session from the httpOnly cookie on load, keeps the access token in memory only, renews it before expiry and on demand with `renewAccessToken`), `useAuth()` in `authContext.ts` (also an `AccessTokenSource` for protected services), `demoAccounts` (dev-only email prefill, no passwords)
- `src/types/` - Shared TypeScript types (`offer`, `application`, `admin`, `navigation`). `Offer.id` is a `string` (API UUID); `closedAt`, `applicationsCount`, `publiclyVisible` come from the API
- `src/services/` - HTTP calls to the NestJS API: `apiClient` (base URL from `VITE_API_URL`, French `ApiError` messages with `status`, stable `code` and `details` per field, timeout; `authorizedRequest(session, …)` adds `Authorization: Bearer`, renews the session once on 401, never stores tokens), `companyOffersService` (`fetchCompanyOffers`, `createCompanyOffer`, `changeCompanyOfferStatus`, `OFFER_ERROR_CODES`; takes `useAuth()` as session), `offersService`, `referenceService` (cities, domains), `authService` (login/register/refresh/logout/me with `credentials: "include"` and the `X-ProAvenir-CSRF` header). Depends only on `types`.
- `src/data/` - Mock data still used by the candidate and admin dashboards and by the company APPLICATIONS tables (shown with a « Démonstration » notice until B5). Demo applications have a stable `id` (`DEMO_CANDIDATE_APPLICATION_ID` links the company table to the demo candidate space). Mock offers and companies were removed (B4.6): offers always come from the API
- `src/lib/` - Generic helpers (`dates`, `useApiData` loading/error/success hook)
- `.env.example` - Frontend configuration template; copy to `.env` (git-ignored) with `VITE_API_URL=http://localhost:3001/api`
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, test, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`; reads `../.figma/make/site.json` (the `.figma/` folder stays at the repository root)
- `vitest.config.ts` - Test configuration (kept separate from the Figma Make plugins)
- `scripts/vitest.mjs` - Vitest launcher (Windows drive-letter workaround, see Testing)
- `.prettierignore` - Files skipped by oxfmt (`src/__snapshots__/`)

### Conventions

- Dependency direction: `types` / `lib` / `data` ← `components` ← `features` ← `pages` ← `App`. Never import `App` or `pages` from lower layers (avoids circular imports).
- Named exports. A `.tsx` file exports only components; constants go in `.ts` files (required by React Fast Refresh).
- Imports without file extensions.

## Testing

- `npm run check` (in `frontend/`) runs every frontend check before a commit: oxfmt, `tsc --noUnusedLocals`, tests, build. At the repository root, `npm run check` runs the frontend then the backend checks.

- `npm test` runs Vitest once; `npm run test:watch` re-runs on save. Both go through `scripts/vitest.mjs`, which works around a Windows issue (lowercase drive letter `c:\` makes Vitest load twice).
- `src/App.render.test.tsx` compares each screen with the HTML snapshots in `src/__snapshots__/pages/`. Any rendering change fails the test; update snapshots with `npm test -- -u` only for intended design changes, then review `git diff`.
- `src/App.flows.test.tsx` covers user journeys (search, apply, publish, drafts, closing, navigation, admin). Pure logic is tested next to its file (`*.test.ts`).
- UI tests import only `App` and navigate like a user, so moving components does not require changing tests.
- Protected spaces (`candidate`, `company`, `admin`) require a session with the matching role (`PROTECTED_PAGES` in `src/types/auth.ts`); otherwise `App` redirects to login or to the user's own space. In tests use `renderApp({ as: "COMPANY" })` (session already open) or `loginWithForm(role)` (real form). The fake API checks the CSRF header and `credentials: "include"`; its demo accounts use `TEST_PASSWORD`.
- UI tests never call the real backend: `setupAppTest()` replaces `fetch` with `src/test/fakeApi.ts`, which serves real API responses captured in `src/test/fixtures/` and applies the same filters. It also implements `/companies/me/offers` with the backend rules (Bearer token, role, company status via `installFakeApi({ companyStatus })`, transitions, error codes), one list per company starting from `api-company-offers.json` (Kamsar demo, captured from the real API), and keeps the public list in sync. Helpers: `api.calls` (method, path, body, Authorization), `api.failNext(method, path, status | "network" | { status, body })`, `api.revokeSession()`, `api.companyOffers(companyId)`. `renderApp()` and `goTo()` are async and wait for requests (`settle()`). `installFakeApi({ down: true })` or `{ offersStatus: 500 }` simulates failures. Recapture the fixtures with `curl` if the seed or the API response shape changes.

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Testing: Vitest, jsdom, Testing Library
- Formatting: oxfmt (`src/__snapshots__/` is excluded via `.prettierignore`)

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

Tailwind emits utility classes in `@layer utilities`, and CSS outside any cascade layer overrides every layer regardless of specificity. Put global element styles, such as resets and defaults for `body`, headings, `button`, or `input`, inside `@layer base { ... }` so utility classes on those elements still apply. Tailwind's Preflight already applies `box-sizing: border-box`, removes default margins, and sets `font: inherit` on form controls, so do not repeat those rules.
