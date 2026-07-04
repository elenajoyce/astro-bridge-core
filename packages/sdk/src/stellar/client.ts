import {
  Account,
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  rpc,
  TransactionBuilder,
  xdr,
} from 'stellar-sdk';

export class StellarHTLCClient {
  private rpcServer: rpc.Server;
  private networkPassphrase: string;
  private htlcContractId: string;
  private registryContractId: string;
  private keypair?: Keypair;

  constructor(
    rpcUrl: string,
    networkPassphrase: string,
    htlcContractId: string,
    registryContractId: string,
    keypair?: Keypair
  ) {
    this.rpcServer = new rpc.Server(rpcUrl);
    this.networkPassphrase = networkPassphrase;
    this.htlcContractId = htlcContractId;
    this.registryContractId = registryContractId;
    this.keypair = keypair;
  }

  public async getAccount(publicKey: string): Promise<Account> {
    return await this.rpcServer.getAccount(publicKey);
  }

  public async lock(
    orderId: string,
    recipient: string,
    hashlock: string,
    timelock: number,
    amount: string // stroops i128
  ): Promise<string> {
    if (!this.keypair) throw new Error('Keypair required to write');
    const contract = new Contract(this.htlcContractId);
    
    const orderIdBytes = Buffer.from(orderId, 'utf-8');
    const hashlockBytes = Buffer.from(hashlock.replace(/^0x/, ''), 'hex');
    
    // Construct ScVal for i128 correctly
    const value = BigInt(amount);
    const loVal = value & 0xffffffffffffffffn;
    const hiVal = value >> 64n;
    const parts = new xdr.Int128Parts({
      lo: xdr.Uint64.fromString(loVal.toString()),
      hi: xdr.Int64.fromString(hiVal.toString()),
    });
    const amountScVal = xdr.ScVal.scvI128(parts);

    const callArgs = [
      xdr.ScVal.scvBytes(orderIdBytes),
      new Address(recipient).toScVal(),
      xdr.ScVal.scvBytes(hashlockBytes),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(timelock.toString())),
      amountScVal,
    ];

    const operation = contract.call('lock', ...callArgs);
    return await this.submitTransaction(operation);
  }

  public async claim(orderId: string, secret: string): Promise<string> {
    if (!this.keypair) throw new Error('Keypair required to write');
    const contract = new Contract(this.htlcContractId);
    const orderIdBytes = Buffer.from(orderId, 'utf-8');
    const secretBytes = Buffer.from(secret.replace(/^0x/, ''), 'hex');

    const operation = contract.call('claim', xdr.ScVal.scvBytes(orderIdBytes), xdr.ScVal.scvBytes(secretBytes));
    return await this.submitTransaction(operation);
  }

  public async refund(orderId: string): Promise<string> {
    if (!this.keypair) throw new Error('Keypair required to write');
    const contract = new Contract(this.htlcContractId);
    const orderIdBytes = Buffer.from(orderId, 'utf-8');

    const operation = contract.call('refund', xdr.ScVal.scvBytes(orderIdBytes));
    return await this.submitTransaction(operation);
  }

  public async getOrder(orderId: string): Promise<any> {
    const contract = new Contract(this.htlcContractId);
    const orderIdBytes = Buffer.from(orderId, 'utf-8');
    
    const account = new Account('G'.padEnd(56, 'A'), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_order', xdr.ScVal.scvBytes(orderIdBytes)))
      .setTimeout(30)
      .build();

    const simRes = await this.rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(simRes)) {
      const resultVal = simRes.result?.retval;
      if (!resultVal || resultVal.switch() === xdr.ScValType.scvVoid()) {
        return null;
      }
      return resultVal;
    }
    throw new Error('Simulation failed or order not found');
  }

  private async submitTransaction(operation: xdr.Operation): Promise<string> {
    if (!this.keypair) throw new Error('Keypair required');
    const sourcePubkey = this.keypair.publicKey();
    
    const sequence = await this.fetchSequenceNumber(sourcePubkey);
    const account = new Account(sourcePubkey, sequence);

    const tx = new TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const preparedTx = await this.rpcServer.prepareTransaction(tx);
    preparedTx.sign(this.keypair);

    const result = await this.rpcServer.sendTransaction(preparedTx);
    if (result.status === 'ERROR') {
      throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
    }

    let status: string = result.status;
    const txHash = result.hash;
    let retries = 10;
    while (status === 'PENDING' && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusRes = await this.rpcServer.getTransaction(txHash);
      status = statusRes.status as string;
      if (status === 'SUCCESS') {
        return txHash;
      }
      if (status === 'FAILED') {
        throw new Error(`Transaction execution failed: ${JSON.stringify((statusRes as any).resultXdr || statusRes)}`);
      }
      retries--;
    }
    return txHash;
  }

  private async fetchSequenceNumber(publicKey: string): Promise<string> {
    try {
      const account = await this.rpcServer.getAccount(publicKey);
      return account.sequenceNumber();
    } catch {
      return '1';
    }
  }
}
