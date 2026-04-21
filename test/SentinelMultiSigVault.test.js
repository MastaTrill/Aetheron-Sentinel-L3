// test/SentinelMultiSigVault.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

// SecurityLevel enum: LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3
// SecurityClearance enum: BASIC=0, ADVANCED=1, EXPERT=2, MASTER=3
const LOW = 0n;
const BASIC = 0n;
const MASTER = 3n;

describe('SentinelMultiSigVault', function () {
  let vault;
  let owner, guardian1, guardian2, guardian3, stranger;

  const pubKey1 = ethers.keccak256(ethers.toUtf8Bytes('guardian1'));
  const pubKey2 = ethers.keccak256(ethers.toUtf8Bytes('guardian2'));
  const pubKey3 = ethers.keccak256(ethers.toUtf8Bytes('guardian3'));

  beforeEach(async function () {
    [owner, guardian1, guardian2, guardian3, stranger] =
      await ethers.getSigners();
    const SentinelMultiSigVault = await ethers.getContractFactory(
      'SentinelMultiSigVault',
    );
    vault = await SentinelMultiSigVault.deploy(owner.address);
    await vault.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it('starts with zero active guardians', async function () {
      expect(await vault.activeGuardians()).to.equal(0n);
    });

    it('initialises required confirmations for LOW security as 2', async function () {
      expect(await vault.requiredConfirmations(LOW)).to.equal(2n);
    });

    it('initialises emergencyMode as false', async function () {
      expect(await vault.emergencyMode()).to.equal(false);
    });

    it('rejects zero address owner', async function () {
      const SentinelMultiSigVault = await ethers.getContractFactory(
        'SentinelMultiSigVault',
      );
      await expect(
        SentinelMultiSigVault.deploy(ethers.ZeroAddress),
      ).to.be.revertedWith('Invalid owner');
    });
  });

  describe('addGuardian', function () {
    it('adds a guardian and increments activeGuardians', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      expect(await vault.activeGuardians()).to.equal(1n);
      expect(await vault.isGuardian(guardian1.address)).to.equal(true);
    });

    it('emits GuardianAdded event', async function () {
      await expect(vault.addGuardian(guardian1.address, pubKey1, BASIC))
        .to.emit(vault, 'GuardianAdded')
        .withArgs(guardian1.address, BASIC);
    });

    it('rejects zero guardian address', async function () {
      await expect(
        vault.addGuardian(ethers.ZeroAddress, pubKey1, BASIC),
      ).to.be.revertedWith('Invalid guardian address');
    });

    it('rejects zero public key', async function () {
      await expect(
        vault.addGuardian(guardian1.address, ethers.ZeroHash, BASIC),
      ).to.be.revertedWith('Invalid public key');
    });

    it('rejects duplicate guardian', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await expect(
        vault.addGuardian(guardian1.address, pubKey1, BASIC),
      ).to.be.revertedWith('Already a guardian');
    });

    it('reverts when called by non-owner', async function () {
      await expect(
        vault.connect(stranger).addGuardian(guardian1.address, pubKey1, BASIC),
      ).to.revert(ethers);
    });
  });

  describe('removeGuardian', function () {
    it('removes a guardian and decrements activeGuardians', async function () {
      // Add 4 guardians so removing one stays above MIN_GUARDIANS (3)
      const [, , , , , g4] = await ethers.getSigners();
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.addGuardian(guardian2.address, pubKey2, BASIC);
      await vault.addGuardian(guardian3.address, pubKey3, BASIC);
      await vault.addGuardian(
        g4.address,
        ethers.keccak256(ethers.toUtf8Bytes('g4')),
        BASIC,
      );

      await vault.removeGuardian(guardian1.address);
      expect(await vault.activeGuardians()).to.equal(3n);
      expect(await vault.isGuardian(guardian1.address)).to.equal(false);
    });

    it('emits GuardianRemoved event', async function () {
      const [, , , , , g4] = await ethers.getSigners();
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.addGuardian(guardian2.address, pubKey2, BASIC);
      await vault.addGuardian(guardian3.address, pubKey3, BASIC);
      await vault.addGuardian(
        g4.address,
        ethers.keccak256(ethers.toUtf8Bytes('g4')),
        BASIC,
      );

      await expect(vault.removeGuardian(guardian1.address))
        .to.emit(vault, 'GuardianRemoved')
        .withArgs(guardian1.address);
    });

    it('reverts when going below MIN_GUARDIANS (3)', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.addGuardian(guardian2.address, pubKey2, BASIC);
      await vault.addGuardian(guardian3.address, pubKey3, BASIC);
      await expect(vault.removeGuardian(guardian1.address)).to.be.revertedWith(
        'Minimum guardians required',
      );
    });
  });

  describe('submitTransaction', function () {
    beforeEach(async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
    });

    it('reverts for non-guardian caller', async function () {
      await expect(
        vault.connect(stranger).submitTransaction(owner.address, 0, '0x', LOW),
      ).to.be.revertedWith('Not a guardian');
    });

    it('reverts for zero target address', async function () {
      await expect(
        vault
          .connect(guardian1)
          .submitTransaction(ethers.ZeroAddress, 0, '0x', LOW),
      ).to.be.revertedWith('Invalid target address');
    });

    it('submits a transaction and auto-confirms for submitter', async function () {
      await vault
        .connect(guardian1)
        .submitTransaction(owner.address, 0, '0x', LOW);
      const [to, value, , confirmations, executed, level] =
        await vault.getTransaction(0);
      expect(to).to.equal(owner.address);
      expect(value).to.equal(0n);
      expect(confirmations).to.equal(1n);
      expect(executed).to.equal(false);
      expect(level).to.equal(LOW);
    });

    it('emits TransactionSubmitted and TransactionConfirmed events', async function () {
      await expect(
        vault.connect(guardian1).submitTransaction(owner.address, 0, '0x', LOW),
      )
        .to.emit(vault, 'TransactionSubmitted')
        .and.to.emit(vault, 'TransactionConfirmed');
    });

    it('getConfirmation returns true for submitter', async function () {
      await vault
        .connect(guardian1)
        .submitTransaction(owner.address, 0, '0x', LOW);
      expect(await vault.getConfirmation(0, guardian1.address)).to.equal(true);
    });

    it('getConfirmation returns false for non-confirmer', async function () {
      await vault
        .connect(guardian1)
        .submitTransaction(owner.address, 0, '0x', LOW);
      expect(await vault.getConfirmation(0, guardian2.address)).to.equal(false);
    });
  });

  describe('confirmTransaction and executeTransaction (full LOW flow)', function () {
    it('executes a LOW transaction after 2 confirmations', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.addGuardian(guardian2.address, pubKey2, BASIC);

      // guardian1 submits (auto-confirm = 1)
      await vault
        .connect(guardian1)
        .submitTransaction(owner.address, 0, '0x', LOW);

      // Compute tx hash for guardian2 to sign
      const txRecord = await vault.transactions(0n);
      const vaultAddr = await vault.getAddress();

      const hash = ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'uint256', 'bytes', 'uint256', 'address'],
        [
          0n,
          txRecord.to,
          txRecord.value,
          txRecord.data,
          txRecord.timestamp,
          vaultAddr,
        ],
      );

      const sig = await guardian2.signMessage(ethers.getBytes(hash));
      await vault.connect(guardian2).confirmTransaction(0, sig);

      // Now 2 confirmations — execute
      await expect(vault.executeTransaction(0)).to.emit(
        vault,
        'TransactionExecuted',
      );

      const [, , , , executed] = await vault.getTransaction(0);
      expect(executed).to.equal(true);
    });
  });

  describe('activateEmergencyMode', function () {
    it('activates emergency mode when vote threshold is reached', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      // With 1 guardian: needed = floor(1*2/3) = 0 → clamped to 1
      await vault.connect(guardian1).activateEmergencyMode();
      expect(await vault.emergencyMode()).to.equal(true);
    });

    it('emits EmergencyModeActivated event', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await expect(vault.connect(guardian1).activateEmergencyMode()).to.emit(
        vault,
        'EmergencyModeActivated',
      );
    });

    it('reverts if called by a non-guardian', async function () {
      await expect(
        vault.connect(stranger).activateEmergencyMode(),
      ).to.be.revertedWith('Not a guardian');
    });

    it('reverts if already in emergency mode', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.connect(guardian1).activateEmergencyMode();
      await expect(
        vault.connect(guardian1).activateEmergencyMode(),
      ).to.be.revertedWith('Already in emergency mode');
    });

    it('prevents double-voting by the same guardian', async function () {
      await vault.addGuardian(guardian1.address, pubKey1, BASIC);
      await vault.addGuardian(guardian2.address, pubKey2, BASIC);
      await vault.addGuardian(guardian3.address, pubKey3, BASIC);
      // 3 guardians: needed = floor(3*2/3) = 2
      // guardian1 votes first (not enough yet)
      await vault.connect(guardian1).activateEmergencyMode();
      expect(await vault.emergencyMode()).to.equal(false);
      // guardian1 cannot vote again
      await expect(
        vault.connect(guardian1).activateEmergencyMode(),
      ).to.be.revertedWith('Already voted');
    });
  });
});
