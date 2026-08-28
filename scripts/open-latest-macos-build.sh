#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="${ROOT}/release"
INSTALLED_APP="/Applications/My Euclid.app"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This launcher must be run on macOS." >&2
  exit 2
fi

# Prefer the installed application: this is the path a user normally needs
# after dragging My Euclid.app from the DMG into Applications.
if [[ -d "$INSTALLED_APP" ]]; then
  echo "Opening installed application: $INSTALLED_APP"
  open "$INSTALLED_APP"
  exit 0
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Installed app not found: $INSTALLED_APP" >&2
  echo "No release directory found: $RELEASE_DIR" >&2
  echo "Install My Euclid.app into /Applications or run the arm64 packaging command first." >&2
  exit 1
fi

APP="$(find "$RELEASE_DIR" -type d -name '*.app' -print | sort | tail -n 1 || true)"
DMG="$(find "$RELEASE_DIR" -type f -name '*.dmg' -print | sort | tail -n 1 || true)"

if [[ -n "$APP" ]]; then
  echo "Opening packaged application: $APP"
  open "$APP"
  exit 0
fi

if [[ -n "$DMG" ]]; then
  echo "Opening disk image: $DMG"
  open "$DMG"
  exit 0
fi

echo "No .app or .dmg found under: $RELEASE_DIR" >&2
echo "Expected a packaged arm64 release in release/mac-arm64 or a neighboring release directory." >&2
exit 1
