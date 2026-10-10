# Eligibility circuit (Verity Finance model v2)

This is the privacy-preserving credit-eligibility proof. It is additive to the
base credit-score circuit owned by the other Person 1 work; it does not modify
`circuits/credit_score.circom`, `scripts/compile-circuit.js`,
`scripts/prepare-input.js`, `scripts/tamper-proof.js`, `input.json`, or
`package.json`.

## What it proves

- Private: `paymentHistory`, `incomeStability`, `debtHeadroom` in `[0, 100]`,
  plus `inputSalt`.
- Approved formula: `score = 300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom`.
- Public: `[eligible, threshold, modelId, taskId, inputCommitment]`.
- `eligible = 1` iff `score >= threshold`. `threshold` is constrained to the
  approved value (`700`) inside the circuit and `modelId` to `2`.
- The score itself is never revealed. A valid proof only tells a verifier
  "eligible or not" for the approved model.

## Files

- `circuits/eligibility.circom` — the circuit.
- `eligibility.input.json` — sample private input and public signals.
- `scripts/eligibility/compile.js` — compiles to `build/eligibility.r1cs`,
  `build/eligibility.sym`, `build/eligibility_js/eligibility.wasm`.
- `scripts/eligibility/prepare-input.js` — computes the Poseidon `inputCommitment`.
- `scripts/eligibility/tamper-proof.js` — honest vs tampered verification.

## Run order

Run from the project root (`C:\Users\Tanish\bnb`).

### 1. Compile

```powershell
node scripts/eligibility/compile.js
npx snarkjs r1cs info build/eligibility.r1cs
```

### 2. Groth16 setup

Fast path using the existing local ptau (fine for the demo, but the toxic waste
is known because the entropy is documented):

```powershell
npx snarkjs groth16 setup build/eligibility.r1cs build/pot12_final.ptau build/eligibility_0000.zkey
npx snarkjs zkey contribute build/eligibility_0000.zkey build/eligibility_final.zkey --name=VerityEligibility -e=verity-eligibility-demo-entropy
npx snarkjs zkey verify build/eligibility.r1cs build/pot12_final.ptau build/eligibility_final.zkey
```

Credible path (recommended before judging): download the Hermez Perpetual
Powers of Tau file and use it instead of the local one.

```powershell
# https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau
npx snarkjs groth16 setup build/eligibility.r1cs powersOfTau28_hez_final_12.ptau build/eligibility_0000.zkey
npx snarkjs zkey contribute build/eligibility_0000.zkey build/eligibility_final.zkey --name=VerityEligibility -e=verity-eligibility-demo-entropy
```

### 3. Export verification key and Solidity verifier

```powershell
npx snarkjs zkey export verificationkey build/eligibility_final.zkey build/eligibility_verification_key.json
npx snarkjs zkey export solidityverifier build/eligibility_final.zkey contracts/VerityEligibilityVerifier.sol
```

The generated verifier exposes
`verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[5] input)` and returns
`bool`. The five public inputs, in order, are
`[eligible, threshold, modelId, taskId, inputCommitment]`.

### 4. Generate and verify a genuine proof

```powershell
node scripts/eligibility/prepare-input.js
npx snarkjs groth16 fullprove eligibility.input.json build/eligibility_js/eligibility.wasm build/eligibility_final.zkey build/eligibility_proof.json build/eligibility_public.json
npx snarkjs groth16 verify build/eligibility_verification_key.json build/eligibility_public.json build/eligibility_proof.json
```

### 5. Prove that tampering fails

```powershell
node scripts/eligibility/tamper-proof.js
```

Expected output:

```text
Honest eligibility verification: true
Tampered eligible signal: 0
Tampered eligibility verification: false
```

### 6. ABI-ready calldata for the contract

```powershell
npx snarkjs zkey export soliditycalldata build/eligibility_public.json build/eligibility_proof.json
```

## Notes for Persons 2 and 3

- Model routing: this circuit is `modelId == 2`. Keep the base score circuit on
  `modelId == 1` and route each to its own generated verifier.
- The `b` coordinates need the snarkjs-to-Solidity swap:
  `b = [[pi_b[0][1], pi_b[0][0]], [pi_b[1][1], pi_b[1][0]]]`.
- The backend must always recompute `inputCommitment` from the private inputs;
  never accept a client-supplied commitment.
- Do not log the private features or the salt.
- Dedupe on `taskId`, never on the proof (Groth16 proofs are malleable).
- The exported Solidity contract name was changed from the snarkjs default
  `Groth16Verifier` to `VerityEligibilityVerifier` in
  `contracts/VerityEligibilityVerifier.sol` so it does not clash with the base
  credit-score verifier in the same Hardhat project. Re-running step 3
  overwrites that file, so re-apply the rename (or wrap the contract) afterward.
- A working demo proof set already exists in `build/`:
  `eligibility_proof.json`, `eligibility_public.json`,
  `eligibility_verification_key.json` (public signals
  `[1, 700, 2, 77, <commitment>]`).
