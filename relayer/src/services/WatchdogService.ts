import { ethers } from 'ethers';
import { Keypair, Networks } from 'stellar-sdk';
import { Connection } from '@solana/web3.js';
import { getConfig } from '@astro-bridge/config';
import {
  EthereumHTLCClient,
  StellarHTLCClient,
  SolanaHTLCClient,
  SwapOrder,
  OrderStateMachine,
} from '@astro-bridge/sdk';

export class WatchdogService {
  private config = getConfig();
  private ethClient!: EthereumHTLCClient;
  private stellarClient!: StellarHTLCClient;
  private solanaClient!: SolanaHTLCClient;
  private coordinatorUrl: string;

  constructor(coordinatorUrl: string) {
    this.coordinatorUrl = coordinatorUrl;
    this.initClients();
  }

  private initClients() {
    const provider = new ethers.JsonRpcProvider(this.config.ETHEREUM_RPC_URL);
    const signer = new ethers.Wallet(this.config.RELAYER_PRIVATE_KEY, provider);
    const evmEscrowAddress = process.env.ETHEREUM_ESCROW_ADDRESS || '0xb352339BEb000000000000000000000000000178';
    const evmRegistryAddress = process.env.ETHEREUM_REGISTRY_ADDRESS || '0x7D9ce70Aa4b3e8e2b8bb178B8b178b88b178b88b';
    this.ethClient = new EthereumHTLCClient(provider, evmEscrowAddress, evmRegistryAddress, signer);

    const stellarKeypair = Keypair.fromSecret(this.config.RELAYER_STELLAR_SECRET);
    const passphrase = this.config.NETWORK_MODE === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const sorobanHtlcId = process.env.STELLAR_HTLC_PROGRAM || 'CDIKSJKV00000000000000000000000000000000000000000000CTA6JK';
    const sorobanRegistryId = process.env.STELLAR_REGISTRY_PROGRAM || 'CBSR7Z4M0000000000000000000000000000000000000000000Z4WGF';
    const sorobanRpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.stellarClient = new StellarHTLCClient(
      sorobanRpcUrl,
      passphrase,
      sorobanHtlcId,
      sorobanRegistryId,
      stellarKeypair
    );

    const solanaConnection = new Connection(
      this.config.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    this.solanaClient = new SolanaHTLCClient(solanaConnection, this.config.SOLANA_HTLC_PROGRAM);
  }

  public async checkRefunds() {
    try {
      console.log('🔍 Watchdog checking for expired swap orders...');
      const response = await fetch(`${this.coordinatorUrl}/api/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders from coordinator');

      const orders = (await response.json()) as SwapOrder[];
      const currentTimeSec = Math.floor(Date.now() / 1000);

      for (const order of orders) {
        if (OrderStateMachine.isRefundable(order, currentTimeSec)) {
          await this.triggerRefund(order);
        }
      }
    } catch (err) {
      console.error('Error in watchdog scan:', err);
    }
  }

  private async triggerRefund(order: SwapOrder) {
    console.log(`[Watchdog] Order ${order.id} has expired! Initiating on-chain refund...`);
    try {
      let txHash = '';
      
      // Determine which leg is being refunded
      // If status is LOCKED, we refund source leg. If RESOLVER_LOCKED, we refund destination leg.
      const isSourceLeg = order.status === 'LOCKED';
      const targetChain = isSourceLeg ? order.sourceChain : order.destChain;

      if (targetChain === 'ethereum') {
        const tx = await this.ethClient.refund(order.id);
        const receipt = await tx.wait();
        txHash = receipt?.hash || '';
      } else if (targetChain === 'stellar') {
        txHash = await this.stellarClient.refund(order.id);
      } else if (targetChain === 'solana') {
        txHash = await this.solanaClient.refund(order.id);
      }

      console.log(`[Watchdog] Refunded ${targetChain} leg for order ${order.id}. Tx: ${txHash}`);

      // Notify coordinator of refund
      await fetch(`${this.coordinatorUrl}/api/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
    } catch (err) {
      console.error(`Failed to refund order ${order.id}:`, err);
    }
  }
}
