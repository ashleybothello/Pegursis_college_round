const fs = require("node:fs");
const path = require("node:path");
const { buildPoseidon } = require("circomlibjs");

const root = path.resolve(__dirname, "..", "..");
const inputPath = path.join(root, "eligibility.input.json");

async function main() {
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const poseidon = await buildPoseidon();
  const field = poseidon.F;

  // Must match circuits/eligibility.circom exactly:
  // Poseidon(paymentHistory, incomeStability, debtHeadroom, inputSalt,
  //          threshold, modelId, taskId)
  const commitment = poseidon([
    BigInt(input.paymentHistory),
    BigInt(input.incomeStability),
    BigInt(input.debtHeadroom),
    BigInt(input.inputSalt),
    BigInt(input.threshold),
    BigInt(input.modelId),
    BigInt(input.taskId),
  ]);

  input.inputCommitment = field.toString(commitment);
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);

  const score =
    300 +
    3 * Number(input.paymentHistory) +
    2 * Number(input.incomeStability) +
    1 * Number(input.debtHeadroom);
  const expectedEligible = score >= Number(input.threshold) ? 1 : 0;

  console.log(`Computed eligibility inputCommitment: ${input.inputCommitment}`);
  console.log(`Private score (do not publish): ${score}`);
  console.log(`Expected eligible: ${expectedEligible}`);
  if (String(expectedEligible) !== String(input.eligible)) {
    throw new Error(
      `eligible in eligibility.input.json is ${input.eligible} but the approved formula gives ${expectedEligible}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
