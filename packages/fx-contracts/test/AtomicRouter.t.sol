// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { AtomicRouter } from "../src/AtomicRouter.sol";
import { FxSettlement } from "../src/FxSettlement.sol";
import { FxTypes } from "../src/FxTypes.sol";
import { FxVault } from "../src/FxVault.sol";
import { OrderCancellation } from "../src/OrderCancellation.sol";
import { PolicyAuthorizationRegistry } from "../src/PolicyAuthorizationRegistry.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { Vm } from "./utils/Vm.sol";

contract AtomicRouterTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant MAKER_ONE_PK = 0xA11CE;
    uint256 internal constant MAKER_TWO_PK = 0xB0B01;
    uint256 internal constant TAKER_PK = 0xC0FFEE;
    uint256 internal constant OTHER_PK = 0xBAD;

    address internal makerOne;
    address internal makerTwo;
    address internal taker;
    address internal recipient = address(0xF00D);

    MockERC20 internal inputToken;
    MockERC20 internal outputToken;
    FxVault internal vault;
    OrderCancellation internal cancellation;
    FxSettlement internal settlement;
    PolicyAuthorizationRegistry internal policyRegistry;
    AtomicRouter internal router;

    function setUp() public {
        makerOne = vm.addr(MAKER_ONE_PK);
        makerTwo = vm.addr(MAKER_TWO_PK);
        taker = vm.addr(TAKER_PK);

        inputToken = new MockERC20();
        outputToken = new MockERC20();

        address[] memory tokens = new address[](2);
        tokens[0] = address(inputToken);
        tokens[1] = address(outputToken);

        vault = new FxVault(address(this), tokens);
        cancellation = new OrderCancellation();
        settlement = new FxSettlement(address(this), vault, cancellation);
        policyRegistry = new PolicyAuthorizationRegistry(address(this));
        router = new AtomicRouter(settlement, policyRegistry);

        vault.bindSettlement(address(settlement));
        settlement.bindRouter(address(router));

        inputToken.mint(taker, 1_000 ether);
        outputToken.mint(makerOne, 500 ether);
        outputToken.mint(makerTwo, 500 ether);

        _deposit(taker, inputToken, 1_000 ether);
        _deposit(makerOne, outputToken, 500 ether);
        _deposit(makerTwo, outputToken, 500 ether);
    }

    function testMultiMakerRouteSettlesWithinSignedBounds() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 1, bytes32("policy"));
        bytes memory takerSignature = _signTaker(intent, TAKER_PK);

        (uint256 totalInput, uint256 totalOutput) = router.execute(intent, takerSignature, fills);

        require(totalInput == 194 ether, "wrong total input");
        require(totalOutput == 100 ether, "wrong total output");
        require(vault.balanceOf(address(outputToken), recipient) == 100 ether, "recipient output");
        require(vault.balanceOf(address(inputToken), makerOne) == 80 ether, "maker one payment");
        require(vault.balanceOf(address(inputToken), makerTwo) == 114 ether, "maker two payment");
        require(vault.balanceOf(address(inputToken), taker) == 806 ether, "taker input balance");
        require(router.usedNonce(taker, 1), "nonce not consumed");
    }

    function testReplayIsRejected() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 2, bytes32("policy"));
        bytes memory takerSignature = _signTaker(intent, TAKER_PK);

        router.execute(intent, takerSignature, fills);

        bool reverted;
        try router.execute(intent, takerSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "replay succeeded");
    }

    function testMaxInputFailureRollsBackEveryMakerFillAndNonce() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory intent = _intent(193 ether, 100 ether, 3, bytes32("policy"));
        bytes memory takerSignature = _signTaker(intent, TAKER_PK);
        bytes32 firstOrderHash = settlement.hashMakerOrder(fills[0].order);

        bool reverted;
        try router.execute(intent, takerSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "max input breach settled");
        require(settlement.filledSellAmount(firstOrderHash) == 0, "first fill survived revert");
        require(vault.balanceOf(address(outputToken), recipient) == 0, "recipient kept output");
        require(vault.balanceOf(address(inputToken), taker) == 1_000 ether, "taker debit survived");
        require(!router.usedNonce(taker, 3), "nonce survived reverted route");
    }

    function testMinOutputFailureRollsBackMakerFillAndNonce() public {
        FxTypes.MakerFill[] memory fills = new FxTypes.MakerFill[](1);
        fills[0] = _makerFill(
            makerOne, MAKER_ONE_PK, 40 ether, 80 ether, 40 ether, bytes32("maker-one-min")
        );
        FxTypes.TakerIntent memory intent = _intent(100 ether, 50 ether, 4, bytes32("policy"));
        bytes memory takerSignature = _signTaker(intent, TAKER_PK);
        bytes32 orderHash = settlement.hashMakerOrder(fills[0].order);

        bool reverted;
        try router.execute(intent, takerSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "min output breach settled");
        require(settlement.filledSellAmount(orderHash) == 0, "fill survived min-output revert");
        require(vault.balanceOf(address(outputToken), recipient) == 0, "recipient kept output");
        require(!router.usedNonce(taker, 4), "nonce survived reverted route");
    }

    function testCancelledSecondMakerRollsBackFirstMaker() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        bytes32 firstHash = settlement.hashMakerOrder(fills[0].order);
        bytes32 secondHash = settlement.hashMakerOrder(fills[1].order);

        vm.prank(makerTwo);
        cancellation.cancelOrder(secondHash);

        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 5, bytes32("policy"));
        bytes memory takerSignature = _signTaker(intent, TAKER_PK);

        bool reverted;
        try router.execute(intent, takerSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "cancelled second maker settled");
        require(settlement.filledSellAmount(firstHash) == 0, "first maker survived rollback");
        require(settlement.filledSellAmount(secondHash) == 0, "cancelled maker filled");
        require(vault.balanceOf(address(outputToken), recipient) == 0, "output survived rollback");
        require(!router.usedNonce(taker, 5), "nonce survived rollback");
    }

    function testWrongTakerSignatureIsRejected() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 6, bytes32("policy"));
        bytes memory wrongSignature = _signTaker(intent, OTHER_PK);

        bool reverted;
        try router.execute(intent, wrongSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "wrong taker signer accepted");
        require(!router.usedNonce(taker, 6), "nonce consumed on invalid signature");
    }

    function testIntentSignatureBindsPolicyAuthorizationHash() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory signedIntent =
            _intent(200 ether, 100 ether, 7, keccak256("approved-policy"));
        bytes memory signature = _signTaker(signedIntent, TAKER_PK);

        FxTypes.TakerIntent memory tamperedIntent = signedIntent;
        tamperedIntent.policyAuthorizationHash = keccak256("different-policy");

        bool reverted;
        try router.execute(tamperedIntent, signature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "policy hash was not signature-bound");
    }

    function testRevokedPolicyAuthorizationBlocksStillValidSignatures() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        bytes32 policyHash = keccak256("revocable-policy");
        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 70, policyHash);
        bytes memory signature = _signTaker(intent, TAKER_PK);
        policyRegistry.revoke(policyHash);

        bool reverted;
        try router.execute(intent, signature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "revoked policy authorization settled");
        require(!router.usedNonce(taker, 70), "nonce consumed for revoked policy");
    }

    function testPolicyEpochInvalidationBlocksOldAuthorizedIntent() public {
        FxTypes.MakerFill[] memory fills = _twoFills();
        bytes32 policyHash = keccak256("old-policy-epoch");
        FxTypes.TakerIntent memory intent = _intent(200 ether, 100 ether, 71, policyHash);
        bytes memory signature = _signTaker(intent, TAKER_PK);
        policyRegistry.invalidateBefore(2);

        bool reverted;
        try router.execute(intent, signature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "invalidated policy epoch settled");
        require(!router.usedNonce(taker, 71), "nonce consumed for invalidated epoch");
    }

    function testWrongMakerAssetPairIsRejectedBeforeSettlement() public {
        FxTypes.MakerFill[] memory fills = new FxTypes.MakerFill[](1);
        FxTypes.MakerOrder memory wrongOrder = FxTypes.MakerOrder({
            maker: makerOne,
            sellToken: address(inputToken),
            buyToken: address(outputToken),
            sellAmount: 10 ether,
            buyAmount: 10 ether,
            recipient: makerOne,
            validAfter: 0,
            validUntil: type(uint64).max,
            epoch: 1,
            salt: bytes32("wrong-pair")
        });
        fills[0] = FxTypes.MakerFill({
            order: wrongOrder,
            signature: _signMaker(wrongOrder, MAKER_ONE_PK),
            makerSellAmount: 10 ether
        });

        FxTypes.TakerIntent memory intent = _intent(20 ether, 10 ether, 8, bytes32("policy"));
        bytes memory signature = _signTaker(intent, TAKER_PK);

        bool reverted;
        try router.execute(intent, signature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "wrong pair settled");
    }

    function testExpiredTakerIntentIsRejected() public {
        vm.warp(100);
        FxTypes.MakerFill[] memory fills = _twoFills();
        FxTypes.TakerIntent memory intent = FxTypes.TakerIntent({
            taker: taker,
            inputToken: address(inputToken),
            outputToken: address(outputToken),
            maxInput: 200 ether,
            minOutput: 100 ether,
            recipient: recipient,
            deadline: 99,
            nonce: 9,
            policyAuthorizationHash: bytes32("policy")
        });
        bytes memory signature = _signTaker(intent, TAKER_PK);

        bool reverted;
        try router.execute(intent, signature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "expired intent settled");
    }

    function _twoFills() internal returns (FxTypes.MakerFill[] memory fills) {
        fills = new FxTypes.MakerFill[](2);
        fills[0] = _makerFill(
            makerOne, MAKER_ONE_PK, 40 ether, 80 ether, 40 ether, bytes32("maker-one")
        );
        fills[1] = _makerFill(
            makerTwo, MAKER_TWO_PK, 60 ether, 114 ether, 60 ether, bytes32("maker-two")
        );
    }

    function _makerFill(
        address maker,
        uint256 privateKey,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 fillAmount,
        bytes32 salt
    ) internal returns (FxTypes.MakerFill memory) {
        FxTypes.MakerOrder memory order = FxTypes.MakerOrder({
            maker: maker,
            sellToken: address(outputToken),
            buyToken: address(inputToken),
            sellAmount: sellAmount,
            buyAmount: buyAmount,
            recipient: maker,
            validAfter: 0,
            validUntil: type(uint64).max,
            epoch: 1,
            salt: salt
        });
        return FxTypes.MakerFill({
            order: order, signature: _signMaker(order, privateKey), makerSellAmount: fillAmount
        });
    }

    function _intent(uint256 maxInput, uint256 minOutput, uint256 nonce, bytes32 policyHash)
        internal
        returns (FxTypes.TakerIntent memory)
    {
        policyRegistry.authorize(policyHash, type(uint64).max, 1);
        return FxTypes.TakerIntent({
            taker: taker,
            inputToken: address(inputToken),
            outputToken: address(outputToken),
            maxInput: maxInput,
            minOutput: minOutput,
            recipient: recipient,
            deadline: type(uint64).max,
            nonce: nonce,
            policyAuthorizationHash: policyHash
        });
    }

    function _deposit(address actor, MockERC20 token, uint256 amount) internal {
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(address(token), amount);
        vm.stopPrank();
    }

    function _signMaker(FxTypes.MakerOrder memory order, uint256 privateKey)
        internal
        returns (bytes memory)
    {
        bytes32 digest = settlement.hashMakerOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signTaker(FxTypes.TakerIntent memory intent, uint256 privateKey)
        internal
        returns (bytes memory)
    {
        bytes32 digest = router.hashTakerIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
