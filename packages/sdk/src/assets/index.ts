import { Chain } from '../types';

export interface AssetInfo {
  symbol: string;
  decimals: number;
  contractAddress?: string; // EVM token address or Soroban Asset issuer/id or Solana mint
}

export const ASSET_MAPPING: Record<Chain, Record<string, AssetInfo>> = {
  ethereum: {
    ETH: { symbol: 'ETH', decimals: 18 },
    USDC: { symbol: 'USDC', decimals: 6, contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' }, // Sepolia USDC
  },
  stellar: {
    XLM: { symbol: 'XLM', decimals: 7 }, // Stroops have 7 decimal places
    USDC: { symbol: 'USDC', decimals: 7, contractAddress: 'GBBD47IF6LWK7P7C5F74C7O65Z7IWOE6A5MM2TTJ55M4W53MXVAA35Z6' }, // Stellar testnet USDC
  },
  solana: {
    SOL: { symbol: 'SOL', decimals: 9 }, // Lamports have 9 decimal places
    USDC: { symbol: 'USDC', decimals: 6, contractAddress: '4zMMC9srt5Ri4HpdGt74Gwwbh2GGP1jPhK5GJWBB5yv5' }, // Devnet USDC
  },
};

export function getAssetInfo(chain: Chain, symbol: string): AssetInfo {
  const chainAssets = ASSET_MAPPING[chain];
  if (!chainAssets) {
    throw new Error(`Chain ${chain} not supported in asset mapping`);
  }
  const asset = chainAssets[symbol.toUpperCase()];
  if (!asset) {
    throw new Error(`Asset ${symbol} not supported on chain ${chain}`);
  }
  return asset;
}

export function isValidRoute(
  sourceChain: Chain,
  sourceAsset: string,
  destChain: Chain,
  destAsset: string
): boolean {
  try {
    const src = getAssetInfo(sourceChain, sourceAsset);
    const dest = getAssetInfo(destChain, destAsset);
    // Let's assume we can swap USDC-to-USDC cross chain, or Native-to-Native, or Native-to-USDC
    return src.symbol === dest.symbol || (src.symbol === 'USDC' || dest.symbol === 'USDC') || (src.symbol === 'ETH' && dest.symbol === 'XLM') || (src.symbol === 'XLM' && dest.symbol === 'ETH') || (src.symbol === 'SOL' && dest.symbol === 'XLM') || (src.symbol === 'XLM' && dest.symbol === 'SOL');
  } catch {
    return false;
  }
}
