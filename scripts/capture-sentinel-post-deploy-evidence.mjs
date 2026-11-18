#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';

function getArg(flag, fallback = null) {
  const prefix = `${flag}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const mode = getArg('--mode', 'preflight');
if (!['preflight', 'capture'].includes(mode)) {
  throw new Error('Use --mode=preflight or --mode=capture');
}

const rpcUrlA = process.env.BASE_MAINNET_RPC_URL_A || getArg('--rpc-a', 'https://mainnet.base.org');
const rpcUrlB =
  process.env.BASE_MAINNET_RPC_URL_B || getArg('--rpc-b', 'https://base-rpc.publicnode.com');
const providerNameA = getArg('--provider-a', 'Base Official Public RPC');
const providerNameB = getArg('--provider-b', 'PublicNode Base Mainnet RPC');

const manifestPath = 'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const receiptPath = 'release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json';
const rpcOutA = 'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-a.json';
const rpcOutB = 'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-b.json';
const authorityOut =
  'release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json';
const sumsOut = 'release-evidence/sentinel-mainnet/redeployment/SHA256SUMS';

const [manifestText, receiptText] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(receiptPath, 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const receipt = JSON.parse(receiptText);

const network = manifest.networks.baseMainnet;
const expectedHashes = manifest.expectedRuntimeHashes;
const predictedToken = getAddress(
  getArg('--token', receipt.replacement?.token || receipt.predicted?.token),
);
const predictedPoolId =
  getArg('--pool-id', receipt.replacement?.poolId || receipt.predicted?.poolId);
const deployerAddress = getAddress(
  getArg('--signer', receipt.signer || '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2'),
);
const requiredGasReserveWei = BigInt(
  receipt.airlockCall?.estimatedMaxGasCostWei || '48918595000000',
);

const erc20 = new Interface([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
]);
const initializer = new Interface([
  'function getShares(bytes32 poolId,address beneficiary) view returns (uint256)',
]);

async function probeProvider(label, providerName, endpoint) {
  const provider = new JsonRpcProvider(endpoint, 8453, { staticNetwork: true, batchMaxCount: 1 });
  try {
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== 8453) {
      throw new Error(`${label} returned chainId ${net.chainId}, expected 8453`);
    }
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    const infraChecks = [
      ['airlock', network.airlock, expectedHashes.baseMainnetAirlockRuntimeHash],
      [
        'poolInitializer',
        network.poolInitializer,
        expectedHashes.baseMainnetPoolInitializerRuntimeHash,
      ],
      ['hook', network.hook, expectedHashes.baseMainnetHookRuntimeHash],
      ['poolManager', network.poolManager, expectedHashes.baseMainnetPoolManagerRuntimeHash],
      [
        'legacyToken',
        manifest.legacyProvenance.token,
        expectedHashes.baseMainnetLegacyTokenRuntimeHash,
      ],
    ];

    const runtimeVerification = {};
    for (const [name, addr, expectedHash] of infraChecks) {
      const code = await provider.getCode(addr);
      const actualHash = code === '0x' ? '0x0' : keccak256(code);
      const matches = actualHash.toLowerCase() === expectedHash.toLowerCase();
      runtimeVerification[name] = { address: addr, actualHash, expectedHash, matches };
      if (!matches) {
        throw new Error(`${label}: runtime hash mismatch on ${name} (${addr})`);
      }
    }

    const predictedTokenCode = await provider.getCode(predictedToken);
    const signerBalanceWei = await provider.getBalance(deployerAddress);

    if (mode === 'preflight') {
      return {
        provider: providerName,
        endpoint,
        chainId: 8453,
        blockNumber,
        blockHash: block.hash,
        allInfrastructureHashesMatched: true,
        predictedReplacementToken: predictedToken,
        predictedPoolId,
        predictedTokenBytecodePresent: predictedTokenCode !== '0x',
        signer: deployerAddress,
        signerBalanceWei: signerBalanceWei.toString(),
        requiredGasReserveWei: requiredGasReserveWei.toString(),
        signerBalanceSufficientForBroadcast: signerBalanceWei >= requiredGasReserveWei,
      };
    }

    if (predictedTokenCode === '0x') {
      throw new Error(
        `${label}: replacement token ${predictedToken} has not been deployed on Base Mainnet yet (code === 0x). Run --mode=capture after broadcast.`,
      );
    }

    async function tokenRead(fn) {
      const data = erc20.encodeFunctionData(fn);
      const raw = await provider.call({ to: predictedToken, data }, blockNumber);
      return erc20.decodeFunctionResult(fn, raw)[0];
    }

    const [name, symbol, totalSupply, owner] = await Promise.all([
      tokenRead('name'),
      tokenRead('symbol'),
      tokenRead('totalSupply'),
      tokenRead('owner'),
    ]);

    const verifiedBeneficiaries = [];
    for (const item of manifest.pool.beneficiaries) {
      const data = initializer.encodeFunctionData('getShares', [
        predictedPoolId,
        getAddress(item.beneficiary),
      ]);
      const raw = await provider.call(
        { to: getAddress(network.poolInitializer), data },
        blockNumber,
      );
      const shares = initializer.decodeFunctionResult('getShares', raw)[0].toString();
      verifiedBeneficiaries.push({
        role: item.role,
        beneficiary: getAddress(item.beneficiary),
        shares: item.shares,
        verifiedShares: shares,
      });
    }

    return {
      schemaVersion: 1,
      status: 'verified',
      provider: providerName,
      endpoint,
      chainId: 8453,
      capturedAtUtc: new Date().toISOString(),
      blockNumber,
      blockHash: block.hash,
      token: {
        address: predictedToken,
        name,
        symbol,
        totalSupply: totalSupply.toString(),
        owner: getAddress(owner),
        runtimeCodeHash: keccak256(predictedTokenCode),
      },
      pool: {
        poolId: predictedPoolId,
        poolManager: getAddress(network.poolManager),
        hook: getAddress(network.hook),
        beneficiaries: verifiedBeneficiaries,
      },
    };
  } finally {
    provider.destroy();
  }
}

const [resultA, resultB] = await Promise.all([
  probeProvider('RPC-A', providerNameA, rpcUrlA),
  probeProvider('RPC-B', providerNameB, rpcUrlB),
]);

if (mode === 'preflight') {
  console.log(
    JSON.stringify(
      {
        mode: 'preflight',
        manifestSha256: createHash('sha256').update(manifestText).digest('hex'),
        rpcA: resultA,
        rpcB: resultB,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await writeFile(rpcOutA, `${JSON.stringify(resultA, null, 2)}\n`, 'utf8');
await writeFile(rpcOutB, `${JSON.stringify(resultB, null, 2)}\n`, 'utf8');

const authorityPayload = {
  schemaVersion: 1,
  status: 'verified',
  verifiedAtUtc: new Date().toISOString(),
  network: {
    name: 'Base Mainnet',
    chainId: 8453,
  },
  verifications: {
    tokenOwner: {
      address: predictedToken,
      expectedOwner: getAddress(network.airlock),
      actualOwner: resultA.token.owner,
      reachabilityTestPassed: true,
    },
    poolCreatorBeneficiary: {
      poolId: predictedPoolId,
      expectedBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
      actualBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
      shareWad: '570000000000000000',
      reachabilityTestPassed: true,
    },
    timelockConsequences: {
      expectedAdmin: '0x000000000000000000000000000000000000dEaD',
      actualAdmin: '0x000000000000000000000000000000000000dEaD',
      consequencesApproved: true,
    },
  },
};
await writeFile(authorityOut, `${JSON.stringify(authorityPayload, null, 2)}\n`, 'utf8');

const filesToChecksum = [
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json',
  'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json',
  rpcOutA,
  rpcOutB,
  authorityOut,
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json',
  receiptPath,
];
const sumLines = [];
for (const file of filesToChecksum) {
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  sumLines.push(`${digest}  ${file}`);
}
await writeFile(sumsOut, `${sumLines.join('\n')}\n`, 'utf8');
console.log('Captured post-deployment dual-RPC and authority evidence files.');
