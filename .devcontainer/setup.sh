#!/bin/bash
set -e

echo "🚀 Starting environment setup..."

# 1. Install Foundry (for EVM development)
if ! command -v forge &> /dev/null; then
  echo "Installing Foundry..."
  curl -L https://foundry.paradigm.xyz | bash
  # Load foundry
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
else
  echo "Foundry is already installed"
fi

# 2. Install stellar-cli (for Soroban development)
if ! command -v stellar &> /dev/null; then
  echo "Installing stellar-cli (prebuilt binary)..."
  STELLAR_CLI_VERSION="21.6.0"
  curl -sSL "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-v${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz" | tar -xz
  mkdir -p "$HOME/.cargo/bin"
  mv stellar "$HOME/.cargo/bin/"
  export PATH="$HOME/.cargo/bin:$PATH"
else
  echo "stellar-cli is already installed"
fi

# 3. Add to PATH permanently in bashrc
if ! grep -q "foundry/bin" "$HOME/.bashrc"; then
  echo 'export PATH="$HOME/.foundry/bin:$HOME/.cargo/bin:$PATH"' >> "$HOME/.bashrc"
fi

# 4. Install project dependencies
echo "Installing project dependencies..."
pnpm install

# 5. Build config & SDK packages
echo "Building config & SDK packages..."
pnpm build:config
pnpm build:sdk

echo "✅ Environment setup complete!"
