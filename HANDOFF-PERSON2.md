# Person 2 handoff — `VerityManager` + verifiers

Audience: **Person 3 (backend)** and **Person 4 (frontend)**. This is the contract API you need to integrate; nothing below is guessed.

## 0. Terminology

**This demo model is not a trained AI system.** The formula is a small, fixed arithmetic expression (`300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom` for model v1). The proofs attest only that the arithmetic was computed correctly under the circuit's constraints, given the committed inputs. They do not attest that the underlying financial data is truthful, or that the model is fair/accurate.

## 1. Actual credit-score model (source of truth)

The shipped circuit is authoritative. The brief's textual formula was inaccurate.

```text
credit-score v1 (modelId == 1):
  score = 300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom
  private: paymentHistory, incomeStability, debtHeadroom in [0,100], inputSalt
  public : [claimedScore, modelId, taskId, inputCommitment]
  Poseidon(6) commitment over: [paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]

eligibility v2 (modelId == 2):
  score as above (private)
  eligible = 1 if score >= threshold else 0
  public : [eligible, threshold, modelId, taskId, inputCommitment]  (5)
  Poseidon(7) commitment over: [paymentHistory, incomeStability, debtHeadroom, inputSalt, threshold, modelId, taskId]
  threshold == 700 and modelId == 2 are circuit constants
```

`model-config.json` / `model-config.eligibility.json` at the repo root mirror these constants. Keep them synchronized; the commitment order shown above is exact.

## 2. Deployed addresses

### `hardhat` / `localhost` (chainId 31337) — local demo

From `deployments/localhost.json` (created by `scripts/deploy.js` against a running node):

```json
{
  "network": "localhost",
  "chainId": 31337,
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "contracts": {
    "creditScoreVerifier": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "eligibilityVerifier": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "verityManager": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  }
}
```

### Public testnet

Not yet deployed. Set in the project-local, gitignored `.env`:

```
BSC_TESTNET_RPC_URL="https://..."
DEPLOYER_PRIVATE_KEY="0x..."   # throwaway deployer key only
```

then `npx hardhat run scripts/deploy.js --network bscTestnet` (the config wires `chainId: 97`). Pass the output JSON to the frontend.

## 3. Artifacts and ABI

- Compiled artifacts: `artifacts/contracts/{VerityManager,Groth16Verifier,VerityEligibilityVerifier}.sol/*.json`.
- Machine-readable ABIs for direct import: `deployments/abi/VerityManager.json` (ABI array), plus `deployments/abi.json` (keyed object). Produced by `npx hardhat run scripts/export-abi.js --network <name>`.
- Verifier contract names for tooling: `Groth16Verifier` (file `VerityCreditScoreVerifier.sol`, model v1) and `VerityEligibilityVerifier` (file `VerityEligibilityVerifier.sol`, model v2).

## 4. Confirmed Solidity signatures

```solidity
constructor(address creditScoreVerifier, address eligibilityVerifier)

function createTask(uint256 taskId, uint256 modelId, uint256 commitment) external
function submitProof(
    uint256 taskId,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[] calldata publicSignals
) external
function getTask(uint256 taskId) external view returns (Task memory)
  // Task { TaskStatus status; address creator; uint256 modelId; uint256 commitment; uint256 result; uint256 verifiedAt; }
mapping(uint256 => Task) public tasks // auto-getter: tasks(taskId) -> (status, creator, modelId, commitment, result, verifiedAt)

enum TaskStatus { None = 0, Created = 1, Verified = 2 }
uint256 public constant CREDIT_SCORE_MODEL_ID = 1;
uint256 public constant ELIGIBILITY_MODEL_ID = 2;
uint256 public constant APPROVED_THRESHOLD = 700;
```

`taskId`, `modelId`, and `commitment` are **field-element integers** (`uint256`), matching the circuit's public input domain. Do not use `bytes32`.

## 5. Events (ABI-stable)

```solidity
event TaskCreated(
    uint256 indexed taskId,
    address indexed creator,
    uint256 modelId,
    uint256 commitment
);
event ProofVerified(
    uint256 indexed taskId,
    uint256 modelId,
    uint256 result,       // claimedScore for v1, eligible (0/1) for v2
    uint256 commitment
);
```

Indexing: `taskId`, `creator` are indexed for efficient frontend/backend filtering.

## 6. Public-signal ordering (byte-exact for each model)

| model | `publicSignals` argument (index → meaning) |
|-------|---------------------------------------------|
| v1 (`modelId = 1`) | `[0] claimedScore, [1] modelId (=1), [2] taskId, [3] inputCommitment` |
| v2 (`modelId = 2`) | `[0] eligible (0/1), [1] threshold (=700), [2] modelId (=2), [3] taskId, [4] inputCommitment` |

Before verification the manager enforces:

- `s.length == 4` for v1, `== 5` for v2.
- `s[model-idx] == task.modelId` and equals the model's constant.
- `s[task-idx] == taskId` and `s[commitment-idx] == task.commitment`.
- For v2 additionally `s[1] == 700` (mirrors the circuit constant).

Private-input binding (that the commitment actually commits to the private features) is enforced **inside the circuit**, not by this contract — the contract only checks that the committed public signal equals the stored commitment.

## 7. Commitment encoding

- Hash function: **Poseidon** (BN254 field via `circomlibjs`), not Keccak/BouncyHash. The contract never hashes.
- Ordering (see section 1). For v1, the single backend call `circomlibjs.buildPoseidon().F.toString(poseidon([paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]))` produces the `inputCommitment` public signal. For v2 the extra `threshold` entry precedes `modelId` and `taskId` is last.
- All values are passed as `BigInt`s; the result is a field element serialized as a decimal string (examples: `61834...0576`, `16029...16067`). The backend must recompute the commitment from the private inputs it owns; it must **never** accept a client-supplied commitment as authoritative and must never log the private features or salt. Do not replace the value with a hash from a different function — the proof will fail.

## 8. Task-status semantics

| status | value | meaning |
|--------|-------|---------|
| `None` | 0 | task does not exist (default mapping value) |
| `Created` | 1 | `createTask` succeeded; proof may be submitted |
| `Verified` | 2 | Groth16 verifier returned `true`; `result` and `verifiedAt` populated |

Any `submitProof` failure **reverts** and leaves the status unchanged. There is no `Rejected` state — a failed submission is not recorded. Duplicate submissions for an already `Verified` task revert with `"task not open"`.

## 9. Proof conversion (snarkjs → Solidity)

`lib/proof-format.js` exists specifically for this step:

```js
const { toSolidityProof } = require("./lib/proof-format");
const { a, b, c } = toSolidityProof(proofJson);
// b is already swapped inside the helper:
 // b = [[pi_b[0][1], pi_b[0][0]], [pi_b[1][1], pi_b[1][0]]]

await manager.submitProof(taskId, a, b, c, publicSignals);
```

Equivalently, by hand for a `proof.json`:

```js
const a = [proof.pi_a[0], proof.pi_a[1]];
const b = [
  [proof.pi_b[0][1], proof.pi_b[0][0]],
  [proof.pi_b[1][1], proof.pi_b[1][0]],
];
const c = [proof.pi_c[0], proof.pi_c[1]];
const input = publicSignals; // [claimedScore, ...] as above
await verifier.verifyProof(a, b, c, input); // direct verifier call
```

`snarkjs groth16 fullProve(input, credit_score.wasm, zkey)` returns `{ proof, publicSignals }`. The demo `lib/credit-score-prover.js` and `lib/eligibility-prover.js` show the full flow including commitment calculation.

## 10. Backend — complete ethers v6 examples

### Setup

```js
const { ethers } = require("ethers");
const { toSolidityProof } = require("./lib/proof-format");
const managerAbi = require("./deployments/abi/VerityManager.json");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const manager = new ethers.Contract(VERITY_MANAGER_ADDRESS, managerAbi, signer);
```

### Credit-score v1 round trip

```js
const proof = JSON.parse(fs.readFileSync("build/proof.json", "utf8"));
const publicSignals = JSON.parse(fs.readFileSync("build/public.json", "utf8"));
const taskId = 42n;
const modelId = 1n;
const commitment = BigInt(publicSignals[3]); // inputCommitment

// 1. Register the task
await (await manager.createTask(taskId, modelId, commitment)).wait();

// 2. Submit the proof (caller or provider can do this; permissionless)
const { a, b, c } = toSolidityProof(proof);
await (await manager.submitProof(taskId, a, b, c, publicSignals)).wait();

// 3. Read back
const task = await manager.getTask(taskId);
console.log(task.status, task.result); // 2, 755n
```

### Eligibility v2 round trip

```js
const proof = JSON.parse(fs.readFileSync("build/eligibility_proof.json", "utf8"));
const publicSignals = JSON.parse(fs.readFileSync("build/eligibility_public.json", "utf8"));
const taskId = 77n, modelId = 2n, commitment = BigInt(publicSignals[4]);

await (await manager.createTask(taskId, modelId, commitment)).wait();
const { a, b, c } = toSolidityProof(proof);
await (await manager.submitProof(taskId, a, b, c, publicSignals)).wait();

const task = await manager.getTask(77);
console.log(task.result); // 1n == eligible
```

Duplicate prevention: a second `createTask` for the same `taskId` reverts with `"task exists"`.

### Generating a fresh proof (backend-owned flow)

See `lib/credit-score-prover.js` / `lib/eligibility-prover.js`:

```js
const { generateCreditScoreProof, verifyCreditScoreProof } = require("./lib/credit-score-prover");

const { proof, publicSignals } = await generateCreditScoreProof({
  paymentHistory: "82",
  incomeStability: "74",
  debtHeadroom: "61",
  inputSalt: "987654321", // random per task in production; never log it
  taskId: "42",
});
await verifyCreditScoreProof({ proof, publicSignals });
```

## 11. Commands to compile, test, and deploy

```powershell
# deps (once)
npm install

# compile contracts only
npx hardhat compile

# tests (19, against the real verifiers + example proofs)
npx hardhat test

# off-chain circuit checks
npm run witness:check
npm run verify
npm run tamper

# local deploy (two terminals)
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/demo-localhost.js --network localhost  # end-to-end smoke test

# export ABIs
npx hardhat run scripts/export-abi.js --network localhost

# public testnet (only after the RPC and deployer key are provided in .env)
npx hardhat run scripts/deploy.js --network bscTestnet
```

## 12. Security & demo limitations (read carefully)

- **Never store** `paymentHistory`, `incomeStability`, `debtHeadroom`, or `inputSalt` on-chain; only the Poseidon commitment, score/eligible bit, and model id are public.
- A result is recorded as `Verified` **only** when the genuine verifier returns `true`; revert otherwise. No admin bypass.
- The commitment binding is **circuit-enforced**. Passing a commitment to `createTask` without a matching proof is not enough to mark it verified.
- Groth16 proofs are **malleable**; dedupe on `taskId`, never on the proof bytes.
- The shipped trusted setup (`build/*_final.zkey`, `build/pot12_final.ptau`) uses documented demo entropy (`verity-local-demo-entropy`, etc.). It is suitable for a hackathon demo only and must not back a production financial deployment.

## 13. Integration contract for Persons 3 and 4

- You need exactly the artifacts listed in sections 2–5 — no other handshake is required. The manager's `TaskCreated` / `ProofVerified` events are the integration surface for the backend/frontend status display.
- The contract works on any chain where it is deployed; the verifier logic is on-chain and chain-agnostic. Pass the deployed address for the chosen network.


---

*Note: run `npm run calldata` to obtain the exact ABI call arguments for the example proof on any verifier.*
