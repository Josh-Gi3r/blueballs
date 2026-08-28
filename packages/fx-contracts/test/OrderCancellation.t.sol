// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { OrderCancellation } from "../src/OrderCancellation.sol";

contract CancellationActor {
    function cancel(OrderCancellation registry, bytes32 orderHash) external {
        registry.cancelOrder(orderHash);
    }

    function invalidateBefore(OrderCancellation registry, uint64 newEpoch) external {
        registry.invalidateBefore(newEpoch);
    }
}

contract OrderCancellationTest {
    OrderCancellation internal registry = new OrderCancellation();
    CancellationActor internal alice = new CancellationActor();
    CancellationActor internal bob = new CancellationActor();

    function testMakerCanCancelOwnOrder() public {
        bytes32 hash = keccak256("alice-order");
        alice.cancel(registry, hash);

        require(registry.isOrderCancelled(address(alice), hash), "alice order not cancelled");
        require(!registry.isOrderCancelled(address(bob), hash), "bob order wrongly cancelled");
    }

    function testOtherMakerCannotCancelSameHashForOwner() public {
        bytes32 hash = keccak256("same-order-hash");
        bob.cancel(registry, hash);

        require(registry.isOrderCancelled(address(bob), hash), "bob cancellation missing");
        require(!registry.isOrderCancelled(address(alice), hash), "alice cancellation forged");
    }

    function testEpochInvalidatesOnlyOlderOrders() public {
        alice.invalidateBefore(registry, 10);

        bytes32 oldHash = keccak256("old");
        bytes32 currentHash = keccak256("current");

        require(registry.isInvalid(address(alice), oldHash, 9), "old epoch accepted");
        require(!registry.isInvalid(address(alice), currentHash, 10), "current epoch rejected");
        require(!registry.isInvalid(address(alice), currentHash, 11), "future epoch rejected");
    }

    function testEpochCannotMoveBackwardsOrStaySame() public {
        alice.invalidateBefore(registry, 7);

        bool sameReverted;
        try alice.invalidateBefore(registry, 7) {
            sameReverted = false;
        } catch {
            sameReverted = true;
        }
        require(sameReverted, "same epoch accepted");

        bool lowerReverted;
        try alice.invalidateBefore(registry, 6) {
            lowerReverted = false;
        } catch {
            lowerReverted = true;
        }
        require(lowerReverted, "lower epoch accepted");
    }

    function testSingleCancelAndEpochCancelCompose() public {
        bytes32 hash = keccak256("specific");
        alice.cancel(registry, hash);
        alice.invalidateBefore(registry, 20);

        require(registry.isInvalid(address(alice), hash, 25), "specific cancel lost");
        require(
            registry.isInvalid(address(alice), keccak256("different"), 19),
            "epoch invalidation lost"
        );
    }

    function testFuzzEpochBoundary(uint64 newEpoch, uint64 orderEpoch) public {
        if (newEpoch == 0) return;
        CancellationActor actor = new CancellationActor();
        actor.invalidateBefore(registry, newEpoch);

        bool invalid = registry.isInvalid(address(actor), keccak256("fuzz-order"), orderEpoch);
        require(invalid == (orderEpoch < newEpoch), "epoch boundary mismatch");
    }
}
