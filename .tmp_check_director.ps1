$cookie = '.tmp_director_cookies.txt'
$basePages = (Resolve-Path 'src\app\(portal)\director').Path
$baseApis = (Resolve-Path 'src\app\api\director').Path

$pages = Get-ChildItem -Recurse 'src\app\(portal)\director' -Filter 'page.tsx' | ForEach-Object {
  $rel = $_.FullName.Substring($basePages.Length).TrimStart('\\')
  $route = '/director/' + ($rel -replace '\\page.tsx$','' -replace '\\','/')
  if ($route -eq '/director/') { '/director' } else { $route }
} | Sort-Object

$apis = Get-ChildItem -Recurse 'src\app\api\director' -Filter 'route.ts' | ForEach-Object {
  $rel = $_.FullName.Substring($baseApis.Length).TrimStart('\\')
  '/api/director/' + ($rel -replace '\\route.ts$','' -replace '\\','/')
} | Sort-Object

function Test-Url([string]$path) {
  $tmp = '.tmp_resp.txt'
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  $code = curl.exe -sS -o $tmp -w "%{http_code}" -b $cookie ("http://127.0.0.1:3000" + $path)
  $body = ''
  if (Test-Path $tmp) { $body = Get-Content $tmp -Raw }
  [PSCustomObject]@{ Code = $code; Path = $path; Body = $body }
}

"=== PAGES ==="
foreach ($p in $pages) {
  $r = Test-Url $p
  if ($r.Code -eq '200') {
    "{0}`t{1}" -f $r.Code, $r.Path
  } else {
    $snippet = ($r.Body -replace "`r?`n", ' ')
    if ($snippet.Length -gt 200) { $snippet = $snippet.Substring(0,200) + '...' }
    "{0}`t{1}`t{2}" -f $r.Code, $r.Path, $snippet
  }
}

"=== APIS ==="
foreach ($a in $apis) {
  $r = Test-Url $a
  if ($r.Code -eq '200') {
    $snippet = ($r.Body -replace "`r?`n", ' ')
    if ($snippet.Length -gt 240) { $snippet = $snippet.Substring(0,240) + '...' }
    "{0}`t{1}`t{2}" -f $r.Code, $r.Path, $snippet
  } else {
    $snippet = ($r.Body -replace "`r?`n", ' ')
    if ($snippet.Length -gt 240) { $snippet = $snippet.Substring(0,240) + '...' }
    "{0}`t{1}`t{2}" -f $r.Code, $r.Path, $snippet
  }
}
