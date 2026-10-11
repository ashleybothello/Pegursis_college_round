import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('card-shell', className)}>{children}</section>;
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border-b border-silver/60 px-5 py-4 sm:px-6', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-display text-2xl leading-tight text-storm-deep', className)}>{children}</h2>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}

export function Button({ className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const variants = {
    primary: 'button-primary',
    secondary: 'button-secondary',
    ghost: 'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-storm-deep transition hover:bg-moonglow/60',
    danger: 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rejected px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rejected/90 disabled:cursor-not-allowed disabled:opacity-50',
  };
  return <button className={cn(variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input-control', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('input-control', className)} {...props} />;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'storm'; className?: string }) {
  const tones = {
    neutral: 'border-silver bg-pearl text-storm-deep',
    success: 'border-verified/25 bg-verified/10 text-verified',
    warning: 'border-warning/25 bg-warning/10 text-[#8e6a23]',
    danger: 'border-rejected/25 bg-rejected/10 text-rejected',
    storm: 'border-storm/20 bg-storm/10 text-storm-deep',
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em]', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Loading" />;
}

export function SectionKicker({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="eyebrow flex items-center gap-2">{icon}{children}</div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="font-display text-4xl leading-[.98] tracking-[-.03em] text-storm-deep sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-xs font-medium text-rejected">{children}</p>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="text-sm text-ink/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 rounded-full border transition', checked ? 'border-storm bg-storm' : 'border-silver bg-pearl')}
      >
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition', checked ? 'left-6' : 'left-1')} />
      </button>
    </label>
  );
}
