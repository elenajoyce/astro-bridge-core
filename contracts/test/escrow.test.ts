import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, ZeroAddress, id, keccak256, sha256 } from "ethers";

describe("AstroBridge EVM Contracts", function () {
  let htlcEscrow: any;
  let resolverRegistry: any;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;

  const secret = id("secret_preimage");
  const hashlock = sha256(secret);
  const orderId = keccak256(ethers.toUtf8Bytes("order_1"));

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
    resolverRegistry = await ResolverRegistry.deploy();

    const HTLCEscrow = await ethers.getContractFactory("HTLCEscrow");
    htlcEscrow = await HTLCEscrow.deploy();
  });

  describe("ResolverRegistry", function () {
    it("Should allow a resolver to register with sufficient stake", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await expect(resolverRegistry.connect(user1).registerResolver({ value: stakeAmount }))
        .to.emit(resolverRegistry, "ResolverRegistered")
        .withArgs(await user1.getAddress(), stakeAmount);

      const res = await resolverRegistry.resolvers(await user1.getAddress());
      expect(res.active).to.be.true;
      expect(res.stakedAmount).to.equal(stakeAmount);
    });

    it("Should reject registration with insufficient stake", async function () {
      const stakeAmount = ethers.parseEther("0.5");
      await expect(resolverRegistry.connect(user1).registerResolver({ value: stakeAmount }))
        .to.be.revertedWith("Insufficient stake amount");
    });

    it("Should allow a resolver to unregister and get their stake back", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await resolverRegistry.connect(user1).registerResolver({ value: stakeAmount });

      await expect(resolverRegistry.connect(user1).unregisterResolver())
        .to.emit(resolverRegistry, "ResolverUnregistered")
        .withArgs(await user1.getAddress());

      const res = await resolverRegistry.resolvers(await user1.getAddress());
      expect(res.active).to.be.false;
      expect(res.stakedAmount).to.equal(0n);
    });

    it("Should allow owner to slash resolver stake", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await resolverRegistry.connect(user1).registerResolver({ value: stakeAmount });

      const recipient = await user2.getAddress();
      const initialBalance = await ethers.provider.getBalance(recipient);

      await expect(resolverRegistry.connect(owner).slashResolver(await user1.getAddress(), recipient))
        .to.emit(resolverRegistry, "ResolverSlashed")
        .withArgs(await user1.getAddress(), recipient, stakeAmount);

      const finalBalance = await ethers.provider.getBalance(recipient);
      expect(finalBalance - initialBalance).to.equal(stakeAmount);
    });

    it("Should reject slashing by non-owner", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await resolverRegistry.connect(user1).registerResolver({ value: stakeAmount });

      await expect(resolverRegistry.connect(user2).slashResolver(await user1.getAddress(), await user2.getAddress()))
        .to.be.revertedWith("Only owner can perform this action");
    });
  });

  describe("HTLCEscrow", function () {
    let timelock: number;

    beforeEach(async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      timelock = (latestBlock?.timestamp || 0) + 3600; // 1 hour in future
    });

    it("Should allow a user to lock an order", async function () {
      const amount = ethers.parseEther("1.0");
      const rAddress = await user2.getAddress();

      await expect(htlcEscrow.connect(user1).lockOrder(orderId, rAddress, hashlock, timelock, { value: amount }))
        .to.emit(htlcEscrow, "OrderLocked")
        .withArgs(orderId, await user1.getAddress(), rAddress, amount, hashlock, timelock);

      const order = await htlcEscrow.orders(orderId);
      expect(order.sender).to.equal(await user1.getAddress());
      expect(order.recipient).to.equal(rAddress);
      expect(order.amount).to.equal(amount);
      expect(order.hashlock).to.equal(hashlock);
      expect(order.timelock).to.equal(timelock);
      expect(order.status).to.equal(1); // Locked
    });

    it("Should allow claim using correct secret", async function () {
      const amount = ethers.parseEther("1.0");
      const rAddress = await user2.getAddress();
      await htlcEscrow.connect(user1).lockOrder(orderId, rAddress, hashlock, timelock, { value: amount });

      const initialBalance = await ethers.provider.getBalance(rAddress);

      await expect(htlcEscrow.connect(owner).claimOrder(orderId, secret))
        .to.emit(htlcEscrow, "OrderClaimed")
        .withArgs(orderId, secret);

      const finalBalance = await ethers.provider.getBalance(rAddress);
      expect(finalBalance - initialBalance).to.equal(amount);

      const order = await htlcEscrow.orders(orderId);
      expect(order.status).to.equal(2); // Claimed
    });

    it("Should reject claim using incorrect secret", async function () {
      const amount = ethers.parseEther("1.0");
      const rAddress = await user2.getAddress();
      await htlcEscrow.connect(user1).lockOrder(orderId, rAddress, hashlock, timelock, { value: amount });

      const badSecret = id("wrong_secret");
      await expect(htlcEscrow.connect(user2).claimOrder(orderId, badSecret))
        .to.be.revertedWith("Invalid secret");
    });

    it("Should allow refund after timelock expires", async function () {
      const amount = ethers.parseEther("1.0");
      const rAddress = await user2.getAddress();
      await htlcEscrow.connect(user1).lockOrder(orderId, rAddress, hashlock, timelock, { value: amount });

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      const initialBalance = await ethers.provider.getBalance(await user1.getAddress());

      const tx = await htlcEscrow.connect(user1).refundOrder(orderId);
      const receipt = await tx.wait();
      const gasSpent = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice);

      const finalBalance = await ethers.provider.getBalance(await user1.getAddress());
      expect(finalBalance - initialBalance + gasSpent).to.equal(amount);

      const order = await htlcEscrow.orders(orderId);
      expect(order.status).to.equal(3); // Refunded
    });

    it("Should reject refund before timelock expires", async function () {
      const amount = ethers.parseEther("1.0");
      const rAddress = await user2.getAddress();
      await htlcEscrow.connect(user1).lockOrder(orderId, rAddress, hashlock, timelock, { value: amount });

      await expect(htlcEscrow.connect(user1).refundOrder(orderId))
        .to.be.revertedWith("Timelock has not expired");
    });

    it("Should credit pull-payment balance if direct transfer fails on claim", async function () {
      // Deploy a reverting receiver contract
      const RevertingContract = await ethers.getContractFactory("RevertingContract");
      const revertingContract = await RevertingContract.deploy();
      const revertingAddress = await revertingContract.getAddress();

      const amount = ethers.parseEther("1.0");
      await htlcEscrow.connect(user1).lockOrder(orderId, revertingAddress, hashlock, timelock, { value: amount });

      // Claim should succeed but trigger pull payment
      await expect(htlcEscrow.connect(user2).claimOrder(orderId, secret))
        .to.emit(htlcEscrow, "PullPaymentCredited")
        .withArgs(revertingAddress, amount);

      const balance = await htlcEscrow.pullBalances(revertingAddress);
      expect(balance).to.equal(amount);

      const order = await htlcEscrow.orders(orderId);
      expect(order.status).to.equal(2); // Claimed
    });
  });
});
