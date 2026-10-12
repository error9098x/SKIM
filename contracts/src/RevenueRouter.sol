// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SkimVault} from "./SkimVault.sol";

/// @title RevenueRouter
/// @notice The payment endpoint for a machine's customers (e.g. EV charging sessions).
///         While the machine has an active SKIM loan, a `skimBps` share of every payment is sent to
///         SkimVault.repay and the rest is forwarded to the loan's machine wallet. With no loan,
///         everything is forwarded. Each payment emits RevenueRouted, which the keeper turns into a
///         trust-level-1 revenue event on peaq citing this transaction's hash.
contract RevenueRouter is ReentrancyGuard {
    SkimVault public immutable vault;

    event RevenueRouted(
        uint256 indexed machineId,
        address indexed payer,
        bytes32 indexed sessionId,
        uint256 amount,
        uint256 skimmed,
        uint256 forwarded
    );

    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();

    constructor(SkimVault vault_) {
        if (address(vault_) == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    /// @param machineWallet used only when there is no active loan; otherwise the loan's wallet is used.
    function pay(uint256 machineId, address payable machineWallet, bytes32 sessionId) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        uint256 skimmed;
        address payable wallet = machineWallet;

        if (vault.isActive(machineId)) {
            wallet = vault.machineWalletOf(machineId);
            skimmed = (msg.value * vault.skimBpsOf(machineId)) / 10_000;
            uint256 outstanding = vault.outstandingOf(machineId);
            if (skimmed > outstanding) skimmed = outstanding; // never over-skim the final payment
            if (skimmed > 0) vault.repay{value: skimmed}(machineId);
        }
        if (wallet == address(0)) revert ZeroAddress();

        uint256 forwarded = msg.value - skimmed;
        emit RevenueRouted(machineId, msg.sender, sessionId, msg.value, skimmed, forwarded);

        if (forwarded > 0) {
            (bool ok,) = wallet.call{value: forwarded}("");
            if (!ok) revert TransferFailed();
        }
    }
}
