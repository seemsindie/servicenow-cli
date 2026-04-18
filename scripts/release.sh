#!/usr/bin/env bash
# Bump version, run checks, commit, tag, push — which triggers .github/workflows/release.yml
# to build binaries, create a GitHub Release, and publish to npm.
#
# Usage:
#   ./scripts/release.sh patch            # 0.3.0 → 0.3.1
#   ./scripts/release.sh minor            # 0.3.0 → 0.4.0
#   ./scripts/release.sh major            # 0.3.0 → 1.0.0
#   ./scripts/release.sh 0.3.5            # explicit X.Y.Z
#   ./scripts/release.sh patch --yes      # skip confirmation prompt
#   ./scripts/release.sh patch --dry-run  # print plan, change nothing

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── args ─────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  cat >&2 <<EOF
usage: $0 {patch|minor|major|X.Y.Z} [--yes] [--dry-run]

examples:
  $0 patch
  $0 minor
  $0 0.4.0 --yes
EOF
  exit 1
fi

BUMP="$1"
shift
AUTO_YES=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --yes) AUTO_YES=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# ── guards ───────────────────────────────────────────────────
BRANCH="$(git symbolic-ref --short HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "✗ not on main (currently on '$BRANCH'). Switch to main first." >&2
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "✗ working tree has uncommitted changes:" >&2
  git status --short >&2
  exit 1
fi

if ! git diff --quiet @{upstream}..HEAD 2>/dev/null; then
  echo "⚠ local commits ahead of origin/main — they will be pushed."
fi

echo "→ fetching latest"
git fetch --tags --quiet

# ── compute next version ─────────────────────────────────────
CURRENT="$(node -p "require('./package.json').version")"
case "$BUMP" in
  patch|minor|major)
    NEW="$(node -e "
      const [maj,min,pat] = require('./package.json').version.split('.').map(Number);
      const m = '$BUMP';
      if (m === 'major') console.log((maj+1)+'.0.0');
      else if (m === 'minor') console.log(maj+'.'+(min+1)+'.0');
      else console.log(maj+'.'+min+'.'+(pat+1));
    ")"
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    NEW="$BUMP"
    ;;
  *)
    echo "✗ invalid bump: '$BUMP' (use patch/minor/major or X.Y.Z)" >&2
    exit 1
    ;;
esac

if git rev-parse "v$NEW" >/dev/null 2>&1; then
  echo "✗ tag v$NEW already exists" >&2
  exit 1
fi

# ── plan ─────────────────────────────────────────────────────
cat <<EOF

  current: $CURRENT
  new:     $NEW
  tag:     v$NEW
  branch:  $BRANCH

  will:
    1. bun run typecheck
    2. bun test
    3. write version to package.json + src/constants.ts
    4. git commit -m "chore: release v$NEW"
    5. git tag v$NEW
    6. git push && git push origin v$NEW
    7. release.yml builds binaries + publishes to npm

EOF

if [ "$DRY_RUN" = true ]; then
  echo "✓ dry-run complete — no changes made"
  exit 0
fi

if [ "$AUTO_YES" != true ]; then
  read -r -p "Proceed? [y/N] " reply
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "aborted"
    exit 64
  fi
fi

# ── checks (fail fast before touching anything) ─────────────
echo "→ typecheck"
bun run typecheck
echo "→ unit tests"
bun test

# ── bump ─────────────────────────────────────────────────────
echo "→ updating package.json and src/constants.ts"
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

  const constPath = 'src/constants.ts';
  const content = fs.readFileSync(constPath, 'utf8');
  fs.writeFileSync(
    constPath,
    content.replace(/VERSION = \"[^\"]+\"/, 'VERSION = \"$NEW\"')
  );
"

# ── commit, tag, push ────────────────────────────────────────
git add package.json src/constants.ts
git commit -m "chore: release v$NEW"
git tag "v$NEW"
git push
git push origin "v$NEW"

# ── done ─────────────────────────────────────────────────────
echo ""
echo "✓ v$NEW tagged and pushed"

REPO_URL="$(git config --get remote.origin.url | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##')"
if [ -n "$REPO_URL" ]; then
  echo "  release workflow: $REPO_URL/actions"
  echo "  npm package:      https://www.npmjs.com/package/$(node -p 'require("./package.json").name')"
fi

# If gh is installed, try to open the Actions tab
if command -v gh >/dev/null 2>&1; then
  echo ""
  echo "→ streaming workflow run (Ctrl-C to detach; release continues in CI)"
  sleep 3  # let the push settle on GitHub
  gh run watch --exit-status 2>/dev/null || echo "(no matching run yet; check the Actions tab)"
fi
