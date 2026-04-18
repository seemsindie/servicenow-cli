#!/usr/bin/env bash
# Cross-compile sn for all supported targets and emit SHA256 checksums.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
mkdir -p "$DIST"

TARGETS=(
  "bun-linux-x64:sn-linux-x64"
  "bun-darwin-arm64:sn-darwin-arm64"
  "bun-darwin-x64:sn-darwin-x64"
)

cd "$ROOT"

for target in "${TARGETS[@]}"; do
  bunTarget="${target%%:*}"
  outName="${target##*:}"
  echo "→ building $outName (target: $bunTarget)"
  bun build --compile --target="$bunTarget" src/cli.ts --outfile "$DIST/$outName"
done

echo "→ building Node bundle (for npm): dist/sn.mjs"
bun build --target=node src/cli.ts --outfile "$DIST/sn.mjs"
{ printf '#!/usr/bin/env node\n'; cat "$DIST/sn.mjs"; } > "$DIST/sn.mjs.tmp"
mv "$DIST/sn.mjs.tmp" "$DIST/sn.mjs"
chmod +x "$DIST/sn.mjs"

echo "→ writing SHA256SUMS"
cd "$DIST"
sha256sum sn-linux-x64 sn-darwin-arm64 sn-darwin-x64 sn.mjs > SHA256SUMS

echo ""
echo "Release artifacts:"
ls -lh sn-linux-x64 sn-darwin-arm64 sn-darwin-x64 sn.mjs SHA256SUMS
