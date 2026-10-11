// snarkjs Groth16 proof -> Solidity argument conversion (shared contract helper).
//
// Groth16 points in a snarkjs proof.json are serialized in a specific order and
// snarkjs' Solidity verifier expects the `b` (G2) coordinates swapped. The
// backend (Person 2) and the tests must both use this exact conversion.
//
// Usage:
//   const { toSolidityProof, toSubmitProofArgs } = require("./lib/proof-format");
//   const { a, b, c } = toSolidityProof(proofJson);
//   await manager.submitProof(taskId, a, b, c, publicSignals);

/**
 * Convert a snarkjs proof object into the (a, b, c) tuple the generated
 * Groth16 verifier expects.
 *
 * @param {object} proof parsed proof.json (pi_a, pi_b, pi_c).
 * @returns {{a: string[], b: string[][], c: string[]}}
 */
function toSolidityProof(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    // NOTE: pi_b rows are swapped relative to snarkjs output.
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

/**
 * Full argument list for VerityManager.submitProof.
 *
 * @param {number|bigint|string} taskId
 * @param {object} proof parsed proof.json
 * @param {string[]|bigint[]} publicSignals parsed public.json / publicSignals array
 * @returns {[taskId, a, b, c, publicSignals]}
 */
function toSubmitProofArgs(taskId, proof, publicSignals) {
  const { a, b, c } = toSolidityProof(proof);
  return [taskId, a, b, c, publicSignals];
}

module.exports = { toSolidityProof, toSubmitProofArgs };
