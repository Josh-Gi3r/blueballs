// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

contract MockERC20 {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, "BALANCE");
        unchecked { balanceOf[msg.sender] = balance - amount; }
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        uint256 balance = balanceOf[from];
        require(permitted >= amount, "ALLOWANCE");
        require(balance >= amount, "BALANCE");
        unchecked {
            allowance[from][msg.sender] = permitted - amount;
            balanceOf[from] = balance - amount;
        }
        balanceOf[to] += amount;
        return true;
    }
}
