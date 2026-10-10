import { describe, it, expect } from 'vitest';
import {
  calculateSettlement,
  DEFAULT_FEE_BASIS_POINTS,
  DEFAULT_FIXED_FEE_MINOR_UNITS,
} from '../../src/services/settlement.js';

describe('Payment Settlement Service', () => {
  describe('Fee Calculation and Rounding', () => {
    it('calculates standard settlement accurately using minor units', () => {
      // Gross = 10000 cents ($100.00)
      // Fee = 2.5% (250 bps) = 250 cents + 30 cents fixed = 280 cents ($2.80)
      // Net = 10000 - 280 = 9720 cents ($97.20)
      const result = calculateSettlement({
        grossAmount: 10000,
        feeBasisPoints: DEFAULT_FEE_BASIS_POINTS,
        fixedFeeMinorUnits: DEFAULT_FIXED_FEE_MINOR_UNITS,
        currency: 'USD',
      });

      expect(result.grossAmount).toBe(10000);
      expect(result.feeAmount).toBe(280);
      expect(result.netAmount).toBe(9720);
      expect(result.status).toBe('SETTLED');
      expect(result.feeBreakdown.basisPointsFee).toBe(250);
      expect(result.feeBreakdown.fixedFee).toBe(30);
      expect(result.feeBreakdown.effectiveRatePercent).toBe(2.8);
      expect(result.currency).toBe('USD');
    });

    it('performs deterministic half-up rounding on fractional basis points fee', () => {
      // Gross = 105 cents, feeBasisPoints = 250 (2.5%)
      // 105 * 250 = 26250 / 10000 = 2.625 cents -> rounds to 3 cents
      // Fixed fee = 10 cents
      // Total fee = 13 cents
      // Net = 105 - 13 = 92 cents
      const result = calculateSettlement({
        grossAmount: 105,
        feeBasisPoints: 250,
        fixedFeeMinorUnits: 10,
      });

      expect(result.feeBreakdown.basisPointsFee).toBe(3);
      expect(result.feeAmount).toBe(13);
      expect(result.netAmount).toBe(92);
      expect(result.status).toBe('SETTLED');
    });

    it('handles zero fee basis points and zero fixed fee', () => {
      const result = calculateSettlement({
        grossAmount: 5000,
        feeBasisPoints: 0,
        fixedFeeMinorUnits: 0,
      });

      expect(result.feeAmount).toBe(0);
      expect(result.netAmount).toBe(5000);
      expect(result.status).toBe('SETTLED');
    });
  });

  describe('Edge Cases & Small Payments', () => {
    it('marks status as HELD when fee equals or exceeds gross amount', () => {
      // Gross = 25 cents, Fixed fee = 30 cents -> Fee exceeds gross
      const result = calculateSettlement({
        grossAmount: 25,
        feeBasisPoints: 250,
        fixedFeeMinorUnits: 30,
      });

      expect(result.grossAmount).toBe(25);
      expect(result.feeAmount).toBe(31); // 1 cent bps + 30 cents fixed
      expect(result.netAmount).toBe(0);
      expect(result.status).toBe('HELD');
    });
  });

  describe('Input Validation & Rejections', () => {
    it('rejects non-integer gross amount', () => {
      expect(() =>
        calculateSettlement({
          grossAmount: 100.5,
        })
      ).toThrowError(/grossAmount must be a positive integer in minor units/);
    });

    it('rejects zero or negative gross amount', () => {
      expect(() =>
        calculateSettlement({
          grossAmount: 0,
        })
      ).toThrowError(/grossAmount must be a positive integer in minor units/);

      expect(() =>
        calculateSettlement({
          grossAmount: -100,
        })
      ).toThrowError(/grossAmount must be a positive integer in minor units/);
    });

    it('rejects invalid feeBasisPoints', () => {
      expect(() =>
        calculateSettlement({
          grossAmount: 1000,
          feeBasisPoints: -10,
        })
      ).toThrowError(/feeBasisPoints must be an integer between 0 and 10000/);

      expect(() =>
        calculateSettlement({
          grossAmount: 1000,
          feeBasisPoints: 10001,
        })
      ).toThrowError(/feeBasisPoints must be an integer between 0 and 10000/);
    });

    it('rejects negative fixed fee', () => {
      expect(() =>
        calculateSettlement({
          grossAmount: 1000,
          fixedFeeMinorUnits: -5,
        })
      ).toThrowError(/fixedFeeMinorUnits must be a non-negative integer/);
    });
  });
});
