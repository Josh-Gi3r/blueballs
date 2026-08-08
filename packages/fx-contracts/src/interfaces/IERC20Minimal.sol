// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

/// @notice Minimal ERC-20 surface used by the FX vault.
/// @dev FX-1 supports only explicitly allowlisted tokens that return a boolean from transfer/transferFrom.
interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
