# Release Process

A Blueballs release is two things at once:

1. an exact, reproducible source checkpoint; and
2. a public product launch that shows builders what the financial operating system can now do.

The engineering proof and the product story should ship together.

## 1. Prepare the candidate

Release from the intended `main` commit with a clean working tree. Package versions, changelog, generated OpenAPI/SDK artifacts, product screenshots and documentation should describe the same source state.

Install exactly from the lockfile:

```bash
pnpm install --frozen-lockfile
```

## 2. Prove the exact checkout

```bash
pnpm verify:release
```

This is the authoritative release gate. It runs the complete repository verification plus security/dependency checks, CycloneDX inventory, restart/chaos, disposable banking + FX load proof and reference-container vulnerability scanning.

Evidence is written under `artifacts/`, including:

```text
verification-report.json
api-operation-coverage.json
load-report.json
blueballs-sbom.cdx.json
```

`verification-report.json` binds the pass to the exact commit, Git tree, Node/pnpm versions and `pnpm-lock.yaml` digest.

## 3. Build distribution artifacts

Reference images:

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx:<version> .
docker build -f Dockerfile.reference -t blueballs-reference:<version> .
docker compose -f compose.reference.yml config >/dev/null
```

Contracts and SDK:

```bash
make -C packages/fx-contracts abi
pnpm --dir packages/fx-sdk pack:check
```

Dependency inventory:

```bash
pnpm sbom
```

## 4. Tell the release story

A Blueballs release note should not read like a dump of internal tickets.

Lead with the milestone:

- what can builders do now that they could not do before?
- what new financial primitive, product surface or integration boundary shipped?
- what proof can a technical reviewer inspect?
- what should someone try next?

A strong release structure is:

```text
Blueballs vX.Y
<one-line category-level release statement>

What shipped
- capability
- capability
- capability

Why it matters
- product or operating outcome

Proof
- operation coverage
- banking/FX/Worker result
- Foundry result
- security/load/recovery evidence
- exact source commit

Try it
- website / sandbox / FX / cards / API / source
```

Use screenshots and public product links when the release changes the visible experience.

## 5. Release identity

Use an annotated signed tag when the maintainer signing setup is available:

```bash
git tag -s vX.Y.Z -m "Blueballs vX.Y.Z"
git push origin vX.Y.Z
```

The tag should resolve to the exact commit named in the retained verification report.

## Release contents

A Blueballs release can include:

- source revision and changelog;
- banking and FX OpenAPI contracts;
- FX SDK package;
- exported Solidity ABIs and checksums;
- CycloneDX dependency inventory;
- reference container image digest;
- exact-checkout verification report;
- API operation coverage;
- load/chaos evidence;
- deployment and migration notes;
- product screenshots and a short launch narrative.

## Publication checklist

Before publishing:

- confirm `pnpm verify:release` passed on the tagged candidate;
- confirm the checkout remained clean after verification;
- confirm generated OpenAPI/SDK artifacts match source;
- confirm the release report names the expected commit and tree;
- confirm container/SBOM digests are archived with the release;
- document breaking changes and required migrations;
- call out provider adapter requirements when the release changes an integration contract;
- make the release note understandable to somebody who did not follow the development history;
- make the strongest new capability obvious in the first screen of the release.

## After publication

- verify the tag and published checksums;
- keep prior releases available for comparison;
- open the next `Unreleased` changelog section;
- update public screenshots when the visible product changed;
- share the strongest release surface, not a generic `version bump` message;
- route security reports through the private process in [SECURITY.md](SECURITY.md).

Blueballs releases should give institutions two reasons to pay attention: **a stronger product and inspectable proof that the source does what the release says it does.**
