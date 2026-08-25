import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { getModelMarkdownSource } from "@/app/(app)/model/model-data";
import { headingAnchorId } from "@/lib/heading-anchor";

export const runtime = "nodejs";

/**
 * モデルページの節の一覧。左ナビの「モデル」にマウスを載せたときに出す。
 *
 * まさ 2026-08-25「左ナビの『モデル』にマウスオーバーしたら、セクションリストが出てくるように
 * してほしい。『ホーム』にマウスオーバーしたときにPJリストが出るみたいに」。
 *
 * **参照系データ**（正本 md の見出しは deploy 単位でしか変わらない）。
 * `pwa/spec/5-10-reference-data-caching-current-spec.md` の規律に従い、
 * サーバのプロセス内キャッシュと Cache-Control を通す。クライアント側は
 * `loadReferenceData` のモジュールキャッシュで受ける。
 */

export interface ModelSection {
  /** 見出しのアンカー id（`/model#<id>` へ飛ぶ） */
  id: string;
  /** 「5. BZM 3.0 — モデルの定義」のような見出しの文字列 */
  label: string;
}

const HEADING_ID_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/;

let cached: { sections: ModelSection[] } | null = null;

function buildSections(): ModelSection[] {
  const source = getModelMarkdownSource("MODEL_VERSION_LEDGER");
  if (!source) return [];

  const out: ModelSection[] = [];
  for (const line of source.split("\n")) {
    if (!line.startsWith("## ")) continue;
    const raw = line.slice(3);
    const m = HEADING_ID_RE.exec(raw);
    const label = raw.replace(HEADING_ID_RE, "").trim();
    if (!label) continue;
    out.push({ id: m ? m[1] : headingAnchorId(label), label });
  }
  return out;
}

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  if (!cached) cached = { sections: buildSections() };

  return NextResponse.json(
    { ok: true, sections: cached.sections },
    {
      headers: {
        // 正本 md は deploy でしか変わらないので、ブラウザ側でも短時間は使い回してよい。
        "Cache-Control": "private, max-age=300",
      },
    },
  );
}
