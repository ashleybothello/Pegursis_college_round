# Verity Finance backend

The backend is the integration layer for the credit, loan/EMI, fraud, settlement, and proof workflows. It is an Express + TypeScript service with two switchable execution modes:

- `PROOF_MODE=mock` uses the deterministic financial scoring path for local UI development.
- `PROOF_MODE=real` generates and verifies a genuine Groth16 proof using the Circom artifacts in the repository `build/` directory.
- `BLOCKCHAIN_MODE=mock` keeps task records in memory.
- `BLOCKCHAIN_MODE=real` submits tasks and proofs to the deployed `VerityManager` contract through ethers v6.

## Development commands

Run these from `backend/`:

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
```

The compiled service is emitted to `backend/dist/` and is intentionally ignored by Git.

## Configuration

From the repository root, copy the root template before running the service:

```powershell
cd ..
copy .env.example .env
cd backend
```

The root `.env.example` is the source of truth. Important real-mode paths are relative to the repository root:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express port, default `3000` |
| `PROOF_MODE` | `mock` or `real` |
| `BLOCKCHAIN_MODE` | `mock` or `real` |
| `RPC_URL` | Hardhat/Anvil JSON-RPC URL |
| `PRIVATE_KEY` | Local development signer |
| `CONTRACT_ADDRESS` | Deployed `VerityManager` address |
| `CONTRACT_ABI_PATH` | Defaults to `deployments/abi/VerityManager.json` |
| `CIRCUIT_WASM_PATH` | Defaults to `build/credit_score_js/credit_score.wasm` |
| `CIRCUIT_ZKEY_PATH` | Defaults to `build/credit_score_final.zkey` |
| `VERIFICATION_KEY_PATH` | Defaults to `build/verification_key.json` |

The service never accepts a client-provided Poseidon commitment as authoritative. In real proof mode it calculates the commitment from the private circuit inputs, binds it to the task and model, and passes the public signals to `VerityManager`.

## HTTP surface

- `GET /api/health`
- `POST /api/credit/score`
- `POST /api/emi/calculate`
- `POST /api/fraud/score`
- `POST /api/settlements/calculate`
- `POST /api/verification/submit`
- `GET /api/verification/:taskId`

The complete request/response contract is documented in the repository root at [`API.md`](../API.md).

## Local real-proof flow

From the repository root, start the chain and deploy the contracts:

```powershell
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/export-abi.js --network localhost
```

Set `PROOF_MODE=real`, `BLOCKCHAIN_MODE=real`, and the generated `VerityManager` address in `.env`, then run the backend. The contract integration surface for the frontend is `deployments/abi/VerityManager.json` plus the generated `deployments/localhost.json`.

## Service layout

```text
src/
├── config/       environment and ABI loading
├── controllers/  HTTP request handlers
├── middleware/   errors, logging, and rate limiting
├── routes/       API route definitions
├── schemas/      Zod request validation
├── services/     financial, proof, blockchain, and orchestration logic
└── types/        shared backend contracts
```
