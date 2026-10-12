// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MCROracle
/// @notice Keeper-posted mirror of a machine's Machine Credit Rating (MCR).
///         On peaq mainnet the keeper relays the live MCR from mcr.peaq.xyz;
///         on agung/local (no MCR) it posts a SIMULATED rating and sets `simulated = true`.
/// @dev grade: 0 = Provisioned/NR, 1 = B, 2 = BB, 3 = BBB, 4 = A, 5 = AA, 6 = AAA.
contract MCROracle is Ownable {
    struct Rating {
        uint8 score; // 0-100
        uint8 grade; // 0..6
        uint64 updatedAt;
        bool simulated;
    }

    uint8 public constant MAX_GRADE = 6;

    address public keeper;
    mapping(uint256 => Rating) private _ratings;

    event RatingPosted(uint256 indexed machineId, uint8 score, uint8 grade, bool simulated);
    event KeeperChanged(address indexed previousKeeper, address indexed newKeeper);

    error NotKeeper();
    error InvalidGrade();
    error InvalidScore();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    /// @param keeper_ the keeper address allowed to post ratings. Deployer becomes owner.
    constructor(address keeper_) Ownable(msg.sender) {
        keeper = keeper_;
        emit KeeperChanged(address(0), keeper_);
    }

    function setKeeper(address newKeeper) external onlyOwner {
        emit KeeperChanged(keeper, newKeeper);
        keeper = newKeeper;
    }

    function post(uint256 machineId, uint8 score, uint8 grade, bool simulated) external onlyKeeper {
        if (grade > MAX_GRADE) revert InvalidGrade();
        if (score > 100) revert InvalidScore();
        _ratings[machineId] = Rating({score: score, grade: grade, updatedAt: uint64(block.timestamp), simulated: simulated});
        emit RatingPosted(machineId, score, grade, simulated);
    }

    function getRating(uint256 machineId) external view returns (Rating memory) {
        return _ratings[machineId];
    }
}
