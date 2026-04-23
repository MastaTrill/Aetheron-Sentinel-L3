import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  AetheronBridge,
  SentinelInterceptor,
  MockToken,
} from "../typechain-types";

describe("AetheronBridge", function () {
  // Fixture for deploying contracts
  async function deployFixture() {
    const [owner, admin, relayer, user, attacker, treasury] =
      await ethers.getSigners();

    // Deploy bridge first with dummy sentinel
    const dummySentinel = "0x" + "11".repeat(20);
    const AetheronBridge = await ethers.getContractFactory("AetheronBridge");
    const bridge = await AetheronBridge.deploy(
      dummySentinel, // Will update later
      treasury.address,
      owner.address,
    );

    // Deploy sentinel interceptor with actual bridge address
    const SentinelInterceptor = await ethers.getContractFactory(
      "SentinelInterceptor",
    );
    const sentinel = await SentinelInterceptor.deploy(
      await bridge.getAddress(),
      owner.address,
    );

    // Update bridge with correct sentinel address
    await bridge.connect(owner).setSentinel(await sentinel.getAddress());

    // Grant ORACLE_ROLE to bridge on sentinel so it can update TVL
    await sentinel
      .connect(owner)
      .grantRole(await sentinel.ORACLE_ROLE(), await bridge.getAddress());

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy(
      "Mock Token",
      "MOCK",
      ethers.parseEther("1000000"),
    );

    // Grant relayer role
    await bridge.grantRole(await bridge.RELAYER_ROLE(), relayer.address);
    await bridge.grantRole(await bridge.SENTINEL_ROLE(), owner.address);

    // Enable chain 1 (simulated destination chain)
    await bridge.setSupportedChain(1, true);

    // Fund user with tokens
    await mockToken.transfer(user.address, ethers.parseEther("10000"));

    return {
      bridge,
      sentinel,
      mockToken,
      owner,
      admin,
      relayer,
      user,
      attacker,
      treasury,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct sentinel interceptor", async function () {
      const { bridge, sentinel } = await loadFixture(deployFixture);
      expect(await bridge.sentinelInterceptor()).to.equal(
        await sentinel.getAddress(),
      );
    });

    it("Should set the correct treasury", async function () {
      const { bridge, treasury } = await loadFixture(deployFixture);
      expect(await bridge.treasury()).to.equal(treasury.address);
    });

    it("Should set initial bridge fee to 0.30%", async function () {
      const { bridge } = await loadFixture(deployFixture);
      expect(await bridge.bridgeFeePercent()).to.equal(30);
    });

    it("Should not be paused by default", async function () {
      const { bridge } = await loadFixture(deployFixture);
      expect(await bridge.paused()).to.equal(false);
    });
  });

  describe("Bridging", function () {
    it("Should allow user to bridge tokens", async function () {
      const { bridge, mockToken, user, treasury } =
        await loadFixture(deployFixture);

      const amount = ethers.parseEther("1000");
      const feeAmount = (amount * 30n) / 10000n; // 0.30% fee
      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      // Check initial balances
      const userBalanceBefore = await mockToken.balanceOf(user.address);
      const bridgeBalanceBefore = await mockToken.balanceOf(bridgeAddress);
      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);

      await mockToken.connect(user).approve(bridgeAddress, amount);

      const request = {
        token: tokenAddress,
        amount,
        destinationChain: 1,
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      const tx = await bridge
        .connect(user)
        .bridge(request, { value: ethers.parseEther("0.001") });

      // Check balances after
      const userBalanceAfter = await mockToken.balanceOf(user.address);
      const bridgeBalanceAfter = await mockToken.balanceOf(bridgeAddress);
      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore - amount);
      expect(bridgeBalanceAfter).to.equal(
        bridgeBalanceBefore + amount - feeAmount,
      );
      expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore + feeAmount);

      // Check event is emitted
      await expect(tx).to.emit(bridge, "TokensBridged");
    });

    it("Should reject zero amount", async function () {
      const { bridge, mockToken, user } = await loadFixture(deployFixture);

      const request = {
        token: await mockToken.getAddress(),
        amount: 0,
        destinationChain: 1,
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge
          .connect(user)
          .bridge(request, { value: ethers.parseEther("0.001") }),
      ).to.be.revertedWithCustomError(bridge, "ZeroAmount");
    });

    it("Should reject unsupported chain", async function () {
      const { bridge, mockToken, user } = await loadFixture(deployFixture);

      const request = {
        token: await mockToken.getAddress(),
        amount: ethers.parseEther("100"),
        destinationChain: 999, // Unsupported
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge
          .connect(user)
          .bridge(request, { value: ethers.parseEther("0.001") }),
      ).to.be.revertedWithCustomError(bridge, "ChainNotSupported");
    });

    it("Should reject insufficient fee", async function () {
      const { bridge, mockToken, user } = await loadFixture(deployFixture);

      const request = {
        token: await mockToken.getAddress(),
        amount: ethers.parseEther("100"),
        destinationChain: 1,
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge.connect(user).bridge(request, { value: 0 }), // No fee
      ).to.be.revertedWithCustomError(bridge, "InsufficientFee");
    });

    it("Should reject when bridge is paused", async function () {
      const { bridge, mockToken, user, owner } =
        await loadFixture(deployFixture);

      // Pause the bridge
      await bridge.connect(owner).emergencyPause();

      const request = {
        token: await mockToken.getAddress(),
        amount: ethers.parseEther("100"),
        destinationChain: 1,
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge
          .connect(user)
          .bridge(request, { value: ethers.parseEther("0.001") }),
      ).to.be.reverted;
    });

    it("Should calculate fees correctly", async function () {
      const { bridge, mockToken, user, treasury } =
        await loadFixture(deployFixture);

      const amount = ethers.parseEther("10000");
      const expectedFee = (amount * 30n) / 10000n; // 0.30%
      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      await mockToken.connect(user).approve(bridgeAddress, amount);

      const request = {
        token: tokenAddress,
        amount,
        destinationChain: 1,
        recipient: user.address,
        maxSlippage: 50,
        deadline: 0,
      };

      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);

      await bridge
        .connect(user)
        .bridge(request, { value: ethers.parseEther("0.001") });

      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
        expectedFee,
      );
    });

    it("Should generate unique transfer IDs", async function () {
      const { bridge, mockToken, user, admin } =
        await loadFixture(deployFixture);

      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      await mockToken
        .connect(user)
        .approve(bridgeAddress, ethers.parseEther("200"));

      const request1 = {
        token: tokenAddress,
        amount: ethers.parseEther("100"),
        destinationChain: 1,
        recipient: user.address,
        maxSlippage: 50,
        deadline: 0,
      };

      const request2 = {
        token: tokenAddress,
        amount: ethers.parseEther("50"), // Different amount
        destinationChain: 1,
        recipient: user.address,
        maxSlippage: 50,
        deadline: 0,
      };

      const tx1 = await bridge
        .connect(user)
        .bridge(request1, { value: ethers.parseEther("0.001") });

      // Transfer tokens to admin and approve
      await mockToken.transfer(admin.address, ethers.parseEther("100"));
      await mockToken
        .connect(admin)
        .approve(bridgeAddress, ethers.parseEther("100"));

      const tx2 = await bridge
        .connect(admin)
        .bridge(request2, { value: ethers.parseEther("0.001") });

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      const transferId1 = receipt1?.logs[0]?.topics[1];
      const transferId2 = receipt2?.logs[0]?.topics[1];

      expect(transferId1).to.not.equal(transferId2);
    });

    it("Should handle multiple supported chains", async function () {
      const { bridge, mockToken, user, owner } =
        await loadFixture(deployFixture);

      // Add more chains
      await bridge.connect(owner).setSupportedChain(2, true);
      await bridge.connect(owner).setSupportedChain(42161, true); // Arbitrum

      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      await mockToken
        .connect(user)
        .approve(bridgeAddress, ethers.parseEther("300"));

      // Bridge to different chains
      const requests = [
        {
          token: tokenAddress,
          amount: ethers.parseEther("100"),
          destinationChain: 1,
          recipient: user.address,
          maxSlippage: 50,
          deadline: 0,
        },
        {
          token: tokenAddress,
          amount: ethers.parseEther("100"),
          destinationChain: 2,
          recipient: user.address,
          maxSlippage: 50,
          deadline: 0,
        },
        {
          token: tokenAddress,
          amount: ethers.parseEther("100"),
          destinationChain: 42161,
          recipient: user.address,
          maxSlippage: 50,
          deadline: 0,
        },
      ];

      for (const request of requests) {
        await expect(
          bridge
            .connect(user)
            .bridge(request, { value: ethers.parseEther("0.001") }),
        ).to.emit(bridge, "TokensBridged");
      }
    });
  });

  describe("Complete Bridge", function () {
    it("Should allow relayer to complete bridge", async function () {
      const { bridge, mockToken, relayer, user, treasury } =
        await loadFixture(deployFixture);

      // Transfer tokens to bridge
      await mockToken.transfer(
        await bridge.getAddress(),
        ethers.parseEther("1000"),
      );

      const transferId = ethers.keccak256(
        ethers.toUtf8Bytes("test-transfer-1"),
      );

      await expect(
        bridge
          .connect(relayer)
          .completeBridge(
            transferId,
            await mockToken.getAddress(),
            ethers.parseEther("500"),
            user.address,
          ),
      )
        .to.emit(bridge, "TokensUnbridged")
        .withArgs(
          user.address,
          await mockToken.getAddress(),
          ethers.parseEther("500"),
          transferId,
        );
    });

    it("Should prevent double completion of same transfer", async function () {
      const { bridge, mockToken, relayer, user } =
        await loadFixture(deployFixture);

      const tokenAddr = await mockToken.getAddress();
      const bridgeAddr = await bridge.getAddress();

      await mockToken.transfer(bridgeAddr, ethers.parseEther("1000"));

      const transferId = ethers.keccak256(
        ethers.toUtf8Bytes("test-transfer-2"),
      );

      // First completion
      await bridge.connect(relayer).completeBridge(
        transferId,
        tokenAddr,
        ethers.parseEther("500"),
        user.address, // Use valid recipient
      );

      // Second completion should fail
      await expect(
        bridge
          .connect(relayer)
          .completeBridge(
            transferId,
            tokenAddr,
            ethers.parseEther("500"),
            user.address,
          ),
      ).to.be.revertedWithCustomError(bridge, "TransferAlreadyCompleted");
    });

    it("Should complete bridge and transfer tokens to recipient", async function () {
      const { bridge, mockToken, relayer, user } =
        await loadFixture(deployFixture);

      const tokenAddr = await mockToken.getAddress();
      const bridgeAddr = await bridge.getAddress();
      const amount = ethers.parseEther("500");

      await mockToken.transfer(bridgeAddr, amount);

      const transferId = ethers.keccak256(
        ethers.toUtf8Bytes("test-transfer-complete"),
      );

      const recipientBalanceBefore = await mockToken.balanceOf(user.address);

      await expect(
        bridge
          .connect(relayer)
          .completeBridge(transferId, tokenAddr, amount, user.address),
      )
        .to.emit(bridge, "TokensUnbridged")
        .withArgs(user.address, tokenAddr, amount, transferId)
        .to.emit(bridge, "TransferCompleted")
        .withArgs(transferId);

      const recipientBalanceAfter = await mockToken.balanceOf(user.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);
    });

    it("Should reject non-relayer from completing bridge", async function () {
      const { bridge, mockToken, attacker } = await loadFixture(deployFixture);

      await mockToken.transfer(
        await bridge.getAddress(),
        ethers.parseEther("1000"),
      );

      const transferId = ethers.keccak256(
        ethers.toUtf8Bytes("test-transfer-3"),
      );

      await expect(
        bridge
          .connect(attacker)
          .completeBridge(
            transferId,
            await mockToken.getAddress(),
            ethers.parseEther("500"),
            ethers.ZeroAddress,
          ),
      ).to.be.reverted;
    });
  });

  describe("Pause/Resume", function () {
    it("Should allow sentinel to pause", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      await bridge.connect(owner).emergencyPause();

      expect(await bridge.paused()).to.equal(true);
    });

    it("Should allow admin to resume", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      await bridge.connect(owner).emergencyPause();
      expect(await bridge.paused()).to.equal(true);

      await bridge.connect(owner).resume();
      expect(await bridge.paused()).to.equal(false);
    });

    it("Should reject non-sentinel from pausing", async function () {
      const { bridge, attacker } = await loadFixture(deployFixture);

      await expect(bridge.connect(attacker).emergencyPause()).to.be.reverted;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to set supported chain", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      await bridge.connect(owner).setSupportedChain(2, true);
      expect(await bridge.supportedChains(2)).to.equal(true);

      await bridge.connect(owner).setSupportedChain(2, false);
      expect(await bridge.supportedChains(2)).to.equal(false);
    });

    it("Should allow admin to update bridge fee", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      await bridge.connect(owner).setBridgeFee(50); // 0.50%
      expect(await bridge.bridgeFeePercent()).to.equal(50);
    });

    it("Should reject fee exceeding max", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      await expect(
        bridge.connect(owner).setBridgeFee(200),
      ).to.be.revertedWithCustomError(bridge, "InvalidFee");
    });

    it("Should allow admin to update treasury", async function () {
      const { bridge, owner } = await loadFixture(deployFixture);

      const newTreasury = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
      await bridge.connect(owner).setTreasury(newTreasury);

      expect(await bridge.treasury()).to.equal(newTreasury);
    });

    it("Should allow admin to rescue tokens", async function () {
      const { bridge, mockToken, owner } = await loadFixture(deployFixture);

      // Transfer tokens to bridge
      const amount = ethers.parseEther("100");
      await mockToken.transfer(await bridge.getAddress(), amount);

      const treasuryBefore = await mockToken.balanceOf(await bridge.treasury());

      await bridge
        .connect(owner)
        .rescueTokens(await mockToken.getAddress(), await bridge.treasury());

      const treasuryAfter = await mockToken.balanceOf(await bridge.treasury());
      expect(treasuryAfter - treasuryBefore).to.equal(amount);
    });
  });

  describe("Bridge Stats", function () {
    it("Should return correct bridge stats", async function () {
      const { bridge } = await loadFixture(deployFixture);

      const [paused, , fee] = await bridge.getBridgeStats();

      expect(paused).to.equal(false);
      expect(fee).to.equal(30);
    });
  });

  describe("Cross-Chain Flow", function () {
    it("Should simulate full cross-chain bridge flow", async function () {
      const { bridge, mockToken, relayer, user, treasury } =
        await loadFixture(deployFixture);

      const amount = ethers.parseEther("1000");
      const feeAmount = (amount * 30n) / 10000n;
      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      // Step 1: User initiates bridge
      await mockToken.connect(user).approve(bridgeAddress, amount);

      const request = {
        token: tokenAddress,
        amount,
        destinationChain: 1,
        recipient: user.address,
        maxSlippage: 50,
        deadline: 0,
      };

      const bridgeTx = await bridge
        .connect(user)
        .bridge(request, { value: ethers.parseEther("0.001") });

      const bridgeReceipt = await bridgeTx.wait();
      const transferId = bridgeReceipt!.logs[0].topics[1];

      // Verify tokens are locked in bridge (minus fee)
      expect(await mockToken.balanceOf(bridgeAddress)).to.equal(
        amount - feeAmount,
      );
      expect(await mockToken.balanceOf(treasury.address)).to.equal(feeAmount);

      // Step 2: Simulate cross-chain transfer (add tokens to destination bridge)
      // In real scenario, this would be done by relayers moving tokens
      await mockToken.transfer(bridgeAddress, amount - feeAmount);

      // Step 3: Complete bridge on destination
      const recipientBalanceBefore = await mockToken.balanceOf(user.address);

      await bridge.connect(relayer).completeBridge(
        transferId,
        tokenAddress,
        amount - feeAmount, // Amount after fee
        user.address,
      );

      const recipientBalanceAfter = await mockToken.balanceOf(user.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        amount - feeAmount,
      );
    });

    it("Should handle large volume transfers", async function () {
      const { bridge, mockToken, relayer, user } =
        await loadFixture(deployFixture);

      const amounts = [
        ethers.parseEther("1000"),
        ethers.parseEther("2000"),
        ethers.parseEther("3000"),
      ];

      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      // Approve large amount
      await mockToken
        .connect(user)
        .approve(bridgeAddress, ethers.parseEther("200000"));

      for (const amount of amounts) {
        const request = {
          token: tokenAddress,
          amount,
          destinationChain: 1,
          recipient: user.address,
          maxSlippage: 50,
          deadline: 0,
        };

        await expect(
          bridge
            .connect(user)
            .bridge(request, { value: ethers.parseEther("0.001") }),
        ).to.emit(bridge, "TokensBridged");

        // Check tokens are locked
        const feeAmount = (amount * 30n) / 10000n;
        expect(await mockToken.balanceOf(bridgeAddress)).to.be.at.least(
          amount - feeAmount,
        );
      }
    });

    it("Should reject invalid recipient", async function () {
      const { bridge, mockToken, user } = await loadFixture(deployFixture);

      const request = {
        token: await mockToken.getAddress(),
        amount: ethers.parseEther("100"),
        destinationChain: 1,
        recipient: ethers.ZeroAddress, // Invalid
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge
          .connect(user)
          .bridge(request, { value: ethers.parseEther("0.001") }),
      ).to.be.revertedWithCustomError(bridge, "InvalidRecipient");
    });

    it("Should handle zero fee tokens", async function () {
      const { bridge, mockToken, user, treasury, owner } =
        await loadFixture(deployFixture);

      // Set fee to 0
      await bridge.connect(owner).setBridgeFee(0);

      const amount = ethers.parseEther("1000");
      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      await mockToken.connect(user).approve(bridgeAddress, amount);

      const request = {
        token: tokenAddress,
        amount,
        destinationChain: 1,
        recipient: user.address,
        maxSlippage: 50,
        deadline: 0,
      };

      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);

      await bridge
        .connect(user)
        .bridge(request, { value: ethers.parseEther("0.001") });

      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore); // No fee
      expect(await mockToken.balanceOf(bridgeAddress)).to.equal(amount);
    });
  });
});
