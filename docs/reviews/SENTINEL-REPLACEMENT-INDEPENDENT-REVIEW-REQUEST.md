# SENTINEL replacement — independent review request (NOT an approval)

**Status:** Review request / preparation only. This file is not a security sign-off, Mainnet authorization, on-chain receipt, or trading approval.

**Related:** [#210](https://github.com/MastaTrill/Aetheron-Sentinel-L3/issues/210), [#215](https://github.com/MastaTrill/Aetheron-Sentinel-L3/issues/215), [#216](https://github.com/MastaTrill/Aetheron-Sentinel-L3/issues/216), [#217](https://github.com/MastaTrill/Aetheron-Sentinel-L3/issues/217), and [PR #861](https://github.com/MastaTrill/Aetheron-Sentinel-L3/pull/861).

## Reviewer independence

A qualified person or organization, **not** the project owner, evidence author/assistant, deployer, beneficiary controller, or trading-wallet controller, must independently perform and attest to the scope below. No reviewer is selected or claimed by this request. #217 is closed in GitHub, but its unchecked acceptance criteria do **not** constitute reproduced evidence. The parent #210 allows owner acceptance of proceeding without an independent review, while #215 still explicitly requires independent reproduction; the owner has requested genuine independent review, so do not portray that waiver as a completed review.

Reviewers must independently retrieve and verify the **exact candidate commit and file bytes**. Record the candidate commit, repository URL, SHA-256 of the manifest and all evidence files, tool versions, reproduction commands, findings, residual risks, reviewer identity, independent status, UTC timestamp, and signed public approval reference.

## Stage A — before any Mainnet authorization

1. Review the exact frozen candidate commit, compiler/optimizer settings, pinned dependency source commits, deployment bytecode, constructor and initializer calls, chain ID, owners, emergency controls, and fee beneficiary distribution.
2. Reproduce the contents of `release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json` and its digest, presently `984bffc7e27654ccf17d557e1994b633a1d591ac17874f14dadf160ebea6b404`. Verify this digest from raw file bytes; do not accept the text here as proof.
3. Verify the planned Aetheron treasury `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` receives exactly `570000000000000000` wad (57%) from inception; verify all other beneficiaries as pinned.
4. Reproduce the Base Sepolia rehearsal transaction `0x77117f06adb7c9355659244929e6143785d5b66a75b40e2732912205fed7c433`, including on-chain receipt, bytecode and beneficiaries.
5. Distinguish the legacy/non-canonical token `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` and pool ID `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d` from any future replacement.
6. Publish independently reproduced methods, findings and a signed/publicly verifiable review reference. Do not claim any unperformed step is complete.

## Stage B — only after a separately authorized replacement deployment

1. Read the genuine replacement deployment transaction, successful receipt, token, pool ID and initializer from Base Mainnet. **No replacement transaction or address is presently evidenced** in the tracked closure manifest.
2. Query the same reference block through two genuinely distinct Base Mainnet RPC operators. Verify block hash, replacement token bytecode/owner, pool manager, hook, all beneficiary addresses, and all original and verified shares.
3. Verify authority and beneficiary reachability through on-chain calls, not screenshots or manually populated templates; preserve the independent evidence source.
4. After a **separately** authorized, bounded buy and sell by a dedicated non-privileged wallet, inspect both genuine transaction receipts, signed quotes, token ordering, pool swap events, input/output amounts, wallet, route, gas, and slippage.
5. Check exact evidence hashes, CI, and `node scripts/validate-sentinel-redeployment-closure.mjs --mode=final`, and state any residual risks.

## Release gate status as of 2026-11-06

- Replacement manifest and protected Sepolia rehearsal: recorded as complete by the tracked closure manifest.
- Mainnet authorization: **expired** on 2026-09-05; a new exact-commit signed authorization and expiry are needed. Never extend or recycle the expired signature.
- Mainnet deployment receipt: **prepared**, no transaction hash. No basis to label a replacement token/pool canonical yet.
- Two independent Mainnet RPC captures, Mainnet authority proof, minimal replacement buy/sell receipts and immutable final evidence: **pending**.
- `release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json` currently documents a retired review gate, **not** an independent sign-off. A genuine review reference must remain distinct and verifiable.
- No wallet credentials, deployment signatures, trade execution, or economic expenditure is requested or authorized by this document.

## Required reviewer output

Provide a verifiable signed review with: reviewer identity and independence statement, UTC date, exact commit and manifest digest, reproducible methods and toolchain, evidence and receipts independently checked, findings, residual risks, a clear approval/rejection/conditional decision, and an immutable public link or signature.

Project owner must separately authorize exact deployment and trading terms. A reviewer cannot authorize those transactions, and ChatGPT cannot impersonate the reviewer.
