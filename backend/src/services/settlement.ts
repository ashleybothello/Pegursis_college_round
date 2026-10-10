import {
  SettlementInputs,
  SettlementResult,
  SettlementStatus,
} from '../types/index.js';

export const DEFAULT_FEE_BASIS_POINTS = 250; // 2.50%
export const DEFAULT_FIXED_FEE_MINOR_UNITS = 30; // $0.30

/**
 * Calculates payment settlement figures using decimal-safe integer minor units.
 * Gross, fee, and net amounts are strictly integers (e.g., cents).
 */
export function calculateSettlement(inputs: SettlementInputs): SettlementResult {
  const {
    grossAmount,
    feeBasisPoints = DEFAULT_FEE_BASIS_POINTS,
    fixedFeeMinorUnits = DEFAULT_FIXED_FEE_MINOR_UNITS,
    currency = 'USD',
  } = inputs;

  if (!Number.isInteger(grossAmount) || grossAmount <= 0) {
    throw new Error('grossAmount must be a positive integer in minor units (e.g. cents)');
  }
  if (!Number.isInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 10000) {
    throw new Error('feeBasisPoints must be an integer between 0 and 10000');
  }
  if (!Number.isInteger(fixedFeeMinorUnits) || fixedFeeMinorUnits < 0) {
    throw new Error('fixedFeeMinorUnits must be a non-negative integer');
  }

  // Calculate basis points fee using integer rounding (half up)
  // Basis points: 10,000 basis points = 100%
  const basisPointsFee = Math.floor((grossAmount * feeBasisPoints + 5000) / 10000);
  const totalFee = basisPointsFee + fixedFeeMinorUnits;

  const netAmount = Math.max(0, grossAmount - totalFee);

  // Determine status for demonstration workflow:
  // If fee consumes entire payment, mark HELD for manual review; otherwise SETTLED.
  let status: SettlementStatus = 'SETTLED';
  if (totalFee >= grossAmount) {
    status = 'HELD';
  }

  const effectiveRatePercent =
    grossAmount > 0
      ? Math.round(((totalFee / grossAmount) * 100 + Number.EPSILON) * 100) / 100
      : 0;

  return {
    grossAmount,
    feeAmount: totalFee,
    netAmount,
    currency: currency.toUpperCase(),
    status,
    feeBreakdown: {
      basisPointsFee,
      fixedFee: fixedFeeMinorUnits,
      effectiveRatePercent,
    },
    calculatedAt: new Date().toISOString(),
  };
}
