param(
  [string]$ObjectDirectory = "obj-x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $sourceRoot "$ObjectDirectory\dist\bin"
$upstreamLauncher = Join-Path $distDirectory "firefox.exe"
$litheLauncher = Join-Path $distDirectory "lithe.exe"
$applicationIni = Join-Path $distDirectory "application.ini"
$icon = Join-Path $sourceRoot "browser\branding\lithe\firefox.ico"
$helperSource = Join-Path $PSScriptRoot "lithe_resource_brand.cpp"
$helperDirectory = Join-Path $PSScriptRoot "build"
$helper = Join-Path $helperDirectory "lithe_resource_brand.exe"
$devCommand = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"

foreach ($requiredPath in @(
  $upstreamLauncher,
  $applicationIni,
  $icon,
  $helperSource,
  $devCommand
)) {
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

# Artifact builds reuse upstream native files, including application.ini.
# Rewrite the runtime identity and remove network endpoints that do not belong
# to this independently distributed browser.
$ini = Get-Content -LiteralPath $applicationIni -Raw
$ini = [regex]::Replace($ini, '(?m)^Vendor=.*$', 'Vendor=Lithe Project')
$ini = [regex]::Replace(
  $ini,
  '(?m)^ID=.*$',
  'ID={319bf2b2-64d9-4af8-8c61-02f8261ff97e}'
)
$ini = [regex]::Replace(
  $ini,
  '(?ms)\r?\n\[Crash Reporter\]\r?\n.*?(?=\r?\n\[|\z)',
  ''
)
$ini = [regex]::Replace(
  $ini,
  '(?ms)\r?\n\[AppUpdate\]\r?\n.*?(?=\r?\n\[|\z)',
  ''
)
[IO.File]::WriteAllText(
  $applicationIni,
  $ini.TrimEnd() + [Environment]::NewLine,
  [Text.UTF8Encoding]::new($false)
)

Get-Item -LiteralPath $litheLauncher |
  Select-Object FullName, Length, LastWriteTime
