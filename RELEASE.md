# Blueballs Reference Release

This procedure creates a reproducible evidence bundle for a tagged Blueballs reference release.

A tagged reference release means the documented source, tests and artefacts were reproduced at one commit. It does not mean independent audit, regulator approval or production suitability.

## Preconditions

- release commit is on `main`;
- working tree is clean;
- `package.json` and `packages/fx-sdk/package.json` versions match;
- `CHANGELOG.md` contains the release entry;
- `SECURITY.md`, `THIRD_PARTY_NOTICES.md` and known limitations are current;
- no production secrets or database files are present;
- the complete pull-request gate is green;
- visual screenshots have been reviewed;
- the release commit has not changed since review.

## Local verification

```bash
pnpm install --frozen-lockfile
pnpm build
```

Run every JavaScript FX suite:

```bash
for dir in \
  packages/fx-market \
  packages/fx-pricing \
  packages/fx-liquidity \
  packages/fx-policy \
  packages/fx-fiat \
  packages/fx-sdk \
  packages/fx-simulator \
  apps/fx-node
do
  (cd "$dir" && npm run test:ci)
done
```

Run contracts:

```bash
cd packages/fx-contracts
make ci
make abi
cd ../..
```

Build images and validate Compose:

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx:0.1.0 .
docker build -f Dockerfile.reference -t blueballs-reference:0.1.0 .
docker compose -f compose.reference.yml config >/dev/null
```

Generate the dependency inventory:

```bash
node scripts/dependency-inventory.mjs artifacts/blueballs-sbom.cdx.json
```

Dry-run the SDK package:

```bash
cd packages/fx-sdk
npm pack --dry-run
cd ../..
```

## Controlled EVM proof

The aggregate release workflow starts Anvil and broadcasts `ControlledProof.s.sol` with deterministic funded actors. A release must not proceed if that job fails.

The proof is not a public-mainnet or production-token claim.

## Tag

Use an annotated, signed tag where signing infrastructure is available:

```bash
git tag -s v0.1.0 -m "Blueballs v0.1.0 reference release"
git push origin v0.1.0
```

If signed tags are unavailable, document that limitation in the release notes rather than implying signature verification.

## Release workflow

The tag triggers `.github/workflows/reference-release.yml`, which:

- installs the locked workspace;
- builds the site;
- runs all FX Node suites;
- runs contract tests, fuzzing and invariants;
- performs the controlled EVM proof;
- exports contract ABIs and checksums;
- packs the SDK;
- generates the CycloneDX dependency inventory;
- builds Docker images;
- packages documentation and evidence;
- uploads one release bundle as a GitHub Actions artefact.

The workflow does not automatically publish npm packages, push public container images or create a GitHub Release. Those actions require a separate maintainer approval after artefact review.

## Artefacts

Expected bundle:

```text
blueballs-reference-<version>/
├─ source-commit.txt
├─ CHANGELOG.md
├─ SECURITY.md
├─ THIRD_PARTY_NOTICES.md
├─ known-limitations.md
├─ openapi.yaml
├─ sdk/
│  └─ blueballs-fx-sdk-<version>.tgz
├─ contracts/
│  ├─ AtomicRouter.json
│  ├─ FxSettlement.json
│  ├─ FxVault.json
│  ├─ OrderCancellation.json
│  ├─ PolicyAuthorizationRegistry.json
│  └─ SHA256SUMS
├─ sbom/
│  └─ blueballs-sbom.cdx.json
└─ checksums.txt
```

## Post-release

- verify the tag resolves to the reviewed commit;
- verify artefact checksums;
- publish release notes including every known limitation;
- do not mark the release audited unless an independent report is attached;
- keep previous release artefacts available for comparison;
- open the next `Unreleased` changelog section.
