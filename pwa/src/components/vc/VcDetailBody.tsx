"use client";

import Link from "next/link";
import {
  formatJpy,
  formatJpyRange,
  VC_TYPE_LABEL,
  FUND_STATUS_LABEL,
  PVR_STATUS_LABEL,
  DRY_POWDER_SOURCE_LABEL,
  VC_NEWS_KIND_LABEL,
} from "@/lib/vc-data";
import type { VcDetail } from "@/types/vc";

/**
 * VC 詳細の中身。/vcs/[id] ページと VC リストのモーダルから共通利用される。
 */
export function VcDetailBody({ data }: { data: VcDetail }) {
  const { vc, funds, investments, contacts, relations, news } = data;
  const stars = vc.amd_rating ? "★".repeat(vc.amd_rating) + "☆".repeat(5 - vc.amd_rating) : "☆☆☆☆☆";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 pr-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {vc.type && <span>{VC_TYPE_LABEL[vc.type] ?? vc.type}</span>}
            {vc.hq && <span>· {vc.hq}</span>}
          </div>
          <h2 className="text-xl font-semibold">
            {vc.name}
            {vc.name_en && <span className="ml-2 text-sm text-muted-foreground font-normal">{vc.name_en}</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`text-base ${vc.amd_rating ? "text-amber-500" : "text-muted-foreground"}`}
            title={vc.amd_rating_note ?? "未評価"}
          >
            {stars}
          </div>
          <Link
            href={`/vcs/${vc.id}/edit`}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === 左 2/3: 特性 + ファンド + PJ接点 + 担当者 === */}
        <div className="lg:col-span-2 space-y-4">
          <Pane title="特性 / Thesis">
            {vc.thesis && <p className="text-sm whitespace-pre-wrap mb-3">{vc.thesis}</p>}
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              {vc.stage_focus && vc.stage_focus.length > 0 && (
                <Row label="ステージ" value={vc.stage_focus.join(" / ")} />
              )}
              {(vc.ticket_min_jpy || vc.ticket_max_jpy) && (
                <Row label="ticket" value={formatJpyRange(vc.ticket_min_jpy, vc.ticket_max_jpy)} />
              )}
              {vc.website && (
                <Row
                  label="website"
                  value={
                    <a href={vc.website} target="_blank" rel="noreferrer" className="underline text-primary">
                      {vc.website.replace(/^https?:\/\//, "")}
                    </a>
                  }
                />
              )}
            </dl>
            {vc.amd_rating_note && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="text-[10px] text-muted-foreground mb-1">AMD 相性メモ</div>
                <p className="text-xs whitespace-pre-wrap">{vc.amd_rating_note}</p>
              </div>
            )}
            {vc.notes && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="text-[10px] text-muted-foreground mb-1">備考</div>
                <p className="text-xs whitespace-pre-wrap">{vc.notes}</p>
              </div>
            )}
          </Pane>

          <Pane title="ファンド履歴">
            {funds.length === 0 ? (
              <div className="text-xs text-muted-foreground">ファンド情報なし</div>
            ) : (
              <div className="space-y-2">
                {funds.map((f) => (
                  <div key={f.id} className="border border-border/60 rounded p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="font-medium text-sm">#{f.fund_no} ファンド</span>
                        {f.vintage_year && (
                          <span className="ml-2 text-xs text-muted-foreground">{f.vintage_year}</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          f.status === "raising"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : f.status === "investing" || f.status === "first_closed" || f.status === "final_closed"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {FUND_STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-y-0.5 text-[11px]">
                      <Row
                        label="size"
                        value={
                          f.size_jpy
                            ? formatJpy(f.size_jpy)
                            : formatJpyRange(f.size_jpy_low, f.size_jpy_high)
                        }
                      />
                      {f.first_close_at && <Row label="1st close" value={f.first_close_at} />}
                      {f.final_close_at && <Row label="final close" value={f.final_close_at} />}
                      {f.target_close_at && <Row label="target" value={f.target_close_at} />}
                    </dl>
                    {(f.dry_powder_jpy_low != null || f.dry_powder_jpy_high != null) && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-[11px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">DPE残:</span>
                          <span className="font-medium">
                            {formatJpyRange(f.dry_powder_jpy_low, f.dry_powder_jpy_high)}
                          </span>
                          {f.dry_powder_source && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded ${
                                f.dry_powder_source === "heard_from_contact"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : f.dry_powder_source === "public_disclosure"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {DRY_POWDER_SOURCE_LABEL[f.dry_powder_source] ?? f.dry_powder_source}
                            </span>
                          )}
                          {f.dry_powder_updated_at && (
                            <span className="text-muted-foreground text-[9px]">
                              {f.dry_powder_updated_at.slice(0, 10)} 時点
                            </span>
                          )}
                        </div>
                        {f.dry_powder_note && (
                          <p className="mt-1 text-muted-foreground">{f.dry_powder_note}</p>
                        )}
                      </div>
                    )}
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-2 text-[10px] underline text-muted-foreground hover:text-primary truncate"
                      >
                        {f.source_url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Pane>

          <Pane title={`自社 PJ 接点 (${relations.length})`}>
            {relations.length === 0 ? (
              <div className="text-xs text-muted-foreground">接点なし</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-1 pr-2">PJ</th>
                    <th className="py-1 pr-2">ステータス</th>
                    <th className="py-1 pr-2">AMD 担当</th>
                    <th className="py-1 pr-2">VC 担当</th>
                    <th className="py-1 pr-2">最終接触</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2">
                        {r.project_name ? (
                          <Link
                            href={`/project/${r.project_id}/cockpit`}
                            className="hover:underline text-primary"
                          >
                            {r.project_name}
                          </Link>
                        ) : (
                          r.project_id
                        )}
                      </td>
                      <td className="py-1.5 pr-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-1.5 pr-2">{r.amd_owner_code_name ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.contact_name ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.last_touch_at ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Pane>

          <Pane title={`担当者 (${contacts.length})`}>
            {contacts.length === 0 ? (
              <div className="text-xs text-muted-foreground">未登録</div>
            ) : (
              <ul className="text-xs space-y-1">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.role && <span className="text-muted-foreground">{c.role}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-primary underline">
                        {c.email}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Pane>
        </div>

        {/* === 右 1/3: ニュース + 出資先 === */}
        <div className="space-y-4">
          <Pane title={`ニュース (${news.length})`}>
            {news.length === 0 ? (
              <div className="text-xs text-muted-foreground">ニュースなし</div>
            ) : (
              <ul className="text-xs space-y-2">
                {news.slice(0, 30).map((n) => (
                  <li key={n.id} className="border-b border-border/30 pb-2 last:border-b-0">
                    <div className="flex items-start gap-2 mb-0.5">
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {VC_NEWS_KIND_LABEL[n.kind] ?? n.kind}
                      </span>
                      <span className="font-medium leading-tight">{n.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {n.occurred_on && <span>{n.occurred_on}</span>}
                      {!n.verified && <span className="text-emerald-600 dark:text-emerald-400">●未確認</span>}
                      {n.source_url && (
                        <a
                          href={n.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline truncate"
                        >
                          source
                        </a>
                      )}
                    </div>
                    {n.body && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-3">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Pane>

          <Pane title={`出資先 (${investments.length})`}>
            {investments.length === 0 ? (
              <div className="text-xs text-muted-foreground">未登録</div>
            ) : (
              <ul className="text-xs space-y-1">
                {investments.map((inv) => (
                  <li key={inv.id} className="flex items-start gap-2">
                    <span className="font-medium">{inv.target_company}</span>
                    {inv.is_lead && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        lead
                      </span>
                    )}
                    {inv.our_project_id && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary">
                        自社 PJ
                      </span>
                    )}
                    <span className="ml-auto text-muted-foreground text-[10px]">
                      {inv.round && <>{inv.round} </>}
                      {inv.amount_jpy ? formatJpy(inv.amount_jpy) : ""}
                      {inv.invested_at && <> · {inv.invested_at.slice(0, 7)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Pane>
        </div>
      </div>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    invested: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    term_sheet: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dd: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    evaluating: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    pitching: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    passed: "bg-muted text-muted-foreground",
    declined: "bg-muted text-muted-foreground",
    not_contacted: "bg-muted text-muted-foreground",
  };
  const cls = colorMap[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>
      {PVR_STATUS_LABEL[status] ?? status}
    </span>
  );
}
