import { task } from "hardhat/config";

task("simulate-lattice-failure", "Tests SentinelCoreLoop resilience against 25% calibration failures")
    .setAction(async (taskArgs, hre) => {
        const [deployer] = await hre.ethers.getSigners();
        console.log("Starting Resilience Simulation...");

        // 1. Deploy Chaos Mock QuantumGuard
        const ChaosGuard = await hre.ethers.getContractFactory("ChaosQuantumGuard");
        const chaosGuard = await ChaosGuard.deploy();
        await chaosGuard.waitForDeployment();
        console.log(`Chaos Mock deployed at: ${await chaosGuard.getAddress()}`);

        // 2. Deploy SentinelCoreLoop
        const CoreLoop = await hre.ethers.getContractFactory("SentinelCoreLoop");
        const coreLoop = await CoreLoop.deploy(deployer.address);
        await coreLoop.waitForDeployment();

        // 3. Initialize with mock components
        await coreLoop.initializeCoreComponents(await chaosGuard.getAddress(), deployer.address);
        await coreLoop.setKeeper(deployer.address, true);

        // Set calibration interval to 0 to force calibration every loop
        await coreLoop.setCalibrationInterval(0);
        await coreLoop.setMonitor(deployer.address, true);

        // 4. Verify Anomaly Window Shrinking
        console.log("\nTesting Anomaly Window Shrinking...");
        const initialWindow = await coreLoop.s_anomalyWindow();
        const initialWindowStartTimestamp = await coreLoop.s_windowStartTimestamp();
        const minWindow = await coreLoop.s_minAnomalyWindow();
        const threshold = await coreLoop.s_highThreatAnomalyThreshold();

        console.log(`Initial Window: ${initialWindow}s. Triggering sustained anomalies...`);

        // Trigger enough anomaly bursts to reach the floor (s_minAnomalyWindow)
        for (let j = 0; j < 10; j++) {
            for (let i = 0; i <= threshold; i++) {
                // Capture block.timestamp for verification
                const currentBlock = await hre.ethers.provider.getBlock('latest');
                const tx = await coreLoop.executeThreatResponse(hre.ethers.ZeroHash); // This will trigger high-threat logic
                await tx.wait(); // Wait for the transaction to be mined
            }
        }

        const finalShrunkWindow = await coreLoop.s_anomalyWindow();
        const finalWindowStartTimestamp = await coreLoop.s_windowStartTimestamp();
        const latestBlock = await hre.ethers.provider.getBlock('latest');

        if (finalShrunkWindow === minWindow) {
            console.log(`✅ PASS: Window correctly floor-capped at s_minAnomalyWindow (${finalShrunkWindow}s)`);
        } else {
            console.log(`❌ FAIL: Window shrank below floor or logic error. Got ${finalShrunkWindow}s, expected ${minWindow}s`);
        }

        // Verify s_windowStartTimestamp was updated during high-threat calibration
        if (finalWindowStartTimestamp > initialWindowStartTimestamp && finalWindowStartTimestamp <= latestBlock.timestamp) {
            console.log(`✅ PASS: s_windowStartTimestamp updated from ${initialWindowStartTimestamp} to ${finalWindowStartTimestamp} (latest block.timestamp: ${latestBlock.timestamp})`);
        } else {
            console.log(`❌ FAIL: s_windowStartTimestamp not updated correctly. Initial: ${initialWindowStartTimestamp}, Final: ${finalWindowStartTimestamp}, Latest block.timestamp: ${latestBlock.timestamp}`);
        }

        // 5. Verify Anomaly Window Recovery
        console.log("\nTesting Anomaly Window Recovery...");
        const maxWindow = await coreLoop.s_maxAnomalyWindow();
        let currentWindow = await coreLoop.s_anomalyWindow();
        let steps = 0;

        console.log(`Recovering from ${currentWindow}s to ${maxWindow}s...`);

        while (currentWindow < maxWindow) {
            steps++;
            // Simulate inactivity longer than current window to trigger expansion
            await hre.network.provider.send("evm_increaseTime", [Number(currentWindow) + 1]);
            await hre.network.provider.send("evm_mine");

            await coreLoop.executeThreatResponse(hre.ethers.ZeroHash);

            const newWindow = await coreLoop.s_anomalyWindow();
            console.log(`  Step ${steps}: Window expanded to ${newWindow}s`);

            if (newWindow <= currentWindow && newWindow < maxWindow) {
                throw new Error("Expansion logic failed: Window did not increase.");
            }
            currentWindow = newWindow;
        }

        const EXPECTED_STEPS = 22;
        if (steps === EXPECTED_STEPS) {
            console.log(`✅ PASS: Window fully recovered in exactly ${steps} steps.`);
        } else {
            console.log(`❌ FAIL: Window recovered in ${steps} steps, but expected ${EXPECTED_STEPS}.`);
        }

        // 6. Verify Anomaly Window Stability at Max
        console.log("\nTesting Anomaly Window Stability at Max...");
        let stableWindow = await coreLoop.s_anomalyWindow();
        if (stableWindow !== maxWindow) {
            console.log(`❌ FAIL: Window did not settle at maxWindow. Current: ${stableWindow}s, Expected: ${maxWindow}s`);
            throw new Error("Window did not settle at maxWindow.");
        }

        console.log(`Window is at max (${stableWindow}s). Triggering 5 more checks...`);
        for (let i = 0; i < 5; i++) {
            await hre.network.provider.send("evm_increaseTime", [Number(maxWindow) + 1]); // Simulate enough time for expansion logic
            await hre.network.provider.send("evm_mine");
            await coreLoop.executeThreatResponse(hre.ethers.ZeroHash);
            const currentStableWindow = await coreLoop.s_anomalyWindow();
            if (currentStableWindow !== maxWindow) {
                console.log(`❌ FAIL: Window changed from ${maxWindow}s to ${currentStableWindow}s after recovery.`);
                throw new Error("Window did not remain stable at maxWindow.");
            }
        }
        console.log(`✅ PASS: Window remained stable at s_maxAnomalyWindow (${maxWindow}s) after multiple triggers.`);

        // 7. Verify Emergency Freeze Revert
        console.log("\nTesting Emergency Freeze Revert...");
        await chaosGuard.setFrozen(true);
        try {
            // This should revert early in the executeThreatResponse call
            await coreLoop.executeThreatResponse(hre.ethers.ZeroHash);
            console.log("❌ FAIL: executeThreatResponse did not revert when frozen.");
            throw new Error("Revert check failed");
        } catch (error) {
            if (error.message.includes("SentinelCoreLoop__QuantumGuardFrozen")) {
                console.log("✅ PASS: Correctly reverted with SentinelCoreLoop__QuantumGuardFrozen");
            } else {
                console.log(`❌ FAIL: Unexpected error message: ${error.message}`);
                throw error;
            }
        }
        await chaosGuard.setFrozen(false);

        console.log("Running 20 Core Loop iterations...");
        let failureCount = 0;
        let successCount = 0;

        for (let i = 0; i < 20; i++) {
            const tx = await coreLoop.executeCoreLoop();
            const receipt = await tx.wait();

            const failedEvent = receipt.logs.find(
                x => coreLoop.interface.parseLog(x)?.name === 'ComponentExecutionFailed'
            );

            if (failedEvent) {
                failureCount++;
                console.log(`Iteration ${i}: ⚠️ Calibration Failed (Handled)`);
            } else {
                successCount++;
                console.log(`Iteration ${i}: ✅ Calibration Succeeded`);
            }
        }

        console.log(`\nSimulation Complete:`);
        console.log(`- Successes: ${successCount}`);
        console.log(`- Failures (Expected ~25%): ${failureCount}`);

        if (failureCount > 0 && successCount > 0) {
            console.log("PASS: SentinelCoreLoop successfully handled lattice reverts.");
        } else {
            console.log("WARN: Probability variance resulted in 0 failures or 0 successes. Rerun test.");
        }
    });

// Inline Chaos Mock for the task
/**
 * @dev Mock contract that fails exactly 25% of the time (every 4th call)
 */
const chaosMockSolidity = `
contract ChaosQuantumGuard {
    uint256 public callCount;
    bool public frozen;
    function setFrozen(bool _frozen) external {
        frozen = _frozen;
    }
    function calibrateLatticeParameters() external {
        callCount++;
        if (callCount % 4 == 0) {
            revert("Lattice Calibration Simulated Failure");
        }
    }
    function lastCalibration() external view returns (uint256) {
        return 0;
    }
    function isFrozen() external view returns (bool) {
        return frozen;
    }
}
`;