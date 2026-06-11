// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from 'forge-std/Test.sol';
import { LiquidityVault } from '../contracts/treasury/LiquidityVault.sol';
import { SentinelGuard } from '../contracts/sentinel/SentinelGuard.sol';

interface IAerodromePair {
    function price0CumulativeLast() external view returns (uint256);

    function price1CumulativeLast() external view returns (uint256);

    function blockTimestampLast() external view returns (uint32);

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract MockAerodromePair is IAerodromePair {
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;
    uint112 public reserve0;
    uint112 public reserve1;

    function setSnapshot(uint256 price0, uint256 price1, uint32 timestamp) external {
        price0CumulativeLast = price0;
        price1CumulativeLast = price1;
        blockTimestampLast = timestamp;
    }

    function setReserves(uint112 reserve0_, uint112 reserve1_) external {
        reserve0 = reserve0_;
        reserve1 = reserve1_;
    }

    function getReserves()
        external
        view
        returns (uint112 reserve0_, uint112 reserve1_, uint32 blockTimestampLast_)
    {
        return (reserve0, reserve1, blockTimestampLast);
    }
}

contract LiquidityVaultIntegrationTest is Test {
    uint256 internal constant PRICE_SCALE = 1e18 << 112;

    LiquidityVault internal vault;
    MockAerodromePair internal pair;
    address internal owner = address(this);
    address internal user = address(0xA11CE);

    function setUp() public {
        pair = new MockAerodromePair();
        pair.setSnapshot(1000 * PRICE_SCALE, 1000 * PRICE_SCALE, 1000);
        pair.setReserves(1e18, 1e18);

        vault = new LiquidityVault(address(pair), owner);
    }

    function test_ConstructorInitializesSnapshot() public view {
        assertEq(address(vault.poolAddress()), address(pair));
        assertEq(vault.lastPrice0Cumulative(), 1000 * PRICE_SCALE);
        assertEq(vault.snapshotTimestamp(), 1000);
        assertEq(vault.owner(), owner);
    }

    function test_AddLiquiditySucceedsWhenHealthy() public {
        vault.addLiquidity();
    }

    function test_AddLiquidityRevertsWhenPaused() public {
        vault.setEmergencyPause(true);

        vm.expectRevert(SentinelGuard.ContractPaused.selector);
        vault.addLiquidity();
    }

    function test_AddLiquidityRevertsWhenDivergenceExceedsThreshold() public {
        pair.setSnapshot(4000 * PRICE_SCALE, 4000 * PRICE_SCALE, 4000);
        pair.setReserves(1e18, 11e17);

        vm.expectRevert(SentinelGuard.HealthFactorTooLow.selector);
        vault.addLiquidity();
    }

    function test_UpdateSnapshotRefreshesTwapBaseline() public {
        pair.setSnapshot(4000 * PRICE_SCALE, 4000 * PRICE_SCALE, 4000);
        pair.setReserves(1e18, 1e18);

        vault.updateSnapshot();

        assertEq(vault.lastPrice0Cumulative(), 4000 * PRICE_SCALE);
        assertEq(vault.snapshotTimestamp(), 4000);
    }

    function test_SetMaxDivergenceRestrictsOwner() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setMaxDivergence(200);

        vault.setMaxDivergence(200);
        assertEq(vault.maxDivergence(), 200);
    }

    function test_SetMaxDivergenceRejectsFullScaleValue() public {
        vm.expectRevert(LiquidityVault.InvalidDivergence.selector);
        vault.setMaxDivergence(vault.BASE_DIVISOR());
    }
}
