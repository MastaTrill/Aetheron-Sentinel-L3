import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.mainnet' });

async function main() {
    const targetOwner = process.env.SENTINEL_OWNER;
    const treasuryAddr = process.env.SENTINEL_TREASURY || '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa';
    const timelockAddr = process.env.SENTINEL_TIMELOCK;
    const governanceAddr = process.env.SENTINEL_GOVERNANCE;
    const addresses = JSON.parse(fs.readFileSync('./DEPLOYED_ADDRESSES.json', 'utf8'));
    const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);

    console.log(`Starting Ownership Audit... Target: ${targetOwner}\n`);

    const ROLES = {
        DEFAULT_ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000',
        TIMELOCK_ADMIN: ethers.id('TIMELOCK_ADMIN_ROLE'),
        PROPOSER: ethers.id('PROPOSER_ROLE'),
        EXECUTOR: ethers.id('EXECUTOR_ROLE'),
        CANCELLER: ethers.id('CANCELLER_ROLE')
    };

    const TREASURY_ROUTED = [
        'AetheronBridge',
        'SentinelOracleNetwork',
        'SentinelZKOracle',
        'SentinelAMM',
        'SentinelInsuranceProtocol',
        'SentinelReferralSystem',
        'SentinelStaking',
        'SentinelRewardAggregator',
        'SentinelSecurityTokenization'
    ];

    const contracts = [
        'SentinelToken', 'AetheronBridge', 'SentinelInterceptor', 'CircuitBreaker', 'RateLimiter',
        'SentinelMonitor', 'SentinelQuantumGuard', 'SentinelCoreLoop', 'SentinelYieldMaximizer',
        'SentinelAMM', 'SentinelPredictiveThreatModel', 'SentinelOracleNetwork', 'SentinelMultiSigVault',
        'SentinelZKOracle', 'SentinelInsuranceProtocol', 'SentinelHomomorphicEncryption',
        'SentinelReferralSystem', 'SentinelQuantumKeyDistribution', 'SentinelQuantumNeural',
        'SentinelZKIdentity', 'SentinelSocialRecovery', 'SentinelStaking',
        'SentinelRewardAggregator', 'SentinelSecurityTokenization'
    ];

    let failures = 0;

    for (const name of contracts) {
        if (!addresses[name]) continue;

        const contract = new ethers.Contract(
            addresses[name],
            ['function owner() view returns (address)', 'function pendingOwner() view returns (address)'],
            provider
        );

        try {
            const currentOwner = await contract.owner();
            const isTreasuryRouted = TREASURY_ROUTED.includes(name);
            const expectedOwner = isTreasuryRouted ? treasuryAddr : targetOwner;

            const status = currentOwner.toLowerCase() === expectedOwner.toLowerCase() ? '✅' : `❌ WRONG OWNER (Expected ${isTreasuryRouted ? 'Treasury' : 'Admin'})`;
            if (status.includes('❌')) failures++;

            console.log(`${name.padEnd(25)}: ${currentOwner} ${status}`);

            // Check for pending transfers if your contracts use Ownable2Step
            try {
                const pending = await contract.pendingOwner();
                if (pending !== ethers.ZeroAddress) {
                    const isTreasury = pending.toLowerCase() === treasuryAddr.toLowerCase();
                    console.log(`  ⚠️  PENDING TRANSFER: ${pending} (${isTreasury ? 'Treasury' : 'Unknown'})`);
                    console.log(`     > Action Required: Target must call acceptOwnership()`);
                }
            } catch (e) { /* Not 2-step */ }

        } catch (err) {
            console.log(`${name.padEnd(25)}: Failed to query`);
        }
    }

    if (timelockAddr) {
        console.log(`\n--- Timelock Role Audit (${timelockAddr}) ---`);
        const timelock = new ethers.Contract(timelockAddr, [
            'function hasRole(bytes32 role, address account) view returns (bool)',
            'function getMinDelay() view returns (uint256)'
        ], provider);

        const checkRole = async (roleName, roleHash, account, expected) => {
            const has = await timelock.hasRole(roleHash, account);
            const status = has === expected ? '✅' : '❌';
            if (has !== expected) failures++;
            console.log(`  ${roleName.padEnd(15)} for ${account.slice(0, 10)}...: ${status}`);
        };

        // Multisig (targetOwner) should be Admin, Proposer, and Canceller
        await checkRole('ADMIN', ROLES.DEFAULT_ADMIN, targetOwner, true);
        await checkRole('TIMELOCK_ADMIN', ROLES.TIMELOCK_ADMIN, targetOwner, true);
        await checkRole('PROPOSER', ROLES.PROPOSER, targetOwner, true);
        await checkRole('CANCELLER', ROLES.CANCELLER, targetOwner, true);

        // Governance should be Proposer and Canceller
        if (governanceAddr) {
            await checkRole('GOV_PROPOSER', ROLES.PROPOSER, governanceAddr, true);
            await checkRole('GOV_CANCELLER', ROLES.CANCELLER, governanceAddr, true);
        }

        // Executor role: Ensure it's NOT open to public addresses (ethers.ZeroAddress) unless explicitly intended.
        // If it's intended to be open, this check should be adjusted or a specific executor address should be set.
        // For "not unintentionally open", we assert it should be false for ZeroAddress.
        await checkRole('EXECUTOR_OPEN_TO_ANYONE', ROLES.EXECUTOR, ethers.ZeroAddress, false);
        // Further checks could be added here to verify specific executor addresses if they are expected.

        const minDelay = await timelock.getMinDelay();
        const EXPECTED_MIN_DELAY = 172800n; // 2 days as per whitepaper/preflight specs
        const delayOk = minDelay === EXPECTED_MIN_DELAY ? '✅' : `❌ (Expected ${EXPECTED_MIN_DELAY})`;

        if (minDelay !== EXPECTED_MIN_DELAY) failures++;
        console.log(`  Min Delay     : ${minDelay.toString().padEnd(10)} ${delayOk}`);
    }

    if (governanceAddr) {
        console.log(`\n--- Governance Parameters Audit (${governanceAddr}) ---`);
        const governance = new ethers.Contract(governanceAddr, [
            'function votingDelay() view returns (uint256)',
            'function votingPeriod() view returns (uint256)',
            'function quorumNumerator() view returns (uint256)',
            'function proposalThreshold() view returns (uint256)',
            'function token() view returns (address)'
        ], provider);

        try {
            const delay = await governance.votingDelay();
            const period = await governance.votingPeriod();
            const quorum = await governance.quorumNumerator();
            const threshold = await governance.proposalThreshold();
            const govToken = await governance.token();

            const EXPECTED_DELAY = 7200n;
            const EXPECTED_PERIOD = 50400n;
            const EXPECTED_QUORUM = 4n; // 4% Quorum
            const EXPECTED_THRESHOLD = ethers.parseUnits('1000', 18); // 1000 SENT Tokens
            const targetToken = addresses['SentinelToken'];

            const dOk = delay === EXPECTED_DELAY ? '✅' : `❌ (Expected ${EXPECTED_DELAY})`;
            const pOk = period === EXPECTED_PERIOD ? '✅' : `❌ (Expected ${EXPECTED_PERIOD})`;
            const qOk = quorum === EXPECTED_QUORUM ? '✅' : `❌ (Expected ${EXPECTED_QUORUM})`;
            const tOk = threshold === EXPECTED_THRESHOLD ? '✅' : `❌ (Expected ${ethers.formatUnits(EXPECTED_THRESHOLD, 18)})`;
            const tokenOk = govToken.toLowerCase() === targetToken.toLowerCase() ? '✅' : `❌ (Expected ${targetToken})`;

            if (delay !== EXPECTED_DELAY || period !== EXPECTED_PERIOD || quorum !== EXPECTED_QUORUM || threshold !== EXPECTED_THRESHOLD || govToken.toLowerCase() !== targetToken.toLowerCase()) failures++;

            console.log(`  Voting Delay  : ${delay.toString().padEnd(10)} ${dOk}`);
            console.log(`  Voting Period : ${period.toString().padEnd(10)} ${pOk}`);
            console.log(`  Quorum %      : ${quorum.toString().padEnd(10)} ${qOk}`);
            console.log(`  Threshold     : ${ethers.formatUnits(threshold, 18).padEnd(10)} ${tOk}`);
            console.log(`  Gov Token     : ${govToken.slice(0, 10)}... ${tokenOk}`);
        } catch (e) {
            console.log(`  Governance parameters query failed`);
            failures++;
        }
    }

    if (failures > 0) {
        console.log(`\n🚨 Audit Failed with ${failures} errors.`);
        process.exit(1);
    } else {
        console.log(`\n✨ All Ownership and Governance checks passed.`);
    }
}

main().catch(console.error);