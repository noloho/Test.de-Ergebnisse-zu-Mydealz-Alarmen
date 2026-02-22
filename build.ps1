param(
  [ValidateSet("firefox", "chromium", "all")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

function Ensure-CleanDir($Path) {
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force $Path
  }
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Copy-Source($Dest) {
  Copy-Item -Recurse -Force "src\*" $Dest
}

function New-ZipFromDir {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$ZipPath
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  Add-Type -AssemblyName System.IO.Compression
  $sourceFull = (Resolve-Path $SourceDir).Path
  $zipFull = (Resolve-Path (Split-Path $ZipPath -Parent)).Path + "\" + (Split-Path $ZipPath -Leaf)

  $zipStream = [System.IO.File]::Open($zipFull, [System.IO.FileMode]::Create)
  $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    $files = Get-ChildItem -Path $sourceFull -Recurse -File
    foreach ($file in $files) {
      $relative = $file.FullName.Substring($sourceFull.Length).TrimStart("\")
      $entryName = $relative -replace "\\", "/"
      $entry = $archive.CreateEntry($entryName)
      $entryStream = $entry.Open()
      try {
        $fileStream = [System.IO.File]::OpenRead($file.FullName)
        try {
          $fileStream.CopyTo($entryStream)
        } finally {
          $fileStream.Dispose()
        }
      } finally {
        $entryStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
    $zipStream.Dispose()
  }
}

function Build-Firefox {
  $dest = "dist\firefox"
  Ensure-CleanDir $dest
  Copy-Source $dest
  Copy-Item -Force "manifest.firefox.json" "$dest\manifest.json"
  if (Test-Path "dist\firefox.zip") { Remove-Item -Force "dist\firefox.zip" }
  New-ZipFromDir -SourceDir $dest -ZipPath "dist\firefox.zip"
}

function Build-Chromium {
  $dest = "dist\chromium"
  Ensure-CleanDir $dest
  Copy-Source $dest
  Copy-Item -Force "manifest.chromium.json" "$dest\manifest.json"
  if (Test-Path "dist\chromium.zip") { Remove-Item -Force "dist\chromium.zip" }
  New-ZipFromDir -SourceDir $dest -ZipPath "dist\chromium.zip"
}

switch ($Target) {
  "firefox" { Build-Firefox }
  "chromium" { Build-Chromium }
  "all" {
    Build-Firefox
    Build-Chromium
  }
}

Write-Host "Build completed: dist\"
