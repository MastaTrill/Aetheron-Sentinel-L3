// Replacement-only SENTINEL smoke-test policy. Pure functions; no RPC or signing.
export const LEGACY_TOKEN = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';
export const LEGACY_POOL = '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d';
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
  if ([poolId, expectedPoolId].some(x => x.toLowerCase() === LEGACY_POOL)) throw new Error('Legacy SENTINEL pool is forbidden');
  if (token.toLowerCase() !== expectedToken.toLowerCase() || poolId.toLowerCase() !== expectedPoolId.toLowerCase()) throw new Error('Replacement identity mismatch');
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
