#!/usr/bin/env bash
# §A cssVar 清扫 — legacy CSS / prototype token audit (Phase 0 baseline)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSS="$ROOT/styles/index-html.css"

count_or_zero() {
  local pattern="$1"
  local file="$2"
  if rg -c "$pattern" "$file" >/dev/null 2>&1; then
    rg -c "$pattern" "$file"
  else
    echo 0
  fi
}

echo "=== Agent Console CSS migration audit ==="
echo "Root: $ROOT"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

echo "--- index-html.css ---"
wc -l "$CSS" | awk '{print "lines:", $1}'
echo "var(--muted):     $(count_or_zero 'var\(--muted\)' "$CSS")"
echo "var(--fg):        $(count_or_zero 'var\(--fg\)' "$CSS")"
echo "var(--accent):    $(count_or_zero 'var\(--accent\)' "$CSS")"
echo "var(--border):    $(count_or_zero 'var\(--border\)' "$CSS")"
echo "oklch(:          $(count_or_zero 'oklch\(' "$CSS")"
echo ""

echo "--- TS/TSX inline prototype vars (excl. index-html.css) ---"
INLINE_PATTERN='var\(--(muted|fg|accent|success|warning|danger|border|surface|bg)\)'
if rg "$INLINE_PATTERN" "$ROOT" --glob '*.{ts,tsx}' -c 2>/dev/null | awk -F: '{s+=$2} END {print s+0}'; then
  :
else
  echo 0
fi
echo "files:"
rg -l "$INLINE_PATTERN" "$ROOT" --glob '*.{ts,tsx}' 2>/dev/null || echo "(none)"
echo ""

echo "--- TSX legacy global className hooks ---"
LEGACY_CLASS='className="(msg-|tool-demo|input-card|sidebar-|minimap-|grounding-demo|reasoning-demo|msg-types)'
rg -l "$LEGACY_CLASS" "$ROOT" --glob '*.tsx' 2>/dev/null || echo "(none)"
echo ""

echo "--- createStaticStyles / cssVar adoption ---"
echo "files with createStaticStyles or cssVar.:"
rg -l 'createStaticStyles|cssVar\.' "$ROOT" --glob '*.{ts,tsx}' 2>/dev/null | wc -l | awk '{print $1}'
echo ""

echo "=== end audit ==="
