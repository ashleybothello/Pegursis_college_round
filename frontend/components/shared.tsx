'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Clipboard, Copy, ExternalLink, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from './ui';
import type { AuditEntry, VerificationResult, VerificationStatus } from '@/lib/types';
import { cn, formatDate, shortenHash } from '@/lib/utils';
import { api } from '@/lib/api';
import { auditStore } from '@/lib/auditStore';
import { toast } from 'sonner';

export function HashChip({ value, label, className }: { value?: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value || value === '—') return;
    try { await navigator.clipboard.writeText(value); setCopied(true); toast.success('Copied to clipboard'); window.setTimeout(() => setCopied(false), 1400); } catch { toast.error('Unable to copy this value'); }
  };
  return <button type="button" onClick={copy} title={value} className={cn('group flex max-w-full items-center gap-2 text-left', className)}><span className="truncate font-mono text-xs text-storm-deep">{label && <span className="mr-2 font-sans text-[10px] uppercase tracking-[.12em] text-storm/60">{label}</span>}{shortenHash(value)}</span>{copied ? <Check size={13} className="shrink-0 text-verified" /> : <Copy size={13} className="shrink-0 text-storm/55 transition group-hover:text-storm" />}</button>;
}

export function StatusBadge({ status }: { status: VerificationStatus | AuditEntry['status'] }) {
  const tone = status === 'verified' ? 'success' : status === 'mock' || status === 'computed' ? 'warning' : status === 'rejected' || status === 'failed' ? 'danger' : 'storm';
  const labels: Record<string, string> = { proof_generated: 'Proof generated', task_created: 'Task created', computed: 'Calculated' };
  return <Badge tone={tone}>{status === 'verified' && <Check size={12} />}{status === 'rejected' && <X size={12} />}{labels[status] ?? status.replace('_', ' ')}</Badge>;
}

export function VerifiedSeal({ rejected = false, mock = false, label }: { rejected?: boolean; mock?: boolean; label?: string }) {
  return <div className={cn('iridescent inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[.08em]', rejected ? 'border-rejected/30 text-rejected' : mock ? 'border-warning/30 text-[#8e6a23]' : 'border-verified/30 text-verified')}><span className={cn('flex h-5 w-5 items-center justify-center rounded-full bg-card', rejected ? 'text-rejected' : mock ? 'text-warning' : 'text-verified')}>{rejected ? <X size={13} strokeWidth={3} /> : <ShieldCheck size={14} strokeWidth={2.5} />}</span>{label ?? (rejected ? 'Proof rejected' : mock ? 'Simulated in mock mode' : 'Verified on-chain')}</div>;
}

const proofSteps = ['Computing score', 'Generating ZK proof', 'Recording on-chain', 'Verified'];

export function ProofStepper({ status, loading }: { status?: VerificationStatus; loading: boolean }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!loading) return;
    setActive(0);
    const timer = window.setInterval(() => setActive((step) => Math.min(2, step + 1)), 600);
    return () => window.clearInterval(timer);
  }, [loading]);
  const failed = status === 'rejected' || status === 'failed';
  const simulated = status === 'mock';
  const final = status === 'verified' || status === 'mock' || failed;
  const statusStep = status === 'proof_generated' ? 1 : status === 'task_created' || status === 'submitted' ? 2 : status === 'verified' || status === 'mock' ? 3 : failed ? 3 : -1;
  return <div className="space-y-4"><div className="flex items-start justify-between gap-1">{proofSteps.map((step, index) => { const complete = !simulated && (!loading && statusStep >= 0 ? index < statusStep || (final && index === 3 && !failed) : index < active); const current = loading && index === active; const rejected = !loading && failed && index === 3; return <div key={step} className="relative flex flex-1 flex-col items-center gap-2 text-center"><div className={cn('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition', rejected ? 'border-rejected bg-rejected text-white' : simulated ? 'border-warning bg-warning/10 text-[#8e6a23]' : complete ? 'border-verified bg-verified text-white' : current ? 'border-storm bg-storm text-white' : 'border-silver bg-card text-storm/55')}>{rejected ? <X size={14} /> : simulated ? '—' : complete ? <Check size={14} /> : current ? <Spinner className="h-3.5 w-3.5" /> : index + 1}</div>{index < proofSteps.length - 1 && <span className={cn('absolute left-[calc(50%+17px)] right-[calc(-50%+17px)] top-4 h-px', complete ? 'bg-verified' : 'bg-silver')} />}<span className={cn('max-w-20 text-[10px] font-semibold leading-3', simulated ? 'text-[#8e6a23]' : current || complete ? 'text-storm-deep' : 'text-storm/55')}>{simulated ? 'Skipped' : step}</span></div>; })}</div>{loading && <p className="text-center text-xs text-storm/65">{proofSteps[active]}…</p>}{simulated && <p className="text-center text-xs font-medium text-[#8e6a23]">ZK proof and on-chain recording are skipped in mock mode.</p>}{!loading && status === 'verified' && <VerifiedSeal />}{!loading && status === 'mock' && <VerifiedSeal mock />}{!loading && failed && <VerifiedSeal rejected />}{!loading && status && !final && <p className="text-center text-xs font-medium text-storm/65">Pipeline status: {status.replace('_', ' ')}</p>}</div>;
}

export function ScoreGauge({ score, max = 900 }: { score?: number; max?: number }) {
  const safeScore = score ?? 0;
  const ratio = Math.min(1, Math.max(0, (safeScore - 300) / Math.max(1, max - 300)));
  const scale = (threshold: number) => 300 + ((threshold - 300) / 600) * (max - 300);
  const excellent = scale(740);
  const good = scale(670);
  const fair = scale(580);
  const band = score == null ? 'Awaiting score' : safeScore >= excellent ? 'Excellent' : safeScore >= good ? 'Good' : safeScore >= fair ? 'Fair' : 'Needs attention';
  const bandTone = score == null ? 'neutral' : band === 'Excellent' || band === 'Good' ? 'success' : band === 'Fair' ? 'warning' : 'danger';
  return <div className="relative mx-auto w-full max-w-[340px] text-center">
    <div className="relative mx-auto h-[178px] w-[310px]">
      <svg viewBox="0 0 200 118" className="h-full w-full" role="img" aria-label={`Credit score ${score ?? 'not calculated'} out of ${max}`}>
        <defs><linearGradient id="score-gauge" x1="0" x2="1"><stop offset="0" stopColor="#B5544C" /><stop offset=".48" stopColor="#C49A45" /><stop offset=".72" stopColor="#6F7F92" /><stop offset="1" stopColor="#5E8C6A" /></linearGradient></defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E6E1DB" strokeWidth="13" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#score-gauge)" strokeWidth="13" strokeLinecap="round" pathLength="1" strokeDasharray={`${ratio} 1`} />
        <circle cx={20 + 160 * ratio} cy={100 - 80 * Math.sin(Math.PI * ratio)} r="4.5" fill="#4A5868" stroke="#FBF9F5" strokeWidth="2" />
      </svg>
      <div className="absolute inset-x-0 bottom-0"><div className="font-display text-5xl tracking-tight text-storm-deep">{score ?? '—'}</div><div className="mt-1 text-xs font-semibold uppercase tracking-[.14em] text-storm/60">out of {max}</div></div>
    </div>
    <div className="mt-1"><Badge tone={bandTone}>{band}</Badge></div>
    <div className="mt-3 flex justify-center gap-3 text-[10px] text-storm/55"><span>300</span><span>Fair {Math.round(fair)}</span><span>Good {Math.round(good)}</span><span>{max}</span></div>
    <p className="mt-2 text-xs text-ink/55">Approved scoring model · v1 · {max === 900 ? 'circuit scale' : 'legacy demo scale'}</p>
  </div>;
}

export function RiskMeter({ score, category }: { score?: number; category?: string }) {
  const value = score ?? 0;
  return <div><div className="mb-2 flex items-end justify-between"><div><span className="font-display text-5xl text-storm-deep">{score ?? '—'}</span><span className="ml-2 text-sm text-storm/60">/ 100</span></div>{category && <Badge tone={category === 'LOW' ? 'success' : category === 'MEDIUM' ? 'warning' : 'danger'}>{category}</Badge>}</div><div className="h-3 overflow-hidden rounded-full bg-pearl"><div className="h-full rounded-full bg-gradient-to-r from-verified via-warning to-rejected transition-all duration-700" style={{ width: `${value}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-storm/50"><span>Low</span><span>Medium</span><span>High</span><span>Critical</span></div></div>;
}

export function SampleDataButton({ onClick, children = 'Load sample data' }: { onClick: () => void; children?: React.ReactNode }) {
  return <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={onClick}><Clipboard size={14} />{children}</Button>;
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="flex items-start gap-3 rounded-xl border border-rejected/25 bg-rejected/8 p-3 text-sm text-rejected"><CircleAlert size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>;
}

export function EmptyState({ title = 'No verifications yet', detail = 'Run a workflow to create your first audit record.' }: { title?: string; detail?: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver bg-pearl/50 px-6 py-16 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-moonglow text-storm"><LockKeyhole size={21} /></span><h3 className="font-display text-2xl text-storm-deep">{title}</h3><p className="mt-2 max-w-sm text-sm text-ink/55">{detail}</p></div>;
}

export function ProofDetails({ result, onRefresh }: { result: VerificationResult; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await onRefresh(); toast.success('Status refreshed'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to refresh status'); } finally { setRefreshing(false); } };
  const rows = [['Task ID', result.taskId], ['Input commitment', result.commitment], ['Model version', String(result.modelVersion)], ['Task creation tx', result.transactions.taskCreationTx], ['Proof submission tx', result.transactions.proofSubmissionTx]] as const;
  return <Card><CardHeader className="flex items-center justify-between"><div><p className="eyebrow mb-1">Cryptographic record</p><CardTitle className="text-xl">Proof details</CardTitle></div><Button type="button" variant="ghost" onClick={refreshing ? undefined : refresh} disabled={refreshing}>{refreshing ? <Spinner className="h-3.5 w-3.5" /> : <ExternalLink size={14} />} Check status</Button></CardHeader><CardContent className="space-y-3">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-silver/45 pb-3 last:border-0 last:pb-0"><span className="text-xs text-ink/55">{label}</span>{label === 'Model version' ? <span className="font-mono text-xs text-storm-deep">v{value}</span> : <HashChip value={value} />}</div>)}<div className="pt-2"><p className="mb-2 text-xs text-ink/55">Backend message</p><p className="rounded-xl bg-pearl/70 p-3 text-xs leading-5 text-ink/70">{result.message}</p></div></CardContent></Card>;
}

export function PrivacySplit() {
  return <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-storm/15 bg-storm/5 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-storm-deep"><ShieldCheck size={16} /> What the verifier sees</div><ul className="space-y-2 text-xs text-ink/65"><li>• Claimed score or eligibility result</li><li>• Model ID and task ID</li><li>• Poseidon input commitment</li></ul></div><div className="rounded-2xl border border-verified/20 bg-verified/5 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-verified"><LockKeyhole size={16} /> What stays private</div><ul className="space-y-2 text-xs text-ink/65"><li>• Income stability index</li><li>• Repayment behaviour index</li><li>• Credit history and proof salt</li></ul></div></div>;
}

export function Assumptions({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  return <div className="border-t border-silver/55 pt-4"><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-storm-deep"><span>Calculation assumptions</span><ChevronDown size={16} className={cn('transition', open && 'rotate-180')} /></button>{open && <ul className="mt-3 space-y-2 text-xs leading-5 text-ink/60">{items.map((item) => <li key={item} className="flex gap-2"><span className="text-storm">•</span>{item}</li>)}</ul>}</div>;
}

export function useAuditEntries() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => { setEntries(auditStore.get()); return auditStore.subscribe(() => setEntries(auditStore.get())); }, []);
  return entries;
}
