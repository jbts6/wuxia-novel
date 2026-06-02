$base = 'C:\git\wuxia-novel\金庸'
$dirs = Get-ChildItem $base -Directory

foreach ($dir in $dirs) {
    $name = $dir.Name
    $txtFiles = Get-ChildItem $dir.FullName -Filter '*.txt'
    $hasOriginal = $txtFiles | Where-Object { $_.Name -eq "$name.txt" }
    $newName = $name + '_新修版.txt'
    $hasNew = $txtFiles | Where-Object { $_.Name -eq $newName }
    $bakPath = Join-Path $dir.FullName "$name.txt.bak"
    $hasBak = Test-Path -LiteralPath $bakPath

    if ($hasBak) {
        Write-Host "[Skip] $name (.bak exists)"
    } elseif ($hasOriginal -and $hasNew) {
        Write-Host "[Rename] $name"
        Rename-Item -LiteralPath $hasOriginal.FullName -NewName "$name.txt.bak"
        Rename-Item -LiteralPath $hasNew.FullName -NewName "$name.txt"
    } elseif ($hasOriginal) {
        Write-Host "[Skip] $name (no new version)"
    } else {
        Write-Host "[Skip] $name (no original)"
    }
}

Write-Host ""
Write-Host "--- Done ---"
