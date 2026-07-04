import { z } from 'zod';

export type Chain = 'ethereum' | 'stellar' | 'solana';

export const ChainSchema = z.enum(['ethereum', 'stellar', 'solana']);

export type OrderStatus =
  | 'PENDING'
  | 'LOCKED'
  | 'RESOLVER_LOCKED'
  | 'CLAIMED'
  | 'SETTLED'
  | 'REFUNDED'
  | 'FAILED';

export const OrderStatusSchema = z.enum([
  'PENDING',
  'LOCKED',
  'RESOLVER_LOCKED',
  'CLAIMED',
  'SETTLED',
  'REFUNDED',
  'FAILED',
]);

export interface SwapOrder {
  id: string;
  sender: string; // User source address
  recipient: string; // User destination address
  sourceChain: Chain;
  destChain: Chain;
  sourceAsset: string; // e.g. ETH, XLM, SOL, USDC
  destAsset: string;
  amount: string; // Base units (wei, stroops, lamports)
  destAmount: string;
  hashlock: string; // 32-byte hex string (sha256 of secret)
  secret?: string; // 32-byte hex string (populated after claim)
  timelock: number; // Unix timestamp
  status: OrderStatus;
  txHashSource?: string;
  txHashDest?: string;
  txHashClaim?: string;
  resolverAddress: string;
  createdAt: number;
}

export const SwapOrderSchema = z.object({
  id: z.string().uuid(),
  sender: z.string(),
  recipient: z.string(),
  sourceChain: ChainSchema,
  destChain: ChainSchema,
  sourceAsset: z.string(),
  destAsset: z.string(),
  amount: z.string(),
  destAmount: z.string(),
  hashlock: z.string().regex(/^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/),
  secret: z.string().regex(/^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/).optional(),
  timelock: z.number(),
  status: OrderStatusSchema,
  txHashSource: z.string().optional(),
  txHashDest: z.string().optional(),
  txHashClaim: z.string().optional(),
  resolverAddress: z.string(),
  createdAt: z.number(),
});

export interface Quote {
  sourceChain: Chain;
  destChain: Chain;
  sourceAsset: string;
  destAsset: string;
  amount: string;
  destAmount: string;
  fee: string;
  rate: string;
  resolverAddress: string;
  expiresAt: number;
}

export interface ResolverStaking {
  resolverAddress: string;
  stakeAmount: string;
  activeSwapsCount: number;
  isSlashed: boolean;
}
