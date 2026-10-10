const fs = require("node:fs");
const path = require("node:path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const root = path.resolve(__dirname, "..");
const wasmPath = path.join(root, "build", "credit_score_js", "credit_score.wasm");
const zkeyPath = path.join(root, "build", "credit_score_final.zkey");
const verificationKeyPath = path.join(root, "build", "verification_key.json");
const MODEL_ID = "1";

let poseidonPromise;
function getPoseidon() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

function calculateCreditScore({ paymentHistory, incomeStability, debtHeadroom }) {
  return (
    300 +
    3 * Number(paymentHistory) +
    2 * Number(incomeStability) +
    Number(debtHeadroom)
  ).toString();
}

async function calculateInputCommitment({
  paymentHistory,
  incomeStability,
  debtHeadroom,
  inputSalt,
  taskId,
  modelId = MODEL_ID,
}) {
  const poseidon = await getPoseidon();
  const commitment = poseidon([
    BigInt(paymentHistory),
    BigInt(incomeStability),
    BigInt(debtHeadroom),
    BigInt(inputSalt),
    BigInt(taskId),
    BigInt(modelId),
  ]);
  return poseidon.F.toString(commitment);
}

async function generateCreditScoreProof({
  paymentHistory,
  incomeStability,
  debtHeadroom,
  inputSalt,
  taskId,
  claimedScore = calculateCreditScore({
    paymentHistory,
    incomeStability,
    debtHeadroom,
  }),
  modelId = MODEL_ID,
}) {
  const input = {
    paymentHistory: String(paymentHistory),
    incomeStability: String(incomeStability),
    debtHeadroom: String(debtHeadroom),
    inputSalt: String(inputSalt),
    claimedScore: String(claimedScore),
    modelId: String(modelId),
    taskId: String(taskId),
  };
  input.inputCommitment = await calculateInputCommitment(input);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );

  return { proof, publicSignals, input };
}

async function verifyCreditScoreProof({ proof, publicSignals }) {
  const verificationKey = JSON.parse(
    fs.readFileSync(verificationKeyPath, "utf8"),
  );
  return snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}

module.exports = {
  calculateCreditScore,
  calculateInputCommitment,
  generateCreditScoreProof,
  verifyCreditScoreProof,
};
