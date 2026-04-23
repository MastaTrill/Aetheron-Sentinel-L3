import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  TokensBridged as TokensBridgedEvent,
  TokensUnbridged as TokensUnbridgedEvent,
  TransferCompleted as TransferCompletedEvent,
  BridgeInitialized as BridgeInitializedEvent
} from "../generated/AetheronBridge/AetheronBridge"
import { Bridge, Transfer } from "../generated/schema"

function loadOrCreateBridge(bridgeAddress: Address): Bridge {
  let id = bridgeAddress.toHex()
  let entity = Bridge.load(id)
  if (!entity) {
    entity = new Bridge(id)
    entity.bridgeAddress = bridgeAddress
    entity.totalValueLocked = BigInt.fromI32(0)
    entity.initializedAt = BigInt.fromI32(0)
  }
  return entity as Bridge
}

export function handleTokensBridged(event: TokensBridgedEvent): void {
  let bridge = loadOrCreateBridge(event.address)
  bridge.totalValueLocked = bridge.totalValueLocked.plus(event.params.amount)
  bridge.save()

  let transfer = new Transfer(event.params.transferId.toHex())
  transfer.bridge = event.address.toHex()
  transfer.sender = event.params.sender
  transfer.recipient = event.params.recipient
  transfer.amount = event.params.amount
  transfer.chainId = event.params.chainId
  transfer.tokenAddress = event.params.tokenAddress
  transfer.transferId = event.params.transferId
  transfer.status = "PENDING"
  transfer.timestamp = event.block.timestamp
  transfer.save()
}

export function handleTokensUnbridged(event: TokensUnbridgedEvent): void {
  let entity = Transfer.load(event.params.transferId.toHex())
  if (entity) {
    entity.status = "COMPLETED"
    entity.save()
  }
}

export function handleTransferCompleted(event: TransferCompletedEvent): void {
  let entity = Transfer.load(event.params.transferId.toHex())
  if (entity) {
    entity.status = "COMPLETED"
    entity.save()
  }
}

export function handleBridgeInitialized(event: BridgeInitializedEvent): void {
  let entity = loadOrCreateBridge(event.address)
  entity.initializedAt = event.block.timestamp
  entity.save()
}