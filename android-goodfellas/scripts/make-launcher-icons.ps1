param(
    [string] $Source = "..\image.png"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Resolve-Path (Join-Path $PSScriptRoot $Source)
$res = Join-Path $root "app\src\main\res"
$drawable = Join-Path $res "drawable"
$drawableNoDpi = Join-Path $res "drawable-nodpi"

Add-Type -AssemblyName System.Drawing

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

function New-ContainedPng {
    param(
        [System.Drawing.Image] $Image,
        [int] $Size,
        [string] $Path,
        [double] $Padding = 0.88
    )

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 7, 19, 15))

    $scale = [Math]::Min($Size / $Image.Width, $Size / $Image.Height) * $Padding
    $drawWidth = [int]($Image.Width * $scale)
    $drawHeight = [int]($Image.Height * $scale)
    $x = [int](($Size - $drawWidth) / 2)
    $y = [int](($Size - $drawHeight) / 2)
    $graphics.DrawImage($Image, $x, $y, $drawWidth, $drawHeight)

    $graphics.Dispose()
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

$image = [System.Drawing.Image]::FromFile($sourcePath)
try {
    New-Item -ItemType Directory -Force -Path $drawableNoDpi | Out-Null
    $oldVector = Join-Path $drawable "ic_launcher_foreground.xml"
    if (Test-Path $oldVector) {
        Remove-Item -LiteralPath $oldVector
    }
    New-ContainedPng -Image $image -Size 432 -Path (Join-Path $drawableNoDpi "ic_launcher_foreground.png") -Padding 0.92

    foreach ($entry in $sizes.GetEnumerator()) {
        $dir = Join-Path $res $entry.Key
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        New-ContainedPng -Image $image -Size $entry.Value -Path (Join-Path $dir "ic_launcher.png")
        New-ContainedPng -Image $image -Size $entry.Value -Path (Join-Path $dir "ic_launcher_round.png")
    }
} finally {
    $image.Dispose()
}

Write-Host "Launcher icons generated from $sourcePath"
