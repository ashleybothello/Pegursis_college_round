import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// This file lives at backend/src/config/index.ts when running from source
// (tsx/vitest) and at backend/dist/config/index.js when compiled. Going up
// three levels reaches the integrated repository root in both cases, so the
// shared ZK artifacts (build/) and exported ABIs (deployments/) resolve
// without hardcoding an absolute path or assuming the process cwd.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

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
    .default(''),
  CONTRACT_ADDRESS: z.string().default(''),
  // Use the real VerityManager ABI exported by Hardhat (deployments/abi/VerityManager.json)
  CONTRACT_ABI_PATH: z
    .string()
    .default(path.resolve(PROJECT_ROOT, 'deployments/abi/VerityManager.json')),
  // Use the actual ZK artifacts from the Person 1+2 project root (build/)
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
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration validation error:', result.error.format());
    throw new Error('Invalid application configuration');
  }
  const parsed = result.data;
  const resolveProjectPath = (candidate: string): string =>
    path.isAbsolute(candidate) ? candidate : path.resolve(PROJECT_ROOT, candidate);

  return {
    ...parsed,
    CONTRACT_ABI_PATH: resolveProjectPath(parsed.CONTRACT_ABI_PATH),
    CIRCUIT_WASM_PATH: resolveProjectPath(parsed.CIRCUIT_WASM_PATH),
    CIRCUIT_ZKEY_PATH: resolveProjectPath(parsed.CIRCUIT_ZKEY_PATH),
    VERIFICATION_KEY_PATH: resolveProjectPath(parsed.VERIFICATION_KEY_PATH),
    WITNESS_GENERATOR_PATH: resolveProjectPath(parsed.WITNESS_GENERATOR_PATH),
  };
}

export const config = loadConfig();
