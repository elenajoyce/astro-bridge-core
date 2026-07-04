import { ethers } from 'ethers';
import { OrderService } from '../services/OrderService';
import { HTLC_ESCROW_ABI } from '@astro-bridge/sdk';

export class EthereumListener {
  private provider: ethers.JsonRpcProvider;
  private contractAddress: string;
  private contract: ethers.Contract;
  private orderService: OrderService;

  constructor(rpcUrl: string, contractAddress: string, orderService: OrderService) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contractAddress = contractAddress;
    this.orderService = orderService;
    this.contract = new ethers.Contract(contractAddress, HTLC_ESCROW_ABI, this.provider);
  }

  public start() {
    console.log(`📡 Starting Ethereum listener on ${this.contractAddress}...`);
    
    // Listen to OrderLocked
    this.contract.on('OrderLocked', async (orderIdRaw, sender, recipient, amount, hashlock, timelock, event) => {
      try {
        const orderId = ethers.decodeBytes32String(orderIdRaw).trim();
        console.log(`[EVM Event] OrderLocked: ${orderId}`);
        await this.orderService.lockSource(orderId, event.log.transactionHash);
      } catch (err) {
        console.error(`Error processing EVM OrderLocked event:`, err);
      }
    });

    // Listen to OrderClaimed
    this.contract.on('OrderClaimed', async (orderIdRaw, secret, event) => {
      try {
        const orderId = ethers.decodeBytes32String(orderIdRaw).trim();
        console.log(`[EVM Event] OrderClaimed: ${orderId}`);
        await this.orderService.claimDestination(orderId, event.log.transactionHash, secret);
      } catch (err) {
        console.error(`Error processing EVM OrderClaimed event:`, err);
      }
    });

    // Listen to OrderRefunded
    this.contract.on('OrderRefunded', async (orderIdRaw, event) => {
      try {
        const orderId = ethers.decodeBytes32String(orderIdRaw).trim();
        console.log(`[EVM Event] OrderRefunded: ${orderId}`);
        await this.orderService.refund(orderId);
      } catch (err) {
        console.error(`Error processing EVM OrderRefunded event:`, err);
      }
    });
  }

  public async stop() {
    await this.contract.removeAllListeners();
  }
}
