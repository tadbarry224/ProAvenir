# ProAvenir frontend

React + Vite + TypeScript + Tailwind CSS application, in the `frontend/` folder (a separate npm project). Paths below are relative to `frontend/`. The repository overview is in `../AGENTS.md`; the API is in `../backend/` (see `../backend/AGENTS.md`).

## Development Server

Start it with `npm run dev` in `frontend/` (or `npm run dev` at the repository root). It listens on `$PORT` (default 8443, `strictPort`).

- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Root component: `BrowserRouter` (React Router 8, declarative mode) + `AuthProvider`, `<Routes>` for every page, shared state (offers via `useOffers`, applications). `go(page)` navigates to `PAGE_PATHS[page]`; `selectJob` opens `/offres/:id`; protected spaces redirect to `/connexion` with `state.from`, and after login (`AuthPage` `onAuthenticated`) the user returns to `from` (internal paths only), otherwise to `ROLE_HOME`. Unknown paths redirect to `/`
- `src/pages/JobDetailsPage.tsx` - Route `/offres/:id`: loads the offer with `usePublicOffer(id)` (`GET /api/offers/:id`, 404/400 → `notFound`), shows the clicked offer (`preview`) while loading, then `JobDetails`; « Offre introuvable » or « Réessayer » states
- `src/pages/` - One file per screen: `Home`, `JobsPage`, `JobDetails` (real offer content only; applying requires a CANDIDATE session via `viewerRole`, visitors get « Se connecter pour postuler », companies/admins a notice; the application itself stays a demo until B5), `AuthPage`, plus `candidate/`, `company/` and `admin/` dashboards
- `src/components/` - Reusable UI without business logic: `layout/` (Logo, Header, Footer, DashboardLayout, DashboardTop), `ui/` (StatCard, CardHeading, FieldError), `jobs/` (JobLogo, JobCard, MiniJob)
- `src/features/offers/` - Offer business logic: validation (`validateOffer`), rules (`offerRules`), display mapping (`toJobView`, `publicOfferToJob`), public data hooks (`usePublicOffers`, `useReferenceLists`: API), company space hook (`useOffers`: real offers of the session's company via `companyOffersService`, `companyStatus` + `rejectionReason` re-read from `meta.company` on every opening (CompanyDashboard uses them for the sidebar/header status label instead of the possibly stale session, plus a PENDING or REJECTED banner with the reason), per-user state so switching accounts never shows another company's offers, silent reload after each change + `onChanged` to refresh the public list, `pending` to block double submits, city/domain options = API references kept in the current order/labels), `PublishModal`, `companyOfferMapping` (API ↔ `Offer`: `companyOfferFromApi` keeps display labels and throws `UnexpectedApiDataError` on unknown values; `toCreateOfferPayload` turns form labels into API ids using `/api/cities|domains`; `offerErrorFromApi` maps 400/401/403/404/409 + stable codes to `{ kind, code, message, fieldErrors }`)
- `src/features/admin/` - Administration: `useAdminCompanies` (real companies via `adminCompaniesService`, per-user state, `pending` blocks double decisions, immediate update from the PATCH response then silent reload, reload on 409/404 « stale » errors, `onSessionExpired`), `adminCompanyView` (`toAdminCompanyView`: API → display, « Secteur non renseigné » instead of invented values; `adminErrorFromApi`: 401 session, 403, 409/404 stale, 400 validation)
- `src/features/candidate/` - Candidate profile + CV (B6): `useCandidateProfile` (loaded as soon as a CANDIDATE is logged in; `save` validates then PATCHes and calls `onNameChanged` → App runs `auth.renewAccessToken()` so the new name shows everywhere; `uploadCv` checks type/size first; `deleteCv`; `downloadCv` via `lib/saveFile`), `candidateProfileForm` (pure: API ↔ form, `parseSkills`, `validateProfileForm`, `cvFileProblem`, `formatFileSize`). The application modal shows the CV that will be attached (`cvFileName`).
- `src/features/applications/` - Real applications (B5, CV download for the company in B6): `useApplications.ts` (`useCandidateApplications`: loaded as soon as a CANDIDATE is logged in, `hasApplied(offerId)`, `apply`; `useReceivedApplications`: company space, `changeStatus`; shared per-user loader, one action at a time, immediate update then silent reload, reload on « stale » 409/404), `applicationView` (API → display, `applicationErrorFromApi`), `ApplicationTable` (candidate), `RecruitTable` (company: only the next allowed statuses, final statuses without menu, `readOnly` for a REJECTED company), `applicationStatusStyle`
- `src/features/auth/` - Session state: `AuthProvider` (restores the session from the httpOnly cookie on load, keeps the access token in memory only, renews it before expiry and on demand with `renewAccessToken`), `useAuth()` in `authContext.ts` (also an `AccessTokenSource` for protected services), `demoAccounts` (dev-only email prefill, no passwords)
- `src/types/` - Shared TypeScript types (`offer`, `application`, `admin`, `navigation`: `Page`, `PAGE_PATHS` French URLs, `jobPath(id)`, `pageFromPath`). `Offer.id` is a `string` (API UUID); `closedAt`, `applicationsCount`, `publiclyVisible` come from the API
- `src/services/` - HTTP calls to the NestJS API: `apiClient` (base URL from `VITE_API_URL`, French `ApiError` messages with `status`, stable `code` and `details` per field, timeout; `responseType: "blob"` for files, FormData bodies sent without JSON headers, `authorizedRequest(session, …)` adds `Authorization: Bearer`, renews the session once on 401, never stores tokens), `companyOffersService` (`fetchCompanyOffers`, `createCompanyOffer`, `changeCompanyOfferStatus`, `OFFER_ERROR_CODES`; takes `useAuth()` as session), `offersService`, `referenceService` (cities, domains), `adminCompaniesService` (`fetchAdminCompanies`, `reviewCompany`, `ADMIN_COMPANY_ERROR_CODES`, `REJECTION_REASON`), `candidateProfileService` (profile, `uploadMyCv` with FormData, `downloadMyCv` Blob, `CV_MAX_BYTES`), `applicationsService` (`downloadApplicationCv`, `fetchMyApplications`, `applyToOffer`, `fetchReceivedApplications`, `changeApplicationStatus`, `APPLICATION_ERROR_CODES`), `authService` (login/register/refresh/logout/me with `credentials: "include"` and the `X-ProAvenir-CSRF` header). Depends only on `types`.
- `src/lib/` - Generic helpers (`dates`, `useApiData` loading/error/success hook, `saveFile` = offer a downloaded Blob to the user)
- `.env.example` - Frontend configuration template; copy to `.env` (git-ignored) with `VITE_API_URL=http://localhost:3001/api`
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, test, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`; reads `../.figma/make/site.json` (the `.figma/` folder stays at the repository root)
- `vitest.config.ts` - Test configuration (kept separate from the Figma Make plugins)
- `scripts/vitest.mjs` - Vitest launcher (Windows drive-letter workaround, see Testing)
- `.prettierignore` - Files skipped by oxfmt (`src/__snapshots__/`)

### Conventions

- Dependency direction: `types` / `lib` ← `components` ← `features` ← `pages` ← `App`. Never import `App` or `pages` from lower layers (avoids circular imports).
- Named exports. A `.tsx` file exports only components; constants go in `.ts` files (required by React Fast Refresh).
- Imports without file extensions.

## Testing

- `npm run check` (in `frontend/`) runs every frontend check before a commit: oxfmt, `tsc --noUnusedLocals`, tests, build. At the repository root, `npm run check` runs the frontend then the backend checks.

- `npm test` runs Vitest once; `npm run test:watch` re-runs on save. Both go through `scripts/vitest.mjs`, which works around a Windows issue (lowercase drive letter `c:\` makes Vitest load twice).
- `src/App.render.test.tsx` compares each screen with the HTML snapshots in `src/__snapshots__/pages/`. Any rendering change fails the test; update snapshots with `npm test -- -u` only for intended design changes, then review `git diff`.
- `src/App.flows.test.tsx` covers user journeys (search, apply, publish, drafts, closing, navigation, admin). Pure logic is tested next to its file (`*.test.ts`).
- Routing: `setupAppTest()` resets the URL to `/` before each test; to open the app at a given address (shared link, F5) call `window.history.replaceState(null, "", url)` before `renderApp()`, and reset it inside loops that render several times. Assert addresses with `window.location.pathname`.
- UI tests import only `App` and navigate like a user, so moving components does not require changing tests.
- Protected spaces (`candidate`, `company`, `admin`) require a session with the matching role (`PROTECTED_PAGES` in `src/types/auth.ts`); otherwise `App` redirects to login or to the user's own space. In tests use `renderApp({ as: "COMPANY" })` (session already open) or `loginWithForm(role)` (real form). The fake API checks the CSRF header and `credentials: "include"`; its demo accounts use `TEST_PASSWORD`.
- UI tests never call the real backend: `setupAppTest()` replaces `fetch` with `src/test/fakeApi.ts`, which serves real API responses captured in `src/test/fixtures/` and applies the same filters. It also implements `/companies/me/offers` with the backend rules (Bearer token, role, company status via `installFakeApi({ companyStatus })`, transitions, error codes), one list per company starting from `api-company-offers.json` (Kamsar demo, captured from the real API), and keeps the public list in sync. It also implements `/admin/companies` (ADMIN token, same validation, 409 and error codes) from `api-admin-companies.json`, which is BUILT FROM `backend/prisma/seed-data.ts` (never captured from the dev database, which holds real accounts); `api.adminCompanies()` exposes the current rows. Applications: `/candidates/me/applications` and `/companies/me/applications` with the backend rules, starting from the seed applications (Mariama: 3, incl. « Développeur·se web junior »; Abdoulaye: 1 on Kamsar's offer) — use « Stagiaire comptable » to test applying; `api.applications()` exposes the rows. Profile/CV: `/candidates/me/profile|cv` and `/companies/me/applications/:id/cv` (checks `%PDF-`, 5 MB, keeps files attached to applications), `api.profile(email)`, `api.storedCvCount()`; each fake API copies the demo accounts (a renamed user does not leak into the next test). `setupAppTest()` stubs `URL.createObjectURL` and anchor clicks: downloaded files land in `savedFiles`; `pdfFile(name, text)` builds a fake PDF. No screen shows invented data anymore (profiles: only the session name, « not saved yet » notice until B6). Helpers: `api.calls` (method, path, body, Authorization), `api.failNext(method, path, status | "network" | { status, body })`, `api.revokeSession()`, `api.companyOffers(companyId)`. `renderApp()` and `goTo()` are async and wait for requests (`settle()`). `installFakeApi({ down: true })` or `{ offersStatus: 500 }` simulates failures. Recapture the fixtures with `curl` if the seed or the API response shape changes.

## Dependencies

- Runtime: React 19, React DOM 19 and React Router 8 (`react-router`, declarative `BrowserRouter`/`Routes`)
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Testing: Vitest, jsdom, Testing Library
- Formatting: oxfmt (`src/__snapshots__/` is excluded via `.prettierignore`)

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

Tailwind emits utility classes in `@layer utilities`, and CSS outside any cascade layer overrides every layer regardless of specificity. Put global element styles, such as resets and defaults for `body`, headings, `button`, or `input`, inside `@layer base { ... }` so utility classes on those elements still apply. Tailwind's Preflight already applies `box-sizing: border-box`, removes default margins, and sets `font: inherit` on form controls, so do not repeat those rules.
