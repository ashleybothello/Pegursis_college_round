// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Verity Finance -- VerityManager (Person 2)
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
        Verified
    }

    struct Task {
        TaskStatus status;
        address creator;
        uint256 modelId;
        uint256 commitment;
        uint256 result;
        uint256 verifiedAt;
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

    constructor(address _creditScoreVerifier, address _eligibilityVerifier) {
        require(_creditScoreVerifier != address(0), "credit verifier required");
        require(_eligibilityVerifier != address(0), "eligibility verifier required");
        creditScoreVerifier = _creditScoreVerifier;
        eligibilityVerifier = _eligibilityVerifier;
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
            verifiedAt: 0
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

        emit ProofVerified(taskId, task.modelId, result, task.commitment);
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
}
