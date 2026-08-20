// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";

import { FxVault } from "../../src/FxVault.sol";
import { IERC20Minimal } from "../../src/interfaces/IERC20Minimal.sol";

/// @notice Minimal contract-wallet harness used to prove maker signatures work for institutional smart wallets.
contract Mock1271Wallet is IERC1271 {
    bytes4 internal constant MAGICVALUE = IERC1271.isValidSignature.selector;

    mapping(bytes32 digest => bool approved) public approvedDigest;

    function approveDigest(bytes32 digest) external {
        approvedDigest[digest] = true;
    }

    function isValidSignature(bytes32 hash, bytes memory)
        external
        view
        returns (bytes4 magicValue)
    {
        return approvedDigest[hash] ? MAGICVALUE : bytes4(0xffffffff);
    }

    function approveToken(address token, address spender, uint256 amount) external {
        require(IERC20Minimal(token).approve(spender, amount), "APPROVE");
    }

    function deposit(FxVault vault, address token, uint256 amount) external {
        vault.deposit(token, amount);
    }
}
