import { describe, it, expect, vi } from 'vitest';
import { VerificationOrchestrator } from '../../src/services/verificationOrchestrator.js';
import { MockProofService } from '../../src/services/proofService.js';
import { MockBlockchainService } from '../../src/services/blockchainService.js';

describe('Verification Orchestrator Service', () => {
  it('orchestrates complete verification workflow in mock mode', async () => {
    const proofService = new MockProofService();
    const blockchainService = new MockBlockchainService();

    const orchestrator = new VerificationOrchestrator({
      proofService,
      blockchainService,
      proofMode: 'mock',
      blockchainMode: 'mock',
    });

    const inputs = {
      incomeIndex: 80,
      repaymentIndex: 70,
      historyIndex: 90,
    };
    // Expected score = 300 + 5*80 + 3*70 + 2*90 = 300 + 400 + 210 + 180 = 1090

    const response = await orchestrator.submitVerification(inputs);

    expect(response.taskId).toBeDefined();
    expect(response.commitment).toBeDefined();
    expect(response.score).toBe(1090);
    expect(response.modelVersion).toBe(1);
    expect(response.status).toBe('mock');
    expect(response.transactions.taskCreationTx).toBeDefined();
    expect(response.transactions.proofSubmissionTx).toBeDefined();
    expect(response.proofMode).toBe('mock');
    expect(response.blockchainMode).toBe('mock');

    // Verify task status lookup
    const lookup = await orchestrator.getVerificationStatus(response.taskId);
    expect(lookup).not.toBeNull();
    expect(lookup?.score).toBe(1090);
    expect(lookup?.status).toBe('mock');
  });

  it('rejects verification if proof service returns mismatched public signals', async () => {
    const proofService = new MockProofService();
    // Spy on generateProof to return wrong score
    vi.spyOn(proofService, 'generateProof').mockResolvedValueOnce({
      proof: {
        a: ['0x1', '0x2'],
        b: [['0x3', '0x4'], ['0x5', '0x6']],
        c: ['0x7', '0x8'],
        publicSignals: ['9999', '1'], // 9999 is wrong
      },
      publicSignals: ['9999', '1'],
      score: 9999,
      modelVersion: 1,
      isMock: true,
      generatedAt: new Date().toISOString(),
    });

    const blockchainService = new MockBlockchainService();
    const orchestrator = new VerificationOrchestrator({
      proofService,
      blockchainService,
      proofMode: 'mock',
      blockchainMode: 'mock',
    });

    await expect(
      orchestrator.submitVerification({
        incomeIndex: 50,
        repaymentIndex: 50,
        historyIndex: 50,
      })
    ).rejects.toThrowError(/Public signals mismatch/);
  });

  it('handles partial failure: task created but proof submission fails', async () => {
    const proofService = new MockProofService();
    const blockchainService = new MockBlockchainService();

    // Mock submitProof to fail
    vi.spyOn(blockchainService, 'submitProof').mockRejectedValueOnce(
      new Error('Smart contract transaction reverted in submitProof')
    );

    const orchestrator = new VerificationOrchestrator({
      proofService,
      blockchainService,
      proofMode: 'mock',
      blockchainMode: 'mock',
    });

    await expect(
      orchestrator.submitVerification({
        incomeIndex: 50,
        repaymentIndex: 50,
        historyIndex: 50,
      })
    ).rejects.toThrowError(/Smart contract transaction reverted/);
  });

  it('returns null for non-existent verification task ID', async () => {
    const proofService = new MockProofService();
    const blockchainService = new MockBlockchainService();
    const orchestrator = new VerificationOrchestrator({
      proofService,
      blockchainService,
      proofMode: 'mock',
      blockchainMode: 'mock',
    });

    const task = await orchestrator.getVerificationStatus('0x' + '0'.repeat(64));
    expect(task).toBeNull();
  });
});
