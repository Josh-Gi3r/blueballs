// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { FxVault } from "../../src/FxVault.sol";

/// @notice Test-only ERC-20 that attempts to reenter FxVault during transferFrom.
contract ReentrantERC20 {
    string public name = "Reentrant Test Token";
    string public symbol = "RNT";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    FxVault public attackVault;
    bool public attackEnabled;
    bool public reentryBlocked;
    bool private entered;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function configureAttack(FxVault vault, bool enabled) external {
        attackVault = vault;
        attackEnabled = enabled;
        reentryBlocked = false;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;

        if (attackEnabled && !entered) {
            entered = true;
            try attackVault.deposit(address(this), 1) {
                reentryBlocked = false;
            } catch {
                reentryBlocked = true;
            }
            entered = false;
        }

        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        uint256 balance = balanceOf[from];
        require(balance >= amount, "balance");
        balanceOf[from] = balance - amount;
        balanceOf[to] += amount;
    }
}
