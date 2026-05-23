# Generate Android launcher icons from public/icon.png for all 5 densities.
# Replaces ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png.

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "$PSScriptRoot\.."
$src = Join-Path $root "public\icon.png"
if (-not (Test-Path $src)) { throw "Icon source not found: $src" }

$densities = @(
  @{ Name = "mdpi";    Legacy = 48;  Adaptive = 108 },
  @{ Name = "hdpi";    Legacy = 72;  Adaptive = 162 },
  @{ Name = "xhdpi";   Legacy = 96;  Adaptive = 216 },
  @{ Name = "xxhdpi";  Legacy = 144; Adaptive = 324 },
  @{ Name = "xxxhdpi"; Legacy = 192; Adaptive = 432 }
)

$srcImg = [System.Drawing.Image]::FromFile($src)
Write-Output "Source: $($srcImg.Width)x$($srcImg.Height)"

function Resize-Image {
  param([System.Drawing.Image]$img, [int]$size, [string]$outPath, [bool]$adaptive = $false)

  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($adaptive) {
    # Adaptive icon foreground: place icon at 72% of canvas, centered (safe zone = central 66%, plus margin).
    $iconSize = [int]($size * 0.72)
    $offset = [int](($size - $iconSize) / 2)
    $g.DrawImage($img, $offset, $offset, $iconSize, $iconSize)
  } else {
    $g.DrawImage($img, 0, 0, $size, $size)
  }

  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($d in $densities) {
  $dir = Join-Path $root "android\app\src\main\res\mipmap-$($d.Name)"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  Resize-Image $srcImg $d.Legacy   (Join-Path $dir "ic_launcher.png")           $false
  Resize-Image $srcImg $d.Legacy   (Join-Path $dir "ic_launcher_round.png")     $false
  Resize-Image $srcImg $d.Adaptive (Join-Path $dir "ic_launcher_foreground.png") $true

  Write-Output "$($d.Name): legacy=$($d.Legacy)px, adaptive=$($d.Adaptive)px (foreground 72%)"
}

$srcImg.Dispose()

# Set adaptive icon background to match icon's blue.
$bgXml = Join-Path $root "android\app\src\main\res\values\ic_launcher_background.xml"
Set-Content -Path $bgXml -Encoding UTF8 -Value @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1E5BC4</color>
</resources>
'@
Write-Output "Background color updated: #1E5BC4 (blue matching icon)"

Write-Output ""
Write-Output "Icons regenerated. Run 'npm run apk' to rebuild + install."
