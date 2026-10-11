// ==========================================
// 1. Credit Scoring Types
// ==========================================
export interface CreditScoringInputs {
  incomeIndex: number;
  repaymentIndex: number;
  historyIndex: number;
}

export interface CreditValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CreditScoringResult {
  score: number;
  modelVersion: number;
  validation: CreditValidationResult;
  timestamp: string;
  disclaimer: string;
}

// ==========================================
// 2. EMI Calculation Types
// ==========================================
export interface EmiCalculationInputs {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
}

export interface EmiCalculationResult {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthlyEmi: number;
  totalRepayment: number;
  totalInterest: number;
  currencyUnit: string;
  assumptions: string[];
}

// ==========================================
// 3. Fraud Scoring Types
// ==========================================
export type FraudRiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudRiskInputs {
  transactionAmount: number;
  userAverageAmount?: number;
  userTransactionsLastHour?: number;
  isNewDevice?: boolean;
  locationMismatch?: boolean;
  transactionHourUtc?: number;
  rapidCrossBorderTransfers?: boolean;
}

export interface FraudRuleEvaluation {
  ruleId: string;
  description: string;
  triggered: boolean;
  points: number;
  details?: string;
}

export interface FraudRiskResult {
  riskScore: number;
  riskCategory: FraudRiskCategory;
  reasons: string[];
  ruleEvaluations: FraudRuleEvaluation[];
  evaluatedAt: string;
  disclaimer: string;
}

// ==========================================
// 4. Payment Settlement Types
// ==========================================
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'HELD' | 'FAILED';

export interface SettlementInputs {
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
  status: SettlementStatus;
  feeBreakdown: {
    basisPointsFee: number;
    fixedFee: number;
    effectiveRatePercent: number;
  };
  calculatedAt: string;
}

// ==========================================
// 5. Groth16 Proof Types
// ==========================================
export interface SolidityProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  publicSignals: string[];
}

export interface ProofGenerationResult {
  proof: SolidityProof;
  publicSignals: string[];
  score: number;
  modelVersion: number;
  isMock: boolean;
  generatedAt: string;
  // Present only for real circuit proofs; absent for mock proofs.
  commitment?: string;
  taskId?: string;
}

export interface ProofService {
  generateProof(inputs: CreditScoringInputs): Promise<ProofGenerationResult>;
  verifyProof(proof: SolidityProof, publicSignals: string[]): Promise<boolean>;
}

// ==========================================
// 6. Blockchain Service Types
// ==========================================
export type OnChainTaskStatus = 'PENDING' | 'TASK_CREATED' | 'SUBMITTED' | 'VERIFIED' | 'INVALIDATED' | 'REJECTED' | 'FAILED';
export type OnChainDisputeStatus = 'NONE' | 'OPEN' | 'UPHELD' | 'OVERTURNED';

export interface TaskRecord {
  taskId: string;
  commitment: string;
  status: OnChainTaskStatus;
  score?: number;
  modelVersion?: number;
  txHashCreate?: string;
  txHashSubmit?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  disputeStatus?: OnChainDisputeStatus;
}

export interface TaskCreationResult {
  success: boolean;
  taskId: string;
  commitment: string;
  txHash?: string;
  message?: string;
}

export interface ProofSubmissionResult {
  success: boolean;
  taskId: string;
  verified: boolean;
  txHash?: string;
  message?: string;
}

export interface BlockchainService {
  createTask(taskId: string, commitment: string, modelId?: number): Promise<TaskCreationResult>;
  submitProof(taskId: string, proof: SolidityProof): Promise<ProofSubmissionResult>;
  getTask(taskId: string): Promise<TaskRecord | null>;
  getAuditEvents(): Promise<ChainAuditEvent[]>;
  getDispute(taskId: string): Promise<DisputeRecord | null>;
  raiseDispute(taskId: string, reason: string): Promise<BlockchainActionResult>;
  resolveDispute(taskId: string): Promise<BlockchainActionResult>;
}

export type ChainEventName = 'TaskCreated' | 'ProofVerified' | 'DisputeRaised' | 'DisputeResolved' | 'CalculationRecorded';

export interface ChainAuditEvent {
  event: ChainEventName;
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
  disputeStatus?: OnChainDisputeStatus;
  proofValid?: boolean;
  receiptId?: string;
  module?: string;
  inputHash?: string;
  outputHash?: string;
}

export interface DisputeRecord {
  taskId: string;
  status: OnChainDisputeStatus;
  raisedBy?: string;
  reason?: string;
  raisedAt?: string;
  resolvedAt?: string;
}

export interface BlockchainActionResult {
  success: boolean;
  taskId: string;
  transactionHash?: string;
  message: string;
}

// ==========================================
// 7. Verification Orchestration Types
// ==========================================
export type VerificationState =
  | 'pending'
  | 'proof_generated'
  | 'task_created'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'mock';

export interface VerificationSubmissionRequest {
  incomeIndex: number;
  repaymentIndex: number;
  historyIndex: number;
  salt?: string;
}

export interface VerificationSubmissionResponse {
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

// ==========================================
// 8. REST API Envelope Types
// ==========================================
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
