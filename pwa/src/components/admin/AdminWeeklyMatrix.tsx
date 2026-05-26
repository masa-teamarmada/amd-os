"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LinkedMemberText } from "@/components/members/LinkedMemberText";

interface MemberOut {
  memberId: string;
  codeName: string;
}

interface ProjectOut {
  projectId: string;
  projectName: string;
}

interface ActivityOut {
  id: string;
  memberId: string;
  projectId: string;
  source: string;
  sourceKind: string;
  sourceUrl: string | null;
  title: string;
  contentPreview: string;
  itemDate: string | null;
}

interface ApiResp {
  ok: boolean;
  weekStart: string;
  weekEnd: string;
  members: MemberOut[];
  projects: ProjectOut[];
  activities: ActivityOut[];
  error?: string;
}

const MAX_WEEKS_BACK = 26;

function currentMondayKey(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const daysFromMonday = (jst.getUTCDay() + 6) % 7;
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  startJst.setUTCDate(startJst.getUTCDate() - daysFromMonday);
  return `${startJst.getUTCFullYear()}-${String(startJst.getUTCMonth() + 1).padStart(2, "0")}-${String(startJst.getUTCDate()).padStart(2, "0")}`;
}

function shiftMonday(key: string, weeks: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weeksDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((bMs - aMs) / (7 * 86400000));
}

function formatDateJa(key: string | null | undefined): string {
  if (!key) return "";
  const k = key.length >= 10 ? key.slice(0, 10) : key;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) {
    const d = new Date(key);
    if (Number.isNaN(d.getTime())) return key;
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} (${weekdays[jst.getUTCDay()]})`;
  }
  const [y, m, d] = k.split("-").map(Number);
  const jst = new Date(Date.UTC(y, m - 1, d));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${m}/${d} (${weekdays[jst.getUTCDay()]})`;
}

function sourceKindLabel(source: string | null | undefined): string {
  if (source === "gmail") return "Gmail";
  if (source === "calendar") return "Calendar";
  if (source === "gmail_message") return "Gmail";
  if (source === "gmeet") return "Calendar";
  if (source === "meeting_summary") return "議事録";
  return source || "source";
}

export function AdminWeeklyMatrix() {
  const todayMonday = useMemo(() => currentMondayKey(), []);
  const [weekStart, setWeekStart] = useState<string>(todayMonday);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offset = weeksDiff(weekStart, todayMonday); // 何週前か (今週=0)
  const canGoBack = offset < MAX_WEEKS_BACK;
  const canGoForward = offset > 0;

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/weekly?weekStart=${target}`);
      const payload = (await res.json().catch(() => ({}))) as ApiResp;
      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error || `読み込み失敗 (${res.status})`);
      }
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  // (memberId, projectId) → activities[] グルーピング
  const cellMap = useMemo(() => {
    const map = new Map<string, ActivityOut[]>();
    if (!data) return map;
    for (const a of data.activities) {
      const key = `${a.memberId}::${a.projectId}`;
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [data]);

  const memberTotals = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const a of data.activities) m.set(a.memberId, (m.get(a.memberId) || 0) + 1);
    return m;
  }, [data]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">週次活動</h1>
          <p className="mt-1 text-[12px] text-[#86868b]">
            各メンバーが Gmail / Calendar / 議事録から抽出された「今週やったこと」を PJ × メンバーで一覧する。マイページに表示される内容を全メンバー分集約した admin ビュー。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(shiftMonday(weekStart, -1))}
            disabled={!canGoBack || loading}
            className="rounded-md border border-[#d2d2d7] bg-white px-3 py-1.5 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
          >
            ◀ 前週
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(todayMonday)}
            disabled={offset === 0 || loading}
            className="rounded-md border border-[#007aff]/40 bg-[#007aff]/10 px-3 py-1.5 text-[12px] font-semibold text-[#007aff] hover:bg-[#007aff]/20 disabled:opacity-40"
          >
            今週
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(shiftMonday(weekStart, 1))}
            disabled={!canGoForward || loading}
            className="rounded-md border border-[#d2d2d7] bg-white px-3 py-1.5 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
          >
            次週 ▶
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#3c3c43]">
        <span className="font-semibold text-[#1d1d1f]">
          {data ? `${formatDateJa(data.weekStart)} 〜 ${formatDateJa(data.weekEnd)}` : formatDateJa(weekStart)}
        </span>
        {offset > 0 && <span className="text-[#86868b]">（{offset} 週前）</span>}
        {data && (
          <>
            <span>活動 {data.activities.length} 件</span>
            <span>PJ {data.projects.length}</span>
            <span>メンバー {data.members.filter((m) => (memberTotals.get(m.memberId) || 0) > 0).length} / {data.members.length}</span>
          </>
        )}
        {loading && <span className="text-[#007aff]">読み込み中…</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      )}

      {data && data.projects.length === 0 && !loading && (
        <div className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-6 text-center text-[13px] text-[#86868b]">
          この週は member_weekly 活動データがありません。週次抽出 cron が走ると蓄積されます。
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="overflow-auto rounded-xl border border-[#e5e5e7] bg-white shadow-sm">
          <table className="min-w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f5f5f7]">
                <th className="sticky left-0 z-20 border-b border-r border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2 text-left font-semibold text-[#1d1d1f]">
                  メンバー
                </th>
                {data.projects.map((p) => (
                  <th
                    key={p.projectId}
                    className="border-b border-r border-[#e5e5e7] px-3 py-2 text-left font-semibold text-[#1d1d1f] whitespace-nowrap"
                    title={p.projectId}
                  >
                    <div className="max-w-[180px] truncate">{p.projectName}</div>
                    <div className="text-[10px] font-normal text-[#86868b]">{p.projectId}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => {
                const total = memberTotals.get(m.memberId) || 0;
                return (
                  <tr key={m.memberId} className="align-top">
                    <th
                      className="sticky left-0 z-10 border-b border-r border-[#e5e5e7] bg-white px-3 py-2 text-left font-semibold text-[#1d1d1f] whitespace-nowrap"
                    >
                      <a
                        href={`/mypage?memberId=${m.memberId}`}
                        className="text-[#007aff] hover:underline"
                      >
                        {m.codeName}
                      </a>
                      <div className="text-[10px] font-normal text-[#86868b]">
                        {total > 0 ? `${total} 件` : "—"}
                      </div>
                    </th>
                    {data.projects.map((p) => {
                      const list = cellMap.get(`${m.memberId}::${p.projectId}`) || [];
                      return (
                        <td
                          key={p.projectId}
                          className="border-b border-r border-[#e5e5e7] px-2 py-2 align-top"
                        >
                          {list.length === 0 ? (
                            <span className="text-[#d2d2d7]">·</span>
                          ) : (
                            <div className="space-y-1.5 min-w-[200px]">
                              {list.slice(0, 3).map((a) => (
                                <div
                                  key={a.id}
                                  className="rounded-md border border-[#e5e5e7] bg-[#fbfbfd] px-2 py-1.5"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-semibold text-[#007aff] bg-[#007aff]/10 rounded-full px-1.5 py-0.5">
                                      {sourceKindLabel(a.sourceKind || a.source)}
                                    </span>
                                    {a.itemDate && (
                                      <span className="ml-auto text-[10px] text-[#86868b]">
                                        {formatDateJa(a.itemDate)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug text-[#1d1d1f] line-clamp-2">
                                    {a.sourceUrl ? (
                                      <a
                                        href={a.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                      >
                                        <LinkedMemberText text={a.title} />
                                      </a>
                                    ) : (
                                      <LinkedMemberText text={a.title} />
                                    )}
                                  </p>
                                  {a.contentPreview && (
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-[#3c3c43] line-clamp-2">
                                      <LinkedMemberText text={a.contentPreview} />
                                    </p>
                                  )}
                                </div>
                              ))}
                              {list.length > 3 && (
                                <p className="text-[10px] text-[#86868b] px-1">
                                  ほか {list.length - 3} 件
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
