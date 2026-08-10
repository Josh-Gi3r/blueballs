#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p abi
forge build >/dev/null

contracts=(
  "src/FxVault.sol:FxVault"
  "src/OrderCancellation.sol:OrderCancellation"
  "src/PolicyAuthorizationRegistry.sol:PolicyAuthorizationRegistry"
  "src/FxSettlement.sol:FxSettlement"
  "src/AtomicRouter.sol:AtomicRouter"
)

for target in "${contracts[@]}"; do
  name="${target##*:}"
  forge inspect "$target" abi > "abi/${name}.json"
  printf '%s\n' "abi/${name}.json"
done

(
  cd abi
  sha256sum ./*.json > SHA256SUMS
)
printf '%s\n' "abi/SHA256SUMS"
