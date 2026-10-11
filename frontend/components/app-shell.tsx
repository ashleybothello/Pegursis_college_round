'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeftRight, ChevronRight, FlaskConical, Landmark, LayoutDashboard, Menu, ScrollText, ShieldAlert, ShieldCheck, UserCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { HealthStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/credit', label: 'Credit Scoring', icon: UserCheck },
  { href: '/loans', label: 'Loans & EMI', icon: Landmark },
  { href: '/fraud', label: 'Fraud Scoring', icon: ShieldAlert },
  { href: '/settlements', label: 'Settlements', icon: ArrowLeftRight },
  { href: '/demo', label: 'Tamper Demo', icon: FlaskConical, featured: true },
  { href: '/audit', label: 'Audit History', icon: ScrollText },
  { href: '/disputes', label: 'Disputes', icon: AlertTriangle },
];

function SystemStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const next = await api.health();
        if (active) { setHealth(next); setOnline(true); }
      } catch { if (active) setOnline(false); }
    };
    check();
    const timer = window.setInterval(check, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <div className="rounded-2xl border border-silver/70 bg-white/25 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
        <span className={cn('h-2 w-2 rounded-full', online ? 'animate-soft-pulse bg-[#a3d0a7]' : 'bg-[#dda29d]')} />
        {online ? 'Backend online' : 'Backend offline'}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={health?.proofMode === 'real' ? 'success' : 'warning'} className="border-white/15 bg-white/10 text-white/85">Proofs: {health?.proofMode?.toUpperCase() ?? '—'}</Badge>
        <Badge tone={health?.blockchainMode === 'real' ? 'success' : 'warning'} className="border-white/15 bg-white/10 text-white/85">Chain: {health?.blockchainMode?.toUpperCase() ?? '—'}</Badge>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[276px] -translate-x-full flex-col bg-storm-deep px-4 py-5 text-white shadow-lift transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none', mobileOpen && 'translate-x-0')}>
        <div className="flex items-center justify-between px-3 pb-8">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-moonglow text-storm-deep shadow-sm"><ShieldCheck size={23} strokeWidth={2.4} /></span>
            <span><span className="block font-display text-2xl leading-none">Credence</span><span className="mt-1 block text-[10px] uppercase tracking-[.2em] text-white/55">Finance you can prove</span></span>
          </Link>
          <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <nav className="space-y-1" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/66 transition hover:bg-white/10 hover:text-white', active && 'bg-moonglow text-storm-deep shadow-sm hover:bg-moonglow hover:text-storm-deep', item.featured && !active && 'mt-4 bg-white/5 text-white/85')}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} /><span className="flex-1">{item.label}</span>{item.featured && <span className={cn('rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-storm/15 text-storm-deep' : 'bg-moonglow text-storm-deep')}>★</span>}{active && <ChevronRight size={15} />}</Link>;
          })}
        </nav>
        <div className="mt-auto space-y-3 px-1">
          <SystemStatus />
          <p className="px-2 text-[10px] leading-4 text-white/35">Private inputs stay with the prover.<br />Only verified outcomes become public.</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-storm-deep/45 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-silver/55 bg-pearl/80 px-5 py-3 backdrop-blur lg:hidden">
          <button className="rounded-xl border border-silver bg-card p-2 text-storm-deep" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="flex items-center gap-2 text-sm font-semibold text-storm-deep"><ShieldCheck size={18} /> Credence</div>
          <Activity size={18} className="text-verified" />
        </div>
        <div className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
