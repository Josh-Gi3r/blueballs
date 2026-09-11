# Release Process

Blueballs releases are built from reproducible repository evidence tied to an exact commit.

## 1. Prepare the candidate

The release checkout should be on the intended `main` commit with a clean working tree. Package versions, changelog, generated OpenAPI/SDK artifacts and product documentation should describe the same source state.

Install exactly from the lockfile:

```bash
pnpm install --frozen-lockfile
```

## 2. Run the full release profile

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
docker build -f apps/fx-node/Dockerfile -t blueballs-fx:0.1.0 .
docker build -f Dockerfile.reference -t blueballs-reference:0.1.0 .
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

## 4. Release identity

Use an annotated signed tag when the maintainer signing setup is available:

```bash
git tag -s v0.1.0 -m "Blueballs v0.1.0"
git push origin v0.1.0
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
- deployment and migration notes.

## Publication checklist

Before publishing:

- confirm `pnpm verify:release` passed on the tagged candidate;
- confirm the checkout remained clean after verification;
- confirm generated OpenAPI/SDK artifacts match source;
- confirm the release report names the expected commit and tree;
- confirm container/SBOM digests are archived with the release;
- document breaking changes and required migrations;
- call out deployment adapter requirements when the release changes a provider contract.

## After publication

- verify the tag and published checksums;
- keep prior releases available for comparison;
- open the next `Unreleased` changelog section;
- route security reports through the private process in [`SECURITY.md`](SECURITY.md).

Blueballs release artifacts are designed so institutions and reviewers can independently reproduce the same source-level assurance profile on their own infrastructure.
