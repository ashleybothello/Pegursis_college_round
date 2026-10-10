pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Verity Finance eligibility model v2 (modelId = 2).
 *
 * This is the privacy-preserving variant: the score is NEVER revealed.
 * Only the boolean eligibility and the approved configuration are public.
 *
 * Private inputs:
 *   paymentHistory, incomeStability, debtHeadroom  -- integers in [0, 100]
 *   inputSalt                                      -- per-proof random salt
 *
 * Public inputs (exact order):
 *   [eligible, threshold, modelId, taskId, inputCommitment]
 *
 * Approved model:
 *   score    = 300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom
 *   eligible = 1 if score >= threshold else 0
 *
 * The threshold is constrained to the approved value inside the circuit, so a
 * prover cannot lower the bar it is judged against. The Poseidon commitment
 * binds the private features to the salt, threshold, model id, and task id, so
 * a valid proof cannot be moved to another task or model.
 */
template Eligibility() {
    // Private inputs.
    signal input paymentHistory;
    signal input incomeStability;
    signal input debtHeadroom;
    signal input inputSalt;

    // Public inputs (listed in the main component below).
    signal input eligible;
    signal input threshold;
    signal input modelId;
    signal input taskId;
    signal input inputCommitment;

    signal score;
    signal isEligible;
    signal eligibleBool;

    // Approved model configuration. These are circuit constants, not inputs.
    var APPROVED_MODEL_ID = 2;
    var APPROVED_THRESHOLD = 700;
    var BASE_SCORE = 300;
    var PAYMENT_HISTORY_WEIGHT = 3;
    var INCOME_STABILITY_WEIGHT = 2;
    var DEBT_HEADROOM_WEIGHT = 1;

    component paymentBits = Num2Bits(7);
    component paymentMax = LessThan(7);
    component incomeBits = Num2Bits(7);
    component incomeMax = LessThan(7);
    component debtBits = Num2Bits(7);
    component debtMax = LessThan(7);
    component thresholdCheck = GreaterEqThan(16);
    component commitment = Poseidon(7);

    // Each feature is an integer in [0, 100]. Num2Bits enforces a canonical
    // non-negative 7-bit value; LessThan(.., 101) enforces the <= 100 bound.
    paymentBits.in <== paymentHistory;
    paymentMax.in[0] <== paymentHistory;
    paymentMax.in[1] <== 101;
    paymentMax.out === 1;

    incomeBits.in <== incomeStability;
    incomeMax.in[0] <== incomeStability;
    incomeMax.in[1] <== 101;
    incomeMax.out === 1;

    debtBits.in <== debtHeadroom;
    debtMax.in[0] <== debtHeadroom;
    debtMax.in[1] <== 101;
    debtMax.out === 1;

    // Bind the proof to the approved model version and the approved threshold.
    modelId === APPROVED_MODEL_ID;
    threshold === APPROVED_THRESHOLD;

    // Private score computation.
    score <== BASE_SCORE
        + PAYMENT_HISTORY_WEIGHT * paymentHistory
        + INCOME_STABILITY_WEIGHT * incomeStability
        + DEBT_HEADROOM_WEIGHT * debtHeadroom;

    // eligible = 1 if score >= threshold else 0. Max score is 800 < 2^16.
    thresholdCheck.in[0] <== score;
    thresholdCheck.in[1] <== threshold;
    isEligible <== thresholdCheck.out;
    eligible === isEligible;

    // Explicit boolean safety constraint.
    eligibleBool <== eligible * eligible;
    eligibleBool === eligible;

    // Public commitment to the private features plus task/model context.
    commitment.inputs[0] <== paymentHistory;
    commitment.inputs[1] <== incomeStability;
    commitment.inputs[2] <== debtHeadroom;
    commitment.inputs[3] <== inputSalt;
    commitment.inputs[4] <== threshold;
    commitment.inputs[5] <== modelId;
    commitment.inputs[6] <== taskId;
    inputCommitment === commitment.out;
}

component main {public [eligible, threshold, modelId, taskId, inputCommitment]} = Eligibility();
