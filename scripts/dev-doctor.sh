#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PWA_DIR="$ROOT/pwa"
GAS_DIR="$ROOT/gas"
IOS_DIR="$ROOT/ios"

ok() { printf "ok   %s\n" "$1"; }
warn() { printf "warn %s\n" "$1"; }
fail() { printf "fail %s\n" "$1"; }
section() { printf "\n== %s ==\n" "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }

section "repo"
printf "root %s\n" "$ROOT"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" remote -v | sed 's/^/remote /'
  printf "branch %s\n" "$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
  UNPUSHED="$(git -C "$ROOT" log --branches --not --remotes --oneline 2>/dev/null || true)"
  if [ -n "$UNPUSHED" ]; then
    warn "local commits not on any remote:"
    printf "%s\n" "$UNPUSHED" | sed 's/^/  /'
  else
    ok "no unpushed local commits"
  fi
  DIRTY="$(git -C "$ROOT" status --short 2>/dev/null || true)"
  if [ -n "$DIRTY" ]; then
    warn "working tree has local changes"
    printf "%s\n" "$DIRTY" | sed 's/^/  /'
  else
    ok "working tree clean"
  fi
else
  fail "not a git repository"
fi

section "node"
if has node; then
  ok "node $(node -v) ($(command -v node))"
else
  fail "node is missing"
fi
if has npm; then
  ok "npm $(npm -v) ($(command -v npm))"
else
  fail "npm is missing"
fi
if has npx; then
  ok "npx $(npx -v) ($(command -v npx))"
else
  fail "npx is missing"
fi

section "pwa"
if [ -f "$PWA_DIR/package-lock.json" ]; then
  ok "package-lock.json found"
else
  fail "pwa/package-lock.json missing"
fi
if [ -d "$PWA_DIR/node_modules" ]; then
  ok "node_modules exists"
else
  warn "node_modules missing; run: cd pwa && npm ci"
fi
if [ -f "$PWA_DIR/.env.local" ]; then
  ok "pwa/.env.local exists"
else
  warn "pwa/.env.local missing; copy secrets from the trusted Mac"
fi
if [ -f "$PWA_DIR/.env.production.local" ]; then
  ok "pwa/.env.production.local exists"
else
  warn "pwa/.env.production.local missing; production-like local checks may fail"
fi
if [ -f "$ROOT/.vercel/project.json" ]; then
  ok "root .vercel/project.json exists"
  grep -E '"projectName"|"projectId"|"rootDirectory"' "$ROOT/.vercel/project.json" | sed 's/^/  /'
else
  warn "root .vercel/project.json missing; restore .vercel or run npx vercel link"
fi
if [ -f "$PWA_DIR/.vercel/project.json" ]; then
  ok "pwa .vercel/project.json exists"
else
  warn "pwa .vercel/project.json missing"
fi

section "cli"
if has vercel; then
  ok "vercel $(vercel --version 2>/dev/null | tail -1)"
else
  warn "vercel CLI missing; use npx vercel or install it"
fi
if has clasp; then
  ok "clasp $(clasp --version 2>/dev/null | tail -1)"
elif npx --yes @google/clasp --version >/tmp/amd-os-clasp-version.$$ 2>/dev/null; then
  ok "clasp via npx $(cat /tmp/amd-os-clasp-version.$$)"
  rm -f /tmp/amd-os-clasp-version.$$
else
  rm -f /tmp/amd-os-clasp-version.$$
  warn "clasp missing; GAS push needs npx @google/clasp login"
fi
if has supabase; then
  ok "supabase $(supabase --version 2>/dev/null | tail -1)"
else
  warn "supabase CLI missing; only needed for Supabase CLI workflows"
fi
if has xcodegen; then
  ok "xcodegen $(xcodegen --version 2>/dev/null | tail -1)"
else
  warn "xcodegen missing; only needed after ios/project.yml changes"
fi

section "gas"
if [ -f "$GAS_DIR/.clasp.json" ]; then
  ok "gas/.clasp.json exists"
else
  warn "gas/.clasp.json missing"
fi
if [ -f "$GAS_DIR/appsscript.json" ]; then
  ok "gas/appsscript.json exists"
else
  fail "gas/appsscript.json missing"
fi

section "ios"
if has xcodebuild; then
  ok "$(xcodebuild -version | tr '\n' ' ')"
else
  warn "xcodebuild missing; install Xcode"
fi
if [ -d "$IOS_DIR/AMDOS.xcodeproj" ]; then
  ok "ios/AMDOS.xcodeproj exists"
else
  warn "ios/AMDOS.xcodeproj missing"
fi
if [ -f "$IOS_DIR/project.yml" ]; then
  ok "ios/project.yml exists"
else
  warn "ios/project.yml missing"
fi

section "next steps"
printf "1. If PWA deps are missing: cd %s && npm ci\n" "$PWA_DIR"
printf "2. If secrets are missing: copy pwa/.env.local and pwa/.env.production.local from the trusted Mac\n"
printf "3. If Vercel link is missing: npx vercel link (armada0130 / amd-os-pwa)\n"
printf "4. Before coding on another Mac: git fetch --all --prune && git status -s\n"
