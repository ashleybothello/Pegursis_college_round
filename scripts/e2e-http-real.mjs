const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

async function request(path, options) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`${options?.method ?? 'GET'} ${path} failed: ${body.error?.message ?? response.status}`);
  }
  return body.data;
}

async function main() {
  const health = await request('/api/health');
  if (health.proofMode !== 'real' || health.blockchainMode !== 'real') {
    throw new Error(`Expected real + real modes, got ${health.proofMode} + ${health.blockchainMode}`);
  }

  const submission = await request('/api/verification/submit', {
    method: 'POST',
    body: JSON.stringify({ incomeIndex: 74, repaymentIndex: 82, historyIndex: 61 }),
  });
  if (submission.status !== 'verified' || !submission.stages.offchainVerified || !submission.stages.onchainVerified) {
    throw new Error(`Expected off-chain and on-chain verification, got ${submission.status}`);
  }

  const status = await request(`/api/verification/${submission.taskId}`);
  if (status.taskId !== submission.taskId || status.score !== 755) {
    throw new Error('Status lookup did not return the verified public audit record');
  }

  const honest = await request(`/api/verification/${submission.taskId}/offchain`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!honest.valid) throw new Error('Honest proof failed the off-chain recheck');

  const tampered = await request(`/api/verification/${submission.taskId}/offchain`, {
    method: 'POST',
    body: JSON.stringify({ claimedScore: 756 }),
  });
  if (tampered.valid) throw new Error('Tampered public score was accepted');

  const history = await request('/api/verification?limit=10');
  if (!history.some((record) => record.taskId === submission.taskId)) {
    throw new Error('Verified record was not returned by audit history');
  }

  console.log(JSON.stringify({
    ok: true,
    taskId: submission.taskId,
    score: submission.score,
    proofSubmissionTx: submission.transactions.proofSubmissionTx,
    honestOffchain: honest.valid,
    tamperedOffchain: tampered.valid,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
