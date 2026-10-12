// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockEventRegistry (testnet only)
/// @notice Mimics the shape of peaq's Economics 2.0 EventRegistry so the keeper can write
///         revenue events where no 2.0 registry exists (agung, local anvil).
///         eventType: 0 = revenue, 1 = activity. trustLevel: 0 self-reported, 1 on-chain verifiable, 2 hardware.
///         For trustLevel 1 the event must cite the source tx (here: the RevenueRouter tx).
contract MockEventRegistry {
    struct StoredEvent {
        uint256 machineId;
        uint8 eventType;
        uint256 value;
        string currency;
        uint64 timestamp;
        uint8 trustLevel;
        bytes32 sourceTxHash;
        string metadata;
        address submitter;
    }

    StoredEvent[] private _events;
    mapping(uint256 => uint256) public eventCount;
    mapping(uint256 => uint256) public revenueEventCount;
    mapping(uint256 => uint256) public totalRevenue; // sum of revenue values (minor units, mixed currencies not converted)
    mapping(bytes32 => bool) public sourceTxRecorded;

    event EventSubmitted(
        uint256 indexed machineId,
        uint8 eventType,
        uint256 value,
        string currency,
        uint64 timestamp,
        uint8 trustLevel,
        bytes32 indexed sourceTxHash
    );

    error InvalidEventType();
    error InvalidTrustLevel();
    error SourceTxRequired();
    error DuplicateSourceTx();
    error FutureTimestamp();
    error MetadataTooLarge();

    function submitEvent(
        uint256 machineId,
        uint8 eventType,
        uint256 value,
        string calldata currency,
        uint64 timestamp,
        uint8 trustLevel,
        bytes32 sourceTxHash,
        string calldata metadata
    ) external returns (uint256 index) {
        if (eventType > 1) revert InvalidEventType();
        if (trustLevel > 2) revert InvalidTrustLevel();
        if (trustLevel == 1 && sourceTxHash == bytes32(0)) revert SourceTxRequired();
        if (timestamp > block.timestamp + 300) revert FutureTimestamp();
        if (bytes(metadata).length > 4096) revert MetadataTooLarge();
        if (sourceTxHash != bytes32(0)) {
            if (sourceTxRecorded[sourceTxHash]) revert DuplicateSourceTx();
            sourceTxRecorded[sourceTxHash] = true;
        }
        index = _events.length;
        _events.push(
            StoredEvent(machineId, eventType, value, currency, timestamp, trustLevel, sourceTxHash, metadata, msg.sender)
        );
        eventCount[machineId] += 1;
        if (eventType == 0) {
            revenueEventCount[machineId] += 1;
            totalRevenue[machineId] += value;
        }
        emit EventSubmitted(machineId, eventType, value, currency, timestamp, trustLevel, sourceTxHash);
    }

    function totalEvents() external view returns (uint256) {
        return _events.length;
    }

    function getEvent(uint256 index) external view returns (StoredEvent memory) {
        return _events[index];
    }
}
