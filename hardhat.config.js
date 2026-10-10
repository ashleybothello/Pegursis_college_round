// Hardhat configuration for the Verity Finance contract layer (Person 2).
//
// This project shares its root with the Person 1 Circom/snarkjs package. It
// only adds the Solidity/Hardhat side; the circuit, scripts, and build
// artifacts under build/ are left untouched.
//
// Secrets are never stored here. Anything network-specific is read from a
// local, gitignored .env file (see HANDOFF-PERSON2.md).

require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

const { BSC_TESTNET_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Public testnet is wired up but NOT used until the target network and
    // credentials are confirmed. Provide the values in .env when ready.
    ...(BSC_TESTNET_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          bscTestnet: {
            url: BSC_TESTNET_RPC_URL,
            chainId: 97,
            accounts: [DEPLOYER_PRIVATE_KEY],
          },
        }
      : {}),
  },
};
