$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$secret = Read-Host 'Mot de passe administrateur BDS' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $env:BDS_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
try {
    python server.py
} finally {
    Remove-Item Env:BDS_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
