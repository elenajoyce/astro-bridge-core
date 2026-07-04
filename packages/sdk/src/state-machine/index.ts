import { OrderStatus, SwapOrder } from '../types';

export class OrderStateMachine {
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['LOCKED', 'FAILED'],
    LOCKED: ['RESOLVER_LOCKED', 'REFUNDED', 'FAILED'],
    RESOLVER_LOCKED: ['CLAIMED', 'REFUNDED'],
    CLAIMED: ['SETTLED', 'REFUNDED'],
    SETTLED: [],
    REFUNDED: [],
    FAILED: [],
  };

  /**
   * Validates if a state transition is allowed.
   */
  public static isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Returns the next state of a swap order after applying a transition.
   */
  public static transition(order: SwapOrder, nextStatus: OrderStatus): SwapOrder {
    if (!this.isValidTransition(order.status, nextStatus)) {
      throw new Error(`Invalid order state transition from ${order.status} to ${nextStatus}`);
    }

    return {
      ...order,
      status: nextStatus,
    };
  }

  /**
   * Helper to check if an order can be refunded based on current time.
   */
  public static isRefundable(order: SwapOrder, currentTimeSec: number): boolean {
    if (order.status !== 'LOCKED' && order.status !== 'RESOLVER_LOCKED') {
      return false;
    }
    return currentTimeSec >= order.timelock;
  }
}
