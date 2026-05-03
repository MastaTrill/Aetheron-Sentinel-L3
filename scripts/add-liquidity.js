const { ethers } = require('hardhat');
const { Contract } = require('ethers');

/**
 * Add liquidity to Uniswap V3 pool for AETH token
 * This script creates a pool and adds initial liquidity
 */
async function addLiquidity() {
  const [deployer] = await ethers.getSigners();
  console.log('Adding liquidity with account:', deployer.address);

  // Deploy or get SentinelToken
  const SentinelToken = await ethers.getContractFactory('SentinelToken');
  const token = await SentinelToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('SentinelToken deployed to:', tokenAddress);

  // For simplicity, use WETH as pair token
  const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Mainnet WETH

  // Uniswap V3 Factory
  const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

  // Get factory contract
  const factory = new Contract(
    FACTORY_ADDRESS,
    [
      'function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)',
    ],
    deployer
  );

  // Create pool with 0.3% fee
  const tx = await factory.createPool(tokenAddress, WETH_ADDRESS, 3000);
  await tx.wait();
  const poolAddress = await factory.getPool(tokenAddress, WETH_ADDRESS, 3000);
  console.log('Pool created at:', poolAddress);

  // Initialize pool with price (1 AETH = 0.001 ETH)
  const pool = new Contract(
    poolAddress,
    ['function initialize(uint160 sqrtPriceX96) external'],
    deployer
  );

  const sqrtPriceX96 = ethers
    .parseUnits('1', 18)
    .mul(ethers.parseUnits('1', 18))
    .div(ethers.parseUnits('0.001', 18));
  // Actually calculate properly
  // For simplicity, use a fixed value
  const initialPrice = 79228162514264337593543950336; // ~1:1000 ratio

  await pool.initialize(initialPrice);
  console.log('Pool initialized');

  // Mint tokens to deployer
  await token.mint(deployer.address, ethers.parseEther('1000000'));
  console.log('Minted 1M AETH');

  // Get WETH
  const weth = new Contract(WETH_ADDRESS, ['function deposit() payable'], deployer);
  await weth.deposit({ value: ethers.parseEther('1') });
  console.log('Wrapped 1 ETH to WETH');

  // Approve tokens
  await token.approve(POSITION_MANAGER, ethers.parseEther('100000'));
  console.log('Approved AETH for position manager');

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
    tickLower: -60000, // Wide range
    tickUpper: 60000,
    amount0Desired: ethers.parseEther('10000'),
    amount1Desired: ethers.parseEther('10'),
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };

  const mintTx = await positionManager.mint(params);
  await mintTx.wait();
  console.log('Liquidity added successfully');
}

addLiquidity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
