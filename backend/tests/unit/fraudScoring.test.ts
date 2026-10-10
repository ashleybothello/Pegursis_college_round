import { describe, it, expect } from 'vitest';
import {
  evaluateFraudRisk,
  DEFAULT_FRAUD_CONFIG,
} from '../../src/services/fraudScoring.js';

describe('Fraud Risk Scoring Service', () => {
  it('evaluates baseline low risk for normal transactions', () => {
    const result = evaluateFraudRisk({
      transactionAmount: 150,
      userAverageAmount: 120,
      userTransactionsLastHour: 1,
      isNewDevice: false,
      locationMismatch: false,
      transactionHourUtc: 14,
    });

    expect(result.riskScore).toBe(0);
    expect(result.riskCategory).toBe('LOW');
    expect(result.reasons[0]).toContain('No suspicious risk indicators detected');
    expect(result.disclaimer).toContain('demonstrative, rule-based fraud-risk scoring');
  });

  it('triggers high absolute amount rule', () => {
    const result = evaluateFraudRisk({
      transactionAmount: 15000, // exceeds $10,000 threshold
      userAverageAmount: 15000,
      userTransactionsLastHour: 1,
    });

    expect(result.riskScore).toBe(25);
    expect(result.riskCategory).toBe('MEDIUM');
    expect(result.reasons.some((r) => r.includes('High transaction amount'))).toBe(true);
  });

  it('triggers relative amount anomaly rule', () => {
    const result = evaluateFraudRisk({
      transactionAmount: 2000,
      userAverageAmount: 200, // 10x average (exceeds 4x threshold)
      userTransactionsLastHour: 1,
    });

    expect(result.riskScore).toBe(25);
    expect(result.riskCategory).toBe('MEDIUM');
    expect(result.reasons.some((r) => r.includes('greater than user historical average'))).toBe(true);
  });

  it('triggers high velocity and new device rules', () => {
    const result = evaluateFraudRisk({
      transactionAmount: 500,
      userAverageAmount: 500,
      userTransactionsLastHour: 6, // 25 points
      isNewDevice: true, // 15 points
    });

    // 25 + 15 = 40
    expect(result.riskScore).toBe(40);
    expect(result.riskCategory).toBe('MEDIUM');
    expect(result.reasons.some((r) => r.includes('High transaction velocity'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('unrecognized device'))).toBe(true);
  });

  it('triggers multiple compounding rules reaching CRITICAL category', () => {
    const result = evaluateFraudRisk({
      transactionAmount: 25000, // 25 points
      userAverageAmount: 1000, // 25 points
      userTransactionsLastHour: 8, // 25 points
      locationMismatch: true, // 20 points
      rapidCrossBorderTransfers: true, // 30 points
      transactionHourUtc: 3, // 10 points
    });

    // 25 + 25 + 25 + 20 + 30 + 10 = 135 -> capped at 100
    expect(result.riskScore).toBe(100);
    expect(result.riskCategory).toBe('CRITICAL');
    expect(result.reasons.length).toBeGreaterThanOrEqual(5);
  });

  it('respects custom configuration thresholds', () => {
    const customConfig = {
      ...DEFAULT_FRAUD_CONFIG,
      highAmountThreshold: 500,
    };

    const result = evaluateFraudRisk(
      {
        transactionAmount: 600,
      },
      customConfig
    );

    expect(result.riskScore).toBe(25);
    expect(result.reasons.some((r) => r.includes('exceeds threshold of $500'))).toBe(true);
  });
});
