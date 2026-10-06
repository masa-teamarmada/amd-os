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

// The authenticated monthly report can be embedded only by this OS.
const monthlyReportSecurityHeaders = securityHeaders.map((header) =>
  header.key === "X-Frame-Options" ? { ...header, value: "SAMEORIGIN" }
  : header.key === "Content-Security-Policy" ? { ...header, value: header.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }
  : header,
);

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

// DDの添付（公開時点で固定したHTML）を表示する route は、全体の CSP（inline script を許す）ではなく、
// スクリプト・外部通信・フォーム送信を止めるサンドボックスで返す。route が付けたヘッダーは全体の設定に上書きされるため、
// ここで同じ path に後から当てて上書きする（Next.js は同じキーを後の設定で上書きする。2026-09-30 ローカル実測で確認）。
const ddPublicationFileSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
  },
];

// 書斎の図（/api/bzm-reader/asset/...）を配る route も同じ事情。SVG は route が付けた CSP が全体の設定に
// 上書きされると、直接開いたときに全体の CSP（inline script を許す）で動き、中のスクリプトが同一オリジンで走る。
// ここで同じ path に後から当てて上書きし、スクリプト・外部通信・フォーム送信を止める。
const bzmReaderAssetSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  },
];

const nextConfig: NextConfig = {
  env: buildStampEnv,
  // 2026-05-12 まさ要望「雛形そのまま」で /api/admin/pj-introduction-html が
  // src/lib/exec_summary/*.{html,css} を readFileSync するため、Vercel build 時に
  // bundle に含めるよう明示する。これが無いと "ENOENT" で route が落ちる。
  // BZM の md は pwa の外 (= amd-os/bzm/) にあるので、tracing root を pwa から
  // リポジトリルートへ上げる。上げないと `../bzm/**` が root の外になり、
  // outputFileTracingIncludes に書いても bundle へ入らない。
  // Vercel 側は Root Directory=pwa だが sourceFilesOutsideRootDirectory が有効なので、
  // ビルド環境にはリポジトリ全体が入っている。
  outputFileTracingRoot: path.join(PWA_ROOT, ".."),
  outputFileTracingExcludes: {
    "/api/macos/document": [
      "./design/**", "./design_log/**", "./output/**", "./scripts/**",
      "./public/**", "./src/**", "./*.html", "../bzm/pilot/**",
    ],
    "/model{,/**}": ["../bzm/pilot/**"],
    "/bzm{,/**}": ["../bzm/pilot/**"],
    "/api/monthly-report/history": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/@fontsource-variable/noto-sans-jp/**"],
    "/api/monthly-report/edit-by-tsukuyomi": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/@fontsource-variable/noto-sans-jp/**"],
  },
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
    // モデル正本 (amd-os/model/) は教科書と同じくリポジトリルート直下。/model は admin 限定 layout で
    // 動的レンダリングになり実行時に fs 読みするため、明示 bundle しないと本番だけ ENOENT になる。
    "/model/[slug]/page": ["../model/**/*.md", "../model/**/*.json", "../bzm/**/*.md"],
    "/model/page": ["../model/**/*.md", "../model/**/*.json", "../bzm/**/*.md"],
    // モデルページは正本 bzm md から式と記号を実行時に抽出するので bzm も要る。
    "/model/formulas/page": ["../model/**/*.md", "../model/**/*.json", "../bzm/**/*.md"],
    // 書斎 (/bzm/read) は bzm/*.md を実行時に fs 読みする (admin 限定 layout で動的レンダリング)。
    // 動的な fs 読みは nft の自動トレースに乗らず、本番だけ ENOENT になるため明示 bundle する。
    // 図は asset route が bzm/ 配下から拡張子限定で配るので、図の6拡張子も同梱する。
    "/bzm/read/page": ["../bzm/**/*.md"],
    "/bzm/read/[book]/page": ["../bzm/**/*.md"],
    "/bzm/read/[book]/[chapter]/page": ["../bzm/**/*.md"],
    "/api/bzm-reader/asset/[...path]/route": [
      "../bzm/**/*.png",
      "../bzm/**/*.jpg",
      "../bzm/**/*.jpeg",
      "../bzm/**/*.svg",
      "../bzm/**/*.webp",
      "../bzm/**/*.gif",
    ],
    "/api/macos/document/route": [
      "./manual/**/*.md",
      "./spec/**/*.md",
      "../bzm/**/*.md",
    ],
    // 資料室のHTML→PDF変換は、日本語を含む既存の共有HTMLをA4 PDFとして渡すため、
    // Fontsourceのfont本体をVercel Functionへ明示同梱する。動的なrequire.resolveだけでは
    // output file tracingに乗らず、本番だけ日本語が欠ける。
    // @sparticuz/chromiumの実行バイナリ(bin/*.br)はfs.existsSync(path.join(__dirname,...))で
    // 動的解決されるため自動tracingに乗らず、明示しないと /var/task に無くPDF生成が
    // 全滅する (2026-08-03 本番ログで確認)。
    "/api/monthly-report/{pdf,manual-update,external-manual-update}": ["./node_modules/@fontsource-variable/noto-sans-jp/**", "./node_modules/@sparticuz/chromium/bin/**"],
    "/api/report/fix": ["./node_modules/@fontsource-variable/noto-sans-jp/**", "./node_modules/@sparticuz/chromium/bin/**"],
    "/api/workspace-documents/*/pdf": [
      "./node_modules/@fontsource-variable/noto-sans-jp/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  async redirects() {
    return [
      // 公開の会議資料の置き場を /shared/<PJ>/ にそろえた（2026-10-04）。前に渡したリンクも開けるようにする。
      { source: "/kute/:path*", destination: "/shared/kute/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path((?!business-cards|native/business-cards).*)",
        headers: securityHeaders,
      },
      {
        source: "/project/:projectId/report/:ym/print",
        headers: monthlyReportSecurityHeaders,
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
        source: "/dd/:slug/items/:itemId/file",
        headers: ddPublicationFileSecurityHeaders,
      },
      {
        source: "/api/bzm-reader/asset/:path*",
        headers: bzmReaderAssetSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
