import hardhatModule from 'hardhat';
const hre = hardhatModule.default ?? hardhatModule;
import { Contract } from 'ethers';

/**
 * Add liquidity to Uniswap V3 pool for AETH token
 * This script creates a pool and adds initial liquidity
 */
let L2_ADDRESS;

async function addLiquidity() {
  const [deployer] = await hre.ethers.getSigners();
  L2_ADDRESS = deployer.address;
  console.log('Using bridge address as deployer:', L2_ADDRESS);
  console.log('Adding liquidity with account:', deployer.address);

  // Deploy or get SentinelToken
  const SentinelToken = await hre.ethers.getContractFactory('SentinelToken');
  const token = await SentinelToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('SentinelToken deployed to:', tokenAddress);

  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log(`Connected to chain ID: ${chainId.toString()}`);

  let WETH_ADDRESS, FACTORY_ADDRESS, POSITION_MANAGER;

  if (chainId === 84532n) {
    // Base Sepolia
    WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
    FACTORY_ADDRESS = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
    POSITION_MANAGER = '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2';
  } else if (chainId === 8453n) {
    // Base Mainnet
    WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
    FACTORY_ADDRESS = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
    POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
  } else {
    // Default to Base Sepolia
    WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
    FACTORY_ADDRESS = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
    POSITION_MANAGER = '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2';
  }

  // Get factory contract
  const factory = new Contract(
    FACTORY_ADDRESS,
    [
      'function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)',
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
    ],
    deployer
  );

  // Check if pool already exists
  let poolAddress = await factory.getPool(tokenAddress, WETH_ADDRESS, 3000);
  if (poolAddress === '0x0000000000000000000000000000000000000000') {
    console.log('Creating Uniswap V3 Pool...');
    const tx = await factory.createPool(tokenAddress, WETH_ADDRESS, 3000);
    await tx.wait();
    poolAddress = await factory.getPool(tokenAddress, WETH_ADDRESS, 3000);
  }
  console.log('Pool address:', poolAddress);

  // Initialize pool with price (1 AETH = 0.001 ETH)
  const pool = new Contract(
    poolAddress,
    [
      'function initialize(uint160 sqrtPriceX96) external',
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
    ],
    deployer
  );

  try {
    const slotData = await pool.slot0();
    if (slotData.sqrtPriceX96 === 0n || slotData.sqrtPriceX96 === 0) {
      const initialPrice = 79228162514264337593543950336n; // ~1:1000 ratio
      const initTx = await pool.initialize(initialPrice);
      await initTx.wait();
      console.log('Pool initialized successfully.');
    } else {
      console.log('Pool already initialized.');
    }
  } catch (err) {
    console.log('Error initializing pool (it might already be initialized):', err.message);
  }

  // Mint tokens to deployer
  await token.mint(L2_ADDRESS, hre.ethers.parseEther('1000000'));
  console.log('Minted 1M SENT to L2 address');

  // Get WETH and deposit 0.05 ETH
  const weth = new Contract(WETH_ADDRESS, ['function deposit() payable', 'function approve(address spender, uint256 amount) external returns (bool)'], deployer); // ethers.Contract is fine here
  const depositTx = await weth.deposit({ value: ethers.parseEther('0.05') });
  await depositTx.wait();
  console.log('Wrapped 0.05 ETH to WETH');

  // Approve tokens for Position Manager
  await token.approve(POSITION_MANAGER, ethers.parseEther('100000'));
  await weth.approve(POSITION_MANAGER, ethers.parseEther('0.05'));
  console.log('Approved tokens for Position Manager');

  // Add liquidity using NonfungiblePositionManager
  const positionManager = new Contract(
    POSITION_MANAGER,
    [
      'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    ],
    deployer
  );

  // Add liquidity around current price
  const params = {
    token0: tokenAddress < WETH_ADDRESS ? tokenAddress : WETH_ADDRESS,
    token1: tokenAddress < WETH_ADDRESS ? WETH_ADDRESS : tokenAddress,
    fee: 3000,
    tickLower: -60000, // Wide range for testing
    tickUpper: 60000, // Wide range for testing
    amount0Desired: tokenAddress < WETH_ADDRESS ? ethers.parseEther('10000') : ethers.parseEther('0.01'),
    amount1Desired: tokenAddress < WETH_ADDRESS ? ethers.parseEther('0.01') : ethers.parseEther('10000'),
    amount0Min: 0,
    amount1Min: 0,
    recipient: L2_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };

  const mintTx = await positionManager.mint(params);
  await mintTx.wait();
  console.log('Liquidity added successfully!');
}

addLiquidity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
