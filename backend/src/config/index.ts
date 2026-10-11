import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// This file lives at backend/src/config/index.ts when running from source
// (tsx/vitest) and at backend/dist/config/index.js when compiled. Going up
// three levels reaches the integrated repository root in both cases, so the
// shared ZK artifacts (build/) and exported ABIs (deployments/) resolve
// without hardcoding an absolute path or assuming the process cwd.
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Load environment variables from the repository root .env if present.
dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PROOF_MODE: z.enum(['mock', 'real']).default('mock'),
  BLOCKCHAIN_MODE: z.enum(['mock', 'real']).default('mock'),
  RPC_URL: z.string().default('http://127.0.0.1:8545'),
  PRIVATE_KEY: z
    .string()
    .default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  CONTRACT_ADDRESS: z
    .string()
    .default('0x5FbDB2315678afecb367f032d93F642f64180aa3'),
  // Use the real VerityManager ABI exported by Hardhat (deployments/abi/VerityManager.json)
  CONTRACT_ABI_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'deployments/abi/VerityManager.json')),
  // Use the actual ZK artifacts from the Person 1 project root (build/)
  CIRCUIT_WASM_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'build/credit_score_js/credit_score.wasm')),
  CIRCUIT_ZKEY_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'build/credit_score_final.zkey')),
  VERIFICATION_KEY_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'build/verification_key.json')),
  WITNESS_GENERATOR_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'build/credit_score_js/credit_score.wasm')),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  // The API tests must remain deterministic even when a developer's root .env
  // is configured for the real local-chain demo. Production/dev processes keep
  // the explicit .env modes; Vitest uses the mock adapters by default.
  const testEnv = process.env.VITEST || process.env.NODE_ENV === 'test'
    ? { ...process.env, PROOF_MODE: 'mock', BLOCKCHAIN_MODE: 'mock' }
    : process.env;
  const result = configSchema.safeParse(testEnv);
  if (!result.success) {
    console.error('Configuration validation error:', result.error.format());
    throw new Error('Invalid application configuration');
  }
  for (const key of ['CONTRACT_ABI_PATH', 'CIRCUIT_WASM_PATH', 'CIRCUIT_ZKEY_PATH', 'VERIFICATION_KEY_PATH'] as const) {
    result.data[key] = path.resolve(PROJECT_ROOT, result.data[key]);
  }
  return result.data;
}

export const config = loadConfig();
