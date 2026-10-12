// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockMachineNFT (testnet / tests only)
/// @notice Stand-in for peaq's MachineRegistry ERC-721 (where machineId == tokenId)
///         when the real Machine NFT can't be used. `mint` is intentionally open.
contract MockMachineNFT is ERC721 {
    constructor() ERC721("SKIM Mock Machine", "MOCKMACHINE") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
