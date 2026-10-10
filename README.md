# Verity Finance

Verity Finance is a privacy-preserving financial computation verification
platform. Financial institutions increasingly outsource computations such as
credit scoring, loan assessment, fraud-risk scoring, and payment settlement.
Verity Finance lets a verifier confirm that such a computation followed an
approved set of rules **without** needing access to the underlying sensitive
financial data, by combining zero-knowledge proofs with blockchain-based
auditability.

The current implementation proves a fixed, approved credit-scoring formula.
A genuine Groth16 proof is generated off-chain and can be verified off-chain or
on-chain by a generated Solidity verifier; a verifier smart contract can record
the outcome as an auditable event.

> Status in one line: the zero-knowledge proof step is implemented and tested.
> The blockchain, backend, and frontend integration steps are not yet built.

## Architecture

Intended end-to-end flow:

```text
Private financial inputs
        │  (never leave the prover/backend trust boundary)
        ▼
Backend proof generation            — snarkjs Groth16 over the Circom circuit
        ▼
Groth16 proof + public signals
        ▼
Off-chain verification              — snarkjs groth16.verify(...)
        ▼
Smart-contract verification         — generated verifier called by VerityManager
        ▼
Audit record                        — taskId, modelId, commitment, outcome, event
        ▼
Frontend status display             — score, model version, verification status
```

### Implemented vs. awaiting integration

| Component | State |
| --- | --- |
| Circom credit-scoring circuit and constraints | **Implemented** |
| Groth16 trusted setup (local demo) and proving key | **Implemented** |
| Off-chain proof generation + verification | **Implemented** |
| Tamper test (altered public output fails) | **Implemented** |
| Exported Solidity verifier | **Exported** (not yet compiled/deployed as a Hardhat project) |
| `VerityManager` smart contract | **Not started** |
| Backend proof-generation/verification API | **Not started** |
| Frontend dashboard | **Not started** |
| On-chain verification of a proof | **Not done** — requires Persons 2–4 |

## Person 1 — ZK Proof Engineer

Responsibilities:

- Maintain the Circom credit-scoring circuit (`circuits/credit_score.circom`)
  and its constraints.
- Maintain proof generation, off-chain verification, and tamper tests.
- Export and document the Solidity verifier.
- Keep the model configuration (`model-config.json`) and public-signal ordering
  synchronized across Circom, snarkjs, Solidity, and the backend.
- Support integration debugging.
- Deliver the verifier, the proving/verification artifacts, and `HANDOFF.md`.

### Approved model (v1)

```text
score = 300 + 3*paymentHistory + 2*incomeStability + debtHeadroom
```

- Private inputs: `paymentHistory`, `incomeStability`, `debtHeadroom` — integers
  in `[0, 100]` — plus `inputSalt`.
- Public inputs (exact order):
  `[claimedScore, modelId, taskId, inputCommitment]`.
- `modelId` is constrained to `1` inside the circuit.
- `inputCommitment` is a Poseidon hash over the ordered values documented in
  `HANDOFF.md`:
  `Poseidon(paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId)`.

Worked example:

```text
paymentHistory   = 82
incomeStability  = 74
debtHeadroom     = 61
claimedScore     = 300 + 3*82 + 2*74 + 61 = 755
modelId          = 1
taskId           = 42
```

### Reproducing the proof

Install dependencies and check the tools:

```powershell
npm install
npx circom2 --version
npx snarkjs --version
```

Compile the circuit (writes `build/credit_score.r1cs`,
`build/credit_score.sym`, and `build/credit_score_js/credit_score.wasm`):

```powershell
npm run compile
npx snarkjs r1cs info build/credit_score.r1cs
```

The committed `build/credit_score_final.zkey` and
`build/verification_key.json` already come from a Groth16 setup, so the ceremony
does not need to be repeated to prove or verify. To regenerate it locally:

```powershell
npm run ptau:new
npm run ptau:contribute
npm run ptau:prepare
npm run setup
npm run zkey:contribute
npm run zkey:verify
```

> The local ceremony uses documented, single-contributor entropy. It is a demo
> setup only and is **not** a production-grade multiparty ceremony.

Generate and verify a proof:

```powershell
npm run prove           # witness + Groth16 proof -> build/proof.json, build/public.json
npm run witness:check   # confirm the witness satisfies the R1CS constraints
npm run verify          # off-chain verification
```

Export the verification key and the Solidity verifier:

```powershell
npm run export          # -> build/verification_key.json, contracts/VerityCreditScoreVerifier.sol
npm run calldata        # prints ABI-ready calldata for the example proof
```

Demonstrate that tampering fails:

```powershell
npm run tamper
```

Expected output:

```text
Honest proof verification: true
Tampered claimedScore: 756
Tampered proof verification: false
```

### Person 1 artifacts

| Path | Purpose |
| --- | --- |
| `circuits/credit_score.circom` | Circuit and constraints |
| `lib/credit-score-prover.js` | Prove/verify helper for the backend |
| `model-config.json` | Model id, weights, signal ordering |
| `contracts/VerityCreditScoreVerifier.sol` | Generated Solidity verifier |
| `build/credit_score_final.zkey` | Groth16 proving key |
| `build/verification_key.json` | Verification key |
| `build/credit_score_js/credit_score.wasm` | Witness calculator |
| `build/proof.json` | Example Groth16 proof |
| `build/public.json` | Matching public signals |
| `HANDOFF.md` | Integration notes for Persons 2 and 3 |

## Person 2 — Blockchain Engineer

- Set up and maintain Hardhat.
- Deploy or integrate `contracts/VerityCreditScoreVerifier.sol`.
- Implement or update `VerityManager.sol` so it calls the genuine verifier
  (never a mock).
- Reject invalid proofs and duplicate task submissions.
- Validate the approved model ID and the expected public inputs.
- Record the task id, model id, input commitment, claimed score, and
  verification outcome as appropriate.
- Emit an audit event for each successful submission.
- Share the deployed contract address, ABI, network details, and verification
  test results with Persons 3 and 4.

Do **not** store private financial inputs on-chain. The contracts should only
ever see a proof and public signals.

## Person 3 — Backend Engineer

- Integrate `lib/credit-score-prover.js`.
- Implement the proof-generation and verification API endpoints.
- Validate inputs and calculate the commitment **server-side** from the approved
  private inputs.
- Return the proof, public signals, and verification status in a consistent
  format.
- Integrate the blockchain contract using Person 2's ABI and address.
- Keep private inputs out of public responses and never log sensitive data.
- Document endpoints, request/response examples, environment variables, and
  errors.
- Coordinate the API response contract with Person 4.

Never accept a client-supplied commitment as authoritative.

## Person 4 — Frontend Engineer

- Build the credit-scoring demonstration interface.
- Connect it to the backend APIs.
- Show proof-generation progress, claimed score, model version, and verification
  status.
- Clearly distinguish off-chain verification from on-chain verification.
- Display transaction hashes and audit history when available.
- Provide a clear failed-verification state for tampered or invalid proofs.
- Avoid displaying private inputs in public audit views and never expose secrets
  in frontend code.

## Shared integration contract

Public-signal order, exact and mandatory:

```text
[claimedScore, modelId, taskId, inputCommitment]
```

- Use the generated verifier's **actual** ABI and signature; do not guess them.
  The generated contract is named `Groth16Verifier` inside
  `contracts/VerityCreditScoreVerifier.sol` and exposes:
  `verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[4] input) returns (bool)`.
- When passing proof data from snarkjs to Solidity, apply the coordinate swap:

  ```js
  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ];
  const c = [proof.pi_c[0], proof.pi_c[1]];
  const input = publicSignals; // [claimedScore, modelId, taskId, inputCommitment]
  ```

- The backend must recompute `inputCommitment` from the private inputs; the
  contract must reject a proof whose `modelId` is not approved and whose public
  values do not match the task.

## Current status

Do not mark an item complete without repository or test evidence.

- [x] **Person 1 — local proof tests.** Circuit compiles (402 non-linear
      constraints, 4 public / 4 private inputs), witness check passes, proof
      verifies off-chain, and the tamper test returns `true` then `false`.
      Verified in this release.
- [ ] **Person 2 — contract deployment and on-chain proof verification.** Not
      started. Requires a Hardhat project and `VerityManager`.
- [ ] **Person 3 — backend integration.** Not started.
- [ ] **Person 4 — frontend integration.** Not started.
- [ ] **Full end-to-end demo.** Not started (depends on the three items above).

Latest locally re-run results (Person 1):

```text
compile        : 402 non-linear constraints, 4 public inputs, 4 private inputs
witness:check  : WITNESS IS CORRECT
verify         : OK!
tamper         : Honest = true, Tampered (claimedScore 756) = false
```

## Security limitations

- A zero-knowledge proof establishes that the **encoded computation** was
  performed correctly for the supplied inputs and that the published public
  values are consistent with it. It does **not** prove that the original
  financial data is truthful, that the formula is fair, or that the system is
  production-ready.
- The score formula is a demonstrator, not a validated credit-scoring model.
- The demo trusted setup was produced locally with documented entropy. It is
  **not** equivalent to a production-grade multiparty ceremony; a real
  deployment needs a documented multi-party ceremony and a pinned final zkey.
- Do not use the demo keys or setup for real funds or a public financial
  deployment.
- On-chain verification of a proof has not yet been performed; until Person 2
  completes and tests `VerityManager`, treat on-chain status as pending.
