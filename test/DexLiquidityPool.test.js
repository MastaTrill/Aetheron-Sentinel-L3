import { expect } from 'chai';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  calculateSqrtPriceX96,
  getFullRangeTicks,
  sqrtBigInt,
  CONTRACTS,
} = require('../scripts/create-dex-liquidity-pool.cjs');

describe('DEX Liquidity Pool Engine (Uniswap v3)', function () {
  describe('sqrtBigInt Math', function () {
    it('calculates integer square roots accurately', function () {
      expect(sqrtBigInt(0n)).to.equal(0n);
      expect(sqrtBigInt(1n)).to.equal(1n);
      expect(sqrtBigInt(4n)).to.equal(2n);
      expect(sqrtBigInt(100n)).to.equal(10n);
      expect(sqrtBigInt(10000n)).to.equal(100n);
      expect(sqrtBigInt(1000000n)).to.equal(1000n);
    });

    it('handles large 256-bit numbers', function () {
      const q192 = 2n ** 192n;
      const sqrtQ192 = sqrtBigInt(q192);
      expect(sqrtQ192).to.equal(2n ** 96n);
    });

    it('throws on negative input', function () {
      expect(() => sqrtBigInt(-1n)).to.throw('Square root of negative number');
    });
  });

  describe('calculateSqrtPriceX96', function () {
    it('computes 1:1 price ratio correctly (sqrtPriceX96 = 2^96)', function () {
      const amount0 = 10n ** 18n; // 1 token0
      const amount1 = 10n ** 18n; // 1 token1
      const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);
      const expected = 2n ** 96n;
      expect(sqrtPriceX96).to.equal(expected);
    });

    it('computes 1:10000 price ratio correctly (1 ETH = 10,000 AETH)', function () {
      const amount0 = 10n ** 18n; // 1 WETH
      const amount1 = 10000n * 10n ** 18n; // 10,000 AETH
      const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);
      // sqrt(10000) = 100
      const expected = 100n * 2n ** 96n;
      expect(sqrtPriceX96).to.equal(expected);
    });

    it('computes 1:2500 price ratio correctly (1 ETH = 2,500 AETH)', function () {
      const amount0 = 10n ** 18n; // 1 WETH
      const amount1 = 2500n * 10n ** 18n; // 2,500 AETH
      const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);
      // sqrt(2500) = 50
      const expected = 50n * 2n ** 96n;
      expect(sqrtPriceX96).to.equal(expected);
    });

    it('rejects zero or negative amounts', function () {
      expect(() => calculateSqrtPriceX96(0n, 10n ** 18n)).to.throw(
        'Amounts must be greater than zero'
      );
      expect(() => calculateSqrtPriceX96(10n ** 18n, 0n)).to.throw(
        'Amounts must be greater than zero'
      );
    });
  });

  describe('getFullRangeTicks', function () {
    it('returns correct full range bounds for 0.05% tier (500)', function () {
      const { tickLower, tickUpper } = getFullRangeTicks(500);
      expect(tickLower).to.equal(-887270);
      expect(tickUpper).to.equal(887270);
      expect(tickLower % 10).to.equal(0);
      expect(tickUpper % 10).to.equal(0);
    });

    it('returns correct full range bounds for 0.3% tier (3000)', function () {
      const { tickLower, tickUpper } = getFullRangeTicks(3000);
      expect(tickLower).to.equal(-887220);
      expect(tickUpper).to.equal(887220);
      expect(tickLower % 60).to.equal(0);
      expect(tickUpper % 60).to.equal(0);
    });

    it('returns correct full range bounds for 1.0% tier (10000)', function () {
      const { tickLower, tickUpper } = getFullRangeTicks(10000);
      expect(tickLower).to.equal(-887200);
      expect(tickUpper).to.equal(887200);
      expect(tickLower % 200).to.equal(0);
      expect(tickUpper % 200).to.equal(0);
    });

    it('throws for unsupported fee tier', function () {
      expect(() => getFullRangeTicks(100)).to.throw('Unsupported fee tier: 100');
    });
  });

  describe('Contract Configuration', function () {
    it('contains valid addresses for Base Mainnet (8453)', function () {
      const base = CONTRACTS[8453];
      expect(base.name).to.equal('Base Mainnet');
      expect(base.weth).to.equal('0x4200000000000000000000000000000000000006');
      expect(base.aeth).to.equal('0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e');
      expect(base.v3Factory).to.equal('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
      expect(base.positionManager).to.equal('0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1');
    });
  });
});
