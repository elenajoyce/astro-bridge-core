// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RevertingContract {
    // Reverts on any ether receipt
    receive() external payable {
        revert("I refuse all ether");
    }
}
