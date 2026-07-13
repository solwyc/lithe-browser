param(
  [string]$Python = "python"
)

$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $PSScriptRoot
$revision = "ea104dacec62c0de699686887e3f920caeb4f3e3"
$packagedRevision = "1.5.0"
$modelDirectory = Join-Path $sourceRoot (
  "browser\components\vibes\models\Xenova\bge-small-en-v1.5\$packagedRevision"
)
$manifestPath = Join-Path $sourceRoot (
  "browser\components\vibes\model-manifest.json"
)

New-Item -ItemType Directory -Path $modelDirectory -Force | Out-Null

& $Python -m huggingface_hub.cli.hf download Xenova/bge-small-en-v1.5 `
  --revision $revision `
  --local-dir $modelDirectory `
  --include config.json `
  --include special_tokens_map.json `
  --include tokenizer.json `
  --include tokenizer_config.json `
  --include vocab.txt `
  --include onnx/model_quantized.onnx
if ($LASTEXITCODE -ne 0) {
  throw "The Hugging Face CLI could not fetch the Vibes model."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($file in $manifest.files.PSObject.Properties) {
  $path = Join-Path $modelDirectory $file.Name
  if (-not (Test-Path -LiteralPath $path)) {
    throw "The model download is incomplete: $($file.Name) is missing."
  }
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $file.Value) {
    throw "Model checksum mismatch for $($file.Name)."
  }
}

Write-Host "Verified pinned local Vibes model at $modelDirectory"
