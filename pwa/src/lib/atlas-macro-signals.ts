/**
 * Atlas → AMD Score の Triple Helix 軸 (μ_I / μ_G) 根拠フェッチャー。
 *
 * atlas_signals の domain は "A.地政学・マクロ経済" 〜 "O.サーキュラーエコノミー" の 15 種。
 * これを Triple Helix の μ_I (産業) / μ_G (政府) に分類:
 *   - μ_G: A.地政学・マクロ経済 / B.規制・政策   (政府関与の分類)
 *   - μ_I: C.素材・原料 / D.エネルギー / E.製造・プロセス技術 / F.バイオ・医療 /
 *           G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 /
 *           K.食・農・水産 / N.海洋・水資源 / O.サーキュラーエコノミー
 *           (産業の動き全般)
 *   - μ_A (学術) は atlas_signals に専用 domain なし — 次セッションで論文 DB を別途構築予定
 *
 * status='accepted' のシグナルだけを引っ張る (rejected は無視)。
 *
 * 注: 現状は PJ の lane に依存しない「全 PJ 横断のマクロ観察」。lane 個別に絞るには
 *      atlas_signals.suggested_tags との突合が必要 (Phase 2)。
 */

import { createClient } from "@/lib/supabase/server";

export interface AtlasSignalShort {
  title: string;
  domain: string | null;
  source_url: string | null;
  submitted_at: string | null;
}

export interface AtlasMacroSignals {
  mu_i: AtlasSignalShort[];
  mu_g: AtlasSignalShort[];
}

/** μ_G に分類する domain の先頭文字 */
const MU_G_PREFIXES = ["A.", "B."];
/** μ_I に分類する domain の先頭文字 (上記 μ_G 以外の産業全般) */
const MU_I_PREFIXES = ["C.", "D.", "E.", "F.", "G.", "H.", "I.", "J.", "K.", "N.", "O."];

const SELECT = "title, domain, source_url, submitted_at";

/** 最新 atlas_signals (status='accepted') を μ_I / μ_G で分類して返す。 */
export async function fetchAtlasMacroSignals(limit = 5): Promise<AtlasMacroSignals> {
  const supabase = await createClient();

  // OR フィルタで A./B. の domain を取得 (PostgREST の `domain=ilike.A.%` で)
  const muG = await Promise.all(
    MU_G_PREFIXES.map((p) =>
      supabase
        .from("atlas_signals")
        .select(SELECT)
        .ilike("domain", `${p}%`)
        .eq("status", "accepted")
        .order("submitted_at", { ascending: false })
        .limit(limit)
    )
  );
  const muI = await Promise.all(
    MU_I_PREFIXES.map((p) =>
      supabase
        .from("atlas_signals")
        .select(SELECT)
        .ilike("domain", `${p}%`)
        .eq("status", "accepted")
        .order("submitted_at", { ascending: false })
        .limit(2)
    )
  );

  const flatten = (results: { data: unknown }[]): AtlasSignalShort[] => {
    const all: AtlasSignalShort[] = [];
    for (const r of results) {
      const rows = (r.data ?? []) as AtlasSignalShort[];
      all.push(...rows);
    }
    // 最新順に sort、limit 件に絞る
    return all
      .filter((s) => s.title)
      .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
      .slice(0, limit);
  };

  return {
    mu_i: flatten(muI),
    mu_g: flatten(muG),
  };
}
