// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HTLCEscrow {
    enum OrderStatus {
        None,
        Locked,
        Claimed,
        Refunded
    }

    struct Order {
        address sender;
        address recipient;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        OrderStatus status;
    }

    mapping(bytes32 => Order) public orders;
    mapping(address => uint256) public pullBalances;

    event OrderLocked(
        bytes32 indexed orderId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    event OrderClaimed(bytes32 indexed orderId, bytes32 secret);
    event OrderRefunded(bytes32 indexed orderId);
    event Withdrawal(address indexed recipient, uint256 amount);
    event PullPaymentCredited(address indexed recipient, uint256 amount);

    function lockOrder(
        bytes32 orderId,
        address recipient,
        bytes32 hashlock,
        uint256 timelock
    ) external payable {
        require(orders[orderId].status == OrderStatus.None, "Order ID already exists");
        require(msg.value > 0, "Amount must be greater than zero");
        require(timelock > block.timestamp, "Timelock must be in the future");
        require(recipient != address(0), "Invalid recipient");

        orders[orderId] = Order({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            hashlock: hashlock,
            timelock: timelock,
            status: OrderStatus.Locked
        });

        emit OrderLocked(orderId, msg.sender, recipient, msg.value, hashlock, timelock);
    }

    function claimOrder(bytes32 orderId, bytes32 secret) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Locked, "Order is not locked");
        require(sha256(abi.encodePacked(secret)) == order.hashlock, "Invalid secret");

        order.status = OrderStatus.Claimed;
        uint256 amount = order.amount;

        emit OrderClaimed(orderId, secret);

        // Safe transfer: direct push, fallback to pull-payment on failure
        (bool success, ) = order.recipient.call{value: amount, gas: 5000}("");
        if (!success) {
            pullBalances[order.recipient] += amount;
            emit PullPaymentCredited(order.recipient, amount);
        }
    }

    function refundOrder(bytes32 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Locked, "Order is not locked");
        require(block.timestamp >= order.timelock, "Timelock has not expired");

        order.status = OrderStatus.Refunded;
        uint256 amount = order.amount;

        emit OrderRefunded(orderId);

        // Safe transfer: direct push, fallback to pull-payment on failure
        (bool success, ) = order.sender.call{value: amount, gas: 5000}("");
        if (!success) {
            pullBalances[order.sender] += amount;
            emit PullPaymentCredited(order.sender, amount);
        }
    }

    function withdraw() external {
        uint256 amount = pullBalances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        pullBalances[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }
}
