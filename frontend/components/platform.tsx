'use client';

import { useEffect, useState } from 'react';
import { Check, FileKey2, LockKeyhole, Network, Play, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from './ui';
import { HashChip } from './shared';
import { cn } from '@/lib/utils';
import type { BlockchainActionResult, DisputeRecord, IntegrityCheckResult, VerificationResult, ProofMode, BlockchainMode, CreditInput, PlatformTask, CalculationReceipt, ReceiptVerification } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const roles = [
  { id: 'requester', label: 'Requester', verb: 'defines the task', icon: Play, detail: 'Chooses the computation and agrees the model, formula and verification key.' },
  { id: 'provider', label: 'Provider', verb: 'computes privately', icon: LockKeyhole, detail: 'Runs the approved computation without exposing the applicant inputs.' },
  { id: 'verifier', label: 'Verifier', verb: 'checks independently', icon: ShieldCheck, detail: 'Re-runs the cryptographic check and trusts the chain record, not a screenshot.' },
] as const;

export function PlatformFlow({ module = 'Credit score', proofMode, blockchainMode }: { module?: string; proofMode?: ProofMode; blockchainMode?: BlockchainMode }) {
  const [selected, setSelected] = useState<(typeof roles)[number]['id']>('requester');
  const [keyFingerprint, setKeyFingerprint] = useState('Computing fingerprint…');
  const [liveProofMode, setLiveProofMode] = useState<ProofMode>(proofMode ?? 'mock');
  const [liveBlockchainMode, setLiveBlockchainMode] = useState<BlockchainMode>(blockchainMode ?? 'mock');
  const active = roles.find((role) => role.id === selected) ?? roles[0];

  useEffect(() => {
    let cancelled = false;
    const fingerprint = async () => {
      try {
        const response = await fetch('/zk/verification_key.json');
        const body = await response.text();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
        const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        if (!cancelled) setKeyFingerprint(`sha256:${hex}`);
      } catch { if (!cancelled) setKeyFingerprint('Fingerprint unavailable'); }
    };
    void fingerprint();
    if (!proofMode || !blockchainMode) api.health().then((health) => { setLiveProofMode(health.proofMode); setLiveBlockchainMode(health.blockchainMode); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [proofMode, blockchainMode]);

  const activeProofMode = proofMode ?? liveProofMode;
  const activeBlockchainMode = blockchainMode ?? liveBlockchainMode;

  return <Card className="overflow-hidden border-storm/20 bg-storm/5"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Credence protocol</p><CardTitle className="mt-2 text-2xl">A computation with three parties</CardTitle><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">{module} is the example use case. The platform contract is the trust layer between the requester, the provider and independent verifiers.</p></div><div className="flex shrink-0 gap-1.5"><Badge tone={activeProofMode === 'real' ? 'success' : 'warning'}>Proofs: {activeProofMode.toUpperCase()}</Badge><Badge tone={activeBlockchainMode === 'real' ? 'success' : 'warning'}>Chain: {activeBlockchainMode.toUpperCase()}</Badge></div></CardHeader><CardContent>
    <div className="grid gap-2 md:grid-cols-3">{roles.map((role, index) => { const Icon = role.icon; const isActive = role.id === selected; return <button key={role.id} type="button" onClick={() => setSelected(role.id)} className={cn('relative rounded-2xl border p-4 text-left transition', isActive ? 'border-storm bg-card shadow-soft' : 'border-silver/60 bg-card/40 hover:border-storm/45')}><div className="flex items-center gap-3"><span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', isActive ? 'bg-moonglow text-storm-deep' : 'bg-pearl text-storm')}><Icon size={17} /></span><span><span className="block text-sm font-semibold text-storm-deep">{role.label}</span><span className="block text-[11px] text-ink/50">{role.verb}</span></span></div>{index < roles.length - 1 && <span className="absolute -right-3 top-8 z-10 hidden text-storm/45 md:block">→</span>}</button>; })}</div>
    <div className="mt-4 rounded-2xl bg-card p-4"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-moonglow text-storm"><Check size={15} /></span><div className="min-w-0"><p className="text-sm font-semibold text-storm-deep">{active.label}: {active.detail}</p><div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div><p className="eyebrow">Agreed formula</p><p className="mt-1 font-mono text-[11px] text-ink/70">credit-v1 · 300 + 3r + 2i + 1h</p></div><div><p className="eyebrow">Model binding</p><p className="mt-1 font-mono text-[11px] text-ink/70">modelId = 1 · {activeBlockchainMode === 'real' ? 'VerityManager' : 'mock ledger'}</p></div><div><p className="eyebrow">Verification key fingerprint</p><HashChip value={keyFingerprint} className="mt-1" /></div></div></div></div></div>
  </CardContent></Card>;
}

export function PlatformTaskPanel({ inputs, proofMode, blockchainMode, onVerified, onSimulated }: { inputs: CreditInput; proofMode?: ProofMode; blockchainMode?: BlockchainMode; onVerified: (task: PlatformTask) => void; onSimulated: (result: VerificationResult) => void }) {
  const [taskState, setTask] = useState<PlatformTask>();
  const task = taskState as PlatformTask;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const realReady = proofMode === 'real' && blockchainMode === 'real';
  const run = async (action: () => Promise<PlatformTask>) => { setBusy(true); setMessage(''); try { const next = await action(); setTask(next); if (next.status === 'verified') onVerified(next); } catch (error) { setMessage(error instanceof Error ? error.message : 'Platform task failed'); } finally { setBusy(false); } };
  const simulate = async () => { setBusy(true); setMessage(''); try { const result = await api.verification(inputs); onSimulated(result); } catch (error) { setMessage(error instanceof Error ? error.message : 'Simulation failed'); } finally { setBusy(false); } };
  return <Card className="border-storm/20 bg-storm/5"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Role handoff</p><CardTitle className="mt-2 text-xl">Run the task across parties</CardTitle><p className="mt-1 text-sm leading-5 text-ink/55">Each button represents a separate actor. The provider does not receive the private indices in the browser response; it only returns a proof.</p></div><Badge tone={realReady ? 'success' : 'warning'}>{realReady ? 'Real handoff' : 'Simulation only'}</Badge></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-3"><RoleButton number="1" label="Requester" detail={task ? 'Task registered' : 'Create task on-chain'} disabled={busy || !realReady || Boolean(task)} onClick={() => void run(() => api.platformRequest(inputs, 1))} done={Boolean(task)} /><RoleButton number="2" label="Provider" detail={task?.status === 'proof_generated' || task?.status === 'verified' ? 'Proof generated' : 'Compute privately'} disabled={busy || !task || task.status !== 'requested'} onClick={() => void run(() => api.platformCompute(task.taskId))} done={task?.status === 'proof_generated' || task?.status === 'verified'} /><RoleButton number="3" label="Verifier" detail={task?.status === 'verified' ? 'Accepted by contract' : 'Submit and verify'} disabled={busy || !task || task.status !== 'proof_generated'} onClick={() => void run(() => api.platformSubmit(task.taskId))} done={task?.status === 'verified'} /></div>{!realReady && <div className="mt-4 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-[#8e6a23]">Start the local chain, deploy the contracts, and set <code className="font-mono">PROOF_MODE=real</code> plus <code className="font-mono">BLOCKCHAIN_MODE=real</code> to enable the three-party handoff. Mock mode is explicitly marked as simulated.</div>}{task && <div className="mt-4 space-y-2 rounded-xl bg-card p-3">{task.timeline.map((stage) => <div key={`${stage.label}-${stage.timestamp}`} className="flex items-start gap-3 text-xs"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${stage.source === 'chain' ? 'bg-verified' : 'bg-warning'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-storm-deep">{stage.label}</strong><span className="text-ink/45">{new Date(stage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>{stage.transactionHash && <HashChip value={stage.transactionHash} label="tx" />}{stage.blockNumber && <span className="ml-2 font-mono text-[10px] text-storm/55">block {stage.blockNumber}</span>}{stage.detail && <p className="mt-1 text-ink/50">{stage.detail}</p>}</div></div>)}</div>}{message && <p role="alert" className="mt-3 rounded-xl border border-rejected/20 bg-rejected/5 p-3 text-xs text-rejected">{message}</p>}{!realReady && <button type="button" onClick={() => void simulate()} disabled={busy} className="button-secondary mt-4 w-full">{busy ? 'Running simulated workflow…' : 'Run simulated workflow (not a proof)'}</button>}</CardContent></Card>;
}

function RoleButton({ number, label, detail, disabled, onClick, done }: { number: string; label: string; detail: string; disabled: boolean; onClick: () => void; done: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className={cn('rounded-xl border p-3 text-left transition', done ? 'border-verified/30 bg-verified/5' : 'border-silver bg-card hover:border-storm/45', disabled && !done ? 'cursor-not-allowed opacity-50' : '')}><span className="flex items-center gap-2"><span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold', done ? 'bg-verified text-white' : 'bg-moonglow text-storm-deep')}>{done ? <Check size={14} /> : number}</span><span><span className="block text-xs font-bold uppercase tracking-[.08em] text-storm-deep">{label}</span><span className="block text-[11px] text-ink/55">{detail}</span></span></span></button>; }

export function IntegrityCheckCard({ result }: { result: VerificationResult }) {
  const [check, setCheck] = useState<IntegrityCheckResult>();
  const [loading, setLoading] = useState(false);
  const run = async () => { setLoading(true); try { const next = await api.checkIntegrity(result.taskId, result.commitment); setCheck(next); toast.success(next.matches ? 'Commitment matches the on-chain task' : 'Commitment mismatch detected'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to check input commitment'); } finally { setLoading(false); } };
  return <Card><CardContent><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Input / output integrity</p><h2 className="mt-2 font-display text-2xl text-storm-deep">Can the public binding be checked?</h2><p className="mt-1 max-w-xl text-sm leading-5 text-ink/55">Credence compares the result commitment returned by the provider with the commitment registered in the task record. Private indices remain hidden.</p></div><button type="button" onClick={run} disabled={loading} className="button-secondary shrink-0">{loading ? 'Checking…' : 'Check public binding'}</button></div>{check && <div className={cn('mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm', check.matches ? 'border-verified/25 bg-verified/5 text-verified' : 'border-rejected/25 bg-rejected/5 text-rejected')}><Check size={17} className="mt-0.5 shrink-0" /><div><strong>{check.matches ? 'Commitment matches' : 'Commitment mismatch'}</strong><p className="mt-1 text-xs leading-5 opacity-80">Checked against the {check.source} at {new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p></div></div>}</CardContent></Card>;
}

export function DisputeCard({ taskId, initial }: { taskId: string; initial?: DisputeRecord | null }) {
  const [reason, setReason] = useState('');
  const [dispute, setDispute] = useState<DisputeRecord | null | undefined>(initial);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (initial !== undefined) {
      setDispute(initial);
      return () => { active = false; };
    }
    api.dispute(taskId).then((next) => { if (active) setDispute(next); }).catch(() => { if (active) setDispute(null); });
    return () => { active = false; };
  }, [initial, taskId]);
  const act = async (action: () => Promise<BlockchainActionResult>) => { setLoading(true); try { const response = await action(); const next = await api.dispute(taskId); setDispute(next); toast.success(response.message); } catch (error) { toast.error(error instanceof Error ? error.message : 'Dispute action failed'); } finally { setLoading(false); } };
  return <Card className="border-warning/25 bg-warning/5"><CardContent><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-moonglow text-warning"><Network size={17} /></span><div className="min-w-0 flex-1"><p className="eyebrow text-[#8e6a23]">Independent challenge</p><h2 className="mt-1 font-display text-2xl text-storm-deep">Dispute this result</h2><p className="mt-1 text-sm leading-5 text-ink/60">Any observer can challenge a verified task. Resolution re-runs the stored proof and emits a public outcome.</p>{dispute?.status ? <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone={dispute.status === 'UPHELD' ? 'success' : dispute.status === 'OVERTURNED' ? 'danger' : 'warning'}>Dispute: {dispute.status}</Badge>{dispute.reason && <span className="text-xs text-ink/60">“{dispute.reason}”</span>}{dispute.status === 'OPEN' && <button type="button" onClick={() => void act(() => api.resolveDispute(taskId))} disabled={loading} className="button-secondary h-9 px-3 text-xs">{loading ? 'Resolving…' : 'Resolve challenge'}</button>}</div> : <div className="mt-4 space-y-3"><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why should an independent verifier review this result?" className="min-h-20 w-full rounded-xl border border-silver bg-card px-3 py-2 text-sm text-ink placeholder:text-storm/50 focus:border-storm focus:outline-none focus:ring-4 focus:ring-storm/10" /><button type="button" onClick={() => void act(() => api.raiseDispute(taskId, reason))} disabled={loading || !reason.trim()} className="button-secondary">{loading ? 'Opening challenge…' : 'Challenge this result'}</button></div>}</div></div></CardContent></Card>;
}

export function CalculationReceiptCard({ module, inputs, output }: { module: 'loan' | 'fraud' | 'settlement'; inputs: object; output: object }) {
  const [mode, setMode] = useState<BlockchainMode>('mock');
  const [receipt, setReceipt] = useState<CalculationReceipt>();
  const [verification, setVerification] = useState<ReceiptVerification>();
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.health().then((health) => setMode(health.blockchainMode)).catch(() => undefined); }, []);
  const record = async () => { setLoading(true); try { const next = await api.recordReceipt(module, inputs as Record<string, unknown>, output as Record<string, unknown>); setReceipt(next); toast.success('Calculation receipt recorded on-chain'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to record calculation receipt'); } finally { setLoading(false); } };
  const verify = async () => { if (!receipt) return; setLoading(true); try { const next = await api.verifyReceipt(receipt.receiptId, inputs as Record<string, unknown>, output as Record<string, unknown>); setVerification(next); toast.success(next.matches ? 'Input and output hashes match' : 'Receipt mismatch detected'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to verify receipt'); } finally { setLoading(false); } };
  return <Card className="border-silver/70"><CardContent><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Integrity receipt · {module}</p><h2 className="mt-2 font-display text-2xl text-storm-deep">Make this result independently checkable</h2><p className="mt-1 max-w-xl text-sm leading-5 text-ink/55">Credence hashes the exact input and output bytes and records both hashes on VerityManager. This is a tamper-evident receipt, not a zero-knowledge proof.</p></div><Badge tone={mode === 'real' ? 'success' : 'warning'}>{mode === 'real' ? 'Chain ready' : 'Mock mode'}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void record()} disabled={loading || mode !== 'real' || Boolean(receipt)} className="button-secondary">{loading ? 'Recording…' : receipt ? 'Receipt recorded' : 'Record exact bytes on-chain'}</button>{receipt && <button type="button" onClick={() => void verify()} disabled={loading} className="button-secondary">{loading ? 'Checking…' : 'Verify this result'}</button>}</div>{mode !== 'real' && <p className="mt-3 text-xs text-[#8e6a23]">Switch BLOCKCHAIN_MODE to real to publish this receipt. Mock calculations are not represented as blockchain evidence.</p>}{receipt && <div className="mt-4 grid gap-3 rounded-xl bg-pearl/65 p-3 text-xs sm:grid-cols-2"><div><p className="eyebrow">Input hash</p><HashChip value={receipt.inputHash} className="mt-1" /></div><div><p className="eyebrow">Output hash</p><HashChip value={receipt.outputHash} className="mt-1" /></div><div><p className="eyebrow">Transaction</p><HashChip value={receipt.transactionHash} className="mt-1" /></div><div><p className="eyebrow">Block</p><p className="mt-1 font-mono text-storm-deep">{receipt.blockNumber}</p></div></div>}{verification && <div className={cn('mt-4 rounded-xl border p-3 text-xs', verification.matches ? 'border-verified/25 bg-verified/5 text-verified' : 'border-rejected/25 bg-rejected/5 text-rejected')}><strong>{verification.matches ? 'Receipt verified' : 'Receipt mismatch'}</strong><p className="mt-1 opacity-80">Recomputed hashes match the values registered by the provider.</p></div>}</CardContent></Card>;
}
