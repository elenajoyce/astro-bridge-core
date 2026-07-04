import { ethers } from 'ethers';
import { Keypair, Networks } from 'stellar-sdk';
import { Connection } from '@solana/web3.js';
import { getConfig } from '@astro-bridge/config';
import {
  EthereumHTLCClient,
  StellarHTLCClient,
  SolanaHTLCClient,
  SwapOrder,
} from '@astro-bridge/sdk';

export class RelayService {
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
    // EVM client init
    const provider = new ethers.JsonRpcProvider(this.config.ETHEREUM_RPC_URL);
    const signer = new ethers.Wallet(this.config.RELAYER_PRIVATE_KEY, provider);
    const evmEscrowAddress = process.env.ETHEREUM_ESCROW_ADDRESS || '0xb352339BEb000000000000000000000000000178';
    const evmRegistryAddress = process.env.ETHEREUM_REGISTRY_ADDRESS || '0x7D9ce70Aa4b3e8e2b8bb178B8b178b88b178b88b';
    this.ethClient = new EthereumHTLCClient(provider, evmEscrowAddress, evmRegistryAddress, signer);

    // Stellar client init
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

    // Solana client init
    const solanaConnection = new Connection(
      this.config.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    this.solanaClient = new SolanaHTLCClient(solanaConnection, this.config.SOLANA_HTLC_PROGRAM);
  }

  public async tick() {
    try {
      console.log('🔄 Relayer checking for pending swap orders...');
      const response = await fetch(`${this.coordinatorUrl}/api/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders from coordinator');
      
      const orders = (await response.json()) as SwapOrder[];

      for (const order of orders) {
        if (order.status === 'LOCKED') {
          await this.handleSourceLocked(order);
        } else if (order.status === 'CLAIMED') {
          await this.handleDestinationClaimed(order);
        }
      }
    } catch (err) {
      console.error('Error in relayer tick:', err);
    }
  }

  private async handleSourceLocked(order: SwapOrder) {
    console.log(`[Relayer] Processing locked order: ${order.id}. Locking destination leg...`);
    try {
      // 12-hour timelock on destination (gap is 12h vs 24h)
      const destTimelock = Math.floor(Date.now() / 1000) + 43200; 

      let txHash = '';

      if (order.destChain === 'ethereum') {
        const tx = await this.ethClient.lock(
          order.id,
          order.recipient,
          order.hashlock,
          destTimelock,
          order.destAmount
        );
        const receipt = await tx.wait();
        txHash = receipt?.hash || '';
      } else if (order.destChain === 'stellar') {
        txHash = await this.stellarClient.lock(
          order.id,
          order.recipient,
          order.hashlock,
          destTimelock,
          order.destAmount
        );
      } else if (order.destChain === 'solana') {
        txHash = await this.solanaClient.lock(
          order.id,
          order.recipient,
          order.hashlock,
          destTimelock,
          order.destAmount
        );
      }

      console.log(`[Relayer] Locked destination leg for order ${order.id}. Tx: ${txHash}`);

      // Notify coordinator of destination lock
      // Note: In real life we'd let the listener catch it, or speed it up by calling coordinator
      // Let's call the coordinator endpoint
      await fetch(`${this.coordinatorUrl}/api/orders/${order.id}/lock-destination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
    } catch (err) {
      console.error(`Failed to lock destination for order ${order.id}:`, err);
    }
  }

  private async handleDestinationClaimed(order: SwapOrder) {
    console.log(`[Relayer] Order ${order.id} was claimed. Revealing secret to claim source leg...`);
    try {
      // Retrieve the secret
      const secResponse = await fetch(`${this.coordinatorUrl}/api/secrets/${order.id}`);
      if (!secResponse.ok) {
        console.log(`Secret for order ${order.id} not available yet`);
        return;
      }
      const { secret } = (await secResponse.json()) as { secret: string };

      let txHash = '';

      if (order.sourceChain === 'ethereum') {
        const tx = await this.ethClient.claim(order.id, secret);
        const receipt = await tx.wait();
        txHash = receipt?.hash || '';
      } else if (order.sourceChain === 'stellar') {
        txHash = await this.stellarClient.claim(order.id, secret);
      } else if (order.sourceChain === 'solana') {
        txHash = await this.solanaClient.claim(order.id, secret);
      }

      console.log(`[Relayer] Claimed source leg for order ${order.id}. Tx: ${txHash}`);

      // Notify coordinator of source settlement
      await fetch(`${this.coordinatorUrl}/api/orders/${order.id}/settle-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
    } catch (err) {
      console.error(`Failed to claim source for order ${order.id}:`, err);
    }
  }
}
