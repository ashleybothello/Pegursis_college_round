import { describe, it, expect, beforeAll } from 'vitest';
import {
  mapIndicesToCircuitFeatures,
  calculateCircuitScore,
  calculateZkScore,
  ZK_FEATURE_MAPPING,
  MODEL_CONFIG,
} from '../../src/services/zkCreditScoring.js';
import fs from 'fs';

describe('ZK Credit Scoring (Circuit-Aware)', () => {
  it('should correctly map financial indices to circuit features', () => {
    const inputs = { incomeIndex: 70, repaymentIndex: 80, historyIndex: 90 };
    const features = mapIndicesToCircuitFeatures(inputs);
    // Mapping: paymentHistory=repaymentIndex, incomeStability=incomeIndex, debtHeadroom=historyIndex
    expect(features.paymentHistory).toBe(80);
    expect(features.incomeStability).toBe(70);
    expect(features.debtHeadroom).toBe(90);
  });

  it('should compute circuit score with correct formula', () => {
    const inputs = { incomeIndex: 70, repaymentIndex: 80, historyIndex: 90 };
    const zk = calculateZkScore(inputs);
    // Circuit: 300 + 3*paymentHistory(80) + 2*incomeStability(70) + debtHeadroom(90)
    // = 300 + 240 + 140 + 90 = 770
    expect(zk.score).toBe(770);
    expect(zk.modelVersion).toBe(1);
  });

  it('should differ from legacy formula (not silently equivalent)', () => {
    const inputs = { incomeIndex: 70, repaymentIndex: 80, historyIndex: 90 };
    // Legacy: 300 + 5*70 + 3*80 + 2*90 = 300 + 350 + 240 + 180 = 1070
    const legacyScore = 300 + 5 * 70 + 3 * 80 + 2 * 90;
    const zk = calculateZkScore(inputs);
    expect(legacyScore).toBe(1070);
    expect(zk.score).toBe(770);
    expect(zk.score).not.toBe(legacyScore);
  });

  it('should have model config loaded from disk', () => {
    expect(MODEL_CONFIG.baseScore).toBe(300);
    expect(MODEL_CONFIG.weights.paymentHistory).toBe(3);
    expect(MODEL_CONFIG.weights.incomeStability).toBe(2);
    expect(MODEL_CONFIG.weights.debtHeadroom).toBe(1);
    expect(MODEL_CONFIG.modelId).toBe(1);
  });

  it('should have correct public signal order', () => {
    expect(MODEL_CONFIG.publicSignalOrder).toEqual([
      'claimedScore',
      'modelId',
      'taskId',
      'inputCommitment',
    ]);
  });

  it('should compute circuit score for edge cases', () => {
    // All zeros
    const zero = calculateZkScore({ incomeIndex: 0, repaymentIndex: 0, historyIndex: 0 });
    expect(zero.score).toBe(300);

    // All max
    const max = calculateZkScore({ incomeIndex: 100, repaymentIndex: 100, historyIndex: 100 });
    // 300 + 3*100 + 2*100 + 100 = 900
    expect(max.score).toBe(900);
  });

  it('should have distinct circuit score for different inputs', () => {
    const a = calculateZkScore({ incomeIndex: 50, repaymentIndex: 50, historyIndex: 50 });
    const b = calculateZkScore({ incomeIndex: 51, repaymentIndex: 50, historyIndex: 50 });
    expect(a.score).not.toBe(b.score);
  });
});