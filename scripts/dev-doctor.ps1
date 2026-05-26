param()

$ErrorActionPreference = "Continue"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PwaDir = Join-Path $Root "pwa"
$GasDir = Join-Path $Root "gas"
$IosDir = Join-Path $Root "ios"

function Ok($Message) {
  Write-Host ("ok   " + $Message)
}

function Warn($Message) {
  Write-Host ("warn " + $Message)
}

function Fail($Message) {
  Write-Host ("fail " + $Message)
}

function Section($Title) {
  Write-Host ""
  Write-Host ("== " + $Title + " ==")
}

function HasCommand($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function RunText($Command, [string[]]$Arguments, $WorkingDirectory = $Root) {
  if (-not (HasCommand $Command)) {
    return ""
  }
  $current = Get-Location
  try {
    Set-Location $WorkingDirectory
    $output = & $Command @Arguments 2>$null
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
      return ""
    }
    return (($output | ForEach-Object { "$_" }) -join "`n").Trim()
  } catch {
    return ""
  } finally {
    Set-Location $current
  }
}

Section "repo"
Write-Host ("root " + $Root)
if (HasCommand "git") {
  $inside = RunText "git" @("-C", $Root, "rev-parse", "--is-inside-work-tree")
  if ($inside -eq "true") {
    $remotes = RunText "git" @("-C", $Root, "remote", "-v")
    if ($remotes) {
      $remotes -split "`n" | ForEach-Object { Write-Host ("remote " + $_) }
    }
    $branch = RunText "git" @("-C", $Root, "branch", "--show-current")
    Write-Host ("branch " + $branch)

    $unpushed = RunText "git" @("-C", $Root, "log", "--branches", "--not", "--remotes", "--oneline")
    if ($unpushed) {
      Warn "local commits not on any remote:"
      $unpushed -split "`n" | ForEach-Object { Write-Host ("  " + $_) }
    } else {
      Ok "no unpushed local commits"
    }

    $dirty = RunText "git" @("-C", $Root, "status", "--short")
    if ($dirty) {
      Warn "working tree has local changes"
      $dirty -split "`n" | ForEach-Object { Write-Host ("  " + $_) }
    } else {
      Ok "working tree clean"
    }
  } else {
    Fail "not a git repository"
  }
} else {
  Fail "git is missing"
}

Section "node"
if (HasCommand "node") {
  Ok ("node " + (RunText "node" @("-v")) + " (" + (Get-Command node).Source + ")")
} else {
  Fail "node is missing"
}
if (HasCommand "npm") {
  Ok ("npm " + (RunText "npm" @("-v")) + " (" + (Get-Command npm).Source + ")")
} else {
  Fail "npm is missing"
}
if (HasCommand "npx") {
  Ok ("npx " + (RunText "npx" @("-v")) + " (" + (Get-Command npx).Source + ")")
} else {
  Fail "npx is missing"
}

Section "pwa"
if (Test-Path (Join-Path $PwaDir "package-lock.json")) {
  Ok "package-lock.json found"
} else {
  Fail "pwa/package-lock.json missing"
}
if (Test-Path (Join-Path $PwaDir "node_modules")) {
  Ok "node_modules exists"
} else {
  Warn "node_modules missing; run: cd pwa; npm ci"
}
if (Test-Path (Join-Path $PwaDir ".env.local")) {
  Ok "pwa/.env.local exists"
} else {
  Warn "pwa/.env.local missing; copy secrets from the trusted Mac"
}
if (Test-Path (Join-Path $PwaDir ".env.production.local")) {
  Ok "pwa/.env.production.local exists"
} else {
  Warn "pwa/.env.production.local missing; production-like local checks may fail"
}

$rootVercel = Join-Path $Root ".vercel/project.json"
if (Test-Path $rootVercel) {
  Ok "root .vercel/project.json exists"
  Get-Content $rootVercel | Select-String -Pattern '"projectName"|"projectId"|"rootDirectory"' | ForEach-Object { Write-Host ("  " + $_.Line.Trim()) }
} else {
  Warn "root .vercel/project.json missing; restore .vercel or run npx vercel link"
}
if (Test-Path (Join-Path $PwaDir ".vercel/project.json")) {
  Ok "pwa .vercel/project.json exists"
} else {
  Warn "pwa .vercel/project.json missing"
}

Section "cli"
if (HasCommand "vercel") {
  Ok ("vercel " + (RunText "vercel" @("--version")))
} else {
  Warn "vercel CLI missing; use npx vercel or install it"
}
if (HasCommand "clasp") {
  Ok ("clasp " + (RunText "clasp" @("--version")))
} elseif (HasCommand "npx") {
  $claspVersion = RunText "npx" @("--yes", "@google/clasp", "--version")
  if ($claspVersion) {
    Ok ("clasp via npx " + $claspVersion)
  } else {
    Warn "clasp missing; GAS push needs npx @google/clasp login"
  }
} else {
  Warn "clasp missing; GAS push needs npx @google/clasp login"
}
if (HasCommand "supabase") {
  Ok ("supabase " + (RunText "supabase" @("--version")))
} else {
  Warn "supabase CLI missing; only needed for Supabase CLI workflows"
}
if (HasCommand "xcodegen") {
  Ok ("xcodegen " + (RunText "xcodegen" @("--version")))
} else {
  Warn "xcodegen missing; only needed after ios/project.yml changes"
}

Section "gas"
if (Test-Path (Join-Path $GasDir ".clasp.json")) {
  Ok "gas/.clasp.json exists"
} else {
  Warn "gas/.clasp.json missing"
}
if (Test-Path (Join-Path $GasDir "appsscript.json")) {
  Ok "gas/appsscript.json exists"
} else {
  Fail "gas/appsscript.json missing"
}

Section "ios"
if (HasCommand "xcodebuild") {
  Ok (RunText "xcodebuild" @("-version"))
} else {
  Warn "xcodebuild missing; install Xcode if this is a Mac"
}
if (Test-Path (Join-Path $IosDir "AMDOS.xcodeproj")) {
  Ok "ios/AMDOS.xcodeproj exists"
} else {
  Warn "ios/AMDOS.xcodeproj missing"
}
if (Test-Path (Join-Path $IosDir "project.yml")) {
  Ok "ios/project.yml exists"
} else {
  Warn "ios/project.yml missing"
}

Section "next steps"
Write-Host ("1. If PWA deps are missing: cd " + $PwaDir + "; npm ci")
Write-Host "2. If secrets are missing: copy pwa/.env.local and pwa/.env.production.local from the trusted Mac"
Write-Host "3. If Vercel link is missing: npx vercel link (armada0130 / amd-os-pwa)"
Write-Host "4. Before coding on another PC: git fetch --all --prune; git status -s"
