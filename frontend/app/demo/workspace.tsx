'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, FlaskConical, LockKeyhole, RefreshCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { auditStore } from '@/lib/auditStore';
import { makeId } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, SectionKicker, Spinner } from '@/components/ui';
import { ErrorBanner, VerifiedSeal } from '@/components/shared';
import type { DemoVerificationResult } from '@/lib/types';
import { groth16 } from 'snarkjs';

type Scenario = 'credit' | 'eligibility';
type Attack = 'score' | 'proof' | 'replay' | 'model' | 'threshold';
type Fixture = { proof: any; vkey: unknown; honest: string[]; tampered: string[] };

const attackMeta: Record<Attack, { label: string; short: string; guard: string; detail: string }> = {
  score: { label: 'Changed score', short: '755 → 756', guard: 'invalid proof', detail: 'Change one public result while reusing the honest proof.' },
  proof: { label: 'Corrupted proof', short: 'proof byte flip', guard: 'invalid proof', detail: 'Alter one proof coordinate without changing the public result.' },
  replay: { label: 'Replay attack', short: 'different task ID', guard: 'taskId signal mismatch', detail: 'Use a valid proof for one task against a different registered task.' },
  model: { label: 'Wrong model', short: 'model 1 → 2', guard: 'model signal mismatch', detail: 'Claim the result came from a different approved formula.' },
  threshold: { label: 'Lowered threshold', short: '700 → 600', guard: 'threshold signal mismatch', detail: 'Change the eligibility threshold outside the circuit constant.' },
};

export default function TamperDemo() {
  const [scenario, setScenario] = useState<Scenario>('credit');
  const [attack, setAttack] = useState<Attack>('score');
  const [fixture, setFixture] = useState<Fixture>();
  const [tamperedValue, setTamperedValue] = useState('756');
  const [verification, setVerification] = useState<DemoVerificationResult>();
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { void loadScenario('credit'); }, []);

  const loadScenario = async (nextScenario: Scenario) => {
    setLoading(true); setError(''); setVerification(undefined); setScenario(nextScenario); setAttack('score'); setTamperedValue(nextScenario === 'credit' ? '756' : '0');
    try {
      const base = nextScenario === 'credit' ? '' : 'eligibility_';
      const names = ['proof.json', 'verification_key.json', 'public.json', 'public_tampered.json'];
      const payloads = await Promise.all(names.map(async (file) => { const response = await fetch(`/zk/${base}${file}`); if (!response.ok) throw new Error(`Missing browser fixture: ${base}${file}`); return response.json(); }));
      setFixture({ proof: payloads[0], vkey: payloads[1], honest: payloads[2], tampered: payloads[3] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load proof fixtures'); } finally { setLoading(false); }
  };

  const currentTamperedSignals = useMemo(() => {
    if (!fixture) return [];
    const next = [...fixture.honest];
    if (attack === 'score') next[0] = tamperedValue.trim() || fixture.tampered[0];
    if (attack === 'threshold') next[1] = '600';
    if (attack === 'replay') next[scenario === 'credit' ? 2 : 3] = String(BigInt(next[scenario === 'credit' ? 2 : 3]) + BigInt(1));
    if (attack === 'model') next[scenario === 'credit' ? 1 : 2] = scenario === 'credit' ? '2' : '1';
    return next;
  }, [attack, fixture, scenario, tamperedValue]);

  const currentTamperedProof = useMemo(() => {
    if (!fixture) return undefined;
    if (attack !== 'proof') return fixture.proof;
    const corrupted = JSON.parse(JSON.stringify(fixture.proof));
    corrupted.pi_a[0] = (BigInt(corrupted.pi_a[0]) + BigInt(1)).toString();
    return corrupted;
  }, [attack, fixture]);

  const runVerification = async () => {
    if (!fixture || !currentTamperedProof) return;
    setRunning(true); setVerification(undefined); setError('');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      // Keep this as a static client import so Next resolves snarkjs's
      // browser conditional export in the main client bundle.
      const honest = await groth16.verify(fixture.vkey, fixture.honest, fixture.proof);
      const tampered = await groth16.verify(fixture.vkey, currentTamperedSignals, currentTamperedProof);
      const next: DemoVerificationResult = { honest, tampered, honestSignals: fixture.honest, tamperedSignals: currentTamperedSignals, scenario, attack };
      setVerification(next);
      auditStore.add({ id: makeId('demo'), timestamp: new Date().toISOString(), module: 'demo', summary: `${attackMeta[attack].label}: ${fixture.honest[0]} → ${currentTamperedSignals[0]}`, status: honest && !tampered ? 'verified' : 'rejected', details: next as unknown as Record<string, unknown> });
      if (honest && !tampered) toast.success('Honest proof valid. Attack rejected.'); else toast.error('Verification returned an unexpected result.');
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Browser proof verification failed'; setError(message); toast.error(message); } finally { setRunning(false); }
  };

  const isCredit = scenario === 'credit';
  const honestValue = fixture?.honest[0] ?? (isCredit ? '755' : '1');
  const attacks = isCredit ? (['score', 'proof', 'replay', 'model'] as Attack[]) : (['score', 'proof', 'replay', 'model', 'threshold'] as Attack[]);

  return <div><PageHeader eyebrow="Adversarial verification lab" title="Honest versus tampered" description="The requester, provider and verifier do not need to trust one another. Run real Groth16 verification against changed results, corrupted proofs and inconsistent task context." action={<Badge tone="storm"><FlaskConical size={13} /> Real circuit · 300–900</Badge>} />
    <div className="mb-6 flex w-fit rounded-2xl border border-silver bg-card p-1"><button type="button" onClick={() => void loadScenario('credit')} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isCredit ? 'bg-moonglow text-storm-deep shadow-sm' : 'text-storm/65 hover:text-storm-deep'}`}>Credit score</button><button type="button" onClick={() => void loadScenario('eligibility')} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${!isCredit ? 'bg-moonglow text-storm-deep shadow-sm' : 'text-storm/65 hover:text-storm-deep'}`}>Loan eligibility</button></div>
    {error && <div className="mb-6"><ErrorBanner message={error} /></div>}
    {loading ? <Card><CardContent className="flex min-h-64 items-center justify-center"><Spinner className="h-7 w-7 text-storm" /></CardContent></Card> : <>
      <Card className="mb-6"><CardHeader><SectionKicker icon={<RefreshCcw size={14} />}>Attack catalogue</SectionKicker><CardTitle className="mt-2 text-xl">Choose what the verifier should reject</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{attacks.map((item) => <button key={item} type="button" onClick={() => { setAttack(item); setVerification(undefined); }} className={`rounded-xl border p-3 text-left transition ${attack === item ? 'border-storm bg-moonglow/70' : 'border-silver bg-card hover:border-storm/45'}`}><span className="block text-xs font-bold text-storm-deep">{attackMeta[item].label}</span><span className="mt-1 block font-mono text-[10px] text-ink/55">{attackMeta[item].short}</span></button>)}</div><div className="mt-4 flex flex-col gap-2 rounded-xl bg-pearl/65 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-ink/65">{attackMeta[attack].detail}</span><span className="font-mono font-semibold text-rejected">Expected contract guard: {attackMeta[attack].guard}</span></div></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><DemoPanel title={isCredit ? 'Honest submission' : 'Approved submission'} tone="honest" value={honestValue} scenario={scenario} verified={verification?.honest} loading={running} /><DemoPanel title={isCredit ? attackMeta[attack].label : `Flipped · ${attackMeta[attack].label}`} tone="tampered" value={currentTamperedSignals[0]} honestValue={honestValue} scenario={scenario} verified={verification?.tampered} loading={running} tampered attack={attack} /></div>
      <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-storm/20 bg-storm-deep p-4 text-center text-white shadow-lift"><p className="text-xs uppercase tracking-[.16em] text-white/55">The moment of truth</p><Button type="button" onClick={runVerification} disabled={running || !fixture} className="mt-3 w-full bg-moonglow text-storm-deep hover:bg-white">{running ? <><Spinner className="h-4 w-4" /> Verifying both submissions…</> : <><Sparkles size={16} /> Run verification</>}</Button><p className="mt-3 text-xs leading-5 text-white/55">The honest proof must pass while the selected attack fails.</p></div>
      {attack === 'score' && <Card className="mt-6 border-rejected/20 bg-rejected/5"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow text-rejected/75">Change the claim</p><h2 className="mt-1 font-display text-2xl text-storm-deep">Edit the tampered value</h2><p className="mt-1 text-xs leading-5 text-ink/60">Honest signal: <span className="font-mono font-semibold text-storm-deep">{honestValue}</span> · any altered result should fail.</p></div><label className="w-full sm:max-w-[180px]"><span className="sr-only">Tampered value</span><Input value={tamperedValue} onChange={(event) => setTamperedValue(event.target.value)} inputMode="numeric" className="border-rejected/30 bg-card font-mono text-center text-lg" /></label></CardContent></Card>}
      {fixture && <div className="mt-6"><RawSignals honest={fixture.honest} tampered={currentTamperedSignals} /></div>}
      <div className="mt-6 rounded-2xl border border-verified/20 bg-verified/5 p-5"><div className="flex items-start gap-3"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-verified" /><p className="text-sm leading-6 text-ink/70">The proof is cryptographically bound to the exact public signals. Changing the result, proof bytes, task ID, model or threshold invalidates the submission before it can be accepted. On-chain, VerityManager rejects the same inconsistency with <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs text-storm-deep">{attackMeta[attack].guard}</code>.</p></div></div>
    </>}
  </div>;
}

function DemoPanel({ title, tone, value, honestValue, scenario, verified, loading, tampered, attack }: { title: string; tone: 'honest' | 'tampered'; value?: string; honestValue?: string; scenario: Scenario; verified?: boolean; loading: boolean; tampered?: boolean; attack?: Attack }) {
  const isCredit = scenario === 'credit';
  return <motion.div animate={tampered && verified === false ? { x: [0, -6, 6, 0] } : { x: 0 }} transition={{ duration: .35 }}><Card className={`overflow-hidden ${tone === 'tampered' ? 'border-rejected/35' : 'border-verified/30'}`}><div className={`h-1 ${tone === 'tampered' ? 'bg-rejected' : 'bg-verified'}`} /><CardContent className="p-5 sm:p-7"><div className="flex items-center justify-between"><div className={`flex items-center gap-2 text-sm font-semibold ${tone === 'tampered' ? 'text-rejected' : 'text-verified'}`}>{tone === 'tampered' ? <X size={18} /> : <ShieldCheck size={18} />}{title}</div>{verified === undefined && !loading && <Badge tone="neutral">Ready</Badge>}</div><div className="mt-8 text-center"><p className="eyebrow">{isCredit ? 'Claimed score' : 'Private score'}</p>{isCredit ? <><p className="mt-2 font-display text-7xl tracking-tight text-storm-deep">{value ?? '—'}</p>{tone === 'tampered' && attack !== 'proof' && value !== honestValue && <p className="mt-2 text-xs font-semibold text-rejected">Changed public context</p>}{tone === 'tampered' && attack === 'proof' && <p className="mt-2 text-xs font-semibold text-rejected">Proof bytes altered</p>}</> : <><p className="mt-3 font-display text-5xl text-storm-deep">•••</p><p className="mt-2 text-xs text-storm/60">Score never revealed</p><div className="mx-auto mt-4 inline-flex rounded-xl bg-moonglow px-3 py-2 font-mono text-xs text-storm-deep">eligible = {value}</div></>}</div><div className="mt-8 flex min-h-12 items-center justify-center">{loading ? <div className="flex items-center gap-2 text-sm text-storm/65"><Spinner /> Verifying…</div> : verified === true ? <VerifiedSeal label={tone === 'tampered' ? 'Unexpectedly valid' : 'PROOF VALID'} /> : verified === false ? <VerifiedSeal rejected label="PROOF REJECTED" /> : <p className="text-xs text-storm/50">Run the verifier to reveal the result</p>}</div><div className="mt-7 border-t border-silver/45 pt-4"><div className="flex items-center justify-between text-xs"><span className="text-ink/50">Proof bytes</span><span className="font-mono text-storm-deep">{attack === 'proof' && tone === 'tampered' ? 'corrupted copy' : 'proof.json'}</span></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-ink/50">Binding under test</span><span className="font-mono text-storm-deep">{attack === 'proof' ? 'pi_a[0]' : attack === 'score' ? 'result' : attack === 'replay' ? 'taskId' : attack === 'model' ? 'modelId' : 'threshold'}</span></div></div></CardContent></Card></motion.div>;
}

function RawSignals({ honest, tampered }: { honest: string[]; tampered: string[] }) { const [open, setOpen] = useState(false); return <Card><CardHeader><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left"><div><SectionKicker>Public signal diff</SectionKicker><CardTitle className="mt-2 text-xl">Raw public signals</CardTitle><p className="mt-1 text-xs text-ink/50">Changed indexes are highlighted before the verifier runs.</p></div><ChevronDown size={18} className={`text-storm transition ${open ? 'rotate-180' : ''}`} /></button></CardHeader>{open && <CardContent><div className="grid gap-3 sm:grid-cols-2"><SignalColumn label="Honest" values={honest} compare={tampered} /><SignalColumn label="Attack" values={tampered} compare={honest} /></div></CardContent>}</Card>; }
function SignalColumn({ label, values, compare }: { label: string; values: string[]; compare: string[] }) { return <div className="rounded-xl bg-pearl/65 p-3"><p className="mb-2 text-xs font-semibold text-storm-deep">{label}</p>{values.map((value, index) => { const changed = value !== compare[index]; return <div key={`${label}-${index}`} className={`flex items-center justify-between border-t py-2 font-mono text-[11px] ${changed ? 'border-rejected/25 bg-rejected/10 text-rejected' : 'border-silver/45 text-ink/70'}`}><span className="px-2 text-storm/50">[{index}]</span><span className="max-w-[85%] truncate px-2 text-right" title={value}>{value}{changed && <span className="ml-2 font-sans text-[10px] font-bold uppercase">changed</span>}</span></div>; })}</div>; }
