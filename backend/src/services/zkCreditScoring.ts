// Person 1/2 integration: circuit-aware credit scoring.
//
// IMPORTANT — two different models exist in this project and they are NOT
// equivalent:
//
//   1. The legacy financial model (services/creditScoring.ts, used by
//      POST /api/credit/score):
//        score = 300 + 5*incomeIndex + 3*repaymentIndex + 2*historyIndex
//
//   2. The ZK circuit model (circuits/credit_score.circom + model-config.json),
//      which is the ONLY model that can be cryptographically proven:
//        score = 300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom
//
// The circuit does not accept the financial indices directly; it consumes the
// private features (paymentHistory, incomeStability, debtHeadroom). This module
// makes the mapping between the two explicit and data-driven from
// model-config.json, so the ZK-verified score is always the circuit score.

import fs from 'fs';
import path from 'path';
import { CreditScoringInputs } from '../types/index.js';

// backend/src/services -> backend/src -> backend -> repo root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_CONFIG_PATH = path.resolve(PROJECT_ROOT, 'model-config.json');

export const ZK_MODEL_ID = 1;

export type CircuitFeatureName = 'paymentHistory' | 'incomeStability' | 'debtHeadroom';

export interface CircuitFeatures {
  paymentHistory: number;
  incomeStability: number;
  debtHeadroom: number;
}

interface ModelConfig {
  modelId: number;
  version: string;
  baseScore: number;
  weights: Record<CircuitFeatureName, number>;
  featureRange: { min: number; max: number };
  publicSignalOrder: string[];
  commitmentOrder: string[];
}

// Explicit, documented mapping from the financial API indices to the circuit's
// private feature names. This is a design decision, not an assumption that the
// two formulas are the same. Ordering chosen to preserve the closest semantics:
//   - repayment behavior -> paymentHistory
//   - income            -> incomeStability
//   - account history   -> debtHeadroom
export const ZK_FEATURE_MAPPING: Record<CircuitFeatureName, keyof CreditScoringInputs> = {
  paymentHistory: 'repaymentIndex',
  incomeStability: 'incomeIndex',
  debtHeadroom: 'historyIndex',
};

const FALLBACK_MODEL_CONFIG: ModelConfig = {
  modelId: 1,
  version: 'credit-score-v1',
  baseScore: 300,
  weights: { paymentHistory: 3, incomeStability: 2, debtHeadroom: 1 },
  featureRange: { min: 0, max: 100 },
  publicSignalOrder: ['claimedScore', 'modelId', 'taskId', 'inputCommitment'],
  commitmentOrder: [
    'paymentHistory',
    'incomeStability',
    'debtHeadroom',
    'inputSalt',
    'taskId',
    'modelId',
  ],
};

function loadModelConfig(): ModelConfig {
  try {
    const raw = fs.readFileSync(MODEL_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ModelConfig;
    if (
      typeof parsed?.baseScore !== 'number' ||
      typeof parsed?.weights?.paymentHistory !== 'number'
    ) {
      return FALLBACK_MODEL_CONFIG;
    }
    return parsed;
  } catch {
    return FALLBACK_MODEL_CONFIG;
  }
}

/** Approved circuit model metadata (single source of truth: model-config.json). */
export const MODEL_CONFIG: ModelConfig = loadModelConfig();

/** Public signal order of the credit-score circuit (model v1). */
export const ZK_PUBLIC_SIGNAL_ORDER = MODEL_CONFIG.publicSignalOrder; // [claimedScore, modelId, taskId, inputCommitment]

/** Commitment preimage order of the credit-score circuit (model v1). */
export const ZK_COMMITMENT_ORDER = MODEL_CONFIG.commitmentOrder; // [paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]

/**
 * Maps financial indices to the circuit's private features using the explicit
 * ZK_FEATURE_MAPPING above.
 */
export function mapIndicesToCircuitFeatures(inputs: CreditScoringInputs): CircuitFeatures {
  return {
    paymentHistory: inputs[ZK_FEATURE_MAPPING.paymentHistory],
    incomeStability: inputs[ZK_FEATURE_MAPPING.incomeStability],
    debtHeadroom: inputs[ZK_FEATURE_MAPPING.debtHeadroom],
  };
}

/** Computes the circuit score from circuit features using model-config weights. */
export function calculateCircuitScore(features: CircuitFeatures): number {
  const { baseScore, weights } = MODEL_CONFIG;
  return (
    baseScore +
    weights.paymentHistory * features.paymentHistory +
    weights.incomeStability * features.incomeStability +
    weights.debtHeadroom * features.debtHeadroom
  );
}

/**
 * Full ZK score calculation for a set of financial indices.
 * Returns the circuit score, the circuit model id, and the mapped features.
 */
export function calculateZkScore(inputs: CreditScoringInputs): {
  score: number;
  modelVersion: number;
  features: CircuitFeatures;
} {
  const features = mapIndicesToCircuitFeatures(inputs);
  return {
    score: calculateCircuitScore(features),
    modelVersion: MODEL_CONFIG.modelId,
    features,
  };
}
