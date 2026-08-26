// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title SentinelCompoundMonitor
 * @notice Security monitoring for Compound lending protocol
 * Detects anomalous lending/borrowing patterns and flash loan attacks
 */
contract SentinelCompoundMonitor is Ownable, ReentrancyGuard {
  // Compound contract interfaces
  IComptroller public immutable comptroller;
  ICEther public immutable cEther;
  IPriceOracle public immutable priceOracle;

  // Security thresholds
  uint256 public constant LARGE_BORROW_THRESHOLD = 1000000 ether; // $1M
  uint256 public constant FLASH_LOAN_THRESHOLD = 500000 ether; // $500K
  uint256 public constant LIQUIDATION_THRESHOLD = 0.8 ether; // 80% LTV

  // Anomaly tracking
  struct LendingAnomaly {
    address user;
    address cToken;
    uint256 amount;
    uint256 timestamp;
    AnomalyType anomalyType;
  }

  enum AnomalyType {
    LARGE_BORROW,
    FLASH_LOAN_ATTACK,
    LIQUIDATION_RISK,
    PRICE_MANIPULATION
  }

  LendingAnomaly[] public anomalies;
  mapping(address => uint256) public userAnomalyCount;
  mapping(bytes32 => bool) public knownFlashLoans;

  event AnomalyDetected(
    address indexed user,
    address indexed cToken,
    uint256 amount,
    AnomalyType anomalyType,
    uint256 severity
  );

  event LiquidationAlert(
    address indexed borrower,
    uint256 collateralValue,
    uint256 debtValue,
    uint256 healthFactor
  );

  constructor(address _comptroller, address _cEther, address _priceOracle) Ownable(msg.sender) {
    comptroller = IComptroller(_comptroller);
    cEther = ICEther(_cEther);
    priceOracle = IPriceOracle(_priceOracle);
  }

  /**
   * @notice Monitor lending activity
   */
  function monitorLendingActivity(
    address user,
    address cToken,
    uint256 amount,
    bool isBorrow
  ) external {
    // Check for large borrows
    if (isBorrow && amount > LARGE_BORROW_THRESHOLD) {
      _recordAnomaly(user, cToken, amount, AnomalyType.LARGE_BORROW);
    }

    // Check for flash loan patterns
    if (_isFlashLoanPattern(user, amount)) {
      _recordAnomaly(user, cToken, amount, AnomalyType.FLASH_LOAN_ATTACK);
    }

    // Check liquidation risk
    _checkLiquidationRisk(user);
  }

  /**
   * @notice Check user's liquidation risk
   */
  function _checkLiquidationRisk(address user) internal {
    (uint256 collateralValue, uint256 debtValue, uint256 healthFactor) = _calculateHealthFactor(
      user
    );

    if (healthFactor < LIQUIDATION_THRESHOLD) {
      emit LiquidationAlert(user, collateralValue, debtValue, healthFactor);
    }
  }

  /**
   * @notice Calculate health factor for user
   */
  function _calculateHealthFactor(
    address user
  ) internal view returns (uint256 collateralValue, uint256 debtValue, uint256 healthFactor) {
    // Get user's account liquidity
    (uint256 error, uint256 liquidity, uint256 shortfall) = comptroller.getAccountLiquidity(user);

    require(error == 0, 'Comptroller error');

    if (shortfall > 0) {
      healthFactor = 0; // Already underwater
    } else {
      // Simplified health factor calculation
      healthFactor = liquidity > 0 ? 1 ether : 0;
    }

    return (0, 0, healthFactor); // Placeholder
  }

  /**
   * @notice Detect flash loan patterns
   */
  function _isFlashLoanPattern(address, uint256 amount) internal pure returns (bool) {
    // Check for rapid borrow-repay patterns
    // This would require transaction history analysis
    return amount > FLASH_LOAN_THRESHOLD;
  }

  /**
   * @notice Record security anomaly
   */
  function _recordAnomaly(
    address user,
    address cToken,
    uint256 amount,
    AnomalyType anomalyType
  ) internal {
    anomalies.push(
      LendingAnomaly({
        user: user,
        cToken: cToken,
        amount: amount,
        timestamp: block.timestamp,
        anomalyType: anomalyType
      })
    );

    userAnomalyCount[user]++;

    uint256 severity = _calculateSeverity(anomalyType, amount);

    emit AnomalyDetected(user, cToken, amount, anomalyType, severity);
  }

  /**
   * @notice Calculate anomaly severity
   */
  function _calculateSeverity(
    AnomalyType anomalyType,
    uint256 amount
  ) internal pure returns (uint256) {
    if (anomalyType == AnomalyType.FLASH_LOAN_ATTACK) return 9;
    if (anomalyType == AnomalyType.LARGE_BORROW && amount > 5000000 ether) return 8;
    if (anomalyType == AnomalyType.LIQUIDATION_RISK) return 7;
    return 5;
  }

  /**
   * @notice Get anomalies for user
   */
  function getUserAnomalies(address user) external view returns (LendingAnomaly[] memory) {
    uint256 count = userAnomalyCount[user];
    LendingAnomaly[] memory userAnomalies = new LendingAnomaly[](count);

    uint256 index = 0;
    for (uint256 i = 0; i < anomalies.length && index < count; i++) {
      if (anomalies[i].user == user) {
        userAnomalies[index] = anomalies[i];
        index++;
      }
    }

    return userAnomalies;
  }

  /**
   * @notice Emergency pause for high-severity anomalies
   */
  function emergencyPause(address cToken) external onlyOwner {
    // Implementation would pause the cToken contract
    // This is a simplified version
  }
}

// Compound interface definitions
interface IComptroller {
  function getAccountLiquidity(address account) external view returns (uint256, uint256, uint256);
}

interface ICEther {
  function borrow(uint256 borrowAmount) external returns (uint256);

  function repayBorrow() external payable;
}

interface IPriceOracle {
  function getUnderlyingPrice(address cToken) external view returns (uint256);
}
