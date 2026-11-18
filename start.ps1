# kinee-signal x402 服务一键启动
# 作用: 确保代理在跑 -> 起服务(3100) -> 起 cloudflared 隧道 -> 打印公网地址
$ErrorActionPreference = 'Continue'
$svcDir = "C:\Users\zoah\Documents\1\x402-service"
$cf = "C:\Users\zoah\Documents\1\flop\bin\cloudflared.exe"

# 1. 代理检查
$proxyUp = [bool](Get-NetTCPConnection -State Listen -LocalPort 7897 -ErrorAction SilentlyContinue)
if (-not $proxyUp) {
    $mihomoDir = "C:\Users\zoah\Documents\1\ghost-stack\60-runtime"
    Start-Process -FilePath "$mihomoDir\mihomo.exe" -ArgumentList '-d','.', '-f','config.yaml' -WorkingDirectory $mihomoDir -WindowStyle Hidden -RedirectStandardOutput "$mihomoDir\mihomo.run.log" -RedirectStandardError "$mihomoDir\mihomo.run.err"
    Start-Sleep -Seconds 4
    Write-Host "[proxy] mihomo started"
} else {
    Write-Host "[proxy] already up (7897)"
}

# 2. 服务检查
$svcUp = [bool](Get-NetTCPConnection -State Listen -LocalPort 3100 -ErrorAction SilentlyContinue)
if (-not $svcUp) {
    Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory $svcDir -WindowStyle Hidden -RedirectStandardOutput "$svcDir\server.out.log" -RedirectStandardError "$svcDir\server.err.log"
    Start-Sleep -Seconds 4
    Write-Host "[svc] node server.mjs started on :3100"
} else {
    Write-Host "[svc] already up (3100)"
}

# 3. 隧道检查
$tunnelLog = "$svcDir\tunnel.log.err"
$existing = Select-String -Path $tunnelLog -Pattern "trycloudflare.com" -ErrorAction SilentlyContinue | Select-Object -Last 1
$cfProc = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '3100' }
if (-not $cfProc) {
    Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://127.0.0.1:3100","--no-autoupdate" -WindowStyle Hidden -RedirectStandardOutput "$svcDir\tunnel.log" -RedirectStandardError $tunnelLog
    Start-Sleep -Seconds 10
    $existing = Select-String -Path $tunnelLog -Pattern "trycloudflare.com" -ErrorAction SilentlyContinue | Select-Object -Last 1
}
if ($existing) {
    $url = ($existing.Line -replace '.*(https://[a-z0-9\-]+\.trycloudflare\.com).*','$1')
    Write-Host "[tunnel] PUBLIC URL: $url"
} else {
    Write-Host "[tunnel] start failed, check $tunnelLog"
}

Write-Host ""
Write-Host "Test:"
Write-Host ('  curl -i ' + $url + '/signal')
