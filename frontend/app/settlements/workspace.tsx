'use client';

import { useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, CircleDollarSign, Coins, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { auditStore } from '@/lib/auditStore';
import type { SettlementInput, SettlementResult } from '@/lib/types';
import { formatMinor, makeId } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FieldError, Input, PageHeader, SectionKicker, Select } from '@/components/ui';
import { ErrorBanner, SampleDataButton } from '@/components/shared';
import { CalculationReceiptCard } from '@/components/platform';

type SettlementValues = { gross: number; fee: number; fixed: number; currency: string };
type SettlementErrors = Partial<Record<keyof SettlementValues, string>>;
const SAMPLE: SettlementValues = { gross: 250, fee: 2.5, fixed: .3, currency: 'USD' };

export default function SettlementsWorkspace() {
  const [values, setValues] = useState<SettlementValues>(SAMPLE);
  const [result, setResult] = useState<SettlementResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SettlementErrors>({});

  const update = <K extends keyof SettlementValues>(key: K, value: SettlementValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(undefined);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const readNumber = (raw: string) => raw === '' ? Number.NaN : Number(raw);

  const validate = () => {
    const next: SettlementErrors = {};
    if (!Number.isFinite(values.gross) || values.gross <= 0) next.gross = 'Enter a gross amount greater than 0.';
    if (!Number.isFinite(values.fee) || values.fee < 0 || values.fee > 100) next.fee = 'Fee must be between 0% and 100%.';
    if (!Number.isFinite(values.fixed) || values.fixed < 0) next.fixed = 'Fixed fee cannot be negative.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const calculate = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    const input: SettlementInput = { grossAmount: Math.round(values.gross * 100), feeBasisPoints: Math.round(values.fee * 100), fixedFeeMinorUnits: Math.round(values.fixed * 100), currency: values.currency };
    try {
      const next = await api.settlement(input);
      setResult(next);
      auditStore.add({ id: makeId('settlement'), timestamp: next.calculatedAt, module: 'settlement', summary: `Net ${formatMinor(next.netAmount, next.currency)}`, status: 'computed', details: next as unknown as Record<string, unknown> });
      toast.success('Settlement calculated');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to calculate settlement';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return <div>
    <PageHeader eyebrow="Payment operations" title="Settlements" description="Trace every deduction from gross amount to net payout with integer minor-unit arithmetic." action={<SampleDataButton onClick={() => { setValues(SAMPLE); setFieldErrors({}); setError(''); }} />} />
    <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
      <Card><CardHeader><SectionKicker icon={<ReceiptText size={14} />}>Settlement input</SectionKicker><CardTitle className="mt-2">Settle a payment</CardTitle><p className="mt-2 text-sm leading-5 text-ink/55">Enter dollars here. Credence sends integer cents to the settlement service.</p></CardHeader><CardContent className="space-y-5">
        <Field label="Gross amount" error={fieldErrors.gross}><div className="relative"><Input type="number" min={0.01} step="0.01" value={Number.isFinite(values.gross) ? values.gross : ''} onChange={(event) => update('gross', readNumber(event.target.value))} /><span className="absolute right-3 top-3 text-xs text-storm/60">{values.currency}</span></div></Field>
        <Field label="Processing fee" error={fieldErrors.fee}><div className="relative"><Input type="number" min={0} max={100} step="0.01" value={Number.isFinite(values.fee) ? values.fee : ''} onChange={(event) => update('fee', readNumber(event.target.value))} /><span className="absolute right-3 top-3 text-sm text-storm/60">%</span></div></Field>
        <Field label="Fixed fee" error={fieldErrors.fixed}><div className="relative"><Input type="number" min={0} step="0.01" value={Number.isFinite(values.fixed) ? values.fixed : ''} onChange={(event) => update('fixed', readNumber(event.target.value))} /><span className="absolute right-3 top-3 text-xs text-storm/60">{values.currency}</span></div></Field>
        <Field label="Currency"><Select value={values.currency} onChange={(event) => update('currency', event.target.value)}><option>USD</option><option>EUR</option><option>INR</option><option>GBP</option></Select></Field>
        <div className="rounded-xl bg-moonglow/60 p-3 text-xs leading-5 text-storm-deep"><strong>Exact arithmetic:</strong> the backend rounds fee components in minor units, eliminating floating-point drift.</div>
        <Button className="w-full" onClick={calculate} disabled={loading}>{loading ? <><span className="animate-spin">◌</span> Calculating…</> : <><ArrowLeftRight size={16} /> Calculate settlement</>}</Button><ErrorBanner message={error} />
      </CardContent></Card>

      <div className="space-y-6"><Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><SectionKicker icon={<Coins size={14} />}>Payout waterfall</SectionKicker><CardTitle className="mt-2">Follow every cent</CardTitle></div>{result && <Badge tone={result.status === 'SETTLED' ? 'success' : result.status === 'HELD' ? 'warning' : result.status === 'FAILED' ? 'danger' : 'storm'}>{result.status}</Badge>}</CardHeader><CardContent>{result ? <div className="space-y-3"><WaterfallRow icon={<ArrowUp size={16} />} label="Gross amount" value={formatMinor(result.grossAmount, result.currency)} strong /><div className="flex justify-center text-silver"><ArrowDown size={17} /></div><WaterfallRow icon={<ArrowDown size={16} />} label={`Processing fee · ${result.feeBreakdown.effectiveRatePercent}% effective`} value={`− ${formatMinor(result.feeBreakdown.basisPointsFee, result.currency)}`} /><WaterfallRow icon={<ArrowDown size={16} />} label="Fixed fee" value={`− ${formatMinor(result.feeBreakdown.fixedFee, result.currency)}`} /><div className="my-4 border-t border-dashed border-silver" /><div className="rounded-2xl bg-moonglow/70 p-5"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Net payout</p><p className="mt-2 font-display text-5xl tracking-tight text-storm-deep">{formatMinor(result.netAmount, result.currency)}</p></div><CircleDollarSign size={34} className="text-verified" /></div></div><div className="grid gap-3 pt-3 sm:grid-cols-2"><Small label="Fee amount" value={formatMinor(result.feeAmount, result.currency)} /><Small label="Effective rate" value={`${result.feeBreakdown.effectiveRatePercent}%`} /><Small label="Basis points fee" value={formatMinor(result.feeBreakdown.basisPointsFee, result.currency)} /><Small label="Calculated" value={new Date(result.calculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} /></div><CalculationReceiptCard module="settlement" inputs={{ gross: values.gross, fee: values.fee, fixed: values.fixed, currency: values.currency }} output={result as unknown as Record<string, unknown>} /><p className="pt-2 text-xs leading-5 text-ink/50">All arithmetic in integer minor units: zero floating-point drift. Status is <strong className="text-storm-deep">{result.status}</strong>.</p></div> : <EmptyResult />}</CardContent></Card></div>
    </div>
  </div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><label className="field-label">{label}</label>{children}<FieldError>{error}</FieldError></div>; }
function WaterfallRow({ icon, label, value, strong }: { icon: React.ReactNode; label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-pearl/60 px-4 py-3"><div className="flex items-center gap-3"><span className="text-storm">{icon}</span><span className={strong ? 'text-sm font-semibold text-storm-deep' : 'text-sm text-ink/65'}>{label}</span></div><span className={strong ? 'text-sm font-semibold text-storm-deep' : 'font-mono text-sm text-ink/70'}>{value}</span></div>; }
function Small({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-silver/50 p-3"><p className="text-[10px] uppercase tracking-[.1em] text-storm/55">{label}</p><p className="mt-1 text-sm font-semibold text-storm-deep">{value}</p></div>; }
function EmptyResult() { return <div className="flex min-h-[460px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-moonglow text-storm"><CircleDollarSign size={24} /></span><h3 className="mt-5 font-display text-2xl text-storm-deep">Net payout will appear here</h3><p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">Calculate a settlement to see the exact gross-to-net waterfall and fee breakdown.</p></div>; }
