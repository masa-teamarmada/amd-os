import { NextResponse } from "next/server";
import { getPublicBuildInfo } from "@/lib/build-info";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getPublicBuildInfo(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
