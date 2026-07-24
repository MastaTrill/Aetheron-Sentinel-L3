# Base Sepolia readiness trigger

This marker exists only to open the owner-authorized `run: sentinel readiness` pull request.

The target workflow ignores this branch's code, checks out immutable release candidate `a2e61a646129bc5744e6f5f734823fb5604b58e5`, and cannot broadcast a deployment transaction.
