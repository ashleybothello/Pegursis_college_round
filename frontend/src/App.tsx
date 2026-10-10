import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDashed,
  DatabaseZap,
  ExternalLink,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  LoaderCircle,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

type InputKey = 'paymentHistory' | 'incomeStability' | 'debtHeadroom';
type SubmitState = 'idle' | 'loading' | 'success' | 'error';

interface VerificationStages {
  proofGenerated: boolean;
  offchainVerified: boolean;
  taskCreated: boolean;
  onchainVerified: boolean;
}

interface VerificationRecord {
  taskId: string;
  commitment: string;
  score: number;
  modelVersion: number;
  status: string;
  transactions: {
    taskCreationTx?: string;
    proofSubmissionTx?: string;
  };
  proofMode: 'mock' | 'real';
  blockchainMode: 'mock' | 'real';
  createdAt: string;
  updatedAt: string;
  message: string;
  stages: VerificationStages;
}

interface OffchainResult {
  taskId: string;
  valid: boolean;
  tampered: boolean;
  message: string;
  publicSignalOrder: string[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const HISTORY_KEY = 'verity-recent-tasks';

const defaultInputs: Record<InputKey, number> = {
  paymentHistory: 82,
  incomeStability: 74,
  debtHeadroom: 61,
};

const proofStages = [
  { label: 'Private inputs', short: 'inputs', icon: EyeOff },
  { label: 'Poseidon commitment', short: 'commitment', icon: Fingerprint },
  { label: 'Groth16 proof', short: 'proof', icon: Sparkles },
  { label: 'Chain audit', short: 'audit', icon: ShieldCheck },
];

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success || body.data === undefined) {
    throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  }
  return body.data;
}

function scoreFor(inputs: Record<InputKey, number>) {
  return 300 + 3 * inputs.paymentHistory + 2 * inputs.incomeStability + inputs.debtHeadroom;
}

function shortId(value: string, head = 12, tail = 8) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function stageComplete(record: VerificationRecord | null, index: number) {
  if (!record) return false;
  return [
    record.stages.proofGenerated,
    record.stages.offchainVerified,
    record.stages.onchainVerified,
    record.stages.onchainVerified,
  ][index];
}

function App() {
  const [inputs, setInputs] = useState(defaultInputs);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [history, setHistory] = useState<VerificationRecord[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [error, setError] = useState('');
  const [network, setNetwork] = useState<{ proofMode: string; blockchainMode: string } | null>(null);
  const [tamperResult, setTamperResult] = useState<OffchainResult | null>(null);
  const [activeStage, setActiveStage] = useState(0);

  const previewScore = useMemo(() => scoreFor(inputs), [inputs]);
  const chainReady = network?.blockchainMode === 'real' && network?.proofMode === 'real';

  async function refreshHistory() {
    try {
      const records = await apiRequest<VerificationRecord[]>('/api/verification?limit=8');
      setHistory(records);
      setHistoryError('');
    } catch (historyFetchError) {
      setHistoryError(historyFetchError instanceof Error ? historyFetchError.message : 'Audit history unavailable');
    }
  }

  useEffect(() => {
    void apiRequest<{ proofMode: string; blockchainMode: string }>('/api/health')
      .then(setNetwork)
      .catch(() => setNetwork(null));
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (submitState !== 'loading') return;
    const timer = window.setInterval(() => setActiveStage((stage) => (stage + 1) % 4), 850);
    return () => window.clearInterval(timer);
  }, [submitState]);

  async function submitVerification() {
    setSubmitState('loading');
    setError('');
    setTamperResult(null);
    setActiveStage(0);

    try {
      const result = await apiRequest<VerificationRecord>('/api/verification/submit', {
        method: 'POST',
        body: JSON.stringify({
          // The API keeps its original financial vocabulary. These are mapped
          // to the circuit feature names inside the trusted backend.
          incomeIndex: inputs.incomeStability,
          repaymentIndex: inputs.paymentHistory,
          historyIndex: inputs.debtHeadroom,
        }),
      });
      setVerification(result);
      setSubmitState('success');
      setActiveStage(3);
      window.localStorage.setItem(HISTORY_KEY, result.taskId);
      await refreshHistory();
    } catch (submitError) {
      setSubmitState('error');
      setError(submitError instanceof Error ? submitError.message : 'Verification service unavailable');
    }
  }

  async function runTamperTest() {
    if (!verification) return;
    setTamperResult(null);
    try {
      const result = await apiRequest<OffchainResult>(`/api/verification/${verification.taskId}/offchain`, {
        method: 'POST',
        body: JSON.stringify({ claimedScore: verification.score + 1 }),
      });
      setTamperResult(result);
    } catch (tamperError) {
      setError(tamperError instanceof Error ? tamperError.message : 'Tamper test unavailable');
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Verity Finance home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>VERITY <em>FINANCE</em></span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="#engine">Trust engine</a>
          <a href="#demo">Live proof</a>
          <a href="#audit">Audit trail</a>
        </nav>
        <a className="header-action" href="#demo">Open the engine <ArrowUpRight size={15} /></a>
      </header>

      <main id="top">
        <section className="hero-section page-grid" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-kicker"><span className="pulse-dot" /> Trust engine / local demonstrator</p>
            <h1 id="hero-title">Private data.<br /><span>Public certainty.</span></h1>
            <p className="hero-lede">
              Verity turns a sensitive financial computation into a proof a verifier can check—without putting the underlying features on-chain.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#demo">Generate a proof <ArrowUpRight size={17} /></a>
              <a className="text-link" href="#engine">See how it works <ChevronRight size={16} /></a>
            </div>
            <div className="hero-footnote">
              <LockKeyhole size={15} /> Your features stay inside the trusted prover boundary.
            </div>
          </div>

          <div className="hero-folio" aria-label="Animated proof pipeline visualization">
            <div className="folio-topline"><span>VERITY / PROOF FOLIO 01</span><span>MODEL 01</span></div>
            <div className="folio-body">
              <div className="folio-spine"><span>V</span><span>E</span><span>R</span><span>I</span><span>T</span><span>Y</span></div>
              <div className="folio-stage">
                <div className="folio-stage-heading"><span>COMPUTATION / IN FLIGHT</span><Activity size={16} /></div>
                <div className="proof-orbit" aria-hidden="true">
                  <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
                  <div className="orbit-core"><Fingerprint size={31} strokeWidth={1.4} /><small>zk</small></div>
                  <span className="orbit-label label-a">private</span><span className="orbit-label label-b">bound</span><span className="orbit-label label-c">checked</span>
                </div>
                <div className="folio-readout"><span>CLAIMED SCORE</span><strong>{verification?.score ?? previewScore}</strong><small>{verification ? 'PROOF OUTPUT' : 'LOCAL PREVIEW / NOT PROVEN'}</small></div>
                <div className="folio-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
            </div>
            <div className="folio-footer"><span><i className="status-dot" /> {verification?.status === 'verified' ? 'ON-CHAIN VERIFIED' : 'AWAITING INPUT'}</span><span>POSEIDON · GROTH16</span></div>
          </div>
        </section>

        <section className="tab-rail" aria-label="Verification stages">
          {proofStages.map((stage, index) => {
            const Icon = stage.icon;
            const complete = stageComplete(verification, index);
            return (
              <div className={`rail-tab ${complete ? 'is-complete' : ''} ${submitState === 'loading' && activeStage === index ? 'is-active' : ''}`} key={stage.short}>
                <span className="rail-number">0{index + 1}</span><Icon size={17} /><span>{stage.label}</span>{complete && <Check size={15} />}
              </div>
            );
          })}
        </section>

        <section className="principles-section page-grid" id="engine" aria-labelledby="engine-title">
          <div className="section-intro">
            <p className="section-kicker">The trust engine</p>
            <h2 id="engine-title">A computation you can audit without inheriting the data.</h2>
            <p>Verity is a demonstrator for verifiable financial logic. It proves the encoded formula and its public context—never the truth, fairness, or lending suitability of the source data.</p>
          </div>
          <div className="principle-list">
            <article className="principle-row"><span className="principle-index">A</span><div><h3>Private by construction</h3><p>Three bounded features and a salt enter the circuit privately. Only the derived score, model, task, and commitment become public signals.</p></div><EyeOff size={21} /></article>
            <article className="principle-row"><span className="principle-index">B</span><div><h3>Bound to a task</h3><p>Poseidon binds the computation to the task ID and model ID, so a valid proof cannot quietly move to another audit record.</p></div><Fingerprint size={21} /></article>
            <article className="principle-row"><span className="principle-index">C</span><div><h3>Confirmed on-chain</h3><p>A genuine Solidity verifier checks the Groth16 pairing before the manager records a public audit event.</p></div><DatabaseZap size={21} /></article>
          </div>
        </section>

        <section className="workflow-section page-grid" aria-labelledby="workflow-title">
          <div className="workflow-header"><p className="section-kicker">One proof, four leaves</p><h2 id="workflow-title">From confidential signal to public receipt.</h2></div>
          <div className="workflow-leaves">
            <div className="workflow-leaf leaf-private"><span className="leaf-tab">PRIVATE</span><EyeOff size={24} /><strong>Features</strong><p>Payment history, income stability, and debt headroom stay private.</p><small>0 ≤ x ≤ 100</small></div>
            <div className="workflow-leaf leaf-poseidon"><span className="leaf-tab">BOUND</span><Fingerprint size={24} /><strong>Commitment</strong><p>Poseidon binds the private values to a task and approved model.</p><small>POSEIDON / 6 INPUTS</small></div>
            <div className="workflow-leaf leaf-groth"><span className="leaf-tab">PROVE</span><Sparkles size={24} /><strong>Groth16</strong><p>The fixed circuit formula becomes a compact, checkable proof.</p><small>PUBLIC SIGNALS / 04</small></div>
            <div className="workflow-leaf leaf-chain"><span className="leaf-tab">AUDIT</span><ShieldCheck size={24} /><strong>Manager</strong><p>The verifier records result, model, commitment, and event.</p><small>CHAIN ID / 31337</small></div>
          </div>
        </section>

        <section className="demo-section" id="demo" aria-labelledby="demo-title">
          <div className="demo-frame">
            <div className="demo-header">
              <div><p className="section-kicker">Interactive proof desk</p><h2 id="demo-title">Generate a verifiable credit computation.</h2><p>These inputs are sent to the trusted backend for proving. They never appear in the public audit record.</p></div>
              <div className={`mode-stamp ${chainReady ? 'is-live' : ''}`}><span className="status-dot" />{network ? `${network.proofMode.toUpperCase()} / ${network.blockchainMode.toUpperCase()}` : 'NETWORK CHECKING'}</div>
            </div>
            <div className="demo-layout">
              <div className="input-panel">
                <div className="panel-label"><span>PRIVATE INPUTS</span><LockKeyhole size={15} /></div>
                <p className="panel-note">The circuit accepts integers from 0 to 100. Adjust a value, then ask the backend to prove the fixed model.</p>
                {(Object.keys(inputs) as InputKey[]).map((key) => {
                  const labels: Record<InputKey, { name: string; description: string; api: string }> = {
                    paymentHistory: { name: 'Payment history', description: 'Repayment behavior over time', api: 'paymentHistory' },
                    incomeStability: { name: 'Income stability', description: 'Consistency of income signal', api: 'incomeStability' },
                    debtHeadroom: { name: 'Debt headroom', description: 'Available room under the model', api: 'debtHeadroom' },
                  };
                  return <label className="input-field" key={key}>
                    <span className="input-name"><span><strong>{labels[key].name}</strong><small>{labels[key].description}</small></span><output htmlFor={key}>{inputs[key]}</output></span>
                    <input id={key} type="range" min="0" max="100" step="1" value={inputs[key]} onChange={(event) => setInputs({ ...inputs, [key]: Number(event.target.value) })} />
                    <span className="range-scale"><small>0</small><i /><i /><i /><small>100</small></span>
                  </label>;
                })}
                <div className="private-note"><EyeOff size={15} /><span>Private until proven. The public record receives only the proof's public signals.</span></div>
                <button className="button button-primary button-wide" type="button" onClick={submitVerification} disabled={submitState === 'loading'}>{submitState === 'loading' ? <><LoaderCircle className="spin" size={17} /> Generating proof…</> : <>Generate genuine proof <ArrowUpRight size={17} /></>}</button>
                {error && <div className="inline-alert error-alert" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => { setError(''); void submitVerification(); }}>Retry</button></div>}
              </div>

              <div className="result-panel">
                <div className="panel-label"><span>PUBLIC RESULT</span><ScanSearch size={15} /></div>
                <div className="score-plate"><span>{verification ? 'PROVEN SCORE' : 'COMPUTED PREVIEW'}</span><strong>{verification?.score ?? previewScore}</strong><small>{verification ? `MODEL ${verification.modelVersion} · ${verification.status.toUpperCase()}` : 'The preview is arithmetic only.'}</small></div>
                <div className="verification-stack">
                  <ResultRow icon={Sparkles} label="Proof generated" value={verification?.stages.proofGenerated ? 'Complete' : submitState === 'loading' ? 'In progress' : 'Waiting'} complete={verification?.stages.proofGenerated ?? false} />
                  <ResultRow icon={ScanSearch} label="Off-chain pairing" value={verification?.stages.offchainVerified ? 'Verified' : 'Not checked'} complete={verification?.stages.offchainVerified ?? false} />
                  <ResultRow icon={ShieldCheck} label="On-chain manager" value={verification?.stages.onchainVerified ? 'Confirmed' : 'Awaiting chain'} complete={verification?.stages.onchainVerified ?? false} />
                </div>
                {verification ? <div className="public-fields">
                  <PublicField label="TASK ID" value={shortId(verification.taskId)} copyValue={verification.taskId} />
                  <PublicField label="POSEIDON COMMITMENT" value={shortId(verification.commitment, 14, 10)} copyValue={verification.commitment} />
                  {verification.transactions.proofSubmissionTx && <PublicField label="PROOF TX" value={shortId(verification.transactions.proofSubmissionTx)} copyValue={verification.transactions.proofSubmissionTx} />}
                </div> : <div className="empty-result"><CircleDashed size={25} /><p>Your public audit fields will appear here after a real response.</p></div>}
              </div>
            </div>
            {verification && <div className="tamper-strip"><div><span className="tamper-mark">↯</span><strong>Controlled tamper test</strong><p>Alter the public score by one point and watch the original proof fail verification.</p></div><button className="button button-quiet" type="button" onClick={runTamperTest} disabled={Boolean(tamperResult)}>{tamperResult ? 'Test complete' : 'Try +1 score'} <ChevronRight size={16} /></button></div>}
            {tamperResult && <div className={`inline-alert ${tamperResult.valid ? 'error-alert' : 'success-alert'}`} role="status"><span className="result-icon">{tamperResult.valid ? <AlertTriangle size={17} /> : <Check size={17} />}</span><span>{tamperResult.message}</span><small>Public order: [{tamperResult.publicSignalOrder.join(', ')}]</small></div>}
          </div>
        </section>

        <section className="audit-section page-grid" id="audit" aria-labelledby="audit-title">
          <div className="audit-heading"><div><p className="section-kicker">Public record / local process memory</p><h2 id="audit-title">Recent audit leaves.</h2><p>Records are intentionally in-memory for this demo process. The chain itself remains the durable public layer.</p></div><button className="icon-button" type="button" onClick={() => void refreshHistory()} aria-label="Refresh audit history"><RefreshCw size={17} /></button></div>
          {historyError && <div className="history-empty"><AlertTriangle size={19} /><p>{historyError}</p></div>}
          {!historyError && history.length === 0 && <div className="history-empty"><Workflow size={21} /><p>No verification leaves yet. Run the proof desk to create the first one.</p></div>}
          {history.length > 0 && <div className="audit-table" role="table" aria-label="Recent verification records"><div className="audit-table-head" role="row"><span>Record</span><span>Score / model</span><span>Stage</span><span>Created</span><span /></div>{history.map((record) => <div className="audit-row" role="row" key={record.taskId}><span className="record-cell"><span className={`record-marker ${record.status === 'verified' ? 'verified' : ''}`} /><span><strong>{shortId(record.taskId, 10, 6)}</strong><small>{shortId(record.commitment, 10, 5)}</small></span></span><span><strong>{record.score}</strong><small>MODEL {record.modelVersion}</small></span><span><span className={`table-status ${record.status === 'verified' ? 'verified' : ''}`}>{record.status === 'verified' ? 'CHAIN VERIFIED' : record.status.toUpperCase()}</span></span><span className="date-cell">{formatDate(record.createdAt)}</span><a href="#demo" onClick={() => setVerification(record)} aria-label={`View ${record.taskId}`}><ArrowUpRight size={16} /></a></div>)}</div>}
        </section>
      </main>

      <footer className="site-footer page-grid"><a className="brand" href="#top"><span className="brand-mark"><span /><span /><span /></span><span>VERITY <em>FINANCE</em></span></a><p>A proof of computation, not a verdict on a person. Model v1 is a hackathon demonstrator—not a validated lending model.</p><span className="footer-meta">ZK / EVM / LOCAL DEMO</span></footer>
    </div>
  );
}

function ResultRow({ icon: Icon, label, value, complete }: { icon: typeof Sparkles; label: string; value: string; complete: boolean }) {
  return <div className="result-row"><span className={`result-icon ${complete ? 'complete' : ''}`}>{complete ? <Check size={14} /> : <Icon size={15} />}</span><span><strong>{label}</strong><small>{value}</small></span><ChevronRight size={15} /></div>;
}

function PublicField({ label, value, copyValue }: { label: string; value: string; copyValue: string }) {
  return <button className="public-field" type="button" onClick={() => void navigator.clipboard?.writeText(copyValue)} title="Copy public value"><span>{label}</span><strong>{value}</strong><ExternalLink size={13} /></button>;
}

export default App;
