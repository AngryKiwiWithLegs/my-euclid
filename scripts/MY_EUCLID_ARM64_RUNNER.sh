#!/usr/bin/env bash
# Downloadable My Euclid Apple Silicon acceptance launcher.
# Run with: bash "$HOME/Downloads/MY_EUCLID_ARM64_RUNNER.sh"
set -euo pipefail

DEFAULT_ROOT="$HOME/Documents/My Euclid/my-euclid"
if [[ -n "${MY_EUCLID_ROOT:-}" && -f "$MY_EUCLID_ROOT/package.json" ]]; then
  ROOT="$MY_EUCLID_ROOT"
elif [[ -f "$DEFAULT_ROOT/package.json" ]]; then
  ROOT="$DEFAULT_ROOT"
else
  echo "My Euclid client source is not installed at: $DEFAULT_ROOT"
  echo
  echo "Run these commands in Terminal, then run this launcher again:"
  echo "  mkdir -p \"$HOME/Documents/My Euclid\""
  echo "  cd \"$HOME/Documents/My Euclid\""
  echo "  git clone https://github.com/dfdd2001-source/my-euclid.git my-euclid"
  echo
  echo "The repository is private, so GitHub may ask you to authenticate."
  echo "Do not enter API keys into this launcher or share them in its output."
  exit 2
fi

exec bash "$ROOT/scripts/verify-macos-arm64.sh" "$@"
