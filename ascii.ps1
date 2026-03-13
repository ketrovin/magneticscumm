Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('X:\magneticscumm\Dave3.png')
$bmp = New-Object System.Drawing.Bitmap $img

$w = $bmp.Width
$h = $bmp.Height

$result = @()

for ($y = 0; $y -lt $h; $y += 20) {
    $rowStr = ''
    for ($x = 0; $x -lt $w; $x += 10) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -lt 128) {
            $rowStr += ' '
        } else {
            $v = ($p.R + $p.G + $p.B) / 3
            if ($v -gt 128) { $rowStr += '#' } else { $rowStr += '*' }
        }
    }
    $result += $rowStr
}

Set-Content -Path 'X:\magneticscumm\ascii.txt' -Value ($result -join "`n")
