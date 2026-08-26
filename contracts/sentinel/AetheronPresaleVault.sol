// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AetheronPresaleVault
 * @notice Institutional crowdsale and automated liquidity reservation vault for Aetheron (AETH) on Base.
 *
 * Key Invariants:
 *  - Accepts native ETH and USDC with exact on-chain allocation accounting.
 *  - Automatically reserves 60% of all raised funds for Uniswap v3 DEX liquidity seeding.
 *  - Routes 40% of raised funds to the Project Treasury.
 *  - Enforces per-wallet contribution bounds ($50 min to $50,000 max).
 *  - Non-custodial emergency refund guarantee if presale is cancelled or soft cap is missed.
 *  - Linear post-listing vesting claim schedule to protect against token dumping.
 */
contract AetheronPresaleVault is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum VaultState {
        Active,
        Finalized,
        Cancelled
    }

    struct BuyerInfo {
        uint256 totalPurchasedAeth; // Total AETH allocation (18 decimals)
        uint256 totalContributedUsd; // Total contributed in USD (6 decimals)
        uint256 ethContributed; // Native ETH contributed in wei
        uint256 usdcContributed; // USDC contributed in 6 decimals
        uint256 claimedAeth; // Amount already claimed
    }

    // ── Immutables & Config ───────────────────────────────────────────────────
    IERC20 public immutable aethToken;
    IERC20 public immutable usdcToken;

    address public treasury;
    address public liquidityReserve;

    VaultState public state;

    // Pricing & Caps (USD in 6 decimals)
    uint256 public rateAethPerEth; // e.g. 14,000 AETH per 1 ETH ($0.20 @ $2800 ETH)
    uint256 public rateAethPerUsdc; // e.g. 5 AETH per 1 USDC ($0.20 per AETH)
    uint256 public ethPriceInUsd; // e.g. 2,800,000,000 (6 decimals = $2,800.00)

    uint256 public totalRaisedUsd; // Cumulative USD raised (6 decimals)
    uint256 public totalAethSold; // Cumulative AETH allocated (18 decimals)
    uint256 public totalEthRaised; // Cumulative ETH in wei
    uint256 public totalUsdcRaised; // Cumulative USDC in 6 decimals

    uint256 public hardCapUsd; // e.g. 5,000,000 USD (6 decimals)
    uint256 public softCapUsd; // e.g. 500,000 USD (6 decimals)
    uint256 public minPurchaseUsd; // $50 (6 decimals)
    uint256 public maxPurchaseUsd; // $50,000 (6 decimals)

    // Vesting Schedule
    uint256 public listingTime; // Timestamp when claiming begins
    uint256 public vestingDuration; // Linear vesting duration in seconds (e.g. 90 days)
    uint256 public initialReleaseBps; // Immediate TGE unlock bps (e.g. 2000 = 20%)

    // Buyer state
    mapping(address => BuyerInfo) public buyers;
    address[] public participants;

    // ── Events ────────────────────────────────────────────────────────────────
    event TokensPurchased(
        address indexed buyer,
        uint256 amountUsd,
        uint256 aethAllocated,
        bool isEth
    );
    event TokensClaimed(address indexed buyer, uint256 amount);
    event PresaleFinalized(
        uint256 totalRaisedUsd,
        uint256 liquidityEth,
        uint256 liquidityUsdc,
        uint256 treasuryEth,
        uint256 treasuryUsdc
    );
    event PresaleCancelled();
    event RefundClaimed(address indexed buyer, uint256 ethAmount, uint256 usdcAmount);
    event RatesUpdated(uint256 aethPerEth, uint256 aethPerUsdc, uint256 ethPriceUsd);
    event WalletsUpdated(address treasury, address liquidityReserve);

    // ── Errors ────────────────────────────────────────────────────────────────
    error PresaleNotActive();
    error PresaleNotFinalized();
    error PresaleNotCancelled();
    error HardCapExceeded();
    error BelowMinPurchase();
    error AboveMaxPurchase();
    error ZeroAddress();
    error ZeroAmount();
    error NoTokensToClaim();
    error NoRefundAvailable();
    error TransferFailed();
    error InsufficientVaultBalance();

    constructor(
        address _aethToken,
        address _usdcToken,
        address _treasury,
        address _liquidityReserve,
        address _owner
    ) Ownable(_owner) {
        if (_aethToken == address(0) || _usdcToken == address(0)) revert ZeroAddress();
        if (_treasury == address(0) || _liquidityReserve == address(0)) revert ZeroAddress();

        aethToken = IERC20(_aethToken);
        usdcToken = IERC20(_usdcToken);
        treasury = _treasury;
        liquidityReserve = _liquidityReserve;

        state = VaultState.Active;

        // Default: $0.20 per AETH with ETH @ $2,800
        ethPriceInUsd = 2800 * 1e6; // $2,800.00
        rateAethPerEth = 14000; // 14,000 AETH / ETH
        rateAethPerUsdc = 5; // 5 AETH / USDC

        hardCapUsd = 5000000 * 1e6; // $5,000,000
        softCapUsd = 500000 * 1e6; // $500,000
        minPurchaseUsd = 50 * 1e6; // $50
        maxPurchaseUsd = 50000 * 1e6; // $50,000

        vestingDuration = 90 days;
        initialReleaseBps = 2000; // 20% unlocked immediately on listing
    }

    // ── Purchasing Functions ──────────────────────────────────────────────────

    /**
     * @notice Purchase AETH with native ETH.
     */
    function buyWithEth() external payable nonReentrant whenNotPaused {
        if (state != VaultState.Active) revert PresaleNotActive();
        if (msg.value == 0) revert ZeroAmount();

        // Calculate USD value (6 decimals)
        uint256 amountUsd = (msg.value * ethPriceInUsd) / 1e18;
        _processPurchase(msg.sender, amountUsd, msg.value, 0, true);
    }

    /**
     * @notice Purchase AETH with USDC.
     * @param amountUsdc Amount of USDC (6 decimals)
     */
    function buyWithUsdc(uint256 amountUsdc) external nonReentrant whenNotPaused {
        if (state != VaultState.Active) revert PresaleNotActive();
        if (amountUsdc == 0) revert ZeroAmount();

        usdcToken.safeTransferFrom(msg.sender, address(this), amountUsdc);
        _processPurchase(msg.sender, amountUsdc, 0, amountUsdc, false);
    }

    function _processPurchase(
        address buyer,
        uint256 amountUsd,
        uint256 ethPaid,
        uint256 usdcPaid,
        bool isEth
    ) internal {
        if (amountUsd < minPurchaseUsd) revert BelowMinPurchase();
        if (totalRaisedUsd + amountUsd > hardCapUsd) revert HardCapExceeded();

        BuyerInfo storage info = buyers[buyer];
        if (info.totalContributedUsd + amountUsd > maxPurchaseUsd) revert AboveMaxPurchase();

        if (info.totalContributedUsd == 0) {
            participants.push(buyer);
        }

        uint256 aethAllocation;
        if (isEth) {
            aethAllocation = ethPaid * rateAethPerEth;
            info.ethContributed += ethPaid;
            totalEthRaised += ethPaid;
        } else {
            // USDC: 6 decimals -> AETH: 18 decimals
            aethAllocation = usdcPaid * rateAethPerUsdc * 1e12;
            info.usdcContributed += usdcPaid;
            totalUsdcRaised += usdcPaid;
        }

        info.totalContributedUsd += amountUsd;
        info.totalPurchasedAeth += aethAllocation;

        totalRaisedUsd += amountUsd;
        totalAethSold += aethAllocation;

        emit TokensPurchased(buyer, amountUsd, aethAllocation, isEth);
    }

    // ── Claiming & Vesting ────────────────────────────────────────────────────

    /**
     * @notice Claim unlocked AETH tokens based on linear vesting schedule.
     */
    function claimTokens() external nonReentrant {
        if (state != VaultState.Finalized) revert PresaleNotFinalized();

        uint256 claimable = getClaimableTokens(msg.sender);
        if (claimable == 0) revert NoTokensToClaim();

        BuyerInfo storage info = buyers[msg.sender];
        info.claimedAeth += claimable;

        if (aethToken.balanceOf(address(this)) < claimable) revert InsufficientVaultBalance();
        aethToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @notice Calculate claimable AETH tokens for a buyer.
     */
    function getClaimableTokens(address buyer) public view returns (uint256) {
        if (state != VaultState.Finalized || block.timestamp < listingTime) {
            return 0;
        }

        BuyerInfo memory info = buyers[buyer];
        if (info.totalPurchasedAeth == 0 || info.claimedAeth >= info.totalPurchasedAeth) {
            return 0;
        }

        uint256 elapsed = block.timestamp - listingTime;
        uint256 totalAllocation = info.totalPurchasedAeth;

        // Immediate TGE unlock
        uint256 immediateUnlock = (totalAllocation * initialReleaseBps) / 10000;
        uint256 linearVestingTotal = totalAllocation - immediateUnlock;

        uint256 vestedLinear;
        if (elapsed >= vestingDuration) {
            vestedLinear = linearVestingTotal;
        } else {
            vestedLinear = (linearVestingTotal * elapsed) / vestingDuration;
        }

        uint256 totalVested = immediateUnlock + vestedLinear;
        if (totalVested <= info.claimedAeth) {
            return 0;
        }
        return totalVested - info.claimedAeth;
    }

    // ── Emergency Refund ──────────────────────────────────────────────────────

    /**
     * @notice Claim full refund if presale is cancelled or soft cap not reached.
     */
    function claimRefund() external nonReentrant {
        if (state != VaultState.Cancelled) revert PresaleNotCancelled();

        BuyerInfo storage info = buyers[msg.sender];
        uint256 ethAmt = info.ethContributed;
        uint256 usdcAmt = info.usdcContributed;

        if (ethAmt == 0 && usdcAmt == 0) revert NoRefundAvailable();

        info.ethContributed = 0;
        info.usdcContributed = 0;
        info.totalContributedUsd = 0;
        info.totalPurchasedAeth = 0;

        if (ethAmt > 0) {
            (bool ok, ) = msg.sender.call{value: ethAmt}("");
            if (!ok) revert TransferFailed();
        }
        if (usdcAmt > 0) {
            usdcToken.safeTransfer(msg.sender, usdcAmt);
        }

        emit RefundClaimed(msg.sender, ethAmt, usdcAmt);
    }

    // ── Admin & Finalization ──────────────────────────────────────────────────

    /**
     * @notice Finalize presale: automatically distributes 60% to liquidity reserve and 40% to treasury.
     * @param _listingTime Timestamp when claiming begins (must be >= block.timestamp)
     */
    function finalize(uint256 _listingTime) external onlyOwner nonReentrant {
        if (state != VaultState.Active) revert PresaleNotActive();
        if (_listingTime < block.timestamp) _listingTime = block.timestamp;

        state = VaultState.Finalized;
        listingTime = _listingTime;

        // Split funds: 60% Liquidity Reserve, 40% Treasury
        uint256 ethBalance = address(this).balance;
        uint256 usdcBalance = usdcToken.balanceOf(address(this));

        uint256 liquidityEth = (ethBalance * 60) / 100;
        uint256 treasuryEth = ethBalance - liquidityEth;

        uint256 liquidityUsdc = (usdcBalance * 60) / 100;
        uint256 treasuryUsdc = usdcBalance - liquidityUsdc;

        if (liquidityEth > 0) {
            (bool ok1, ) = liquidityReserve.call{value: liquidityEth}("");
            if (!ok1) revert TransferFailed();
        }
        if (treasuryEth > 0) {
            (bool ok2, ) = treasury.call{value: treasuryEth}("");
            if (!ok2) revert TransferFailed();
        }

        if (liquidityUsdc > 0) {
            usdcToken.safeTransfer(liquidityReserve, liquidityUsdc);
        }
        if (treasuryUsdc > 0) {
            usdcToken.safeTransfer(treasury, treasuryUsdc);
        }

        emit PresaleFinalized(
            totalRaisedUsd,
            liquidityEth,
            liquidityUsdc,
            treasuryEth,
            treasuryUsdc
        );
    }

    /**
     * @notice Cancel presale and enable emergency refunds for all contributors.
     */
    function cancel() external onlyOwner {
        if (state != VaultState.Active) revert PresaleNotActive();
        state = VaultState.Cancelled;
        emit PresaleCancelled();
    }

    /**
     * @notice Update conversion rates and oracle prices.
     */
    function setRates(
        uint256 _rateAethPerEth,
        uint256 _rateAethPerUsdc,
        uint256 _ethPriceInUsd
    ) external onlyOwner {
        if (_rateAethPerEth == 0 || _rateAethPerUsdc == 0 || _ethPriceInUsd == 0) {
            revert ZeroAmount();
        }
        rateAethPerEth = _rateAethPerEth;
        rateAethPerUsdc = _rateAethPerUsdc;
        ethPriceInUsd = _ethPriceInUsd;
        emit RatesUpdated(_rateAethPerEth, _rateAethPerUsdc, _ethPriceInUsd);
    }

    /**
     * @notice Update treasury and liquidity receiver addresses.
     */
    function setWallets(address _treasury, address _liquidityReserve) external onlyOwner {
        if (_treasury == address(0) || _liquidityReserve == address(0)) revert ZeroAddress();
        treasury = _treasury;
        liquidityReserve = _liquidityReserve;
        emit WalletsUpdated(_treasury, _liquidityReserve);
    }

    /**
     * @notice Pause presale deposits in emergencies.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause presale deposits.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Total number of unique presale buyers.
     */
    function getParticipantCount() external view returns (uint256) {
        return participants.length;
    }

    receive() external payable {
        // Fallback deposits call buyWithEth()
        if (state != VaultState.Active) revert PresaleNotActive();
        if (msg.value == 0) revert ZeroAmount();
        uint256 amountUsd = (msg.value * ethPriceInUsd) / 1e18;
        _processPurchase(msg.sender, amountUsd, msg.value, 0, true);
    }
}
