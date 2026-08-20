# Mandatory repository instruction

This repository has a strict owner-mandated **no GitHub Actions** policy.

- Never create, modify, restore, rename, enable, repair, recommend, rerun, or debug anything under `.github/workflows/`.
- Never add CI/CD, automated status checks, CodeQL, gitleaks, secret-scan workflows, database-migration workflows, chaos workflows, quality matrices, RLS matrices, release workflows, or deployment workflows using GitHub Actions.
- Run builds, tests, linting, security checks, migrations, and deployment validation locally instead.
- Do not modify GitHub Actions permissions, secrets, environments, rulesets, required checks, or branch protection unless Josh explicitly requests that exact change in the current task.
- Generic requests such as “secure,” “harden,” “audit,” “test,” “deploy,” “release,” or “production-ready” are not permission to add automation.

The only override is a current-task instruction containing the exact words:

`ALLOW GITHUB ACTIONS FOR THIS TASK`

Read and obey `/AGENTS.md` for the complete policy.
