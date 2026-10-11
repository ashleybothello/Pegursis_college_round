# Verity Finance — privacy-preserving ZK credit scoring

Monorepo layout (single folder, per request):

- `circuits/` — Circom circuits (v1 credit scoring) by Person 1.
- `build/` — compiled artifacts (WASM, `.zkey`, `.r1cs`, `verification_key.json`, `proof.json`/`public.json` samples).
- `contracts/` — Solidity verifiers (`VerityCreditScoreVerifier.sol` / `Groth16Verifier`, `VerityEligibilityVerifier.sol`) + `VerityManager.sol` (task lifecycle, genuine Groth16 verify) by Person 3.
- `backend/` — Express + ethers v6 + ZK backend by Person 2 (wired to the real circuit + `VerityManager`).
- `lib/`, `scripts/`, `test/`, `deployments/` — shared proof helpers, deploy scripts, Hardhat tests and exported ABIs.
- `frontend/` — clean workspace for Person 4's dashboard implementation.

The Credence frontend presents this as a three-party verifiable-computation
platform: a requester agrees the task and model, a provider computes privately
and attaches a proof, and independent verifiers check the proof and its
tamper-evident chain record. Finance modules are the example workloads.

## Two models (README: not a trained AI system)

- Financial scoring (`POST /api/credit/score`): `score = 300 + 5*incomeIndex + 3*repaymentIndex + 2*historyIndex` — demo business logic, preserved as-is.
- ZK circuit (`circuits/credit_score.circom`, `modelId=1`): `score = 300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom`, Poseidon commitment over `[paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]`, public signals `[claimedScore, modelId, taskId, inputCommitment]`. Only this formula can be ZK-proven; `POST /api/verification/submit` uses the circuit score via mapping `repaymentIndex→paymentHistory, incomeIndex→incomeStability, historyIndex→debtHeadroom` (see `backend/src/services/zkCreditScoring.ts`). A valid proof does not attest that the underlying financial data is truthful.

## Prerequisites

- Node.js 18+ (tested on 24.x), npm 9+, Hardhat local node (built-in), no `circom` binary required (artifacts already committed).

## One-command install

```powershell
# from the repo root
npm install
pushd backend; npm install; popd
```

There are two `package.json`s by architecture (root = ZK+Hardhat, backend = Express service). Do not merge lockfiles; do not copy `node_modules/`.

## Contracts (Person 3)

Signature (actual): `VerityManager(address creditScoreVerifier, address eligibilityVerifier)`
- `createTask(uint256 taskId, uint256 modelId, uint256 commitment)` — reverts on duplicate/unsupported model/zero.
- `submitProof(uint256 taskId, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] publicSignals)` — checks `modelId/taskId/commitment` vs registered task, then calls the genuine verifier (`uint256[4]` for credit, `uint256[5]` for eligibility). `b` already in Solidity order `[[b01,b00],[b11,b10]]`. Reverts with `invalid proof` on tampered signals, `commitment signal mismatch`, `taskId signal mismatch`, `bad signal count`, `task not open`, etc.
- `getTask(uint256) / tasks(uint256)` — `(status, creator, modelId, commitment, result, verifiedAt, disputeStatus)`; `0=None,1=Created,2=Verified`.
- `raiseDispute(uint256 taskId, string reason)` and `resolveDispute(uint256 taskId)` — open a public challenge and re-run the stored proof; resolutions are `Open`, `Upheld` or `Overturned`.
- Events: `TaskCreated`, `ProofVerified`, `DisputeRaised`, `DisputeResolved` and `CalculationRecorded`. Credence reads these events for its on-chain audit timeline.
- Type: all ids/commitments are `uint256` field elements (not `bytes32`), matching the circuit's bn254 field.

ABI: `deployments/abi/VerityManager.json` (+ `deployments/abi.json` combined). Legacy `backend/src/config/abis/VerityVerifier.json` is an alias containing the same real ABI for backward compat with `blockchainService.test.ts`.

## Running everything locally

```powershell
# 1. Compile + all tests (contracts + backend)
npx hardhat compile
npx hardhat test            # 20 — real verifiers, disputes + example proofs
pushd backend
npx vitest run              # 80 (includes 69 baseline preserved + ZK-circuit tests)
npx vitest run tests/unit/zkRealProof.test.ts  # subset: generates a genuine proof
npm run build               # tsc -> backend/dist/
popd

# 2. Start local chain and deploy
npx hardhat node            # terminal A (port 8545)
npx hardhat run scripts/deploy.js --network localhost   # terminal B -> deployments/localhost.json
npx hardhat run scripts/export-abi.js                   # -> deployments/abi/*.json
npx hardhat run scripts/demo-localhost.js --network localhost
```

## Backend (Person 2)

Env file: `.env` sits at the repo root, not inside `backend/` (per portable path logic in `backend/src/config/index.ts`). The file at `backend/.env` is gitignored and never copied by deployment. Use **only placeholders** in version control:

```
# copy once
copy .env.example .env   # (or touch on Mac: cp .env.example .env)
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express port |
| `PROOF_MODE` | `mock` | `mock` (financial `5/3/2` formula + 2-signal keccak) or `real` (circuit-aware ZkCreditProofService) |
| `BLOCKCHAIN_MODE` | `mock` | `mock` (in-memory) or `real` (ethers NonceManager + `127.0.0.1:8545`) |
| `RPC_URL` | `http://127.0.0.1:8545` | Hardhat JSON-RPC |
| `PRIVATE_KEY` | `0xac09...` | Hardhat account #0 (funded) |
| `CONTRACT_ADDRESS` | `0x9fe4...` | VerityManager from `deployments/localhost.json` |
| `CONTRACT_ABI_PATH` | `deployments/abi/VerityManager.json` | real ABI |
| `CIRCUIT_WASM_PATH` | `build/credit_score_js/credit_score.wasm` | |
| `CIRCUIT_ZKEY_PATH` | `build/credit_score_final.zkey` | |
| `VERIFICATION_KEY_PATH` | `build/verification_key.json` | |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | | throttling |

Never commit real keys (`.gitignore` covers `.env` and `backend/.env`).

### Routes and modes

`GET  /api/health` — `{proofMode, blockchainMode, version}`
`POST /api/credit/score` — legacy formula, 300..1300, deterministic (preserved)
`POST /api/emi/calculate`, `POST /api/fraud/score`, `POST /api/settlements/calculate` — preserved financial engines

`POST /api/verification/submit` — body `{incomeIndex, repaymentIndex, historyIndex (0..100, int), salt?}` 
- `PROOF_MODE=mock`: `score = financial 5/3/2`; 2 signals; status `mock` (no ZK).
- `PROOF_MODE=real`: maps to circuit features, builds Poseidon commitment, calls `snarkjs.groth16.fullProve`, validates publicSignals, `createTask(taskId: uint256, modelId=1, commitment: uint256)` + `submitProof(taskId:a,b,c:publicSignals)` on-chain via `NonceManager` wallet. Status progression `pending → proof_generated → task_created → verified|failed` (or `mock` if BLOCKCHAIN_MODE=mock). Logs redact `incomeIndex/repaymentIndex/historyIndex/salt/pi_a/pi_b/pi_c`.

`GET  /api/verification/:taskId` — orchestrator record (or chain fallback). Private inputs never returned.

Platform handoff routes (real mode):

`POST /api/platform/tasks` — requester creates a model-bound task on-chain.
`POST /api/platform/tasks/:taskId/compute` — provider generates the proof privately.
`POST /api/platform/tasks/:taskId/submit` — verifier submits the provider proof to `VerityManager`.
`POST /api/platform/receipts` and `POST /api/platform/receipts/:receiptId/verify` — hash and verify non-ZK finance results as tamper-evident calculation receipts.

Dispute routes:

`GET /api/verification/audit/events` reads `TaskCreated`, `ProofVerified`,
`DisputeRaised` and `DisputeResolved` from the chain. `POST
/api/verification/:taskId/dispute` opens a challenge and `POST
/api/verification/:taskId/dispute/resolve` re-runs the stored proof.

The genuine Groth16 commitment is **not** the keccak commitment shown in `computeInputCommitment`; the former is `Poseidon([features, salt, taskId, 1])` constrained inside the circuit. The keccak helpers remain for legacy bookkeeping only. Do NOT accept client-supplied commitments or precomputed proofs as authoritative.

## Testing

- Backend (Person 2): `npx vitest run` in `backend/` — 80 passing (original 69 preserved: credit/emi/fraud/settlement/proofService/blockchainService/verificationOrchestrator/api, plus `zkCreditScoring` 7 and `zkRealProof` 4 genuine circuit tests).
- Chain: `npx hardhat test` — 19 passing against the real generated verifiers.
- Reports `PROOF_MODE=real + BLOCKCHAIN_MODE=real` as `verified` only after the Solidity `verifyProof` pairing returns `true` on the deployed `VerityManager`.
- Negative E2E (tested): tampered signal → `invalid proof` revert; commitment/taskId/signal-count mismatch → `commitment/taskId/bad signal count`; duplicate & nonexistent task → `task not open`.

## Handoff for Person 4 (frontend)

This repo is ready for the frontend. The target contract is **always** `deployments/abi/VerityManager.json` + `deployments/localhost.json` (or `sepolia.json` when deployed there). Chain id is 31337 on localhost (or 11155111 Sepolia / 97 BSC testnet when deployed publicly), confirmed by the deployment JSON actually written. `POST /api/verification/submit` → `GET /api/verification/:taskId` give you `score/modelVersion/taskId/commitment/status/transactions {taskCreationTx, proofSubmissionTx}/message` and the `TaskCreated`/`ProofVerified` on-chain events.

Trusted-setup caveat: `build/*_final.zkey` and `build/pot12_final.ptau` were created with documented demo entropy (`verity-local-demo-entropy`, etc.) — **hackathon-only, not production**.
