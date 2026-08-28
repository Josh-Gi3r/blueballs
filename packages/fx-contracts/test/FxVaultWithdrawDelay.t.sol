// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { FxVault } from "../src/FxVault.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

interface VmRoll {
    function roll(uint256 newBlock) external;
}

contract DelayActor {
    function approve(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function deposit(FxVault vault, address token, uint256 amount) external {
        vault.deposit(token, amount);
    }

    function requestWithdraw(FxVault vault, address token, uint256 amount, address recipient)
        external
    {
        vault.requestWithdraw(token, amount, recipient);
    }

    function cancelWithdraw(FxVault vault, address token) external {
        vault.cancelWithdraw(token);
    }

    function withdraw(FxVault vault, address token, uint256 amount, address recipient) external {
        vault.withdraw(token, amount, recipient);
    }

    function setDelay(FxVault vault, uint64 blocks_) external {
        vault.setWithdrawDelayBlocks(blocks_);
    }
}

/// @dev Proves the opt-in withdrawal delay: immediate when unset, gated by a matured
///      request when set, cancellable, and never able to break vault solvency.
contract FxVaultWithdrawDelayTest {
    VmRoll internal constant vm = VmRoll(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 internal token;
    FxVault internal vault;
    DelayActor internal alice;

    constructor() {
        token = new MockERC20();
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        vault = new FxVault(address(this), tokens);

        alice = new DelayActor();
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);
    }

    function _expectRevert(bytes memory call) internal returns (bool reverted) {
        (reverted,) = _try(call);
    }

    function _try(bytes memory call) internal returns (bool reverted, bytes memory ret) {
        (bool ok, bytes memory data) = address(alice).call(call);
        return (!ok, data);
    }

    function testDefaultDelayIsImmediate() public {
        require(vault.withdrawDelayBlocks() == 0, "default delay");
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(vault.balanceOf(address(token), address(alice)) == 60 ether, "immediate withdraw");
    }

    function testDelayedWithdrawRequiresMaturedRequest() public {
        vault.setWithdrawDelayBlocks(10);

        // direct withdraw without a request must fail
        bool reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(alice)
            )
        );
        require(reverted, "withdraw without request should revert");

        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));

        // too early
        reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(alice)
            )
        );
        require(reverted, "withdraw before maturity should revert");

        // mature and withdraw
        vm.roll(block.number + 10);
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(vault.balanceOf(address(token), address(alice)) == 60 ether, "matured withdraw");
        require(vault.physicalBalance(address(token)) == 60 ether, "physical after");
        require(
            vault.physicalBalance(address(token)) >= vault.totalLiabilities(address(token)),
            "solvency"
        );
    }

    function testCancelStopsTheWithdrawal() public {
        vault.setWithdrawDelayBlocks(10);
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));
        alice.cancelWithdraw(vault, address(token));

        vm.roll(block.number + 100);
        bool reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(alice)
            )
        );
        require(reverted, "cancelled request should not be executable");
        require(vault.balanceOf(address(token), address(alice)) == 100 ether, "balance intact");
    }

    function testWithdrawMustMatchRequestedParams() public {
        vault.setWithdrawDelayBlocks(5);
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));
        vm.roll(block.number + 5);

        // different amount than requested
        bool reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 41 ether, address(alice)
            )
        );
        require(reverted, "mismatched amount should revert");

        // different recipient than requested
        reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(this)
            )
        );
        require(reverted, "mismatched recipient should revert");

        // exact params succeed
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(
            vault.balanceOf(address(token), address(alice)) == 60 ether, "exact params withdraw"
        );
    }

    /// @dev Incident response: a request filed while the delay was short must NOT stay
    ///      executable after the owner raises the delay. Otherwise an attacker who
    ///      compromises a key pre-files a request and the delay protects nothing.
    function testRaisingDelayAppliesToPendingRequests() public {
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));

        // breach discovered -> owner raises the delay
        vault.setWithdrawDelayBlocks(1000);

        bool reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(alice)
            )
        );
        require(reverted, "pre-filed request must not bypass a raised delay");
        require(vault.balanceOf(address(token), address(alice)) == 100 ether, "funds drained");

        // and it becomes executable once the NEW delay has actually elapsed
        vm.roll(block.number + 1000);
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(
            vault.balanceOf(address(token), address(alice)) == 60 ether, "matured under new delay"
        );
    }

    /// @dev An immediate (delay==0) withdrawal must consume its request, or the stale
    ///      entry blocks every future request and survives into a later delay regime.
    function testImmediateWithdrawConsumesPendingRequest() public {
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));
        alice.withdraw(vault, address(token), 40 ether, address(alice));

        (uint256 amt,,) = vault.pendingWithdrawal(address(token), address(alice));
        require(amt == 0, "stale pending request survived an immediate withdrawal");

        // a second request must therefore be possible
        alice.requestWithdraw(vault, address(token), 10 ether, address(alice));
    }

    /// @dev Pre-filing a request while holding nothing would let an account serve the
    ///      delay once and then deposit-and-withdraw instantly forever. The request must
    ///      be backed by balance when it is filed.
    function testCannotPreFileRequestWithoutBalance() public {
        vault.setWithdrawDelayBlocks(10);
        DelayActor mallory = new DelayActor(); // zero vault balance

        bool reverted;
        (bool ok,) = address(mallory).call(
            abi.encodeWithSelector(
                DelayActor.requestWithdraw.selector,
                vault,
                address(token),
                40 ether,
                address(mallory)
            )
        );
        reverted = !ok;
        require(reverted, "request without balance must revert");
    }

    /// @dev A matured request must not remain a standing instant-withdraw licence.
    function testStaleRequestExpires() public {
        vault.setWithdrawDelayBlocks(10);
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));

        // far beyond the request's validity window
        vm.roll(block.number + 10_000);

        bool reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.withdraw.selector, vault, address(token), 40 ether, address(alice)
            )
        );
        require(reverted, "stale matured request must expire");

        // the account can simply file a fresh request and wait again
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));
        vm.roll(block.number + 10);
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(vault.balanceOf(address(token), address(alice)) == 60 ether, "fresh request works");
    }

    /// @dev The delay is an incident-response lever, never a freeze. An owner must be able
    ///      to slow withdrawals and must NOT be able to stop them: without a ceiling,
    ///      setWithdrawDelayBlocks(type(uint64).max) would mean no request ever matures.
    function testOwnerCannotFreezeWithdrawalsWithAnUnboundedDelay() public {
        bool reverted = _expectRevert(
            abi.encodeWithSelector(DelayActor.setDelay.selector, vault, type(uint64).max)
        );
        require(reverted, "an unbounded delay must be rejected");
        require(vault.withdrawDelayBlocks() == 0, "delay unchanged after rejection");

        // one block over the ceiling is still rejected
        reverted = _expectRevert(
            abi.encodeWithSelector(
                DelayActor.setDelay.selector, vault, vault.MAX_WITHDRAW_DELAY_BLOCKS() + 1
            )
        );
        require(reverted, "delay above the ceiling must be rejected");

        // and at the ceiling the funds are still genuinely reachable
        uint64 maxDelay = vault.MAX_WITHDRAW_DELAY_BLOCKS();
        vault.setWithdrawDelayBlocks(maxDelay);
        alice.requestWithdraw(vault, address(token), 40 ether, address(alice));
        vm.roll(block.number + maxDelay);
        alice.withdraw(vault, address(token), 40 ether, address(alice));
        require(
            vault.balanceOf(address(token), address(alice)) == 60 ether,
            "funds reachable at the cap"
        );
    }

    function testOnlyOwnerSetsDelay() public {
        // alice is not the vault owner (the test contract is), so her setter call must revert
        bool reverted =
            _expectRevert(abi.encodeWithSelector(DelayActor.setDelay.selector, vault, uint64(5)));
        require(reverted, "non-owner set delay should revert");
        require(vault.withdrawDelayBlocks() == 0, "delay unchanged by non-owner");

        // the owner can set it
        vault.setWithdrawDelayBlocks(7);
        require(vault.withdrawDelayBlocks() == 7, "owner set delay");
    }
}
