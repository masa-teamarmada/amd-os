import { NextRequest, NextResponse } from "next/server";
import { freeeApi } from "@/lib/freee-client";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type FreeePartnerApiRow = {
  id?: string | number | null;
  name?: string | null;
  long_name?: string | null;
  code?: string | null;
  shortcut1?: string | null;
  shortcut2?: string | null;
  kana?: string | null;
};

type FreeePartnersResponse = {
  partners?: FreeePartnerApiRow[];
};

type PartnerOption = {
  id: string;
  name: string;
  code: string | null;
  shortcut1: string | null;
  shortcut2: string | null;
  kana: string | null;
};

const PAGE_LIMIT = 100;
const MAX_PARTNERS = 1000;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s/g, "");
}

function toOption(row: FreeePartnerApiRow): PartnerOption | null {
  const id = row.id == null ? "" : String(row.id).trim();
  const name = text(row.name) || text(row.long_name);
  if (!id || !name) return null;
  return {
    id,
    name,
    code: text(row.code) || null,
    shortcut1: text(row.shortcut1) || null,
    shortcut2: text(row.shortcut2) || null,
    kana: text(row.kana) || null,
  };
}

function matches(option: PartnerOption, query: string) {
  if (!query) return true;
  const needle = normalize(query);
  const haystack = normalize([
    option.name,
    option.code,
    option.shortcut1,
    option.shortcut2,
    option.kana,
    option.id,
  ].filter(Boolean).join(" "));
  return haystack.includes(needle);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const query = (req.nextUrl.searchParams.get("query") || "").trim().slice(0, 80);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 50), 1), 100);
  const partners: PartnerOption[] = [];

  try {
    for (let offset = 0; offset < MAX_PARTNERS; offset += PAGE_LIMIT) {
      const data = await freeeApi("GET", `/api/1/partners?limit=${PAGE_LIMIT}&offset=${offset}`) as FreeePartnersResponse;
      const page = Array.isArray(data.partners) ? data.partners : [];
      for (const row of page) {
        const option = toOption(row);
        if (option) partners.push(option);
      }
      if (page.length < PAGE_LIMIT) break;
    }

    const deduped = Array.from(new Map(partners.map((partner) => [partner.id, partner])).values());
    const filtered = deduped
      .filter((partner) => matches(partner, query))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .slice(0, limit);

    return NextResponse.json({ ok: true, partners: filtered });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error), partners: [] },
      { status: 500 }
    );
  }
}
