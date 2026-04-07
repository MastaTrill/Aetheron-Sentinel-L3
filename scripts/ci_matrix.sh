#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH=src

python -m unittest -v tests.test_interceptor
python -m unittest -v tests.test_readiness
python -m unittest -v tests.test_rpc_integration
