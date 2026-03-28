#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# deploy-slides-addon.sh
#
# Builds the Vite React app, inlines it into the Apps Script
# sidebar.html, then pushes to Google via clasp.
#
# Prerequisites:
#   npm install -g @google/clasp
#   clasp login
#   Create a script project and put its ID in .clasp.json
#
# Usage:
#   ./scripts/deploy-slides-addon.sh          # build + push
#   ./scripts/deploy-slides-addon.sh --dry    # build only, no push
# ─────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_DIR="$REPO_ROOT/apps/slides-addon"
GAS_DIR="$ADDON_DIR/gas"
DIST_DIR="$ADDON_DIR/dist"
STAGE_DIR="$REPO_ROOT/output/clasp-stage"

DRY_RUN=false
if [[ "${1:-}" == "--dry" ]]; then
  DRY_RUN=true
fi

echo "── Step 1: Build Vite app ──"
npm run build --workspace @magistrat/slides-addon

echo "── Step 2: Stage clasp push directory ──"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

# Copy Apps Script files
cp "$GAS_DIR/appsscript.json" "$STAGE_DIR/"
cp "$GAS_DIR/Code.gs" "$STAGE_DIR/"

echo "── Step 3: Inline Vite bundle into sidebar.html ──"

# Find the built JS and CSS files
JS_FILE=$(find "$DIST_DIR/assets" -name "*.js" | head -1)
CSS_FILE=$(find "$DIST_DIR/assets" -name "*.css" | head -1)

if [[ -z "$JS_FILE" ]]; then
  echo "ERROR: No JS bundle found in $DIST_DIR/assets"
  exit 1
fi

# Assemble sidebar.html by splitting on the injection marker and
# concatenating the parts with the inlined bundle in between.
{
  # Everything before the marker
  sed '/<!-- INJECT_VITE_BUNDLE -->/,$d' "$GAS_DIR/sidebar.html"

  # Inlined CSS
  if [[ -n "$CSS_FILE" ]]; then
    echo "<style>"
    cat "$CSS_FILE"
    echo "</style>"
  fi

  # Inlined JS
  echo "<script>"
  cat "$JS_FILE"
  echo "</script>"

  # Everything after the marker
  sed '1,/<!-- INJECT_VITE_BUNDLE -->/d' "$GAS_DIR/sidebar.html"
} > "$STAGE_DIR/sidebar.html"

echo "  Staged files:"
ls -la "$STAGE_DIR/"

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "── Dry run complete. Staged files in $STAGE_DIR ──"
  echo "  To push manually: cd $STAGE_DIR && clasp push"
  exit 0
fi

echo "── Step 4: Push to Google via clasp ──"

if ! command -v clasp &> /dev/null; then
  echo "ERROR: clasp not found. Install with: npm install -g @google/clasp"
  exit 1
fi

if [[ ! -f "$STAGE_DIR/.clasp.json" && ! -f "$REPO_ROOT/.clasp.json" ]]; then
  echo "ERROR: No .clasp.json found. Create one with your script ID:"
  echo '  {"scriptId":"YOUR_SCRIPT_ID","rootDir":"output/clasp-stage"}'
  exit 1
fi

cd "$STAGE_DIR"
clasp push

echo ""
echo "── Deploy complete ──"
echo "  Open the script editor: clasp open"
echo "  Test in a presentation: Extensions → Magistrat → Open sidebar"
