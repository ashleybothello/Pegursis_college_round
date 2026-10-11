'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Calculator, ChevronDown, CircleDollarSign, Landmark, ShieldCheck } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { auditStore } from '@/lib/auditStore';
import { buildAmortization } from '@/lib/amortization';
import type { EmiInput, EmiResult } from '@/lib/types';
import { formatMoney, makeId } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FieldError, Input, PageHeader, SectionKicker, Select } from '@/components/ui';
import { Assumptions, ErrorBanner, SampleDataButton } from '@/components/shared';
import { CalculationReceiptCard } from '@/components/platform';

type LoanValues = { principal: number; annualInterestRate: number; tenureMonths: number; monthlyIncome: number; unit: 'months' | 'years' };
type LoanErrors = Partial<Record<keyof LoanValues, string>>;

const SAMPLE: LoanValues = { principal: 50000, annualInterestRate: 8.5, tenureMonths: 36, monthlyIncome: 5000, unit: 'months' };

export default function LoansWorkspace() {
  const [values, setValues] = useState<LoanValues>(SAMPLE);
  const [result, setResult] = useState<EmiResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoanErrors>({});

  const rows = useMemo(() => result ? buildAmortization(result.principal, result.annualInterestRate, result.tenureMonths) : [], [result]);
  const affordability = result ? result.monthlyEmi / Math.max(1, values.monthlyIncome) : 0;
  const chartData = result ? [
    { name: 'Principal', value: result.principal, color: '#6F7F92' },
    { name: 'Interest', value: result.totalInterest, color: '#D9B95F' },
  ] : [];

  const update = <K extends keyof LoanValues>(key: K, value: LoanValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(undefined);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const readNumber = (raw: string) => raw === '' ? Number.NaN : Number(raw);

  const validate = () => {
    const next: LoanErrors = {};
    if (!Number.isFinite(values.principal) || values.principal <= 0) next.principal = 'Enter a loan amount greater than 0.';
    if (!Number.isFinite(values.annualInterestRate) || values.annualInterestRate < 0 || values.annualInterestRate > 100) next.annualInterestRate = 'Use an interest rate from 0% to 100%.';
    if (!Number.isInteger(values.tenureMonths) || values.tenureMonths < 1 || values.tenureMonths > 480) next.tenureMonths = 'Tenure must be a whole number from 1 to 480 months.';
    if (!Number.isFinite(values.monthlyIncome) || values.monthlyIncome <= 0) next.monthlyIncome = 'Enter monthly income greater than 0.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const calculate = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    const input: EmiInput = { principal: values.principal, annualInterestRate: values.annualInterestRate, tenureMonths: values.tenureMonths };
    try {
      const next = await api.emi(input);
      setResult(next);
      auditStore.add({ id: makeId('loan'), timestamp: new Date().toISOString(), module: 'loan', summary: `EMI ${formatMoney(next.monthlyEmi)}`, status: 'computed', details: next as unknown as Record<string, unknown> });
      toast.success('EMI calculation complete');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to calculate EMI';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const shownTenure = values.unit === 'years' ? Math.round(values.tenureMonths / 12) : values.tenureMonths;
  const setTenureUnit = (unit: LoanValues['unit']) => update('unit', unit);
  const setTenureValue = (value: number) => update('tenureMonths', Number.isFinite(value) ? values.unit === 'years' ? Math.round(value * 12) : Math.round(value) : Number.NaN);

  return <div>
    <PageHeader eyebrow="Loan planning" title="Loans & EMI" description="Make the repayment path visible—from monthly installment to the last cent of interest." action={<SampleDataButton onClick={() => { setValues(SAMPLE); setFieldErrors({}); setError(''); }} />} />
    <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
      <Card>
        <CardHeader><SectionKicker icon={<Calculator size={14} />}>Loan scenario</SectionKicker><CardTitle className="mt-2">Set the terms</CardTitle><p className="mt-2 text-sm leading-5 text-ink/55">Monthly income is used only in this browser to model affordability.</p></CardHeader>
        <CardContent className="space-y-5">
          <Field label="Loan amount" error={fieldErrors.principal}><Input type="number" min={1} step="100" value={Number.isFinite(values.principal) ? values.principal : ''} onChange={(event) => update('principal', readNumber(event.target.value))} /></Field>
          <Field label="Annual interest rate" error={fieldErrors.annualInterestRate}><div className="relative"><Input type="number" min={0} max={100} step="0.1" value={Number.isFinite(values.annualInterestRate) ? values.annualInterestRate : ''} onChange={(event) => update('annualInterestRate', readNumber(event.target.value))} /><span className="absolute right-3 top-3 text-sm text-storm/60">%</span></div></Field>
          <div className="grid grid-cols-[1fr_108px] gap-2"><Field label="Tenure" error={fieldErrors.tenureMonths}><Input type="number" min={1} max={values.unit === 'years' ? 40 : 480} value={Number.isFinite(shownTenure) ? shownTenure : ''} onChange={(event) => setTenureValue(readNumber(event.target.value))} /></Field><Field label="Unit"><Select value={values.unit} onChange={(event) => setTenureUnit(event.target.value as LoanValues['unit'])}><option value="months">Months</option><option value="years">Years</option></Select></Field></div>
          <Field label="Monthly income" error={fieldErrors.monthlyIncome}><div className="relative"><Input type="number" min={1} step="100" value={Number.isFinite(values.monthlyIncome) ? values.monthlyIncome : ''} onChange={(event) => update('monthlyIncome', readNumber(event.target.value))} /><span className="absolute right-3 top-3 text-xs text-storm/60">USD / mo</span></div></Field>
          <div className="flex items-start gap-2 rounded-xl bg-moonglow/60 p-3 text-xs leading-5 text-storm-deep"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-verified" /><span>Affordability is a planning signal, not an approval decision. Credit proof stays in its own workflow.</span></div>
          <Button className="w-full" onClick={calculate} disabled={loading}>{loading ? <><span className="animate-spin">◌</span> Calculating…</> : <><Calculator size={16} /> Calculate EMI</>}</Button>
          <ErrorBanner message={error} />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><SectionKicker icon={<CircleDollarSign size={14} />}>Repayment result</SectionKicker><CardTitle className="mt-2">A clearer cost of borrowing</CardTitle></div>{result && <Badge tone="success">Calculated</Badge>}</CardHeader>
          <CardContent>{result ? <div className="space-y-6">
            <div className="rounded-2xl bg-moonglow/65 p-5"><p className="eyebrow">Monthly EMI</p><p className="mt-2 font-display text-5xl tracking-tight text-storm-deep">{formatMoney(result.monthlyEmi, result.currencyUnit)}</p><p className="mt-2 text-sm text-ink/55">for {result.tenureMonths} months at {result.annualInterestRate}% annual interest</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><Metric label="Total repayment" value={formatMoney(result.totalRepayment, result.currencyUnit)} /><Metric label="Total interest" value={formatMoney(result.totalInterest, result.currencyUnit)} /></div>
            <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: number | string) => formatMoney(Number(value), result.currencyUnit)} /></PieChart></ResponsiveContainer></div><div className="space-y-3">{chartData.map((entry) => <div key={entry.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-ink/65"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{entry.name}</span><strong className="font-mono text-xs text-storm-deep">{formatMoney(entry.value, result.currencyUnit)}</strong></div>)}</div></div>
            <Affordability ratio={affordability} income={values.monthlyIncome} emi={result.monthlyEmi} currency={result.currencyUnit} />
            <CalculationReceiptCard module="loan" inputs={{ principal: values.principal, annualInterestRate: values.annualInterestRate, tenureMonths: values.tenureMonths, monthlyIncome: values.monthlyIncome }} output={result as unknown as Record<string, unknown>} />
            <Assumptions items={result.assumptions} />
          </div> : <EmptyResult />}</CardContent>
        </Card>
        {result && <AmortizationTable rows={rows} assumptions={result.assumptions} />}
        <Card className="border-storm/15 bg-storm/5"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Next decision</p><h2 className="mt-2 font-display text-2xl text-storm-deep">Need a credit check?</h2><p className="mt-1 text-sm text-ink/60">Approval threshold in the eligibility circuit: <strong>700</strong>.</p></div><Link href="/credit" className="button-secondary shrink-0">Go to Credit Scoring <ArrowUpRight size={15} /></Link></CardContent></Card>
      </div>
    </div>
  </div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><label className="field-label">{label}</label>{children}<FieldError>{error}</FieldError></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-pearl/65 p-3"><p className="text-[10px] uppercase tracking-[.1em] text-storm/55">{label}</p><p className="mt-1 text-sm font-semibold text-storm-deep">{value}</p></div>; }

function EmptyResult() { return <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-moonglow text-storm"><Calculator size={24} /></span><h3 className="mt-5 font-display text-2xl text-storm-deep">Your repayment path starts here</h3><p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">Set the loan terms and calculate to see the EMI, interest split and affordability signal.</p></div>; }

function Affordability({ ratio, income, emi, currency }: { ratio: number; income: number; emi: number; currency: string }) {
  const percentage = Math.min(100, ratio * 100);
  const comfortable = ratio <= .3;
  const stretched = ratio > .3 && ratio <= .5;
  const label = comfortable ? 'Comfortable' : stretched ? 'Stretched' : 'Unaffordable';
  const tone = comfortable ? 'success' : stretched ? 'warning' : 'danger';
  return <div className="rounded-2xl border border-silver/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Frontend affordability signal</p><h3 className="mt-1 text-sm font-semibold text-storm-deep">EMI-to-income ratio</h3></div><Badge tone={tone}>{label}</Badge></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[linear-gradient(to_right,#5E8C6A_0%,#5E8C6A_30%,#C49A45_30%,#C49A45_50%,#B5544C_50%,#B5544C_100%)]"><div className="h-full rounded-full bg-storm-deep/80 transition-all duration-700" style={{ width: `${percentage}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.09em] text-storm/50"><span>0%</span><span>30% comfortable</span><span>50% limit</span><span>100%</span></div><p className="mt-3 text-xs leading-5 text-ink/55">{formatMoney(emi, currency)} monthly EMI ÷ {formatMoney(income, currency)} monthly income = <strong className="text-storm-deep">{(ratio * 100).toFixed(1)}%</strong>. Calculated locally in the browser.</p></div>;
}

function AmortizationTable({ rows, assumptions }: { rows: ReturnType<typeof buildAmortization>; assumptions: string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 12);
  return <Card><CardHeader className="flex items-center justify-between"><div><SectionKicker icon={<Landmark size={14} />}>Repayment schedule</SectionKicker><CardTitle className="mt-2 text-xl">Amortization</CardTitle></div><button type="button" onClick={() => setAll(!all)} className="button-secondary h-9 px-3 text-xs">{all ? 'Show first 12' : `Show all ${rows.length}`}<ChevronDown size={14} className={all ? 'rotate-180' : ''} /></button></CardHeader><CardContent className="p-0"><div className="mobile-scroll-x"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-pearl/60 text-[10px] uppercase tracking-[.12em] text-storm/60"><tr><th className="px-5 py-3">Month</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Interest</th><th className="px-5 py-3">Principal</th><th className="px-5 py-3">Balance</th></tr></thead><tbody>{shown.map((row) => <tr key={row.month} className="border-t border-silver/40 text-ink/70"><td className="px-5 py-3 font-mono text-storm-deep">{String(row.month).padStart(2, '0')}</td><td className="px-5 py-3">{formatMoney(row.payment)}</td><td className="px-5 py-3">{formatMoney(row.interest)}</td><td className="px-5 py-3">{formatMoney(row.principal)}</td><td className="px-5 py-3 font-semibold text-storm-deep">{formatMoney(row.balance)}</td></tr>)}</tbody></table></div><div className="p-5"><Assumptions items={assumptions} /></div></CardContent></Card>;
}
