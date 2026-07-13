param(
  [string]$ObjectDirectory = "obj-x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $sourceRoot "$ObjectDirectory\dist\bin"
$upstreamLauncher = Join-Path $distDirectory "firefox.exe"
$litheLauncher = Join-Path $distDirectory "lithe.exe"
$icon = Join-Path $sourceRoot "browser\branding\lithe\firefox.ico"
$helperSource = Join-Path $PSScriptRoot "lithe_resource_brand.cpp"
$helperDirectory = Join-Path $PSScriptRoot "build"
$helper = Join-Path $helperDirectory "lithe_resource_brand.exe"
$devCommand = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"

foreach ($requiredPath in @($upstreamLauncher, $icon, $helperSource, $devCommand)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required file was not found: $requiredPath"
  }
}

if (-not (Test-Path -LiteralPath $helperDirectory)) {
  New-Item -ItemType Directory -Path $helperDirectory | Out-Null
}

$needsCompile = -not (Test-Path -LiteralPath $helper)
if (-not $needsCompile) {
  $needsCompile = (Get-Item -LiteralPath $helperSource).LastWriteTimeUtc -gt
    (Get-Item -LiteralPath $helper).LastWriteTimeUtc
}

if ($needsCompile) {
  $environment = & cmd.exe /d /s /c "`"$devCommand`" -no_logo -arch=x64 -host_arch=x64 && set"
  foreach ($line in $environment) {
    if ($line -match '^([^=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
  }

  $helperObject = Join-Path $helperDirectory "lithe_resource_brand.obj"
  & cl.exe /nologo /std:c++17 /O2 /Os /MT /EHsc $helperSource "/Fo:$helperObject" "/Fe:$helper"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not compile the Lithe Windows resource helper."
  }
}

Copy-Item -LiteralPath $upstreamLauncher -Destination $litheLauncher -Force
& $helper $litheLauncher $icon
if ($LASTEXITCODE -ne 0) {
  throw "Could not apply the Lithe executable icon."
}

Get-Item -LiteralPath $litheLauncher |
  Select-Object FullName, Length, LastWriteTime
