# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Root component only: current page (`page` state, no router yet), shared state (offers via `useOffers`, applications) and page selection
- `src/pages/` - One file per screen: `Home`, `JobsPage`, `JobDetails`, `AuthPage`, plus `candidate/`, `company/` and `admin/` dashboards
- `src/components/` - Reusable UI without business logic: `layout/` (Logo, Header, Footer, DashboardLayout, DashboardTop), `ui/` (StatCard, CardHeading, FieldError), `jobs/` (JobLogo, JobCard, MiniJob)
- `src/features/offers/` - Offer business logic: validation (`validateOffer`), rules (`offerRules`), display mapping (`toJobView`, `publicOfferToJob`), public data hooks (`usePublicOffers`, `useReferenceLists`: API), company state hook (`useOffers`: local mock data until step B4), `PublishModal`
- `src/features/applications/` - Application tables and status styles
- `src/types/` - Shared TypeScript types (`offer`, `application`, `admin`, `navigation`)
- `src/services/` - HTTP calls to the NestJS API: `apiClient` (base URL from `VITE_API_URL`, French `ApiError` messages, timeout), `offersService`, `referenceService` (cities, domains). Depends only on `types`.
- `src/data/` - Mock data, still used by the company, candidate and admin dashboards (to be replaced by the NestJS API)
- `src/lib/` - Generic helpers (`dates`, `useApiData` loading/error/success hook)
- `.env.example` - Frontend configuration template; copy to `.env` (git-ignored) with `VITE_API_URL=http://localhost:3001/api`
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, test, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `vitest.config.ts` - Test configuration (kept separate from the Figma Make plugins)
- `.mise.toml` - Toolchain versions for Node.js and pnpm (the project itself uses **npm** and `package-lock.json`)
- `backend/` - NestJS + Prisma + PostgreSQL API, a separate npm project with its own tooling; see `backend/AGENTS.md` and `backend/README.md`. Excluded from Tailwind scanning (`@source not` in `src/index.css`) and from the root formatter (`.prettierignore`).

### Conventions

- Dependency direction: `types` / `lib` / `data` ← `components` ← `features` ← `pages` ← `App`. Never import `App` or `pages` from lower layers (avoids circular imports).
- Named exports. A `.tsx` file exports only components; constants go in `.ts` files (required by React Fast Refresh).
- Imports without file extensions.

## Testing

- `npm test` runs Vitest once; `npm run test:watch` re-runs on save. Both go through `scripts/vitest.mjs`, which works around a Windows issue (lowercase drive letter `c:\` makes Vitest load twice).
- `src/App.render.test.tsx` compares each screen with the HTML snapshots in `src/__snapshots__/pages/`. Any rendering change fails the test; update snapshots with `npm test -- -u` only for intended design changes, then review `git diff`.
- `src/App.flows.test.tsx` covers user journeys (search, apply, publish, drafts, closing, navigation, admin). Pure logic is tested next to its file (`*.test.ts`).
- UI tests import only `App` and navigate like a user, so moving components does not require changing tests.
- UI tests never call the real backend: `setupAppTest()` replaces `fetch` with `src/test/fakeApi.ts`, which serves real API responses captured in `src/test/fixtures/` and applies the same filters. `renderApp()` and `goTo()` are async and wait for requests (`settle()`). `installFakeApi({ down: true })` or `{ offersStatus: 500 }` simulates failures. Recapture the fixtures with `curl` if the seed or the API response shape changes.

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
