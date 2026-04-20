import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  AetheronBridge,
  TokensBridged as TokensBridgedEvent,
  TokensUnbridged as TokensUnbridgedEvent,
  TransferCompleted as TransferCompletedEvent,
  BridgeInitialized as BridgeInitializedEvent
} from "../generated/AetheronBridge/AetheronBridge"
import { Bridge, Transfer } from "../generated/schema"

export function handleTokensBridged(event: TokensBridgedEvent): void {
  let entity = new Transfer(
    event.params.transferId.toHex()
  )
  entity.bridge = "bridge-1" // Reference to bridge entity
  entity.sender = event.params.sender
  entity.recipient = event.params.recipient
  entity.amount = event.params.amount
  entity.chainId = event.params.chainId
  entity.tokenAddress = event.params.tokenAddress
  entity.transferId = event.params.transferId
  entity.status = "PENDING"
  entity.timestamp = event.block.timestamp

  entity.save()
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
  let entity = new Bridge(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.bridgeAddress = event.params.bridge
  entity.totalValueLocked = BigInt.fromI32(0)
  entity.initializedAt = event.block.timestamp

  entity.save()
}