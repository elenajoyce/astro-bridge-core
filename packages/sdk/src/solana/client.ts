import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';

export interface SolanaOrder {
  orderId: string;
  sender: string;
  recipient: string;
  hashlock: string;
  amount: string;
  timelock: number;
  status: 'locked' | 'claimed' | 'refunded';
}

export class SolanaHTLCClient {
  private connection: Connection;
  private programId?: PublicKey;
  private wallet?: anchor.Wallet;
  private isSimulation: boolean = true;
  private mockDb: Map<string, SolanaOrder> = new Map();

  constructor(connection: Connection, programIdStr?: string, wallet?: anchor.Wallet) {
    this.connection = connection;
    if (programIdStr) {
      this.programId = new PublicKey(programIdStr);
      this.isSimulation = false;
    }
    this.wallet = wallet;
  }

  public async lock(
    orderId: string,
    recipient: string,
    hashlock: string,
    timelock: number,
    amount: string
  ): Promise<TransactionSignature | string> {
    if (this.isSimulation) {
      console.log(`[Solana simulation] Locking ${amount} SOL for recipient ${recipient} with hashlock ${hashlock}`);
      const mockTxHash = `sim_sol_lock_${Math.random().toString(36).substring(2, 15)}`;
      this.mockDb.set(orderId, {
        orderId,
        sender: this.wallet?.publicKey.toBase58() || 'sim_sender',
        recipient,
        hashlock,
        amount,
        timelock,
        status: 'locked',
      });
      return mockTxHash;
    }

    if (!this.wallet || !this.programId) {
      throw new Error('Wallet and program ID are required for live mode');
    }

    // Live Anchor program integration code
    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {});
    const program = new anchor.Program(
      {
        version: '0.1.0',
        name: 'solana_htlc',
        instructions: [
          {
            name: 'lockOrder',
            accounts: [
              { name: 'order', isMut: true, isSigner: false },
              { name: 'sender', isMut: true, isSigner: true },
              { name: 'recipient', isMut: false, isSigner: false },
              { name: 'systemProgram', isMut: false, isSigner: false },
            ],
            args: [
              { name: 'orderId', type: 'string' },
              { name: 'hashlock', type: { array: ['u8', 32] } },
              { name: 'timelock', type: 'u64' },
              { name: 'amount', type: 'u64' },
            ],
          },
        ],
      } as any,
      provider
    ) as any; // Cast to any to avoid deep typescript recursion errors

    const hashlockBytes = Array.from(Buffer.from(hashlock.replace(/^0x/, ''), 'hex'));
    const orderPda = PublicKey.findProgramAddressSync(
      [Buffer.from('order'), Buffer.from(orderId)],
      this.programId
    )[0];

    const tx = await program.methods
      .lockOrder(orderId, hashlockBytes, new anchor.BN(timelock), new anchor.BN(amount))
      .accounts({
        order: orderPda,
        sender: this.wallet.publicKey,
        recipient: new PublicKey(recipient),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  public async claim(orderId: string, secret: string): Promise<TransactionSignature | string> {
    if (this.isSimulation) {
      console.log(`[Solana simulation] Claiming order ${orderId} using secret ${secret}`);
      const order = this.mockDb.get(orderId);
      if (!order) throw new Error('Order not found');
      order.status = 'claimed';
      this.mockDb.set(orderId, order);
      return `sim_sol_claim_${Math.random().toString(36).substring(2, 15)}`;
    }

    if (!this.wallet || !this.programId) {
      throw new Error('Wallet and program ID are required for live mode');
    }

    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {});
    const program = new anchor.Program(
      {
        version: '0.1.0',
        name: 'solana_htlc',
        instructions: [
          {
            name: 'claimOrder',
            accounts: [
              { name: 'order', isMut: true, isSigner: false },
              { name: 'recipient', isMut: true, isSigner: true },
            ],
            args: [{ name: 'secret', type: { array: ['u8', 32] } }],
          },
        ],
      } as any,
      provider
    ) as any; // Cast to any to avoid deep typescript recursion errors

    const secretBytes = Array.from(Buffer.from(secret.replace(/^0x/, ''), 'hex'));
    const orderPda = PublicKey.findProgramAddressSync(
      [Buffer.from('order'), Buffer.from(orderId)],
      this.programId
    )[0];

    return await program.methods
      .claimOrder(secretBytes)
      .accounts({
        order: orderPda,
        recipient: this.wallet.publicKey,
      })
      .rpc();
  }

  public async refund(orderId: string): Promise<TransactionSignature | string> {
    if (this.isSimulation) {
      console.log(`[Solana simulation] Refunding order ${orderId}`);
      const order = this.mockDb.get(orderId);
      if (!order) throw new Error('Order not found');
      order.status = 'refunded';
      this.mockDb.set(orderId, order);
      return `sim_sol_refund_${Math.random().toString(36).substring(2, 15)}`;
    }

    if (!this.wallet || !this.programId) {
      throw new Error('Wallet and program ID are required for live mode');
    }

    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {});
    const program = new anchor.Program(
      {
        version: '0.1.0',
        name: 'solana_htlc',
        instructions: [
          {
            name: 'refundOrder',
            accounts: [
              { name: 'order', isMut: true, isSigner: false },
              { name: 'sender', isMut: true, isSigner: true },
            ],
            args: [],
          },
        ],
      } as any,
      provider
    ) as any; // Cast to any to avoid deep typescript recursion errors

    const orderPda = PublicKey.findProgramAddressSync(
      [Buffer.from('order'), Buffer.from(orderId)],
      this.programId
    )[0];

    return await program.methods
      .refundOrder()
      .accounts({
        order: orderPda,
        sender: this.wallet.publicKey,
      })
      .rpc();
  }

  public async getOrder(orderId: string): Promise<SolanaOrder | null> {
    if (this.isSimulation) {
      return this.mockDb.get(orderId) || null;
    }
    // live check would query program account info and decode
    return null;
  }
}
