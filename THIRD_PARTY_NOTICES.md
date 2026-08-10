# Third-Party Notices

Blueballs is distributed under the MIT License. It also depends on third-party open-source software under its own licences.

This notice records the principal direct dependencies of the `0.1.x` reference line. The release workflow also produces a machine-readable dependency inventory from the locked workspace.

## JavaScript and TypeScript

| Project | Purpose | Licence |
|---|---|---|
| React | product UI | MIT |
| React DOM | browser rendering | MIT |
| Vite | development and production build | MIT |
| `@vitejs/plugin-react` | React integration for Vite | MIT |
| TypeScript | static type checking | Apache-2.0 |
| `@types/react` | React type declarations | MIT |
| `@types/react-dom` | React DOM type declarations | MIT |

The FX runtime and SDK intentionally use Node.js standard-library modules and do not add a runtime web framework.

## Solidity and Foundry

| Project | Pinned reference version | Purpose | Licence |
|---|---:|---|---|
| OpenZeppelin Contracts | v5.6.1 | EIP-712, signature checking, math and reentrancy controls | MIT |
| forge-std | v1.16.2 | Foundry testing and scripting | MIT |
| Foundry | CI toolchain v1.7.1 | build, tests, fuzzing, invariants and scripts | Apache-2.0 / MIT components |

Pinned versions are recorded in `packages/fx-contracts/Makefile` and GitHub Actions workflows.

## Container base images

Reference Dockerfiles currently use the official `node:24.15.0-alpine` image. The image contains Node.js and Alpine Linux packages under their respective licences.

## Full dependency inventory

Before a tagged release, run the release workflow or:

```bash
pnpm install --frozen-lockfile
node scripts/dependency-inventory.mjs
```

The generated inventory is evidence of the locked dependency graph, not a legal conclusion about every transitive package. Deploying organisations remain responsible for their own licence and supply-chain review.

Copyright notices and licence texts supplied by dependencies remain the property of their respective authors.
