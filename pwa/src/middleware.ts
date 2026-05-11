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
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
