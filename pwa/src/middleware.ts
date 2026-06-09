import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // 先に request headers に x-pathname をセットして updateSession に渡す。
  // (= server component の generateMetadata から next/headers の headers() で取れる)
  // Next.js の作法: response.headers.set だけだと server component に届かないため、
  // request の header を modify した上で updateSession を呼ぶ。updateSession は NextResponse.next を
  // 内部で生成するが、その時点で modified request headers が伝播する。
  request.headers.set("x-pathname", request.nextUrl.pathname);
  const response = await updateSession(request);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    // 静的アセット / PWA manifest / ファビコン / OAuth callback / public build stamp は middleware を素通りさせる。
    // manifest.json を除外しないと auth redirect で 307 となり PWA installable が壊れる。
    "/((?!_next/static|_next/image|favicon.ico|icon\\.png|apple-icon\\.png|manifest\\.json|manifest\\.webmanifest|auth/callback|api/build-info|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
