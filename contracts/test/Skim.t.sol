// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MCROracle} from "../src/MCROracle.sol";
import {SkimVault} from "../src/SkimVault.sol";
import {RevenueRouter} from "../src/RevenueRouter.sol";
import {MockMachineNFT} from "../src/MockMachineNFT.sol";
import {MockEventRegistry} from "../src/MockEventRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Machine wallet that re-enters the router when it receives funds.
contract ReenteringWallet {
    RevenueRouter public router;
    uint256 public machineId;
    bool public armed;

    constructor(RevenueRouter r, uint256 id) {
        router = r;
        machineId = id;
    }

    function arm() external {
        armed = true;
    }

    receive() external payable {
        if (armed) {
            armed = false;
            router.pay{value: msg.value}(machineId, payable(address(this)), bytes32("reenter"));
        }
    }
}

/// Machine wallet that re-enters vault.repay when it gets a refund/forward.
contract RepayReenterWallet {
    SkimVault public vault;
    uint256 public machineId;
    bool public armed;

    constructor(SkimVault v, uint256 id) {
        vault = v;
        machineId = id;
    }

    function arm() external {
        armed = true;
    }

    receive() external payable {
        if (armed) {
            armed = false;
            vault.repay{value: msg.value}(machineId);
        }
    }
}

contract RejectingWallet {
    receive() external payable {
        revert("no");
    }
}

contract SkimTest is Test {
    MCROracle oracle;
    SkimVault vault;
    RevenueRouter router;
    MockMachineNFT nft;
    MockEventRegistry registry;

    address keeper = makeAddr("keeper");
    address lender = makeAddr("lender");
    address operator = makeAddr("operator"); // borrower / NFT owner
    address payable machineWallet = payable(makeAddr("machineWallet"));
    address customer = makeAddr("customer");
    address stranger = makeAddr("stranger");

    uint256 constant ID = 108934426058480933785963234320575706003575332367737915173645220784539698794848;
    uint64 constant TERM = 30 days;

    function setUp() public {
        oracle = new MCROracle(keeper);
        nft = new MockMachineNFT();
        vault = new SkimVault(nft, oracle);
        router = new RevenueRouter(vault);
        registry = new MockEventRegistry();

        vm.deal(lender, 1000 ether);
        vm.deal(customer, 1000 ether);
        vm.prank(lender);
        vault.deposit{value: 100 ether}();

        nft.mint(operator, ID);
    }

    function _open() internal {
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vault.openLoan(ID, machineWallet, TERM);
        vm.stopPrank();
    }

    function _pay(uint256 amount, bytes32 session) internal {
        vm.prank(customer);
        router.pay{value: amount}(ID, machineWallet, session);
    }

    // ------------------------------------------------------------ oracle
    function test_oracle_postAndGet() public {
        vm.prank(keeper);
        vm.expectEmit(true, false, false, true);
        emit MCROracle.RatingPosted(ID, 72, 4, true);
        oracle.post(ID, 72, 4, true);
        MCROracle.Rating memory r = oracle.getRating(ID);
        assertEq(r.score, 72);
        assertEq(r.grade, 4);
        assertTrue(r.simulated);
        assertEq(r.updatedAt, block.timestamp);
    }

    function test_oracle_onlyKeeper() public {
        vm.prank(stranger);
        vm.expectRevert(MCROracle.NotKeeper.selector);
        oracle.post(ID, 50, 3, false);
    }

    function test_oracle_rejectsBadGradeAndScore() public {
        vm.startPrank(keeper);
        vm.expectRevert(MCROracle.InvalidGrade.selector);
        oracle.post(ID, 50, 7, false);
        vm.expectRevert(MCROracle.InvalidScore.selector);
        oracle.post(ID, 101, 3, false);
        vm.stopPrank();
    }

    function test_oracle_setKeeperOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        oracle.setKeeper(stranger);
        oracle.setKeeper(stranger);
        assertEq(oracle.keeper(), stranger);
    }

    // ------------------------------------------------------------ quote / terms
    function test_quote_defaultsToProvisioned() public view {
        (uint256 p, uint16 fee, uint16 skim, uint8 g) = vault.quote(ID);
        assertEq(p, 1 ether);
        assertEq(fee, 1000);
        assertEq(skim, 3000);
        assertEq(g, 0);
    }

    function test_quote_followsGradeTable() public {
        uint256[7] memory principals = [uint256(1 ether), 2 ether, 3 ether, 5 ether, 8 ether, 12 ether, 20 ether];
        uint16[7] memory fees = [uint16(1000), 900, 800, 700, 600, 500, 400];
        uint16[7] memory skims = [uint16(3000), 2800, 2500, 2200, 2000, 1800, 1500];
        for (uint8 g = 0; g < 7; g++) {
            vm.prank(keeper);
            oracle.post(ID, g * 14, g, true);
            (uint256 p, uint16 fee, uint16 skim, uint8 grade) = vault.quote(ID);
            assertEq(p, principals[g]);
            assertEq(fee, fees[g]);
            assertEq(skim, skims[g]);
            assertEq(grade, g);
        }
    }

    function test_scaleTerms() public {
        vault.scaleTerms(1, 100);
        (uint256 p,,,) = vault.quote(ID);
        assertEq(p, 0.01 ether);
        SkimVault.Terms[7] memory all = vault.allTerms();
        assertEq(all[6].principal, 0.2 ether);
        assertEq(all[6].skimBps, 1500);
    }

    function test_terms_onlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setTerms(0, 1, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.scaleTerms(1, 2);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.withdrawLiquidity(payable(stranger), 1);
        vm.stopPrank();
    }

    function test_setTerms_validation() public {
        vm.expectRevert(SkimVault.InvalidGrade.selector);
        vault.setTerms(7, 1 ether, 100, 100);
        vm.expectRevert(SkimVault.InvalidBps.selector);
        vault.setTerms(0, 1 ether, 100, 10_001);
        vm.expectRevert(SkimVault.InvalidBps.selector);
        vault.setTerms(0, 1 ether, 100, 0);
        vm.expectRevert(SkimVault.PrincipalZero.selector);
        vault.setTerms(0, 0, 100, 100);
    }

    // ------------------------------------------------------------ liquidity
    function test_deposit_and_withdraw() public {
        assertEq(vault.availableLiquidity(), 100 ether);
        assertEq(vault.totalDeposited(), 100 ether);
        vm.expectRevert(SkimVault.ZeroAmount.selector);
        vault.deposit{value: 0}();
        address payable to = payable(makeAddr("treasury"));
        vault.withdrawLiquidity(to, 40 ether);
        assertEq(to.balance, 40 ether);
        assertEq(vault.availableLiquidity(), 60 ether);
        vm.expectRevert(SkimVault.InsufficientLiquidity.selector);
        vault.withdrawLiquidity(to, 61 ether);
    }

    function test_receive_counts_as_deposit() public {
        vm.prank(lender);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(vault.totalDeposited(), 101 ether);
    }

    // ------------------------------------------------------------ open loan
    function test_openLoan_escrowsNftAndPaysPrincipal() public {
        vm.prank(keeper);
        oracle.post(ID, 60, 3, true); // BBB: 5 PEAQ, 7%, 22%
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vm.expectEmit(true, true, false, true);
        emit SkimVault.LoanOpened(ID, operator, machineWallet, 5 ether, 5.35 ether, 2200, uint64(block.timestamp) + TERM);
        vault.openLoan(ID, machineWallet, TERM);
        vm.stopPrank();

        assertEq(nft.ownerOf(ID), address(vault));
        assertEq(machineWallet.balance, 5 ether);
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.borrower, operator);
        assertEq(l.machineWallet, machineWallet);
        assertEq(l.principal, 5 ether);
        assertEq(l.owed, 5.35 ether);
        assertEq(l.repaid, 0);
        assertEq(l.skimBps, 2200);
        assertEq(l.status, 1);
        assertEq(l.dueAt, l.openedAt + TERM);
        assertTrue(vault.isActive(ID));
        assertEq(vault.skimBpsOf(ID), 2200);
        assertEq(vault.outstandingOf(ID), 5.35 ether);
        assertEq(vault.activeLoanCount(), 1);
        assertEq(vault.totalOutstandingPrincipal(), 5 ether);
    }

    function test_openLoan_setApprovalForAllWorks() public {
        vm.startPrank(operator);
        nft.setApprovalForAll(address(vault), true);
        vault.openLoan(ID, machineWallet, TERM);
        vm.stopPrank();
        assertEq(nft.ownerOf(ID), address(vault));
    }

    function test_openLoan_requiresOwner() public {
        vm.prank(operator);
        nft.approve(address(vault), ID);
        vm.prank(stranger);
        vm.expectRevert(SkimVault.NotNftOwner.selector);
        vault.openLoan(ID, machineWallet, TERM);
    }

    function test_openLoan_requiresApproval() public {
        vm.prank(operator);
        vm.expectRevert(SkimVault.NotApproved.selector);
        vault.openLoan(ID, machineWallet, TERM);
    }

    function test_openLoan_requiresLiquidity() public {
        vault.withdrawLiquidity(payable(lender), 99.5 ether);
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vm.expectRevert(SkimVault.InsufficientLiquidity.selector);
        vault.openLoan(ID, machineWallet, TERM);
        vm.stopPrank();
    }

    function test_openLoan_rejectsZeroTermAndWallet() public {
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vm.expectRevert(SkimVault.InvalidTerm.selector);
        vault.openLoan(ID, machineWallet, 0);
        vm.expectRevert(SkimVault.ZeroAddress.selector);
        vault.openLoan(ID, payable(address(0)), TERM);
        vm.stopPrank();
    }

    function test_openLoan_cannotDoubleOpen() public {
        _open();
        vm.prank(operator);
        vm.expectRevert(SkimVault.LoanAlreadyActive.selector);
        vault.openLoan(ID, machineWallet, TERM);
    }

    function test_vault_rejectsStrayNfts() public {
        nft.mint(stranger, 7);
        vm.prank(stranger);
        vm.expectRevert(SkimVault.UnexpectedNft.selector);
        nft.safeTransferFrom(stranger, address(vault), 7);
    }

    // ------------------------------------------------------------ skim math
    function test_skim_math_provisioned() public {
        _open(); // 1 PEAQ, owed 1.1, skim 30%
        uint256 walletBefore = machineWallet.balance; // 1 ether principal
        vm.expectEmit(true, true, true, true);
        emit RevenueRouter.RevenueRouted(ID, customer, bytes32("s1"), 1 ether, 0.3 ether, 0.7 ether);
        _pay(1 ether, "s1");
        assertEq(machineWallet.balance - walletBefore, 0.7 ether);
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.repaid, 0.3 ether);
        assertEq(vault.outstandingOf(ID), 0.8 ether);
    }

    function testFuzz_skim_conservesValue(uint96 amount) public {
        vm.assume(amount > 0 && amount < 50 ether);
        _open();
        uint256 vaultBefore = address(vault).balance;
        uint256 walletBefore = machineWallet.balance;
        uint256 outstandingBefore = vault.outstandingOf(ID);
        _pay(amount, "fz");
        uint256 expectedSkim = (uint256(amount) * 3000) / 10_000;
        if (expectedSkim > outstandingBefore) expectedSkim = outstandingBefore;
        assertEq(address(vault).balance - vaultBefore, expectedSkim);
        assertEq(machineWallet.balance - walletBefore, uint256(amount) - expectedSkim);
        assertEq(address(router).balance, 0);
    }

    // ------------------------------------------------------------ partial / excess repay
    function test_partialRepay_directCall() public {
        _open();
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectEmit(true, false, false, true);
        emit SkimVault.Repaid(ID, 0.5 ether, 0.5 ether, 1.1 ether);
        vault.repay{value: 0.5 ether}(ID);
        assertTrue(vault.isActive(ID));
        assertEq(nft.ownerOf(ID), address(vault));
        assertEq(vault.outstandingOf(ID), 0.6 ether);
    }

    /// Security review 2026-10-12: owner/keeper changes after openLoan must not touch an active loan
    /// (terms are snapshotted into the Loan struct).
    function test_activeLoan_termsSnapshotted_againstOwnerAndKeeperChanges() public {
        _open(); // Provisioned: 1 ether, fee 10%, skim 30%
        vault.setTerms(0, 50 ether, 10_000, 10_000); // owner (this test) makes terms hostile
        vault.scaleTerms(10, 1);
        vm.prank(keeper);
        oracle.post(ID, 100, 6, true); // keeper re-grades
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.principal, 1 ether);
        assertEq(l.owed, 1.1 ether);
        assertEq(l.skimBps, 3000);
        uint256 before = machineWallet.balance;
        _pay(1 ether, keccak256("s1"));
        assertEq(machineWallet.balance - before, 0.7 ether); // still 30% skim
        assertEq(vault.outstandingOf(ID), 0.8 ether);
    }

    function test_excessRepay_refundsMachineWallet_andCloses() public {
        _open();
        uint256 walletBefore = machineWallet.balance;
        vm.deal(stranger, 5 ether);
        vm.prank(stranger);
        vault.repay{value: 2 ether}(ID); // owed 1.1
        assertEq(machineWallet.balance - walletBefore, 0.9 ether);
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.repaid, 1.1 ether);
        assertEq(l.status, 2);
        assertEq(nft.ownerOf(ID), operator);
        vm.prank(stranger);
        vm.expectRevert(SkimVault.NoActiveLoan.selector);
        vault.repay{value: 1}(ID);
    }

    function test_repay_requiresValueAndActiveLoan() public {
        vm.expectRevert(SkimVault.NoActiveLoan.selector);
        vault.repay{value: 1}(ID);
        _open();
        vm.expectRevert(SkimVault.ZeroAmount.selector);
        vault.repay{value: 0}(ID);
    }

    function test_router_capsFinalSkim() public {
        _open(); // owed 1.1
        _pay(3 ether, "a"); // skim 0.9
        assertEq(vault.outstandingOf(ID), 0.2 ether);
        uint256 walletBefore = machineWallet.balance;
        vm.expectEmit(true, true, true, true);
        emit RevenueRouter.RevenueRouted(ID, customer, bytes32("b"), 3 ether, 0.2 ether, 2.8 ether);
        _pay(3 ether, "b"); // 30% would be 0.9 but only 0.2 outstanding
        assertEq(machineWallet.balance - walletBefore, 2.8 ether);
        assertEq(vault.getLoan(ID).status, 2);
    }

    // ------------------------------------------------------------ close returns NFT
    function test_fullLoop_closeReturnsNft() public {
        vm.prank(keeper);
        oracle.post(ID, 30, 1, true); // B: 2 PEAQ, 9%, 28% -> owed 2.18
        _open();
        uint256 sessions;
        while (vault.isActive(ID)) {
            _pay(0.5 ether, bytes32(sessions));
            sessions++;
            assertLt(sessions, 100);
        }
        // 2.18 / 0.14 per session = 15.57 -> 16 sessions
        assertEq(sessions, 16);
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.status, 2);
        assertEq(l.repaid, l.owed);
        assertEq(nft.ownerOf(ID), operator);
        assertEq(vault.activeLoanCount(), 0);
        assertEq(vault.totalOutstandingPrincipal(), 0);
        // lender earned the fee: 100 - 2 + 2.18
        assertEq(address(vault).balance, 100.18 ether);
    }

    function test_closeEmitsLoanClosed() public {
        _open();
        vm.expectEmit(true, false, false, false);
        emit SkimVault.LoanClosed(ID);
        vault.repay{value: 1.1 ether}(ID);
    }

    function test_reopenAfterRepaid_withUpgradedGrade() public {
        _open();
        vault.repay{value: 1.1 ether}(ID);
        vm.prank(keeper);
        oracle.post(ID, 80, 5, true); // AA
        _open();
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.principal, 12 ether);
        assertEq(l.skimBps, 1800);
        assertEq(l.repaid, 0);
    }

    // ------------------------------------------------------------ default
    function test_default_onlyAfterDue() public {
        _open();
        vm.expectRevert(SkimVault.NotDue.selector);
        vault.markDefault(ID);
        vm.warp(block.timestamp + TERM);
        vm.expectRevert(SkimVault.NotDue.selector);
        vault.markDefault(ID);
        vm.warp(block.timestamp + 1);
        vm.prank(stranger);
        vm.expectEmit(true, false, false, false);
        emit SkimVault.Defaulted(ID);
        vault.markDefault(ID);
        SkimVault.Loan memory l = vault.getLoan(ID);
        assertEq(l.status, 3);
        assertEq(nft.ownerOf(ID), address(vault));
        assertFalse(vault.isActive(ID));
        assertEq(vault.skimBpsOf(ID), 0);
    }

    function test_default_notIfRepaid() public {
        _open();
        vault.repay{value: 1.1 ether}(ID);
        vm.warp(block.timestamp + TERM + 1);
        vm.expectRevert(SkimVault.NoActiveLoan.selector);
        vault.markDefault(ID);
    }

    function test_default_blocksReopen_andSeize() public {
        _open();
        vm.warp(block.timestamp + TERM + 1);
        vault.markDefault(ID);
        vm.prank(operator);
        vm.expectRevert(SkimVault.LoanDefaulted.selector);
        vault.openLoan(ID, machineWallet, TERM);
        // after default, router forwards everything
        uint256 walletBefore = machineWallet.balance;
        _pay(1 ether, "post");
        assertEq(machineWallet.balance - walletBefore, 1 ether);
        // only owner may seize
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.seizeCollateral(ID, stranger);
        address liquidator = makeAddr("liquidator");
        vault.seizeCollateral(ID, liquidator);
        assertEq(nft.ownerOf(ID), liquidator);
    }

    function test_seize_requiresDefault() public {
        _open();
        vm.expectRevert(SkimVault.NotDefaulted.selector);
        vault.seizeCollateral(ID, stranger);
    }

    // ------------------------------------------------------------ no-loan forwarding
    function test_noLoan_forwardsEverything() public {
        address payable other = payable(makeAddr("other"));
        vm.expectEmit(true, true, true, true);
        emit RevenueRouter.RevenueRouted(ID, customer, bytes32("x"), 2 ether, 0, 2 ether);
        vm.prank(customer);
        router.pay{value: 2 ether}(ID, other, "x");
        assertEq(other.balance, 2 ether);
        assertEq(address(vault).balance, 100 ether);
    }

    function test_activeLoan_ignoresWalletArgument() public {
        _open();
        address payable attacker = payable(makeAddr("attacker"));
        uint256 walletBefore = machineWallet.balance;
        vm.prank(customer);
        router.pay{value: 1 ether}(ID, attacker, "y");
        assertEq(attacker.balance, 0);
        assertEq(machineWallet.balance - walletBefore, 0.7 ether);
    }

    function test_router_rejectsZero() public {
        vm.expectRevert(RevenueRouter.ZeroAmount.selector);
        router.pay{value: 0}(ID, machineWallet, "z");
        vm.prank(customer);
        vm.expectRevert(RevenueRouter.ZeroAddress.selector);
        router.pay{value: 1}(ID, payable(address(0)), "z");
    }

    function test_router_tinyPaymentRoundsSkimToZero() public {
        _open();
        uint256 before = machineWallet.balance;
        _pay(3, "tiny"); // 3 * 3000 / 10000 = 0
        assertEq(machineWallet.balance - before, 3);
        assertEq(vault.getLoan(ID).repaid, 0);
    }

    // ------------------------------------------------------------ reentrancy
    function test_reentrancy_routerViaMachineWallet() public {
        ReenteringWallet evil = new ReenteringWallet(router, ID);
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vault.openLoan(ID, payable(address(evil)), TERM);
        vm.stopPrank();
        evil.arm();
        vm.prank(customer);
        vm.expectRevert(RevenueRouter.TransferFailed.selector); // inner pay hits ReentrancyGuard
        router.pay{value: 1 ether}(ID, payable(address(evil)), "r");
        assertEq(vault.getLoan(ID).repaid, 0); // whole tx rolled back
    }

    function test_reentrancy_vaultRefund() public {
        RepayReenterWallet evil = new RepayReenterWallet(vault, ID);
        vm.startPrank(operator);
        nft.approve(address(vault), ID);
        vault.openLoan(ID, payable(address(evil)), TERM);
        vm.stopPrank();
        evil.arm();
        vm.deal(stranger, 5 ether);
        vm.prank(stranger);
        vm.expectRevert(SkimVault.TransferFailed.selector);
        vault.repay{value: 2 ether}(ID); // excess refund re-enters repay -> guarded
        assertTrue(vault.isActive(ID));
    }

    function test_rejectingWallet_cannotReceiveForward() public {
        RejectingWallet rw = new RejectingWallet();
        vm.prank(customer);
        vm.expectRevert(RevenueRouter.TransferFailed.selector);
        router.pay{value: 1 ether}(ID, payable(address(rw)), "rej");
    }

    // ------------------------------------------------------------ mock event registry
    function test_registry_submitAndDedupe() public {
        bytes32 src = keccak256("routertx");
        vm.expectEmit(true, true, false, true);
        emit MockEventRegistry.EventSubmitted(ID, 0, 1234, "USD", uint64(block.timestamp), 1, src);
        registry.submitEvent(ID, 0, 1234, "USD", uint64(block.timestamp), 1, src, "{}");
        assertEq(registry.eventCount(ID), 1);
        assertEq(registry.revenueEventCount(ID), 1);
        assertEq(registry.totalRevenue(ID), 1234);
        assertTrue(registry.sourceTxRecorded(src));
        MockEventRegistry.StoredEvent memory e = registry.getEvent(0);
        assertEq(e.submitter, address(this));
        vm.expectRevert(MockEventRegistry.DuplicateSourceTx.selector);
        registry.submitEvent(ID, 0, 1, "USD", uint64(block.timestamp), 1, src, "");
    }

    function test_registry_validation() public {
        vm.expectRevert(MockEventRegistry.SourceTxRequired.selector);
        registry.submitEvent(ID, 0, 1, "USD", uint64(block.timestamp), 1, bytes32(0), "");
        vm.expectRevert(MockEventRegistry.InvalidEventType.selector);
        registry.submitEvent(ID, 2, 1, "USD", uint64(block.timestamp), 0, bytes32(0), "");
        vm.expectRevert(MockEventRegistry.InvalidTrustLevel.selector);
        registry.submitEvent(ID, 0, 1, "USD", uint64(block.timestamp), 3, bytes32(0), "");
        vm.expectRevert(MockEventRegistry.FutureTimestamp.selector);
        registry.submitEvent(ID, 0, 1, "USD", uint64(block.timestamp + 1000), 0, bytes32(0), "");
        // self-reported without source is fine
        registry.submitEvent(ID, 1, 0, "", uint64(block.timestamp), 0, bytes32(0), "");
        assertEq(registry.revenueEventCount(ID), 0);
        assertEq(registry.eventCount(ID), 1);
    }
}
