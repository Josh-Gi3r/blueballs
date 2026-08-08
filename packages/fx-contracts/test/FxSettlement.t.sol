// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { FxSettlement } from "../src/FxSettlement.sol";
import { FxTypes } from "../src/FxTypes.sol";
import { FxVault } from "../src/FxVault.sol";
import { OrderCancellation } from "../src/OrderCancellation.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { Vm } from "./utils/Vm.sol";

contract RouterHarness {
    FxSettlement public settlement;

    constructor(FxSettlement settlement_) {
        settlement = settlement_;
    }

    function fill(
        FxTypes.MakerOrder calldata order,
        bytes calldata signature,
        uint256 makerSellAmount,
        address taker,
        bytes32 settlementRef
    ) external returns (uint256) {
        return settlement.fillMakerOrder(
            order, signature, makerSellAmount, taker, taker, settlementRef
        );
    }

    function fillTo(
        FxTypes.MakerOrder calldata order,
        bytes calldata signature,
        uint256 makerSellAmount,
        address takerPayer,
        address outputRecipient,
        bytes32 settlementRef
    ) external returns (uint256) {
        return settlement.fillMakerOrder(
            order, signature, makerSellAmount, takerPayer, outputRecipient, settlementRef
        );
    }
}

contract FxSettlementTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant MAKER_PK = 0xA11CE;
    uint256 internal constant TAKER_PK = 0xB0B;
    uint256 internal constant OTHER_PK = 0xCAFE;

    address internal maker;
    address internal taker;

    MockERC20 internal sellToken;
    MockERC20 internal buyToken;
    FxVault internal vault;
    OrderCancellation internal cancellation;
    FxSettlement internal settlement;
    RouterHarness internal router;

    function setUp() public {
        maker = vm.addr(MAKER_PK);
        taker = vm.addr(TAKER_PK);

        sellToken = new MockERC20();
        buyToken = new MockERC20();

        address[] memory tokens = new address[](2);
        tokens[0] = address(sellToken);
        tokens[1] = address(buyToken);

        vault = new FxVault(address(this), tokens);
        cancellation = new OrderCancellation();
        settlement = new FxSettlement(address(this), vault, cancellation);
        vault.bindSettlement(address(settlement));

        router = new RouterHarness(settlement);
        settlement.bindRouter(address(router));

        sellToken.mint(maker, 1_000 ether);
        buyToken.mint(taker, 2_000 ether);

        vm.startPrank(maker);
        sellToken.approve(address(vault), type(uint256).max);
        vault.deposit(address(sellToken), 1_000 ether);
        vm.stopPrank();

        vm.startPrank(taker);
        buyToken.approve(address(vault), type(uint256).max);
        vault.deposit(address(buyToken), 2_000 ether);
        vm.stopPrank();
    }

    function testValidPartialFillMovesOnlyAccountedBalances() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        uint256 paid = router.fill(order, signature, 25 ether, taker, keccak256("fill-1"));

        require(paid == 50 ether, "wrong taker payment");
        require(vault.balanceOf(address(sellToken), maker) == 975 ether, "maker sell");
        require(vault.balanceOf(address(sellToken), taker) == 25 ether, "taker sell");
        require(vault.balanceOf(address(buyToken), taker) == 1_950 ether, "taker buy");
        require(vault.balanceOf(address(buyToken), maker) == 50 ether, "maker buy");
        require(vault.totalLiabilities(address(sellToken)) == 1_000 ether, "sell liabilities");
        require(vault.totalLiabilities(address(buyToken)) == 2_000 ether, "buy liabilities");
    }

    function testOutputCanBeCreditedToDifferentAuthorizedRecipient() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, MAKER_PK);
        address recipient = address(0xCA11);

        router.fillTo(order, signature, 25 ether, taker, recipient, keccak256("fill-recipient"));

        require(vault.balanceOf(address(sellToken), taker) == 0, "payer received output");
        require(vault.balanceOf(address(sellToken), recipient) == 25 ether, "recipient missing output");
        require(vault.balanceOf(address(buyToken), taker) == 1_950 ether, "payer not debited");
        require(vault.balanceOf(address(buyToken), maker) == 50 ether, "maker not paid");
    }

    function testCancelledOrderCannotSettle() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 3);
        bytes memory signature = _sign(order, MAKER_PK);
        bytes32 orderHash = settlement.hashMakerOrder(order);

        vm.prank(maker);
        cancellation.cancelOrder(orderHash);

        bool reverted;
        try router.fill(order, signature, 10 ether, taker, keccak256("cancelled")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "cancelled order settled");
    }

    function testEpochInvalidationCannotBeIgnoredByRouter() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 4);
        bytes memory signature = _sign(order, MAKER_PK);

        vm.prank(maker);
        cancellation.invalidateBefore(5);

        bool reverted;
        try router.fill(order, signature, 10 ether, taker, keccak256("old-epoch")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "old epoch settled");
    }

    function testWrongSignerCannotAuthorizeMakerOrder() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, OTHER_PK);

        bool reverted;
        try router.fill(order, signature, 10 ether, taker, keccak256("wrong-signer")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "wrong signer accepted");
    }

    function testCumulativePartialFillsCannotOverfillOrder() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        router.fill(order, signature, 80 ether, taker, keccak256("partial-1"));

        bool reverted;
        try router.fill(order, signature, 21 ether, taker, keccak256("partial-2")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "order overfilled");

        bytes32 orderHash = settlement.hashMakerOrder(order);
        require(settlement.filledSellAmount(orderHash) == 80 ether, "filled sell changed");
        require(settlement.filledBuyAmount(orderHash) == 160 ether, "filled buy changed");
    }

    function testExpiredOrderCannotSettle() public {
        vm.warp(1_000);
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, 999, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        bool reverted;
        try router.fill(order, signature, 10 ether, taker, keccak256("expired")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "expired order settled");
    }

    function testFutureOrderCannotSettleEarly() public {
        vm.warp(1_000);
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 1_001, 2_000, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        bool reverted;
        try router.fill(order, signature, 10 ether, taker, keccak256("too-early")) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "future order settled");
    }

    function testCumulativeRoundingDoesNotLeakAcrossTinyFills() public {
        FxTypes.MakerOrder memory order = _order(3, 2, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        uint256 first = router.fill(order, signature, 1, taker, keccak256("round-1"));
        uint256 second = router.fill(order, signature, 1, taker, keccak256("round-2"));
        uint256 third = router.fill(order, signature, 1, taker, keccak256("round-3"));

        require(first == 1, "first rounding");
        require(second == 1, "second rounding");
        require(third == 0, "third rounding");

        bytes32 orderHash = settlement.hashMakerOrder(order);
        require(settlement.filledSellAmount(orderHash) == 3, "sell total");
        require(settlement.filledBuyAmount(orderHash) == 2, "buy total exceeded signed order");
    }

    function testRouterBindingCannotChange() public {
        bool reverted;
        try settlement.bindRouter(address(0xBEEF)) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "router rebound");
        require(settlement.router() == address(router), "router changed");
    }

    function testDirectCallerCannotSettle() public {
        FxTypes.MakerOrder memory order = _order(100 ether, 200 ether, 0, type(uint64).max, 1);
        bytes memory signature = _sign(order, MAKER_PK);

        bool reverted;
        try settlement.fillMakerOrder(
            order, signature, 10 ether, taker, taker, keccak256("direct")
        ) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "direct settlement succeeded");
    }

    function _order(
        uint256 sellAmount,
        uint256 buyAmount,
        uint64 validAfter,
        uint64 validUntil,
        uint64 epoch
    ) internal view returns (FxTypes.MakerOrder memory) {
        return FxTypes.MakerOrder({
            maker: maker,
            sellToken: address(sellToken),
            buyToken: address(buyToken),
            sellAmount: sellAmount,
            buyAmount: buyAmount,
            recipient: maker,
            validAfter: validAfter,
            validUntil: validUntil,
            epoch: epoch,
            salt: keccak256(abi.encode(sellAmount, buyAmount, validAfter, validUntil, epoch))
        });
    }

    function _sign(FxTypes.MakerOrder memory order, uint256 privateKey)
        internal
        returns (bytes memory)
    {
        bytes32 digest = settlement.hashMakerOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
