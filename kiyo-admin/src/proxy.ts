// Next.js 16 の file convention。旧 `middleware.ts` は deprecated で `proxy.ts` に改名された。
// （pwa/ はまだ middleware.ts のまま。あちらを移行するときはこのファイルを参考にする）
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット / PWA manifest / service worker / OAuth callback は素通しする。
    // manifest.json や sw.js が 307 で login に飛ぶと「アプリとしてインストール」が壊れる。
    "/((?!_next/static|_next/image|favicon.ico|icon\\.png|apple-icon\\.png|manifest\\.json|sw\\.js|icons/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
