#!/usr/bin/env bash
# Kick-start Tauri (Rust backend) and the web UI (Vite). Uses bun.
# Run from project root: bash scripts/dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "[dev] Project root: $PROJECT_ROOT"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "[dev] Installing dependencies (bun)..."
  bun install
else
  echo "[dev] node_modules present, skipping bun install"
fi

# tauri dev runs beforeDevCommand (bun run dev) and opens the Tauri window
# Vite serves the UI at http://localhost:1420; Tauri loads it and provides the Rust backend
echo "[dev] Starting Tauri + Vite (Claude Command Center)..."
bun run tauri:dev
