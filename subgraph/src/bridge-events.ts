import {
  TokensBridged,
  TokensUnbridged,
  TransferCompleted,
  BridgeInitialized,
} from "../generated/AetheronBridge/AetheronBridge";
import { Bridge, Transfer } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleTokensBridged(event: TokensBridged): void {
  let bridge = Bridge.load(event.address.toHex());
  if (!bridge) {
    bridge = new Bridge(event.address.toHex());
    bridge.isPaused = false;
    bridge.totalValueLocked = BigInt.fromI32(0);
    bridge.totalTransfers = BigInt.fromI32(0);
    bridge.supportedChains = [];
    bridge.createdAt = event.block.timestamp;
  }

  bridge.totalTransfers = bridge.totalTransfers.plus(BigInt.fromI32(1));
  bridge.updatedAt = event.block.timestamp;
  bridge.save();

  let transfer = new Transfer(event.params.transferId.toHex());
  transfer.sender = event.params.sender;
  transfer.recipient = event.params.recipient;
  transfer.token = event.params.token;
  transfer.amount = event.params.amount;
  transfer.destinationChain = event.params.destinationChain.toI32();
  transfer.transferId = event.params.transferId;
  transfer.status = "PENDING";
  transfer.fee = BigInt.fromI32(0);
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
  bridge.totalValueLocked = BigInt.fromI32(0);
  bridge.totalTransfers = BigInt.fromI32(0);
  bridge.supportedChains = [];
  bridge.createdAt = event.block.timestamp;
  bridge.updatedAt = event.block.timestamp;
  bridge.save();
}
