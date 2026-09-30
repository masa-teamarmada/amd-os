"use client";

/**
 * CockpitGrants — PJ cockpit の「助成金・補助金」セクション。
 *
 * 各PJが今どの助成金/補助金/委託費 (NEDO/SBIR/JST/文科省/自治体 等) を受けているかを表示する
 * (まさ依頼 2026-06-17)。cap table と違い機密度が低く、ログイン済みメンバーに見せる。
 * AMD全体の累計獲得額はダッシュボード側 (営業アピール) に出す。
 * API: /api/grants (read=requireAuth, write=admin)。設計: pwa/design/governance_action_items.md
 *
 * 2026-09-17 (まさ「PDFも助成金リストとOSドライブの両方に置いておいてほしい」):
 * 各行に添付資料 (attachments_json) と備考 (notes) を出す。備考は1行目を常に見せ、2行目以降は「詳細」で開く。
 * 添付の実体は資料室 (workspace_documents) にあり、開き方は資料室と同じ /api/workspace-documents/[id]/open に任せる。
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type GrantAttachment = { document_id?: string | null; url?: string | null; name?: string | null };

type Grant = {
  id: string; grant_name: string; agency: string | null; grant_type: string | null;
  amount_yen: number | null; disbursed_yen: number | null; status: string;
  is_current: boolean | null; adopted_date: string | null; period_start_ym: string | null; period_end_ym: string | null; notes: string | null;
  attachments_json?: GrantAttachment[] | null;
};

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  applied:   { txt: "申請中",   cls: "border-border bg-muted/40 text-muted-foreground" },
  adopted:   { txt: "採択",     cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  active:    { txt: "受給中",   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  completed: { txt: "完了",     cls: "border-sky-200 bg-sky-50 text-sky-700" },
  rejected:  { txt: "不採択",   cls: "border-rose-200 bg-rose-50 text-rose-700" },
  withdrawn: { txt: "取下げ",   cls: "border-border bg-muted/40 text-muted-foreground" },
};

function yen(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}億円`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}万円`;
  return `${n.toLocaleString()}円`;
}

/** "202604" → { year: 2026, month: 4 }。それ以外の書き方は null (元の文字をそのまま出す)。 */
function parseYm(value: string | null) {
  const m = value?.trim().match(/^(\d{4})-?(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

/** 期間を「2026年4月〜2027年9月（18か月）」の形にする。月数は開始月と終了月の両方を含めて数える。 */
function periodLabel(start: string | null, end: string | null) {
  const s = parseYm(start);
  const e = parseYm(end);
  const text = (raw: string | null, ym: ReturnType<typeof parseYm>) => (ym ? `${ym.year}年${ym.month}月` : raw?.trim() || "");
  const range = [text(start, s), text(end, e)].filter(Boolean).join("〜");
  if (!range) return "";
  if (s && e) {
    const months = (e.year - s.year) * 12 + (e.month - s.month) + 1;
    if (months > 0) return `${range}（${months}か月）`;
  }
  if (end && !start) return `〜${range}`;
  if (start && !end) return `${range}〜`;
  return range;
}

/** 添付の開き先。資料室の資料は資料室と同じ経路で開く (PDFはそのまま表示、マークダウンは読む画面へ)。 */
function attachmentHref(a: GrantAttachment) {
  if (a.document_id) return `/api/workspace-documents/${encodeURIComponent(a.document_id)}/open?download=0`;
  if (a.url && /^https?:\/\//.test(a.url)) return a.url;
  return null;
}

function GrantNotes({ notes }: { notes: string }) {
  const lines = notes.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const [head, ...rest] = lines;
  return (
    <div className="basis-full text-[10px] leading-4 text-muted-foreground">
      <p>{head}</p>
      {rest.length > 0 && (
        <details className="mt-0.5">
          <summary className="w-fit cursor-pointer select-none text-[10px] text-foreground/70 hover:underline">詳細</summary>
          <div className="mt-1 space-y-1 rounded border border-border bg-muted/20 px-2 py-1.5">
            {rest.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </details>
      )}
    </div>
  );
}

export function CockpitGrants({ projectId }: { projectId: string }) {
  // 読み込んだ結果をPJと組で持ち、いま開いているPJの結果が届くまでを「読み込み中」とする
  // (effect の中で読み込み中フラグを立て直さない)。
  const [loaded, setLoaded] = useState<{ projectId: string; grants: Grant[] } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/grants?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setLoaded({ projectId, grants: j?.ok ? j.grants : [] }); })
      .catch(() => { if (live) setLoaded({ projectId, grants: [] }); });
    return () => { live = false; };
  }, [projectId]);

  if (projectId === "p00") return null;

  const current = loaded && loaded.projectId === projectId ? loaded : null;
  const loading = current === null;
  const list = current?.grants ?? [];
  // アピール対象 (採択/受給中/完了) の累計額をこのPJ分だけ出す
  const securedTotal = list
    .filter((g) => ["adopted", "active", "completed"].includes(g.status))
    .reduce((s, g) => s + (g.amount_yen || 0), 0);
  const isEmpty = !loading && list.length === 0;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">💰 助成金・補助金</h2>
        {securedTotal > 0 && (
          <span className="rounded border border-emerald-100 bg-emerald-50/70 px-2 py-0.5 text-[10px] text-emerald-800">
            獲得累計 <span className="font-semibold">{yen(securedTotal)}</span>
          </span>
        )}
        <Link
          href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`}
          className="ml-auto text-[10px] rounded px-1.5 py-0.5 border border-border bg-background text-muted-foreground hover:bg-muted hover:underline"
        >編集</Link>
      </div>

      {loading && <div className="px-3 py-3 text-[11px] text-muted-foreground">読み込み中…</div>}
      {isEmpty && (
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          助成金・補助金の記録なし。<Link href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`} className="underline">編集から追加</Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <div className="divide-y divide-border text-[11px]">
          {list.map((g) => {
            const st = STATUS_LABEL[g.status] || { txt: g.status, cls: "border-border bg-muted/40 text-muted-foreground" };
            const period = periodLabel(g.period_start_ym, g.period_end_ym);
            const attachments = (Array.isArray(g.attachments_json) ? g.attachments_json : [])
              .map((a) => ({ name: a?.name?.trim() || "添付資料", href: a ? attachmentHref(a) : null }))
              .filter((a): a is { name: string; href: string } => Boolean(a.href));
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${st.cls}`}>{st.txt}</span>
                <span className="font-medium">{g.grant_name}</span>
                {g.agency && <span className="text-muted-foreground">{g.agency}</span>}
                {g.grant_type && <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{g.grant_type}</span>}
                {g.amount_yen != null && <span className="tabular-nums">{yen(g.amount_yen)}</span>}
                {period && <span className="text-[10px] text-muted-foreground">{period}</span>}
                {g.adopted_date && <span className="text-[10px] text-muted-foreground">採択 {g.adopted_date}</span>}
                {attachments.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {attachments.map((a, i) => (
                      <a
                        key={`${a.href}-${i}`}
                        href={a.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800 hover:underline"
                      >📎 {a.name}</a>
                    ))}
                  </span>
                )}
                {g.notes && <GrantNotes notes={g.notes} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
