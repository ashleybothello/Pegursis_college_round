const fs = require("node:fs");
const path = require("node:path");
const { buildPoseidon } = require("circomlibjs");

const root = path.resolve(__dirname, "..");

async function main() {
  const inputPath = path.join(root, "input.json");
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const poseidon = await buildPoseidon();
  const field = poseidon.F;
  const commitment = poseidon([
    BigInt(input.paymentHistory),
    BigInt(input.incomeStability),
    BigInt(input.debtHeadroom),
    BigInt(input.inputSalt),
    BigInt(input.taskId),
    BigInt(input.modelId),
  ]);

  input.inputCommitment = field.toString(commitment);
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Computed inputCommitment: ${input.inputCommitment}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
