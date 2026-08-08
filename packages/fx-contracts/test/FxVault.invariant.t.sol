// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import { FxVault } from "../src/FxVault.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { Vm } from "./utils/Vm.sol";

contract InvariantActor {
    function approve(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function deposit(FxVault vault, address token, uint256 amount) external {
        vault.deposit(token, amount);
    }

    function withdraw(FxVault vault, address token, uint256 amount) external {
        vault.withdraw(token, amount, address(this));
    }
}

contract VaultInvariantHandler {
    FxVault public immutable vault;
    MockERC20 public immutable token;

    InvariantActor[3] public actors;

    constructor(FxVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;
        actors[0] = new InvariantActor();
        actors[1] = new InvariantActor();
        actors[2] = new InvariantActor();
    }

    function deposit(uint8 actorSeed, uint96 rawAmount) external {
        uint256 amount = uint256(rawAmount);
        if (amount == 0) return;

        InvariantActor actor = actors[actorSeed % 3];
        token.mint(address(actor), amount);
        actor.approve(token, address(vault), amount);
        actor.deposit(vault, address(token), amount);
    }

    function withdraw(uint8 actorSeed, uint96 rawAmount) external {
        InvariantActor actor = actors[actorSeed % 3];
        uint256 balance = vault.balanceOf(address(token), address(actor));
        if (balance == 0) return;

        uint256 amount = (uint256(rawAmount) % balance) + 1;
        actor.withdraw(vault, address(token), amount);
    }

    function move(uint8 fromSeed, uint8 toSeed, uint96 rawAmount) external {
        uint256 fromIndex = uint256(fromSeed) % 3;
        uint256 toIndex = uint256(toSeed) % 3;
        if (fromIndex == toIndex) return;

        InvariantActor from = actors[fromIndex];
        InvariantActor to = actors[toIndex];
        uint256 balance = vault.balanceOf(address(token), address(from));
        if (balance == 0) return;

        uint256 amount = (uint256(rawAmount) % balance) + 1;
        vault.move(address(token), address(from), address(to), amount, keccak256("invariant-move"));
    }

    function actor(uint256 index) external view returns (address) {
        return address(actors[index]);
    }
}

contract FxVaultInvariantTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 internal token;
    FxVault internal vault;
    VaultInvariantHandler internal handler;

    function setUp() public {
        token = new MockERC20();
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vault = new FxVault(address(this), tokens);
        handler = new VaultInvariantHandler(vault, token);
        vault.bindSettlement(address(handler));

        vm.targetContract(address(handler));
    }

    function invariant_PhysicalBalanceAlwaysBacksLiabilities() public view {
        require(
            vault.physicalBalance(address(token)) >= vault.totalLiabilities(address(token)),
            "vault insolvent"
        );
    }

    function invariant_NoUntrackedSurplusIsCreatedByNormalOperations() public view {
        require(
            vault.physicalBalance(address(token)) == vault.totalLiabilities(address(token)),
            "normal operations created accounting drift"
        );
    }

    function invariant_ActorLedgerSumEqualsTotalLiabilities() public view {
        uint256 ledgerSum;
        for (uint256 i; i < 3; ++i) {
            ledgerSum += vault.balanceOf(address(token), handler.actor(i));
        }
        require(ledgerSum == vault.totalLiabilities(address(token)), "ledger sum mismatch");
    }
}
