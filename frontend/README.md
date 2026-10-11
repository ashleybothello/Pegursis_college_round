# Credence frontend

Credence is the Person 4 dashboard for the Verity Finance demo: a light, moonstone-inspired interface for private credit scoring, loan affordability, fraud review, settlements, browser proof verification, and audit history.

## Run locally

1. Start the backend on port 3000:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

2. Install and start the dashboard on port 3001:

   ```powershell
   cd frontend
   npm install
   copy .env.local.example .env.local
   npm run dev
   ```

3. Open [http://localhost:3001](http://localhost:3001).

For a real proof and chain flow, start a Hardhat node, deploy the contracts, and set `PROOF_MODE=real` and `BLOCKCHAIN_MODE=real` in the root `.env`. The dashboard reads the active modes from `/api/health`.

## Frontend surface

- `/` — overview and demo story
- `/credit` — private inputs, score gauge, proof stepper and verification record
- `/loans` — EMI, affordability, donut breakdown and amortization schedule
- `/fraud` — risk meter, rule evaluations and reasons
- `/settlements` — minor-unit fee waterfall and net payout
- `/demo` — real browser-side honest-versus-tampered Groth16 verification
- `/audit` — blockchain event ledger with task timelines, block numbers, transaction hashes and a clearly marked local calculator log
- `/disputes` — public challenge and proof re-check workflow

The dashboard uses `NEXT_PUBLIC_API_URL` for the backend base URL and stores the local audit history under `credence.audit.v1`.

## Platform demo flow

For the complete verifiable-computation story, run the root Hardhat node, deploy
the updated `VerityManager`, set `PROOF_MODE=real` and `BLOCKCHAIN_MODE=real` in
the root `.env`, then restart the backend. The Credit Scoring page presents the
three roles explicitly:

1. **Requester** agrees the module, model ID, formula and verification-key fingerprint.
2. **Provider** computes privately and attaches the proof.
3. **Verifier** checks the proof independently and can compare the commitment with the on-chain task record.

Verified task history comes from `TaskCreated`, `ProofVerified`, `DisputeRaised`
and `DisputeResolved` events. The `/disputes` route lets an observer challenge a
verified result; resolution re-runs the proof stored by `VerityManager`.
