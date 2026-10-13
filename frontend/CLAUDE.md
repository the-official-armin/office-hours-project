# frontend/CLAUDE.md

Vite + React + TypeScript (strict) + Tailwind + React Router. See the root CLAUDE.md for team rules.

## Run
- `npm install`, then `npm run dev` (copy `.env.example` to `.env.local` first)
- `npm run build` (type-check + build), `npm run lint`

## Folder rules
- `pages/teacher/`, `components/teacher/`, `api/teacher.ts`, `api/mocks/teacher.ts`: ours (Subgroup B).
- `pages/student|admin|auth/`: other teams. Do not edit.
- Shared (PR note + teammate review): `components/common/`, `api/client.ts`, `types/`, `routes/`.

## Rules
- Teacher UI is desktop only (min width 1024px). No responsive/mobile breakpoints.
- Tailwind only. Functional components. Reusable pieces go in `components/teacher/` or `components/common/`.
- Backend calls only via `src/api/`; return mocks when `USE_MOCKS` is true (`VITE_USE_MOCKS`, default true).
- UI pre-validates booking rules for display only. The backend enforces them.
- Every page/component starts with a header comment: purpose and owner.
