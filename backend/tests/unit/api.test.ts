import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { MockProofService } from '../../src/services/proofService.js';
import { MockBlockchainService } from '../../src/services/blockchainService.js';
import { VerificationOrchestrator } from '../../src/services/verificationOrchestrator.js';

describe('Verity Finance REST API Endpoints', () => {
  const mockProofService = new MockProofService();
  const mockBlockchainService = new MockBlockchainService();
  const orchestrator = new VerificationOrchestrator({
    proofService: mockProofService,
    blockchainService: mockBlockchainService,
    proofMode: 'mock',
    blockchainMode: 'mock',
  });

  const app = createApp({ orchestrator });

  describe('GET /api/health', () => {
    it('returns healthy status code 200 with service metadata', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.proofMode).toBe('mock');
    });
  });

  describe('POST /api/credit/score', () => {
    it('calculates credit score for valid input and returns 200', async () => {
      const res = await request(app)
        .post('/api/credit/score')
        .send({ incomeIndex: 70, repaymentIndex: 80, historyIndex: 90 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 300 + 5*70 + 3*80 + 2*90 = 300 + 350 + 240 + 180 = 1070
      expect(res.body.data.score).toBe(1070);
      expect(res.body.data.modelVersion).toBe(1);
      expect(res.body.data.validation.isValid).toBe(true);
    });

    it('returns 400 when input has invalid or out-of-range values', async () => {
      const res = await request(app)
        .post('/api/credit/score')
        .send({ incomeIndex: 105, repaymentIndex: -5, historyIndex: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('returns 400 when input has fractional values', async () => {
      const res = await request(app)
        .post('/api/credit/score')
        .send({ incomeIndex: 50.5, repaymentIndex: 50, historyIndex: 50 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/emi/calculate', () => {
    it('calculates EMI and loan summary for valid loan', async () => {
      const res = await request(app)
        .post('/api/emi/calculate')
        .send({ principal: 50000, annualInterestRate: 7.5, tenureMonths: 24 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monthlyEmi).toBeGreaterThan(0);
      expect(res.body.data.totalRepayment).toBeGreaterThan(50000);
      expect(res.body.data.totalInterest).toBeGreaterThan(0);
    });

    it('calculates zero-interest loan accurately', async () => {
      const res = await request(app)
        .post('/api/emi/calculate')
        .send({ principal: 12000, annualInterestRate: 0, tenureMonths: 12 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monthlyEmi).toBe(1000);
      expect(res.body.data.totalInterest).toBe(0);
    });

    it('returns 400 for negative interest rate or non-positive principal', async () => {
      const res = await request(app)
        .post('/api/emi/calculate')
        .send({ principal: -1000, annualInterestRate: -5, tenureMonths: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/fraud/score', () => {
    it('returns fraud score and explainable reasons for valid input', async () => {
      const res = await request(app)
        .post('/api/fraud/score')
        .send({
          transactionAmount: 12500,
          userAverageAmount: 2000,
          userTransactionsLastHour: 6,
          isNewDevice: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.riskScore).toBeGreaterThanOrEqual(50);
      expect(res.body.data.riskCategory).toBeDefined();
      expect(res.body.data.reasons.length).toBeGreaterThan(0);
    });

    it('returns 400 for non-positive transactionAmount', async () => {
      const res = await request(app)
        .post('/api/fraud/score')
        .send({ transactionAmount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/settlements/calculate', () => {
    it('calculates decimal-safe settlement figures', async () => {
      const res = await request(app)
        .post('/api/settlements/calculate')
        .send({
          grossAmount: 20000, // $200.00
          feeBasisPoints: 250, // 2.5%
          fixedFeeMinorUnits: 30, // $0.30
          currency: 'USD',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Fee = 500 + 30 = 530 cents
      expect(res.body.data.feeAmount).toBe(530);
      expect(res.body.data.netAmount).toBe(19470);
      expect(res.body.data.status).toBe('SETTLED');
    });

    it('returns 400 when grossAmount is not an integer minor unit', async () => {
      const res = await request(app)
        .post('/api/settlements/calculate')
        .send({ grossAmount: 199.99 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/verification/submit & GET /api/verification/:taskId', () => {
    let createdTaskId: string;

    it('submits verification request and returns 201 with task ID and status', async () => {
      const res = await request(app)
        .post('/api/verification/submit')
        .send({
          incomeIndex: 65,
          repaymentIndex: 75,
          historyIndex: 85,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskId).toBeDefined();
      expect(res.body.data.commitment).toBeDefined();
      // 300 + 5*65 + 3*75 + 2*85 = 300 + 325 + 225 + 170 = 1020
      expect(res.body.data.score).toBe(1020);
      expect(res.body.data.status).toBe('mock');

      // Verify privacy: raw private inputs are NOT leaked in response
      expect(res.body.data.incomeIndex).toBeUndefined();
      expect(res.body.data.repaymentIndex).toBeUndefined();
      expect(res.body.data.historyIndex).toBeUndefined();

      createdTaskId = res.body.data.taskId;
    });

    it('retrieves verification task by taskId with 200', async () => {
      const res = await request(app).get(`/api/verification/${createdTaskId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskId).toBe(createdTaskId);
      expect(res.body.data.score).toBe(1020);
    });

    it('exposes the tamper-evident event ledger and commitment integrity check', async () => {
      const events = await request(app).get('/api/verification/audit/events');
      expect(events.status).toBe(200);
      expect(events.body.data).toEqual([]); // Simulation never masquerades as blockchain events.

      const status = await request(app).get(`/api/verification/${createdTaskId}`);
      const integrity = await request(app).get(`/api/verification/${createdTaskId}/integrity`).query({ commitment: status.body.data.commitment });
      expect(integrity.status).toBe(200);
      expect(integrity.body.data.matches).toBe(true);
    });

    it('opens and resolves an auditable dispute', async () => {
      const opened = await request(app).post(`/api/verification/${createdTaskId}/dispute`).send({ reason: 'Please re-check the approved score.' });
      expect(opened.status).toBe(201);
      expect((await request(app).get(`/api/verification/${createdTaskId}/dispute`)).body.data.status).toBe('OPEN');

      const resolved = await request(app).post(`/api/verification/${createdTaskId}/dispute/resolve`);
      expect(resolved.status).toBe(200);
      expect((await request(app).get(`/api/verification/${createdTaskId}/dispute`)).body.data.status).toBe('UPHELD');
    });

    it('returns 404 for unknown taskId', async () => {
      const res = await request(app).get(
        '/api/verification/0x0000000000000000000000000000000000000000000000000000000000000000'
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Unknown route handling', () => {
    it('returns 404 for nonexistent route', async () => {
      const res = await request(app).get('/api/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
