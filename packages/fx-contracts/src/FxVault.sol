// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { IERC20Minimal } from "./interfaces/IERC20Minimal.sol";

/// @title Blueballs FX Vault
/// @notice Segregated token accounting for the FX settlement kernel.
/// @dev Settlement may only reassign accounted balances. Only account owners withdraw physical tokens.
contract FxVault {
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
    /// @dev The owner may slow withdrawals for incident response but must never be able to
    ///      stop them. Without this bound `setWithdrawDelayBlocks(type(uint64).max)` would
    ///      mean no request can ever mature, which is a freeze on user funds however it is
    ///      described — the vault would be non-custodial in name only, and that same control
    ///      is what makes an operator an intermediary rather than a protocol.
    uint64 public constant MAX_WITHDRAW_DELAY_BLOCKS = 50_400;

    /// @notice Blocks that must pass between requesting and executing a user withdrawal.
    /// @dev Zero means immediate withdrawal (FX-1 default). A deployment that custodies
    ///      material value can require a delay so a compromised key cannot drain the
    ///      account before the real owner (or a monitoring system) reacts. The delay never
    ///      applies to settlement `move`, so it does not affect on-chain trade atomicity,
    ///      and it is capped so it can never become a withdrawal freeze.
    uint64 public withdrawDelayBlocks;

    /// @dev Stores the block the request was FILED, never a precomputed maturity block.
    ///      Maturity is evaluated against the delay in force at execution time, so raising
    ///      the delay during an incident also extends every request already pending.
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
    /// @dev One-time operation. There is deliberately no settlement upgrade path in FX-1.
    function bindSettlement(address settlement_) external onlyOwner {
        if (settlement_ == address(0)) revert ZeroAddress();
        if (settlement != address(0)) revert SettlementAlreadySet();
        settlement = settlement_;
        emit SettlementBound(settlement_);
    }

    /// @notice Configure the withdrawal delay in blocks.
    /// @dev Only affects the user withdrawal path; it never touches settlement `move`.
    ///      A change applies to pending requests as well as new ones, because maturity is
    ///      measured from each request's block against the current delay. Raising the delay
    ///      therefore also defers requests already filed — deliberate, so that an attacker
    ///      who pre-files a request under a short delay cannot outrun an incident response.
    ///      Bounded by MAX_WITHDRAW_DELAY_BLOCKS so the same lever can never freeze funds.
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

    /// @notice Request a future withdrawal when a delay is configured.
    /// @dev A pending request does not lock the balance; it only starts the clock. The
    ///      balance is checked and debited at execution, so a request can never make the
    ///      vault insolvent, and settlement `move` continues to work against the balance.
    function requestWithdraw(address token, uint256 amount, address recipient) external {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // A request must be backed by balance when it is FILED. Without this an account
        // could pre-file while holding nothing, serve the delay once, and thereafter
        // deposit and withdraw instantly — the delay would never apply to the funds.
        if (_balances[token][msg.sender] < amount) revert InsufficientBalance();

        PendingWithdrawal memory current = pendingWithdrawal[token][msg.sender];
        if (current.amount != 0 && !_requestExpired(current)) revert WithdrawAlreadyPending();

        pendingWithdrawal[token][msg.sender] =
            PendingWithdrawal({ amount: amount, recipient: recipient, requestBlock: block.number });

        emit WithdrawRequested(token, msg.sender, recipient, amount, block.number);
    }

    /// @notice Cancel a pending withdrawal request. This is the react-to-compromise primitive.
    function cancelWithdraw(address token) external {
        if (pendingWithdrawal[token][msg.sender].amount == 0) revert WithdrawNotRequested();
        delete pendingWithdrawal[token][msg.sender];
        emit WithdrawCancelled(token, msg.sender);
    }

    /// @notice Withdraw accounted balance to a chosen recipient.
    /// @dev When `withdrawDelayBlocks` is zero the withdrawal is immediate (FX-1 behaviour).
    ///      When a delay is configured, a matured `requestWithdraw` matching these exact
    ///      params must exist first.
    function withdraw(address token, uint256 amount, address recipient) external {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        PendingWithdrawal memory req = pendingWithdrawal[token][msg.sender];

        if (withdrawDelayBlocks != 0) {
            if (req.amount == 0) revert WithdrawNotRequested();
            if (req.amount != amount || req.recipient != recipient) revert WithdrawParamsMismatch();
            // Maturity is measured against the CURRENT delay, not one frozen at request
            // time: otherwise a request filed under a short delay stays executable after
            // the owner raises it, which is exactly when the delay needs to bite.
            if (block.number < req.requestBlock + withdrawDelayBlocks) revert WithdrawNotMatured();
            // A matured request is not a standing licence to withdraw instantly forever.
            if (_requestExpired(req)) revert WithdrawRequestExpired();
        }

        // Always consume any request, including on the immediate (delay == 0) path, so a
        // stale entry can neither block future requests nor survive into a later delay.
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
    function rescueSurplus(address token, uint256 amount, address recipient) external onlyOwner {
        if (!isSupportedToken[token]) revert UnsupportedToken();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > surplus(token)) revert RescueExceedsSurplus();

        if (!IERC20Minimal(token).transfer(recipient, amount)) revert TransferFailed();
        _assertSolvent(token);

        emit SurplusRescued(token, recipient, amount);
    }

    /// @notice A request stays valid for one further delay period after it matures.
    /// @dev Mirrors the two-window design used by production vaults: a request that is
    ///      never executed goes stale rather than remaining executable indefinitely.
    function _requestExpired(PendingWithdrawal memory req) internal view returns (bool) {
        if (withdrawDelayBlocks == 0) return false;
        return block.number > req.requestBlock + (uint256(withdrawDelayBlocks) * 2);
    }

    function _assertSolvent(address token) internal view {
        if (physicalBalance(token) < totalLiabilities[token]) revert Insolvent();
    }
}
