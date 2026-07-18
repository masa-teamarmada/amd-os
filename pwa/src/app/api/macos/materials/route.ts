import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import {
  ELEMENTS,
  MATERIALS,
  MINERALS,
  POLYMERS,
} from "@/lib/materials-data";

/**
 * Native client bridge for the Materials knowledge map.
 * The data remains owned by materials-data.ts; this route only applies the
 * existing member boundary and serializes the same source for SwiftUI.
 */
export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  return NextResponse.json({
    ok: true,
    elements: ELEMENTS,
    minerals: MINERALS,
    polymers: POLYMERS,
    materials: MATERIALS,
  });
}
