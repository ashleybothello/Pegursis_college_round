# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite for the frontend, with the existing Node.js/TypeScript backend and Hardhat/ZK monorepo preserved.

## Users

The primary audience is hackathon judges evaluating a live demonstration. The operator is a team member entering bounded demo inputs and showing how a private computation becomes an independently verifiable proof.

## Product Purpose

Verity Finance demonstrates privacy-preserving financial computation: a trusted backend turns private credit-score features into a genuine Groth16 proof, verifies it off-chain, and records the public result through a Solidity verifier and audit manager. Success means a judge can follow the complete path from private inputs to an honest on-chain verification without seeing the inputs themselves.

## Positioning

The product's distinctive mechanism is a real circuit-bound proof whose public signals include a Poseidon commitment, task ID, and model ID, followed by verification in a deployed Solidity manager. It proves the encoded demo computation, not the truth or fairness of the source data.

## Operating Context

The product runs locally as a frontend, Express API, and Hardhat JSON-RPC node. A judge uses the interactive credit-score demo, watches proof and chain stages resolve, reads the public audit record, and can run a controlled tamper attempt against the stored public signal.

## Capabilities and Constraints

- Credit-score circuit v1 is authoritative: `300 + 3*paymentHistory + 2*incomeStability + debtHeadroom`.
- Private features are integers in `[0, 100]`; public signal order is `[claimedScore, modelId, taskId, inputCommitment]`.
- The frontend must call real API routes and must show honest unavailable and failure states.
- The demo must distinguish a computed score from an eligibility decision.
- The eligibility circuit is an additional capability and is not presented as linked to the credit-score proof unless the code proves that link.
- The shipped Groth16 trusted setup is hackathon-only.

## Brand Commitments

The product is named Verity Finance. The requested identity is a sophisticated midnight/obsidian trust engine with electric cyan and refined violet accents, editorial typography, luminous verification states, layered depth, and restrained motion.

## Evidence on Hand

Genuine circuit artifacts, Solidity verifiers, `VerityManager`, backend routes, tests, and local deployment scripts are present in the repository. There are no real customers, financial performance claims, security certifications, or production network credentials to show or invent.

## Product Principles

1. Prove the computation instead of asking the audience to trust a label.
2. Keep private financial features inside the prover/backend trust boundary.
3. Separate off-chain proof validity from on-chain audit confirmation.
4. Make every failure state useful and truthful.
5. Prefer a legible, memorable live demo over unsupported product claims.

## Accessibility & Inclusion

The web surface must support keyboard navigation, visible focus, semantic labels, adequate contrast, responsive layouts without horizontal overflow, and a `prefers-reduced-motion` mode.
