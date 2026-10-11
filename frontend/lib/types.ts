export type ProofMode = 'mock' | 'real';
export type BlockchainMode = 'mock' | 'real';

export type VerificationStatus =
  | 'pending'
  | 'proof_generated'
  | 'task_created'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'mock';

export type AuditModule = 'credit' | 'loan' | 'fraud' | 'settlement' | 'demo';
export type AuditStatus = VerificationStatus | 'computed';
export type DisputeStatus = 'NONE' | 'OPEN' | 'UPHELD' | 'OVERTURNED';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  proofMode: ProofMode;
  blockchainMode: BlockchainMode;
}

export interface CreditInput {
  incomeIndex: number;
  repaymentIndex: number;
  historyIndex: number;
}

export interface CreditResult {
  score: number;
  modelVersion: number;
  validation?: { isValid: boolean; errors: string[] };
  timestamp?: string;
  disclaimer?: string;
}

export interface TransactionLinks {
  taskCreationTx?: string;
  proofSubmissionTx?: string;
}

export interface VerificationResult {
  taskId: string;
  commitment: string;
  score: number;
  modelVersion: number;
  status: VerificationStatus;
  transactions: TransactionLinks;
  proofMode: ProofMode;
  blockchainMode: BlockchainMode;
  createdAt: string;
  updatedAt: string;
  message: string;
}

export interface ChainAuditEvent {
  event: 'TaskCreated' | 'ProofVerified' | 'DisputeRaised' | 'DisputeResolved' | 'CalculationRecorded';
  taskId: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
  modelId?: string;
  commitment?: string;
  result?: string;
  creator?: string;
  challenger?: string;
  reason?: string;
  disputeStatus?: DisputeStatus;
  proofValid?: boolean;
  receiptId?: string;
  module?: string;
  inputHash?: string;
  outputHash?: string;
}

export interface DisputeRecord {
  taskId: string;
  status: DisputeStatus;
  raisedBy?: string;
  reason?: string;
  raisedAt?: string;
  resolvedAt?: string;
}

export interface IntegrityCheckResult {
  taskId: string;
  matches: boolean;
  registeredCommitment?: string;
  returnedCommitment: string;
  source: string;
  checkedAt: string;
}

export interface BlockchainActionResult {
  success: boolean;
  taskId: string;
  transactionHash?: string;
  message: string;
}

export interface PlatformTask {
  taskId: string;
  modelId: number;
  commitment: string;
  status: 'requested' | 'proof_generated' | 'verified' | 'failed';
  requester: string;
  provider: string;
  timeline: { label: string; source: 'provider' | 'chain'; timestamp: string; transactionHash?: string; blockNumber?: number; detail?: string }[];
  publicSignals?: string[];
  score?: number;
  transactions?: { taskCreationTx?: string; proofSubmissionTx?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CalculationReceipt {
  receiptId: string;
  module: string;
  inputHash: string;
  outputHash: string;
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  contractAddress: string;
}

export interface ReceiptVerification {
  receiptId: string;
  matches: boolean;
  inputHash: string;
  outputHash: string;
  registeredInputHash: string;
  registeredOutputHash: string;
  checkedAt: string;
}

export interface EmiInput {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
}

export interface EmiResult {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthlyEmi: number;
  totalRepayment: number;
  totalInterest: number;
  currencyUnit: string;
  assumptions: string[];
}

export interface FraudInput {
  [key: string]: unknown;
  transactionAmount: number;
  userAverageAmount?: number;
  userTransactionsLastHour?: number;
  isNewDevice?: boolean;
  locationMismatch?: boolean;
  transactionHourUtc?: number;
  rapidCrossBorderTransfers?: boolean;
}

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudRuleEvaluation {
  ruleId: string;
  description: string;
  triggered: boolean;
  points: number;
  details?: string;
}

export interface FraudResult {
  riskScore: number;
  riskCategory: RiskCategory;
  reasons: string[];
  ruleEvaluations: FraudRuleEvaluation[];
  evaluatedAt: string;
  disclaimer: string;
}

export interface SettlementInput {
  grossAmount: number;
  feeBasisPoints?: number;
  fixedFeeMinorUnits?: number;
  currency?: string;
}

export interface SettlementResult {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
  status: 'PENDING' | 'SETTLED' | 'HELD' | 'FAILED';
  feeBreakdown: {
    basisPointsFee: number;
    fixedFee: number;
    effectiveRatePercent: number;
  };
  calculatedAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  module: AuditModule;
  summary: string;
  taskId?: string;
  commitment?: string;
  status: AuditStatus;
  proofMode?: ProofMode;
  blockchainMode?: BlockchainMode;
  txHashes?: string[];
  details?: Record<string, unknown>;
}

export interface DemoVerificationResult {
  honest: boolean;
  tampered: boolean;
  honestSignals: string[];
  tamperedSignals: string[];
  scenario: 'credit' | 'eligibility';
  attack?: 'score' | 'proof' | 'replay' | 'model' | 'threshold';
}
