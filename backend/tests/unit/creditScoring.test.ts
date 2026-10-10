import { describe, it, expect } from 'vitest';
import {
  calculateCreditScore,
  validateCreditInputs,
  CREDIT_MODEL_VERSION,
  MIN_CREDIT_SCORE,
  MAX_CREDIT_SCORE,
} from '../../src/services/creditScoring.js';

describe('Credit Scoring Service', () => {
  describe('Canonical Formula & Bounds', () => {
    it('calculates minimum score correctly (all inputs = 0 -> score = 300)', () => {
      const result = calculateCreditScore({
        incomeIndex: 0,
        repaymentIndex: 0,
        historyIndex: 0,
      });

      expect(result.score).toBe(300);
      expect(result.score).toBe(MIN_CREDIT_SCORE);
      expect(result.modelVersion).toBe(CREDIT_MODEL_VERSION);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
      expect(result.disclaimer).toContain('demonstrative scoring model');
    });

    it('calculates maximum score correctly (all inputs = 100 -> score = 1300)', () => {
      const result = calculateCreditScore({
        incomeIndex: 100,
        repaymentIndex: 100,
        historyIndex: 100,
      });

      // 300 + 5*100 + 3*100 + 2*100 = 300 + 500 + 300 + 200 = 1300
      expect(result.score).toBe(1300);
      expect(result.score).toBe(MAX_CREDIT_SCORE);
      expect(result.modelVersion).toBe(1);
    });

    it('calculates representative median inputs (50, 50, 50 -> 800)', () => {
      // 300 + 5*50 + 3*50 + 2*50 = 300 + 250 + 150 + 100 = 800
      const result = calculateCreditScore({
        incomeIndex: 50,
        repaymentIndex: 50,
        historyIndex: 50,
      });
      expect(result.score).toBe(800);
    });

    it('calculates asymmetric representative inputs accurately', () => {
      // income=80, repayment=40, history=20 -> 300 + 5*80 + 3*40 + 2*20 = 300 + 400 + 120 + 40 = 860
      const result = calculateCreditScore({
        incomeIndex: 80,
        repaymentIndex: 40,
        historyIndex: 20,
      });
      expect(result.score).toBe(860);
    });

    it('guarantees deterministic integer arithmetic', () => {
      for (let i = 0; i < 10; i++) {
        const result = calculateCreditScore({
          incomeIndex: 73,
          repaymentIndex: 61,
          historyIndex: 45,
        });
        // 300 + 5*73 + 3*61 + 2*45 = 300 + 365 + 183 + 90 = 938
        expect(result.score).toBe(938);
        expect(Number.isInteger(result.score)).toBe(true);
      }
    });
  });

  describe('Input Validation & Rejection', () => {
    it('rejects missing inputs', () => {
      expect(() =>
        calculateCreditScore({
          incomeIndex: 50,
          repaymentIndex: 50,
          // historyIndex missing
        })
      ).toThrowError(/historyIndex is missing/);
    });

    it('rejects null and undefined objects', () => {
      expect(() => calculateCreditScore(null)).toThrowError(/Inputs must be an object/);
      expect(() => calculateCreditScore(undefined)).toThrowError(/Inputs must be an object/);
    });

    it('rejects negative numbers', () => {
      expect(() =>
        calculateCreditScore({
          incomeIndex: -1,
          repaymentIndex: 50,
          historyIndex: 50,
        })
      ).toThrowError(/incomeIndex must be between 0 and 100/);
    });

    it('rejects values exceeding 100', () => {
      expect(() =>
        calculateCreditScore({
          incomeIndex: 101,
          repaymentIndex: 50,
          historyIndex: 50,
        })
      ).toThrowError(/incomeIndex must be between 0 and 100/);
    });

    it('rejects fractional numbers', () => {
      expect(() =>
        calculateCreditScore({
          incomeIndex: 50.5,
          repaymentIndex: 50,
          historyIndex: 50,
        })
      ).toThrowError(/incomeIndex must be an integer, received fractional value 50.5/);
    });

    it('rejects non-numeric values', () => {
      expect(() =>
        calculateCreditScore({
          incomeIndex: '50' as any,
          repaymentIndex: 50,
          historyIndex: 50,
        })
      ).toThrowError(/incomeIndex must be a valid finite number/);
    });

    it('validates multiple errors simultaneously in validateCreditInputs', () => {
      const validation = validateCreditInputs({
        incomeIndex: -5,
        repaymentIndex: 120,
        historyIndex: 3.14,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(3);
    });
  });
});
