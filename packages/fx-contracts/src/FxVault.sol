// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { IERC20Minimal } from "./interfaces/IERC20Minimal.sol";

/// @title Blueballs FX Vault
/// @notice Segregated token accounting for the FX settlement kernel.
/// @dev Settlement may only reassign accounted balances. Only account owners withdraw physical tokens.
contract FxVault {
    error NotOwner();
    error NotSettlement();
    error UnsupportedToken();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    error InsufficientBalance();
    error Insolvent();
    error RescueExceedsSurplus();

    event Deposited(address indexed token, address indexed account, uint256 amount);
    event Withdrawn(
        address indexed token, address indexed account, address indexed recipient, uint256 amount
    );
    event BalanceMoved(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 settlementRef
    );
    event SurplusRescued(address indexed token, address indexed recipient, uint256 amount);

    address public immutable owner;
    address public immutable settlement;

    mapping(address token => bool supported) public isSupportedToken;
    mapping(address token => mapping(address account => uint256 amount)) private _balances;
    mapping(address token => uint256 amount) public totalLiabilities;

    constructor(address owner_, address settlement_, address[] memory supportedTokens_) {
        if (owner_ == address(0) || settlement_ == address(0)) revert ZeroAddress();
        owner = owner_;
        settlement = settlement_;

        uint256 length = supportedTokens_.length;
        for (uint256 i; i < length; ++i) {
            address token = supportedTokens_[i];
            if (token == address(0)) revert ZeroAddress();
            isSupportedToken[token] = true;
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySettlement() {
        if (msg.sender != settlement) revert NotSettlement();
        _;
    }

    function balanceOf(address token, address account) external view returns (uint256) {
        return _balances[token][account];
    }

    function physicalBalance(address token) public view returns (uint256) {
        return IERC20Minimal(token).balanceOf(address(this));
    }

    function surplus(address token) public view returns (uint256) {
        uint256 physical = physicalBalance(token);
        uint256 liabilities = totalLiabilities[token];
        return physical > liabilities ? physical - liabilities : 0;
    }

    /// @notice Deposit an allowlisted token and credit exactly the amount physically received.
    /// @dev Measuring the balance delta prevents unsupported transfer behaviour from creating unbacked credit.
    function deposit(address token, uint256 amount) external returns (uint256 credited) {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (amount == 0) revert ZeroAmount();

        uint256 beforeBalance = physicalBalance(token);
        if (!IERC20Minimal(token).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        uint256 afterBalance = physicalBalance(token);

        if (afterBalance <= beforeBalance) revert TransferFailed();
        credited = afterBalance - beforeBalance;

        _balances[token][msg.sender] += credited;
        totalLiabilities[token] += credited;
        _assertSolvent(token);

        emit Deposited(token, msg.sender, credited);
    }

    /// @notice Withdraw accounted balance to a chosen recipient.
    function withdraw(address token, uint256 amount, address recipient) external {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = _balances[token][msg.sender];
        if (available < amount) revert InsufficientBalance();

        unchecked {
            _balances[token][msg.sender] = available - amount;
            totalLiabilities[token] -= amount;
        }

        if (!IERC20Minimal(token).transfer(recipient, amount)) revert TransferFailed();
        _assertSolvent(token);

        emit Withdrawn(token, msg.sender, recipient, amount);
    }

    /// @notice Reassign already-accounted collateral during settlement.
    /// @dev This function never changes total token liabilities and never transfers physical tokens.
    function move(address token, address from, address to, uint256 amount, bytes32 settlementRef)
        external
        onlySettlement
    {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = _balances[token][from];
        if (available < amount) revert InsufficientBalance();

        unchecked {
            _balances[token][from] = available - amount;
        }
        _balances[token][to] += amount;

        _assertSolvent(token);
        emit BalanceMoved(token, from, to, amount, settlementRef);
    }

    /// @notice Recover only tokens physically held above all recorded user liabilities.
    /// @dev Accounted participant funds are mathematically excluded from this path.
    function rescueSurplus(address token, uint256 amount, address recipient) external onlyOwner {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > surplus(token)) revert RescueExceedsSurplus();

        if (!IERC20Minimal(token).transfer(recipient, amount)) revert TransferFailed();
        _assertSolvent(token);

        emit SurplusRescued(token, recipient, amount);
    }

    function _assertSolvent(address token) internal view {
        if (physicalBalance(token) < totalLiabilities[token]) revert Insolvent();
    }
}
