# CLAUDE.md (frontend-teacher)

Washington Prep Office Hours: students book a spot in an office hour with teachers; teachers set their schedule, days off and
answer requests. Frontend only. A separate team owns the FastAPI backend. Do not write backend code here.

## Stack
React + TypeScript (strict), Tailwind v4, React Router, Vite, Vitest, Playwright. No other UI libraries.

## Commands (run in `frontend-teacher/`)
- `npm install`, `npm run dev`
- `npm run build` (type-checks too), `npx vitest run`, `npm run e2e`, `npm run lint`

## Layout
```
src/
  pages/teacher|student|auth/   screens (auth: role chooser and the two sign-in pages)
  auth/                         sign-in: AuthProvider, RequireRole, token store, login API (real + mock), messages
  components/common/            shared UI: AppShell, SideNav, Calendar, Modal, Button, Card, fields, themes card
  components/teacher|student/   role-specific pieces and layouts
  hooks/                        TeacherData / StudentData providers, useAuth (re-export), useAction, useSidebar
  api/                          client.ts, teacher.ts, student.ts, mocks/ (store, seed, actions, identity)
  lib/                          rules.ts (domain rules), calendar.ts, dates.ts, text.ts, theme.ts
  types/index.ts                the one source of types
e2e/                            Playwright tests
```

## Rules for code
- Functional components, Tailwind only. No custom CSS beyond `src/index.css`.
- **Colors come from CSS variables in `src/index.css` only.** No hex values, no `white/NN` overlays, no `text-white`.
  Only the school colors (navy, torch orange, shield mint) plus white and neutral greys. Orange is accent-only and text
  on it is navy. Status colors (open = theme tint, full / day off = pale orange, past = grey) never change per theme.
  `src/lib/contrast.test.ts` must pass for any color change.
- All data goes through `src/api/`. Pages never call `fetch` or touch localStorage. Mock mode must keep working.
- Booking rules live in `src/lib/rules.ts` as pure functions with tests. The UI only shows and pre-validates them;
  the backend is the source of truth.
- The sidebar is a fixed panel (brand header and footer never scroll; only the nav does). Keep `e2e/sidebar.spec.ts` green.
- Every new endpoint goes into `docs/api-contract.md`.

## Shared files (need a PR note and a teammate review)
`src/components/common/`, `src/api/client.ts`, `src/auth/`, `src/hooks/useAuth.ts`, `src/types/`, `src/lib/`,
`src/routes/`, `src/index.css`, `docs/api-contract.md`.

## Git
Never commit to `main`. Branch names `feature/<area>-<short-name>`. Small PRs, pull before pushing, one teammate reviews.

## Do not
Change the stack, add dependencies without saying so in the PR, commit `.env` files, edit another team's folders (backend,
real login), build the Alma integration, or write backend code.

## Status
- [x] Teacher: Dashboard, Calendar, Office hours, Days off, Booking requests, Settings
- [x] Student: Home, My calendar, Find a teacher, Book a spot (no seat numbers), My bookings, Settings
- [x] Themes (3 palettes, light / dark / system), fixed sidebar
- [ ] Put the school crest at `public/school-logo.png`
- [x] `docs/api-contract.md` matches the current endpoints; `docs/backend-connection-report.md` lists what the backend still has to build
- [x] Works against the real API (`VITE_USE_MOCKS=false`): every page checked live as two students and two teachers
- [x] Sign-in: role chooser, `/student/login`, `/teacher/login`, token + `GET /auth/me` restore, route guards, 401 handling (mock accounts in mock mode)
- [x] Backend endpoints check the token, so the signed-in person's own data comes back (`401` / `403` handled)
- [ ] Refresh token, server-side logout, login rate limit: see "Authentication gaps" in `docs/api-contract.md`
- [x] `vercel.json` (page refreshes on Vercel) and CI in `.github/workflows/ci.yml`
