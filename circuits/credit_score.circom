pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Verity Finance demo model v1.
 *
 * score = 300
 *       + 3 * paymentHistory
 *       + 2 * incomeStability
 *       + 1 * debtHeadroom
 *
 * The three feature values and the salt are private. The score, model ID,
 * task ID, and Poseidon commitment are public. The commitment binds the
 * private features to the public task, model, and salt.
 */
template CreditScore() {
    // Private inputs.
    signal input paymentHistory;
    signal input incomeStability;
    signal input debtHeadroom;
    signal input inputSalt;

    // Public inputs (listed in the main component below).
    signal input claimedScore;
    signal input modelId;
    signal input taskId;
    signal input inputCommitment;

    signal computedScore;

    component paymentBits = Num2Bits(7);
    component paymentUpperBound = LessThan(7);
    component incomeBits = Num2Bits(7);
    component incomeUpperBound = LessThan(7);
    component debtBits = Num2Bits(7);
    component debtUpperBound = LessThan(7);
    component commitment = Poseidon(6);

    // Approved model configuration. These constants are circuit constraints.
    var APPROVED_MODEL_ID = 1;
    var BASE_SCORE = 300;
    var PAYMENT_HISTORY_WEIGHT = 3;
    var INCOME_STABILITY_WEIGHT = 2;
    var DEBT_HEADROOM_WEIGHT = 1;

    // Each feature is an integer in [0, 100]. Num2Bits enforces non-negative
    // 7-bit values, and LessThan(7) enforces the upper bound of 100.
    paymentBits.in <== paymentHistory;
    paymentUpperBound.in[0] <== paymentHistory;
    paymentUpperBound.in[1] <== 101;
    paymentUpperBound.out === 1;

    incomeBits.in <== incomeStability;
    incomeUpperBound.in[0] <== incomeStability;
    incomeUpperBound.in[1] <== 101;
    incomeUpperBound.out === 1;

    debtBits.in <== debtHeadroom;
    debtUpperBound.in[0] <== debtHeadroom;
    debtUpperBound.in[1] <== 101;
    debtUpperBound.out === 1;

    // Bind the proof to the approved model version.
    modelId === APPROVED_MODEL_ID;

    // The only accepted score is the result of the fixed formula.
    computedScore <== BASE_SCORE
        + PAYMENT_HISTORY_WEIGHT * paymentHistory
        + INCOME_STABILITY_WEIGHT * incomeStability
        + DEBT_HEADROOM_WEIGHT * debtHeadroom;
    computedScore === claimedScore;

    // Public commitment to private inputs plus task/model context.
    commitment.inputs[0] <== paymentHistory;
    commitment.inputs[1] <== incomeStability;
    commitment.inputs[2] <== debtHeadroom;
    commitment.inputs[3] <== inputSalt;
    commitment.inputs[4] <== taskId;
    commitment.inputs[5] <== modelId;
    inputCommitment === commitment.out;
}

component main {public [claimedScore, modelId, taskId, inputCommitment]} = CreditScore();
