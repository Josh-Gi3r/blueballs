// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

library FxTypes {
    struct MakerOrder {
        address maker;
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 buyAmount;
        address recipient;
        uint64 validAfter;
        uint64 validUntil;
        uint64 epoch;
        bytes32 salt;
    }
}
