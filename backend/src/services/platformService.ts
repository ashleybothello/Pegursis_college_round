import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config, PROJECT_ROOT } from '../config/index.js';
import type { CreditScoringInputs } from '../types/index.js';

const credit = require(path.join(PROJECT_ROOT, 'lib/credit-score-prover.js'));
const eligibility = require(path.join(PROJECT_ROOT, 'lib/eligibility-prover.js'));
const abi = () => JSON.parse(fs.readFileSync(config.CONTRACT_ABI_PATH, 'utf8'));
const id = () => BigInt('0x' + randomBytes(16).toString('hex')).toString();
export type Stage = { label: string; timestamp: string; source: 'provider' | 'chain'; transactionHash?: string; blockNumber?: number; detail?: string };
type PendingTask = { taskId: string; modelId: number; commitment: string; status: string; requester: string; provider: string; timeline: Stage[]; input: Record<string, string>; proof?: any; publicSignals?: string[]; busy?: boolean; taskCreationTx?: string; proofSubmissionTx?: string; createdAt?: string; updatedAt?: string };
const pending = new Map<string, PendingTask>();
let rpc: JsonRpcProvider | undefined;

export function publicConfig() {
  return { rpcUrl: config.RPC_URL, contractAddress: config.CONTRACT_ADDRESS, proofMode: config.PROOF_MODE, blockchainMode: config.BLOCKCHAIN_MODE, localRoleAccounts: true };
}

async function connection() {
  if (config.BLOCKCHAIN_MODE !== 'real') throw new Error('Real blockchain mode required. Simulation has no on-chain records.');
  rpc ??= new JsonRpcProvider(config.RPC_URL);
  if (await rpc.getCode(config.CONTRACT_ADDRESS) === '0x') throw new Error('VerityManager not deployed. Deploy the contracts and update CONTRACT_ADDRESS.');
  // Build a fresh wallet for each connection. A cached NonceManager can retain
  // a nonce from before Hardhat was redeployed, which produces "nonce too low"
  // after a local chain reset or contract redeploy.
  const providerSigner = new Wallet(config.PRIVATE_KEY, rpc);
  return { rpc, provider: new Contract(config.CONTRACT_ADDRESS, abi(), providerSigner), providerSigner };
}

function publicTask(task: PendingTask) {
  // Private inputs and salt never cross this response boundary.
  return { taskId: task.taskId, modelId: task.modelId, commitment: task.commitment, status: task.status, requester: task.requester, provider: task.provider, timeline: task.timeline, publicSignals: task.publicSignals, proof: task.proof, score: task.publicSignals?.[0] ? Number(task.publicSignals[0]) : undefined, transactions: { taskCreationTx: task.taskCreationTx, proofSubmissionTx: task.proofSubmissionTx }, createdAt: task.createdAt, updatedAt: task.updatedAt };
}

export async function requestTask(inputs: CreditScoringInputs, modelId: number) {
  if (config.PROOF_MODE !== 'real') throw new Error('Real proof mode required for a committed platform task.');
  const { rpc, provider, providerSigner } = await connection();
  if ((await rpc.getNetwork()).chainId !== 31337n) throw new Error('The local role relay requires Hardhat chain 31337.');
  const requester = await rpc.getSigner(1);
  const taskId = id();
  const input = { paymentHistory: String(inputs.repaymentIndex), incomeStability: String(inputs.incomeIndex), debtHeadroom: String(inputs.historyIndex), inputSalt: id(), taskId, modelId: String(modelId) };
  const helper = modelId === 1 ? credit : eligibility;
  const commitment = await helper.calculateInputCommitment(input);
  const keyFile = modelId === 1 ? 'verification_key.json' : 'eligibility_verification_key.json';
  const keyHash = '0x' + createHash('sha256').update(fs.readFileSync(path.join(PROJECT_ROOT, 'build', keyFile))).digest('hex');
  if (await provider.verificationKeyHashes(modelId) !== keyHash) throw new Error('Verification key does not match the immutable registered model key. Redeploy using scripts/deploy.js.');
  const tx = await provider.connect(requester).getFunction('createTask')(taskId, modelId, commitment);
  const receipt = await tx.wait();
  const block = await rpc.getBlock(receipt.blockNumber);
  const createdAt = new Date(Number(block!.timestamp) * 1000).toISOString();
  const task: PendingTask = { taskId, modelId, commitment, input, status: 'requested', requester: await requester.getAddress(), provider: await providerSigner.getAddress(), taskCreationTx: receipt.hash, createdAt, updatedAt: createdAt, timeline: [{ label: 'Requested', source: 'chain', timestamp: createdAt, blockNumber: receipt.blockNumber, transactionHash: receipt.hash }] };
  pending.set(taskId, task);
  return publicTask(task);
}

export function taskInfo(taskId: string) {
  const task = pending.get(taskId);
  if (!task) throw new Error('Provider session not found. On-chain tasks and proofs remain readable from Audit History.');
  return publicTask(task);
}

export async function computeTask(taskId: string) {
  const task = pending.get(taskId);
  if (!task) throw new Error('Provider session not found');
  if (task.busy) throw new Error('Conflict: task operation already running');
  if (task.status !== 'requested' && task.status !== 'failed') throw new Error('Conflict: computation already generated');
  task.busy = true;
  try {
    const helper = task.modelId === 1 ? credit : eligibility;
    const result = await (task.modelId === 1 ? helper.generateCreditScoreProof(task.input) : helper.generateEligibilityProof(task.input));
    if (String(result.publicSignals.at(-1)) !== task.commitment) throw new Error('Input commitment mismatch');
    task.proof = result.proof;
    task.publicSignals = result.publicSignals;
    task.status = 'proof_generated';
    task.updatedAt = new Date(Math.max(Date.now(), Date.parse(task.updatedAt ?? '') + 1000)).toISOString();
    task.timeline.push({ label: 'Proof generated', source: 'provider', timestamp: task.updatedAt, detail: 'Provider-reported generation time; chain records prove submission and acceptance.' });
    // The stored witness is no longer needed after proof creation.
    task.input = {};
    return publicTask(task);
  } catch (error) {
    task.status = 'failed';
    task.updatedAt = new Date(Math.max(Date.now(), Date.parse(task.updatedAt ?? '') + 1000)).toISOString();
    task.timeline.push({ label: 'Computation failed', source: 'provider', timestamp: task.updatedAt });
    throw error;
  } finally { task.busy = false; }
}

export async function submitTask(taskId: string) {
  const task = pending.get(taskId);
  if (!task?.proof || task.status !== 'proof_generated') throw new Error('Conflict: generate a proof before submission');
  if (task.busy) throw new Error('Conflict: task operation already running');
  task.busy = true;
  try {
    const { rpc, provider } = await connection();
    const p = task.proof;
    const tx = await provider.submitProof(taskId, p.pi_a.slice(0, 2), [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], p.pi_c.slice(0, 2), task.publicSignals);
    const receipt = await tx.wait();
    const block = await rpc.getBlock(receipt.blockNumber);
    task.status = 'verified';
    task.proofSubmissionTx = receipt.hash;
    task.updatedAt = new Date(Number(block!.timestamp) * 1000).toISOString();
    task.timeline.push({ label: 'Submitted and verified', source: 'chain', timestamp: task.updatedAt, transactionHash: receipt.hash, blockNumber: receipt.blockNumber });
    return publicTask(task);
  } finally { task.busy = false; }
}

// Deterministic JSON encoding used for byte-integrity receipts on all workloads.
export function canonical(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

export async function recordReceipt(module: string, inputs: unknown, output: unknown) {
  const { provider, rpc } = await connection();
  const hash = (value: unknown) => '0x' + createHash('sha256').update(canonical(value)).digest('hex');
  const inputHash = hash(inputs), outputHash = hash(output);
  const receiptId = '0x' + randomBytes(32).toString('hex');
  const tx = await provider.recordCalculation(receiptId, module, inputHash, outputHash);
  const receipt = await tx.wait();
  return { receiptId, module, inputHash, outputHash, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, chainId: Number((await rpc.getNetwork()).chainId), contractAddress: config.CONTRACT_ADDRESS };
}

export async function verifyReceipt(receiptId: string, inputs: unknown, output: unknown) {
  const { provider } = await connection();
  const hash = (value: unknown) => '0x' + createHash('sha256').update(canonical(value)).digest('hex');
  const inputHash = hash(inputs), outputHash = hash(output);
  const stored: any = await provider.calculationReceipts(receiptId);
  const matches = stored.provider !== '0x0000000000000000000000000000000000000000' && stored.inputHash === inputHash && stored.outputHash === outputHash;
  return { receiptId, matches, inputHash, outputHash, registeredInputHash: stored.inputHash, registeredOutputHash: stored.outputHash, checkedAt: new Date().toISOString() };
}
