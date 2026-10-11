import { describe, it, expect } from 'vitest';
import { calculateEmi, roundToTwoDecimals } from '../../src/services/emiCalculator.js';

describe('EMI and Loan Calculator Service', () => {
  describe('Standard Reducing-Balance Calculations', () => {
    it('calculates standard loan EMI, total repayment, and total interest correctly', () => {
      // Principal = $100,000, Annual Rate = 10%, Tenure = 12 months
      // r = 10 / 1200 = 0.008333333333333333
      // factor = (1 + r)^12 = 1.10471306744
      // EMI = 100000 * r * factor / (factor - 1) = 8791.59
      const result = calculateEmi({
        principal: 100000,
        annualInterestRate: 10,
        tenureMonths: 12,
      });

      expect(result.monthlyEmi).toBe(8791.59);
      expect(result.totalRepayment).toBe(105499.08);
      expect(result.totalInterest).toBe(5499.08);
      expect(result.currencyUnit).toBe('USD');
      expect(result.assumptions.length).toBeGreaterThan(0);
    });

    it('calculates small loan accurately with correct rounding', () => {
      // Principal = $1,000, Annual Rate = 12%, Tenure = 6 months
      // Monthly interest = 1%
      // EMI should be 172.55
      const result = calculateEmi({
        principal: 1000,
        annualInterestRate: 12,
        tenureMonths: 6,
      });

      expect(result.monthlyEmi).toBe(172.55);
      expect(result.totalRepayment).toBe(1035.30);
      expect(result.totalInterest).toBe(35.30);
    });
  });

  describe('Zero-Interest Loan Handling', () => {
    it('calculates zero-interest loan with no interest charged', () => {
      const result = calculateEmi({
        principal: 12000,
        annualInterestRate: 0,
        tenureMonths: 12,
      });

      expect(result.monthlyEmi).toBe(1000.00);
      expect(result.totalRepayment).toBe(12000.00);
      expect(result.totalInterest).toBe(0.00);
    });

    it('handles zero-interest loan requiring rounding division (e.g. 1000 over 3 months)', () => {
      const result = calculateEmi({
        principal: 1000,
        annualInterestRate: 0,
        tenureMonths: 3,
      });

      expect(result.monthlyEmi).toBe(333.33);
      expect(result.totalRepayment).toBe(999.99);
      expect(result.totalInterest).toBe(0.00);
    });
  });

  describe('Input Validation & Edge Cases', () => {
    it('rejects non-positive principal', () => {
      expect(() =>
        calculateEmi({
          principal: 0,
          annualInterestRate: 5,
          tenureMonths: 12,
        })
      ).toThrowError(/Principal must be a positive finite number/);

      expect(() =>
        calculateEmi({
          principal: -5000,
          annualInterestRate: 5,
          tenureMonths: 12,
        })
      ).toThrowError(/Principal must be a positive finite number/);
    });

    it('rejects negative interest rate', () => {
      expect(() =>
        calculateEmi({
          principal: 10000,
          annualInterestRate: -1,
          tenureMonths: 12,
        })
      ).toThrowError(/Annual interest rate cannot be negative/);
    });

    it('rejects invalid tenure months', () => {
      expect(() =>
        calculateEmi({
          principal: 10000,
          annualInterestRate: 5,
          tenureMonths: 0,
        })
      ).toThrowError(/Tenure months must be an integer of at least 1/);

      expect(() =>
        calculateEmi({
          principal: 10000,
          annualInterestRate: 5,
          tenureMonths: 3.5,
        })
      ).toThrowError(/Tenure months must be an integer of at least 1/);
    });

    it('helper roundToTwoDecimals functions accurately', () => {
      expect(roundToTwoDecimals(10.555)).toBe(10.56);
      expect(roundToTwoDecimals(10.554)).toBe(10.55);
      expect(roundToTwoDecimals(0)).toBe(0);
    });
  });
});
