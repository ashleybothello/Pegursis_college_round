// End-to-end demo against a running Hardhat node (Person 3).
//
//   npx hardhat node                                        (terminal A)
//   npx hardhat run scripts/deploy.js --network localhost   (terminal B)
//   npx hardhat run scripts/demo-localhost.js --network localhost
//
// Creates task 42 (credit-score v1) from the shipped example proof, submits the
// real Groth16 proof, and prints the recorded task. This is also a working
// ethers v6 reference for the backend.

const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const { toSolidityProof } = require("../lib/proof-format");

async function main() {
  const root = path.resolve(__dirname, "..");
  const deployment = JSON.parse(
    fs.readFileSync(
      path.join(root, "deployments", `${hre.network.name}.json`),
      "utf8",
    ),
  );

  const manager = await hre.ethers.getContractAt(
    "VerityManager",
    deployment.contracts.verityManager,
  );
  console.log(`VerityManager @ ${await manager.getAddress()}`);

  const proof = JSON.parse(
    fs.readFileSync(path.join(root, "build", "proof.json"), "utf8"),
  );
  const publicSignals = JSON.parse(
    fs.readFileSync(path.join(root, "build", "public.json"), "utf8"),
  ); // [claimedScore, modelId, taskId, inputCommitment]

  const taskId = BigInt(publicSignals[2]);
  const modelId = BigInt(publicSignals[1]);
  const commitment = BigInt(publicSignals[3]);

  const before = await manager.getTask(taskId);
  if (before.status === 0n) {
    const tx = await manager.createTask(taskId, modelId, commitment);
    await tx.wait();
    console.log(`createTask(${taskId}) tx: ${tx.hash}`);
  } else {
    console.log(`task ${taskId} already exists (status ${before.status})`);
  }

  const { a, b, c } = toSolidityProof(proof);
  const tx = await manager.submitProof(taskId, a, b, c, publicSignals);
  const receipt = await tx.wait();
  console.log(`submitProof(${taskId}) tx: ${tx.hash} (gas ${receipt.gasUsed})`);

  const after = await manager.getTask(taskId);
  console.log("recorded task:", {
    status: after.status.toString(), // 2 == Verified
    creator: after.creator,
    modelId: after.modelId.toString(),
    commitment: after.commitment.toString(),
    result: after.result.toString(), // 755 == claimedScore
    verifiedAt: after.verifiedAt.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
