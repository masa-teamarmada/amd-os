"use client";

/**
 * CockpitGovernance — PJ cockpit col2 の「株主・ガバナンス」セクション。
 *
 * 起点: JOYCLE(p09) 臨時株主総会 招集通知が OS に抽出されていなかった事故 (2026-06-15)。
 * 終了PJでも株主・総会・決議・AMD保有株式/バリュエーション・要対応を表示する
 * (L2_DATA.md「ended でも清算・株主総会等は残す」の実装)。
 *
 * cap table / valuation は最機密 → admin 限定 API (/api/governance) から client fetch。
 * 設計: pwa/design/governance_action_items.md
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Shareholder = {
  id: string; holder_type: string | null; holder_name: string; share_class: string | null;
  shares: number | null; ownership_pct: number | null; invested_yen: number | null; as_of_ym: string | null; notes: string | null;
};
type Round = {
  id: string; round_name: string | null; round_date: string | null; round_ym: string | null;
  post_money_yen: number | null; raised_yen: number | null; price_per_share_yen: number | null; lead_investor: string | null; notes: string | null;
};
type Meeting = {
  id: string; meeting_type: string | null; meeting_date: string | null; agenda_summary: string | null;
  resolutions_json: { title?: string; type?: string; result?: string }[] | null;
  amd_response: string | null; amd_response_at: string | null; location: string | null;
  attachments_json: { name?: string; url?: string }[] | null; source_ref: string | null; notes: string | null;
};
type ActionItem = {
  action_id: string; title: string; summary: string | null; due_at: string | null;
  status: string; priority: string | null; action_url: string | null; category: string | null;
};

const MEETING_LABEL: Record<string, string> = {
  agm: "定時株主総会",
  egm: "臨時株主総会",
  board: "取締役会",
  board_written: "取締役会(書面決議)",
  board_written_resolution: "取締役会(書面決議)",
  shareholder_written: "株主総会(書面決議)",
  shareholder_written_resolution: "株主総会(書面決議)",
};
const HOLDER_LABEL: Record<string, string> = { amd: "AMD", masa: "まさ", founder: "創業者", vc: "VC", angel: "エンジェル", employee: "従業員", other: "その他" };
const RESP_LABEL: Record<string, string> = { proxy: "委任状提出", attended: "出席", consented: "事前承諾", abstained: "棄権", none: "未対応" };

function yen(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}億円`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}万円`;
  return `${n.toLocaleString()}円`;
}
function dueChip(due: string | null, status: string) {
  if (status === "responded" || status === "done") return { txt: "対応済", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (!due) return { txt: "期日なし", cls: "border-border bg-muted/40 text-muted-foreground" };
  const days = Math.floor((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { txt: `期限超過 ${-days}日`, cls: "border-rose-200 bg-rose-50 text-rose-700" };
  if (days <= 3) return { txt: `あと${days}日`, cls: "border-rose-200 bg-rose-50 text-rose-700" };
  if (days <= 7) return { txt: `あと${days}日`, cls: "border-amber-200 bg-amber-50 text-amber-800" };
  return { txt: `あと${days}日`, cls: "border-border bg-muted/40 text-muted-foreground" };
}

function meetingLabel(meeting: Meeting) {
  const raw = meeting.meeting_type || "";
  const location = meeting.location || "";
  if (raw === "board" && /書面|written/i.test(location)) return "取締役会(書面決議)";
  return MEETING_LABEL[raw] || raw || "議事体";
}

function compactSource(value: string | null) {
  if (!value) return "";
  if (value.length <= 36) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export function CockpitGovernance({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ shareholders: Shareholder[]; rounds: Round[]; meetings: Meeting[]; actionItems: ActionItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      setLoading(true);
      fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`)
        .then(async (r) => {
          if (r.status === 403 || r.status === 401) { setForbidden(true); return null; }
          return r.json();
        })
        .then((j) => { if (live && j?.ok) setData(j); })
        .catch(() => {})
        .finally(() => { if (live) setLoading(false); });
    });
    return () => { live = false; };
  }, [projectId]);

  if (forbidden) return null; // 非admin には出さない
  if (p00Skip(projectId)) return null;

  const sh = data?.shareholders ?? [];
  const rounds = data?.rounds ?? [];
  const meetings = data?.meetings ?? [];
  const actions = data?.actionItems ?? [];
  const isEmpty = !loading && sh.length === 0 && rounds.length === 0 && meetings.length === 0 && actions.length === 0;

  const latestRound = rounds.find((r) => r.price_per_share_yen != null || r.post_money_yen != null) ?? rounds[0];
  const amdHoldings = sh.filter((s) => s.holder_type === "amd" || s.holder_type === "masa");
  // 保有価値の概算: 保有株数 × 直近単価、無ければ 持株比率 × post money
  const holdingValue = amdHoldings.reduce((sum, s) => {
    if (s.shares != null && latestRound?.price_per_share_yen != null) return sum + s.shares * Number(latestRound.price_per_share_yen);
    if (s.ownership_pct != null && latestRound?.post_money_yen != null) return sum + (s.ownership_pct / 100) * latestRound.post_money_yen;
    return sum;
  }, 0);

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">🏛 株主・ガバナンス</h2>
        <Link
          href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`}
          className="ml-auto text-[10px] rounded px-1.5 py-0.5 border border-border bg-background text-muted-foreground hover:bg-muted hover:underline"
        >編集</Link>
      </div>

      {loading && <div className="px-3 py-3 text-[11px] text-muted-foreground">読み込み中…</div>}
      {isEmpty && (
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          株主・総会・保有株式の記録なし。<Link href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`} className="underline">編集から追加</Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <div className="divide-y divide-border text-[11px]">
          {/* AMD/まさ 保有 + 概算価値 */}
          {amdHoldings.length > 0 && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold text-muted-foreground">AMD/まさ 保有株式</div>
              {amdHoldings.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium">{HOLDER_LABEL[s.holder_type || "other"] || s.holder_type}</span>
                  <span>{s.share_class || "種類未記録"}</span>
                  <span>{s.shares != null ? `${s.shares.toLocaleString()}株` : "株数未記録"}</span>
                  {s.ownership_pct != null && <span>{s.ownership_pct}%</span>}
                </div>
              ))}
              <div className="mt-1 inline-flex items-center gap-1 rounded border border-sky-100 bg-sky-50/70 px-2 py-0.5 text-sky-800">
                概算保有価値: <span className="font-semibold">{holdingValue > 0 ? yen(holdingValue) : "算定に株数/バリュエーション要記録"}</span>
              </div>
            </div>
          )}

          {/* 総会/取締役会履歴 + 決議 + AMD対応 */}
          {meetings.length > 0 && (
            <div className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold text-muted-foreground">総会・取締役会履歴</div>
                <div className="text-[10px] text-muted-foreground">{meetings.length}件</div>
              </div>
              <div className="space-y-1.5">
                {meetings.slice(0, 8).map((meeting) => (
                  <div key={meeting.id} className="border-l border-border pl-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium tabular-nums">{meeting.meeting_date || "日付未記録"}</span>
                      <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">{meetingLabel(meeting)}</span>
                      {meeting.amd_response && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                          AMD: {RESP_LABEL[meeting.amd_response] || meeting.amd_response}
                        </span>
                      )}
                      {meeting.source_ref && (
                        <span className="text-[10px] text-muted-foreground">src {compactSource(meeting.source_ref)}</span>
                      )}
                    </div>
                    {meeting.agenda_summary && <p className="mt-0.5 leading-relaxed text-muted-foreground">{meeting.agenda_summary}</p>}
                    {Array.isArray(meeting.resolutions_json) && meeting.resolutions_json.length > 0 && (
                      <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
                        {meeting.resolutions_json.slice(0, 4).map((r, i) => (
                          <li key={i}>{r.title}{r.result && r.result !== "unknown" ? `（${r.result}）` : ""}</li>
                        ))}
                      </ul>
                    )}
                    {Array.isArray(meeting.attachments_json) && meeting.attachments_json.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {meeting.attachments_json.slice(0, 4).map((a, i) => (
                          a.url ? (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                              className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:underline">
                              資料: {a.name || `${i + 1}`}
                            </a>
                          ) : (
                            <span key={i} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">資料: {a.name || `${i + 1}`}</span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {meetings.length > 8 && <div className="mt-1 text-[10px] text-muted-foreground">他 {meetings.length - 8} 件</div>}
            </div>
          )}

          {/* 資金調達ラウンド / バリュエーション */}
          {rounds.length > 0 && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold text-muted-foreground">資金調達ラウンド</div>
              <div className="space-y-0.5">
                {rounds.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{r.round_name || "ラウンド"}</span>
                    {r.round_date && <span className="text-muted-foreground">{r.round_date}</span>}
                    <span className="text-muted-foreground">調達 {yen(r.raised_yen)}</span>
                    {r.post_money_yen != null && <span className="text-muted-foreground">post {yen(r.post_money_yen)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* キャップテーブル (AMD/まさ以外も含む全株主) */}
          {sh.length > 0 && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold text-muted-foreground">株主構成</div>
              <div className="space-y-0.5">
                {sh.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="rounded border border-border bg-muted/40 px-1 py-0 text-[9px]">{HOLDER_LABEL[s.holder_type || "other"] || s.holder_type}</span>
                    <span className="font-medium">{s.holder_name}</span>
                    {s.share_class && <span className="text-muted-foreground">{s.share_class}</span>}
                    {s.ownership_pct != null && <span className="text-muted-foreground">{s.ownership_pct}%</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* このPJの要対応 (期日順) */}
          {actions.length > 0 && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold text-muted-foreground">要対応</div>
              <div className="space-y-1">
                {actions.map((a) => {
                  const chip = dueChip(a.due_at, a.status);
                  return (
                    <div key={a.action_id} className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${chip.cls}`}>{chip.txt}</span>
                      {a.action_url ? (
                        <a href={a.action_url} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-dotted">{a.title}</a>
                      ) : (
                        <span className="font-medium">{a.title}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function p00Skip(projectId: string) {
  return projectId === "p00";
}
