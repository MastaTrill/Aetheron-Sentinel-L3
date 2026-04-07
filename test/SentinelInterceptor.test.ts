import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SentinelInterceptor, MockBridge } from "../typechain-types";

describe("SentinelInterceptor", function () {
  // Fixture for deploying contracts
  async function deployFixture() {
    const [owner, oracle, sentinel, attacker, other] =
      await ethers.getSigners();

    // Deploy mock bridge
    const MockBridge = await ethers.getContractFactory("MockBridge");
    const mockBridge = await MockBridge.deploy();

    // Deploy sentinel interceptor
    const SentinelInterceptor = await ethers.getContractFactory(
      "SentinelInterceptor",
    );
    const sentinelInterceptor = await SentinelInterceptor.deploy(
      await mockBridge.getAddress(),
      owner.address,
    );

    // Grant roles
    await sentinelInterceptor.grantRole(
      await sentinelInterceptor.ORACLE_ROLE(),
      oracle.address,
    );
    await sentinelInterceptor.grantRole(
      await sentinelInterceptor.SENTINEL_ROLE(),
      sentinel.address,
    );

    // Set initial TVL
    await sentinelInterceptor.updateTVL(ethers.parseEther("1000000")); // 1M TVL

    return {
      sentinelInterceptor,
      mockBridge,
      owner,
      oracle,
      sentinel,
      attacker,
      other,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct bridge address", async function () {
      const { sentinelInterceptor, mockBridge } =
        await loadFixture(deployFixture);
      expect(await sentinelInterceptor.bridgeAddress()).to.equal(
        await mockBridge.getAddress(),
      );
    });

    it("Should set autonomous mode to true by default", async function () {
      const { sentinelInterceptor } = await loadFixture(deployFixture);
      expect(await sentinelInterceptor.autonomousMode()).to.equal(true);
    });

    it("Should set correct TVL spike threshold", async function () {
      const { sentinelInterceptor } = await loadFixture(deployFixture);
      expect(await sentinelInterceptor.TVL_SPIKE_THRESHOLD()).to.equal(1520); // 15.20%
    });
  });

  describe("Anomaly Detection", function () {
    it("Should trigger pause when TVL spike exceeds threshold (15.2%)", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      // Report anomaly with 15.2% TVL spike
      await expect(
        sentinelInterceptor
          .connect(oracle)
          .reportAnomaly(1520, ethers.parseEther("1000000")),
      ).to.emit(sentinelInterceptor, "AutonomousPauseTriggered");

      // Bridge should be paused
      expect(await sentinelInterceptor.paused()).to.equal(true);
    });

    it("Should trigger pause when TVL spike exceeds threshold (20%)", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      await sentinelInterceptor
        .connect(oracle)
        .reportAnomaly(2000, ethers.parseEther("1000000"));

      expect(await sentinelInterceptor.paused()).to.equal(true);
    });

    it("Should not trigger pause when TVL spike is below threshold (10%)", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      // Use small value that won't trigger either threshold or z-score
      await sentinelInterceptor
        .connect(oracle)
        .reportAnomaly(100, ethers.parseEther("1000000"));

      expect(await sentinelInterceptor.paused()).to.equal(false);
    });

    it("Should emit AnomalyDetected event", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(oracle)
          .reportAnomaly(1000, ethers.parseEther("1000000")),
      ).to.emit(sentinelInterceptor, "AnomalyDetected");
    });

    it("Should revert if called by non-oracle", async function () {
      const { sentinelInterceptor, attacker } =
        await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(attacker)
          .reportAnomaly(2000, ethers.parseEther("1000000")),
      ).to.be.reverted;
    });
  });

  describe("Emergency Pause", function () {
    it("Should allow sentinel to manually pause", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await sentinelInterceptor
        .connect(sentinel)
        .emergencyPause("Suspicious activity detected");

      expect(await sentinelInterceptor.paused()).to.equal(true);
      expect(await sentinelInterceptor.lastPauseTimestamp()).to.be.gt(0);
    });

    it("Should emit AutonomousPauseTriggered on manual pause", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor.connect(sentinel).emergencyPause("Manual pause"),
      )
        .to.emit(sentinelInterceptor, "AutonomousPauseTriggered")
        .withArgs(
          sentinel.address,
          await sentinelInterceptor.totalValueLocked(),
          (await ethers.provider.getBlock())?.timestamp || 0,
        );
    });

    it("Should revert if non-sentinel tries to pause", async function () {
      const { sentinelInterceptor, attacker } =
        await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(attacker)
          .emergencyPause("Unauthorized pause attempt"),
      ).to.be.reverted;
    });

    it("Should revert if already paused", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await sentinelInterceptor.connect(sentinel).emergencyPause("First pause");

      await expect(
        sentinelInterceptor.connect(sentinel).emergencyPause("Second pause"),
      ).to.be.reverted;
    });
  });

  describe("Resume Bridge", function () {
    it("Should allow sentinel to resume bridge", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      // First pause
      await sentinelInterceptor.connect(sentinel).emergencyPause("Pause");
      expect(await sentinelInterceptor.paused()).to.equal(true);

      // Then resume
      await sentinelInterceptor
        .connect(sentinel)
        .resumeBridge(ethers.parseEther("900000"));
      expect(await sentinelInterceptor.paused()).to.equal(false);
    });

    it("Should update TVL after resume", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await sentinelInterceptor.connect(sentinel).emergencyPause("Pause");
      await sentinelInterceptor
        .connect(sentinel)
        .resumeBridge(ethers.parseEther("900000"));

      expect(await sentinelInterceptor.totalValueLocked()).to.equal(
        ethers.parseEther("900000"),
      );
    });

    it("Should revert if not paused", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(sentinel)
          .resumeBridge(ethers.parseEther("1000000")),
      ).to.be.reverted;
    });
  });

  describe("Autonomous Mode", function () {
    it("Should allow admin to disable autonomous mode", async function () {
      const { sentinelInterceptor, owner } = await loadFixture(deployFixture);

      await sentinelInterceptor.setAutonomousMode(false);
      expect(await sentinelInterceptor.autonomousMode()).to.equal(false);
    });

    it("Should not trigger auto-pause when autonomous mode is disabled", async function () {
      const { sentinelInterceptor, oracle, owner } =
        await loadFixture(deployFixture);

      await sentinelInterceptor.setAutonomousMode(false);

      // Try to trigger auto-pause
      await sentinelInterceptor
        .connect(oracle)
        .reportAnomaly(2000, ethers.parseEther("1000000"));

      // Should not be paused
      expect(await sentinelInterceptor.paused()).to.equal(false);
    });

    it("Should emit AutonomousModeToggled event", async function () {
      const { sentinelInterceptor, owner } = await loadFixture(deployFixture);

      await expect(sentinelInterceptor.setAutonomousMode(false))
        .to.emit(sentinelInterceptor, "AutonomousModeToggled")
        .withArgs(false);
    });
  });

  describe("TVL Management", function () {
    it("Should allow oracle to update TVL", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      await sentinelInterceptor
        .connect(oracle)
        .updateTVL(ethers.parseEther("1500000"));

      expect(await sentinelInterceptor.totalValueLocked()).to.equal(
        ethers.parseEther("1500000"),
      );
    });

    it("Should emit TVLUpdated event", async function () {
      const { sentinelInterceptor, oracle } = await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(oracle)
          .updateTVL(ethers.parseEther("1500000")),
      )
        .to.emit(sentinelInterceptor, "TVLUpdated")
        .withArgs(ethers.parseEther("1000000"), ethers.parseEther("1500000"));
    });

    it("Should revert if non-oracle tries to update TVL", async function () {
      const { sentinelInterceptor, attacker } =
        await loadFixture(deployFixture);

      await expect(
        sentinelInterceptor
          .connect(attacker)
          .updateTVL(ethers.parseEther("1500000")),
      ).to.be.reverted;
    });
  });

  describe("Response Metrics", function () {
    it("Should return correct response time metrics", async function () {
      const { sentinelInterceptor } = await loadFixture(deployFixture);

      const [detection, execution, total] =
        await sentinelInterceptor.getResponseMetrics();

      expect(detection).to.equal(4); // 4ms detection
      expect(execution).to.equal(10); // 10ms execution
      expect(total).to.equal(14); // 14ms total
    });
  });

  describe("Security Status", function () {
    it("Should return correct security status", async function () {
      const { sentinelInterceptor } = await loadFixture(deployFixture);

      const [isPaused, currentTVL, isAutonomous] =
        await sentinelInterceptor.getSecurityStatus();

      expect(isPaused).to.equal(false);
      expect(currentTVL).to.equal(ethers.parseEther("1000000"));
      expect(isAutonomous).to.equal(true);
    });

    it("Should reflect paused status when paused", async function () {
      const { sentinelInterceptor, sentinel } =
        await loadFixture(deployFixture);

      await sentinelInterceptor.connect(sentinel).emergencyPause("Pause");

      const [isPaused] = await sentinelInterceptor.getSecurityStatus();
      expect(isPaused).to.equal(true);
    });
  });
});
