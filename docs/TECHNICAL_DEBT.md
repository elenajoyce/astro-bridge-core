# AstroBridge Technical Debt Register 📋

This document outlines the architectural limitations, roadmap, and planned improvements for AstroBridge.

## 🎯 High Priority Tasks

### 1. Solana Anchor Deployment
- **Status**: Simulation mode.
- **Goal**: Deploy the Solana Anchor HTLC program on devnet and activate full on-chain swap validation in the `@wafflefinance/sdk` client.

### 2. Multi-Sig Resolver Governance
- **Status**: Slashing is currently single-owner gated.
- **Goal**: Transition owner slash authorization in `ResolverRegistry.sol` to a multisig or decentralized governance module.

---

## 📈 Planned Improvements

### 🧪 Test Coverage Roadmap
- Add 8 Vitest unit tests in `packages/sdk` targeting the state machine transitions.
- Implement 4 REST route assertions in `coordinator` endpoints.

### ⚡ Gas Optimizations
- Optimize storage layouts in Solidity HTLCEscrow to reduce gas consumption during `lockOrder`.
- Reduce footprint of Soroban contract events.
