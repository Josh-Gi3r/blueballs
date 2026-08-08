// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { FxTypes } from "./FxTypes.sol";
import { FxVault } from "./FxVault.sol";
import { OrderCancellation } from "./OrderCancellation.sol";

/// @title Blueballs FX Maker Settlement
/// @notice Verifies signed off-chain maker orders and atomically reassigns pre-funded vault balances.
contract FxSettlement is EIP712, ReentrancyGuard {
    error NotOwner();
    error NotRouter();
    error RouterAlreadySet();
    error ZeroAddress();
    error InvalidOrder();
    error OrderNotActive();
    error InvalidMakerSignature();
    error OrderInvalidated();
    error ZeroFill();
    error FillExceedsOrder();

    event RouterBound(address indexed router);
    event MakerOrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makerSellAmount,
        uint256 takerPayAmount,
        uint256 cumulativeMakerSell,
        uint256 cumulativeMakerBuy,
        bytes32 settlementRef
    );

    bytes32 public constant MAKER_ORDER_TYPEHASH = keccak256(
        "MakerOrder(address maker,address sellToken,address buyToken,uint256 sellAmount,uint256 buyAmount,address recipient,uint64 validAfter,uint64 validUntil,uint64 epoch,bytes32 salt)"
    );

    address public immutable owner;
    FxVault public immutable vault;
    OrderCancellation public immutable cancellation;
    address public router;

    mapping(bytes32 orderHash => uint256 amount) public filledSellAmount;
    mapping(bytes32 orderHash => uint256 amount) public filledBuyAmount;

    constructor(address owner_, FxVault vault_, OrderCancellation cancellation_)
        EIP712("Blueballs FX", "1")
    {
        if (
            owner_ == address(0) || address(vault_) == address(0)
                || address(cancellation_) == address(0)
        ) {
            revert ZeroAddress();
        }
        owner = owner_;
        vault = vault_;
        cancellation = cancellation_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRouter() {
        if (msg.sender != router) revert NotRouter();
        _;
    }

    /// @notice Bind the sole atomic router allowed to submit fills.
    /// @dev One-time operation; no administrative router replacement exists in FX-1.
    function bindRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        if (router != address(0)) revert RouterAlreadySet();
        router = router_;
        emit RouterBound(router_);
    }

    function hashMakerOrder(FxTypes.MakerOrder calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(_hashMakerOrderStruct(order));
    }

    function remainingSellAmount(FxTypes.MakerOrder calldata order)
        external
        view
        returns (uint256)
    {
        bytes32 orderHash = hashMakerOrder(order);
        uint256 filled = filledSellAmount[orderHash];
        return filled >= order.sellAmount ? 0 : order.sellAmount - filled;
    }

    /// @notice Return the exact incremental taker payment required for the next partial fill.
    /// @dev Cumulative rounding ensures many tiny fills never accumulate more than the maker's signed full-order buy amount.
    function requiredTakerPay(FxTypes.MakerOrder calldata order, uint256 makerSellAmount)
        public
        view
        returns (uint256)
    {
        if (makerSellAmount == 0) revert ZeroFill();
        bytes32 orderHash = hashMakerOrder(order);
        uint256 oldSell = filledSellAmount[orderHash];
        uint256 newSell = oldSell + makerSellAmount;
        if (newSell > order.sellAmount) revert FillExceedsOrder();

        uint256 targetCumulativeBuy =
            Math.mulDiv(newSell, order.buyAmount, order.sellAmount, Math.Rounding.Ceil);
        uint256 oldBuy = filledBuyAmount[orderHash];
        return targetCumulativeBuy - oldBuy;
    }

    /// @notice Settle one maker leg for a route already authorised by the atomic router.
    function fillMakerOrder(
        FxTypes.MakerOrder calldata order,
        bytes calldata makerSignature,
        uint256 makerSellAmount,
        address taker,
        bytes32 settlementRef
    ) external onlyRouter nonReentrant returns (uint256 takerPayAmount) {
        _validateOrderShape(order, taker);
        if (block.timestamp < order.validAfter || block.timestamp > order.validUntil) {
            revert OrderNotActive();
        }

        bytes32 orderHash = hashMakerOrder(order);
        if (!SignatureChecker.isValidSignatureNowCalldata(order.maker, orderHash, makerSignature)) {
            revert InvalidMakerSignature();
        }
        if (cancellation.isInvalid(order.maker, orderHash, order.epoch)) revert OrderInvalidated();

        takerPayAmount = requiredTakerPay(order, makerSellAmount);

        uint256 newSell = filledSellAmount[orderHash] + makerSellAmount;
        uint256 newBuy = filledBuyAmount[orderHash] + takerPayAmount;
        filledSellAmount[orderHash] = newSell;
        filledBuyAmount[orderHash] = newBuy;

        vault.move(order.sellToken, order.maker, taker, makerSellAmount, settlementRef);
        if (takerPayAmount != 0) {
            vault.move(order.buyToken, taker, order.recipient, takerPayAmount, settlementRef);
        }

        emit MakerOrderFilled(
            orderHash,
            order.maker,
            taker,
            makerSellAmount,
            takerPayAmount,
            newSell,
            newBuy,
            settlementRef
        );
    }

    function _validateOrderShape(FxTypes.MakerOrder calldata order, address taker) internal pure {
        if (
            order.maker == address(0) || order.sellToken == address(0)
                || order.buyToken == address(0) || order.recipient == address(0)
                || taker == address(0)
        ) revert ZeroAddress();
        if (
            order.sellToken == order.buyToken || order.sellAmount == 0 || order.buyAmount == 0
                || order.validUntil < order.validAfter
        ) revert InvalidOrder();
    }

    function _hashMakerOrderStruct(FxTypes.MakerOrder calldata order)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                MAKER_ORDER_TYPEHASH,
                order.maker,
                order.sellToken,
                order.buyToken,
                order.sellAmount,
                order.buyAmount,
                order.recipient,
                order.validAfter,
                order.validUntil,
                order.epoch,
                order.salt
            )
        );
    }
}
