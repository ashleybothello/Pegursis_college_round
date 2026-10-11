'use client';

import { useState } from 'react';
import { Check, CircleAlert, Fingerprint, Globe2, MapPin, MousePointer2, ShieldAlert, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { auditStore } from '@/lib/auditStore';
import type { FraudInput, FraudResult } from '@/lib/types';
import { formatDate, formatMoney, makeId } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FieldError, Input, PageHeader, SectionKicker, Toggle } from '@/components/ui';
import { ErrorBanner, RiskMeter, SampleDataButton } from '@/components/shared';
import { CalculationReceiptCard } from '@/components/platform';

const normal: FraudInput = { transactionAmount: 120, userAverageAmount: 100, userTransactionsLastHour: 1, transactionHourUtc: 14, isNewDevice: false, locationMismatch: false, rapidCrossBorderTransfers: false };
const suspicious: FraudInput = { transactionAmount: 15000, userAverageAmount: 1200, userTransactionsLastHour: 6, transactionHourUtc: 3, isNewDevice: true, locationMismatch: true, rapidCrossBorderTransfers: true };
type FraudErrors = Partial<Record<'transactionAmount' | 'userAverageAmount' | 'userTransactionsLastHour' | 'transactionHourUtc', string>>;

export default function FraudWorkspace() {
  const [values, setValues] = useState<FraudInput>(normal);
  const [result, setResult] = useState<FraudResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FraudErrors>({});

  const update = <K extends keyof FraudInput>(key: K, value: FraudInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(undefined);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const readNumber = (raw: string) => raw === '' ? Number.NaN : Number(raw);
  const readOptionalNumber = (raw: string) => raw === '' ? undefined : Number(raw);

  const validate = () => {
    const next: FraudErrors = {};
    if (!Number.isFinite(values.transactionAmount) || values.transactionAmount <= 0) next.transactionAmount = 'Enter an amount greater than 0.';
    if (values.userAverageAmount !== undefined && (!Number.isFinite(values.userAverageAmount) || values.userAverageAmount < 0)) next.userAverageAmount = 'Average amount cannot be negative.';
    if (values.userTransactionsLastHour !== undefined && (!Number.isInteger(values.userTransactionsLastHour) || values.userTransactionsLastHour < 0)) next.userTransactionsLastHour = 'Use a whole number of transactions.';
    if (values.transactionHourUtc !== undefined && (!Number.isInteger(values.transactionHourUtc) || values.transactionHourUtc < 0 || values.transactionHourUtc > 23)) next.transactionHourUtc = 'Use an hour from 0 to 23 UTC.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const calculate = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const next = await api.fraud(values);
      setResult(next);
      auditStore.add({ id: makeId('fraud'), timestamp: next.evaluatedAt, module: 'fraud', summary: `Risk ${next.riskScore} · ${next.riskCategory}`, status: 'computed', details: next as unknown as Record<string, unknown> });
      toast.success('Risk profile evaluated');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to score this transaction';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const load = (sample: FraudInput) => { setValues(sample); setFieldErrors({}); setError(''); };

  return <div>
    <PageHeader eyebrow="Transaction intelligence" title="Fraud scoring" description="Turn risk signals into an explainable profile. Every rule is visible, weighted and easy to challenge." action={<div className="flex flex-wrap gap-2"><SampleDataButton onClick={() => load(normal)}>Normal purchase</SampleDataButton><SampleDataButton onClick={() => load(suspicious)}>Suspicious transfer</SampleDataButton></div>} />
    <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
      <Card>
        <CardHeader><SectionKicker icon={<ShieldAlert size={14} />}>Transaction profile</SectionKicker><CardTitle className="mt-2">Evaluate the signals</CardTitle><p className="mt-2 text-sm leading-5 text-ink/55">The scoring model is deterministic and every triggered rule is shown in the evidence panel.</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4"><Field label="Transaction amount" error={fieldErrors.transactionAmount}><Input type="number" min={1} step="0.01" value={Number.isFinite(values.transactionAmount) ? values.transactionAmount : ''} onChange={(event) => update('transactionAmount', readNumber(event.target.value))} /></Field><Field label="User average amount" error={fieldErrors.userAverageAmount}><Input type="number" min={0} step="0.01" value={Number.isFinite(values.userAverageAmount) ? values.userAverageAmount : ''} onChange={(event) => update('userAverageAmount', readOptionalNumber(event.target.value))} /></Field><Field label="Transactions / last hour" error={fieldErrors.userTransactionsLastHour}><Input type="number" min={0} step="1" value={Number.isFinite(values.userTransactionsLastHour) ? values.userTransactionsLastHour : ''} onChange={(event) => update('userTransactionsLastHour', readOptionalNumber(event.target.value))} /></Field><Field label="Transaction hour (UTC)" error={fieldErrors.transactionHourUtc}><Input type="number" min={0} max={23} step="1" value={Number.isFinite(values.transactionHourUtc) ? values.transactionHourUtc : ''} onChange={(event) => update('transactionHourUtc', readOptionalNumber(event.target.value))} /></Field></div>
          <div className="divide-y divide-silver/50 rounded-xl border border-silver/60 px-3"><Toggle label="New or unrecognized device" checked={Boolean(values.isNewDevice)} onChange={(checked) => update('isNewDevice', checked)} /><Toggle label="Location mismatch" checked={Boolean(values.locationMismatch)} onChange={(checked) => update('locationMismatch', checked)} /><Toggle label="Rapid cross-border transfers" checked={Boolean(values.rapidCrossBorderTransfers)} onChange={(checked) => update('rapidCrossBorderTransfers', checked)} /></div>
          <div className="flex items-start gap-2 rounded-xl bg-moonglow/60 p-3 text-xs leading-5 text-storm-deep"><CircleAlert size={15} className="mt-0.5 shrink-0 text-warning" /><span>This is a demonstrative rule-based risk model for the Credence demo, not production surveillance.</span></div>
          <Button className="w-full" onClick={calculate} disabled={loading}>{loading ? <><span className="animate-spin">◌</span> Evaluating…</> : <><ShieldAlert size={16} /> Evaluate risk</>}</Button>
          <ErrorBanner message={error} />
        </CardContent>
      </Card>

      <div className="space-y-6"><Card><CardHeader className="flex items-center justify-between"><div><SectionKicker icon={<Fingerprint size={14} />}>Explainable outcome</SectionKicker><CardTitle className="mt-2">Why this transaction?</CardTitle></div>{result && <Badge tone={result.riskCategory === 'LOW' ? 'success' : result.riskCategory === 'MEDIUM' ? 'warning' : 'danger'}>{result.riskCategory}</Badge>}</CardHeader><CardContent>{result ? <div className="space-y-6"><RiskMeter score={result.riskScore} category={result.riskCategory} /><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<CircleDollarSignIcon />} label="Amount" value={formatMoney(values.transactionAmount)} /><Metric icon={<Timer size={16} />} label="Evaluated" value={formatDate(result.evaluatedAt)} /><Metric icon={<MousePointer2 size={16} />} label="Signals" value={`${result.ruleEvaluations.filter((rule) => rule.triggered).length} triggered`} /></div><div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-storm-deep">Rule evaluations</h3><span className="font-mono text-[11px] text-storm/55">{result.ruleEvaluations.length} rules</span></div><div className="overflow-hidden rounded-xl border border-silver/60"><div className="mobile-scroll-x"><table className="w-full min-w-[580px] text-left text-xs"><thead className="bg-pearl/60 text-[10px] uppercase tracking-[.1em] text-storm/60"><tr><th className="px-3 py-3">Rule</th><th className="px-3 py-3">State</th><th className="px-3 py-3">Points</th><th className="px-3 py-3">Details</th></tr></thead><tbody>{result.ruleEvaluations.map((rule) => <tr key={rule.ruleId} className={rule.triggered ? 'border-t border-warning/20 bg-warning/5' : 'border-t border-silver/40'}><td className="px-3 py-3 font-medium text-storm-deep"><span className="block">{rule.ruleId.replace('RULE_', '').replaceAll('_', ' ')}</span><span className="mt-1 block text-[11px] font-normal text-ink/50">{rule.description}</span></td><td className="px-3 py-3">{rule.triggered ? <span className="inline-flex items-center gap-1 font-semibold text-rejected"><Check size={13} /> Flagged</span> : <span className="inline-flex items-center gap-1 text-ink/45"><X size={13} /> Clear</span>}</td><td className="px-3 py-3 font-mono text-storm-deep">{rule.triggered ? `+${rule.points}` : '—'}</td><td className="max-w-52 px-3 py-3 text-ink/55">{rule.details ?? 'No exception detected'}</td></tr>)}</tbody></table></div></div></div><div className="rounded-2xl bg-pearl/65 p-4"><p className="eyebrow">Why this score</p><ul className="mt-3 space-y-2 text-sm leading-5 text-ink/70">{result.reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{reason}</li>)}</ul></div><CalculationReceiptCard module="fraud" inputs={values as Record<string, unknown>} output={result as unknown as Record<string, unknown>} /><p className="text-xs leading-5 text-ink/45">{result.disclaimer}</p></div> : <EmptyResult />}</CardContent></Card></div>
    </div>
  </div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><label className="field-label">{label}</label>{children}<FieldError>{error}</FieldError></div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-3 rounded-xl bg-pearl/70 p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-moonglow text-storm">{icon}</span><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.1em] text-storm/55">{label}</p><p className="mt-1 truncate text-sm font-semibold text-storm-deep">{value}</p></div></div>; }
function CircleDollarSignIcon() { return <span className="text-sm font-bold">$</span>; }
function EmptyResult() { return <div className="flex min-h-[560px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-moonglow text-storm"><ShieldAlert size={24} /></span><h3 className="mt-5 font-display text-2xl text-storm-deep">Risk evidence will appear here</h3><p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">Evaluate a transaction to see the score, triggered rules and the plain-language reason list.</p></div>; }
