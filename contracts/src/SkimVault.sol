// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {MCROracle} from "./MCROracle.sol";

/// @title SkimVault
/// @notice Revenue-based credit for machines. A machine escrows its Machine NFT and receives a
///         native-token advance sized by its Machine Credit Rating. Revenue routed through the
///         RevenueRouter skims a share into `repay` until the loan (principal + flat fee) is paid,
///         at which point the NFT returns to the borrower automatically.
/// @dev All value is the chain's native token (PEAQ / AGNG) moved via msg.value.
contract SkimVault is Ownable, ReentrancyGuard, IERC721Receiver {
    // ---------------------------------------------------------------- types
    struct Terms {
        uint256 principal; // wei
        uint16 feeBps; // flat fee on principal
        uint16 skimBps; // share of each routed payment
    }

    struct Loan {
        address borrower;
        address payable machineWallet;
        uint256 principal;
        uint256 owed;
        uint256 repaid;
        uint16 skimBps;
        uint64 openedAt;
        uint64 dueAt;
        uint8 status; // 0 none, 1 active, 2 repaid, 3 defaulted
    }

    uint8 public constant STATUS_NONE = 0;
    uint8 public constant STATUS_ACTIVE = 1;
    uint8 public constant STATUS_REPAID = 2;
    uint8 public constant STATUS_DEFAULTED = 3;
    uint8 public constant NUM_GRADES = 7;
    uint16 public constant BPS = 10_000;

    // ---------------------------------------------------------------- state
    IERC721 public immutable machineNft;
    MCROracle public immutable oracle;

    Terms[7] private _terms;
    mapping(uint256 => Loan) public loans;

    uint256 public totalDeposited;
    uint256 public totalOutstandingPrincipal;
    uint256 public activeLoanCount;
    uint256 public totalRepaid;

    bool private _expectingNft;

    // ---------------------------------------------------------------- events
    event Deposited(address indexed lender, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event TermsSet(uint8 indexed grade, uint256 principal, uint16 feeBps, uint16 skimBps);
    event LoanOpened(
        uint256 indexed machineId,
        address indexed borrower,
        address machineWallet,
        uint256 principal,
        uint256 owed,
        uint16 skimBps,
        uint64 dueAt
    );
    event Repaid(uint256 indexed machineId, uint256 amount, uint256 repaid, uint256 owed);
    event LoanClosed(uint256 indexed machineId);
    event Defaulted(uint256 indexed machineId);
    event CollateralSeized(uint256 indexed machineId, address indexed to);

    // ---------------------------------------------------------------- errors
    error ZeroAmount();
    error InvalidGrade();
    error InvalidBps();
    error LoanAlreadyActive();
    error LoanDefaulted();
    error NotNftOwner();
    error NotApproved();
    error InsufficientLiquidity();
    error InvalidTerm();
    error ZeroAddress();
    error NoActiveLoan();
    error NotDue();
    error NotDefaulted();
    error TransferFailed();
    error UnexpectedNft();
    error PrincipalZero();

    constructor(IERC721 machineNft_, MCROracle oracle_) Ownable(msg.sender) {
        if (address(machineNft_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        machineNft = machineNft_;
        oracle = oracle_;
        // grade: principal (in whole native tokens), fee bps, skim bps
        _setTerms(0, 1 ether, 1000, 3000); // Provisioned: starter line
        _setTerms(1, 2 ether, 900, 2800); // B
        _setTerms(2, 3 ether, 800, 2500); // BB
        _setTerms(3, 5 ether, 700, 2200); // BBB
        _setTerms(4, 8 ether, 600, 2000); // A
        _setTerms(5, 12 ether, 500, 1800); // AA
        _setTerms(6, 20 ether, 400, 1500); // AAA
    }

    receive() external payable {
        _deposit();
    }

    // ---------------------------------------------------------------- liquidity
    function deposit() external payable {
        _deposit();
    }

    function _deposit() internal {
        if (msg.value == 0) revert ZeroAmount();
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdrawLiquidity(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > address(this).balance) revert InsufficientLiquidity();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit LiquidityWithdrawn(to, amount);
    }

    function availableLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    // ---------------------------------------------------------------- terms
    function setTerms(uint8 grade, uint256 principal, uint16 feeBps, uint16 skimBps) external onlyOwner {
        _setTerms(grade, principal, feeBps, skimBps);
    }

    /// @notice Multiply every principal in the table by num/den (e.g. 1/100 for a cheap demo).
    function scaleTerms(uint256 num, uint256 den) external onlyOwner {
        if (num == 0 || den == 0) revert ZeroAmount();
        for (uint8 g = 0; g < NUM_GRADES; g++) {
            Terms memory t = _terms[g];
            _setTerms(g, (t.principal * num) / den, t.feeBps, t.skimBps);
        }
    }

    function _setTerms(uint8 grade, uint256 principal, uint16 feeBps, uint16 skimBps) internal {
        if (grade >= NUM_GRADES) revert InvalidGrade();
        if (principal == 0) revert PrincipalZero();
        if (feeBps > BPS || skimBps == 0 || skimBps > BPS) revert InvalidBps();
        _terms[grade] = Terms(principal, feeBps, skimBps);
        emit TermsSet(grade, principal, feeBps, skimBps);
    }

    function termsFor(uint8 grade) external view returns (Terms memory) {
        if (grade >= NUM_GRADES) revert InvalidGrade();
        return _terms[grade];
    }

    function allTerms() external view returns (Terms[7] memory) {
        return _terms;
    }

    function quote(uint256 machineId)
        public
        view
        returns (uint256 principal, uint16 feeBps, uint16 skimBps, uint8 grade)
    {
        grade = oracle.getRating(machineId).grade;
        if (grade >= NUM_GRADES) grade = 0;
        Terms memory t = _terms[grade];
        return (t.principal, t.feeBps, t.skimBps, grade);
    }

    // ---------------------------------------------------------------- loan lifecycle
    /// @notice Escrow the Machine NFT and receive the advance at `machineWallet`.
    /// @dev Caller must own `machineId` and have approved this vault (approve or setApprovalForAll).
    function openLoan(uint256 machineId, address payable machineWallet, uint64 termSeconds) external nonReentrant {
        if (machineWallet == address(0)) revert ZeroAddress();
        if (termSeconds == 0) revert InvalidTerm();
        Loan storage existing = loans[machineId];
        if (existing.status == STATUS_ACTIVE) revert LoanAlreadyActive();
        if (existing.status == STATUS_DEFAULTED) revert LoanDefaulted();
        if (machineNft.ownerOf(machineId) != msg.sender) revert NotNftOwner();
        if (machineNft.getApproved(machineId) != address(this) && !machineNft.isApprovedForAll(msg.sender, address(this)))
        {
            revert NotApproved();
        }

        (uint256 principal, uint16 feeBps, uint16 skimBps,) = quote(machineId);
        if (address(this).balance < principal) revert InsufficientLiquidity();

        uint256 owed = (principal * (BPS + feeBps)) / BPS;
        uint64 dueAt = uint64(block.timestamp) + termSeconds;

        loans[machineId] = Loan({
            borrower: msg.sender,
            machineWallet: machineWallet,
            principal: principal,
            owed: owed,
            repaid: 0,
            skimBps: skimBps,
            openedAt: uint64(block.timestamp),
            dueAt: dueAt,
            status: STATUS_ACTIVE
        });
        totalOutstandingPrincipal += principal;
        activeLoanCount += 1;

        _expectingNft = true;
        machineNft.safeTransferFrom(msg.sender, address(this), machineId);
        _expectingNft = false;

        emit LoanOpened(machineId, msg.sender, machineWallet, principal, owed, skimBps, dueAt);

        (bool ok,) = machineWallet.call{value: principal}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Repay toward an active loan. Anyone can call (the RevenueRouter does).
    ///         Payment is capped at the outstanding amount; any excess is refunded to the machine wallet.
    function repay(uint256 machineId) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        Loan storage loan = loans[machineId];
        if (loan.status != STATUS_ACTIVE) revert NoActiveLoan();

        uint256 outstanding = loan.owed - loan.repaid;
        uint256 amount = msg.value > outstanding ? outstanding : msg.value;
        uint256 excess = msg.value - amount;

        loan.repaid += amount;
        totalRepaid += amount;
        emit Repaid(machineId, amount, loan.repaid, loan.owed);

        address payable wallet = loan.machineWallet;
        if (loan.repaid == loan.owed) {
            loan.status = STATUS_REPAID;
            totalOutstandingPrincipal -= loan.principal;
            activeLoanCount -= 1;
            // transferFrom (not safeTransferFrom) so a borrower contract without a receiver hook
            // can never block the final repayment; the borrower was the NFT's previous owner.
            machineNft.transferFrom(address(this), loan.borrower, machineId);
            emit LoanClosed(machineId);
        }

        if (excess > 0) {
            (bool ok,) = wallet.call{value: excess}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Mark an overdue, unpaid loan as defaulted. Permissionless. The vault keeps the NFT.
    function markDefault(uint256 machineId) external {
        Loan storage loan = loans[machineId];
        if (loan.status != STATUS_ACTIVE) revert NoActiveLoan();
        if (block.timestamp <= loan.dueAt) revert NotDue();
        loan.status = STATUS_DEFAULTED;
        totalOutstandingPrincipal -= loan.principal;
        activeLoanCount -= 1;
        emit Defaulted(machineId);
    }

    /// @notice After default the owner (lender) may move the escrowed NFT, e.g. to a liquidator.
    function seizeCollateral(uint256 machineId, address to) external onlyOwner {
        if (loans[machineId].status != STATUS_DEFAULTED) revert NotDefaulted();
        if (to == address(0)) revert ZeroAddress();
        machineNft.transferFrom(address(this), to, machineId);
        emit CollateralSeized(machineId, to);
    }

    // ---------------------------------------------------------------- views
    function getLoan(uint256 machineId) external view returns (Loan memory) {
        return loans[machineId];
    }

    function skimBpsOf(uint256 machineId) external view returns (uint16) {
        Loan storage loan = loans[machineId];
        return loan.status == STATUS_ACTIVE ? loan.skimBps : 0;
    }

    function isActive(uint256 machineId) external view returns (bool) {
        return loans[machineId].status == STATUS_ACTIVE;
    }

    function outstandingOf(uint256 machineId) external view returns (uint256) {
        Loan storage loan = loans[machineId];
        return loan.status == STATUS_ACTIVE ? loan.owed - loan.repaid : 0;
    }

    function machineWalletOf(uint256 machineId) external view returns (address payable) {
        return loans[machineId].machineWallet;
    }

    // ---------------------------------------------------------------- ERC721 receiver
    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(machineNft) || !_expectingNft) revert UnexpectedNft();
        return IERC721Receiver.onERC721Received.selector;
    }
}
