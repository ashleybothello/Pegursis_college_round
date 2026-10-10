# Verity Finance — API reference for Person 4

## Accounts and ports

Backend: `http://localhost:3000` (or `PORT` from `.env`). Local chain: `127.0.0.1:8545`.

## Environments

- `PROOF_MODE` / `BLOCKCHAIN_MODE` are orthogonal. `real + real` means genuine Groth16 snarkjs proof + `VerityManager.verifyProof` on-chain. `mock + mock` uses deterministic fixtures. The health endpoint reports the active modes.
- `GET /api/health` → `{status, version, proofMode, blockchainMode}`. Logs redact `incomeIndex/repaymentIndex/historyIndex/salt/pi_a/pi_b/pi_c`.

## General finance (preserved)

- `POST /api/credit/score` — `score = 300 + 5*incomeIndex + 3*repaymentIndex + 2*historyIndex`, 300..1300, model 1 (demo business logic; **not** ZK-proven).
- `POST /api/emi/calculate`, `POST /api/fraud/score`, `POST /api/settlements/calculate` — per `backend/README.md` / `src/services/*`.

## ZK verification

Private inputs are never returned, logged, or stored on-chain. Only the Poseidon commitment, the ZK score, and `modelId=1` are ever public.

- `POST /api/verification/submit` — `{incomeIndex, repaymentIndex, historyIndex: 0..100 (int)}` → `201` `{success, data: {taskId, commitment, score, modelVersion, status, stages, transactions:{taskCreationTx, proofSubmissionTx}, proofMode, blockchainMode, createdAt, updatedAt, message}}`. The backend owns the salt and task ID in real mode.
  - Under `PROOF_MODE=real`, `score` is the **circuit** score (`300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom` with the mapping `repaymentIndex→paymentHistory, incomeIndex→incomeStability, historyIndex→debtHeadroom`; e.g. `{60,70,80}` → `710`), `commitment` is Poseidon of `[features, inputSalt, taskId, 1]` (BN254 field via `circomlibjs`), public signals `[claimedScore, modelId, taskId, inputCommitment]`.
  - Under `PROOF_MODE=mock`, it is the legacy finance score (e.g. `{70,80,90}` → `1070`) with 2-signal pairs.
  - `status` values: `pending | proof_generated | offchain_verified | task_created | verified | mock | rejected | failed`. With `BLOCKCHAIN_MODE=real`, `verified` means the Solidity `verifyProof` pairing returned `true` and the transaction is confirmed.
  - Errors: validation → `400 VALIDATION_ERROR`; `PROOF_MODE=real` without artifacts → `503 SERVICE_UNAVAILABLE` (missing WASM/zkey/vkey); duplicate `taskId` → `409 CONFLICT`; not-found → `404 NOT_FOUND`.

- `GET /api/verification/:taskId` → `{taskId, commitment, score, modelVersion, status, transactions, proofMode, blockchainMode, createdAt, updatedAt, message}` from the orchestrator registry with on-chain fallback; `404 NOT_FOUND` for unknown ids. `status` is either `verified` (real chain) or `mock` (mock chain).
- `GET /api/verification?limit=20` → a list of public in-memory orchestrator records for the frontend audit view. It never includes private inputs.
- `POST /api/verification/:taskId/offchain` with `{}` rechecks the stored proof against the verification key. Passing `{ "claimedScore": 756 }` deliberately mutates the public signal for a tamper demonstration and must return `valid: false` for a genuine proof.

Example `curl`:

```bash
curl -s http://localhost:3000/api/health | jq
curl -s -X POST http://localhost:3000/api/verification/submit -H 'Content-Type: application/json' \
  -d '{"incomeIndex":60,"repaymentIndex":70,"historyIndex":80}' | jq '.data | {taskId, score, status}'
curl -s http://localhost:3000/api/verification/267541 | jq
curl -s -X POST http://localhost:3000/api/credit/score \
  -H 'Content-Type: application/json' -d '{"incomeIndex":70,"repaymentIndex":80,"historyIndex":90}' | jq
```

## Chain

- Target: `deployments/abi/VerityManager.json` + `deployments/localhost.json` (or `sepolia.json`/`bscTestnet.json` once deployed). Chain id `31337` on localhost. The backend's `VerityManager.json` is the canonical ABI; the legacy `VerityVerifier.json` file is retained only as a compatibility alias.

## CORS / origins

Express `cors()` allows all origins by default (hackathon). Constrain `CORS_ORIGIN` in `app.ts` for the deployed build if needed.
