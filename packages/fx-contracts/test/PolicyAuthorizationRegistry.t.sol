// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { PolicyAuthorizationRegistry } from "../src/PolicyAuthorizationRegistry.sol";
import { Vm } from "./utils/Vm.sol";

contract PolicyAuthorizationRegistryTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    PolicyAuthorizationRegistry internal registry;

    function setUp() public {
        registry = new PolicyAuthorizationRegistry(address(this));
    }

    function testAuthorizationIsValidUntilExpiry() public {
        vm.warp(100);
        bytes32 authorizationHash = keccak256("authorization");
        registry.authorize(authorizationHash, 200, 1);
        require(registry.isValid(authorizationHash), "authorization should be valid");

        vm.warp(201);
        require(!registry.isValid(authorizationHash), "expired authorization remained valid");
    }

    function testIndividualRevocationIsImmediate() public {
        bytes32 authorizationHash = keccak256("authorization");
        registry.authorize(authorizationHash, type(uint64).max, 1);
        registry.revoke(authorizationHash);
        require(!registry.isValid(authorizationHash), "revoked authorization remained valid");
    }

    function testEpochInvalidatesAllOlderAuthorizations() public {
        bytes32 oldAuthorization = keccak256("old");
        bytes32 newAuthorization = keccak256("new");
        registry.authorize(oldAuthorization, type(uint64).max, 1);
        registry.invalidateBefore(2);
        require(!registry.isValid(oldAuthorization), "old epoch remained valid");

        registry.authorize(newAuthorization, type(uint64).max, 2);
        require(registry.isValid(newAuthorization), "current epoch rejected");
    }

    function testNonOwnerCannotAuthorizeOrRevoke() public {
        address attacker = address(0xBAD);
        bytes32 authorizationHash = keccak256("authorization");

        vm.prank(attacker);
        bool authorizeReverted;
        try registry.authorize(authorizationHash, type(uint64).max, 1) {
            authorizeReverted = false;
        } catch {
            authorizeReverted = true;
        }
        require(authorizeReverted, "non-owner authorized policy");

        registry.authorize(authorizationHash, type(uint64).max, 1);
        vm.prank(attacker);
        bool revokeReverted;
        try registry.revoke(authorizationHash) {
            revokeReverted = false;
        } catch {
            revokeReverted = true;
        }
        require(revokeReverted, "non-owner revoked policy");
        require(registry.isValid(authorizationHash), "attacker changed authorization");
    }
}
