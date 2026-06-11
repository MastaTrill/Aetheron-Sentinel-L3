// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SentinelGuard } from '../sentinel/SentinelGuard.sol';

interface IAerodromePair {
    function price0CumulativeLast() external view returns (uint256);

    function price1CumulativeLast() external view returns (uint256);

    function blockTimestampLast() external view returns (uint32);

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract LiquidityVault is SentinelGuard {
    address public immutable poolAddress;
    uint256 public lastPrice0Cumulative;
    uint32 public snapshotTimestamp;
    uint256 public maxDivergence = 500;

    error LiquidityVault__ReentrancyError();
    error InvalidPool();
    error InvalidDivergence();
    error PriceCumulativeDecreased();

    bytes32 private constant REENTRANCY_GUARD_SLOT =
        0x0f2955562723049b494f6c4f34691459a933f864115e69e4f446059e666a7b67;

    constructor(address pool, address owner_) SentinelGuard(owner_) {
        if (pool == address(0)) revert InvalidPool();
        poolAddress = pool;
        _updateSnapshot();
    }

    modifier nonReentrant() {
        assembly {
            if tload(REENTRANCY_GUARD_SLOT) {
                mstore(0x00, 0x762f057d)
                revert(0x1c, 0x04)
            }
            tstore(REENTRANCY_GUARD_SLOT, 1)
        }
        _;
        assembly {
            tstore(REENTRANCY_GUARD_SLOT, 0)
        }
    }

    function addLiquidity() external nonReentrant onlyHealthy {}

    function _calculateHealthFactor() internal view override returns (uint256) {
        IAerodromePair pair = IAerodromePair(poolAddress);
        uint256 price0Cumulative = pair.price0CumulativeLast();
        if (price0Cumulative < lastPrice0Cumulative) revert PriceCumulativeDecreased();

        uint32 currentTimestamp = pair.blockTimestampLast();

        if (snapshotTimestamp == 0) return BASE_DIVISOR;

        uint32 elapsed = currentTimestamp - snapshotTimestamp;
        if (elapsed < 1800) return BASE_DIVISOR;

        uint256 twapPrice = (price0Cumulative - lastPrice0Cumulative) / uint256(elapsed);
        if (twapPrice == 0) return 0;

        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        if (reserve0 == 0) return 0;

        uint256 spotPrice = (uint256(reserve1) << 112) / uint256(reserve0);
        uint256 diff = spotPrice > twapPrice ? spotPrice - twapPrice : twapPrice - spotPrice;
        uint256 deviationBps = (diff * BASE_DIVISOR) / twapPrice;

        if (deviationBps > maxDivergence) return 0;
        return BASE_DIVISOR - deviationBps;
    }

    function updateSnapshot() external onlyOwner {
        _updateSnapshot();
    }

    function _updateSnapshot() internal {
        IAerodromePair pair = IAerodromePair(poolAddress);
        lastPrice0Cumulative = pair.price0CumulativeLast();
        snapshotTimestamp = pair.blockTimestampLast();
    }

    function setMaxDivergence(uint256 newMaxDivergence) external onlyOwner {
        if (newMaxDivergence >= BASE_DIVISOR) revert InvalidDivergence();
        maxDivergence = newMaxDivergence;
    }
}
