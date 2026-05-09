/**
 * Atlas → AMD Score の Triple Helix 軸 (μ_I / μ_G) 根拠フェッチャー (legacy fallback 用)。
 *
 * **重要**: AmdScoreView の M カード新設計 (TripleHelixMatrix) では、
 * `triple-helix-observations.ts` の `fetchTripleHelixComputed()` が
 * 観測モデル C 行列に従って P/R/N 等を直接 fetch する。
 *
 * このファイルは現状 Cockpit モーダル等の legacy 経路向けに残してある。
 * 新規実装は triple-helix-observations.ts を使うこと。
 *
 * atlas_signals の domain 分類:
 *   - μ_G: A.地政学・マクロ経済 / B.規制・政策   (政府関与の分類)
 *   - μ_I: C.素材・原料 / D.エネルギー / E.製造・プロセス技術 / F.バイオ・医療 /
 *           G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 /
 *           K.食・農・水産 / N.海洋・水資源 / O.サーキュラーエコノミー
 *   - μ_A は scholar テーブル (廃止済) ではなく papers_log (lane × quarter) で扱う
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
