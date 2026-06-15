import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "Admin Coverage Scanner (不在検知) - AMD OS" } };

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /admin/coverage-gaps — OS Coverage Scanner (不在検知 / negative space) の gap 一覧 + 再現性指標。
 *
 * 「重要そうなのにOSのどのL2にも構造化されていない」候補 (= 不在検知) を貯める l2_coverage_gaps の
 * 棚卸し画面。採否は /notifications で行う (はい=confirmed / いいえ=rejected)。ここは読み取り + 指標。
 * 設計: pwa/design/coverage_gap_scanner.md
 * admin gate は (app)/admin/layout.tsx + RLS (is_admin) で担保。
 */

type GapRow = {
  gap_id: string;
  source: string | null;
  source_ref: string | null;
  title: string | null;
  summary: string | null;
  salience_score: number | null;
  proposed_target_l2: string | null;
  gap_class: string | null;
  project_id: string | null;
  scope: string | null;
  due_at: string | null;
  review_status: string | null;
  routed_to: string | null;
  detected_at: string | null;
};

const GAP_CLASS_LABEL: Record<string, string> = {
  extractor_miss: "抽出器の取りこぼし",
  structural_gap: "構造的GAP (受け皿なし)",
  uncertain: "分類先未確定",
};

function fmt(dt: string | null): string {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dt;
  }
}

export default async function AdminCoverageGapsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("l2_coverage_gaps")
    .select("gap_id, source, source_ref, title, summary, salience_score, proposed_target_l2, gap_class, project_id, scope, due_at, review_status, routed_to, detected_at")
    .order("review_status")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("detected_at", { ascending: false })
    .limit(500);

  const rows: GapRow[] = (data ?? []) as GapRow[];

  // 再現性指標 (設計 §8)
  const total = rows.length;
  const candidates = rows.filter((r) => r.review_status === "candidate");
  const confirmed = rows.filter((r) => r.review_status === "confirmed");
  const rejected = rows.filter((r) => r.review_status === "rejected");
  const reviewed = confirmed.length + rejected.length;
  const precision = reviewed > 0 ? Math.round((confirmed.length / reviewed) * 100) : null;
  const structural = rows.filter((r) => r.gap_class === "structural_gap" && r.review_status !== "rejected");
  const extractorMiss = confirmed.filter((r) => r.gap_class === "extractor_miss");
  const extractorMissRate = confirmed.length > 0 ? Math.round((extractorMiss.length / confirmed.length) * 100) : null;
  const dueSoon = candidates.filter((r) => r.due_at && new Date(r.due_at).getTime() - Date.now() < 7 * 86400000);

  const metrics: { label: string; value: string; hint: string }[] = [
    { label: "未レビュー候補", value: String(candidates.length), hint: "/notifications で はい/いいえ 待ち" },
    { label: "Scanner precision", value: precision != null ? `${precision}%` : "—", hint: "confirmed / (confirmed+rejected)。noise を抑えつつ高く" },
    { label: "Extractor-miss率", value: extractorMissRate != null ? `${extractorMissRate}%` : "—", hint: "confirmed のうち既存L2が拾えたはず。下がるほど抽出器が育っている" },
    { label: "構造的GAP", value: String(structural.length), hint: "OSに新しい受け皿が要るかも (設計バックログ)" },
    { label: "期日7日以内", value: String(dueSoon.length), hint: "埋もれさせない。due 前に手当て" },
  ];

  return (
    <div className="container mx-auto max-w-6xl">
      <h1 className="text-lg font-semibold mb-1">🛰 Coverage Scanner (不在検知 / negative space)</h1>
      <p className="text-xs text-muted-foreground mb-4">
        「重要そうなのにOSのどのL2にも構造化されていない」候補を、5生データ × 既存L2カバレッジ の差分で検知したもの。
        採否は <a className="text-blue-600 hover:underline" href="/notifications">/notifications</a> で。設計は
        <code className="text-xs bg-muted px-1 rounded ml-1">pwa/design/coverage_gap_scanner.md</code>。
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">{m.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{m.hint}</div>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          まだ gap はありません。daily routine の Phase M (Coverage Scanner) が走ると、ここに「未OS化の候補」が並びます。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">判定</th>
                <th className="px-3 py-2 font-medium">件名</th>
                <th className="px-3 py-2 font-medium">入れ先候補</th>
                <th className="px-3 py-2 font-medium">PJ</th>
                <th className="px-3 py-2 font-medium">source</th>
                <th className="px-3 py-2 font-medium">期日</th>
                <th className="px-3 py-2 font-medium">salience</th>
                <th className="px-3 py-2 font-medium">検知</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gap_id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={
                      r.review_status === "confirmed" ? "text-green-600"
                        : r.review_status === "rejected" ? "text-muted-foreground line-through"
                        : "text-amber-600 font-medium"
                    }>
                      {r.review_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{GAP_CLASS_LABEL[r.gap_class ?? ""] ?? r.gap_class}</td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <div className="font-medium">{r.title ?? "(no title)"}</div>
                    {r.summary ? <div className="text-muted-foreground line-clamp-2">{r.summary}</div> : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.proposed_target_l2 ?? "未確定"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.project_id ?? r.scope ?? ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.source}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(r.due_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.salience_score != null ? Number(r.salience_score).toFixed(2) : ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmt(r.detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
