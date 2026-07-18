import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PWA_ROOT = path.dirname(fileURLToPath(import.meta.url));

function readCommand(command: string, fallback = "unknown"): string {
  try {
    const value = execSync(command, {
      cwd: PWA_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function readGitBranch(): string {
  const branch = readCommand("git rev-parse --abbrev-ref HEAD");
  if (branch !== "HEAD" && branch !== "unknown") return branch;
  const namedRef = readCommand("git name-rev --name-only --no-undefined HEAD", "detached");
  return namedRef === "undefined" ? "detached" : namedRef;
}

function readGitDirty(): string {
  const status = readCommand("git status --porcelain --untracked-files=all", "");
  return status ? "true" : "false";
}

const buildStampEnv = {
  NEXT_PUBLIC_AMD_OS_GIT_SHA:
    process.env.NEXT_PUBLIC_AMD_OS_GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    readCommand("git rev-parse --short=12 HEAD"),
  NEXT_PUBLIC_AMD_OS_GIT_BRANCH:
    process.env.NEXT_PUBLIC_AMD_OS_GIT_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    readGitBranch(),
  NEXT_PUBLIC_AMD_OS_DEPLOYED_AT:
    process.env.NEXT_PUBLIC_AMD_OS_DEPLOYED_AT ||
    new Date().toISOString(),
  NEXT_PUBLIC_AMD_OS_DIRTY:
    process.env.NEXT_PUBLIC_AMD_OS_DIRTY ||
    readGitDirty(),
};

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval for dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://script.google.com https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const embedSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://script.google.com https://accounts.google.com",
      "frame-ancestors 'self' http://127.0.0.1:8766 http://localhost:8766",
    ].join("; "),
  },
];

const businessCardSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://script.google.com https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  env: buildStampEnv,
  // 2026-05-12 まさ要望「雛形そのまま」で /api/admin/pj-introduction-html が
  // src/lib/exec_summary/*.{html,css} を readFileSync するため、Vercel build 時に
  // bundle に含めるよう明示する。これが無いと "ENOENT" で route が落ちる。
  outputFileTracingIncludes: {
    "/api/admin/pj-introduction-html/route": [
      "./src/lib/exec_summary/template_section.html",
      "./src/lib/exec_summary/template.css",
    ],
    // /manual/[slug] と /manual は (app) レイアウトの auth で dynamic (ƒ) になり、
    // 実行時に process.cwd()/manual/{slug}.md を fs.readFileSync する。動的パスの
    // fs 読みは nft の自動トレースに乗らないため、manual/*.md を明示 bundle しないと
    // 実行時 ENOENT → notFound() → 404 になる (= 新章 9-3 が 404 だった真因、2026-05-29)。
    // Gemini つくよみ Manual Q&A も manual md を文脈に読むため同じ include を付ける。
    "/manual/[slug]/page": ["./manual/**/*.md"],
    "/manual/page": ["./manual/**/*.md"],
    "/api/manual/tsukuyomi/ask/route": ["./manual/**/*.md"],
    // Native macOS の文書readerもPWAの git 管理Markdownを正本として返す。
    // route内の readdir/readFileSync は自動トレースに乗らないため、ここで本文を
    // 明示しないと本番だけ `document not found` になる。
    "/api/macos/document/route": [
      "./manual/**/*.md",
      "./spec/**/*.md",
      "./bzm/**/*.md",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path((?!hud/dashboard/embed|business-cards|native/business-cards).*)",
        headers: securityHeaders,
      },
      {
        source: "/business-cards",
        headers: businessCardSecurityHeaders,
      },
      {
        source: "/business-cards/:path*",
        headers: businessCardSecurityHeaders,
      },
      {
        source: "/native/business-cards",
        headers: businessCardSecurityHeaders,
      },
      {
        source: "/native/business-cards/:path*",
        headers: businessCardSecurityHeaders,
      },
      {
        source: "/hud/dashboard/embed",
        headers: embedSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
