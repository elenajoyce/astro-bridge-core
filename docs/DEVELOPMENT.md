# AstroBridge Development Guide 🛠️

This document outlines the local setup, compilation, and testing workflows for the AstroBridge monorepo.

## 🏗️ Requirements
- Node.js 22.5+
- pnpm 8+
- Rust stable + `wasm32-unknown-unknown` target (for Soroban)
- Foundry (for local EVM testing)

---

## 🚀 Getting Started

### 1. Install Workspace Dependencies
At the root of the monorepo, run:
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy the example environment template and configure your RPC nodes and private keys:
```bash
cp env.example .env
```

### 3. Build Shared Packages
The config validation and SDK packages must be compiled before running services:
```bash
pnpm build:config
pnpm build:sdk
```

---

## 📦 Package Workflows

### EVM Smart Contracts (`/contracts`)
Compile, deploy, and test Solidity contracts:
```bash
cd contracts
pnpm install
pnpm exec hardhat compile
pnpm exec hardhat test
```

### Soroban Rust Contracts (`/soroban`)
Test and build Soroban contracts:
```bash
cd soroban
cargo test
cargo build --target wasm32-unknown-unknown --release
```

### Coordinator REST Service (`/coordinator`)
Start the Order Book tracker with local SQLite database:
```bash
pnpm --filter @astro-bridge/coordinator dev
```

### Relayer Engine (`/relayer`)
Start the event-polling watchdogs:
```bash
pnpm --filter @astro-bridge/relayer dev
```

### React Frontend (`/frontend`)
Launch the client swap interface locally:
```bash
pnpm --filter @astro-bridge/frontend dev
```
The client dApp will open at [http://localhost:5173/](http://localhost:5173/).
