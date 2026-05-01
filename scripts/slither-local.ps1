# PowerShell script to run Slither static analysis on all contracts
# Usage: ./scripts/slither-local.ps1 [extra slither args]

if (-not (Get-Command slither -ErrorAction SilentlyContinue)) {
    Write-Host "Slither is not installed. Activate your Python environment and run: pip install slither-analyzer"
    exit 1
}

npx hardhat compile
slither ./contracts --filter-paths 'node_modules|test|scripts' $args
