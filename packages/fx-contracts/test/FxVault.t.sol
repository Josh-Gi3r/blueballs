// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FxVault} from "../src/FxVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SettlementHarness {
    FxVault public vault;

    function setVault(FxVault vault_) external {
        require(address(vault) == address(0), "SET");
        vault = vault_;
    }

    function move(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes32 settlementRef
    ) external {
        vault.move(token, from, to, amount, settlementRef);
    }
}

contract VaultActor {
    function approve(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function deposit(FxVault vault, address token, uint256 amount) external {
        vault.deposit(token, amount);
    }

    function withdraw(FxVault vault, address token, uint256 amount, address recipient) external {
        vault.withdraw(token, amount, recipient);
    }
}

contract FxVaultTest {
    MockERC20 internal token;
    SettlementHarness internal settlement;
    FxVault internal vault;
    VaultActor internal alice;
    VaultActor internal bob;

    constructor() {
        token = new MockERC20();
        settlement = new SettlementHarness();

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        vault = new FxVault(address(this), address(settlement), tokens);
        settlement.setVault(vault);

        alice = new VaultActor();
        bob = new VaultActor();
    }

    function testDepositCreatesExactlyBackedLiability() public {
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);

        require(vault.balanceOf(address(token), address(alice)) == 100 ether, "alice ledger");
        require(vault.totalLiabilities(address(token)) == 100 ether, "liabilities");
        require(vault.physicalBalance(address(token)) == 100 ether, "physical");
        require(vault.surplus(address(token)) == 0, "surplus");
    }

    function testSettlementMoveCannotCreateOrDestroyLiability() public {
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);

        settlement.move(address(token), address(alice), address(bob), 35 ether, keccak256("fill-1"));

        require(vault.balanceOf(address(token), address(alice)) == 65 ether, "alice after");
        require(vault.balanceOf(address(token), address(bob)) == 35 ether, "bob after");
        require(vault.totalLiabilities(address(token)) == 100 ether, "liability changed");
        require(vault.physicalBalance(address(token)) == 100 ether, "physical changed");
    }

    function testRecipientCanWithdrawMovedBalance() public {
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);
        settlement.move(address(token), address(alice), address(bob), 40 ether, keccak256("fill-2"));

        bob.withdraw(vault, address(token), 40 ether, address(bob));

        require(vault.balanceOf(address(token), address(bob)) == 0, "bob ledger");
        require(token.balanceOf(address(bob)) == 40 ether, "bob token");
        require(vault.totalLiabilities(address(token)) == 60 ether, "liabilities");
        require(vault.physicalBalance(address(token)) == 60 ether, "physical");
    }

    function testAdminCannotRescueAccountedFunds() public {
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);

        bool reverted;
        try vault.rescueSurplus(address(token), 1, address(this)) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "rescue invaded liabilities");
    }

    function testAdminCanRescueOnlyTrueSurplus() public {
        token.mint(address(alice), 100 ether);
        alice.approve(token, address(vault), 100 ether);
        alice.deposit(vault, address(token), 100 ether);

        token.mint(address(vault), 7 ether);
        require(vault.surplus(address(token)) == 7 ether, "expected surplus");

        vault.rescueSurplus(address(token), 7 ether, address(this));

        require(vault.surplus(address(token)) == 0, "surplus remains");
        require(vault.totalLiabilities(address(token)) == 100 ether, "liabilities changed");
        require(vault.physicalBalance(address(token)) == 100 ether, "backing changed");
    }

    function testUnauthorizedCallerCannotMoveBalances() public {
        token.mint(address(alice), 10 ether);
        alice.approve(token, address(vault), 10 ether);
        alice.deposit(vault, address(token), 10 ether);

        bool reverted;
        try vault.move(address(token), address(alice), address(bob), 1 ether, bytes32(0)) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "unauthorized move succeeded");
    }

    function testFuzzDepositWithdrawPreservesSolvency(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount);
        if (amount == 0) return;

        VaultActor actor = new VaultActor();
        token.mint(address(actor), amount);
        actor.approve(token, address(vault), amount);
        actor.deposit(vault, address(token), amount);

        uint256 withdrawAmount = amount / 2;
        if (withdrawAmount != 0) {
            actor.withdraw(vault, address(token), withdrawAmount, address(actor));
        }

        require(
            vault.physicalBalance(address(token)) >= vault.totalLiabilities(address(token)),
            "vault insolvent"
        );
    }
}
