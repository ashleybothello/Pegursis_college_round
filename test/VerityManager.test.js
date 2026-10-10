// VerityManager tests (Person 2).
//
// These tests use the REAL generated Groth16 verifiers
// (contracts/VerityCreditScoreVerifier.sol -> Groth16Verifier,
//  contracts/VerityEligibilityVerifier.sol -> VerityEligibilityVerifier)
// together with the shipped example proofs in build/. They are genuine
// cryptographic-verification tests, not mock-verifier tests.
//
// The only unverified path is deployment to a public network, which requires
// the target network and credentials to be confirmed by the project owner.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const { toSolidityProof } = require("../lib/proof-format");

const root = path.resolve(__dirname, "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

// Shipped, verified artifacts (see README/HANDOFF).
const creditProof = readJson("build/proof.json");
const creditPublic = readJson("build/public.json"); // [claimedScore, modelId, taskId, inputCommitment]
const eligProof = readJson("build/eligibility_proof.json");
const eligPublic = readJson("build/eligibility_public.json"); // [eligible, threshold, modelId, taskId, inputCommitment]

const CREDIT_TASK_ID = 42n;
const CREDIT_MODEL_ID = 1n;
const CREDIT_COMMITMENT = BigInt(creditPublic[3]);
const CREDIT_SCORE = BigInt(creditPublic[0]);

const ELIG_TASK_ID = 77n;
const ELIG_MODEL_ID = 2n;
const ELIG_COMMITMENT = BigInt(eligPublic[4]);
const ELIG_RESULT = BigInt(eligPublic[0]);

async function deployFixture() {
  const Credit = await ethers.getContractFactory("Groth16Verifier");
  const credit = await Credit.deploy();
  await credit.waitForDeployment();

  const Elig = await ethers.getContractFactory("VerityEligibilityVerifier");
  const elig = await Elig.deploy();
  await elig.waitForDeployment();

  const Manager = await ethers.getContractFactory("VerityManager");
  const manager = await Manager.deploy(
    await credit.getAddress(),
    await elig.getAddress(),
  );
  await manager.waitForDeployment();

  return { credit, elig, manager };
}

describe("VerityManager", function () {
  let manager;
  let credit;
  let elig;
  let deployer;
  let submitter;

  beforeEach(async function () {
    [deployer, submitter] = await ethers.getSigners();
    ({ manager, credit, elig } = await deployFixture());
  });

  describe("deployment", function () {
    it("wires the genuine verifier addresses", async function () {
      expect(await manager.creditScoreVerifier()).to.equal(
        await credit.getAddress(),
      );
      expect(await manager.eligibilityVerifier()).to.equal(
        await elig.getAddress(),
      );
    });

    it("rejects zero verifier addresses", async function () {
      const Manager = await ethers.getContractFactory("VerityManager");
      await expect(
        Manager.deploy(ethers.ZeroAddress, await elig.getAddress()),
      ).to.be.revertedWith("credit verifier required");
      await expect(
        Manager.deploy(await credit.getAddress(), ethers.ZeroAddress),
      ).to.be.revertedWith("eligibility verifier required");
    });
  });

  describe("createTask", function () {
    it("creates a task and emits TaskCreated", async function () {
      await expect(
        manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT),
      )
        .to.emit(manager, "TaskCreated")
        .withArgs(
          CREDIT_TASK_ID,
          deployer.address,
          CREDIT_MODEL_ID,
          CREDIT_COMMITMENT,
        );

      const task = await manager.getTask(CREDIT_TASK_ID);
      expect(task.status).to.equal(1n); // Created
      expect(task.creator).to.equal(deployer.address);
      expect(task.modelId).to.equal(CREDIT_MODEL_ID);
      expect(task.commitment).to.equal(CREDIT_COMMITMENT);
      expect(task.result).to.equal(0n);
      expect(task.verifiedAt).to.equal(0n);
    });

    it("rejects duplicate task ids", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      await expect(
        manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT),
      ).to.be.revertedWith("task exists");
    });

    it("rejects unsupported model ids", async function () {
      await expect(
        manager.createTask(1n, 3n, 1n),
      ).to.be.revertedWith("unsupported model");
    });

    it("rejects zero taskId and zero commitment", async function () {
      await expect(
        manager.createTask(0n, CREDIT_MODEL_ID, CREDIT_COMMITMENT),
      ).to.be.revertedWith("taskId required");
      await expect(
        manager.createTask(1n, CREDIT_MODEL_ID, 0n),
      ).to.be.revertedWith("commitment required");
    });
  });

  describe("credit-score v1 (real Groth16 proof)", function () {
    const { a, b, c } = toSolidityProof(creditProof);

    it("verifies a valid proof, records result 755, and emits ProofVerified", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);

      await expect(
        manager
          .connect(submitter)
          .submitProof(CREDIT_TASK_ID, a, b, c, creditPublic),
      )
        .to.emit(manager, "ProofVerified")
        .withArgs(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_SCORE, CREDIT_COMMITMENT);

      const task = await manager.getTask(CREDIT_TASK_ID);
      expect(task.status).to.equal(2n); // Verified
      expect(task.result).to.equal(755n);
      expect(task.verifiedAt).to.be.greaterThan(0n);
    });

    it("rejects a tampered claimedScore with the same proof", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      const tampered = [...creditPublic];
      tampered[0] = (BigInt(tampered[0]) + 1n).toString(); // 755 -> 756

      await expect(
        manager.submitProof(CREDIT_TASK_ID, a, b, c, tampered),
      ).to.be.revertedWith("invalid proof");

      const task = await manager.getTask(CREDIT_TASK_ID);
      expect(task.status).to.equal(1n); // still Created, not Verified
    });

    it("rejects a commitment that does not match the registered task", async function () {
      await manager.createTask(
        CREDIT_TASK_ID,
        CREDIT_MODEL_ID,
        CREDIT_COMMITMENT + 1n,
      );
      await expect(
        manager.submitProof(CREDIT_TASK_ID, a, b, c, creditPublic),
      ).to.be.revertedWith("commitment signal mismatch");
    });

    it("rejects a proof bound to a different task id", async function () {
      await manager.createTask(1000n, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      await expect(
        manager.submitProof(1000n, a, b, c, creditPublic),
      ).to.be.revertedWith("taskId signal mismatch");
    });

    it("rejects a mismatched model signal before verification", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      const tampered = [...creditPublic];
      tampered[1] = "2";
      await expect(
        manager.submitProof(CREDIT_TASK_ID, a, b, c, tampered),
      ).to.be.revertedWith("model signal mismatch");
    });

    it("rejects the wrong public-signal count", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      // v2 has 5 signals; a v1 task must reject it.
      await expect(
        manager.submitProof(CREDIT_TASK_ID, a, b, c, eligPublic),
      ).to.be.revertedWith("bad signal count");
    });

    it("rejects duplicate submission after verification", async function () {
      await manager.createTask(CREDIT_TASK_ID, CREDIT_MODEL_ID, CREDIT_COMMITMENT);
      await manager.submitProof(CREDIT_TASK_ID, a, b, c, creditPublic);
      await expect(
        manager.submitProof(CREDIT_TASK_ID, a, b, c, creditPublic),
      ).to.be.revertedWith("task not open");
    });

    it("rejects submission for a nonexistent task", async function () {
      await expect(
        manager.submitProof(999n, a, b, c, creditPublic),
      ).to.be.revertedWith("task not open");
    });
  });

  describe("eligibility v2 (real Groth16 proof)", function () {
    const { a, b, c } = toSolidityProof(eligProof);

    it("verifies a valid proof and records eligible = 1", async function () {
      await manager.createTask(ELIG_TASK_ID, ELIG_MODEL_ID, ELIG_COMMITMENT);

      await expect(
        manager
          .connect(submitter)
          .submitProof(ELIG_TASK_ID, a, b, c, eligPublic),
      )
        .to.emit(manager, "ProofVerified")
        .withArgs(ELIG_TASK_ID, ELIG_MODEL_ID, ELIG_RESULT, ELIG_COMMITMENT);

      const task = await manager.getTask(ELIG_TASK_ID);
      expect(task.status).to.equal(2n);
      expect(task.result).to.equal(1n);
    });

    it("rejects a tampered eligible signal", async function () {
      await manager.createTask(ELIG_TASK_ID, ELIG_MODEL_ID, ELIG_COMMITMENT);
      const tampered = [...eligPublic];
      tampered[0] = "0";
      await expect(
        manager.submitProof(ELIG_TASK_ID, a, b, c, tampered),
      ).to.be.revertedWith("invalid proof");
    });

    it("rejects an unapproved threshold signal", async function () {
      await manager.createTask(ELIG_TASK_ID, ELIG_MODEL_ID, ELIG_COMMITMENT);
      const tampered = [...eligPublic];
      tampered[1] = "600";
      await expect(
        manager.submitProof(ELIG_TASK_ID, a, b, c, tampered),
      ).to.be.revertedWith("threshold signal mismatch");
    });

    it("rejects v1 signals on a v2 task", async function () {
      await manager.createTask(ELIG_TASK_ID, ELIG_MODEL_ID, ELIG_COMMITMENT);
      await expect(
        manager.submitProof(ELIG_TASK_ID, a, b, c, creditPublic),
      ).to.be.revertedWith("bad signal count");
    });
  });

  describe("getTask", function () {
    it("returns the None record for an unknown task", async function () {
      const task = await manager.getTask(12345n);
      expect(task.status).to.equal(0n);
      expect(task.creator).to.equal(ethers.ZeroAddress);
    });
  });
});
