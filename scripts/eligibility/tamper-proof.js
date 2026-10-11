const fs = require("node:fs");
const path = require("node:path");
const snarkjs = require("snarkjs");

const root = path.resolve(__dirname, "..", "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

async function main() {
  const verificationKey = readJson("build/eligibility_verification_key.json");
  const proof = readJson("build/eligibility_proof.json");
  const publicSignals = readJson("build/eligibility_public.json");

  // Public signal order is [eligible, threshold, modelId, taskId, inputCommitment].
  const tamperedSignals = [...publicSignals];
  tamperedSignals[0] = BigInt(tamperedSignals[0]) === 1n ? "0" : "1";
  fs.writeFileSync(
    path.join(root, "build/eligibility_public_tampered.json"),
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

  console.log(`Honest eligibility verification: ${honestResult}`);
  console.log(`Tampered eligible signal: ${tamperedSignals[0]}`);
  console.log(`Tampered eligibility verification: ${tamperedResult}`);

  if (!honestResult || tamperedResult) {
    throw new Error("Tamper demonstration did not produce the expected results");
  }

  // snarkjs/ffjavascript keep WASM workers alive after verification, which
  // would otherwise hang the CLI. Exit explicitly once the demo is complete.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
