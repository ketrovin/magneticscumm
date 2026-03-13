Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('Dave3.png')
$bmp = New-Object System.Drawing.Bitmap $img

$cols = @()
for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        if ($bmp.GetPixel($x, $y).A -gt 128) {
            $cols += $x
            break
        }
    }
}

$rows = @()
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        if ($bmp.GetPixel($x, $y).A -gt 128) {
            $rows += $y
            break
        }
    }
}

function Get-Islands($arr) {
    if ($arr.Length -eq 0) { return "" }
    $islands = @()
    $start = $arr[0]; $prev = $arr[0]
    for ($i = 1; $i -lt $arr.Length; $i++) {
        if ($arr[$i] -gt $prev + 5) {
            $islands += "$start-$prev"
            $start = $arr[$i]
        }
        $prev = $arr[$i]
    }
    $islands += "$start-$prev"
    return ($islands -join ', ')
}

Write-Output "X islands: $(Get-Islands $cols)"
Write-Output "Y islands: $(Get-Islands $rows)"
