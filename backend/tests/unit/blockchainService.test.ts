import { describe, it, expect } from 'vitest';
import {
  MockBlockchainService,
  EthersBlockchainService,
  computeInputCommitment,
  computeTaskId,
  COMMITMENT_DOMAIN_TAG,
  TASK_DOMAIN_TAG,
} from '../../src/services/blockchainService.js';
import { SolidityProof } from '../../src/types/index.js';

describe('Blockchain Service', () => {
  describe('Commitment and Task ID Hashing', () => {
    it('computes deterministic, domain-separated input commitment', () => {
      const inputs = { incomeIndex: 50, repaymentIndex: 60, historyIndex: 70 };
      const commitment1 = computeInputCommitment(inputs, 1);
      const commitment2 = computeInputCommitment(inputs, 1);

      expect(commitment1).toBe(commitment2);
      expect(commitment1.startsWith('0x')).toBe(true);
      expect(commitment1).toHaveLength(66); // 32-byte hex string
    });

    it('changes commitment when any single input changes', () => {
      const base = { incomeIndex: 50, repaymentIndex: 50, historyIndex: 50 };
      const cBase = computeInputCommitment(base, 1);

      const cDiffIncome = computeInputCommitment({ ...base, incomeIndex: 51 }, 1);
      const cDiffRepayment = computeInputCommitment({ ...base, repaymentIndex: 51 }, 1);
      const cDiffHistory = computeInputCommitment({ ...base, historyIndex: 51 }, 1);
      const cDiffVersion = computeInputCommitment(base, 2);

      expect(cDiffIncome).not.toBe(cBase);
      expect(cDiffRepayment).not.toBe(cBase);
      expect(cDiffHistory).not.toBe(cBase);
      expect(cDiffVersion).not.toBe(cBase);
    });

    it('derives unique task IDs for different nonces', () => {
      const commitment = computeInputCommitment({ incomeIndex: 10, repaymentIndex: 10, historyIndex: 10 }, 1);
      const taskId1 = computeTaskId(commitment, 1);
      const taskId2 = computeTaskId(commitment, 2);

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1.startsWith('0x')).toBe(true);
      expect(taskId1).toHaveLength(66);
    });
  });

  describe('MockBlockchainService Lifecycle & Idempotency', () => {
    const validProof: SolidityProof = {
      a: ['0x1', '0x2'],
      b: [
        ['0x3', '0x4'],
        ['0x5', '0x6'],
      ],
      c: ['0x7', '0x8'],
      publicSignals: ['800', '1'],
    };

    it('creates task and retrieves it', async () => {
      const service = new MockBlockchainService();
      const taskId = '0x' + 'a'.repeat(64);
      const commitment = '0x' + 'b'.repeat(64);

      const result = await service.createTask(taskId, commitment);
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(taskId);
      expect(result.txHash).toBeDefined();

      const task = await service.getTask(taskId);
      expect(task).not.toBeNull();
      expect(task?.status).toBe('TASK_CREATED');
      expect(task?.commitment).toBe(commitment);
    });

    it('handles idempotent createTask retries gracefully', async () => {
      const service = new MockBlockchainService();
      const taskId = '0x' + '1'.repeat(64);
      const commitment = '0x' + '2'.repeat(64);

      const first = await service.createTask(taskId, commitment);
      const second = await service.createTask(taskId, commitment);

      expect(second.success).toBe(true);
      expect(second.message).toContain('idempotent');
      expect(second.txHash).toBe(first.txHash);
    });

    it('rejects conflicting task creation with different commitment for same taskId', async () => {
      const service = new MockBlockchainService();
      const taskId = '0x' + '3'.repeat(64);
      const commitment1 = '0x' + '4'.repeat(64);
      const commitment2 = '0x' + '5'.repeat(64);

      await service.createTask(taskId, commitment1);

      await expect(service.createTask(taskId, commitment2)).rejects.toThrowError(
        /Conflict: taskId .* already exists with a different commitment/
      );
    });

    it('submits proof and marks task as VERIFIED', async () => {
      const service = new MockBlockchainService();
      const taskId = '0x' + '6'.repeat(64);
      const commitment = '0x' + '7'.repeat(64);

      await service.createTask(taskId, commitment);
      const submitResult = await service.submitProof(taskId, validProof);

      expect(submitResult.success).toBe(true);
      expect(submitResult.verified).toBe(true);

      const task = await service.getTask(taskId);
      expect(task?.status).toBe('VERIFIED');
      expect(task?.score).toBe(800);
      expect(task?.modelVersion).toBe(1);
    });

    it('handles idempotent submitProof calls', async () => {
      const service = new MockBlockchainService();
      const taskId = '0x' + '8'.repeat(64);
      const commitment = '0x' + '9'.repeat(64);

      await service.createTask(taskId, commitment);
      const first = await service.submitProof(taskId, validProof);
      const second = await service.submitProof(taskId, validProof);

      expect(second.success).toBe(true);
      expect(second.message).toContain('idempotent');
      expect(second.txHash).toBe(first.txHash);
    });

    it('rejects submitProof for non-existent task', async () => {
      const service = new MockBlockchainService();
      const nonExistentTaskId = '0x' + 'f'.repeat(64);

      await expect(service.submitProof(nonExistentTaskId, validProof)).rejects.toThrowError(
        /Task .* not found/
      );
    });
  });

  describe('EthersBlockchainService Unreachable Node Handling', () => {
    it('reports descriptive error when contract bytecode or RPC is unavailable', async () => {
      const ethersService = new EthersBlockchainService({
        rpcUrl: 'http://127.0.0.1:9999', // inactive port
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        abiPath: './src/config/abis/VerityVerifier.json',
      });

      await expect(
        ethersService.createTask('0x' + '1'.repeat(64), '0x' + '2'.repeat(64))
      ).rejects.toThrowError(/Unable to connect to Ethereum RPC/);
    });
  });
});
