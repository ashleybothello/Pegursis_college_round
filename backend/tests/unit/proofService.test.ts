import { describe, it, expect } from 'vitest';
import {
  MockProofService,
  Groth16ProofService,
  formatSnarkjsProofForSolidity,
} from '../../src/services/proofService.js';

describe('Proof Service', () => {
  describe('MockProofService', () => {
    const mockService = new MockProofService();

    it('generates mock proof with correct public signals and coordinates', async () => {
      const inputs = {
        incomeIndex: 60,
        repaymentIndex: 70,
        historyIndex: 80,
      };
      // expected score = 300 + 5*60 + 3*70 + 2*80 = 300 + 300 + 210 + 160 = 970
      const result = await mockService.generateProof(inputs);

      expect(result.isMock).toBe(true);
      expect(result.score).toBe(970);
      expect(result.modelVersion).toBe(1);
      expect(result.publicSignals).toEqual(['970', '1']);

      // Check Solidity format coordinates
      expect(result.proof.a).toHaveLength(2);
      expect(result.proof.b).toHaveLength(2);
      expect(result.proof.b[0]).toHaveLength(2);
      expect(result.proof.b[1]).toHaveLength(2);
      expect(result.proof.c).toHaveLength(2);
    });

    it('verifies valid mock proof', async () => {
      const result = await mockService.generateProof({
        incomeIndex: 10,
        repaymentIndex: 10,
        historyIndex: 10,
      });

      const isValid = await mockService.verifyProof(result.proof, result.publicSignals);
      expect(isValid).toBe(true);
    });

    it('rejects mock proof with wrong model version', async () => {
      const result = await mockService.generateProof({
        incomeIndex: 10,
        repaymentIndex: 10,
        historyIndex: 10,
      });

      // Tamper model version in public signals
      const tamperedSignals = [result.publicSignals[0], '2'];
      const isValid = await mockService.verifyProof(result.proof, tamperedSignals);
      expect(isValid).toBe(false);
    });

    it('rejects mock proof with out-of-range score in public signals', async () => {
      const result = await mockService.generateProof({
        incomeIndex: 10,
        repaymentIndex: 10,
        historyIndex: 10,
      });

      // Tamper score to 200 (below min 300)
      const tamperedSignals = ['200', '1'];
      const isValid = await mockService.verifyProof(result.proof, tamperedSignals);
      expect(isValid).toBe(false);
    });
  });

  describe('formatSnarkjsProofForSolidity', () => {
    it('properly formats raw snarkjs proof into Solidity ecPairing structure', () => {
      const rawProof = {
        pi_a: ['100', '200', '1'],
        pi_b: [
          ['10', '20'], // In snarkjs, this is [x_re, x_im]
          ['30', '40'],
          ['1', '0'],
        ],
        pi_c: ['500', '600', '1'],
      };
      const publicSignals = ['800', '1'];

      const solidityProof = formatSnarkjsProofForSolidity(rawProof, publicSignals);

      expect(solidityProof.a).toEqual(['100', '200']);
      // Notice: pi_b coordinates are transposed to [[x_im, x_re], [y_im, y_re]] for Solidity
      expect(solidityProof.b[0]).toEqual(['20', '10']);
      expect(solidityProof.b[1]).toEqual(['40', '30']);
      expect(solidityProof.c).toEqual(['500', '600']);
      expect(solidityProof.publicSignals).toEqual(['800', '1']);
    });
  });

  describe('Groth16ProofService Missing Artifacts Validation', () => {
    it('accurately identifies and reports missing circuit artifacts without claiming mock success', async () => {
      const realService = new Groth16ProofService({
        circuitWasmPath: '/non/existent/credit_score.wasm',
        circuitZkeyPath: '/non/existent/credit_score.zkey',
        verificationKeyPath: '/non/existent/vkey.json',
      });

      const check = realService.checkArtifacts();
      expect(check.ready).toBe(false);
      expect(check.missingFiles.length).toBe(2);

      await expect(
        realService.generateProof({
          incomeIndex: 50,
          repaymentIndex: 50,
          historyIndex: 50,
        })
      ).rejects.toThrowError(/Missing circuit artifacts/);
    });
  });
});
