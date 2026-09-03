import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "議事録の抜け - AMD OS" } };

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /admin/meeting-gaps — 議事録が作られなかった会議の一覧。
 *
 * H-1 は「終了60-180分後」の窓でしか開催済み議事録を作らない。窓の中で実行が
 * 走らなかった会議はこれまで誰にも見えないまま消えていた。台帳
 * `meeting_minutes_backfill_ledger` に残った欠損を、ここでまさが見られるようにする。
 * 設計: pwa/spec/3-3-meeting-flow-current-spec.md
 * admin gate は (app)/admin/layout.tsx + RLS (is_admin) で担保。
 */

type LedgerRow = {
  calendar_event_id: string;
  project_id: string | null;
  title: string;
  meeting_start_at: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  first_detected_at: string | null;
  last_attempt_at: string | null;
  last_outcome: string | null;
  last_error: string | null;
  notes: string | null;
};

type AssetGapRow = {
  meeting_id: string;
  project_id: string;
  title: string;
  meeting_date: string;
};

const STATUS_LABEL: Record<string, { label: string; hint: string; tone: string }> = {
  pending: { label: "再試行中", hint: "毎時の定期確認が拾い直している", tone: "text-amber-600 font-medium" },
  abandoned: { label: "諦めた", hint: "上限まで試して取れなかった。手当てが要る", tone: "text-red-600 font-semibold" },
  no_material: { label: "元データなし", hint: "議事録の材料が残っていないと確認済み", tone: "text-muted-foreground" },
  ignored: { label: "対象外", hint: "議事録を作らないと判断した会議", tone: "text-muted-foreground line-through" },
  recovered: { label: "埋まった", hint: "確定版の議事録ができた", tone: "text-green-600" },
};

const OUTCOME_LABEL: Record<string, string> = {
  still_missing_after_attempt: "拾い直したが取れなかった",
  give_up_after_max_attempts: "上限まで試して打ち切り",
  confirmed_row_present: "議事録を確認",
  backfilled_via_api: "後から埋めた",
};

function fmtDateTime(dt: string | null): string {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

function daysAgo(dt: string): number | null {
  const time = Date.parse(dt);
  if (!Number.isFinite(time)) return null;
  return Math.floor((Date.now() - time) / 86400000);
}

export default async function AdminMeetingGapsPage() {
  const supabase = await createClient();

  const [{ data: ledgerData }, { data: assetGapData }] = await Promise.all([
    supabase
      .from("meeting_minutes_backfill_ledger")
      .select("calendar_event_id, project_id, title, meeting_start_at, status, attempt_count, max_attempts, first_detected_at, last_attempt_at, last_outcome, last_error, notes")
      .neq("status", "recovered")
      .order("meeting_start_at", { ascending: false })
      .limit(500),
    // Driveに資料があるのに添付が0件の開催済みMTG。
    // 「Driveにあること」と「OSに入っていること」は別 (仕様の禁止事項)。
    supabase
      .from("project_meeting_summaries")
      .select("meeting_id, project_id, title, meeting_date, source_kinds")
      .not("source_kinds", "is", null)
      .neq("source_kinds", "none")
      // まさえいMTG (dialogue) は資料が存在しない種類なので、添付の抜けとして数えない。
      .neq("source_kinds", "dialogue")
      .not("meeting_id", "like", "upcoming:%")
      .gte("meeting_date", new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10))
      .order("meeting_date", { ascending: false })
      .limit(500),
  ]);

  const rows: LedgerRow[] = (ledgerData ?? []) as LedgerRow[];

  // 添付0件の判定は meeting_assets 側を引いてから差集合を取る。
  const candidateIds = (assetGapData ?? []).map((r) => r.meeting_id as string);
  let assetGaps: AssetGapRow[] = [];
  if (candidateIds.length) {
    const { data: assetRows } = await supabase
      .from("meeting_assets")
      .select("meeting_id")
      .in("meeting_id", candidateIds);
    const withAssets = new Set((assetRows ?? []).map((r) => r.meeting_id as string));
    assetGaps = (assetGapData ?? [])
      .filter((r) => !withAssets.has(r.meeting_id as string))
      .map((r) => ({
        meeting_id: r.meeting_id as string,
        project_id: r.project_id as string,
        title: r.title as string,
        meeting_date: r.meeting_date as string,
      }));
  }

  const pending = rows.filter((r) => r.status === "pending");
  const abandoned = rows.filter((r) => r.status === "abandoned");
  const oldest = pending.reduce<number | null>((acc, r) => {
    const d = daysAgo(r.meeting_start_at);
    return d != null && (acc == null || d > acc) ? d : acc;
  }, null);

  const metrics: { label: string; value: string; hint: string; alert?: boolean }[] = [
    { label: "議事録がない会議", value: String(rows.length), hint: "予定はあるのに議事録が作られていない会議の総数" },
    { label: "拾い直し中", value: String(pending.length), hint: "毎時の定期確認が再試行している。放っておいてよい" },
    { label: "諦めた", value: String(abandoned.length), hint: "上限まで試して取れなかった。まさの手当てが要る", alert: abandoned.length > 0 },
    { label: "いちばん古い抜け", value: oldest != null ? `${oldest}日前` : "—", hint: "これより古い会議の議事録は残っていない" },
    { label: "添付が0件", value: String(assetGaps.length), hint: "Driveに資料があってもここに出ていなければ画面には出ない", alert: assetGaps.length > 0 },
  ];

  return (
    <div className="container mx-auto max-w-6xl">
      <h1 className="text-lg font-semibold mb-1">🗂 議事録の抜け</h1>
      <p className="text-xs text-muted-foreground mb-4">
        会議は終わったのに議事録が作られなかったものの一覧。定期確認は会議終了の1〜3時間後にしか議事録を作らないので、
        その時間帯に実行が走らないと抜ける。抜けた会議はこの台帳に残り、毎時の定期確認が拾い直す。
        <span className="text-red-600">諦めた</span>まで進んだものは自動では埋まらないので、
        <code className="text-xs bg-muted px-1 rounded mx-1">npm run meeting:backfill-minutes</code>
        で後から入れる。
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-lg border bg-card p-3 ${m.alert ? "border-red-300" : ""}`}>
            <div className="text-[11px] text-muted-foreground">{m.label}</div>
            <div className={`text-2xl font-semibold tabular-nums ${m.alert ? "text-red-600" : ""}`}>{m.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{m.hint}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          議事録の抜けはありません。終わった会議はすべて議事録になっています。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border mb-8">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">会議</th>
                <th className="px-3 py-2 font-medium">PJ</th>
                <th className="px-3 py-2 font-medium">開催</th>
                <th className="px-3 py-2 font-medium">拾い直し</th>
                <th className="px-3 py-2 font-medium">最後の結果</th>
                <th className="px-3 py-2 font-medium">気づいた日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_LABEL[r.status] ?? { label: r.status, hint: "", tone: "" };
                const elapsed = daysAgo(r.meeting_start_at);
                return (
                  <tr key={r.calendar_event_id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={status.tone}>{status.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{status.hint}</div>
                    </td>
                    <td className="px-3 py-2 max-w-[300px]">
                      <div className="font-medium">{r.title}</div>
                      {r.notes ? <div className="text-muted-foreground">{r.notes}</div> : null}
                      {r.last_error ? <div className="text-red-600 line-clamp-2">{r.last_error}</div> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.project_id ?? "未解決"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>{fmtDateTime(r.meeting_start_at)}</div>
                      {elapsed != null ? <div className="text-[10px] text-muted-foreground">{elapsed}日前</div> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {r.attempt_count} / {r.max_attempts} 回
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {OUTCOME_LABEL[r.last_outcome ?? ""] ?? r.last_outcome ?? "まだ試していない"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(r.first_detected_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-sm font-semibold mb-1">📎 添付が1件も無い開催済みMTG</h2>
      <p className="text-xs text-muted-foreground mb-3">
        議事録はあるのに、MTGカードに資料が1件も付いていないもの。ドライブに資料があっても、ここに行が無ければまさの画面には出ない。
        直近120日ぶん。
      </p>
      {assetGaps.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          添付の抜けはありません。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">開催日</th>
                <th className="px-3 py-2 font-medium">PJ</th>
                <th className="px-3 py-2 font-medium">会議</th>
              </tr>
            </thead>
            <tbody>
              {assetGaps.map((r) => (
                <tr key={r.meeting_id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{r.meeting_date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.project_id}</td>
                  <td className="px-3 py-2">{r.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
