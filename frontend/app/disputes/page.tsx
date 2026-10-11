'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, ExternalLink, Gavel, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ChainAuditEvent, DisputeRecord } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, SectionKicker, Spinner } from '@/components/ui';
import { DisputeCard } from '@/components/platform';
import { HashChip } from '@/components/shared';
import { EmptyState, ErrorBanner } from '@/components/shared';

export default function DisputesPage() {
  const [events, setEvents] = useState<ChainAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState<string>();
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>();

  const load = async () => { setLoading(true); setError(''); try { setEvents(await api.chainAudit()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load on-chain disputes'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const disputes = useMemo(() => events.filter((event) => event.event === 'DisputeRaised' || event.event === 'DisputeResolved'), [events]);
  const tasks = Array.from(new Set(disputes.map((event) => event.taskId)));

  const select = async (taskId: string) => {
    // Clear the previous task immediately so an UPHELD dispute cannot remain
    // visible while the newly selected OPEN dispute is loading.
    setSelectedTask(taskId);
    setSelectedDispute(undefined);
    try { setSelectedDispute(await api.dispute(taskId)); } catch { setSelectedDispute(null); }
  };

  return <div><PageHeader eyebrow="Independent challenge layer" title="Disputes" description="A verified computation can be challenged by any observer. The contract records the reason, the resolver and the re-check outcome as public events." action={<Button variant="secondary" onClick={() => void load()} disabled={loading}>{loading ? <Spinner className="h-4 w-4" /> : <RefreshCcw size={15} />} Refresh chain</Button>} />
    <div className="mb-6 grid gap-4 md:grid-cols-3"><Stat icon={<Gavel size={17} />} label="Challenges" value={String(tasks.length)} /><Stat icon={<Clock3 size={17} />} label="Open" value={String(tasks.filter((taskId) => disputes.some((event) => event.taskId === taskId && event.event === 'DisputeRaised' && !disputes.some((resolved) => resolved.taskId === taskId && resolved.event === 'DisputeResolved'))).length)} /><Stat icon={<Check size={17} />} label="Resolution" value="Proof re-check" /></div>
    {error && <div className="mb-6"><ErrorBanner message={error} /></div>}
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card><CardHeader><SectionKicker icon={<AlertTriangle size={14} />}>Tamper-evident challenge log</SectionKicker><CardTitle className="mt-2">Dispute events</CardTitle></CardHeader><CardContent>{loading ? <div className="flex min-h-48 items-center justify-center"><Spinner className="h-6 w-6 text-storm" /></div> : disputes.length === 0 ? <EmptyState title="No disputes yet" detail="Open a verified task from Credit Scoring or Audit History to create the first challenge." /> : <div className="space-y-3">{disputes.map((event) => <button key={`${event.transactionHash}-${event.event}`} type="button" onClick={() => void select(event.taskId)} className="w-full rounded-2xl border border-silver/65 bg-card p-4 text-left transition hover:border-storm/50"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${event.event === 'DisputeResolved' ? 'bg-verified/10 text-verified' : 'bg-warning/10 text-warning'}`}>{event.event === 'DisputeResolved' ? <Check size={16} /> : <Gavel size={16} />}</span><div><p className="text-sm font-semibold text-storm-deep">{event.event === 'DisputeRaised' ? 'Challenge raised' : `Challenge ${event.disputeStatus?.toLowerCase() ?? 'resolved'}`}</p><p className="mt-1 text-xs text-ink/55">Task <span className="font-mono">{event.taskId}</span> · block {event.blockNumber}</p>{event.reason && <p className="mt-2 text-xs leading-5 text-ink/65">“{event.reason}”</p>}</div></div><Badge tone={event.event === 'DisputeResolved' ? event.disputeStatus === 'UPHELD' ? 'success' : 'danger' : 'warning'}>{event.event === 'DisputeRaised' ? 'OPEN' : event.disputeStatus}</Badge></div><div className="mt-3 flex items-center gap-2 border-t border-silver/45 pt-3 text-[11px] text-storm/60"><span>{formatDate(event.timestamp)}</span><HashChip value={event.transactionHash} label="tx" /></div></button>)}</div>}</CardContent></Card>
      <div className="space-y-6">{selectedTask ? <><DisputeCard taskId={selectedTask} initial={selectedDispute} /><Card><CardContent><p className="eyebrow">What resolution means</p><p className="mt-2 text-sm leading-6 text-ink/65">The resolver does not accept a new answer. It re-runs the exact proof stored for the task. A valid proof is <strong className="text-verified">upheld</strong>; an invalid stored proof is <strong className="text-rejected">overturned</strong>.</p><div className="mt-4 flex items-center gap-2 text-xs text-storm/60"><ExternalLink size={14} /> Every action emits a chain event with a block and transaction hash.</div></CardContent></Card></> : <Card><CardContent className="flex min-h-[300px] flex-col items-center justify-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-moonglow text-storm"><Gavel size={21} /></span><h2 className="mt-4 font-display text-2xl text-storm-deep">Select a challenge</h2><p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">Choose a dispute event to review its reason and resolve it by re-running the stored proof.</p></CardContent></Card>}</div>
    </div>
  </div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="card-shell flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-moonglow text-storm">{icon}</span><div><p className="eyebrow">{label}</p><p className="mt-1 font-display text-2xl text-storm-deep">{value}</p></div></div>; }
