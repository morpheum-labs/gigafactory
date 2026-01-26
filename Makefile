.PHONY: help build build-tauri build-server clean install deps

# Default target
.DEFAULT_GOAL := help

# Variables
TAURI_BUILD_CMD = bun run build:tauri
SERVER_PACKAGE = giga-command-center-server
CARGO = cargo

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: deps ## Install all dependencies (bun and cargo)
	@echo "Installing dependencies..."

deps: ## Install JavaScript dependencies
	@echo "Installing JavaScript dependencies..."
	@bun install

build: build-tauri build-server ## Build Tauri and then build server (default)

build-tauri: ## Build Tauri application
	@echo "Building Tauri application..."
	@$(TAURI_BUILD_CMD)
	@echo "Tauri build completed!"

build-server: ## Build the server binary
	@echo "Building server..."
	@$(CARGO) build --release -p $(SERVER_PACKAGE)
	@echo "Server build completed!"
	@echo "Server binary location: target/release/$(SERVER_PACKAGE)"

build-server-dev: ## Build the server in dev mode (faster, unoptimized)
	@echo "Building server (dev mode)..."
	@$(CARGO) build -p $(SERVER_PACKAGE)
	@echo "Server build completed (dev mode)!"

build-all: ## Build everything (Tauri + Server + Web)
	@echo "Building all components..."
	@$(MAKE) build-tauri
	@$(MAKE) build-server
	@echo "All builds completed!"

clean: ## Clean all build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@rm -rf src-tauri/target/
	@rm -rf src-server/target/
	@rm -rf target/
	@echo "Clean completed!"

clean-tauri: ## Clean Tauri build artifacts
	@echo "Cleaning Tauri build artifacts..."
	@rm -rf dist/
	@rm -rf src-tauri/target/
	@echo "Tauri clean completed!"

clean-server: ## Clean server build artifacts
	@echo "Cleaning server build artifacts..."
	@$(CARGO) clean -p $(SERVER_PACKAGE)
	@echo "Server clean completed!"

test: ## Run tests
	@echo "Running tests..."
	@$(CARGO) test --workspace

check: ## Run cargo check on all packages
	@echo "Running cargo check..."
	@$(CARGO) check --workspace
