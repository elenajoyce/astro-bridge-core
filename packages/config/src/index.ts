import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load env files. Try root of the monorepo first
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to local directory

const configSchema = z.object({
  ETHEREUM_RPC_URL: z.string().url("ETHEREUM_RPC_URL must be a valid URL"),
  RELAYER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "RELAYER_PRIVATE_KEY must be a 32-byte hex string (with 0x)"),
  RELAYER_STELLAR_SECRET: z.string().regex(/^S[A-Z2-7]{55}$/, "RELAYER_STELLAR_SECRET must be a valid Stellar secret key (starts with S, 56 chars)"),
  SOLANA_RPC_URL: z.string().url("SOLANA_RPC_URL must be a valid URL").optional().or(z.literal('')),
  SOLANA_HTLC_PROGRAM: z.string().optional().or(z.literal('')),
  NETWORK_MODE: z.enum(['testnet', 'mainnet']).default('testnet'),
  VITE_MAINNET_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  PORT: z.preprocess((val) => (val ? parseInt(val as string, 10) : 4000), z.number()).default(4000),
  DATABASE_URL: z.string().default('file:./coordinator.db'),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment validation failed:");
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }

  cachedConfig = result.data;
  return cachedConfig;
}
