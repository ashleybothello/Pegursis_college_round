// Deploy the Verity Finance contract layer (Person 2).
//
// Deploys the two genuine generated Groth16 verifiers, then VerityManager with
// their addresses injected. Writes deployments/<network>.json for the handoff.
//
// Local demo:
//   npx hardhat node                              (terminal A)
//   npx hardhat run scripts/deploy.js --network localhost   (terminal B)
//
// In-process (ephemeral, addresses are not reusable after the process exits):
//   npx hardhat run scripts/deploy.js

const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function deploy(name, ...args) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${name.padEnd(28)} ${address}${args.length ? `  <- ${args.join(", ")}` : ""}`);
  return { contract, address };
}

async function main() {
  const net = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Network : ${hre.network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  try {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Balance : ${hre.ethers.formatEther(balance)} ETH`);
  } catch (_) {
    // provider balance may be unavailable on some non-EVM setups; non-fatal.
  }
  console.log("");

  const credit = await deploy("Groth16Verifier");
  const elig = await deploy("VerityEligibilityVerifier");
  const manager = await deploy("VerityManager", credit.address, elig.address);

  const record = {
    network: hre.network.name,
    chainId: Number(net.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      creditScoreVerifier: credit.address, // modelId 1
      eligibilityVerifier: elig.address, // modelId 2
      verityManager: manager.address,
    },
  };

  const outDir = path.resolve(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nWrote deployments/${hre.network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
