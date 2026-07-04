import { Connection, PublicKey } from '@solana/web3.js';
import { OrderService } from '../services/OrderService';

export class SolanaListener {
  private connection?: Connection;
  private programId?: PublicKey;
  private orderService: OrderService;
  private pollInterval: NodeJS.Timeout | null = null;
  private isSimulation: boolean = true;

  constructor(orderService: OrderService, rpcUrl?: string, programIdStr?: string) {
    this.orderService = orderService;
    if (rpcUrl && programIdStr) {
      this.connection = new Connection(rpcUrl, 'confirmed');
      this.programId = new PublicKey(programIdStr);
      this.isSimulation = false;
    }
  }

  public start() {
    if (this.isSimulation) {
      console.log('📡 Starting Solana listener in SIMULATION mode...');
      // In simulation mode, we just periodically check if we have orders that need simulated transitions
      this.pollInterval = setInterval(() => this.simulateTransitions(), 5000);
      return;
    }

    console.log(`📡 Starting Solana listener on program ${this.programId?.toBase58()}...`);
    this.pollInterval = setInterval(() => this.pollProgramLogs(), 5000);
  }

  private async pollProgramLogs() {
    if (!this.connection || !this.programId) return;

    try {
      // In a real implementation, poll transaction signatures for the program
      const signatures = await this.connection.getSignaturesForAddress(this.programId, { limit: 10 });
      for (const sigInfo of signatures) {
        const tx = await this.connection.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
        if (tx && tx.meta && tx.meta.logMessages) {
          this.processLogs(sigInfo.signature, tx.meta.logMessages);
        }
      }
    } catch (err) {
      console.error('Error polling Solana logs:', err);
    }
  }

  private processLogs(signature: string, logs: string[]) {
    // Look for Anchor program events or custom log messages
    for (const log of logs) {
      if (log.includes('Program log: Instruction: LockOrder')) {
        // Parse lock order parameters from logs
        console.log(`[Solana Event] Lock detected: ${signature}`);
        // For the demo/hackathon, we map the signature to order transitions
      } else if (log.includes('Program log: Instruction: ClaimOrder')) {
        console.log(`[Solana Event] Claim detected: ${signature}`);
      } else if (log.includes('Program log: Instruction: RefundOrder')) {
        console.log(`[Solana Event] Refund detected: ${signature}`);
      }
    }
  }

  private async simulateTransitions() {
    // In simulation mode, if there are any orders in the system that are 'PENDING',
    // the coordinator can transition them to LOCKED if the user has locked them,
    // or simulate coordinator/relayer behavior.
    const orders = await this.orderService.getOrders();
    for (const order of orders) {
      // If it's a solana leg, we can auto-advance state to simulate successful on-chain settlement
      if (order.sourceChain === 'solana' && order.status === 'PENDING') {
        console.log(`[Solana Simulation] Simulating source lock for order ${order.id}`);
        await this.orderService.lockSource(order.id, `sim_tx_src_${order.id}`);
      }
      if (order.destChain === 'solana' && order.status === 'LOCKED') {
        console.log(`[Solana Simulation] Simulating destination lock for order ${order.id}`);
        await this.orderService.lockDestination(order.id, `sim_tx_dest_${order.id}`);
      }
    }
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
