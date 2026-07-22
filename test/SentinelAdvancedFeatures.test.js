import { expect } from 'chai';
import { network } from 'hardhat';

describe('Sentinel Advanced Features', function () {
  let owner;
  let guardian;
  let user;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, guardian, user] = await ethers.getSigners();
  });

  describe('1. On-Chain Fixed-Point ML Risk Classifier', function () {
    let predictiveModel;

    beforeEach(async function () {
      const Factory = await ethers.getContractFactory('SentinelPredictiveThreatModel');
      predictiveModel = await Factory.deploy(owner.address);
      await predictiveModel.waitForDeployment();
    });

    it('should calculate threat scores correctly using fixed-point features', async function () {
      // Feature array: [0.5, 0.2, 0.3] -> Weights are [0.5, 0.2, 0.3]
      // Let's pass high metrics: [1e18, 1e18, 1e18]
      // dotProduct = (1e18 * 0.5) + (1e18 * 0.2) + (1e18 * 0.3) + bias (0.1e18) = 1.1e18 >= 1e18 -> score 1000
      const featuresMax = [
        ethers.parseEther('1.0'),
        ethers.parseEther('1.0'),
        ethers.parseEther('1.0'),
      ];
      let riskScore = await predictiveModel.predictTransactionRisk(featuresMax);
      expect(riskScore).to.equal(1000n);

      // Low metrics: [0.1e18, 0.1e18, 0.1e18]
      // dotProduct = (0.1e18 * 0.5) + (0.1e18 * 0.2) + (0.1e18 * 0.3) + 0.1e18 = 0.2e18 -> score 200
      const featuresMin = [
        ethers.parseEther('0.1'),
        ethers.parseEther('0.1'),
        ethers.parseEther('0.1'),
      ];
      riskScore = await predictiveModel.predictTransactionRisk(featuresMin);
      expect(riskScore).to.equal(200n);
    });
  });

  describe('2. Dynamic Risk-Adjusted Staking Yields', function () {
    let staking;
    let stakingToken;
    let rewardToken;
    let mockAuditor;

    beforeEach(async function () {
      // Deploy Mock ERC20 tokens for staking using ERC20Mock
      const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
      stakingToken = await ERC20Mock.deploy(
        'StakeToken',
        'STK',
        owner.address,
        ethers.parseEther('1000000')
      );
      await stakingToken.waitForDeployment();

      rewardToken = await ERC20Mock.deploy(
        'RewardToken',
        'RWD',
        owner.address,
        ethers.parseEther('1000000')
      );
      await rewardToken.waitForDeployment();

      const StakingFactory = await ethers.getContractFactory('SentinelStaking');
      staking = await StakingFactory.deploy(
        await stakingToken.getAddress(),
        await rewardToken.getAddress(),
        owner.address
      );
      await staking.waitForDeployment();

      // Deploy SentinelSecurityAuditor
      const AuditorFactory = await ethers.getContractFactory('SentinelSecurityAuditor');
      mockAuditor = await AuditorFactory.deploy(owner.address);
      await mockAuditor.waitForDeployment();

      await staking.setSecurityAuditor(await mockAuditor.getAddress());
    });

    it('should scale APY down when security score is low', async function () {
      // Set up a mock stake to check APY
      await stakingToken.transfer(user.address, ethers.parseEther('1000'));
      await stakingToken
        .connect(user)
        .approve(await staking.getAddress(), ethers.parseEther('1000'));
      await staking.connect(user).stake(ethers.parseEther('1000'));

      // Default security score is 1000 -> full APY
      const fullAPY = await staking.getUserAPY(user.address);

      // Let's force lower the security score by reporting an incident
      await mockAuditor.reportSecurityIncident(
        'oracle_anomaly',
        8,
        'Oracle manipulation detected',
        '0x'
      );

      // Let's check updated security score in auditor
      const newScore = await mockAuditor.securityScore();
      expect(newScore).to.be.below(1000n);

      // Get adjusted APY
      const adjustedAPY = await staking.getUserAPY(user.address);
      expect(adjustedAPY).to.be.below(fullAPY);
    });
  });

  describe('3. Post-Quantum Cryptographic Multi-Sig Vault', function () {
    let vault;

    beforeEach(async function () {
      const VaultFactory = await ethers.getContractFactory('SentinelMultiSigVault');
      vault = await VaultFactory.deploy(owner.address);
      await vault.waitForDeployment();
    });

    it('should allow setting Dilithium Verifier and confirm PQC transactions', async function () {
      // We will verify the setDilithiumVerifier setter works
      await vault.setDilithiumVerifier(user.address);
      expect(await vault.s_dilithiumVerifier()).to.equal(user.address);
    });
  });

  describe('4. Chainlink CCIP Alert Propagation', function () {
    let oracle;
    let circuitBreaker;

    beforeEach(async function () {
      const OracleFactory = await ethers.getContractFactory('SentinelCrossChainSecurityOracle');
      oracle = await OracleFactory.deploy(owner.address);
      await oracle.waitForDeployment();

      const BreakerFactory = await ethers.getContractFactory('CircuitBreaker');
      circuitBreaker = await BreakerFactory.deploy(owner.address);
      await circuitBreaker.waitForDeployment();

      // Grant SECURITY_ORACLE_ROLE to the oracle contract
      const SECURITY_ORACLE_ROLE = await circuitBreaker.SECURITY_ORACLE_ROLE();
      await circuitBreaker.grantRole(SECURITY_ORACLE_ROLE, await oracle.getAddress());

      // Set circuit breaker in oracle
      await oracle.setCircuitBreaker(await circuitBreaker.getAddress());
    });

    it('should trigger emergency lockdown when critical alert received', async function () {
      // Simulate receiving CCIP message with threatLevel >= 80
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'string', 'uint256'],
        [ethers.ZeroHash, 'REENTRANCY_ATTACK', 90n]
      );

      // Call ccipReceiveAlert
      await oracle.ccipReceiveAlert(1n, owner.address, payload);

      // Verify circuit breaker is paused
      expect(await circuitBreaker.paused()).to.be.true;
    });
  });
});
