import { Chain, Quote } from '@astro-bridge/sdk';

export class QuoteService {
  private mockResolverAddress = '0x7D9ce70Aa4b3e8e2b8bb178B8b178b88b178b88b'; // Sepolia resolver address

  public async getQuote(
    sourceChain: Chain,
    destChain: Chain,
    sourceAsset: string,
    destAsset: string,
    amount: string
  ): Promise<Quote> {
    const parsedAmount = BigInt(amount);
    if (parsedAmount <= 0n) {
      throw new Error('Amount must be greater than zero');
    }

    // 0.3% bridge fee
    const fee = (parsedAmount * 3n) / 1000n;
    
    // For simplicity, mock 1:1 rate minus fee
    const destAmount = (parsedAmount - fee).toString();

    return {
      sourceChain,
      destChain,
      sourceAsset,
      destAsset,
      amount,
      destAmount,
      fee: fee.toString(),
      rate: '1.0',
      resolverAddress: this.mockResolverAddress,
      expiresAt: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
    };
  }
}
