param([switch]$AutoStart, [string]$SolEnvFile)
$ErrorActionPreference = 'Stop'
$serviceSource = $PSScriptRoot
$serviceRoot = Join-Path $env:LOCALAPPDATA 'AMDOS\amie-local-ai'
$serviceApp = Join-Path $serviceRoot 'app'
$expectedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AMDOS\amie-local-ai'))
if ([IO.Path]::GetFullPath($serviceRoot) -ne $expectedRoot) { throw 'Unexpected runtime directory.' }
New-Item -ItemType Directory -Path $serviceApp -Force | Out-Null
# This runtime holds the user's imported documents. Limit inherited access to the current user and SYSTEM.
$serviceSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $serviceRoot /inheritance:r /grant:r "*${serviceSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect the local data directory.' }
if ($SolEnvFile) {
    $serviceEnvPath = (Resolve-Path -LiteralPath $SolEnvFile).Path
    if ([IO.Path]::GetFileName($serviceEnvPath) -notin @('.env.local','.env.production.local')) { throw 'Unexpected credential file.' }
    @{ sol_env_file = $serviceEnvPath } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $serviceRoot 'connectors.json') -Encoding UTF8
}
foreach ($serviceFile in @('server.py','start.py','setup_runtime.py','index.html','import_sol.py')) {
    Copy-Item -LiteralPath (Join-Path $serviceSource $serviceFile) -Destination (Join-Path $serviceApp $serviceFile) -Force
}
New-Item -ItemType Directory -Path (Join-Path $serviceApp 'prompts') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $serviceSource 'prompts\grounded-answer-v1.txt') -Destination (Join-Path $serviceApp 'prompts\grounded-answer-v1.txt') -Force
$servicePython = (Get-Command python.exe).Source
$servicePythonw = Join-Path (Split-Path $servicePython) 'pythonw.exe'
if (-not (Test-Path -LiteralPath $servicePythonw)) { throw 'pythonw.exe is required for the hidden launcher.' }
$serviceShell = New-Object -ComObject WScript.Shell
$serviceShortcutName = 'AMD OS ' + (-join ([char[]](0x30ED,0x30FC,0x30AB,0x30EB))) + 'AI.lnk'
$serviceShortcut = $serviceShell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) $serviceShortcutName))
$serviceShortcut.TargetPath = $servicePythonw
$serviceShortcut.Arguments = '"' + (Join-Path $serviceApp 'start.py') + '" --open'
$serviceShortcut.WorkingDirectory = $serviceApp
$serviceShortcut.Description = 'AMD OS local research assistant (this PC only)'
$serviceShortcut.Save()
if ($AutoStart) {
    $serviceStartup = $serviceShell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) $serviceShortcutName))
    $serviceStartup.TargetPath = $servicePythonw
    $serviceStartup.Arguments = '"' + (Join-Path $serviceApp 'start.py') + '"'
    $serviceStartup.WorkingDirectory = $serviceApp
    $serviceStartup.Save()
}
Write-Output 'Local app copied and desktop shortcut installed. Login auto-start is opt-in.'
