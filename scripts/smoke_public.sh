#!/usr/bin/env bash
set -euo pipefail

# Smoke test for the built static site under public/
# - Validates presence of critical pages
# - Verifies the routes JSON bridge (#vs-routes) on homepage
# - Ensures fingerprinted CSS is referenced and exists on disk
# - Ensures at least one JS bundle is referenced and exists on disk
# - Checks the footer version marker (.vim-ver) is present
# Optional: pass --build to run `hugo --minify` before checks (if available)

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PUB_DIR="$ROOT_DIR/public"

err() { echo "[FAIL] $*" >&2; exit 1; }
ok()  { echo "[OK] $*"; }
info(){ echo "[INFO] $*"; }

if [[ "${1:-}" == "--build" ]]; then
  if command -v hugo >/dev/null 2>&1; then
    info "Building site with 'hugo --minify'..."
    (cd "$ROOT_DIR" && hugo --minify >/dev/null)
  else
    info "'--build' requested but 'hugo' not found; skipping build."
  fi
fi

[ -d "$PUB_DIR" ] || err "public/ directory not found (run 'hugo --minify' first or pass --build)"

# 1) Pages exist
for p in index.html about/index.html help/index.html changelog/index.html; do
  [ -f "$PUB_DIR/$p" ] || err "Missing public/$p"
done
ok "Critical pages exist"

# 2) Routes data block present in homepage
grep -q 'id="vs-routes"' "$PUB_DIR/index.html" || err "vs-routes block missing in homepage"
grep -q 'data-json' "$PUB_DIR/index.html" || err "vs-routes data-json missing"
ok "Routes JSON bridge present"

# 3) Fingerprinted CSS referenced and file exists (portable sed/grep)
css_path=$(sed -n 's/.*href="\([^" ]*\/css\/main\.min\.[a-f0-9][a-f0-9]*\.css\)".*/\1/p' "$PUB_DIR/index.html" | head -n1)
[ -n "${css_path:-}" ] || err "No fingerprinted CSS link found in homepage"
[ -f "$PUB_DIR$css_path" ] || err "CSS file not found: $PUB_DIR$css_path"
ok "CSS fingerprint/link OK ($css_path)"

# 4) At least one JS bundle referenced and present
js_paths=$(sed -n 's/.*src="\([^" ]*\/js\/[^" ]*\.min\.[a-f0-9][a-f0-9]*\.js\)".*/\1/p' "$PUB_DIR/index.html")
first_js=$(echo "$js_paths" | head -n1 || true)
[ -n "${first_js:-}" ] || err "No fingerprinted JS script link found in homepage"
missing_js=0
while IFS= read -r js; do
  [ -z "$js" ] && continue
  if [ ! -f "$PUB_DIR$js" ]; then
    echo "[FAIL] JS file not found: $PUB_DIR$js" >&2
    missing_js=1
  fi
done <<< "$js_paths"
[ "$missing_js" -eq 0 ] || err "One or more JS bundles referenced by homepage are missing"
ok "JS fingerprint/link(s) OK"

# 5) Version marker in footer
grep -q 'vim-ver' "$PUB_DIR/index.html" || err "Version marker (.vim-ver) missing in homepage"
ok "Footer version marker present"

echo "All smoke checks passed."
