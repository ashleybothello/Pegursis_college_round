const fs = require("node:fs");
const path = require("node:path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const root = path.resolve(__dirname, "..");
const wasmPath = path.join(root, "build", "eligibility_js", "eligibility.wasm");
const zkeyPath = path.join(root, "build", "eligibility_final.zkey");
const verificationKeyPath = path.join(
  root,
  "build",
  "eligibility_verification_key.json",
);

// Eligibility circuit (modelId == 2). The published signals are
// [eligible, threshold, modelId, taskId, inputCommitment]; the score is private.
const MODEL_ID = "2";
const APPROVED_THRESHOLD = "700";

let poseidonPromise;
function getPoseidon() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

function calculateScore({ paymentHistory, incomeStability, debtHeadroom }) {
  return (
    300 +
    3 * Number(paymentHistory) +
    2 * Number(incomeStability) +
    Number(debtHeadroom)
  ).toString();
}

function calculateEligible({
  paymentHistory,
  incomeStability,
  debtHeadroom,
  threshold = APPROVED_THRESHOLD,
}) {
  const score = Number(
    calculateScore({ paymentHistory, incomeStability, debtHeadroom }),
  );
  return score >= Number(threshold) ? "1" : "0";
}

async function calculateInputCommitment({
  paymentHistory,
  incomeStability,
  debtHeadroom,
  inputSalt,
  threshold = APPROVED_THRESHOLD,
  taskId,
  modelId = MODEL_ID,
}) {
  const poseidon = await getPoseidon();
  const commitment = poseidon([
    BigInt(paymentHistory),
    BigInt(incomeStability),
    BigInt(debtHeadroom),
    BigInt(inputSalt),
    BigInt(threshold),
    BigInt(modelId),
    BigInt(taskId),
  ]);
  return poseidon.F.toString(commitment);
}

async function generateEligibilityProof({
  paymentHistory,
  incomeStability,
  debtHeadroom,
  inputSalt,
  taskId,
  threshold = APPROVED_THRESHOLD,
  modelId = MODEL_ID,
}) {
  const eligible = calculateEligible({
    paymentHistory,
    incomeStability,
    debtHeadroom,
    threshold,
  });
  const input = {
    paymentHistory: String(paymentHistory),
    incomeStability: String(incomeStability),
    debtHeadroom: String(debtHeadroom),
    inputSalt: String(inputSalt),
    eligible,
    threshold: String(threshold),
    modelId: String(modelId),
    taskId: String(taskId),
  };
  input.inputCommitment = await calculateInputCommitment(input);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );

  // publicSignals === [eligible, threshold, modelId, taskId, inputCommitment]
  return { proof, publicSignals, input };
}

async function verifyEligibilityProof({ proof, publicSignals }) {
  const verificationKey = JSON.parse(
    fs.readFileSync(verificationKeyPath, "utf8"),
  );
  return snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}

module.exports = {
  calculateScore,
  calculateEligible,
  calculateInputCommitment,
  generateEligibilityProof,
  verifyEligibilityProof,
};

// Self-test: `node lib/eligibility-prover.js`
if (require.main === module) {
  (async () => {
    const result = await generateEligibilityProof({
      paymentHistory: "82",
      incomeStability: "74",
      debtHeadroom: "61",
      inputSalt: "1234567890123456789012345678901234567890",
      taskId: "77",
    });
    const verified = await verifyEligibilityProof(result);
    console.log("publicSignals:", result.publicSignals);
    console.log("verify:", verified);
    // snarkjs keeps WASM workers alive; exit explicitly.
    process.exit(verified ? 0 : 1);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
