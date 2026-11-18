# dev.ps1 - Safe local launcher for My List
# Forces the correct local SQLite URL no matter what is polluting the
# session (e.g. a leftover $env:DATABASE_URL from a Neon command).
#
# Run:            .\dev.ps1
# If blocked:     powershell -ExecutionPolicy Bypass -File .\dev.ps1

 $env:DATABASE_URL = "file:D:/DevCore/Milesto/db/custom.db"

Write-Host ""
Write-Host "DATABASE_URL = $env:DATABASE_URL" -ForegroundColor Green
Write-Host "Starting My List dev server..." -ForegroundColor Green
Write-Host ""

npm run dev