import type {
  ApiEnvelope,
  CreditInput,
  CreditResult,
  EmiInput,
  EmiResult,
  FraudInput,
  FraudResult,
  HealthStatus,
  SettlementInput,
  SettlementResult,
  VerificationResult,
  BlockchainActionResult,
  ChainAuditEvent,
  DisputeRecord,
  IntegrityCheckResult,
  PlatformTask,
  CalculationReceipt,
  ReceiptVerification,
} from './types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code = 'API_ERROR',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new ApiClientError(
        payload.error?.message ?? `Request failed with status ${response.status}`,
        payload.error?.code ?? 'API_ERROR',
        response.status,
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('Backend is offline. Start it with `cd backend && npm run dev`.', 'NETWORK_ERROR');
  }
}

export const api = {
  health: () => request<HealthStatus>('/health'),
  creditScore: (input: CreditInput) =>
    request<CreditResult>('/credit/score', { method: 'POST', body: JSON.stringify(input) }),
  verification: (input: CreditInput) =>
    request<VerificationResult>('/verification/submit', { method: 'POST', body: JSON.stringify(input) }),
  verificationStatus: (taskId: string) => request<VerificationResult>(`/verification/${encodeURIComponent(taskId)}`),
  chainAudit: () => request<ChainAuditEvent[]>('/verification/audit/events'),
  dispute: (taskId: string) => request<DisputeRecord | null>(`/verification/${encodeURIComponent(taskId)}/dispute`),
  raiseDispute: (taskId: string, reason: string) => request<BlockchainActionResult>(`/verification/${encodeURIComponent(taskId)}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resolveDispute: (taskId: string) => request<BlockchainActionResult>(`/verification/${encodeURIComponent(taskId)}/dispute/resolve`, { method: 'POST' }),
  checkIntegrity: (taskId: string, commitment: string) => request<IntegrityCheckResult>(`/verification/${encodeURIComponent(taskId)}/integrity?commitment=${encodeURIComponent(commitment)}`),
  platformRequest: (input: CreditInput, modelId = 1) => request<PlatformTask>('/platform/tasks', { method: 'POST', body: JSON.stringify({ ...input, modelId }) }),
  platformCompute: (taskId: string) => request<PlatformTask>(`/platform/tasks/${encodeURIComponent(taskId)}/compute`, { method: 'POST' }),
  platformSubmit: (taskId: string) => request<PlatformTask>(`/platform/tasks/${encodeURIComponent(taskId)}/submit`, { method: 'POST' }),
  recordReceipt: (module: 'loan' | 'fraud' | 'settlement', inputs: Record<string, unknown>, output: Record<string, unknown>) => request<CalculationReceipt>('/platform/receipts', { method: 'POST', body: JSON.stringify({ module, inputs, output }) }),
  verifyReceipt: (receiptId: string, inputs: Record<string, unknown>, output: Record<string, unknown>) => request<ReceiptVerification>(`/platform/receipts/${encodeURIComponent(receiptId)}/verify`, { method: 'POST', body: JSON.stringify({ inputs, output }) }),
  emi: (input: EmiInput) =>
    request<EmiResult>('/emi/calculate', { method: 'POST', body: JSON.stringify(input) }),
  fraud: (input: FraudInput) =>
    request<FraudResult>('/fraud/score', { method: 'POST', body: JSON.stringify(input) }),
  settlement: (input: SettlementInput) =>
    request<SettlementResult>('/settlements/calculate', { method: 'POST', body: JSON.stringify(input) }),
};

export { API_URL };
