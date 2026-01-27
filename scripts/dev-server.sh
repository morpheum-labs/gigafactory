#!/usr/bin/env bash
# Build the dev-server (Rust backend) for Giga Command Center
# Run from project root: bash scripts/build-dev-server.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Building dev-server (giga-command-center-server)..."

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: cargo is not installed or not in PATH"
    echo "Please install Rust from https://rustup.rs/"
    exit 1
fi

# Build the server in dev mode (faster, unoptimized)
cargo build -p giga-command-center-server

echo "✅ Dev-server build completed!"
echo ""
echo "Server binary location: target/debug/giga-command-center-server"
echo ""
echo "To run the server:"
echo "  cargo run -p giga-command-center-server"
echo "  or"
echo "  ./target/debug/giga-command-center-server"
