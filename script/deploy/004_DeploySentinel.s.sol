// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import 'forge-std/console2.sol';

// ── Core ──
import { SentinelToken } from 'contracts/SentinelToken.sol';
import { SentinelCore } from 'contracts/SentinelCore.sol';
import { SentinelCoreLoop } from 'sentinel-l3-v1.0/contracts/SentinelCoreLoop.sol';
import { SentinelTimelock } from 'contracts/SentinelTimelock.sol';
import { SentinelGovernance } from 'contracts/SentinelGovernance.sol';
import { IVotes } from '@openzeppelin/contracts/governance/utils/IVotes.sol';
import { TimelockController } from '@openzeppelin/contracts/governance/TimelockController.sol';

// ── Security ──
import { SentinelInterceptor } from 'contracts/SentinelInterceptor.sol';
import { CircuitBreaker } from 'contracts/CircuitBreaker.sol';
import { RateLimiter } from 'contracts/RateLimiter.sol';
import { SentinelQuantumGuard } from 'contracts/SentinelQuantumGuard.sol';
import { SentinelSecurityAuditor } from 'contracts/SentinelSecurityAuditor.sol';
import { SentinelMonitor } from 'contracts/SentinelMonitor.sol';
import { SentinelMultiSigVault } from 'contracts/SentinelMultiSigVault.sol';

import { SentinelPredictiveThreatModel } from 'contracts/SentinelPredictiveThreatModel.sol';
import { SentinelHomomorphicEncryption } from 'contracts/SentinelHomomorphicEncryption.sol';
import { SentinelQuantumKeyDistribution } from 'contracts/SentinelQuantumKeyDistribution.sol';
import { SentinelQuantumNeural } from 'contracts/SentinelQuantumNeural.sol';
import { SentinelSecurityTokenization } from 'contracts/SentinelSecurityTokenization.sol';

import { SentinelZKIdentity } from 'contracts/SentinelZKIdentity.sol';
import { SentinelSocialRecovery } from 'contracts/SentinelSocialRecovery.sol';
import { SentinelZKOracle } from 'contracts/SentinelZKOracle.sol';
import { SentinelOracleNetwork } from 'contracts/SentinelOracleNetwork.sol';

import { SentinelChainlinkKeeper } from 'sentinel-l3-v1.0/contracts/SentinelChainlinkKeeper.sol';

// ── Bridge ──
import { AetheronBridge } from 'contracts/AetheronBridge.sol';

// ── DeFi ──
import { SentinelAMM } from 'contracts/SentinelAMM.sol';
import { SentinelStaking } from 'contracts/SentinelStaking.sol';
import { SentinelLiquidityMining } from 'contracts/SentinelLiquidityMining.sol';
import { SentinelRewardAggregator } from 'contracts/SentinelRewardAggregator.sol';
import { SentinelYieldMaximizer } from 'contracts/SentinelYieldMaximizer.sol';
import { SentinelReferralSystem } from 'contracts/SentinelReferralSystem.sol';

// ── Insurance ──
import { SentinelInsuranceProtocol } from 'contracts/SentinelInsuranceProtocol.sol';
import { SentinelInsuranceMarketplace } from 'contracts/SentinelInsuranceMarketplace.sol';
import { SentinelInsuranceMarketplace } from 'contracts/SentinelInsuranceMarketplace.sol';

contract DeploySentinel is Script {
    // ── Config loaded from env ──
    uint256 deployerPk;
    address owner;
    address[] relayers;
    address[] callers;
    address[] monitors;
    address[] reporters;
    address[] securityReporters;
    uint256 anomalyThreshold;
    uint256 tvlThreshold;
    bool autonomousMode;

    // ── Deployed addresses ──
    address public sentinelToken;
    address public sentinelTimelock;
    address public sentinelGovernance;
    address public sentinelCore;
    address public sentinelCoreLoop;
    address public sentinelQuantumGuard;
    address public sentinelInterceptor;
    address public circuitBreaker;
    address public rateLimiter;
    address public sentinelOracle;
    address public sentinelAuditor;
    address public sentinelMonitor;
    address public multiSigVault;
    address public yieldMaximizer;
    address public sentinelStaking;
    address public referralSystem;
    address public liquidityMining;
    address public rewardAggregator;
    address public aetheronBridge;
    address public sentinelAMM;
    address public insuranceProtocol;
    address public predictiveThreat;
    address public homomorphicEnc;
    address public quantumKDF;
    address public quantumNeural;
    address public zkIdentity;
    address public socialRecovery;
    address public zkOracle;
    address public securityTokenization;
    address public chainlinkKeeper;
    address public insuranceMarketplace;

    function _parseAddresses(string memory s) internal pure returns (address[] memory) {
        if (bytes(s).length == 0) return new address[](0);
        string[] memory parts = _splitString(s, ',');
        address[] memory addrs = new address[](parts.length);
        for (uint256 i = 0; i < parts.length; i++) {
            addrs[i] = vm.parseAddress(parts[i]);
        }
        return addrs;
    }

    function _splitString(string memory s, bytes1 sep) internal pure returns (string[] memory) {
        uint256 count = 1;
        for (uint256 i = 0; i < bytes(s).length; i++) {
            if (bytes(s)[i] == sep) count++;
        }
        string[] memory parts = new string[](count);
        uint256 idx = 0;
        uint256 start = 0;
        for (uint256 i = 0; i <= bytes(s).length; i++) {
            if (i == bytes(s).length || bytes(s)[i] == sep) {
                bytes memory part = new bytes(i - start);
                for (uint256 j = start; j < i; j++) {
                    part[j - start] = bytes(s)[j];
                }
                parts[idx++] = string(part);
                start = i + 1;
            }
        }
        return parts;
    }

    function _loadConfig() internal {
        deployerPk = vm.envUint('OWNER_PRIVATE_KEY');
        owner = vm.envAddress('SENTINEL_OWNER');

        relayers = _parseAddresses(vm.envString('RELAYER_ADDRESSES'));
        callers = _parseAddresses(vm.envString('CALLER_ADDRESSES'));
        monitors = _parseAddresses(vm.envString('MONITOR_ADDRESSES'));
        reporters = _parseAddresses(vm.envString('REPORTER_ADDRESSES'));
        securityReporters = _parseAddresses(vm.envString('SECURITY_REPORTER_ADDRESSES'));

        anomalyThreshold = vm.envUint('ANOMALY_THRESHOLD');
        tvlThreshold = vm.envUint('TVL_THRESHOLD_ETH');
        autonomousMode = vm.envBool('AUTONOMOUS_MODE');
    }

    function run() external {
        _loadConfig();

        uint256 chainId = block.chainid;
        console2.log('=== DeploySentinel ===');
        console2.log('ChainId:', chainId);
        console2.log('Deployer:', vm.addr(deployerPk));
        console2.log('Owner:', owner);

        vm.startBroadcast(deployerPk);

        // ════════════════════════════════════════
        //  Phase 1: Core Infrastructure
        // ════════════════════════════════════════

        vm.roll(1); // ensure non-zero nonce for deterministic if needed

        // 1.1 SentinelToken (mint to self)
        SentinelToken token = new SentinelToken(owner);
        sentinelToken = address(token);
        console2.log('SentinelToken:', sentinelToken);

        // 1.2 SentinelTimelock (2-day delay, owner as proposer/executor/admin)
        address[] memory proposers = new address[](1);
        proposers[0] = owner;
        SentinelTimelock timelock = new SentinelTimelock(
            172800,           // minDelay: 2 days
            proposers,        // proposers
            proposers,        // executors (same as proposers initially)
            owner             // admin
        );
        sentinelTimelock = address(timelock);
        console2.log('SentinelTimelock:', sentinelTimelock);

        // 1.3 SentinelGovernance (token + timelock)
        SentinelGovernance governance = new SentinelGovernance(IVotes(sentinelToken), TimelockController(payable(sentinelTimelock)));
        sentinelGovernance = address(governance);
        console2.log('SentinelGovernance:', sentinelGovernance);

        // 1.4 SentinelCore
        SentinelCore core = new SentinelCore(owner);
        sentinelCore = address(core);
        console2.log('SentinelCore:', sentinelCore);

        // 1.5 SentinelCoreLoop
        SentinelCoreLoop coreLoop = new SentinelCoreLoop(owner);
        sentinelCoreLoop = address(coreLoop);
        console2.log('SentinelCoreLoop:', sentinelCoreLoop);

        // ════════════════════════════════════════
        //  Phase 2: Quantum Security Stack
        // ════════════════════════════════════════

        SentinelQuantumGuard qGuard = new SentinelQuantumGuard(owner);
        sentinelQuantumGuard = address(qGuard);
        console2.log('SentinelQuantumGuard:', sentinelQuantumGuard);

        SentinelInterceptor interceptor = new SentinelInterceptor(
            anomalyThreshold,
            tvlThreshold,
            autonomousMode,
            owner
        );
        sentinelInterceptor = address(interceptor);
        console2.log('SentinelInterceptor:', sentinelInterceptor);

        CircuitBreaker cBreaker = new CircuitBreaker(owner);
        circuitBreaker = address(cBreaker);
        console2.log('CircuitBreaker:', circuitBreaker);

        RateLimiter rLimiter = new RateLimiter(owner);
        rateLimiter = address(rLimiter);
        console2.log('RateLimiter:', rateLimiter);

        // ════════════════════════════════════════
        //  Phase 3: Oracle & Auditor
        // ════════════════════════════════════════

        SentinelOracleNetwork oracleNet = new SentinelOracleNetwork(owner);
        sentinelOracle = address(oracleNet);
        console2.log('SentinelOracleNetwork:', sentinelOracle);

        SentinelSecurityAuditor auditor = new SentinelSecurityAuditor(owner);
        sentinelAuditor = address(auditor);
        console2.log('SentinelSecurityAuditor:', sentinelAuditor);

        SentinelMonitor monitor = new SentinelMonitor(owner);
        sentinelMonitor = address(monitor);
        console2.log('SentinelMonitor:', sentinelMonitor);

        SentinelMultiSigVault vault = new SentinelMultiSigVault(owner);
        multiSigVault = address(vault);
        console2.log('SentinelMultiSigVault:', multiSigVault);

        // ════════════════════════════════════════
        //  Phase 4: Yield & Staking
        // ════════════════════════════════════════

        SentinelYieldMaximizer yMax = new SentinelYieldMaximizer(owner);
        yieldMaximizer = address(yMax);
        console2.log('SentinelYieldMaximizer:', yieldMaximizer);

        SentinelStaking staking = new SentinelStaking(sentinelToken, sentinelToken, owner);
        sentinelStaking = address(staking);
        console2.log('SentinelStaking:', sentinelStaking);

        SentinelReferralSystem referral = new SentinelReferralSystem(sentinelToken, owner);
        referralSystem = address(referral);
        console2.log('SentinelReferralSystem:', referralSystem);

        // LiquidityMining — skip LP token for now (set to SentinelToken as placeholder)
        SentinelLiquidityMining lMine = new SentinelLiquidityMining(
            sentinelToken,
            sentinelToken,
            0,    // rewardPerSecond = 0 (manual distribution)
            owner
        );
        liquidityMining = address(lMine);
        console2.log('SentinelLiquidityMining:', liquidityMining);

        SentinelRewardAggregator rAgg = new SentinelRewardAggregator(
            sentinelStaking,
            liquidityMining,
            sentinelToken,
            referralSystem
        );
        rewardAggregator = address(rAgg);
        console2.log('SentinelRewardAggregator:', rewardAggregator);

        // ════════════════════════════════════════
        //  Phase 5: Bridge
        // ════════════════════════════════════════

        AetheronBridge bridge = new AetheronBridge(owner);
        aetheronBridge = address(bridge);
        console2.log('AetheronBridge:', aetheronBridge);

        // ════════════════════════════════════════
        //  Phase 6: AMM
        // ════════════════════════════════════════

        SentinelAMM amm = new SentinelAMM(owner);
        sentinelAMM = address(amm);
        console2.log('SentinelAMM:', sentinelAMM);

        // ════════════════════════════════════════
        //  Phase 7: Insurance
        // ════════════════════════════════════════

        SentinelInsuranceProtocol insProtocol = new SentinelInsuranceProtocol(
            sentinelCore,
            sentinelAuditor,
            owner
        );
        insuranceProtocol = address(insProtocol);
        console2.log('SentinelInsuranceProtocol:', insuranceProtocol);

        // ════════════════════════════════════════
        //  Phase 7b: Insurance Marketplace
        // ════════════════════════════════════════

        SentinelInsuranceMarketplace insMarketplace = new SentinelInsuranceMarketplace(
            sentinelToken,
            insuranceProtocol,
            owner
        );
        insuranceMarketplace = address(insMarketplace);
        console2.log('SentinelInsuranceMarketplace:', insuranceMarketplace);

        // ════════════════════════════════════════
        //  Phase 8: Predictive & Quantum Modules
        // ════════════════════════════════════════

        SentinelPredictiveThreatModel pThreat = new SentinelPredictiveThreatModel(owner);
        predictiveThreat = address(pThreat);
        console2.log('SentinelPredictiveThreatModel:', predictiveThreat);

        SentinelHomomorphicEncryption hEnc = new SentinelHomomorphicEncryption(owner);
        homomorphicEnc = address(hEnc);
        console2.log('SentinelHomomorphicEncryption:', homomorphicEnc);

        SentinelQuantumKeyDistribution qkd = new SentinelQuantumKeyDistribution(owner);
        quantumKDF = address(qkd);
        console2.log('SentinelQuantumKeyDistribution:', quantumKDF);

        SentinelQuantumNeural qNeural = new SentinelQuantumNeural(owner);
        quantumNeural = address(qNeural);
        console2.log('SentinelQuantumNeural:', quantumNeural);

        // ════════════════════════════════════════
        //  Phase 9: ZK Modules
        // ════════════════════════════════════════

        SentinelZKIdentity zkID = new SentinelZKIdentity(owner);
        zkIdentity = address(zkID);
        console2.log('SentinelZKIdentity:', zkIdentity);

        SentinelSocialRecovery sRecovery = new SentinelSocialRecovery(zkIdentity, owner);
        socialRecovery = address(sRecovery);
        console2.log('SentinelSocialRecovery:', socialRecovery);

        SentinelZKOracle zkOra = new SentinelZKOracle(owner);
        zkOracle = address(zkOra);
        console2.log('SentinelZKOracle:', zkOracle);

        // ════════════════════════════════════════
        //  Phase 10: Keeper + Misc
        // ════════════════════════════════════════

        SentinelChainlinkKeeper keeper = new SentinelChainlinkKeeper(sentinelCore);
        chainlinkKeeper = address(keeper);
        console2.log('SentinelChainlinkKeeper:', chainlinkKeeper);

        SentinelSecurityTokenization sToken = new SentinelSecurityTokenization();
        securityTokenization = address(sToken);
        console2.log('SentinelSecurityTokenization:', securityTokenization);

        // ════════════════════════════════════════
        //  Post-Deploy: Authorization Wiring
        // ════════════════════════════════════════

        // Grant governance roles on timelock
        timelock.grantRole(timelock.PROPOSER_ROLE(), sentinelGovernance);
        timelock.grantRole(timelock.CANCELLER_ROLE(), sentinelGovernance);
        timelock.grantRole(timelock.EXECUTOR_ROLE(), sentinelGovernance);
        // Renounce admin role from deployer — governance is now in control
        timelock.renounceRole(timelock.TIMELOCK_ADMIN_ROLE(), owner);
        console2.log('Governance roles granted, admin renounced');

        // Authorize contracts in monitor
        monitor.authorizeContract(sentinelInterceptor);
        monitor.authorizeContract(aetheronBridge);
        monitor.authorizeContract(circuitBreaker);
        monitor.authorizeContract(rateLimiter);
        monitor.authorizeContract(sentinelQuantumGuard);
        monitor.authorizeContract(sentinelStaking);
        monitor.authorizeContract(liquidityMining);
        monitor.authorizeContract(rewardAggregator);
        monitor.authorizeContract(sentinelAMM);
        monitor.authorizeContract(insuranceProtocol);
        monitor.authorizeContract(multiSigVault);
        console2.log('Monitor authorized');

        // Wire core loop components
        coreLoop.setSystemComponent('sentinelInterceptor', sentinelInterceptor);
        coreLoop.setSystemComponent('aetheronBridge', aetheronBridge);
        coreLoop.setSystemComponent('rateLimiter', rateLimiter);
        coreLoop.setSystemComponent('circuitBreaker', circuitBreaker);
        coreLoop.setSystemComponent('quantumGuard', sentinelQuantumGuard);
        coreLoop.setSystemComponent('yieldMaximizer', yieldMaximizer);
        coreLoop.setSystemComponent('oracleNetwork', sentinelOracle);
        coreLoop.setSystemComponent('sentinelStaking', sentinelStaking);
        coreLoop.setSystemComponent('liquidityMining', liquidityMining);
        coreLoop.setSystemComponent('rewardAggregator', rewardAggregator);
        coreLoop.setSystemComponent('sentinelAMM', sentinelAMM);
        coreLoop.setSystemComponent('insuranceProtocol', insuranceProtocol);
        coreLoop.setSystemComponent('predictiveThreat', predictiveThreat);
        coreLoop.setSystemComponent('chainlinkKeeper', chainlinkKeeper);
        console2.log('CoreLoop wired');

        // Set relayers on bridge
        for (uint256 i = 0; i < relayers.length; i++) {
            bridge.setRelayer(relayers[i], true);
        }

        // Set callers on rate limiter
        for (uint256 i = 0; i < callers.length; i++) {
            rLimiter.setCaller(callers[i], true);
        }

        // Grant monitor role and add reporters on interceptor
        bytes32 monitorRole = interceptor.MONITOR_ROLE();
        for (uint256 i = 0; i < monitors.length; i++) {
            interceptor.grantRole(monitorRole, monitors[i]);
        }
        for (uint256 i = 0; i < reporters.length; i++) {
            interceptor.addReporter(reporters[i]);
        }

        // Set security reporters on token
        for (uint256 i = 0; i < securityReporters.length; i++) {
            token.setSecurityReporter(securityReporters[i], true);
        }

        vm.stopBroadcast();

        // ════════════════════════════════════════
        //  Summary
        // ════════════════════════════════════════
        console2.log('');
        console2.log('=== DEPLOYMENT COMPLETE ===');
        console2.log('SentinelToken:          ', sentinelToken);
        console2.log('SentinelTimelock:       ', sentinelTimelock);
        console2.log('SentinelGovernance:     ', sentinelGovernance);
        console2.log('SentinelCore:           ', sentinelCore);
        console2.log('SentinelCoreLoop:       ', sentinelCoreLoop);
        console2.log('SentinelQuantumGuard:   ', sentinelQuantumGuard);
        console2.log('SentinelInterceptor:    ', sentinelInterceptor);
        console2.log('CircuitBreaker:         ', circuitBreaker);
        console2.log('RateLimiter:            ', rateLimiter);
        console2.log('SentinelOracleNetwork:  ', sentinelOracle);
        console2.log('SentinelSecurityAuditor:', sentinelAuditor);
        console2.log('SentinelMonitor:        ', sentinelMonitor);
        console2.log('SentinelMultiSigVault:  ', multiSigVault);
        console2.log('SentinelYieldMaximizer: ', yieldMaximizer);
        console2.log('SentinelStaking:        ', sentinelStaking);
        console2.log('SentinelReferralSystem: ', referralSystem);
        console2.log('SentinelLiquidityMining:', liquidityMining);
        console2.log('SentinelRewardAggregator:', rewardAggregator);
        console2.log('AetheronBridge:         ', aetheronBridge);
        console2.log('SentinelAMM:            ', sentinelAMM);
        console2.log('InsuranceProtocol:      ', insuranceProtocol);
        console2.log('InsuranceMarketplace:   ', insuranceMarketplace);
        console2.log('PredictiveThreat:       ', predictiveThreat);
        console2.log('HomomorphicEnc:         ', homomorphicEnc);
        console2.log('QuantumKDF:             ', quantumKDF);
        console2.log('QuantumNeural:          ', quantumNeural);
        console2.log('ZKIdentity:             ', zkIdentity);
        console2.log('SocialRecovery:         ', socialRecovery);
        console2.log('ZKOracle:               ', zkOracle);
        console2.log('SecurityTokenization:   ', securityTokenization);
        console2.log('ChainlinkKeeper:        ', chainlinkKeeper);
    }
}
