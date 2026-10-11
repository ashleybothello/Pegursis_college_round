import { EmiCalculationInputs, EmiCalculationResult } from '../types/index.js';

export const EMI_ASSUMPTIONS = [
  'Standard reducing-balance amortization model with monthly compounding.',
  'Monthly interest rate is calculated as annual rate divided by 1200 (annualRate / 12 / 100).',
  'For zero-interest loans (annualInterestRate = 0), EMI is the exact principal divided by tenure months.',
  'Equal installments are paid at the end of each monthly period.',
  'All monetary figures are rounded to 2 decimal places (standard currency cents) using round-half-up.',
];

/**
 * Rounds a number to two decimal places safely.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates monthly EMI, total repayment, and total interest.
 * Handles normal interest and zero-interest loans.
 */
export function calculateEmi(inputs: EmiCalculationInputs): EmiCalculationResult {
  const { principal, annualInterestRate, tenureMonths } = inputs;

  if (principal <= 0 || !Number.isFinite(principal)) {
    throw new Error('Principal must be a positive finite number');
  }
  if (annualInterestRate < 0 || !Number.isFinite(annualInterestRate)) {
    throw new Error('Annual interest rate cannot be negative');
  }
  if (tenureMonths < 1 || !Number.isInteger(tenureMonths)) {
    throw new Error('Tenure months must be an integer of at least 1');
  }

  let monthlyEmi: number;

  if (annualInterestRate === 0) {
    // Zero-interest loan: simply divide principal by tenure months
    monthlyEmi = roundToTwoDecimals(principal / tenureMonths);
  } else {
    // Monthly interest rate
    const r = annualInterestRate / 12 / 100;
    // Standard reducing balance formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
    const factor = Math.pow(1 + r, tenureMonths);
    const unroundedEmi = (principal * r * factor) / (factor - 1);
    monthlyEmi = roundToTwoDecimals(unroundedEmi);
  }

  const totalRepayment = roundToTwoDecimals(monthlyEmi * tenureMonths);
  const totalInterest = roundToTwoDecimals(Math.max(0, totalRepayment - principal));

  return {
    principal: roundToTwoDecimals(principal),
    annualInterestRate,
    tenureMonths,
    monthlyEmi,
    totalRepayment,
    totalInterest,
    currencyUnit: 'USD',
    assumptions: EMI_ASSUMPTIONS,
  };
}
