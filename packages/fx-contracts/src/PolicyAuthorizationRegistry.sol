// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

/// @title Blueballs FX Policy Authorization Registry
/// @notice On-chain enforcement for short-lived institution-approved FX authorizations.
/// @dev A valid maker/taker signature is insufficient when the bound policy authorization is expired or revoked.
contract PolicyAuthorizationRegistry {
    error NotOwner();
    error ZeroAddress();
    error ZeroAuthorizationHash();
    error AuthorizationExpired();
    error EpochBelowMinimum();
    error EpochNotIncreasing();

    event AuthorizationGranted(bytes32 indexed authorizationHash, uint64 validUntil, uint64 epoch);
    event AuthorizationRevoked(bytes32 indexed authorizationHash);
    event MinimumEpochAdvanced(uint64 previousEpoch, uint64 newEpoch);

    struct Authorization {
        uint64 validUntil;
        uint64 epoch;
        bool revoked;
    }

    address public immutable owner;
    uint64 public minimumEpoch;
    mapping(bytes32 authorizationHash => Authorization authorization) public authorizations;

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function authorize(bytes32 authorizationHash, uint64 validUntil, uint64 epoch) external onlyOwner {
        if (authorizationHash == bytes32(0)) revert ZeroAuthorizationHash();
        if (validUntil <= block.timestamp) revert AuthorizationExpired();
        if (epoch < minimumEpoch) revert EpochBelowMinimum();
        authorizations[authorizationHash] = Authorization({
            validUntil: validUntil,
            epoch: epoch,
            revoked: false
        });
        emit AuthorizationGranted(authorizationHash, validUntil, epoch);
    }

    function revoke(bytes32 authorizationHash) external onlyOwner {
        if (authorizationHash == bytes32(0)) revert ZeroAuthorizationHash();
        Authorization storage authorization = authorizations[authorizationHash];
        authorization.revoked = true;
        emit AuthorizationRevoked(authorizationHash);
    }

    function invalidateBefore(uint64 newEpoch) external onlyOwner {
        uint64 current = minimumEpoch;
        if (newEpoch <= current) revert EpochNotIncreasing();
        minimumEpoch = newEpoch;
        emit MinimumEpochAdvanced(current, newEpoch);
    }

    function isValid(bytes32 authorizationHash) external view returns (bool) {
        Authorization memory authorization = authorizations[authorizationHash];
        return authorizationHash != bytes32(0) && !authorization.revoked
            && authorization.validUntil >= block.timestamp && authorization.epoch >= minimumEpoch
            && authorization.validUntil != 0;
    }
}
