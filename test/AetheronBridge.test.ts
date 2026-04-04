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

    // Get valid non-zero address for bridge
    const bridgeAddr = "0x" + "11".repeat(20);

    // First deploy sentinel interceptor with valid bridge
    const SentinelInterceptor = await ethers.getContractFactory(
      "SentinelInterceptor",
    );
    const sentinel = await SentinelInterceptor.deploy(
      bridgeAddr,
      owner.address,
    );

    // Deploy bridge with sentinel address
    const AetheronBridge = await ethers.getContractFactory("AetheronBridge");
    const bridge = await AetheronBridge.deploy(
      await sentinel.getAddress(),
      treasury.address,
      owner.address,
    );

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
    it.skip("Should allow user to bridge tokens", async function () {
      const { bridge, mockToken, user } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1000");
      const tokenAddress = await mockToken.getAddress();
      const bridgeAddress = await bridge.getAddress();

      await mockToken.connect(user).approve(bridgeAddress, amount);

      const request = {
        token: tokenAddress,
        amount,
        destinationChain: 1,
        recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61".toLowerCase(),
        maxSlippage: 50,
        deadline: 0,
      };

      await expect(
        bridge
          .connect(user)
          .bridge(request, { value: ethers.parseEther("0.001") }),
      )
        .to.emit(bridge, "TokensBridged")
        .to.emit(bridge, "TokensBridged")
        .withArgs(
          user.address,
          tokenAddress,
          amount,
          1,
          request.recipient,
          // TransferId will be generated
        );
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

    it.skip("Should prevent double completion of same transfer", async function () {
      const { bridge, mockToken, relayer } = await loadFixture(deployFixture);

      const tokenAddr = await mockToken.getAddress();
      const bridgeAddr = await bridge.getAddress();

      await mockToken.transfer(bridgeAddr, ethers.parseEther("1000"));

      const transferId = ethers.keccak256(
        ethers.toUtf8Bytes("test-transfer-2"),
      );

      // First completion
      await bridge
        .connect(relayer)
        .completeBridge(
          transferId,
          tokenAddr,
          ethers.parseEther("500"),
          ethers.ZeroAddress,
        );

      // Second completion should fail
      await expect(
        bridge
          .connect(relayer)
          .completeBridge(
            transferId,
            tokenAddr,
            ethers.parseEther("500"),
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWithCustomError(bridge, "TransferAlreadyCompleted");
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
});
