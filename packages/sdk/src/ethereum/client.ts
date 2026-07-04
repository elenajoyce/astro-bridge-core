import { ethers } from 'ethers';

export const HTLC_ESCROW_ABI = [
  'function lockOrder(bytes32 orderId, address recipient, bytes32 hashlock, uint256 timelock) payable external',
  'function claimOrder(bytes32 orderId, bytes32 secret) external',
  'function refundOrder(bytes32 orderId) external',
  'function withdraw() external',
  'function pullBalances(address user) external view returns (uint256)',
  'function orders(bytes32 orderId) external view returns (address sender, address recipient, uint256 amount, bytes32 hashlock, uint256 timelock, uint8 status)'
];

export const RESOLVER_REGISTRY_ABI = [
  'function registerResolver() payable external',
  'function unregisterResolver() external',
  'function resolvers(address resolver) external view returns (uint256 stakedAmount, bool active, uint256 activeSwaps)',
  'function slashResolver(address resolver, address recipient) external'
];

export class EthereumHTLCClient {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private escrowAddress: string;
  private registryAddress: string;

  constructor(provider: ethers.Provider, escrowAddress: string, registryAddress: string, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.escrowAddress = escrowAddress;
    this.registryAddress = registryAddress;
  }

  private getEscrowContract(): ethers.Contract {
    return new ethers.Contract(this.escrowAddress, HTLC_ESCROW_ABI, this.signer || this.provider);
  }

  private getRegistryContract(): ethers.Contract {
    return new ethers.Contract(this.registryAddress, RESOLVER_REGISTRY_ABI, this.signer || this.provider);
  }

  public async lock(
    orderId: string,
    recipient: string,
    hashlock: string,
    timelock: number,
    amount: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) throw new Error('Signer required to lock order');
    const contract = this.getEscrowContract();
    
    // Ensure orderId is formatted as a 32-byte hex string
    const formattedOrderId = ethers.zeroPadValue(ethers.toBeArray(ethers.id(orderId)), 32);
    const formattedHashlock = hashlock.startsWith('0x') ? hashlock : `0x${hashlock}`;

    const tx = await contract.lockOrder(
      formattedOrderId,
      recipient,
      formattedHashlock,
      timelock,
      { value: amount }
    );
    return tx;
  }

  public async claim(orderId: string, secret: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) throw new Error('Signer required to claim order');
    const contract = this.getEscrowContract();
    const formattedOrderId = ethers.zeroPadValue(ethers.toBeArray(ethers.id(orderId)), 32);
    const formattedSecret = secret.startsWith('0x') ? secret : `0x${secret}`;

    return await contract.claimOrder(formattedOrderId, formattedSecret);
  }

  public async refund(orderId: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) throw new Error('Signer required to refund order');
    const contract = this.getEscrowContract();
    const formattedOrderId = ethers.zeroPadValue(ethers.toBeArray(ethers.id(orderId)), 32);

    return await contract.refundOrder(formattedOrderId);
  }

  public async getOrder(orderId: string) {
    const contract = this.getEscrowContract();
    const formattedOrderId = ethers.zeroPadValue(ethers.toBeArray(ethers.id(orderId)), 32);
    const orderData = await contract.orders(formattedOrderId);
    return {
      sender: orderData.sender,
      recipient: orderData.recipient,
      amount: orderData.amount.toString(),
      hashlock: orderData.hashlock,
      timelock: Number(orderData.timelock),
      status: Number(orderData.status), // 0: None, 1: Locked, 2: Claimed, 3: Refunded
    };
  }

  public async registerResolver(stakeAmount: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) throw new Error('Signer required to register resolver');
    const contract = this.getRegistryContract();
    return await contract.registerResolver({ value: stakeAmount });
  }

  public async withdrawPullBalance(): Promise<ethers.TransactionResponse> {
    if (!this.signer) throw new Error('Signer required to withdraw pull balance');
    const contract = this.getEscrowContract();
    return await contract.withdraw();
  }

  public async getPullBalance(address: string): Promise<string> {
    const contract = this.getEscrowContract();
    const balance = await contract.pullBalances(address);
    return balance.toString();
  }
}
