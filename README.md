# Office Hours Project

Members:
- Kai
- Aryamn
- Lucas Swimming
- Maya
- Austin soccer 
- Samuel Basketball 
- Ryan Walking

## About

An Office Hours Booking System for a school. Students book office-hour slots with teachers on a
calendar, give a short reason, and get email reminders. Roles: Student, Teacher, Admin.

This repo currently holds the **frontend** only. Our subgroup (Lucas, Austin, Ryan) builds the
**Teacher desktop UI**. The backend and the Student/Admin UIs belong to other teams. Until the
backend exists, the app runs on mock data.

## Prerequisites

- Git and GitHub Desktop
- VS Code
- Node.js (LTS or newer) with npm

## Setup and run

```bash
cd frontend
npm install
cp .env.example .env.local     # VITE_USE_MOCKS=true works without a backend
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) and go to `/teacher`.

Other commands (from `frontend/`): `npm run build`, `npm run lint`, `npx tsc -b` (type-check).

## Working with Git

New to Git? Read [docs/git-workflow.md](docs/git-workflow.md) before your first branch.
Never commit to `main`.

## More

- Project rules and ownership: [CLAUDE.md](CLAUDE.md)
- Planned API shapes: [docs/api-contract.md](docs/api-contract.md)
- Stretch goal (not built): Alma integration