import { AbiCoder, getAddress, keccak256 } from 'ethers';
// Replacement-only SENTINEL smoke-test policy. Pure functions; no RPC or signing.
export const LEGACY_TOKEN = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';
// Public Uniswap V4 pool ID (not a credential). Explicitly labeled for the tracked-secret scanner.
export const LEGACY_POOL_ID = '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d';
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const POOL = /^0x[0-9a-f]{64}$/i;
function positive(value, label, allowZero = false) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value ?? ''))) throw new Error(label + ' must be an unsigned integer');
  const n = BigInt(value);
  if (!allowZero && n === 0n) throw new Error(label + ' must be positive');
  return n;
}
export function validateReplacementIdentity({ token, poolId, expectedToken, expectedPoolId }) {
  if (![token, expectedToken].every(x => ADDRESS.test(x ?? ''))) throw new Error('Replacement token address is missing or malformed');
  if (![poolId, expectedPoolId].every(x => POOL.test(x ?? ''))) throw new Error('Replacement pool ID is missing or malformed');
  if ([token, expectedToken].some(x => x.toLowerCase() === LEGACY_TOKEN)) throw new Error('Legacy SENTINEL token is forbidden');
  if ([poolId, expectedPoolId].some(x => x.toLowerCase() === LEGACY_POOL_ID)) throw new Error('Legacy SENTINEL pool is forbidden');
  if (token.toLowerCase() !== expectedToken.toLowerCase() || poolId.toLowerCase() !== expectedPoolId.toLowerCase()) throw new Error('Replacement identity mismatch');
}

export const BASE_WETH = '0x4200000000000000000000000000000000000006';

// A Uniswap V4 PoolId is the keccak256 hash of the ABI-encoded PoolKey.
// Never infer currency ordering from the trade direction or a pool ID alone.
export function validateCanonicalPoolKey({ poolKey, token, poolId }) {
  if (!poolKey || !poolId) throw new Error('Verified replacement PoolKey and pool ID are required');
  const currency0 = getAddress(poolKey.currency0);
  const currency1 = getAddress(poolKey.currency1);
  const replacement = getAddress(token);
  const weth = getAddress(BASE_WETH);
  if (currency0.toLowerCase() >= currency1.toLowerCase()) throw new Error('PoolKey currencies are not canonically sorted');
  const pair = [currency0.toLowerCase(), currency1.toLowerCase()];
  if (!pair.includes(weth.toLowerCase()) || !pair.includes(replacement.toLowerCase()) ||
      currency0.toLowerCase() === currency1.toLowerCase()) throw new Error('PoolKey must contain WETH and replacement SENTINEL');
  const fee = positive(poolKey.fee, 'PoolKey fee', true);
  if (fee > 16777215n) throw new Error('PoolKey fee exceeds uint24');
  if (!/^[1-9][0-9]*$/.test(String(poolKey.tickSpacing ?? ''))) throw new Error('PoolKey tick spacing invalid');
  const tickSpacing = BigInt(poolKey.tickSpacing);
  if (tickSpacing > 8388607n) throw new Error('PoolKey tick spacing exceeds int24');
  const hooks = getAddress(poolKey.hooks);
  const calculated = keccak256(AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [currency0, currency1, fee, tickSpacing, hooks],
  ));
  if (calculated.toLowerCase() !== poolId.toLowerCase()) throw new Error('PoolKey does not hash to authorized replacement pool ID');
  return currency0.toLowerCase() === weth.toLowerCase();
}

// Swap deltas are denominated in currency0/currency1; positive is owed to the pool.
export function classifyReplacementSwap(amount0, amount1, wethIsCurrency0) {
  const weth = wethIsCurrency0 ? amount0 : amount1;
  const sentinel = wethIsCurrency0 ? amount1 : amount0;
  return {
    direction: weth > 0n && sentinel < 0n ? 'buy-sentinel-with-weth'
      : weth < 0n && sentinel > 0n ? 'sell-sentinel-for-weth' : 'other',
    weth, sentinel,
  };
}

export function validateReplacementBounds(auth, observed) {
  if (auth.status !== 'authorized' || auth.chainId !== 8453) throw new Error('Explicit Base Mainnet authorization required');
  validateReplacementIdentity({token: auth.token, poolId: auth.poolId, expectedToken: observed.token, expectedPoolId: observed.poolId});
  const bps = positive(auth.maxSlippageBps, 'maxSlippageBps', true);
  if (bps > 10000n) throw new Error('maxSlippageBps exceeds 10000');
  const principal = positive(observed.buyWethWei, 'buyWethWei');
  const sold = positive(observed.sellSentinelWei, 'sellSentinelWei');
  const gas = positive(observed.totalGasCostWei, 'totalGasCostWei', true);
  if (principal > positive(auth.maxWethPrincipalWei, 'maxWethPrincipalWei') ||
      principal > positive(auth.buyAmountWethWei, 'buyAmountWethWei')) throw new Error('WETH principal exceeds authorization');
  if (sold > positive(auth.sellAmountSentinelWei, 'sellAmountSentinelWei')) throw new Error('SENTINEL sell exceeds authorization');
  if (gas > positive(auth.maxTotalGasCostWei, 'maxTotalGasCostWei')) throw new Error('Gas exceeds authorization');
  // A receipt alone does not prove slippage. Require independently verified,
  // signed/recorded pretrade quote bounds for each leg, never infer them from Swap logs.
  for (const leg of ['buy', 'sell']) {
    const quote = observed.quotes?.[leg];
    if (!quote || quote.verified !== true || quote.route !== auth.approvedRoute ||
        quote.token?.toLowerCase() !== auth.token.toLowerCase() ||
        quote.poolId?.toLowerCase() !== auth.poolId.toLowerCase()) throw new Error(leg + ' trusted pretrade quote missing or mismatched');
    const expected = positive(quote.expectedOutputWei, leg + ' expectedOutputWei');
    const actual = positive(quote.actualOutputWei, leg + ' actualOutputWei', true);
    const shortfall = actual >= expected ? 0n : expected - actual;
    if (shortfall * 10000n > expected * bps) throw new Error(leg + ' slippage exceeds authorization');
  }
  return true;
}
