#!/usr/bin/env bash
# My Euclid macOS arm64 acceptance runner.
# It never reads, prints, exports, or transmits API keys or Keychain contents.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/macos-arm64-acceptance.log"
OPEN_DMG=false
if [[ "${1:-}" == "--open-dmg" ]]; then OPEN_DMG=true; fi

exec > >(tee "$LOG") 2>&1
echo "My Euclid macOS arm64 acceptance — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Repository: $ROOT"
echo "Architecture: $(uname -m)"
if [[ "$(uname -s)" != "Darwin" ]]; then echo "FAIL: This script must run on macOS."; exit 1; fi
if [[ "$(uname -m)" != "arm64" ]]; then echo "FAIL: This acceptance path requires an Apple Silicon arm64 Mac."; exit 1; fi
for command in node pnpm git hdiutil codesign spctl; do command -v "$command" >/dev/null || { echo "FAIL: Required command is missing: $command"; exit 1; }; done
echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Git: $(git --version)"
echo "Commit: $(git rev-parse --short HEAD)"

pnpm install --frozen-lockfile
pnpm rebuild:native
pnpm build
pnpm check

for test in \
  scripts/verify-sqlite.mjs \
  scripts/verify-archive-flow.mjs \
  scripts/verify-practice-backup.mjs \
  scripts/verify-ink-flow.mjs \
  scripts/verify-region-ocr.mjs \
  scripts/verify-assessment-report.mjs \
  scripts/verify-assessment-diff-flow.mjs \
  scripts/verify-ai-config-security.mjs \
  scripts/verify-ai-runtime.mjs \
  scripts/verify-question-bank-flow.mjs \
  scripts/verify-mock-exam-flow.mjs \
  scripts/verify-adaptive-training-flow.mjs \
  scripts/verify-tutor-flow.mjs; do
  echo "--- $test"
  pnpm exec electron --runAsNode "$test"
done

pnpm package:mac
DMG="$(find "$ROOT/release" -maxdepth 1 -type f -name '*arm64.dmg' -print -quit)"
[[ -n "$DMG" ]] || { echo "FAIL: No arm64 DMG found in release/."; exit 1; }
echo "DMG: $DMG"
file "$DMG"
hdiutil verify "$DMG"

MOUNT="$(mktemp -d /tmp/my-euclid-dmg.XXXXXX)"
cleanup() { hdiutil detach "$MOUNT" -quiet 2>/dev/null || true; rmdir "$MOUNT" 2>/dev/null || true; }
trap cleanup EXIT
hdiutil attach "$DMG" -nobrowse -mountpoint "$MOUNT"
APP="$(find "$MOUNT" -maxdepth 2 -type d -name 'My Euclid.app' -print -quit)"
[[ -n "$APP" ]] || { echo "FAIL: My Euclid.app was not found inside the DMG."; exit 1; }
echo "App bundle: $APP"
echo "--- Code-signing status (an unsigned build is reported, not treated as a build failure) ---"
codesign -dv --verbose=2 "$APP" 2>&1 || true
echo "--- Gatekeeper assessment (a non-zero result normally means unsigned/not notarized) ---"
spctl --assess --type execute --verbose=4 "$APP" 2>&1 || true
if [[ "$OPEN_DMG" == true ]]; then open "$APP"; fi

echo "PASS: arm64 build, core local regression, DMG layout, and integrity checks completed."
echo "Next: complete the manual in-app checklist in docs/MACOS-ARM64-ACCEPTANCE.md."
echo "Log written to: $LOG"
