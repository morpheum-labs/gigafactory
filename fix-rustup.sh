#!/bin/bash
# Fix rustup component issues - specifically the cargo component missing error

set -e

# Set up environment variables
export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"

# Source cargo env if it exists
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

echo "🔧 Fixing rustup cargo component issue..."
echo ""

# Check if rustup is installed
if ! command -v rustup &> /dev/null; then
    echo "❌ rustup is not installed."
    echo "Please install Rust from: https://rustup.rs"
    exit 1
fi

TOOLCHAIN_PATH="$RUSTUP_HOME/toolchains/stable-x86_64-apple-darwin"

# Check if toolchain directory has permission issues
if [ -d "$TOOLCHAIN_PATH" ]; then
    echo "Step 1: Checking toolchain directory permissions..."
    if [ ! -d "$TOOLCHAIN_PATH/bin" ]; then
        echo "⚠️  Toolchain is broken (missing bin directory)"
        echo "   Some files may be owned by root, requiring sudo to fix."
        echo ""
        echo "   Attempting to fix permissions..."
        
        # Try to fix ownership (may require sudo)
        if sudo chown -R $(whoami) "$TOOLCHAIN_PATH" 2>/dev/null; then
            echo "✅ Fixed ownership"
        else
            echo "⚠️  Could not fix ownership automatically"
            echo ""
            echo "Please run this command manually:"
            echo "  sudo chown -R \$(whoami) $TOOLCHAIN_PATH"
            echo ""
            echo "Then run this script again, or manually:"
            echo "  rustup toolchain uninstall stable"
            echo "  rustup toolchain install stable"
            exit 1
        fi
    fi
fi

# Remove broken toolchain if it exists and we have permissions
if [ -d "$TOOLCHAIN_PATH" ] && [ ! -d "$TOOLCHAIN_PATH/bin" ]; then
    echo "Step 2: Removing broken toolchain..."
    rustup toolchain uninstall stable 2>/dev/null || {
        echo "⚠️  Could not uninstall via rustup, trying direct removal..."
        rm -rf "$TOOLCHAIN_PATH" 2>/dev/null || {
            echo "❌ Could not remove broken toolchain"
            echo "   Please run: sudo rm -rf $TOOLCHAIN_PATH"
            exit 1
        }
    }
fi

# Install fresh toolchain
echo "Step 3: Installing stable toolchain..."
rustup toolchain install stable

# Set as default
echo "Step 4: Setting stable as default..."
rustup default stable

# Verify
echo ""
echo "Step 5: Verifying installation..."
if cargo --version > /dev/null 2>&1; then
    echo "✅ Cargo is working!"
    cargo --version
    echo ""
    echo "✅ Rust version:"
    rustc --version
    echo ""
    echo "✅ Fix completed! You can now build the project with:"
    echo "  make build-tauri"
    echo "  or"
    echo "  make build"
else
    echo "❌ Cargo is still not working."
    echo ""
    echo "Please try:"
    echo "  1. sudo chown -R \$(whoami) $TOOLCHAIN_PATH"
    echo "  2. rustup toolchain uninstall stable"
    echo "  3. rustup toolchain install stable"
    echo "  4. rustup default stable"
    exit 1
fi
