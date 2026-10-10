const fs = require("node:fs");
const path = require("node:path");
const snarkjs = require("snarkjs");

const root = path.resolve(__dirname, "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

async function main() {
  const verificationKey = readJson("build/verification_key.json");
  const proof = readJson("build/proof.json");
  const publicSignals = readJson("build/public.json");
  const tamperedSignals = [...publicSignals];

  // Public signal order is [claimedScore, modelId, taskId, inputCommitment].
  tamperedSignals[0] = (BigInt(tamperedSignals[0]) + 1n).toString();
  fs.writeFileSync(
    path.join(root, "build/public_tampered.json"),
    `${JSON.stringify(tamperedSignals, null, 2)}\n`,
  );

  const honestResult = await snarkjs.groth16.verify(
    verificationKey,
    publicSignals,
    proof,
  );
  const tamperedResult = await snarkjs.groth16.verify(
    verificationKey,
    tamperedSignals,
    proof,
  );

  console.log(`Honest proof verification: ${honestResult}`);
  console.log(`Tampered claimedScore: ${tamperedSignals[0]}`);
  console.log(`Tampered proof verification: ${tamperedResult}`);

  if (!honestResult || tamperedResult) {
    throw new Error("Tamper demonstration did not produce the expected results");
  }

  // snarkjs may leave a worker handle alive after verification on some Node
  // versions. Exit explicitly once both checks have completed.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
