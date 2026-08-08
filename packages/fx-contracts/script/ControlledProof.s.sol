// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { Script } from "forge-std/Script.sol";

import { AtomicRouter } from "../src/AtomicRouter.sol";
import { FxSettlement } from "../src/FxSettlement.sol";
import { FxTypes } from "../src/FxTypes.sol";
import { FxVault } from "../src/FxVault.sol";
import { OrderCancellation } from "../src/OrderCancellation.sol";
import { PolicyAuthorizationRegistry } from "../src/PolicyAuthorizationRegistry.sol";

contract ProofToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
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

contract ControlledProof is Script {
    uint256 internal constant MAKER_SELL = 100 ether;
    uint256 internal constant MAKER_BUY = 200 ether;

    uint256 internal ownerKey;
    uint256 internal makerKey;
    uint256 internal takerKey;
    address internal owner;
    address internal maker;
    address internal taker;

    ProofToken internal inputToken;
    ProofToken internal outputToken;
    FxVault internal vault;
    OrderCancellation internal cancellation;
    FxSettlement internal settlement;
    PolicyAuthorizationRegistry internal policyRegistry;
    AtomicRouter internal router;

    function run() external {
        _loadActors();
        _deployKernel();
        _depositLiquidity();
        _executeSignedRoute();
        _assertPostState();
    }

    function _loadActors() internal {
        ownerKey = vm.envUint("OWNER_KEY");
        makerKey = vm.envUint("MAKER_KEY");
        takerKey = vm.envUint("TAKER_KEY");
        owner = vm.addr(ownerKey);
        maker = vm.addr(makerKey);
        taker = vm.addr(takerKey);
    }

    function _deployKernel() internal {
        vm.startBroadcast(ownerKey);
        inputToken = new ProofToken("Proof USD", "pUSD");
        outputToken = new ProofToken("Proof EUR", "pEUR");
        inputToken.mint(taker, 1_000 ether);
        outputToken.mint(maker, 1_000 ether);

        address[] memory supported = new address[](2);
        supported[0] = address(inputToken);
        supported[1] = address(outputToken);
        vault = new FxVault(owner, supported);
        cancellation = new OrderCancellation();
        settlement = new FxSettlement(owner, vault, cancellation);
        policyRegistry = new PolicyAuthorizationRegistry(owner);
        router = new AtomicRouter(settlement, policyRegistry);
        vault.bindSettlement(address(settlement));
        settlement.bindRouter(address(router));
        vm.stopBroadcast();
    }

    function _depositLiquidity() internal {
        vm.startBroadcast(makerKey);
        outputToken.approve(address(vault), 1_000 ether);
        vault.deposit(address(outputToken), 1_000 ether);
        vm.stopBroadcast();

        vm.startBroadcast(takerKey);
        inputToken.approve(address(vault), 1_000 ether);
        vault.deposit(address(inputToken), 1_000 ether);
        vm.stopBroadcast();
    }

    function _executeSignedRoute() internal {
        FxTypes.MakerOrder memory order = _makerOrder();
        bytes memory makerSignature = _sign(makerKey, settlement.hashMakerOrder(order));
        FxTypes.TakerIntent memory intent = _takerIntent();
        bytes memory takerSignature = _sign(takerKey, router.hashTakerIntent(intent));

        FxTypes.MakerFill[] memory fills = new FxTypes.MakerFill[](1);
        fills[0] = FxTypes.MakerFill({
            order: order, signature: makerSignature, makerSellAmount: MAKER_SELL
        });

        vm.startBroadcast(ownerKey);
        policyRegistry.authorize(
            intent.policyAuthorizationHash, uint64(block.timestamp + 1 days), 1
        );
        (uint256 totalInput, uint256 totalOutput) = router.execute(intent, takerSignature, fills);
        vm.stopBroadcast();
        require(totalInput == MAKER_BUY, "wrong total input");
        require(totalOutput == MAKER_SELL, "wrong total output");
    }

    function _makerOrder() internal view returns (FxTypes.MakerOrder memory) {
        return FxTypes.MakerOrder({
            maker: maker,
            sellToken: address(outputToken),
            buyToken: address(inputToken),
            sellAmount: MAKER_SELL,
            buyAmount: MAKER_BUY,
            recipient: maker,
            validAfter: uint64(block.timestamp - 1),
            validUntil: uint64(block.timestamp + 1 days),
            epoch: 1,
            salt: keccak256("controlled-proof-maker")
        });
    }

    function _takerIntent() internal view returns (FxTypes.TakerIntent memory) {
        return FxTypes.TakerIntent({
            taker: taker,
            inputToken: address(inputToken),
            outputToken: address(outputToken),
            maxInput: MAKER_BUY,
            minOutput: MAKER_SELL,
            recipient: taker,
            deadline: uint64(block.timestamp + 1 days),
            nonce: 1,
            policyAuthorizationHash: keccak256("controlled-proof-policy")
        });
    }

    function _assertPostState() internal view {
        require(vault.balanceOf(address(inputToken), maker) == MAKER_BUY, "maker input missing");
        require(vault.balanceOf(address(outputToken), taker) == MAKER_SELL, "taker output missing");
        require(vault.balanceOf(address(inputToken), taker) == 800 ether, "taker input wrong");
        require(vault.balanceOf(address(outputToken), maker) == 900 ether, "maker output wrong");
        require(
            vault.totalLiabilities(address(inputToken)) == 1_000 ether, "input liabilities changed"
        );
        require(
            vault.totalLiabilities(address(outputToken)) == 1_000 ether,
            "output liabilities changed"
        );
        require(vault.physicalBalance(address(inputToken)) == 1_000 ether, "input backing wrong");
        require(vault.physicalBalance(address(outputToken)) == 1_000 ether, "output backing wrong");
        require(router.usedNonce(taker, 1), "taker nonce not consumed");
    }

    function _sign(uint256 privateKey, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
