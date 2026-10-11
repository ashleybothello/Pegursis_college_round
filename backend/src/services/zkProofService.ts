// Person 1/2 integration: real Groth16 proof service for the ZK credit-score circuit.
//
// This service wraps the exact circuit artifacts from Person 1 (build/) and
// generates proofs that are valid for VerityManager (Person 3).
//
// Input mapping: the legacy financial indices are mapped to circuit features
// via the explicit ZK_FEATURE_MAPPING in zkCreditScoring.ts.

import fs from 'fs';
import path from 'path';
// @ts-ignore - snarkjs has no bundled types
import * as snarkjs from 'snarkjs';
// @ts-ignore - circomlibjs has no bundled types
import { buildPoseidon } from 'circomlibjs';
import {
  CreditScoringInputs,
  ProofGenerationResult,
  ProofService,
  SolidityProof,
} from '../types/index.js';
import {
  calculateZkScore,
  mapIndicesToCircuitFeatures,
  ZK_PUBLIC_SIGNAL_ORDER,
  ZK_COMMITMENT_ORDER,
  ZK_MODEL_ID,
  CircuitFeatures,
} from './zkCreditScoring.js';

let poseidonPromise: Promise<any> | null = null;
function getPoseidon() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

export interface ZkProofServiceConfig {
  circuitWasmPath: string;
  circuitZkeyPath: string;
  verificationKeyPath: string;
}

/**
 * Real ZK proof service for the credit-score circuit (modelId=1).
 * Uses snarkjs Groth16 + Poseidon commitment.
 */
export class ZkCreditProofService implements ProofService {
  private circuitWasmPath: string;
  private circuitZkeyPath: string;
  private verificationKeyPath: string;

  constructor(config: ZkProofServiceConfig) {
    this.circuitWasmPath = config.circuitWasmPath;
    this.circuitZkeyPath = config.circuitZkeyPath;
    this.verificationKeyPath = config.verificationKeyPath;
  }

  public checkArtifacts(): { ready: boolean; missingFiles: string[] } {
    const missing: string[] = [];
    if (!this.circuitWasmPath || !fs.existsSync(this.circuitWasmPath)) {
      missing.push(`WASM artifact not found at: ${this.circuitWasmPath}`);
    }
    if (!this.circuitZkeyPath || !fs.existsSync(this.circuitZkeyPath)) {
      missing.push(`Proving key (zkey) not found at: ${this.circuitZkeyPath}`);
    }
    if (!this.verificationKeyPath || !fs.existsSync(this.verificationKeyPath)) {
      missing.push(`Verification key not found at: ${this.verificationKeyPath}`);
    }
    return { ready: missing.length === 0, missingFiles: missing };
  }

  /**
   * Compute the Poseidon input commitment matching the circuit exactly.
   * Circuit commitment order: [paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]
   */
  async calculateInputCommitment(
    features: CircuitFeatures,
    inputSalt: string,
    taskId: bigint,
    modelId: number = ZK_MODEL_ID
  ): Promise<string> {
    const poseidon = await getPoseidon();
    const commitment = poseidon([
      BigInt(features.paymentHistory),
      BigInt(features.incomeStability),
      BigInt(features.debtHeadroom),
      BigInt(inputSalt),
      taskId,
      BigInt(modelId),
    ]);
    return poseidon.F.toString(commitment);
  }

  /**
   * Generate a real Groth16 proof for the ZK credit-score circuit.
   * Maps financial indices -> circuit features, computes expected score,
   * builds full witness with Poseidon commitment, runs fullProve.
   */
  async generateProof(inputs: CreditScoringInputs): Promise<ProofGenerationResult> {
    // 1. Map indices to circuit features and compute expected circuit score
    const features = mapIndicesToCircuitFeatures(inputs);
    const expected = calculateZkScore(inputs); // { score, modelVersion, features }

    // 2. Validate artifact availability
    const artifactCheck = this.checkArtifacts();
    if (!artifactCheck.ready) {
      throw new Error(
        `Groth16 proof generation failed: Missing circuit artifacts.\n` +
          artifactCheck.missingFiles.join('\n') +
          `\nConfigure CIRCUIT_WASM_PATH, CIRCUIT_ZKEY_PATH, VERIFICATION_KEY_PATH or use PROOF_MODE=mock.`
      );
    }

    // 3. Generate a deterministic inputSalt from timestamp for reproducibility
    // In production, this would be a secure random salt stored off-chain
    const inputSalt = String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const taskId = BigInt(Date.now() % 1000000) + 42n; // ensure non-zero

    const modelId = ZK_MODEL_ID;

    // 5. Compute commitment
    const inputCommitment = await this.calculateInputCommitment(
      features,
      inputSalt,
      taskId,
      modelId
    );

    // 6. Build circuit input (matches circuits/credit_score.circom exactly)
    // Private: paymentHistory, incomeStability, debtHeadroom, inputSalt
    // Public: claimedScore, modelId, taskId, inputCommitment
    const circuitInput = {
      paymentHistory: String(features.paymentHistory),
      incomeStability: String(features.incomeStability),
      debtHeadroom: String(features.debtHeadroom),
      inputSalt: inputSalt,
      claimedScore: String(expected.score),
      modelId: String(modelId),
      taskId: taskId.toString(),
      inputCommitment: inputCommitment,
    };

    // 7. Generate proof with snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      this.circuitWasmPath,
      this.circuitZkeyPath
    );

    if (!publicSignals || publicSignals.length < 4) {
      throw new Error(
        `Circuit execution returned insufficient public signals: ${publicSignals}`
      );
    }

    // 8. Cross-check against canonical computation
    const returnedScore = Number(publicSignals[ZK_PUBLIC_SIGNAL_ORDER.indexOf('claimedScore')]);
    const returnedModelId = Number(publicSignals[ZK_PUBLIC_SIGNAL_ORDER.indexOf('modelId')]);

    if (returnedScore !== expected.score) {
      throw new Error(
        `Circuit proof validation mismatch: circuit output score ${returnedScore} does not match expected canonical score ${expected.score}`
      );
    }
    if (returnedModelId !== expected.modelVersion) {
      throw new Error(
        `Circuit proof validation mismatch: circuit model id ${returnedModelId} does not match expected ${expected.modelVersion}`
      );
    }

    // 9. Format proof coordinates for Solidity Verifier
    const solidityProof = formatSnarkjsProofForSolidity(proof, publicSignals);

    return {
      proof: solidityProof,
      publicSignals,
      score: returnedScore,
      modelVersion: returnedModelId,
      isMock: false,
      generatedAt: new Date().toISOString(),
    };
  }

  async verifyProof(proof: SolidityProof, publicSignals: string[]): Promise<boolean> {
    if (!this.verificationKeyPath || !fs.existsSync(this.verificationKeyPath)) {
      throw new Error(
        `Verification key file not found at: ${this.verificationKeyPath}. Please configure VERIFICATION_KEY_PATH.`
      );
    }

    const vKeyRaw = fs.readFileSync(this.verificationKeyPath, 'utf8');
    const vKey = JSON.parse(vKeyRaw);

    // Reconstruct raw snarkjs proof format from Solidity coordinates
    const snarkProof = {
      pi_a: [proof.a[0], proof.a[1], '1'],
      pi_b: [
        [proof.b[0][1], proof.b[0][0]],
        [proof.b[1][1], proof.b[1][0]],
        ['1', '0'],
      ],
      pi_c: [proof.c[0], proof.c[1], '1'],
      protocol: 'groth16',
      curve: 'bn128',
    };

    return await snarkjs.groth16.verify(vKey, publicSignals, snarkProof);
  }
}

/**
 * Transforms snarkjs Groth16 proof into the exact uint256 coordinate structure
 * expected by standard Solidity Verifiers (generated by snarkjs zkey export solidityverifier).
 * Notice: in Ethereum BN254 ecPairing, G2 points in pi_b have reversed coordinate order [x_im, x_re].
 */
export function formatSnarkjsProofForSolidity(
  rawProof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  },
  publicSignals: string[]
): SolidityProof {
  return {
    a: [rawProof.pi_a[0], rawProof.pi_a[1]],
    b: [
      [rawProof.pi_b[0][1], rawProof.pi_b[0][0]],
      [rawProof.pi_b[1][1], rawProof.pi_b[1][0]],
    ],
    c: [rawProof.pi_c[0], rawProof.pi_c[1]],
    publicSignals: [...publicSignals],
  };
}
