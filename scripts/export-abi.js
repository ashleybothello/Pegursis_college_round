// Export ABIs for the Person 3 handoff (Person 2).
//
// Reads the compiled artifacts and writes deployments/abi/<Name>.json plus a
// combined deployments/abi.json. Run after `npx hardhat compile`.

const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

const NAMES = [
  "VerityManager",
  "Groth16Verifier",
  "VerityEligibilityVerifier",
];

async function main() {
  const outDir = path.resolve(__dirname, "..", "deployments", "abi");
  fs.mkdirSync(outDir, { recursive: true });

  const combined = {};
  for (const name of NAMES) {
    const artifact = await hre.artifacts.readArtifact(name);
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      `${JSON.stringify(artifact.abi, null, 2)}\n`,
    );
    combined[name] = artifact.abi;
    console.log(`Wrote deployments/abi/${name}.json`);
  }

  fs.writeFileSync(
    path.resolve(__dirname, "..", "deployments", "abi.json"),
    `${JSON.stringify(combined, null, 2)}\n`,
  );
  console.log("Wrote deployments/abi.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
