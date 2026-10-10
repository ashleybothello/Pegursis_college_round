# Verity Finance backend

The backend is the trusted prover/orchestrator boundary for the local Verity demo. It validates financial indices, generates the real credit-score v1 Groth16 proof when `PROOF_MODE=real`, verifies it off-chain, submits it to `VerityManager` when `BLOCKCHAIN_MODE=real`, and returns public status fields only.

## Commands

```powershell
npm install
npm run dev       # source server on PORT (default 3000)
npm run lint      # TypeScript check
npm test          # unit/API/ZK tests
npm run build
npm start
```

## Configuration

The canonical environment file is the repository-root `.env`, loaded by `src/config/index.ts`. Copy `../.env.example` to `../.env`; `backend/.env.example` is a path-adjusted reference for contributors.

| Variable | Meaning |
| --- | --- |
| `PORT` | Express port, default `3000` |
| `PROOF_MODE` | `mock` for isolated development or `real` for snarkjs Groth16 |
| `BLOCKCHAIN_MODE` | `mock` for in-memory records or `real` for ethers v6 + RPC |
| `RPC_URL` | JSON-RPC endpoint, normally `http://127.0.0.1:8545` |
| `PRIVATE_KEY` | Untracked local signer key; required only in real chain mode |
| `CONTRACT_ADDRESS` | Deployed `VerityManager` address |
| `CONTRACT_ABI_PATH` | `deployments/abi/VerityManager.json` |
| `CIRCUIT_WASM_PATH` | `build/credit_score_js/credit_score.wasm` |
| `CIRCUIT_ZKEY_PATH` | `build/credit_score_final.zkey` |
| `VERIFICATION_KEY_PATH` | `build/verification_key.json` |

Relative paths are resolved from the repository root, regardless of whether the backend runs from `backend/` or the root.

## API surface

- `GET /api/health` — reports active proof and blockchain modes.
- `POST /api/verification/submit` — accepts `{ incomeIndex, repaymentIndex, historyIndex }`, owns salt/task ID, and runs the complete workflow.
- `GET /api/verification/:taskId` — returns a public record or on-chain fallback.
- `GET /api/verification?limit=20` — returns process-local public audit records for the frontend.
- `POST /api/verification/:taskId/offchain` — rechecks the stored proof; `{ claimedScore }` is the controlled tamper path.
- `POST /api/credit/score`, `/api/emi/calculate`, `/api/fraud/score`, `/api/settlements/calculate` — preserved non-ZK demonstrator engines.

The ZK proof's public order is `[claimedScore, modelId, taskId, inputCommitment]`. The backend never logs or returns private features, salts, or proof coordinates. `verified` means the real Solidity pairing call was confirmed on-chain; `mock` is never presented as cryptographic verification.

See the root `README.md`, `API.md`, and `CONTRIBUTING.md` for the full integration contract and local deployment flow.
