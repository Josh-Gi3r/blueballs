// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { FxTypes } from "./FxTypes.sol";
import { FxSettlement } from "./FxSettlement.sol";

/// @title Blueballs FX Atomic Router
/// @notice Executes one signed taker intent across one or more signed maker orders atomically.
contract AtomicRouter is EIP712, ReentrancyGuard {
    error ZeroAddress();
    error InvalidIntent();
    error IntentExpired();
    error InvalidTakerSignature();
    error NonceAlreadyUsed();
    error EmptyRoute();
    error WrongAssetPair();
    error MaxInputExceeded();
    error MinOutputNotMet();

    event RouteExecuted(
        bytes32 indexed intentHash,
        address indexed taker,
        address indexed recipient,
        address inputToken,
        address outputToken,
        uint256 totalInput,
        uint256 totalOutput,
        uint256 fillCount,
        bytes32 policyAuthorizationHash
    );

    bytes32 public constant TAKER_INTENT_TYPEHASH = keccak256(
        "TakerIntent(address taker,address inputToken,address outputToken,uint256 maxInput,uint256 minOutput,address recipient,uint64 deadline,uint256 nonce,bytes32 policyAuthorizationHash)"
    );

    FxSettlement public immutable settlement;
    mapping(address taker => mapping(uint256 nonce => bool used)) public usedNonce;

    constructor(FxSettlement settlement_) EIP712("Blueballs FX Router", "1") {
        if (address(settlement_) == address(0)) revert ZeroAddress();
        settlement = settlement_;
    }

    function hashTakerIntent(FxTypes.TakerIntent calldata intent) public view returns (bytes32) {
        return _hashTypedDataV4(_hashTakerIntentStruct(intent));
    }

    /// @notice Execute a route. Anyone may submit it; only the taker's valid signature grants authority.
    /// @dev Every external state change rolls back if final max-input/min-output checks fail.
    function execute(
        FxTypes.TakerIntent calldata intent,
        bytes calldata takerSignature,
        FxTypes.MakerFill[] calldata fills
    ) external nonReentrant returns (uint256 totalInput, uint256 totalOutput) {
        _validateIntent(intent);
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (fills.length == 0) revert EmptyRoute();
        if (usedNonce[intent.taker][intent.nonce]) revert NonceAlreadyUsed();

        bytes32 intentHash = hashTakerIntent(intent);
        if (!SignatureChecker.isValidSignatureNowCalldata(intent.taker, intentHash, takerSignature))
        {
            revert InvalidTakerSignature();
        }

        // Mark before external calls. A later revert rolls this state back with the entire route.
        usedNonce[intent.taker][intent.nonce] = true;

        uint256 length = fills.length;
        for (uint256 i; i < length; ++i) {
            (uint256 takerPay, uint256 makerOutput) = _settleFill(intent, fills[i], intentHash);
            totalInput += takerPay;
            totalOutput += makerOutput;
            if (totalInput > intent.maxInput) revert MaxInputExceeded();
        }

        if (totalOutput < intent.minOutput) revert MinOutputNotMet();
        _emitRouteExecuted(intent, intentHash, totalInput, totalOutput, length);
    }

    function _settleFill(
        FxTypes.TakerIntent calldata intent,
        FxTypes.MakerFill calldata fill,
        bytes32 intentHash
    ) internal returns (uint256 takerPay, uint256 makerOutput) {
        if (
            fill.order.sellToken != intent.outputToken
                || fill.order.buyToken != intent.inputToken
        ) revert WrongAssetPair();

        takerPay = settlement.fillMakerOrder(
            fill.order,
            fill.signature,
            fill.makerSellAmount,
            intent.taker,
            intent.recipient,
            intentHash
        );
        makerOutput = fill.makerSellAmount;
    }

    function _emitRouteExecuted(
        FxTypes.TakerIntent calldata intent,
        bytes32 intentHash,
        uint256 totalInput,
        uint256 totalOutput,
        uint256 fillCount
    ) internal {
        emit RouteExecuted(
            intentHash,
            intent.taker,
            intent.recipient,
            intent.inputToken,
            intent.outputToken,
            totalInput,
            totalOutput,
            fillCount,
            intent.policyAuthorizationHash
        );
    }

    function _validateIntent(FxTypes.TakerIntent calldata intent) internal pure {
        if (
            intent.taker == address(0) || intent.inputToken == address(0)
                || intent.outputToken == address(0) || intent.recipient == address(0)
        ) revert ZeroAddress();
        if (
            intent.inputToken == intent.outputToken || intent.maxInput == 0 || intent.minOutput == 0
                || intent.deadline == 0
        ) revert InvalidIntent();
    }

    function _hashTakerIntentStruct(FxTypes.TakerIntent calldata intent)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                TAKER_INTENT_TYPEHASH,
                intent.taker,
                intent.inputToken,
                intent.outputToken,
                intent.maxInput,
                intent.minOutput,
                intent.recipient,
                intent.deadline,
                intent.nonce,
                intent.policyAuthorizationHash
            )
        );
    }
}
