// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { AtomicRouter } from "../src/AtomicRouter.sol";
import { FxSettlement } from "../src/FxSettlement.sol";
import { FxTypes } from "../src/FxTypes.sol";
import { FxVault } from "../src/FxVault.sol";
import { OrderCancellation } from "../src/OrderCancellation.sol";
import { PolicyAuthorizationRegistry } from "../src/PolicyAuthorizationRegistry.sol";
import { Mock1271Wallet } from "./mocks/Mock1271Wallet.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { Vm } from "./utils/Vm.sol";

contract SmartWalletSignaturesTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant TAKER_PK = 0xBEEF;

    address internal taker;
    address internal recipient = address(0xCA11);

    MockERC20 internal inputToken;
    MockERC20 internal outputToken;
    Mock1271Wallet internal makerWallet;
    FxVault internal vault;
    OrderCancellation internal cancellation;
    FxSettlement internal settlement;
    PolicyAuthorizationRegistry internal policyRegistry;
    AtomicRouter internal router;

    function setUp() public {
        taker = vm.addr(TAKER_PK);
        inputToken = new MockERC20();
        outputToken = new MockERC20();
        makerWallet = new Mock1271Wallet();

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

        outputToken.mint(address(makerWallet), 100 ether);
        makerWallet.approveToken(address(outputToken), address(vault), 100 ether);
        makerWallet.deposit(vault, address(outputToken), 100 ether);

        inputToken.mint(taker, 200 ether);
        vm.startPrank(taker);
        inputToken.approve(address(vault), 200 ether);
        vault.deposit(address(inputToken), 200 ether);
        vm.stopPrank();
    }

    function testERC1271MakerCanProvideLiquidity() public {
        FxTypes.MakerOrder memory order = FxTypes.MakerOrder({
            maker: address(makerWallet),
            sellToken: address(outputToken),
            buyToken: address(inputToken),
            sellAmount: 50 ether,
            buyAmount: 100 ether,
            recipient: address(makerWallet),
            validAfter: 0,
            validUntil: type(uint64).max,
            epoch: 1,
            salt: keccak256("institutional-maker")
        });

        bytes32 makerDigest = settlement.hashMakerOrder(order);
        makerWallet.approveDigest(makerDigest);

        FxTypes.MakerFill[] memory fills = new FxTypes.MakerFill[](1);
        fills[0] =
            FxTypes.MakerFill({ order: order, signature: hex"01", makerSellAmount: 50 ether });

        bytes32 policyHash = keccak256("policy-erc1271-valid");
        policyRegistry.authorize(policyHash, type(uint64).max, 1);
        FxTypes.TakerIntent memory intent = FxTypes.TakerIntent({
            taker: taker,
            inputToken: address(inputToken),
            outputToken: address(outputToken),
            maxInput: 100 ether,
            minOutput: 50 ether,
            recipient: recipient,
            deadline: type(uint64).max,
            nonce: 1,
            policyAuthorizationHash: policyHash
        });

        bytes32 takerDigest = router.hashTakerIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TAKER_PK, takerDigest);
        bytes memory takerSignature = abi.encodePacked(r, s, v);

        router.execute(intent, takerSignature, fills);

        require(vault.balanceOf(address(outputToken), recipient) == 50 ether, "recipient output");
        require(
            vault.balanceOf(address(inputToken), address(makerWallet)) == 100 ether,
            "institution maker not paid"
        );
    }

    function testUnapprovedERC1271DigestIsRejected() public {
        FxTypes.MakerOrder memory order = FxTypes.MakerOrder({
            maker: address(makerWallet),
            sellToken: address(outputToken),
            buyToken: address(inputToken),
            sellAmount: 50 ether,
            buyAmount: 100 ether,
            recipient: address(makerWallet),
            validAfter: 0,
            validUntil: type(uint64).max,
            epoch: 1,
            salt: keccak256("unapproved-maker")
        });

        FxTypes.MakerFill[] memory fills = new FxTypes.MakerFill[](1);
        fills[0] =
            FxTypes.MakerFill({ order: order, signature: hex"01", makerSellAmount: 50 ether });

        bytes32 policyHash = keccak256("policy-erc1271-rejected");
        policyRegistry.authorize(policyHash, type(uint64).max, 1);
        FxTypes.TakerIntent memory intent = FxTypes.TakerIntent({
            taker: taker,
            inputToken: address(inputToken),
            outputToken: address(outputToken),
            maxInput: 100 ether,
            minOutput: 50 ether,
            recipient: recipient,
            deadline: type(uint64).max,
            nonce: 2,
            policyAuthorizationHash: policyHash
        });

        bytes32 takerDigest = router.hashTakerIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TAKER_PK, takerDigest);
        bytes memory takerSignature = abi.encodePacked(r, s, v);

        bool reverted;
        try router.execute(intent, takerSignature, fills) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "unapproved contract-wallet signature accepted");
        require(!router.usedNonce(taker, 2), "nonce survived reverted route");
    }
}
