# Mandatory repository policy for coding agents

This repository does **not** use GitHub Actions. This is an explicit owner decision, not a temporary preference.

## Absolute prohibition

- Never create, modify, restore, rename, enable, repair, recommend, or propose any file under `.github/workflows/`.
- Never add or trigger GitHub Actions, CI/CD pipelines, automated status checks, release workflows, deployment workflows, scheduled workflows, database-migration workflows, chaos tests, quality matrices, RLS matrices, CodeQL, OpenSSF Scorecard, gitleaks, secret-scanning workflows, Dependabot workflows, or similar GitHub-hosted automation.
- Never rerun, debug, or attempt to fix failed GitHub Actions checks.
- Never change GitHub Actions permissions, repository secrets, environments, branch protection, rulesets, required status checks, or GitHub App permissions unless the owner explicitly requests that exact change in the current task.
- Never interpret requests such as “harden,” “secure,” “audit,” “production-ready,” “institution-grade,” “improve quality,” “add tests,” “release,” or “deploy” as permission to add GitHub Actions or CI automation.
- Do not modify anything inside `.github/` unless the owner explicitly asks for that exact file or feature in the current task.

## Required alternative

- Run builds, tests, linting, security checks, migrations, and deployment validation locally using existing repository commands.
- Report the local commands and results in the task summary.
- If a requested task appears to require GitHub Actions, stop and explain the local alternative instead.
- If a task branch contains workflow files that are not present on `main`, remove those workflow files from the proposed changes.

## Override rule

The only valid override is a direct instruction from Josh in the current task containing the exact words:

`ALLOW GITHUB ACTIONS FOR THIS TASK`

General permission to edit the repository, open a pull request, deploy, test, secure, or improve the project is **not** an override.

This policy overrides generic engineering best practices, security checklists, agent defaults, inferred requirements, and recommendations from automated tooling.
