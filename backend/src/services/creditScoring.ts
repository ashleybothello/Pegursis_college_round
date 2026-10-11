import {
  CreditScoringInputs,
  CreditScoringResult,
  CreditValidationResult,
} from '../types/index.js';

export const CREDIT_MODEL_VERSION = 1;
export const MIN_CREDIT_SCORE = 300;
export const MAX_CREDIT_SCORE = 1300;

export const CREDIT_MODEL_DISCLAIMER =
  'This is a demonstrative scoring model for hackathon verification workflows, not a validated real-world credit decision model.';

/**
 * Validates the raw inputs for credit scoring.
 * Checks for missing, non-number, non-integer, negative, and out-of-range values.
 */
export function validateCreditInputs(inputs: unknown): {
  isValid: boolean;
  validated?: CreditScoringInputs;
  errors: string[];
} {
  const errors: string[] = [];

  if (!inputs || typeof inputs !== 'object') {
    return { isValid: false, errors: ['Inputs must be an object'] };
  }

  const { incomeIndex, repaymentIndex, historyIndex } = inputs as Record<string, unknown>;

  const checkField = (name: string, value: unknown): number | null => {
    if (value === undefined || value === null) {
      errors.push(`${name} is missing`);
      return null;
    }
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      errors.push(`${name} must be a valid finite number`);
      return null;
    }
    if (!Number.isInteger(value)) {
      errors.push(`${name} must be an integer, received fractional value ${value}`);
      return null;
    }
    if (value < 0 || value > 100) {
      errors.push(`${name} must be between 0 and 100 inclusive, received ${value}`);
      return null;
    }
    return value;
  };

  const vIncome = checkField('incomeIndex', incomeIndex);
  const vRepayment = checkField('repaymentIndex', repaymentIndex);
  const vHistory = checkField('historyIndex', historyIndex);

  if (errors.length > 0 || vIncome === null || vRepayment === null || vHistory === null) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    validated: {
      incomeIndex: vIncome,
      repaymentIndex: vRepayment,
      historyIndex: vHistory,
    },
    errors: [],
  };
}

/**
 * Calculates credit score using the exact canonical formula:
 * score = 300 + 5 * incomeIndex + 3 * repaymentIndex + 2 * historyIndex
 *
 * Uses deterministic integer arithmetic.
 */
export function calculateCreditScore(inputs: unknown): CreditScoringResult {
  const validation = validateCreditInputs(inputs);

  if (!validation.isValid || !validation.validated) {
    const errorDetails = validation.errors.join('; ');
    throw new Error(`Credit score calculation failed: ${errorDetails}`);
  }

  const { incomeIndex, repaymentIndex, historyIndex } = validation.validated;

  // Deterministic integer calculation
  // 300 + (5 * incomeIndex) + (3 * repaymentIndex) + (2 * historyIndex)
  const score = Math.floor(
    300 + 5 * incomeIndex + 3 * repaymentIndex + 2 * historyIndex
  );

  // Invariant verification: score must be within [300, 1300]
  if (score < MIN_CREDIT_SCORE || score > MAX_CREDIT_SCORE) {
    throw new Error(
      `Calculated score ${score} is outside guaranteed range [${MIN_CREDIT_SCORE}, ${MAX_CREDIT_SCORE}]`
    );
  }

  const validationResult: CreditValidationResult = {
    isValid: true,
    errors: [],
  };

  return {
    score,
    modelVersion: CREDIT_MODEL_VERSION,
    validation: validationResult,
    timestamp: new Date().toISOString(),
    disclaimer: CREDIT_MODEL_DISCLAIMER,
  };
}
