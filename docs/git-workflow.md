# Git Workflow for Beginners

Rules of the road: **never commit to `main`**, work on your own branch, keep PRs small, and have a
teammate review before merging.

## 1. Get the project (first time only)

```bash
git clone <repo-url>
cd office-hours-project
```

(In GitHub Desktop: File > Clone repository.)

## 2. Start your day: update `main`

```bash
git checkout main
git pull
```

## 3. Make a branch for your task

Name it `feature/teacher-<short-name>`:

```bash
git checkout -b feature/teacher-days-off
```

## 4. Work, then save your changes (commit)

```bash
git status                      # see what changed
git add frontend/src/pages/teacher/DaysOff.tsx
git commit -m "Add days off list placeholder"
```

Small, frequent commits are better than one huge one.

## 5. Pull before you push

Other people may have changed `main`. Bring those changes in first:

```bash
git pull origin main
git push -u origin feature/teacher-days-off
```

If Git reports a **merge conflict**, stop and ask a teammate for help instead of guessing.

## 6. Open a Pull Request (PR)

1. Go to the repo on GitHub. Click **Compare & pull request**.
2. Fill in the PR template (what changed, checklist, any new dependencies).
3. Ask one teammate to review.
4. After approval, merge on GitHub and delete the branch.

## 7. After the merge

```bash
git checkout main
git pull
git branch -d feature/teacher-days-off
```

## Shared files

If you change `components/common/`, `api/client.ts`, `types/`, `routes/`, or `docs/api-contract.md`,
say so in the PR description. These affect other subgroups.

## Never commit

- `.env` files or any secrets (only `.env.example` with placeholder values)
- `node_modules/` or `dist/`
