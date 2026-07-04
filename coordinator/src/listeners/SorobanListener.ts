import { rpc, xdr } from 'stellar-sdk';
import { OrderService } from '../services/OrderService';

export class SorobanListener {
  private rpcServer: rpc.Server;
  private htlcContractId: string;
  private orderService: OrderService;
  private startLedger: number = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(rpcUrl: string, htlcContractId: string, orderService: OrderService) {
    this.rpcServer = new rpc.Server(rpcUrl);
    this.htlcContractId = htlcContractId;
    this.orderService = orderService;
  }

  public async start() {
    console.log(`📡 Starting Soroban listener on contract ${this.htlcContractId}...`);
    // Initialize start ledger
    try {
      const latest = await this.rpcServer.getLatestLedger();
      this.startLedger = latest.sequence;
    } catch {
      this.startLedger = 1;
    }

    this.pollInterval = setInterval(() => this.pollEvents(), 5000);
  }

  private async pollEvents() {
    try {
      const latest = await this.rpcServer.getLatestLedger();
      if (latest.sequence < this.startLedger) return;

      const eventsRes = await this.rpcServer.getEvents({
        startLedger: this.startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.htlcContractId],
          },
        ],
        limit: 50,
      });

      for (const event of eventsRes.events) {
        this.processEvent(event);
      }

      this.startLedger = latest.sequence + 1;
    } catch (err) {
      console.error('Error polling Soroban events:', err);
    }
  }

  private processEvent(event: any) {
    try {
      const topics = event.topic as xdr.ScVal[];
      if (topics.length === 0) return;

      const eventType = topics[0].sym()?.toString();
      console.log(`[Soroban Event] type: ${eventType}`);

      if (eventType === 'lock') {
        const orderIdBytes = topics[2].bytes();
        const orderId = orderIdBytes.toString('utf-8');
        console.log(`[Soroban Event] Lock order detected: ${orderId}`);
        this.orderService.lockSource(orderId, event.txHash);
      } else if (eventType === 'claim') {
        const orderIdBytes = topics[1].bytes();
        const orderId = orderIdBytes.toString('utf-8');
        const secretBytes = topics[2].bytes();
        const secret = secretBytes.toString('hex');
        console.log(`[Soroban Event] Claim order detected: ${orderId}`);
        this.orderService.claimDestination(orderId, event.txHash, secret);
      } else if (eventType === 'refund') {
        const orderIdBytes = topics[1].bytes();
        const orderId = orderIdBytes.toString('utf-8');
        console.log(`[Soroban Event] Refund order detected: ${orderId}`);
        this.orderService.refund(orderId);
      }
    } catch (err) {
      console.error('Error processing Soroban event:', err);
    }
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
