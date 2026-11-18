# kinegrant.com Cloudflare Tunnel 绑定（NS 已迁到 Cloudflare 之后执行）
# 用法: powershell -ExecutionPolicy Bypass -File setup_tunnel.ps1
$ErrorActionPreference = 'Continue'
$cf = "C:\Users\zoah\Documents\1\flop\bin\cloudflared.exe"
$hostname = "api.kinegrant.com"
$tunnelName = "kine-signal"
$cfgDir = "$env:USERPROFILE\.cloudflared"

# 1. 登录（浏览器里选择 kinegrant.com 授权）
Write-Host "[1/5] cloudflared login - 浏览器里选中 kinegrant.com 并点 Authorize"
& $cf tunnel login

if (-not (Test-Path "$cfgDir\cert.pem")) {
    Write-Host "[!] 未完成登录（没有 cert.pem），终止"
    exit 1
}

# 2. 创建 tunnel（已存在则跳过）
$existing = & $cf tunnel list 2>$null | Select-String -Pattern "\b$tunnelName\b"
if (-not $existing) {
    Write-Host "[2/5] 创建 tunnel: $tunnelName"
    & $cf tunnel create $tunnelName
} else {
    Write-Host "[2/5] tunnel 已存在: $tunnelName"
}

# 3. 找 credentials 文件
$credFile = Get-ChildItem $cfgDir -Filter "*.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "cert.pem" } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $credFile) { Write-Host "[!] 找不到 tunnel 凭据 json"; exit 1 }
$tunnelId = $credFile.BaseName
Write-Host "[3/5] tunnel id: $tunnelId"

# 4. DNS 路由
Write-Host "[4/5] 绑定域名 $hostname"
& $cf tunnel route dns $tunnelName $hostname

# 5. 写配置并启动
$config = @"
tunnel: $tunnelId
credentials-file: $($credFile.FullName)
ingress:
  - hostname: $hostname
    service: http://127.0.0.1:3100
  - service: http_status:404
"@
Set-Content -Path "$cfgDir\config.yml" -Value $config -Encoding UTF8
Write-Host "[5/5] 启动 tunnel"
Start-Process -FilePath $cf -ArgumentList "tunnel","--config","$cfgDir\config.yml","run",$tunnelName -WindowStyle Hidden -RedirectStandardOutput "C:\Users\zoah\Documents\1\x402-service\named-tunnel.log" -RedirectStandardError "C:\Users\zoah\Documents\1\x402-service\named-tunnel.err"

Start-Sleep -Seconds 8
Write-Host ""
Write-Host "验证:"
Write-Host "  curl -i https://$hostname/signal"
