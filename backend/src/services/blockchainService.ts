import fs from 'fs';
import { ethers, Contract, NonceManager } from 'ethers';
import {
  BlockchainService,
  OnChainTaskStatus,
  ProofSubmissionResult,
  SolidityProof,
  TaskCreationResult,
  TaskRecord,
} from '../types/index.js';
import { ZK_MODEL_ID } from './zkCreditScoring.js';

export const COMMITMENT_DOMAIN_TAG = 'VERITY_CREDIT_COMMITMENT_V1';
export const TASK_DOMAIN_TAG = 'VERITY_TASK_V1';

export function computeInputCommitment(
  inputs: { incomeIndex: number; repaymentIndex: number; historyIndex: number },
  modelVersion: number = 1,
  saltHex?: string
): string {
  const salt = saltHex ?? ethers.ZeroHash;
  return ethers.solidityPackedKeccak256(
    ['string', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
    [COMMITMENT_DOMAIN_TAG, inputs.incomeIndex, inputs.repaymentIndex, inputs.historyIndex, modelVersion, salt]
  );
}
export function computeTaskId(commitment: string, nonce: string | number = 0): string {
  return ethers.solidityPackedKeccak256(['string', 'bytes32', 'string'], [TASK_DOMAIN_TAG, commitment, nonce.toString()]);
}

export class MockBlockchainService implements BlockchainService {
  private tasks = new Map<string, TaskRecord>();
  async createTask(taskId: string, commitment: string): Promise<TaskCreationResult> {
    const existing = this.tasks.get(taskId);
    if (existing) {
      if (existing.commitment === commitment) return { success: true, taskId, commitment, txHash: existing.txHashCreate, message: 'Task already exists with identical commitment (idempotent return)' };
      throw new Error(`Conflict: taskId ${taskId} already exists with a different commitment`);
    }
    const txHash = `0xmock_create_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`; const now = Date.now();
    const record: TaskRecord = { taskId, commitment, status: 'TASK_CREATED', txHashCreate: txHash, createdAt: now, updatedAt: now };
    this.tasks.set(taskId, record);
    return { success: true, taskId, commitment, txHash, message: 'Mock task successfully created in memory' };
  }
  async submitProof(taskId: string, proof: SolidityProof): Promise<ProofSubmissionResult> {
    const record = this.tasks.get(taskId); if (!record) throw new Error(`Task ${taskId} not found. Must call createTask before submitProof.`);
    if (record.status === 'VERIFIED') return { success: true, taskId, verified: true, txHash: record.txHashSubmit, message: 'Proof was already verified for this task (idempotent return)' };
    const txHash = `0xmock_submit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`; const now = Date.now();
    const isValid = proof && Array.isArray(proof.a) && proof.a.length === 2 && Array.isArray(proof.b) && proof.b.length === 2 && Array.isArray(proof.c) && proof.c.length === 2 && Array.isArray(proof.publicSignals) && proof.publicSignals.length >= 2;
    if (!isValid) { record.status = 'REJECTED'; record.updatedAt = now; record.error = 'Invalid proof format or public signals'; return { success: false, taskId, verified: false, txHash, message: 'Proof rejected due to invalid structure' }; }
    const score = Number(proof.publicSignals[0]); const modelVersion = Number(proof.publicSignals[1]);
    record.status = 'VERIFIED'; record.score = score; record.modelVersion = modelVersion; record.txHashSubmit = txHash; record.updatedAt = now;
    return { success: true, taskId, verified: true, txHash, message: 'Proof successfully verified on mock blockchain' };
  }
  async getTask(taskId: string): Promise<TaskRecord | null> { const r = this.tasks.get(taskId); return r ? { ...r } : null; }
}

export class EthersBlockchainService implements BlockchainService {
  private rpcUrl: string; private privateKey: string; private contractAddress: string; private abiPath: string;
  private provider?: ethers.JsonRpcProvider; private wallet?: NonceManager; private contract?: Contract;
  constructor(options: { rpcUrl: string; privateKey: string; contractAddress: string; abiPath: string; }) { this.rpcUrl = options.rpcUrl; this.privateKey = options.privateKey; this.contractAddress = options.contractAddress; this.abiPath = options.abiPath; }
  private async initializeContract(): Promise<Contract> {
    if (this.contract) return this.contract;
    if (!this.rpcUrl) throw new Error('RPC_URL is not configured'); if (!this.privateKey) throw new Error('PRIVATE_KEY is not configured');
    if (!this.contractAddress || !ethers.isAddress(this.contractAddress)) throw new Error(`Invalid CONTRACT_ADDRESS: ${this.contractAddress}`);
    if (!fs.existsSync(this.abiPath)) throw new Error(`Contract ABI file not found at ${this.abiPath}`);
    const rawAbi = fs.readFileSync(this.abiPath, 'utf8'); const abi = JSON.parse(rawAbi);
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    try { await this.provider.getBlockNumber(); } catch { throw new Error(`Unable to connect to Ethereum RPC at ${this.rpcUrl}. Ensure local Hardhat node is running.`); }
    const code = await this.provider.getCode(this.contractAddress);
    if (code === '0x' || code === '0x0') throw new Error(`No contract bytecode deployed at address ${this.contractAddress} on network ${this.rpcUrl}. Deploy VerityManager.sol first.`);
    this.wallet = new NonceManager(new ethers.Wallet(this.privateKey, this.provider));
    this.contract = new Contract(this.contractAddress, abi, this.wallet as any);
    return this.contract;
  }
  async createTask(taskId: string, commitment: string, modelId: number = ZK_MODEL_ID): Promise<TaskCreationResult> {
    const contract = await this.initializeContract(); const taskIdBN = BigInt(taskId); const commitmentBN = BigInt(commitment);
    try { const existing: any = await contract.getTask(taskIdBN); if (existing && existing.commitment !== undefined && existing.commitment !== 0n) { if (existing.commitment === commitmentBN) return { success: true, taskId, commitment, message: 'On-chain task already exists with identical commitment (idempotent)' }; throw new Error(`On-chain task ${taskId} already exists with different commitment ${existing.commitment}`); } } catch (err: any) { if (err?.message?.includes('different commitment')) throw err; }
    try { const tx = await contract.createTask(taskIdBN, modelId, commitmentBN); const receipt = await tx.wait(1); return { success: true, taskId, commitment, txHash: receipt.hash, message: 'Task successfully created on-chain' }; } catch (error: any) { throw new Error(`createTask transaction failed: ${error.reason ?? error.message}`); }
  }
  async submitProof(taskId: string, proof: SolidityProof): Promise<ProofSubmissionResult> {
    const contract = await this.initializeContract(); const taskIdBN = BigInt(taskId);
    try { const tx = await contract.submitProof(taskIdBN, proof.a, proof.b, proof.c, proof.publicSignals); const receipt = await tx.wait(1); return { success: true, taskId, verified: true, txHash: receipt.hash, message: 'Proof submitted and verified on-chain' }; } catch (error: any) { throw new Error(`submitProof transaction failed: ${error.reason ?? error.message}`); }
  }
  async getTask(taskId: string): Promise<TaskRecord | null> {
    const contract = await this.initializeContract();
    try {
      const raw: any = await contract.getTask(BigInt(taskId));
      if (!raw || raw[0] === 0n) return null;
      const status = raw[0] as bigint;
      const creator = raw[1] as string;
      const modelId = raw[2] as bigint;
      const commitment = raw[3] as bigint;
      const result = raw[4] as bigint;
       const verifiedAt = raw[5] as bigint;
       // The manager stores a verification timestamp, not a creation
       // timestamp. Keep a useful audit time for an open task instead of
       // presenting Unix epoch to clients.
       const auditTimestamp = Number(verifiedAt > 0n ? verifiedAt : BigInt(Math.floor(Date.now() / 1000))) * 1000;
      const statusMap: Record<number, OnChainTaskStatus> = { 0: 'PENDING', 1: 'TASK_CREATED', 2: 'VERIFIED' };
       return { taskId: String(taskId), commitment: commitment.toString(), status: statusMap[Number(status)] ?? 'TASK_CREATED', score: Number(result), modelVersion: Number(modelId), createdAt: auditTimestamp, updatedAt: auditTimestamp, txHashCreate: undefined, txHashSubmit: undefined, error: undefined } as any;
    } catch { return null; }
  }
}

export function createBlockchainService(options: { blockchainMode: 'mock' | 'real'; rpcUrl?: string; privateKey?: string; contractAddress?: string; abiPath?: string; }): BlockchainService {
  if (options.blockchainMode === 'real') return new EthersBlockchainService({ rpcUrl: options.rpcUrl ?? 'http://127.0.0.1:8545', privateKey: options.privateKey ?? '', contractAddress: options.contractAddress ?? '', abiPath: options.abiPath ?? '' });
  return new MockBlockchainService();
}
