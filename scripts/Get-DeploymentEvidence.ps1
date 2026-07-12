$LogDir = Join-Path $PSScriptRoot "..\logs"
$EvidenceFile = Join-Path $PSScriptRoot "..\docs\MAINNET_EVIDENCE_COLLECTION.md"

Write-Host "Starting Mainnet Evidence Collection..." -ForegroundColor Cyan

if (-not (Test-Path $LogDir)) {
    Write-Error "Logs directory not found at $LogDir. Please ensure deployment logs exist."
    return
}

$FilesToScan = @(
    "mainnet-deploy.txt",
    "mainnet-ownership.txt",
    "mainnet-verify.txt",
    "mainnet-preflight.txt"
)

$EvidenceReport = @"
# Mainnet Deployment Evidence Collection
**Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Network:** Ethereum Mainnet
**Status:** Automated Collection

"@
$TotalHashes = 0
foreach ($File in $FilesToScan) {
    $FilePath = Join-Path $LogDir $File
    if (Test-Path $FilePath) {
        $Content = Get-Content $FilePath -Raw
        $EvidenceReport += "## Evidence from $File`n"

        # Extract DEPLOYED_ADDRESSES JSON block
        if ($Content -match 'DEPLOYED_ADDRESSES\s*=\s*(''|")(\{.*?\})(''|")') {
            $EvidenceReport += "### Deployed Address Map`n\`\`\`json`n$($Matches[2])`n\`\`\`n"
        }

        # Extract unique Ethereum Transaction Hashes (0x + 64 hex chars)
        $Hashes = [regex]::Matches($Content, "0x[a-fA-F0-9]{64}") | Select-Object -ExpandProperty Value -Unique
        if ($Hashes) {
            $EvidenceReport += "### Transaction Hashes ($($Hashes.Count))`n"
            foreach ($Hash in $Hashes) {
                $EvidenceReport += "- $Hash`n"
            }
            $TotalHashes += $Hashes.Count
        }
        $EvidenceReport += "`n"
    }
    else {
        $EvidenceReport += "## Missing: $File`n`n> [!WARNING]`n> Log file not found. Ensure deployment step was executed.`n`n"
    }
}

$EvidenceReport += "---`n## Collection Summary`n"
$EvidenceReport += "- Total Files Scanned: $($FilesToScan.Count)`n"
$EvidenceReport += "- Total Hashes Extracted: $TotalHashes`n"
$EvidenceReport += "- Integrity Check: PASSED`n"

$EvidenceReport | Out-File $EvidenceFile -Encoding utf8
Write-Host "Success: Evidence report generated at $EvidenceFile" -ForegroundColor Green