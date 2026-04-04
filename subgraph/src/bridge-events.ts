import {
  TokensBridged,
  TokensUnbridged,
  TransferCompleted,
  BridgeInitialized,
} from "../generated/AetheronBridge/AetheronBridge";
import { Bridge, Transfer } from "../generated/schema";

export function handleTokensBridged(event: TokensBridged): void {
  let bridge = Bridge.load(event.address.toHex());
  if (!bridge) {
    bridge = new Bridge(event.address.toHex());
    bridge.totalValueLocked = 0;
    bridge.totalTransfers = 0;
    bridge.supportedChains = [];
    bridge.createdAt = event.block.timestamp;
  }

  bridge.totalTransfers = bridge.totalTransfers.plus(1);
  bridge.updatedAt = event.block.timestamp;
  bridge.save();

  // Create transfer record
  let transfer = new Transfer(event.params.transferId.toHex());
  transfer.sender = event.params.sender;
  transfer.recipient = event.params.recipient;
  transfer.token = event.params.token;
  transfer.amount = event.params.amount;
  transfer.destinationChain = event.params.destinationChain;
  transfer.transferId = event.params.transferId;
  transfer.status = "PENDING";
  transfer.fee = 0; // Would be calculated
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}

export function handleTokensUnbridged(event: TokensUnbridged): void {
  let transfer = Transfer.load(event.params.transferId.toHex());
  if (transfer) {
    transfer.status = "COMPLETED";
    transfer.save();
  }
}

export function handleTransferCompleted(event: TransferCompleted): void {
  let transfer = Transfer.load(event.params.transferId.toHex());
  if (transfer) {
    transfer.status = "COMPLETED";
    transfer.save();
  }
}

export function handleBridgeInitialized(event: BridgeInitialized): void {
  let bridge = new Bridge(event.address.toHex());
  bridge.isPaused = false;
  bridge.totalValueLocked = 0;
  bridge.totalTransfers = 0;
  bridge.supportedChains = [];
  bridge.createdAt = event.block.timestamp;
  bridge.updatedAt = event.block.timestamp;
  bridge.save();
}
