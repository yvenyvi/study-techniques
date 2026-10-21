param([string]$InstallerDirectory = 'release')
$ErrorActionPreference = 'Stop'
$expected = ((Get-Content (Join-Path $InstallerDirectory 'SHA256SUMS.txt')) -split ' ')[0]
$installerPath = Join-Path $InstallerDirectory 'Study-Room-Windows-x64-Setup.exe'
$actual = (Get-FileHash $installerPath -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw 'Installer checksum does not match' }
$installDir = Join-Path $env:RUNNER_TEMP 'StudyRoomPreview'
$installer = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
if ($installer.ExitCode -ne 0) { throw "Installation failed: $($installer.ExitCode)" }
$env:STUDY_ROOM_EXECUTABLE = Join-Path $installDir 'study-room.exe'
if (!(Test-Path $env:STUDY_ROOM_EXECUTABLE)) { throw 'Installed application not found' }
node scripts/desktop-smoke.mjs
if ($LASTEXITCODE -ne 0) { throw 'Installed application check failed' }
