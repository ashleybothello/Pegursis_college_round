import {
  BlockchainService,
  CreditScoringInputs,
  ProofService,
  VerificationState,
  VerificationSubmissionResponse,
  ChainAuditEvent,
  DisputeRecord,
  BlockchainActionResult,
} from '../types/index.js';
import { calculateCreditScore } from './creditScoring.js';
import { computeInputCommitment, computeTaskId } from './blockchainService.js';
import { calculateZkScore } from './zkCreditScoring.js';

export interface OrchestratorRecord {
  taskId: string;
  commitment: string;
  score: number;
  modelVersion: number;
  status: VerificationState;
  transactions: {
    taskCreationTx?: string;
    proofSubmissionTx?: string;
  };
  proofMode: 'mock' | 'real';
  blockchainMode: 'mock' | 'real';
  createdAt: string;
  updatedAt: string;
  message: string;
}

export class VerificationOrchestrator {
  private proofService: ProofService;
  private blockchainService: BlockchainService;
  private proofMode: 'mock' | 'real';
  private blockchainMode: 'mock' | 'real';

  private registry = new Map<string, OrchestratorRecord>();

  constructor(options: {
    proofService: ProofService;
    blockchainService: BlockchainService;
    proofMode: 'mock' | 'real';
    blockchainMode: 'mock' | 'real';
  }) {
    this.proofService = options.proofService;
    this.blockchainService = options.blockchainService;
    this.proofMode = options.proofMode;
    this.blockchainMode = options.blockchainMode;
  }

  /**
   * Orchestrates the complete end-to-end verification pipeline.
   * Routes to the legacy (mock/keccak) path when PROOF_MODE=mock and to
   * the real ZK circuit path when PROOF_MODE=real.
   */
  async submitVerification(
    inputs: CreditScoringInputs,
    salt?: string
  ): Promise<VerificationSubmissionResponse> {
    // Real ZK path
    if (this.proofMode === 'real') {
      return this.submitZkVerification(inputs, salt);
    }
    return this.submitLegacyVerification(inputs, salt);
  }

  /**
   * Legacy path — preserves 100% backward compatibility with the existing
   * financial indices formula and keccak commitment. This path keeps the
   * 69 baseline tests green.
   */
  private async submitLegacyVerification(
    inputs: CreditScoringInputs,
    salt?: string
  ): Promise<VerificationSubmissionResponse> {
    const nowIso = new Date().toISOString();

    const creditCalc = calculateCreditScore(inputs);
    const expectedScore = creditCalc.score;
    const expectedModelVersion = creditCalc.modelVersion;

    const commitment = computeInputCommitment(inputs, expectedModelVersion, salt);
    const taskId = computeTaskId(commitment, Date.now());

    const record: OrchestratorRecord = {
      taskId,
      commitment,
      score: expectedScore,
      modelVersion: expectedModelVersion,
      status: 'pending',
      transactions: {},
      proofMode: this.proofMode,
      blockchainMode: this.blockchainMode,
      createdAt: nowIso,
      updatedAt: nowIso,
      message: 'Verification pipeline initiated',
    };
    this.registry.set(taskId, record);

    try {
      const proofResult = await this.proofService.generateProof(inputs);
      record.status = 'proof_generated';
      record.updatedAt = new Date().toISOString();

      const scoreInSignal = Number(proofResult.publicSignals[0]);
      const versionInSignal = Number(proofResult.publicSignals[1]);

      if (scoreInSignal !== expectedScore || versionInSignal !== expectedModelVersion) {
        record.status = 'rejected';
        record.message = `Public signals mismatch: expected [${expectedScore}, ${expectedModelVersion}], got [${scoreInSignal}, ${versionInSignal}]`;
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }

      const taskCreationResult = await this.blockchainService.createTask(taskId, commitment);
      if (!taskCreationResult.success) {
        record.status = 'failed';
        record.message = taskCreationResult.message ?? 'On-chain task creation failed';
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }

      record.transactions.taskCreationTx = taskCreationResult.txHash;
      record.status = 'task_created';
      record.updatedAt = new Date().toISOString();

      let submissionResult;
      try {
        submissionResult = await this.blockchainService.submitProof(
          taskId,
          proofResult.proof
        );
      } catch (submitErr: any) {
        record.status = 'task_created';
        record.message = `Task created on-chain (${taskCreationResult.txHash}), but proof submission failed: ${submitErr.message}`;
        record.updatedAt = new Date().toISOString();
        throw submitErr;
      }

      record.transactions.proofSubmissionTx = submissionResult.txHash;

      if (submissionResult.verified) {
        if (this.proofMode === 'mock' || this.blockchainMode === 'mock') {
          record.status = 'mock';
          record.message =
            'Proof generated and accepted in MOCK mode. Run with PROOF_MODE=real and BLOCKCHAIN_MODE=real for genuine ZK on-chain verification.';
        } else {
          record.status = 'verified';
          record.message =
            'Proof successfully verified by on-chain Solidity Groth16 verifier and confirmed on-chain.';
        }
      } else {
        record.status = 'rejected';
        record.message = submissionResult.message ?? 'Proof verification rejected on-chain';
      }

      record.updatedAt = new Date().toISOString();
      return { ...record };
    } catch (err: any) {
      if (record.status !== 'task_created' && record.status !== 'rejected') {
        record.status = 'failed';
      }
      record.message = err.message ?? 'Verification workflow encountered an error';
      record.updatedAt = new Date().toISOString();
      throw err;
    }
  }

  /**
   * Real ZK circuit path.
   * The circuit formula `300 + 3*paymentHistory + 2*incomeStability + 1*debtHeadroom`
   * is authoritative. Private indices are mapped to circuit features via
   * ZK_FEATURE_MAPPING, Salt and taskId are folded into the Poseidon
   * commitment inside the circuit, so the proof is cryptographically bound
   * to the on-chain task.
   */
  private async submitZkVerification(
    inputs: CreditScoringInputs,
    salt?: string
  ): Promise<VerificationSubmissionResponse> {
    const nowIso = new Date().toISOString();

    const zkCalc = calculateZkScore(inputs); // circuit score + model 1
    const expectedScore = zkCalc.score;
    const expectedModelVersion = zkCalc.modelVersion;

    const record: OrchestratorRecord = {
      taskId: '',
      commitment: '',
      score: expectedScore,
      modelVersion: expectedModelVersion,
      status: 'pending',
      transactions: {},
      proofMode: this.proofMode,
      blockchainMode: this.blockchainMode,
      createdAt: nowIso,
      updatedAt: nowIso,
      message: 'ZK verification pipeline initiated',
    };

    try {
      // Generate real circuit proof. The service computes Poseidon commitment,
      // taskId, and public signals internally. It also enforces artifact
      // availability and fails with 503 if the circuit is missing.
      const proofResult = await this.proofService.generateProof(inputs);

      // The ZK service returns 4-signal tuples; use its commitment + taskId.
      // Fall back to signal indices if the service omits them (forward compat).
      const commitment =
        (proofResult as any).commitment ?? proofResult.publicSignals[3];
      const taskId =
        (proofResult as any).taskId ?? proofResult.publicSignals[2];

      record.taskId = String(taskId);
      record.commitment = String(commitment);
      this.registry.set(record.taskId, record);
      record.status = 'proof_generated';
      record.updatedAt = new Date().toISOString();

      // Validate circuit signals before any on-chain mutation
      if (proofResult.publicSignals.length < 4) {
        record.status = 'rejected';
        record.message = `Insufficient public signals: expected 4, got ${proofResult.publicSignals.length}`;
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }
      const scoreInSignal = Number(proofResult.publicSignals[0]);
      if (scoreInSignal !== expectedScore) {
        record.status = 'rejected';
        record.message = `Public signals mismatch: expected score ${expectedScore}, got ${scoreInSignal}`;
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }

      const versionInSignal = Number(proofResult.publicSignals[1]);
      if (versionInSignal !== expectedModelVersion) {
        record.status = 'rejected';
        record.message = `Public signals mismatch: expected model ${expectedModelVersion}, got ${versionInSignal}`;
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }

      // Create task on-chain
      const taskCreationResult = await this.blockchainService.createTask(
        record.taskId,
        record.commitment
      );
      if (!taskCreationResult.success) {
        record.status = 'failed';
        record.message = taskCreationResult.message ?? 'On-chain task creation failed';
        record.updatedAt = new Date().toISOString();
        throw new Error(record.message);
      }

      record.transactions.taskCreationTx = taskCreationResult.txHash;
      record.status = 'task_created';
      record.updatedAt = new Date().toISOString();

      let submissionResult;
      try {
        submissionResult = await this.blockchainService.submitProof(
          record.taskId,
          proofResult.proof
        );
      } catch (submitErr: any) {
        record.status = 'task_created';
        record.message = `Task created on-chain (${taskCreationResult.txHash}), but proof submission failed: ${submitErr.message}`;
        record.updatedAt = new Date().toISOString();
        throw submitErr;
      }

      record.transactions.proofSubmissionTx = submissionResult.txHash;

      if (submissionResult.verified) {
        if (this.blockchainMode === 'mock') {
          record.status = 'mock';
          record.message =
            'Proof generated with the real circuit and accepted in MOCK blockchain mode. Connect BLOCKCHAIN_MODE=real for on-chain verification.';
        } else {
          record.status = 'verified';
          record.message =
            'Proof successfully verified by on-chain Solidity Groth16 verifier and confirmed on-chain.';
        }
      } else {
        record.status = 'rejected';
        record.message = submissionResult.message ?? 'Proof verification rejected on-chain';
      }

      record.updatedAt = new Date().toISOString();
      return { ...record };
    } catch (err: any) {
      // If record not yet registered under taskId, ensure it is set so
      // GET /:taskId can surface the failed status (when taskId now known).
      if (record.taskId) this.registry.set(record.taskId, record);
      if (record.status !== 'task_created' && record.status !== 'rejected') {
        record.status = 'failed';
      }
      record.message = err.message ?? 'ZK verification workflow encountered an error';
      record.updatedAt = new Date().toISOString();
      throw err;
    }
  }

  async getVerificationStatus(taskId: string): Promise<OrchestratorRecord | null> {
    const record = this.registry.get(taskId);
    if (!record) {
      const onChainTask = await this.blockchainService.getTask(taskId);
      if (onChainTask) {
        return {
          taskId: onChainTask.taskId,
          commitment: onChainTask.commitment,
          score: onChainTask.score ?? 0,
          modelVersion: onChainTask.modelVersion ?? 1,
          status:
            onChainTask.status === 'VERIFIED'
              ? this.proofMode === 'mock' || this.blockchainMode === 'mock'
                ? 'mock'
                : 'verified'
              : onChainTask.status === 'REJECTED'
              ? 'rejected'
              : 'task_created',
          transactions: {
            taskCreationTx: onChainTask.txHashCreate,
            proofSubmissionTx: onChainTask.txHashSubmit,
          },
          proofMode: this.proofMode,
          blockchainMode: this.blockchainMode,
          createdAt: new Date(onChainTask.createdAt).toISOString(),
          updatedAt: new Date(onChainTask.updatedAt).toISOString(),
          message: `On-chain status: ${onChainTask.status}`,
        };
      }
      return null;
    }
    return { ...record };
  }

  async getAuditEvents(): Promise<ChainAuditEvent[]> {
    return this.blockchainService.getAuditEvents();
  }

  async getDispute(taskId: string): Promise<DisputeRecord | null> {
    return this.blockchainService.getDispute(taskId);
  }

  async raiseDispute(taskId: string, reason: string): Promise<BlockchainActionResult> {
    return this.blockchainService.raiseDispute(taskId, reason);
  }

  async resolveDispute(taskId: string): Promise<BlockchainActionResult> {
    return this.blockchainService.resolveDispute(taskId);
  }

  async checkIntegrity(taskId: string, commitment: string) {
    const task = await this.blockchainService.getTask(taskId);
    return {
      taskId,
      matches: Boolean(task && task.commitment === commitment),
      registeredCommitment: task?.commitment,
      returnedCommitment: commitment,
      source: this.blockchainMode === 'real' ? 'on-chain task record' : 'mock task record',
      checkedAt: new Date().toISOString(),
    };
  }
}
