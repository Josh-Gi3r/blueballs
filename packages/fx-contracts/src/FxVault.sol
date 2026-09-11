// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IERC20Minimal } from "./interfaces/IERC20Minimal.sol";

/// @title Blueballs FX Vault
/// @notice Segregated token accounting for the FX settlement kernel.
/// @dev Settlement may only reassign accounted balances. Only account owners withdraw physical tokens.
contract FxVault is ReentrancyGuard {
    error NotOwner();
    error NotSettlement();
    error SettlementAlreadySet();
    error UnsupportedToken();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    error InsufficientBalance();
    error Insolvent();
    error RescueExceedsSurplus();
    error WithdrawNotRequested();
    error WithdrawNotMatured();
    error WithdrawParamsMismatch();
    error WithdrawAlreadyPending();
    error WithdrawRequestExpired();
    error WithdrawDelayTooLong();

    event SettlementBound(address indexed settlement);
    event WithdrawDelaySet(uint64 previousBlocks, uint64 newBlocks);
    event Deposited(address indexed token, address indexed account, uint256 amount);
    /// @param requestBlock Block the request was filed. Maturity is this plus the delay in
    ///        force at execution, so consumers must not cache an absolute unlock height.
    event WithdrawRequested(
        address indexed token,
        address indexed account,
        address indexed recipient,
        uint256 amount,
        uint256 requestBlock
    );
    event WithdrawCancelled(address indexed token, address indexed account);
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
    address public settlement;

    /// @notice Hard ceiling on the withdrawal delay: ~7 days at 12s blocks.
    /// @dev Governance may slow withdrawals for incident response, but the bounded
    ///      ceiling keeps the control finite and observable.
    uint64 public constant MAX_WITHDRAW_DELAY_BLOCKS = 50_400;

    /// @notice Blocks that must pass between requesting and executing a user withdrawal.
    /// @dev Zero means immediate withdrawal. The delay never applies to settlement
    ///      `move`, so token-route atomicity is independent of the withdrawal control.
    uint64 public withdrawDelayBlocks;

    /// @dev Stores the block the request was filed. Maturity is evaluated against
    ///      the delay in force at execution time so incident-response changes apply
    ///      consistently to already-pending requests.
    struct PendingWithdrawal {
        uint256 amount;
        address recipient;
        uint256 requestBlock;
    }

    mapping(address token => bool supported) public isSupportedToken;
    mapping(address token => mapping(address account => uint256 amount)) private _balances;
    mapping(address token => uint256 amount) public totalLiabilities;
    mapping(address token => mapping(address account => PendingWithdrawal request)) public
        pendingWithdrawal;

    constructor(address owner_, address[] memory supportedTokens_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;

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

    /// @notice Bind the only contract allowed to reassign ledger balances.
    /// @dev One-time operation. Core settlement authority is immutable after binding.
    function bindSettlement(address settlement_) external onlyOwner {
        if (settlement_ == address(0)) revert ZeroAddress();
        if (settlement != address(0)) revert SettlementAlreadySet();
        settlement = settlement_;
        emit SettlementBound(settlement_);
    }

    /// @notice Configure the bounded withdrawal delay in blocks.
    /// @dev Only affects participant withdrawals; settlement `move()` is unaffected.
    function setWithdrawDelayBlocks(uint64 blocks_) external onlyOwner {
        if (blocks_ > MAX_WITHDRAW_DELAY_BLOCKS) revert WithdrawDelayTooLong();
        emit WithdrawDelaySet(withdrawDelayBlocks, blocks_);
        withdrawDelayBlocks = blocks_;
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
    /// @dev Balance-delta accounting prevents transfer-fee behavior from creating unbacked credit.
    function deposit(address token, uint256 amount) external nonReentrant returns (uint256 credited) {
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

    /// @notice Request a future withdrawal when a delay is configured.
    /// @dev A pending request starts the clock but does not lock settlement balance.
    function requestWithdraw(address token, uint256 amount, address recipient) external {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (_balances[token][msg.sender] < amount) revert InsufficientBalance();

        PendingWithdrawal memory current = pendingWithdrawal[token][msg.sender];
        if (current.amount != 0 && !_requestExpired(current)) revert WithdrawAlreadyPending();

        pendingWithdrawal[token][msg.sender] =
            PendingWithdrawal({ amount: amount, recipient: recipient, requestBlock: block.number });

        emit WithdrawRequested(token, msg.sender, recipient, amount, block.number);
    }

    /// @notice Cancel a pending withdrawal request.
    function cancelWithdraw(address token) external {
        if (pendingWithdrawal[token][msg.sender].amount == 0) revert WithdrawNotRequested();
        delete pendingWithdrawal[token][msg.sender];
        emit WithdrawCancelled(token, msg.sender);
    }

    /// @notice Withdraw accounted balance to a chosen recipient.
    /// @dev A configured delay requires a matching matured request.
    function withdraw(address token, uint256 amount, address recipient) external nonReentrant {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        PendingWithdrawal memory req = pendingWithdrawal[token][msg.sender];

        if (withdrawDelayBlocks != 0) {
            if (req.amount == 0) revert WithdrawNotRequested();
            if (req.amount != amount || req.recipient != recipient) revert WithdrawParamsMismatch();
            if (block.number < req.requestBlock + withdrawDelayBlocks) revert WithdrawNotMatured();
            if (_requestExpired(req)) revert WithdrawRequestExpired();
        }

        if (req.amount != 0) delete pendingWithdrawal[token][msg.sender];

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
    function rescueSurplus(address token, uint256 amount, address recipient)
        external
        onlyOwner
        nonReentrant
    {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > surplus(token)) revert RescueExceedsSurplus();

        if (!IERC20Minimal(token).transfer(recipient, amount)) revert TransferFailed();
        _assertSolvent(token);

        emit SurplusRescued(token, recipient, amount);
    }

    /// @notice A request stays valid for one further delay period after it matures.
    function _requestExpired(PendingWithdrawal memory req) internal view returns (bool) {
        if (withdrawDelayBlocks == 0) return false;
        return block.number > req.requestBlock + (uint256(withdrawDelayBlocks) * 2);
    }

    function _assertSolvent(address token) internal view {
        if (physicalBalance(token) < totalLiabilities[token]) revert Insolvent();
    }
}
