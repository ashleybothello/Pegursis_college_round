# Build the frontend for "Attestra": a verifiable-finance dashboard

## 1. What you are building

Build **Attestra** ("Finance you can prove"), a web dashboard for a hackathon demo. Attestra runs financial calculations (credit scoring, loan/EMI, fraud risk, payment settlement) and proves the credit score is honest with a **zero-knowledge proof (Groth16)** verified on a blockchain. Anyone can check that the score came from the approved formula and was not tampered with, without seeing the applicant's private data.

The backend, ZK circuits and smart contracts **already exist** in this repo. Build **only the frontend** in a new folder `/frontend` and do not modify `/backend`, `/contracts`, `/circuits` or `/build`.

The audience is hackathon judges watching a 3-minute live demo. Every screen must be instantly readable from across a room, and the "honest vs tampered" moment must be dramatic and unmistakable.

## 2. Tech stack (use exactly this)

- **Next.js 14+ (App Router) + TypeScript**, in `/frontend`
- **Tailwind CSS** + **shadcn/ui** (Card, Tabs, Button, Input, Slider, Badge, Table, Tooltip, Sonner toasts, Skeleton)
- **lucide-react** icons
- **framer-motion** for the proof stepper and the tamper demo animations
- **recharts** for the score gauge and the EMI breakdown chart
- **snarkjs** (browser build, loaded via dynamic `import()` inside a client component) for in-browser proof verification
- Run Next.js on **port 3001** (`next dev -p 3001`) because the backend uses port 3000 by default
- `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3000/api`

## 3. Visual design: the "Moonstone" palette

The design is a light, calm, premium theme inspired by moonstone and labradorite: soft pearl surfaces, storm-blue structure and a glowing cream accent. It is **not** a dark crypto-neon theme.

Define these as CSS variables in `globals.css` and map them into the Tailwind theme:

| Token | Hex | Use |
|---|---|---|
| `--pearl` | `#F3EEE7` | Page background |
| `--moonglow` | `#F6F2D6` | Highlight surfaces: active nav item, hero glow, "verified" banner fill, key numbers' background |
| `--silver` | `#C9D0D8` | Borders, dividers, input outlines, muted chips, chart gridlines |
| `--storm` | `#6F7F92` | Primary buttons, icons, sidebar, chart primary series |
| `--storm-deep` | `#4A5868` | Primary text on buttons/headings where `#6F7F92` lacks contrast |
| `--ink` | `#2B3440` | Body text |
| `--card` | `#FBF9F5` | Card surfaces (slightly lighter than pearl) |
| `--verified` | `#5E8C6A` | Success / verified (muted sage, not neon green) |
| `--rejected` | `#B5544C` | Failure / rejected / tampered (muted rust, not neon red) |
| `--warning` | `#C49A45` | Medium risk / mock-mode badges |

Design rules:
- Use a subtle **iridescent sheen** as the signature detail: a very soft linear gradient `#C9D0D8 → #F6F2D6 → #C9D0D8` at low opacity on the hero, on the active card border and on the "Verified" seal. Use it sparingly.
- Cards have 16px radius, a 1px `--silver` border and a soft shadow (`0 1px 2px rgba(43,52,64,.06), 0 8px 24px rgba(43,52,64,.06)`).
- Pair a display font with a body font: **Fraunces** or **Instrument Serif** for headings and big numbers, **Inter** or **Geist** for UI text and **JetBrains Mono** for hashes, task IDs and proof data (all from Google Fonts via `next/font`).
- Show big numbers (score, EMI, net payout) at 48–64px in the display font.
- Shorten all hashes to `0x6183…0576` with a copy-to-clipboard button and a tooltip showing the full value.
- Keep text contrast at WCAG AA or better and never use `--storm` for small body text.
- The layout must be responsive, with no horizontal scrolling at 375px width. Below 768px the sidebar collapses to a top bar with a menu.

## 4. App structure and routes

The persistent left **sidebar** has the logo (a lucide `ShieldCheck` inside a moonglow circle plus the wordmark "Attestra"), these nav items and, at the bottom, a **System Status** pill.

| Route | Nav label | Icon |
|---|---|---|
| `/` | Overview | `LayoutDashboard` |
| `/credit` | Credit Scoring | `UserCheck` |
| `/loans` | Loans & EMI | `Landmark` |
| `/fraud` | Fraud Scoring | `ShieldAlert` |
| `/settlements` | Settlements | `ArrowLeftRight` |
| `/demo` | Tamper Demo ★ | `FlaskConical` (highlighted with moonglow) |
| `/audit` | Audit History | `ScrollText` |

**System Status pill:** polls `GET /api/health` every 10s and shows:
- green dot + "Backend online" or red dot + "Backend offline"
- two small badges: `Proofs: MOCK|REAL` and `Chain: MOCK|REAL` (from `proofMode` and `blockchainMode`). MOCK uses the `--warning` colour and REAL uses `--verified`.

## 5. Backend API contract (already built, match it exactly)

The base URL is `NEXT_PUBLIC_API_URL`. Every response is wrapped:
`{ success: true, data: T }` or `{ success: false, error: { code, message, details? } }`.
Show `error.message` in a toast. On a network failure show "Backend is offline. Start it with `cd backend && npm run dev`".

Create `lib/api.ts` with typed functions for each endpoint and `lib/types.ts` with these interfaces.

### 5.1 Health: `GET /health`
```ts
{ status: string; version: string; timestamp: string; uptime: number;
  proofMode: 'mock'|'real'; blockchainMode: 'mock'|'real' }
```

### 5.2 Credit score with ZK proof (main flow): `POST /verification/submit`
Request (integers 0–100; `salt` is optional and should be omitted):
```ts
{ incomeIndex: number; repaymentIndex: number; historyIndex: number; salt?: string }
```
Response (HTTP 201):
```ts
{ taskId: string; commitment: string; score: number; modelVersion: number;
  status: 'pending'|'proof_generated'|'task_created'|'submitted'|'verified'|'rejected'|'failed'|'mock';
  transactions: { taskCreationTx?: string; proofSubmissionTx?: string };
  proofMode: 'mock'|'real'; blockchainMode: 'mock'|'real';
  createdAt: string; updatedAt: string; message: string }
```
In **real** mode the score uses the ZK circuit formula `300 + 3×repayment + 2×income + 1×history` (range **300–900**). In **mock** mode the backend uses `300 + 5×income + 3×repayment + 2×history` (range **300–1300**). The gauge maximum must follow `proofMode`: 900 for real, 1300 for mock.

### 5.3 Task status lookup: `GET /verification/:taskId`
Returns the same shape as 5.2. Returns 404 if the task is unknown.

### 5.4 Plain credit score (no proof): `POST /credit/score`
Request: `{ incomeIndex, repaymentIndex, historyIndex }`
Response: `{ score, modelVersion, validation: { isValid, errors: string[] }, timestamp, disclaimer }`

### 5.5 EMI: `POST /emi/calculate`
Request: `{ principal: number (>0); annualInterestRate: number (0–100); tenureMonths: int (1–480) }`
Response: `{ principal, annualInterestRate, tenureMonths, monthlyEmi, totalRepayment, totalInterest, currencyUnit, assumptions: string[] }`

### 5.6 Fraud: `POST /fraud/score`
Request:
```ts
{ transactionAmount: number (>0); userAverageAmount?: number; userTransactionsLastHour?: int;
  isNewDevice?: boolean; locationMismatch?: boolean; transactionHourUtc?: int (0–23);
  rapidCrossBorderTransfers?: boolean }
```
Response:
```ts
{ riskScore: number (0–100); riskCategory: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; reasons: string[];
  ruleEvaluations: { ruleId; description; triggered: boolean; points: number; details? }[];
  evaluatedAt; disclaimer }
```

### 5.7 Settlement: `POST /settlements/calculate`
**All amounts are integer minor units (cents).** The UI takes dollars and sends `Math.round(dollars*100)`.
Request: `{ grossAmount: int; feeBasisPoints?: int (default 250); fixedFeeMinorUnits?: int (default 30); currency?: string (3 letters, default 'USD') }`
Response: `{ grossAmount, feeAmount, netAmount, currency, status: 'PENDING'|'SETTLED'|'HELD'|'FAILED', feeBreakdown: { basisPointsFee, fixedFee, effectiveRatePercent }, calculatedAt }`
Divide by 100 for display.

## 6. Pages in detail

Every module page uses the same reusable layout `ModulePage`: a header (title, one-line explanation and a "Load sample data" button), then a two-column grid (**inputs on the left, results on the right**) that stacks on mobile. Every form validates on the client with the backend's ranges and shows inline errors.

### 6.1 Overview (`/`)
- **Hero:** "Attestra" in the large display font, the tagline "Finance you can prove." and a sub-line: "Every score is computed by an approved formula and backed by a zero-knowledge proof verified on-chain. Private inputs never leave the prover." The hero has the iridescent sheen background.
- **Module grid:** 2×2 cards (Credit Scoring, Loans & EMI, Fraud Scoring, Settlements) plus one full-width card for "Tamper Demo". Each card has an icon, a title, a one-line description and an arrow, and links to its page.
- **"How it works" strip:** 4 steps with connecting lines: *Inputs (private)* → *Approved formula (Circom circuit)* → *Groth16 proof* → *Verified on-chain (VerityManager)*.
- **Stats row**, read from local audit history: total verifications, verified count, rejected count, last verification time.

### 6.2 Credit Scoring (`/credit`): the most important page
**Inputs:** three sliders with number boxes, integers 0–100:
- Income stability (`incomeIndex`)
- Repayment behaviour (`repaymentIndex`)
- Credit history length (`historyIndex`)

Show a small lock icon and the note "Private: never sent on-chain".

**Sample presets:** "Strong applicant" (90/95/85), "Average" (60/65/50) and "Risky" (25/20/30).

**Primary button:** "Generate score & proof". It calls `POST /verification/submit`.

**Results panel:**
1. **Score gauge:** a semicircle radial gauge (recharts) from 300 to the max for the current mode, with bands Poor <580, Fair 580–669, Good 670–739 and Excellent ≥740 (scale the bands proportionally when the max is 1300). Show the big number and the band label.
2. **Proof stepper (`<ProofStepper/>`, reusable):** 4 steps: *Computing score* → *Generating ZK proof* → *Recording on-chain* → *Verified*. Animate it with framer-motion while the request is in flight, stepping roughly every 600ms. Then resolve to the final state from `status`:
   - `verified` → all green and a "✓ Verified on-chain" seal with the iridescent sheen
   - `mock` → all steps complete with an amber "Simulated (mock mode)" badge and the backend's `message`
   - `rejected` or `failed` → the last step turns rust with "✕ Rejected" and the `message`
3. **Proof details card:** Task ID, Input commitment, Model version, Task creation tx and Proof submission tx (all shortened and copyable), plus a "Check status" button that calls `GET /verification/:taskId` and refreshes the card.
4. **"What the verifier sees" vs "What stays private":** two small columns. The verifier sees score, modelId, taskId and commitment. The applicant's three indices stay private.

Save every submission to the local audit history (section 7).

### 6.3 Loans & EMI (`/loans`)
**Inputs:** loan amount (principal), annual interest rate (%), tenure (with a months/years toggle; always send months) and the applicant's **monthly income**. Monthly income is used only on the frontend for affordability.

**Sample:** 50,000 at 8.5% for 36 months, with an income of 5,000/month.

The button "Calculate" calls `POST /emi/calculate`.

**Results:**
- Big **Monthly EMI** number
- Total repayment and total interest
- A donut chart of principal vs interest
- **Affordability** (computed on the frontend and labelled as such): EMI-to-income ratio = monthlyEmi / monthlyIncome. Show it as a bar with zones: ≤30% *Comfortable* (sage), 30–50% *Stretched* (amber) and >50% *Unaffordable* (rust).
- An amortization table computed on the frontend from the same formula: month, EMI, interest, principal and balance. Show the first 12 rows with a "Show all" button.
- An "Assumptions" accordion listing the backend's `assumptions[]`.
- An optional "Eligibility link" card: "Need a credit check? → Go to Credit Scoring". Show it with the note "Approval threshold in the eligibility circuit: 700".

### 6.4 Fraud Scoring (`/fraud`)
**Inputs:** transaction amount, user's average amount, transactions in the last hour, transaction hour (0–23, UTC), and toggles for new device, location mismatch and rapid cross-border transfers.

**Samples:** "Normal purchase" (120, avg 100, 1/hr, 14h, all false) and "Suspicious transfer" (15000, avg 1200, 6/hr, 3h, new device and location mismatch true).

**Results:**
- A risk score from 0–100 on a horizontal meter
- A category badge: LOW is sage, MEDIUM is amber, HIGH is rust and CRITICAL is deep rust with a pulse
- A **rules table** from `ruleEvaluations`: each rule with a ✓/— triggered state, its points and its details. Highlight the triggered rows.
- A "Why this score" list from `reasons[]`
- The `disclaimer` in small muted text

### 6.5 Settlements (`/settlements`)
**Inputs:** gross amount in dollars, fee in % (UI) converted to basis points (×100), fixed fee in dollars converted to cents, and a currency dropdown (USD, EUR, INR, GBP).

**Sample:** $250.00, 2.5% and $0.30.

**Results:**
- A **waterfall-style breakdown**: Gross → − % fee → − fixed fee → **Net payout** (big)
- Effective rate %
- A status badge (SETTLED is sage, PENDING is storm, HELD is amber, FAILED is rust)
- A note: "All arithmetic in integer minor units: zero floating-point drift."

### 6.6 Tamper Demo (`/demo`): the showstopper
The point of this page is to show that **a valid proof cannot be reused with a changed result.** It uses real Groth16 proofs generated by the team, verified **in the browser** with snarkjs.

**Setup step (do this):** copy these files from `/build` into `/frontend/public/zk/`:
`proof.json`, `public.json`, `public_tampered.json`, `verification_key.json`, `eligibility_proof.json`, `eligibility_public.json`, `eligibility_public_tampered.json` and `eligibility_verification_key.json`.

Public signal order:
- credit-score circuit: `[claimedScore, modelId, taskId, inputCommitment]`. The honest score is `755` and the tampered score is `756`.
- eligibility circuit: `[eligible, threshold, modelId, taskId, inputCommitment]`. Honest `eligible` is `1` and tampered is `0`.

**Layout:** a scenario tab switcher ("Credit score" | "Loan eligibility"), then two side-by-side panels:

| Left: **Honest** | Right: **Tampered** |
|---|---|
| Header "Honest submission" | Header "Tampered submission" |
| Score **755** | Score **755 → 756**, with the changed digit highlighted in rust and struck through |
| Proof: the same proof.json | Proof: the same proof.json |
| Result: **✓ PROOF VALID** (sage seal) | Result: **✕ PROOF REJECTED** (rust seal + shake) |

- A big centre button: **"Run verification"**. On click, both panels show "Verifying…" for about 1.2s for drama, then call `snarkjs.groth16.verify(vkey, publicSignals, proof)` for each and reveal the results with framer-motion. **Show the real boolean returned by snarkjs. Never hard-code the outcome.**
- An **"Edit the tampered value"** input lets a judge type any score on the right and re-run; any change must fail.
- A collapsible **"Raw public signals"** panel shows both JSON arrays side by side and highlights the differing index.
- A footer explanation: "The proof is cryptographically bound to the exact public signals. Changing even one unit of the score invalidates it. On-chain, VerityManager calls the same Groth16 verifier and reverts with `invalid proof`."
- For the eligibility tab, label it "Approved (eligible = 1)" vs "Flipped to rejected (eligible = 0)". Threshold 700 is shown and the score is never revealed (privacy).
- Add each demo run to the audit history with `source: 'demo'`.

### 6.7 Audit History (`/audit`)
The backend has no "list all tasks" endpoint, so the frontend keeps its own log.
- `lib/auditStore.ts`: an array of entries in `localStorage` key `attestra.audit.v1`. Wrap every read and write in try/catch and fall back to in-memory storage.
- Entry shape: `{ id, timestamp, module: 'credit'|'loan'|'fraud'|'settlement'|'demo', summary: string, taskId?, commitment?, status: 'verified'|'mock'|'rejected'|'failed'|'computed', proofMode?, blockchainMode?, txHashes? }`
- Log every module calculation (non-proof modules get status `computed`).
- **Table columns:** time, module (icon + name), summary (e.g. "Score 755" or "EMI $1,578.43"), task ID (short, copyable) and a status badge.
- Filters: module dropdown and status chips. Add a search box over task ID or commitment.
- Row click opens a side drawer with the full JSON and, for credit entries, a "Re-check status" button (`GET /verification/:taskId`).
- Include "Export JSON" and "Clear history" buttons, with a confirm step for clearing.
- The empty state reads "No verifications yet — try the Credit Scoring page" and links to it.

## 7. Shared components to build

`AppShell` (sidebar, top bar and mobile menu), `SystemStatus`, `ModulePage`, `ProofStepper`, `ScoreGauge`, `HashChip` (shortened, copy and tooltip), `StatusBadge`, `VerifiedSeal`, `RiskMeter`, `SampleDataButton`, `EmptyState` and `ErrorBanner`.

## 8. Quality bar

- Each async button shows a spinner and is disabled while loading. Results use skeleton placeholders.
- Every form works with the keyboard, inputs have labels and focus rings are visible (storm colour).
- Format money with `Intl.NumberFormat`. Show dates in local time.
- There must be no console errors. `npm run build` must pass with no TypeScript errors.
- Write a `frontend/README.md` with the run steps:
  1. `cd backend && npm install && npm run dev` (port 3000)
  2. `cd frontend && npm install && npm run dev` (port 3001)
  3. For real proofs and chain: start a Hardhat node, deploy the contracts, then set `PROOF_MODE=real` and `BLOCKCHAIN_MODE=real` in the root `.env`. The UI adapts automatically through `/api/health`.

## 9. Build order

1. Scaffold Next.js, Tailwind, shadcn, fonts, palette tokens and AppShell with all routes as placeholders
2. `lib/api.ts`, `lib/types.ts`, the SystemStatus pill and the audit store
3. The Credit Scoring page with ProofStepper and ScoreGauge
4. The Tamper Demo page with in-browser snarkjs verification
5. Loans & EMI, then Fraud, then Settlements
6. Audit History, then Overview stats
7. A polish pass: animations, responsive check at 375px, empty and error states
