// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

/// @title Blueballs FX Order Cancellation Registry
/// @notice Maker-controlled on-chain revocation for signed off-chain FX orders.
contract OrderCancellation {
    error ZeroOrderHash();
    error EpochNotIncreasing();

    event OrderCancelled(address indexed maker, bytes32 indexed orderHash);
    event MinimumEpochAdvanced(address indexed maker, uint64 previousEpoch, uint64 newEpoch);

    mapping(address maker => mapping(bytes32 orderHash => bool cancelled)) private _cancelled;
    mapping(address maker => uint64 minimumEpoch) public minimumEpoch;

    /// @notice Cancel one signed order hash for the caller.
    function cancelOrder(bytes32 orderHash) external {
        if (orderHash == bytes32(0)) revert ZeroOrderHash();
        _cancelled[msg.sender][orderHash] = true;
        emit OrderCancelled(msg.sender, orderHash);
    }

    /// @notice Invalidate all caller orders whose signed epoch is below `newEpoch`.
    /// @dev This is the maker's emergency/mass-cancel primitive.
    function invalidateBefore(uint64 newEpoch) external {
        uint64 current = minimumEpoch[msg.sender];
        if (newEpoch <= current) revert EpochNotIncreasing();
        minimumEpoch[msg.sender] = newEpoch;
        emit MinimumEpochAdvanced(msg.sender, current, newEpoch);
    }

    function isOrderCancelled(address maker, bytes32 orderHash) external view returns (bool) {
        return _cancelled[maker][orderHash];
    }

    function isInvalid(address maker, bytes32 orderHash, uint64 orderEpoch)
        external
        view
        returns (bool)
    {
        return _cancelled[maker][orderHash] || orderEpoch < minimumEpoch[maker];
    }
}
