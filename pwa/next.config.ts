import type { NextConfig } from "next";

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
      "connect-src 'self' https://*.supabase.co https://script.google.com https://accounts.google.com",
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
      "connect-src 'self' https://*.supabase.co https://script.google.com https://accounts.google.com",
      "frame-ancestors 'self' http://127.0.0.1:8766 http://localhost:8766",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
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
  },
  async headers() {
    return [
      {
        source: "/:path((?!hud/dashboard/embed).*)",
        headers: securityHeaders,
      },
      {
        source: "/hud/dashboard/embed",
        headers: embedSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
