# AstroBridge Operations Guide ⚙️

This document describes the deployment checklists, environment configurations, and resolver operations for AstroBridge.

## ⛓️ Smart Contract Deployment

### Sepolia Testnet Deployment
Configure `ETHEREUM_RPC_URL` and `RELAYER_PRIVATE_KEY` in `.env`, then execute:
```bash
pnpm --filter @wafflefinance/contracts exec hardhat run scripts/deploy.ts --network sepolia
```

### Soroban Testnet Deployment
Compile the WASM contract binaries:
```bash
cd soroban
cargo build --target wasm32-unknown-unknown --release
```
Deploy to Stellar testnet using `stellar-cli`:
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/astro_htlc.wasm \
  --source-account my-secret \
  --network testnet
```

---

## 🏃‍♂️ Running a Resolver

Anyone can operate a resolver by staking into the `ResolverRegistry` and running the listener.

### 1. Register Staking
Register resolver staking via the CLI runner or docker container:
```bash
docker run ghcr.io/wafflefinance/resolver:latest register \
  --private-key <EVM_KEY> \
  --stake-amount 1000000000000000000 \
  --network sepolia
```

### 2. Run Resolver Service
Poller starts and waits for matching cross-chain orders:
```bash
docker run ghcr.io/wafflefinance/resolver:latest run \
  --private-key <EVM_KEY> \
  --stellar-secret <STELLAR_KEY> \
  --rpc-url-eth <ETH_RPC> \
  --rpc-url-stellar <STELLAR_RPC>
```
For more options, run the container with `--help` to view CLI options.
