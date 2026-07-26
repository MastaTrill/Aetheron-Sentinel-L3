# Operational Actions Required

Repository safeguards are implemented. The following items remain live operational actions and are not completed by documentation or CI changes.

## Base Sepolia

Before broadcasting:

- fund the reviewed deployer with sufficient Base Sepolia ETH;
- record the deployer address and minimum balance;
- run the complete non-broadcast readiness suite from an immutable commit;
- obtain security and two-person approval;
- deploy only the approved release core;
- verify source and runtime bytecode;
- archive transaction hashes, addresses, blocks, gas, constructor arguments, ownership state, and manifest digest.

## Base mainnet

Base mainnet deployment remains blocked until:

- Base Sepolia evidence is reviewed and approved;
- an independent audit or explicit risk acceptance is recorded;
- production Safe/multisig and timelock addresses are reviewed;
- owner, treasury, guardian, and monitor roles are separated appropriately;
- incident response and pause procedures are tested;
- the exact immutable production commit is approved.

## Initial release scope

Only these guardrail contracts are approved for the initial Base release scope:

- `SentinelInterceptor`
- `CircuitBreaker`
- `RateLimiter`
- minimal ownership and monitoring support required by those contracts

Quantum, ZK, AI threat, yield, staking, insurance, AMM, governance, bridge, and marketing components remain experimental unless separately reviewed and approved.

## Deprecated tree

`sentinel-l3-v1.0/` is historical. It must not be used by active deployment workflows. Physical deletion remains gated on proof that no unique required source, test, script, ABI, or evidence file depends on it.

## Secret rotation

The tracked-file scanner blocks obvious new secret material. Rotate any key or credential ever committed, logged, pasted into issues, or used in client-side code.

## Execution rule

Use `scripts/check-base-deployment-readiness.mjs` before any Base deployment. Passing readiness does not itself authorize or execute an on-chain transaction.
