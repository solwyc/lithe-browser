# SPDX-License-Identifier: MPL-2.0

param(
  [Parameter(Mandatory = $true)]
  [string]$FirefoxRoot,

  [string]$Python = "python",

  [switch]$SkipModel
)

$ErrorActionPreference = "Stop"
$expectedRevision = "d4ae522db3b933e502d1febec899e7955c1fb633"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$overlayRoot = Join-Path $repositoryRoot "overlay"
$patchPath = Join-Path $repositoryRoot "patches\lithe.patch"
$mozconfigPath = Join-Path $repositoryRoot "mozconfig.lithe"
$targetRoot = (Resolve-Path -LiteralPath $FirefoxRoot).Path

if (-not (Test-Path -LiteralPath (Join-Path $targetRoot ".git"))) {
  throw "FirefoxRoot must be a Git checkout of mozilla-firefox/firefox."
}

$actualRevision = (& git -C $targetRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualRevision -ne $expectedRevision) {
  throw "Expected Firefox revision $expectedRevision, found $actualRevision."
}

$trackedChanges = & git -C $targetRoot status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $trackedChanges) {
  throw "The Firefox checkout has tracked changes. Apply Lithe to a clean checkout."
}

& git -C $targetRoot apply --check $patchPath
if ($LASTEXITCODE -ne 0) {
  throw "The Lithe patch does not apply cleanly to the pinned revision."
}

& git -C $targetRoot apply $patchPath
if ($LASTEXITCODE -ne 0) {
  throw "The Lithe patch could not be applied."
}

Copy-Item -Path (Join-Path $overlayRoot "*") -Destination $targetRoot -Recurse -Force
Copy-Item -LiteralPath $mozconfigPath -Destination (Join-Path $targetRoot "mozconfig") -Force

if (-not $SkipModel) {
  & (Join-Path $targetRoot "lithe_tools\fetch-vibes-model.ps1") -Python $Python
  if ($LASTEXITCODE -ne 0) {
    throw "The pinned Vibes model could not be prepared."
  }
}

Write-Host "Lithe source applied to $targetRoot"
Write-Host "Run ./mach build from a MozillaBuild shell."
