# Verity Finance integration guide

## Shared contract

Build against these two facts, not parallel interpretations:

1. The credit v1 public signals are exactly `[claimedScore, modelId, taskId, inputCommitment]`.
2. The public commitment is Poseidon over `[paymentHistory, incomeStability, debtHeadroom, inputSalt, taskId, modelId]`.

The backend accepts `{ incomeIndex, repaymentIndex, historyIndex }` for compatibility with the existing financial API and maps those fields to the circuit features. The backend generates the salt and task ID in real mode. A client-supplied commitment or proof is never authoritative.

## Local workflow

```powershell
npm install
pushd backend; npm install; popd
pushd frontend; npm install; popd
npx hardhat compile
npx hardhat test
pushd backend; npm test; npm run lint; popd
pushd frontend; npm run lint; npm run build; popd
```

For a connected demo, run `npx hardhat node`, deploy with `scripts/deploy.js`, export ABIs, set real-mode values in an untracked root `.env`, then start the backend and frontend. Run `npm run e2e:http` only after the backend reports `real / real`.

## Change boundaries

- Circuit changes require a review of `model-config.json`, public-signal order, commitment order, proving artifacts, generated Solidity verifier, backend checks, and Hardhat tests.
- Contract changes require recompilation, ABI export, manager tests, and a fresh local deployment.
- API changes must update `API.md`, backend schemas/tests, and the frontend request/response types.
- Frontend changes must preserve honest loading/error/unavailable states and must not place private keys or input values in client bundles or public audit views.

Generated `artifacts/`, `cache/`, `backend/dist/`, `frontend/dist/`, and dependency directories are ignored. Reviewable ABI files and local deployment metadata under `deployments/` are intentionally trackable.
