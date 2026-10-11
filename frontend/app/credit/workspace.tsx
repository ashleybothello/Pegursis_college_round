'use client';

import { useEffect, useState } from 'react';
import { LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { auditStore } from '@/lib/auditStore';
import type { CreditInput, HealthStatus, VerificationResult, PlatformTask } from '@/lib/types';
import { makeId } from '@/lib/utils';
import { PlatformFlow, PlatformTaskPanel, IntegrityCheckCard, DisputeCard } from '@/components/platform';
import { Card, CardContent, CardHeader, CardTitle, Input, PageHeader, SectionKicker, Badge } from '@/components/ui';
import { PrivacySplit, ProofDetails, ProofStepper, SampleDataButton, ScoreGauge } from '@/components/shared';

const samples: Record<string, CreditInput> = { Strong: { incomeIndex: 90, repaymentIndex: 95, historyIndex: 85 }, Average: { incomeIndex: 60, repaymentIndex: 65, historyIndex: 50 }, Risky: { incomeIndex: 25, repaymentIndex: 20, historyIndex: 30 } };

export default function CreditWorkspace() {
  const [values, setValues] = useState<CreditInput>(samples.Strong);
  const [result, setResult] = useState<VerificationResult>();
  const [health, setHealth] = useState<HealthStatus>();

  useEffect(() => { api.health().then(setHealth).catch(() => undefined); }, []);

  const setValue = (key: keyof CreditInput, value: number) => setValues((current) => ({ ...current, [key]: Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : Number.NaN }));
  const refresh = async () => { if (result) setResult(await api.verificationStatus(result.taskId)); };
  const recordResult = (next: VerificationResult) => { setResult(next); auditStore.add({ id: makeId('credit'), timestamp: next.updatedAt, module: 'credit', summary: `Score ${next.score}`, taskId: next.taskId, commitment: next.commitment, status: next.status, proofMode: next.proofMode, blockchainMode: next.blockchainMode, txHashes: Object.values(next.transactions).filter(Boolean) as string[], details: next as unknown as Record<string, unknown> }); toast.success(next.status === 'verified' ? 'Independent verifier accepted the proof' : 'Simulation recorded'); };
  const acceptPlatformTask = (task: PlatformTask) => recordResult({ taskId: task.taskId, commitment: task.commitment, score: task.score ?? Number(task.publicSignals?.[0] ?? 0), modelVersion: task.modelId, status: 'verified', transactions: task.transactions ?? {}, proofMode: 'real', blockchainMode: 'real', createdAt: task.createdAt ?? new Date().toISOString(), updatedAt: task.updatedAt ?? new Date().toISOString(), message: 'Independent verifier accepted the provider proof through VerityManager.' });
  const max = result?.proofMode === 'mock' ? 1300 : 900;

  return <div><PageHeader eyebrow="Requester → provider → verifier" title="Credit scoring" description="A requester defines the task, a provider computes privately, and an independent verifier checks the exact public result." action={<div className="flex items-center gap-2"><Badge tone="success"><LockKeyhole size={12} /> Private inputs</Badge><SampleDataButton onClick={() => setValues(samples.Strong)} /></div>} />
    <PlatformFlow module="Credit score" proofMode={health?.proofMode ?? 'mock'} blockchainMode={health?.blockchainMode ?? 'mock'} />
    <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <div className="space-y-6"><Card><CardHeader><SectionKicker icon={<Sparkles size={14} />}>Requester creates a task</SectionKicker><CardTitle className="mt-2">Build a private scenario</CardTitle><p className="mt-2 text-sm leading-5 text-ink/55">These indices are the provider’s private inputs. They are committed inside the proof and never stored on-chain.</p></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-3 gap-2">{Object.entries(samples).map(([name, sample]) => <button type="button" key={name} onClick={() => setValues(sample)} className="rounded-xl border border-silver bg-pearl/60 px-2 py-2 text-xs font-semibold text-storm-deep transition hover:border-storm hover:bg-moonglow/50">{name}</button>)}</div>{([['incomeIndex', 'Income stability', 'How resilient is monthly income?'], ['repaymentIndex', 'Repayment behaviour', 'History of paying obligations on time'], ['historyIndex', 'Credit history length', 'Depth of the applicant’s credit record']] as const).map(([key, label, hint]) => <SliderField key={key} label={label} hint={hint} value={values[key]} onChange={(value) => setValue(key, value)} />)}<div className="flex items-start gap-2 rounded-xl bg-moonglow/60 p-3 text-xs leading-5 text-storm-deep"><LockKeyhole size={15} className="mt-0.5 shrink-0" /><span>Private: raw inputs never leave the prover. Only the score, task context and commitment are public.</span></div></CardContent></Card><PlatformTaskPanel inputs={values} proofMode={health?.proofMode} blockchainMode={health?.blockchainMode} onVerified={acceptPlatformTask} onSimulated={recordResult} /></div>
      <div className="space-y-6"><Card className="overflow-hidden"><CardHeader className="flex items-center justify-between"><div><SectionKicker>Verifier checks independently</SectionKicker><CardTitle className="mt-2">A score with evidence</CardTitle></div>{result && <button type="button" onClick={() => { setResult(undefined); }} className="button-secondary h-9 px-3 text-xs"><RotateCcw size={14} /> Reset</button>}</CardHeader><CardContent><div className="grid items-center gap-6 md:grid-cols-[.75fr_1.25fr]"><div><ScoreGauge score={result?.score} max={max} /></div><div className="space-y-5"><div className="rounded-2xl bg-moonglow/60 p-4"><div className="flex items-center justify-between text-xs text-storm-deep/65"><span>Model output</span><span className="font-mono">{result ? `v${result.modelVersion}` : 'v1'}</span></div><p className="mt-2 text-sm leading-5 text-storm-deep">{result ? result.message : 'Run the task to attach a proof that anyone can independently check.'}</p></div><ProofStepper status={result?.status} loading={false} /></div></div></CardContent></Card>{result ? <><ProofDetails result={result} onRefresh={refresh} /><IntegrityCheckCard result={result} />{result.status === 'verified' && <DisputeCard taskId={result.taskId} />}<PrivacySplit /></> : <PrivacySplit />}</div>
    </div>
  </div>;
}

function SliderField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: number) => void }) {
  return <div className="min-w-0"><div className="mb-2 flex items-start justify-between gap-4"><div className="min-w-0"><label className="field-label mb-1 break-normal">{label}</label><p className="text-xs text-ink/50">{hint}</p></div><Input aria-label={`${label} value`} type="number" min={0} max={100} value={Number.isFinite(value) ? value : ''} onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))} className="h-9 w-16 shrink-0 px-2 text-center font-mono text-xs" /></div><input aria-label={label} type="range" min={0} max={100} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-storm" /><div className="mt-1 flex justify-between text-[10px] text-storm/45"><span>0</span><span>100</span></div></div>;
}
