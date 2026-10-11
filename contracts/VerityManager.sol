// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Verity Finance -- VerityManager (Person 3)
 *
 * Task lifecycle + Groth16 proof verification for the privacy-preserving
 * credit-scoring demo.
 *
 * Design notes that matter for correctness:
 *
 * 1. The `inputCommitment` is a Poseidon hash computed INSIDE the circuit over
 *    [paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]
 *    (model v1) or [..., threshold, modelId, taskId] (model v2). Solidity cannot
 *    recompute Poseidon cheaply, so this contract does NOT recompute it. It only
 *    checks that the commitment public signal equals the commitment registered
 *    for the task. The binding of that commitment to the private inputs, the
 *    task id, and the model id is enforced by the circuit constraints.
 * 2. `taskId` and `modelId` are public circuit inputs. The contract enforces
 *    that the proof's public signals carry the same taskId/modelId as the
 *    registered task, so a valid proof cannot be replayed on another task.
 * 3. A result is marked Verified ONLY after the genuine generated Groth16
 *    verifier returns true. There is no bypass path.
 *
 * Trusted-setup caveat: the shipped proving/verification keys use documented
 * demo entropy and are suitable for a hackathon demo only, not production.
 */

/// @dev Minimal interface matching the generated credit-score Groth16 verifier
///      (contract `Groth16Verifier` in contracts/VerityCreditScoreVerifier.sol).
///      Public signals: [claimedScore, modelId, taskId, inputCommitment].
interface ICreditScoreVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] memory input
    ) external view returns (bool);
}

/// @dev Minimal interface matching the generated eligibility Groth16 verifier
///      (contract `VerityEligibilityVerifier`).
///      Public signals: [eligible, threshold, modelId, taskId, inputCommitment].
interface IEligibilityVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] memory input
    ) external view returns (bool);
}

contract VerityManager {
    enum TaskStatus {
        None,
        Created,
        Verified,
        Invalidated
    }

    enum DisputeStatus {
        None,
        Open,
        Upheld,
        Overturned
    }

    struct Task {
        TaskStatus status;
        address creator;
        uint256 modelId;
        uint256 commitment;
        uint256 result;
        uint256 verifiedAt;
        DisputeStatus disputeStatus;
    }

    struct StoredProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] publicSignals;
        bool exists;
    }

    struct Dispute {
        DisputeStatus status;
        address raisedBy;
        string reason;
        uint256 raisedAt;
        uint256 resolvedAt;
    }

    /// @notice modelId bound inside circuits/credit_score.circom.
    uint256 public constant CREDIT_SCORE_MODEL_ID = 1;
    /// @notice modelId bound inside circuits/eligibility.circom.
    uint256 public constant ELIGIBILITY_MODEL_ID = 2;
    /// @notice Approved threshold mirrored from the eligibility circuit
    ///         (the circuit constrains `threshold == 700`).
    uint256 public constant APPROVED_THRESHOLD = 700;

    // Public-signal offsets, documented for Persons 3 and 4.
    // v1: [claimedScore, modelId, taskId, inputCommitment]
    uint256 private constant V1_LENGTH = 4;
    uint256 private constant V1_SCORE = 0;
    uint256 private constant V1_MODEL = 1;
    uint256 private constant V1_TASK = 2;
    uint256 private constant V1_COMMITMENT = 3;

    // v2: [eligible, threshold, modelId, taskId, inputCommitment]
    uint256 private constant V2_LENGTH = 5;
    uint256 private constant V2_ELIGIBLE = 0;
    uint256 private constant V2_THRESHOLD = 1;
    uint256 private constant V2_MODEL = 2;
    uint256 private constant V2_TASK = 3;
    uint256 private constant V2_COMMITMENT = 4;

    address public immutable creditScoreVerifier;
    address public immutable eligibilityVerifier;

    /// @notice taskId => task record. Auto-generated getter returns the fields.
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => StoredProof) private storedProofs;
    mapping(uint256 => Dispute) public disputes;
    address public immutable modelRegistrar;
    mapping(uint256 => bytes32) public verificationKeyHashes;

    struct CalculationReceipt { bytes32 inputHash; bytes32 outputHash; address provider; string module; }
    mapping(bytes32 => CalculationReceipt) public calculationReceipts;
    event CalculationRecorded(bytes32 indexed receiptId, address indexed provider, string module, bytes32 inputHash, bytes32 outputHash);
    event VerificationKeyRegistered(uint256 indexed modelId, bytes32 keyHash);

    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 modelId,
        uint256 commitment
    );

    event ProofVerified(
        uint256 indexed taskId,
        uint256 modelId,
        uint256 result,
        uint256 commitment
    );

    event DisputeRaised(
        uint256 indexed taskId,
        address indexed challenger,
        string reason
    );

    event DisputeResolved(
        uint256 indexed taskId,
        DisputeStatus status,
        bool proofValid
    );

    constructor(address _creditScoreVerifier, address _eligibilityVerifier) {
        require(_creditScoreVerifier != address(0), "credit verifier required");
        require(_eligibilityVerifier != address(0), "eligibility verifier required");
        creditScoreVerifier = _creditScoreVerifier;
        eligibilityVerifier = _eligibilityVerifier;
        modelRegistrar = msg.sender;
    }

    function registerVerificationKey(uint256 modelId, bytes32 keyHash) external {
        require(msg.sender == modelRegistrar, "registrar only");
        require(modelId == 1 || modelId == 2, "unsupported model");
        require(keyHash != bytes32(0) && verificationKeyHashes[modelId] == bytes32(0), "key already pinned or empty");
        verificationKeyHashes[modelId] = keyHash;
        emit VerificationKeyRegistered(modelId, keyHash);
    }

    /// @notice A receipt attests to recorded bytes, not arithmetic correctness.
    function recordCalculation(bytes32 receiptId, string calldata module, bytes32 inputHash, bytes32 outputHash) external {
        require(calculationReceipts[receiptId].provider == address(0), "receipt exists");
        require(inputHash != bytes32(0) && outputHash != bytes32(0), "hash required");
        calculationReceipts[receiptId] = CalculationReceipt(inputHash, outputHash, msg.sender, module);
        emit CalculationRecorded(receiptId, msg.sender, module, inputHash, outputHash);
    }

    /// @notice Register a task and its input commitment.
    /// @param taskId     Must match the taskId used inside the proof's commitment.
    /// @param modelId    CREDIT_SCORE_MODEL_ID (1) or ELIGIBILITY_MODEL_ID (2).
    /// @param commitment Poseidon commitment produced by the prover for this
    ///                   taskId/modelId (public signal index 3 for v1, 4 for v2).
    function createTask(uint256 taskId, uint256 modelId, uint256 commitment) external {
        require(taskId != 0, "taskId required");
        require(tasks[taskId].status == TaskStatus.None, "task exists");
        require(
            modelId == CREDIT_SCORE_MODEL_ID || modelId == ELIGIBILITY_MODEL_ID,
            "unsupported model"
        );
        require(commitment != 0, "commitment required");

        tasks[taskId] = Task({
            status: TaskStatus.Created,
            creator: msg.sender,
            modelId: modelId,
            commitment: commitment,
            result: 0,
            verifiedAt: 0,
            disputeStatus: DisputeStatus.None
        });

        emit TaskCreated(taskId, msg.sender, modelId, commitment);
    }

    /// @notice Submit a Groth16 proof for an existing task. Permissionless.
    /// @dev `b` must already be converted to the snarkjs-to-Solidity order:
    ///      b = [[pi_b[0][1], pi_b[0][0]], [pi_b[1][1], pi_b[1][0]]].
    function submitProof(
        uint256 taskId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "task not open");

        uint256 result;
        if (task.modelId == CREDIT_SCORE_MODEL_ID) {
            result = _verifyCreditScore(taskId, task, a, b, c, publicSignals);
        } else {
            result = _verifyEligibility(taskId, task, a, b, c, publicSignals);
        }

        task.status = TaskStatus.Verified;
        task.result = result;
        task.verifiedAt = block.timestamp;

        StoredProof storage stored = storedProofs[taskId];
        stored.a[0] = a[0];
        stored.a[1] = a[1];
        stored.b[0][0] = b[0][0];
        stored.b[0][1] = b[0][1];
        stored.b[1][0] = b[1][0];
        stored.b[1][1] = b[1][1];
        stored.c[0] = c[0];
        stored.c[1] = c[1];
        delete stored.publicSignals;
        for (uint256 i = 0; i < publicSignals.length; i++) {
            stored.publicSignals.push(publicSignals[i]);
        }
        stored.exists = true;

        emit ProofVerified(taskId, task.modelId, result, task.commitment);
    }

    /// @notice Challenge a verified result. Proofs and reasons are public;
    /// applicant inputs and salts are never stored in this contract.
    function raiseDispute(uint256 taskId, string calldata reason) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Verified, "task not verified");
        require(bytes(reason).length > 0, "reason required");
        require(bytes(reason).length <= 512, "reason too long");
        require(disputes[taskId].status == DisputeStatus.None, "dispute exists");

        disputes[taskId] = Dispute({
            status: DisputeStatus.Open,
            raisedBy: msg.sender,
            reason: reason,
            raisedAt: block.timestamp,
            resolvedAt: 0
        });
        task.disputeStatus = DisputeStatus.Open;
        emit DisputeRaised(taskId, msg.sender, reason);
    }

    /// @notice Re-run the stored proof and publish the dispute resolution.
    /// This is permissionless so any observer can resolve a challenge.
    function resolveDispute(uint256 taskId) external {
        Task storage task = tasks[taskId];
        Dispute storage dispute = disputes[taskId];
        require(task.status == TaskStatus.Verified, "task not verified");
        require(dispute.status == DisputeStatus.Open, "dispute not open");

        bool proofValid = _storedProofIsValid(taskId, task);
        dispute.status = proofValid ? DisputeStatus.Upheld : DisputeStatus.Overturned;
        dispute.resolvedAt = block.timestamp;
        task.disputeStatus = dispute.status;
        if (!proofValid) task.status = TaskStatus.Invalidated;

        emit DisputeResolved(taskId, dispute.status, proofValid);
    }

    function getStoredProof(uint256 taskId)
        external
        view
        returns (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c,
            uint256[] memory publicSignals
        )
    {
        StoredProof storage stored = storedProofs[taskId];
        require(stored.exists, "proof not stored");
        return (stored.a, stored.b, stored.c, stored.publicSignals);
    }

    /// @notice Convenience view returning the full task record.
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function _verifyCreditScore(
        uint256 taskId,
        Task storage task,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata s
    ) internal view returns (uint256) {
        require(s.length == V1_LENGTH, "bad signal count");
        require(s[V1_MODEL] == CREDIT_SCORE_MODEL_ID, "model signal mismatch");
        require(s[V1_TASK] == taskId, "taskId signal mismatch");
        require(s[V1_COMMITMENT] == task.commitment, "commitment signal mismatch");

        uint256[4] memory input;
        input[0] = s[V1_SCORE];
        input[1] = s[V1_MODEL];
        input[2] = s[V1_TASK];
        input[3] = s[V1_COMMITMENT];

        require(
            ICreditScoreVerifier(creditScoreVerifier).verifyProof(a, b, c, input),
            "invalid proof"
        );

        return s[V1_SCORE];
    }

    function _verifyEligibility(
        uint256 taskId,
        Task storage task,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata s
    ) internal view returns (uint256) {
        require(s.length == V2_LENGTH, "bad signal count");
        require(s[V2_MODEL] == ELIGIBILITY_MODEL_ID, "model signal mismatch");
        require(s[V2_TASK] == taskId, "taskId signal mismatch");
        require(s[V2_COMMITMENT] == task.commitment, "commitment signal mismatch");
        require(s[V2_THRESHOLD] == APPROVED_THRESHOLD, "threshold signal mismatch");

        uint256[5] memory input;
        input[0] = s[V2_ELIGIBLE];
        input[1] = s[V2_THRESHOLD];
        input[2] = s[V2_MODEL];
        input[3] = s[V2_TASK];
        input[4] = s[V2_COMMITMENT];

        require(
            IEligibilityVerifier(eligibilityVerifier).verifyProof(a, b, c, input),
            "invalid proof"
        );

        return s[V2_ELIGIBLE];
    }

    function _storedProofIsValid(uint256 taskId, Task storage task)
        internal
        view
        returns (bool)
    {
        StoredProof storage stored = storedProofs[taskId];
        if (!stored.exists) return false;

        uint256[2] memory a = stored.a;
        uint256[2][2] memory b = stored.b;
        uint256[2] memory c = stored.c;
        uint256[] memory s = stored.publicSignals;

        if (task.modelId == CREDIT_SCORE_MODEL_ID) {
            if (s.length != V1_LENGTH || s[V1_MODEL] != CREDIT_SCORE_MODEL_ID || s[V1_TASK] != taskId || s[V1_COMMITMENT] != task.commitment || s[0] != task.result) return false;
            uint256[4] memory input;
            input[0] = s[V1_SCORE];
            input[1] = s[V1_MODEL];
            input[2] = s[V1_TASK];
            input[3] = s[V1_COMMITMENT];
            try ICreditScoreVerifier(creditScoreVerifier).verifyProof(a, b, c, input) returns (bool valid) { return valid; } catch { return false; }
        }

        if (s.length != V2_LENGTH || s[V2_MODEL] != ELIGIBILITY_MODEL_ID || s[V2_TASK] != taskId || s[V2_COMMITMENT] != task.commitment || s[V2_THRESHOLD] != APPROVED_THRESHOLD || s[0] != task.result) return false;
        uint256[5] memory eligibilityInput;
        eligibilityInput[0] = s[V2_ELIGIBLE];
        eligibilityInput[1] = s[V2_THRESHOLD];
        eligibilityInput[2] = s[V2_MODEL];
        eligibilityInput[3] = s[V2_TASK];
        eligibilityInput[4] = s[V2_COMMITMENT];
        try IEligibilityVerifier(eligibilityVerifier).verifyProof(a, b, c, eligibilityInput) returns (bool valid) { return valid; } catch { return false; }
    }
}
