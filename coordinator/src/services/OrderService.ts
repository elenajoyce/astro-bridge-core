import { SwapOrder, Chain, OrderStateMachine, isValidRoute } from '@astro-bridge/sdk';
import { Persistence } from '../persistence';
import { QuoteService } from './QuoteService';
import * as crypto from 'crypto';

export class OrderService {
  private persistence: Persistence;
  private quoteService: QuoteService;

  constructor(persistence: Persistence, quoteService: QuoteService) {
    this.persistence = persistence;
    this.quoteService = quoteService;
  }

  public async createOrder(params: {
    sender: string;
    recipient: string;
    sourceChain: Chain;
    destChain: Chain;
    sourceAsset: string;
    destAsset: string;
    amount: string;
    hashlock: string;
  }): Promise<SwapOrder> {
    if (!isValidRoute(params.sourceChain, params.sourceAsset, params.destChain, params.destAsset)) {
      throw new Error('Invalid cross-chain swap asset route');
    }

    const quote = await this.quoteService.getQuote(
      params.sourceChain,
      params.destChain,
      params.sourceAsset,
      params.destAsset,
      params.amount
    );

    const timelock = Math.floor(Date.now() / 1000) + 86400; // 24 hours timelock on source

    const order: SwapOrder = {
      id: crypto.randomUUID(),
      sender: params.sender,
      recipient: params.recipient,
      sourceChain: params.sourceChain,
      destChain: params.destChain,
      sourceAsset: params.sourceAsset,
      destAsset: params.destAsset,
      amount: params.amount,
      destAmount: quote.destAmount,
      hashlock: params.hashlock.toLowerCase(),
      timelock,
      status: 'PENDING',
      resolverAddress: quote.resolverAddress,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await this.persistence.createOrder(order);
    return order;
  }

  public async getOrder(id: string): Promise<SwapOrder | null> {
    return await this.persistence.getOrder(id);
  }

  public async getOrders(): Promise<SwapOrder[]> {
    return await this.persistence.getOrders();
  }

  public async updateOrderState(
    id: string,
    nextStatus: SwapOrder['status'],
    txHashField?: string,
    txHashValue?: string
  ): Promise<SwapOrder> {
    const order = await this.persistence.getOrder(id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }

    // Transition state via state machine validator
    const updatedOrder = OrderStateMachine.transition(order, nextStatus);

    await this.persistence.updateOrderStatus(id, nextStatus, txHashField, txHashValue);

    return {
      ...updatedOrder,
      [txHashField || '']: txHashValue,
    };
  }

  public async lockSource(id: string, txHash: string): Promise<SwapOrder> {
    return await this.updateOrderState(id, 'LOCKED', 'txHashSource', txHash);
  }

  public async lockDestination(id: string, txHash: string): Promise<SwapOrder> {
    return await this.updateOrderState(id, 'RESOLVER_LOCKED', 'txHashDest', txHash);
  }

  public async claimDestination(id: string, txHash: string, secret: string): Promise<SwapOrder> {
    await this.persistence.storeSecret(id, secret);
    await this.persistence.query('UPDATE orders SET secret = ? WHERE id = ?', [secret, id]);
    return await this.updateOrderState(id, 'CLAIMED', 'txHashClaim', txHash);
  }

  public async settleSource(id: string, txHash: string): Promise<SwapOrder> {
    return await this.updateOrderState(id, 'SETTLED', 'txHashSource', txHash); // or just final state
  }

  public async refund(id: string): Promise<SwapOrder> {
    return await this.updateOrderState(id, 'REFUNDED');
  }
}
