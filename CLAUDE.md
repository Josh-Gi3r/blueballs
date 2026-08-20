# Mandatory Claude Code instruction

This repository does **not** use GitHub Actions.

- Never create, modify, restore, rename, enable, repair, recommend, rerun, or debug `.github/workflows/**`.
- Never add GitHub-hosted CI/CD, status checks, CodeQL, gitleaks, secret-scan workflows, migration workflows, chaos workflows, quality matrices, RLS matrices, release workflows, or deployment workflows.
- Run all builds, tests, linting, security checks, migrations, and deployment validation locally.
- Do not change Actions permissions, repository secrets, environments, rulesets, required checks, or branch protection unless Josh explicitly requests that exact change in the current task.

The only override is a current-task instruction containing the exact words:

`ALLOW GITHUB ACTIONS FOR THIS TASK`

Read and obey `AGENTS.md` for the complete policy.
