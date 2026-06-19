<#
.SYNOPSIS
  Backfill a GitHub Release for every vX.Y.Z tag, using the matching section of
  CHANGELOG.md as the release notes.

.DESCRIPTION
  Idempotent: tags that already have a GitHub Release are skipped, so this is safe
  to re-run. Going forward the /release command creates the Release object itself
  (RELEASE.md, Step 6) — this script only exists to backfill releases cut before
  `gh` was installed.

.PREREQUISITES
  GitHub CLI installed and authenticated:
    winget install --id GitHub.cli
    gh auth login
  Run from anywhere inside the Agentheim source repo.

.EXAMPLE
  pwsh ./scripts/backfill-github-releases.ps1
  pwsh ./scripts/backfill-github-releases.ps1 -DryRun
#>
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# --- locate the repo + changelog (script lives in scripts/) ---
$repoRoot  = Split-Path -Parent $PSScriptRoot
$changelog = Join-Path $repoRoot 'CHANGELOG.md'
if (-not (Test-Path $changelog)) { throw "CHANGELOG.md not found at $changelog" }

# --- gh must be present and authenticated ---
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found. Install it (winget install --id GitHub.cli) and run 'gh auth login'."
}
gh auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) { throw "gh is not authenticated. Run 'gh auth login' first." }

# --- parse CHANGELOG.md into version -> notes ---
$sections = @{}
$current  = $null
$buf      = New-Object System.Collections.Generic.List[string]
foreach ($line in (Get-Content $changelog)) {
  if ($line -match '^##\s+\[(\d+\.\d+\.\d+)\]') {
    if ($current) { $sections[$current] = (($buf -join "`n").Trim()) }
    $current = $Matches[1]
    $buf = New-Object System.Collections.Generic.List[string]
  } elseif ($current) {
    $buf.Add($line)
  }
}
if ($current) { $sections[$current] = (($buf -join "`n").Trim()) }

# --- one release per semver tag ---
$tags = git tag --sort=version:refname | Where-Object { $_ -match '^v\d+\.\d+\.\d+$' }
foreach ($tag in $tags) {
  $ver = $tag.TrimStart('v')

  gh release view $tag 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Host "skip   $tag (release already exists)"; continue }

  $notes = $sections[$ver]
  if (-not $notes) {
    Write-Host "WARN   $tag has no CHANGELOG section — using a pointer note"
    $notes = "See [CHANGELOG.md](../blob/main/CHANGELOG.md)."
  }

  if ($DryRun) { Write-Host "dryrun would create $tag"; continue }

  $tmp = New-TemporaryFile
  try {
    Set-Content -Path $tmp -Value $notes -Encoding utf8
    gh release create $tag --title $tag --notes-file $tmp --verify-tag
    Write-Host "create $tag"
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

Write-Host "Done."
