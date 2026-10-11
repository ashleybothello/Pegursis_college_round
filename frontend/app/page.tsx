'use client';

import Link from 'next/link';
import { ArrowLeftRight, ArrowUpRight, Check, ChevronRight, FlaskConical, Landmark, LayoutDashboard, LockKeyhole, ShieldAlert, ShieldCheck, UserCheck, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, Badge, SectionKicker } from '@/components/ui';
import { useAuditEntries } from '@/components/shared';
import { formatDate } from '@/lib/utils';
import { PlatformFlow } from '@/components/platform';

const modules = [
  { href: '/credit', icon: UserCheck, title: 'Credit scoring', description: 'Compute a private score and create a proof of the approved formula.', tag: 'ZK verified' },
  { href: '/loans', icon: Landmark, title: 'Loans & EMI', description: 'Model monthly repayments, affordability and the full amortization path.', tag: 'Financial logic' },
  { href: '/fraud', icon: ShieldAlert, title: 'Fraud scoring', description: 'Explain suspicious activity with transparent, rule-based risk signals.', tag: 'Explainable' },
  { href: '/settlements', icon: ArrowLeftRight, title: 'Settlements', description: 'See fee deductions and exact net payout with minor-unit arithmetic.', tag: 'Zero drift' },
];

export default function OverviewPage() {
  const entries = useAuditEntries();
  const verified = entries.filter((entry) => entry.status === 'verified').length;
  const rejected = entries.filter((entry) => entry.status === 'rejected' || entry.status === 'failed').length;
  const last = entries[0];

  return <div className="space-y-8">
    <section className="iridescent relative overflow-hidden rounded-[24px] border border-silver/80 px-6 py-9 shadow-soft sm:px-10 sm:py-12"><div className="absolute -right-12 -top-24 h-64 w-64 rounded-full bg-white/25 blur-3xl" /><div className="relative max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-storm/15 bg-card/60 px-3 py-1.5 text-xs font-semibold text-storm-deep"><ShieldCheck size={14} className="text-verified" /> Verifiable finance, without exposing the applicant</div><h1 className="max-w-2xl font-display text-5xl leading-[.96] tracking-[-.04em] text-storm-deep sm:text-7xl">Finance you can <em className="not-italic text-verified">prove.</em></h1><p className="mt-5 max-w-xl text-base leading-7 text-ink/65">Credence makes financial decisions legible, private and independently verifiable—from the first score to the final settlement.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/credit" className="button-primary">Run a credit proof <ArrowUpRight size={16} /></Link><Link href="/demo" className="button-secondary">See the tamper demo <FlaskConical size={16} /></Link></div></div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{modules.map((module, index) => { const Icon = module.icon; return <motion.div key={module.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}><Link href={module.href} className="group block h-full"><Card className="h-full transition duration-200 group-hover:-translate-y-1 group-hover:border-storm/45 group-hover:shadow-lift"><CardContent className="flex h-full flex-col"><div className="mb-7 flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-moonglow text-storm-deep"><Icon size={21} /></span><ArrowUpRight size={17} className="text-storm/45 transition group-hover:text-storm" /></div><h2 className="font-display text-2xl text-storm-deep">{module.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-ink/60">{module.description}</p><div className="mt-6"><Badge tone="storm">{module.tag}</Badge></div></CardContent></Card></Link></motion.div>; })}</section>

    <PlatformFlow module="financial computation" />

    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><Card><CardContent><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><SectionKicker icon={<Workflow size={14} />}>The Credence method</SectionKicker><h2 className="mt-3 font-display text-3xl text-storm-deep">A decision with a trail.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-ink/60">The right side of finance is not just a number. It is a repeatable journey from private input to public proof.</p></div><span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-storm text-moonglow sm:flex"><LayoutDashboard size={21} /></span></div><div className="mt-8 grid gap-4 sm:grid-cols-4">{[['01', 'Inputs', 'Private'], ['02', 'Formula', 'Approved'], ['03', 'Groth16', 'Proven'], ['04', 'VerityManager', 'On-chain']].map(([number, title, detail], index) => <div key={number} className="relative"><div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] text-storm/55">{number}</span>{index < 3 && <span className="hidden h-px flex-1 bg-silver sm:block" />}</div><h3 className="text-sm font-semibold text-storm-deep">{title}</h3><p className="mt-1 text-xs text-ink/55">{detail}</p></div>)}</div></CardContent></Card><Card className="bg-storm-deep text-white"><CardContent className="flex h-full flex-col justify-between"><div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-moonglow text-storm-deep"><LockKeyhole size={20} /></span><h2 className="mt-7 font-display text-3xl">Private by default.</h2><p className="mt-3 text-sm leading-6 text-white/65">The verifier sees the result, model and commitment. Your applicant’s indices stay private.</p></div><Link href="/demo" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-moonglow">Watch the proof resist tampering <ChevronRight size={16} /></Link></CardContent></Card></section>

    <section className="grid gap-4 sm:grid-cols-4"><Stat label="Total activity" value={String(entries.length)} detail="local audit records" /><Stat label="Verified" value={String(verified)} detail="proof outcomes" tone="success" /><Stat label="Rejected" value={String(rejected)} detail="tamper or failed" tone={rejected ? 'danger' : undefined} /><Stat label="Last activity" value={last ? formatDate(last.timestamp).split(',')[0] : '—'} detail={last ? last.summary : 'Run your first module'} /></section>

    <Card className="border-storm/15 bg-storm/5"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Ready for the room</p><h2 className="mt-2 font-display text-2xl text-storm-deep">The three-minute story is already here.</h2><p className="mt-1 text-sm text-ink/60">Start with a score, let the proof land, then change one number.</p></div><Link href="/demo" className="button-secondary shrink-0">Open tamper demo <ArrowUpRight size={15} /></Link></CardContent></Card>
  </div>;
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'success' | 'danger' }) {
  return <div className="card-shell p-4"><p className="eyebrow">{label}</p><p className={`mt-3 font-display text-3xl ${tone === 'success' ? 'text-verified' : tone === 'danger' ? 'text-rejected' : 'text-storm-deep'}`}>{value}</p><p className="mt-1 text-xs text-ink/50">{detail}</p></div>;
}
