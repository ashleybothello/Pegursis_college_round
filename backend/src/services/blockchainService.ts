import fs from 'fs';
import { ethers, Contract } from 'ethers';
import {
  BlockchainService,
  OnChainTaskStatus,
  ProofSubmissionResult,
  SolidityProof,
  TaskCreationResult,
  TaskRecord,
  ChainAuditEvent,
  DisputeRecord,
  BlockchainActionResult,
  OnChainDisputeStatus,
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
  private events: ChainAuditEvent[] = [];
  private disputes = new Map<string, DisputeRecord>();
  private blockNumber = 1;
  async createTask(taskId: string, commitment: string, modelId: number = ZK_MODEL_ID): Promise<TaskCreationResult> {
    const existing = this.tasks.get(taskId);
    if (existing) {
      if (existing.commitment === commitment) return { success: true, taskId, commitment, txHash: existing.txHashCreate, message: 'Task already exists with identical commitment (idempotent return)' };
      throw new Error(`Conflict: taskId ${taskId} already exists with a different commitment`);
    }
    const txHash = `0xmock_create_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`; const now = Date.now();
    const record: TaskRecord = { taskId, commitment, status: 'TASK_CREATED', modelVersion: modelId, txHashCreate: txHash, createdAt: now, updatedAt: now, disputeStatus: 'NONE' };
    this.tasks.set(taskId, record);
    this.events.push({ event: 'TaskCreated', taskId, commitment, modelId: String(modelId), creator: 'mock:requester', blockNumber: this.blockNumber++, transactionHash: txHash, timestamp: new Date(now).toISOString() });
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
    this.events.push({ event: 'ProofVerified', taskId, commitment: record.commitment, modelId: String(modelVersion), result: String(score), blockNumber: this.blockNumber++, transactionHash: txHash, timestamp: new Date(now).toISOString() });
    return { success: true, taskId, verified: true, txHash, message: 'Proof successfully verified on mock blockchain' };
  }
  async getTask(taskId: string): Promise<TaskRecord | null> { const r = this.tasks.get(taskId); return r ? { ...r } : null; }
  async getAuditEvents(): Promise<ChainAuditEvent[]> { return []; } // A mock adapter has no blockchain evidence.
  async getDispute(taskId: string): Promise<DisputeRecord | null> { const dispute = this.disputes.get(taskId); return dispute ? { ...dispute } : null; }
  async raiseDispute(taskId: string, reason: string): Promise<BlockchainActionResult> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'VERIFIED') throw new Error('Task must be verified before it can be challenged');
    if (this.disputes.has(taskId)) throw new Error('A dispute already exists for this task');
    const txHash = `0xmock_dispute_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();
    const dispute: DisputeRecord = { taskId, status: 'OPEN', raisedBy: 'mock:challenger', reason, raisedAt: now };
    this.disputes.set(taskId, dispute);
    task.disputeStatus = 'OPEN'; task.updatedAt = Date.now();
    this.events.push({ event: 'DisputeRaised', taskId, challenger: 'mock:challenger', reason, blockNumber: this.blockNumber++, transactionHash: txHash, timestamp: now });
    return { success: true, taskId, transactionHash: txHash, message: 'Dispute opened in mock mode' };
  }
  async resolveDispute(taskId: string): Promise<BlockchainActionResult> {
    const dispute = this.disputes.get(taskId);
    if (!dispute || dispute.status !== 'OPEN') throw new Error('No open dispute for this task');
    const txHash = `0xmock_resolve_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();
    dispute.status = 'UPHELD'; dispute.resolvedAt = now;
    const task = this.tasks.get(taskId); if (task) { task.disputeStatus = 'UPHELD'; task.updatedAt = Date.now(); }
    this.events.push({ event: 'DisputeResolved', taskId, disputeStatus: 'UPHELD', proofValid: true, blockNumber: this.blockNumber++, transactionHash: txHash, timestamp: now });
    return { success: true, taskId, transactionHash: txHash, message: 'Stored proof upheld in mock mode' };
  }
}

export class EthersBlockchainService implements BlockchainService {
  private rpcUrl: string; private privateKey: string; private contractAddress: string; private abiPath: string;
  private provider?: ethers.JsonRpcProvider; private wallet?: ethers.Wallet; private contract?: Contract;
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
     // A normal Wallet asks the RPC for the current pending nonce for each
     // transaction. NonceManager caches a nonce and becomes stale when the
     // same local account is used by the platform, deployment script, or a
     // second backend workflow.
     this.wallet = new ethers.Wallet(this.privateKey, this.provider);
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
       const statusMap: Record<number, OnChainTaskStatus> = { 0: 'PENDING', 1: 'TASK_CREATED', 2: 'VERIFIED', 3: 'INVALIDATED' };
       const disputeMap: Record<number, OnChainDisputeStatus> = { 0: 'NONE', 1: 'OPEN', 2: 'UPHELD', 3: 'OVERTURNED' };
       return { taskId: String(taskId), commitment: commitment.toString(), status: statusMap[Number(status)] ?? 'TASK_CREATED', score: Number(result), modelVersion: Number(modelId), createdAt: Number(verifiedAt), updatedAt: Number(verifiedAt), txHashCreate: undefined, txHashSubmit: undefined, error: undefined, disputeStatus: disputeMap[Number(raw[6] ?? 0)] ?? 'NONE' } as any;
     } catch { return null; }
  }

  private async eventToAudit(event: any, name: string): Promise<ChainAuditEvent> {
    const args = event.args ?? [];
    const block = await this.provider!.getBlock(event.blockNumber);
    const timestamp = block ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString();
    const base: ChainAuditEvent = { event: name as ChainAuditEvent['event'], taskId: String(args.taskId ?? args[0]), blockNumber: event.blockNumber, transactionHash: event.transactionHash, timestamp };
    if (name === 'TaskCreated') return { ...base, creator: args.creator ?? args[1], modelId: String(args.modelId ?? args[2]), commitment: String(args.commitment ?? args[3]) };
    if (name === 'ProofVerified') return { ...base, modelId: String(args.modelId ?? args[1]), result: String(args.result ?? args[2]), commitment: String(args.commitment ?? args[3]) };
    if (name === 'DisputeRaised') return { ...base, challenger: args.challenger ?? args[1], reason: args.reason ?? args[2] };
    if (name === 'CalculationRecorded') return { ...base, receiptId: String(args.receiptId ?? args[0]), module: args.module ?? args[2], inputHash: args.inputHash ?? args[3], outputHash: args.outputHash ?? args[4] };
    const statusMap: Record<number, OnChainDisputeStatus> = { 0: 'NONE', 1: 'OPEN', 2: 'UPHELD', 3: 'OVERTURNED' };
    return { ...base, disputeStatus: statusMap[Number(args.status ?? args[1])] ?? 'NONE', proofValid: Boolean(args.proofValid ?? args[2]) };
  }

  async getAuditEvents(): Promise<ChainAuditEvent[]> {
    const contract = await this.initializeContract();
    const events: ChainAuditEvent[] = [];
    for (const [name, filter] of [['TaskCreated', contract.filters.TaskCreated()], ['ProofVerified', contract.filters.ProofVerified()], ['DisputeRaised', contract.filters.DisputeRaised()], ['DisputeResolved', contract.filters.DisputeResolved()], ['CalculationRecorded', contract.filters.CalculationRecorded()]] as const) {
      const logs: any[] = await contract.queryFilter(filter, 0, 'latest');
      for (const log of logs) events.push(await this.eventToAudit(log, name));
    }
    return events.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  async getDispute(taskId: string): Promise<DisputeRecord | null> {
    const contract = await this.initializeContract();
    try {
      const raw: any = await contract.disputes(BigInt(taskId));
      const statusMap: Record<number, OnChainDisputeStatus> = { 0: 'NONE', 1: 'OPEN', 2: 'UPHELD', 3: 'OVERTURNED' };
      if (Number(raw[0]) === 0) return null;
      return { taskId, status: statusMap[Number(raw[0])] ?? 'NONE', raisedBy: raw[1], reason: raw[2], raisedAt: new Date(Number(raw[3]) * 1000).toISOString(), resolvedAt: Number(raw[4]) ? new Date(Number(raw[4]) * 1000).toISOString() : undefined };
    } catch { return null; }
  }

  async raiseDispute(taskId: string, reason: string): Promise<BlockchainActionResult> {
    const contract = await this.initializeContract();
    try { const tx = await contract.raiseDispute(BigInt(taskId), reason); const receipt = await tx.wait(1); return { success: true, taskId, transactionHash: receipt.hash, message: 'Dispute opened on-chain' }; } catch (error: any) { throw new Error(`raiseDispute transaction failed: ${error.reason ?? error.message}`); }
  }

  async resolveDispute(taskId: string): Promise<BlockchainActionResult> {
    const contract = await this.initializeContract();
    try { const tx = await contract.resolveDispute(BigInt(taskId)); const receipt = await tx.wait(1); return { success: true, taskId, transactionHash: receipt.hash, message: 'Dispute resolved on-chain by re-running the stored proof' }; } catch (error: any) { throw new Error(`resolveDispute transaction failed: ${error.reason ?? error.message}`); }
  }
}

export function createBlockchainService(options: { blockchainMode: 'mock' | 'real'; rpcUrl?: string; privateKey?: string; contractAddress?: string; abiPath?: string; }): BlockchainService {
  if (options.blockchainMode === 'real') return new EthersBlockchainService({ rpcUrl: options.rpcUrl ?? 'http://127.0.0.1:8545', privateKey: options.privateKey ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', contractAddress: options.contractAddress ?? ethers.ZeroAddress, abiPath: options.abiPath ?? '' });
  return new MockBlockchainService();
}
