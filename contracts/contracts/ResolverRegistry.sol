// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ResolverRegistry {
    struct ResolverInfo {
        uint256 stakedAmount;
        bool active;
        uint256 activeSwaps;
    }

    address public owner;
    uint256 public constant MIN_STAKE = 1 ether;

    mapping(address => ResolverInfo) public resolvers;

    event ResolverRegistered(address indexed resolver, uint256 stakedAmount);
    event ResolverUnregistered(address indexed resolver);
    event ResolverSlashed(address indexed resolver, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerResolver() external payable {
        require(msg.value >= MIN_STAKE, "Insufficient stake amount");
        require(!resolvers[msg.sender].active, "Already registered");

        resolvers[msg.sender].stakedAmount += msg.value;
        resolvers[msg.sender].active = true;

        emit ResolverRegistered(msg.sender, msg.value);
    }

    function unregisterResolver() external {
        ResolverInfo storage resolver = resolvers[msg.sender];
        require(resolver.active, "Not registered or already inactive");
        require(resolver.activeSwaps == 0, "Active swaps must be zero to unregister");

        uint256 amountToReturn = resolver.stakedAmount;
        resolver.stakedAmount = 0;
        resolver.active = false;

        (bool success, ) = msg.sender.call{value: amountToReturn}("");
        require(success, "Stake return failed");

        emit ResolverUnregistered(msg.sender);
    }

    function slashResolver(address resolverAddress, address recipient) external onlyOwner {
        ResolverInfo storage resolver = resolvers[resolverAddress];
        require(resolver.stakedAmount > 0, "Resolver has no stake");

        uint256 slashAmount = resolver.stakedAmount;
        resolver.stakedAmount = 0;
        resolver.active = false;

        (bool success, ) = recipient.call{value: slashAmount}("");
        require(success, "Slash payout failed");

        emit ResolverSlashed(resolverAddress, recipient, slashAmount);
    }

    function incrementActiveSwaps(address resolverAddress) external onlyOwner {
        require(resolvers[resolverAddress].active, "Resolver not active");
        resolvers[resolverAddress].activeSwaps++;
    }

    function decrementActiveSwaps(address resolverAddress) external onlyOwner {
        require(resolvers[resolverAddress].activeSwaps > 0, "No active swaps");
        resolvers[resolverAddress].activeSwaps--;
    }
}
