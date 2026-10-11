import { describe, it, expect, beforeAll } from 'vitest';
import { ZkCreditProofService } from '../../src/services/zkProofService.js';
import { calculateZkScore } from '../../src/services/zkCreditScoring.js';
import path from 'path';
import fs from 'fs';

// Real ZK generation test - requires actual circuit artifacts
describe('ZK Real Proof Generation (Genuine Circuit)', () => {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const wasmPath = path.join(projectRoot, 'build', 'credit_score_js', 'credit_score.wasm');
  const zkeyPath = path.join(projectRoot, 'build', 'credit_score_final.zkey');
  const vkeyPath = path.join(projectRoot, 'build', 'verification_key.json');

  it('should have circuit artifacts available', () => {
    expect(fs.existsSync(wasmPath)).toBe(true);
    expect(fs.existsSync(zkeyPath)).toBe(true);
    expect(fs.existsSync(vkeyPath)).toBe(true);
  });

  it('should generate a real ZK proof for valid inputs', async () => {
    const service = new ZkCreditProofService({
      circuitWasmPath: wasmPath,
      circuitZkeyPath: zkeyPath,
      verificationKeyPath: vkeyPath,
    });

    const inputs = { incomeIndex: 70, repaymentIndex: 80, historyIndex: 90 };
    const result = await service.generateProof(inputs);

    // Verify circuit score matches expectation
    const zkCalc = calculateZkScore(inputs);
    expect(result.score).toBe(zkCalc.score); // 770
    expect(result.modelVersion).toBe(1);
    expect(result.isMock).toBe(false);
    expect(result.publicSignals).toHaveLength(4);
    // Public signal order: [claimedScore, modelId, taskId, inputCommitment]
    expect(Number(result.publicSignals[0])).toBe(770);
    expect(Number(result.publicSignals[1])).toBe(1);
    expect(result.proof.a).toHaveLength(2);
    expect(result.proof.b).toHaveLength(2);
    expect(result.proof.c).toHaveLength(2);
  }, 30000);

  it('should verify its own proof off-chain', async () => {
    const service = new ZkCreditProofService({
      circuitWasmPath: wasmPath,
      circuitZkeyPath: zkeyPath,
      verificationKeyPath: vkeyPath,
    });

    const inputs = { incomeIndex: 50, repaymentIndex: 60, historyIndex: 70 };
    const result = await service.generateProof(inputs);

    const isValid = await service.verifyProof(result.proof, result.publicSignals);
    expect(isValid).toBe(true);

    // Tampered signal should fail
    const tampered = [...result.publicSignals];
    tampered[0] = (Number(tampered[0]) + 1).toString();
    const tamperedValid = await service.verifyProof(result.proof, tampered);
    expect(tamperedValid).toBe(false);
  }, 30000);

  it('should check artifacts correctly', () => {
    const badService = new ZkCreditProofService({
      circuitWasmPath: '/nonexistent.wasm',
      circuitZkeyPath: '/nonexistent.zkey',
      verificationKeyPath: '/nonexistent.json',
    });

    const check = badService.checkArtifacts();
    expect(check.ready).toBe(false);
    expect(check.missingFiles.length).toBe(3);
  });
});