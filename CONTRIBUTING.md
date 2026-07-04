# Contributing to AstroBridge 🤝

Thank you for your interest in contributing to **AstroBridge**! We welcome bug reports, feature suggestions, documentation updates, and pull requests.

Following these guidelines helps ensure a smooth and collaborative process for everyone.

---

## 🚀 How to Contribute

### 1. Reporting Bugs & Suggesting Features
- Search the open issues to see if your topic is already being discussed.
- If not, open a new issue describing the bug or feature request with clear steps to reproduce or design considerations.

### 2. Preparing a Pull Request
1. **Fork the repository** under your own GitHub account.
2. **Clone the fork** locally:
   ```bash
   git clone https://github.com/your-username/astro-bridge-core.git
   cd astro-bridge-core
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
4. **Install workspace dependencies**:
   ```bash
   pnpm install
   ```
5. **Implement your changes** and add appropriate tests (Hardhat for Solidity, Cargo for Rust).

---

## 🛠️ Code Style & Quality Standards

### TypeScript / Javascript
We enforce standard formatting and code quality checks using Prettier and ESLint.
- Run formatter:
  ```bash
  pnpm format
  ```
- Run linter:
  ```bash
  pnpm lint
  ```

### Smart Contracts (Solidity)
- Ensure all functions are well-documented following the NatSpec format.
- Verify that your code changes do not break any existing test assertions:
  ```bash
  pnpm test:contracts
  ```

### Smart Contracts (Soroban / Rust)
- Run unit tests:
  ```bash
  cd soroban && cargo test
  ```
- Format Rust code:
  ```bash
  cargo fmt
  ```

---

## ✍️ Commit Messages
We follow clean, semantic commit guidelines:
- `feat: ...` for new features
- `fix: ...` for bug fixes
- `docs: ...` for documentation updates
- `refactor: ...` for code quality updates without behavior changes
- `test: ...` for adding or fixing tests

Thank you for contributing to the future of decentralized, non-custodial cross-chain swapping!
