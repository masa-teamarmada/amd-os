"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DD_CAPABILITY_LABEL,
  DD_GRANT_STATUS_LABEL,
  DD_ITEM_KIND_LABEL,
  DD_PACKAGE_STATUS_LABEL,
  DD_SECTIONS,
  normalizeDdUnverifiedNotes,
  type DdGrantStatus,
  type DdItemKind,
  type DdPackageStatus,
  type DdSectionKey,
} from "@/lib/dd-package-core";
import type { DdAdminItem, DdAdminState } from "@/lib/dd-package-server";
import type { DdSourceCandidate } from "@/lib/dd-sources";
import { formatDdDate } from "@/lib/dd-format";

// DDパッケージの管理（AMD admin 限定）。独立したDD領域の管理画面の中に出す。
// 読み取りは DdProjectTab（GET /api/admin/dd）が行い、この部品は操作（POST /api/admin/dd）だけを送る。送った直後に onChanged() で読み直す。
// 項目は「公開する／公開をやめる」の切り替えだけ。公開中の項目は、元データの最新がそのまま投資家に見える（固定した版は作らない）。
// 公開の切り替え・状態変更・付与の停止/失効は確認を挟む。投資家への招待メールは送らない（この画面にも送信機能は無い）。

type Props = { state: DdAdminState; candidates: DdSourceCandidate[]; onChanged: () => void };

const EVENT_LABEL: Record<string, string> = {
  dd_package_viewed: "トップを閲覧",
  dd_item_viewed: "項目を閲覧",
  dd_file_opened: "資料を表示",
  dd_file_downloaded: "資料をダウンロード",
};

async function postAction(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const response = await fetch("/api/admin/dd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({ ok: false, error: "invalid_response" }))) as {
    ok: boolean;
    error?: string;
  };
  return json;
}

const ERROR_TEXT: Record<string, string> = {
  already_added: "この元データはすでに追加されている（外した項目は「戻す」で戻せる）",
  confidential_requires_acknowledgement: "要秘匿の項目は、開示してよいことを確認したチェックが必要",
  grant_already_exists: "この人にはすでに付与がある。停止・失効の解除は一覧の操作から行う",
  unknown_account: "このメールアドレスの外部アカウントがない。「アカウントも作る」にチェックする",
  account_suspended: "このアカウントは停止中。外部アクセス台帳で解除してから付与する",
  evidence_must_be_documents_in_same_package: "根拠資料には、このパッケージの資料項目だけを選べる",
  item_archived: "外した項目は公開できない。「戻す」で戻してから公開する",
  same_origin_required: "画面を開き直してから操作する",
};

function errorText(error: string | undefined) {
  if (!error) return "操作に失敗した";
  return ERROR_TEXT[error] ?? error;
}

export function DdAdminPanel({ state, candidates, onChanged }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const run = (body: Record<string, unknown>, success: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await postAction(body);
      if (result.ok) {
        setMessage({ tone: "ok", text: success });
        onChanged();
      } else {
        setMessage({ tone: "error", text: errorText(result.error) });
      }
    });
  };

  const activeItems = state.items.filter((item) => item.status === "active");
  const archivedItems = state.items.filter((item) => item.status === "archived");
  const publishedCount = activeItems.filter((item) => item.is_published).length;
  const documentItems = activeItems.filter((item) => item.item_kind === "document");
  const addedKeys = useMemo(() => new Set(state.items.map((item) => `${item.item_kind}|${item.source_key}`)), [state.items]);
  const topHref = `/dd/${encodeURIComponent(state.package.slug)}`;

  return (
    <div className="space-y-6 text-[#1d1d1f]">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6e6e73]">DDパッケージ（投資家・金融機関向けの開示面）</p>
            <h2 className="text-[18px] font-semibold">{state.package.title}</h2>
            <p className="mt-0.5 text-[12px] text-[#6e6e73]">
              公開中の項目は、ワークスペースの最新の内容がそのまま投資家に見える。正式に提出する版は「PDFを出力」で残す。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={topHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-[#d2d2d7] bg-white px-3 text-[12.5px] font-semibold hover:bg-[#f5f5f7]">
              DDパッケージを開く
            </a>
            <a href={`${topHref}/print`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-[#027FDC] bg-[#027FDC] px-3 text-[12.5px] font-semibold text-white hover:bg-[#0267b2]">
              PDFを出力
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] md:grid-cols-5">
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">パッケージの状態</dt>
            <dd className="mt-0.5 font-semibold">{DD_PACKAGE_STATUS_LABEL[state.package.status]}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">掲載項目</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{activeItems.length}件（公開中 {publishedCount}件）</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">閲覧権限</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {state.grants.filter((grant) => grant.status === "active" || grant.status === "invited").length}人
            </dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">閲覧記録（直近）</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{state.events.length}件</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">PDFの出力</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {state.exports.length}回{state.exports[0] ? `（最後 ${formatDdDate(state.exports[0].createdAt)}）` : ""}
            </dd>
          </div>
        </dl>
        {message && (
          <p role="status" className={`rounded-md border px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "border-[#bcdcf6] bg-[#eef6fd] text-[#0267b2]" : "border-[#f5c2c2] bg-[#fff5f5] text-[#b71c1c]"}`}>
            {message.text}
          </p>
        )}
      </header>

      <PackageSettings state={state} pending={pending} run={run} />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 border-b border-[#1d1d1f] pb-1">
          <h3 className="text-[15px] font-semibold">掲載項目</h3>
          <span className="text-[11px] text-[#6e6e73]">外部に見えるのは「公開中」の項目だけ。新しく足した項目は「公開する」を押すまで見えない。</span>
        </div>
        {DD_SECTIONS.map((section) => {
          const rows = activeItems.filter((item) => item.section_key === section.key).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={section.key} className="pt-2">
              <h4 className="text-[13px] font-semibold">
                {section.label}
                <span className="ml-2 text-[11px] font-normal text-[#6e6e73]">{section.description}</span>
              </h4>
              {rows.length === 0 ? (
                <p className="py-1.5 text-[12px] text-[#6e6e73]">まだ項目がない。下の「元データから追加」で足す。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="mt-1 w-full min-w-[820px] border-collapse text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] text-[#6e6e73]">
                        <th className="px-2 py-1 font-medium">項目</th>
                        <th className="w-[120px] px-2 py-1 font-medium">種類</th>
                        <th className="w-[150px] px-2 py-1 font-medium">公開</th>
                        <th className="w-[130px] px-2 py-1 font-medium">元データの更新</th>
                        <th className="w-[260px] px-2 py-1 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          topHref={topHref}
                          pending={pending}
                          run={run}
                          editing={editingId === item.id}
                          onToggleEdit={() => setEditingId((current) => (current === item.id ? null : item.id))}
                          documentItems={documentItems}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {archivedItems.length > 0 && (
          <details className="pt-2 text-[12px]">
            <summary className="cursor-pointer text-[#6e6e73]">外した項目 {archivedItems.length}件</summary>
            <ul className="mt-1 divide-y divide-[#f0f0f2]">
              {archivedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{item.title}（{DD_ITEM_KIND_LABEL[item.item_kind]}）</span>
                  <button type="button" disabled={pending} onClick={() => run({ action: "restore_item", itemId: item.id }, "項目を戻した（非公開のまま）")} className="rounded border border-[#d2d2d7] px-2 py-1 hover:bg-[#f5f5f7]">
                    戻す
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <AddItemForm packageId={state.package.id} candidates={candidates} addedKeys={addedKeys} pending={pending} run={run} />

      <GrantsSection state={state} pending={pending} run={run} />

      <section className="space-y-2">
        <div className="border-b border-[#1d1d1f] pb-1">
          <h3 className="text-[15px] font-semibold">PDFの出力の記録</h3>
        </div>
        {state.exports.length === 0 ? (
          <p className="text-[12px] text-[#6e6e73]">まだ出力していない。「PDFを出力」から印刷画面で「PDFに保存」を選ぶと、ここに記録が残る。</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[11px] text-[#6e6e73]">
                <th className="px-2 py-1 font-medium">日時</th>
                <th className="px-2 py-1 font-medium">出力した人</th>
                <th className="px-2 py-1 font-medium">項目数</th>
              </tr>
            </thead>
            <tbody>
              {state.exports.map((row) => (
                <tr key={row.id} className="border-t border-[#f0f0f2]">
                  <td className="whitespace-nowrap px-2 py-1">{new Date(row.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td>
                  <td className="px-2 py-1">{row.email ?? "—"}</td>
                  <td className="px-2 py-1 tabular-nums">{row.itemCount}件</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2">
        <div className="border-b border-[#1d1d1f] pb-1">
          <h3 className="text-[15px] font-semibold">閲覧記録</h3>
        </div>
        {state.events.length === 0 ? (
          <p className="text-[12px] text-[#6e6e73]">外部アカウントの閲覧記録はまだない。</p>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-[#6e6e73]">
                  <th className="px-2 py-1 font-medium">日時</th>
                  <th className="px-2 py-1 font-medium">閲覧者</th>
                  <th className="px-2 py-1 font-medium">操作</th>
                  <th className="px-2 py-1 font-medium">項目</th>
                </tr>
              </thead>
              <tbody>
                {state.events.map((event) => (
                  <tr key={event.id} className="border-t border-[#f0f0f2]">
                    <td className="px-2 py-1 whitespace-nowrap">{new Date(event.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td>
                    <td className="px-2 py-1">{event.email ?? "—"}</td>
                    <td className="px-2 py-1">{EVENT_LABEL[event.eventType] ?? event.eventType}</td>
                    <td className="px-2 py-1">
                      {event.itemId ? (state.items.find((item) => item.id === event.itemId)?.title ?? "（削除済み）") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type RunAction = (body: Record<string, unknown>, success: string, confirmText?: string) => void;

function PackageSettings({ state, pending, run }: { state: DdAdminState; pending: boolean; run: RunAction }) {
  const [title, setTitle] = useState(state.package.title);
  const [notice, setNotice] = useState(state.package.notice_text ?? "");
  const nextStatus: Array<{ status: DdPackageStatus; label: string; confirm: string }> = [
    { status: "draft", label: "未公開に戻す", confirm: "外部の人は誰も閲覧できなくなる。未公開に戻す？" },
    {
      status: "open",
      label: "公開を始める",
      confirm: "付与された外部の人が、公開中の項目を閲覧できるようになる（中身はワークスペースの最新）。招待メールは送られない。公開を始める？",
    },
    { status: "closed", label: "受付を終了する", confirm: "付与があっても誰も閲覧できなくなる。受付を終了する？" },
  ];
  return (
    <section className="space-y-2">
      <div className="border-b border-[#1d1d1f] pb-1">
        <h3 className="text-[15px] font-semibold">パッケージの設定</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-[#6e6e73]">表題（DDトップと入口に出る）</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-9 rounded border border-[#d2d2d7] px-2 text-[13px]" />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-[#6e6e73]">冒頭の注意書き</span>
          <textarea value={notice} onChange={(event) => setNotice(event.target.value)} rows={2} className="rounded border border-[#d2d2d7] px-2 py-1 text-[12.5px]" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ action: "update_package", packageId: state.package.id, title, noticeText: notice }, "表題と注意書きを保存した")}
          className="rounded-md border border-[#d2d2d7] px-3 py-1.5 text-[12.5px] hover:bg-[#f5f5f7]"
        >
          表題と注意書きを保存
        </button>
        <span className="mx-1 h-4 w-px bg-[#d2d2d7]" aria-hidden />
        {nextStatus
          .filter((option) => option.status !== state.package.status)
          .map((option) => (
            <button
              key={option.status}
              type="button"
              disabled={pending}
              onClick={() => run({ action: "update_package", packageId: state.package.id, status: option.status }, `パッケージを「${DD_PACKAGE_STATUS_LABEL[option.status]}」にした`, option.confirm)}
              className="rounded-md border border-[#d2d2d7] px-3 py-1.5 text-[12.5px] hover:bg-[#f5f5f7]"
            >
              {option.label}
            </button>
          ))}
      </div>
    </section>
  );
}

function ItemRow({
  item,
  topHref,
  pending,
  run,
  editing,
  onToggleEdit,
  documentItems,
}: {
  item: DdAdminItem;
  topHref: string;
  pending: boolean;
  run: RunAction;
  editing: boolean;
  onToggleEdit: () => void;
  documentItems: DdAdminItem[];
}) {
  return (
    <>
      <tr className="border-t border-[#f0f0f2] align-top">
        <td className="px-2 py-2">
          <span className="font-semibold">{item.title}</span>
          {item.summary && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[#6e6e73]">{item.summary}</p>}
          {item.sourceError && <p className="mt-0.5 text-[11.5px] text-[#b71c1c]">元データを読めない：{item.sourceError}</p>}
        </td>
        <td className="px-2 py-2 text-[#424245]">{DD_ITEM_KIND_LABEL[item.item_kind]}</td>
        <td className="px-2 py-2">
          {item.is_published ? (
            <span className="font-semibold text-[#0267b2]">
              公開中
              <span className="block text-[11px] font-normal text-[#6e6e73]">{formatDdDate(item.published_at)}から</span>
            </span>
          ) : (
            <span className="text-[#6e6e73]">非公開</span>
          )}
        </td>
        <td className="px-2 py-2 text-[12px] text-[#424245]">{formatDdDate(item.sourceAsOf)}</td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            <a
              href={`${topHref}/items/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]"
            >
              見る
            </a>
            {item.is_published ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run({ action: "withdraw_item", itemId: item.id }, "公開をやめた（外部から見えなくなった）", "この項目を外部から見えなくする。公開をやめる？")}
                className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]"
              >
                公開をやめる
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || Boolean(item.sourceError)}
                onClick={() =>
                  run(
                    { action: "publish_item", itemId: item.id },
                    "公開した（元データの最新がそのまま見える）",
                    "この項目を公開する。付与された投資家には、ワークスペースの最新の内容がそのまま見える。公開する？",
                  )
                }
                className="rounded border border-[#027FDC] bg-[#027FDC] px-2 py-1 text-[12px] font-semibold text-white hover:bg-[#0267b2] disabled:opacity-50"
              >
                公開する
              </button>
            )}
            <button type="button" onClick={onToggleEdit} className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]">
              {editing ? "閉じる" : "編集"}
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-[#fafafa] px-3 py-3">
            <ItemEditor item={item} pending={pending} run={run} documentItems={documentItems} />
          </td>
        </tr>
      )}
    </>
  );
}

function ItemEditor({ item, pending, run, documentItems }: { item: DdAdminItem; pending: boolean; run: RunAction; documentItems: DdAdminItem[] }) {
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary ?? "");
  const [section, setSection] = useState<DdSectionKey>(item.section_key);
  const [notes, setNotes] = useState(normalizeDdUnverifiedNotes(item.unverified_notes).join("\n"));
  const [evidence, setEvidence] = useState<string[]>(item.evidence_item_ids ?? []);
  const [autoUnverified, setAutoUnverified] = useState(item.source_options?.autoUnverified !== false);
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));

  return (
    <div className="grid gap-3 text-[12px] lg:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-[#6e6e73]">表題</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-9 rounded border border-[#d2d2d7] px-2 text-[13px]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[#6e6e73]">区分・並び順</span>
        <span className="flex gap-2">
          <select value={section} onChange={(event) => setSection(event.target.value as DdSectionKey)} className="min-h-9 flex-1 rounded border border-[#d2d2d7] px-2">
            {DD_SECTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} inputMode="numeric" className="min-h-9 w-20 rounded border border-[#d2d2d7] px-2" aria-label="並び順（小さいほど上）" />
        </span>
      </label>
      <label className="flex flex-col gap-1 lg:col-span-2">
        <span className="text-[#6e6e73]">一行説明（DDトップの一覧に出る）</span>
        <input value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-9 rounded border border-[#d2d2d7] px-2 text-[13px]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[#6e6e73]">未確認事項（1行に1件）</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="rounded border border-[#d2d2d7] px-2 py-1" />
        <span className="flex items-center gap-1.5">
          <input id={`auto-${item.id}`} type="checkbox" checked={autoUnverified} onChange={(event) => setAutoUnverified(event.target.checked)} />
          <label htmlFor={`auto-${item.id}`}>元データの要確認・未定を自動で加える</label>
        </span>
        {autoUnverified && item.autoUnverified.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-[11.5px] text-[#475569]">
            {item.autoUnverified.slice(0, 12).map((note) => (
              <li key={note}>{note}</li>
            ))}
            {item.autoUnverified.length > 12 && <li>ほか{item.autoUnverified.length - 12}件</li>}
          </ul>
        )}
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-[#6e6e73]">根拠資料（このパッケージの資料項目から選ぶ。公開中のものだけが投資家に見える）</span>
        <div className="max-h-40 overflow-auto rounded border border-[#d2d2d7] bg-white px-2 py-1">
          {documentItems.filter((doc) => doc.id !== item.id).length === 0 ? (
            <p className="py-1 text-[#6e6e73]">資料項目がまだない。</p>
          ) : (
            documentItems
              .filter((doc) => doc.id !== item.id)
              .map((doc) => (
                <label key={doc.id} className="flex items-center gap-1.5 py-0.5">
                  <input
                    type="checkbox"
                    checked={evidence.includes(doc.id)}
                    onChange={(event) =>
                      setEvidence((current) => (event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id)))
                    }
                  />
                  <span>{doc.title}</span>
                  {!doc.is_published && <span className="text-[11px] text-[#6e6e73]">（非公開）</span>}
                </label>
              ))
          )}
        </div>
        <p className="mt-2 text-[11.5px] leading-5 text-[#6e6e73]">
          中身は元データ（ワークスペースの{DD_ITEM_KIND_LABEL[item.item_kind]}）の最新をそのまま表示する。DDの側で中身は変えられない。
          直すときは元データの側を直す。
        </p>
      </div>
      <div className="flex flex-wrap gap-2 lg:col-span-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              {
                action: "update_item",
                itemId: item.id,
                title,
                summary,
                sectionKey: section,
                sortOrder: Number.parseInt(sortOrder, 10) || 0,
                unverifiedNotes: notes,
                evidenceItemIds: evidence,
                sourceOptions: { autoUnverified },
              },
              "保存した",
            )
          }
          className="rounded-md border border-[#027FDC] bg-[#027FDC] px-3 py-1.5 font-semibold text-white hover:bg-[#0267b2]"
        >
          保存
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ action: "archive_item", itemId: item.id }, "項目を外した（外部からも見えなくなった）", "この項目をDDから外す。外部からも見えなくなる。外す？")}
          className="rounded-md border border-[#f5c2c2] px-3 py-1.5 text-[#b71c1c] hover:bg-[#fff5f5]"
        >
          DDから外す
        </button>
      </div>
    </div>
  );
}

function AddItemForm({
  packageId,
  candidates,
  addedKeys,
  pending,
  run,
}: {
  packageId: string;
  candidates: DdSourceCandidate[];
  addedKeys: Set<string>;
  pending: boolean;
  run: RunAction;
}) {
  const [kind, setKind] = useState<DdItemKind | "all">("all");
  const [query, setQuery] = useState("");
  const [sectionByKey, setSectionByKey] = useState<Record<string, DdSectionKey>>({});
  const [ackByKey, setAckByKey] = useState<Record<string, boolean>>({});
  const filtered = candidates.filter(
    (candidate) =>
      (kind === "all" || candidate.itemKind === kind)
      && (!query.trim() || `${candidate.title} ${candidate.detail}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const defaultSection = (candidate: DdSourceCandidate): DdSectionKey => {
    if (candidate.itemKind === "funding_plan" || candidate.itemKind === "cost_model") return "economics";
    if (candidate.itemKind === "capital_policy") return "capital";
    if (candidate.itemKind === "project_page") {
      if (candidate.sourceKey === "project_page:capital-policy") return "capital";
      if (["project_page:company", "project_page:ip"].includes(candidate.sourceKey)) return "ip_contracts_team";
      return "business";
    }
    if (candidate.itemKind === "document") return "evidence";
    if (candidate.detail.includes("競合比較")) return "market";
    if (candidate.detail.includes("ビジネスモデル")) return "business";
    return "technology";
  };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1d1d1f] pb-1">
        <h2 className="text-[15px] font-semibold">元データから追加</h2>
        <span className="text-[11px] text-[#6e6e73]">追加しただけでは外部に見えない。「公開する」にした項目は、元データの最新がそのまま見える。</span>
      </div>
      <div className="flex flex-wrap gap-2 text-[12px]">
        <select value={kind} onChange={(event) => setKind(event.target.value as DdItemKind | "all")} className="min-h-9 rounded border border-[#d2d2d7] px-2">
          <option value="all">すべての種類</option>
          {(Object.keys(DD_ITEM_KIND_LABEL) as DdItemKind[]).map((option) => (
            <option key={option} value={option}>{DD_ITEM_KIND_LABEL[option]}</option>
          ))}
        </select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前で絞り込む" className="min-h-9 w-64 rounded border border-[#d2d2d7] px-2" />
        <span className="self-center text-[#6e6e73]">{filtered.length}件</span>
      </div>
      <div className="max-h-[480px] overflow-auto rounded-lg border border-[#e5e5e7]">
        <table className="w-full min-w-[880px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 bg-[#f5f5f7]">
            <tr className="text-left text-[11px] text-[#6e6e73]">
              <th className="px-2 py-1.5 font-medium">元データ</th>
              <th className="w-[110px] px-2 py-1.5 font-medium">種類</th>
              <th className="w-[110px] px-2 py-1.5 font-medium">更新</th>
              <th className="w-[300px] px-2 py-1.5 font-medium">追加先</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((candidate) => {
              const key = `${candidate.itemKind}|${candidate.sourceKey}`;
              const added = addedKeys.has(key);
              const section = sectionByKey[key] ?? defaultSection(candidate);
              const needsAck = candidate.confidentiality === "confidential";
              return (
                <tr key={key} className="border-t border-[#f0f0f2] align-top">
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{candidate.title}</span>
                    <span className="block text-[11px] text-[#6e6e73]">{candidate.detail}</span>
                    {candidate.caution && <span className="block text-[11px] text-[#a15c00]">{candidate.caution}</span>}
                    {candidate.blockedReason && <span className="block text-[11px] text-[#b71c1c]">{candidate.blockedReason}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-[#424245]">{DD_ITEM_KIND_LABEL[candidate.itemKind]}</td>
                  <td className="px-2 py-1.5 text-[#424245]">{formatDdDate(candidate.updatedAt)}</td>
                  <td className="px-2 py-1.5">
                    {added ? (
                      <span className="text-[#6e6e73]">追加済み</span>
                    ) : candidate.blockedReason ? (
                      <span className="text-[#6e6e73]">追加できない</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={section}
                          onChange={(event) => setSectionByKey((current) => ({ ...current, [key]: event.target.value as DdSectionKey }))}
                          className="min-h-8 rounded border border-[#d2d2d7] px-1.5"
                          aria-label="追加する区分"
                        >
                          {DD_SECTIONS.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                        {needsAck && (
                          <label className="flex items-center gap-1 text-[11px] text-[#a15c00]">
                            <input
                              type="checkbox"
                              checked={Boolean(ackByKey[key])}
                              onChange={(event) => setAckByKey((current) => ({ ...current, [key]: event.target.checked }))}
                            />
                            開示してよいと確認した
                          </label>
                        )}
                        <button
                          type="button"
                          disabled={pending || (needsAck && !ackByKey[key])}
                          onClick={() =>
                            run(
                              {
                                action: "add_item",
                                packageId,
                                itemKind: candidate.itemKind,
                                sourceKey: candidate.sourceKey,
                                sectionKey: section,
                                acknowledgeConfidential: needsAck ? Boolean(ackByKey[key]) : undefined,
                              },
                              `「${candidate.title}」を追加した（非公開）`,
                            )
                          }
                          className="rounded border border-[#d2d2d7] px-2 py-1 hover:bg-[#f5f5f7] disabled:opacity-50"
                        >
                          追加
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GrantsSection({ state, pending, run }: { state: DdAdminState; pending: boolean; run: RunAction }) {
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [download, setDownload] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const statusActions: Array<{ status: DdGrantStatus; label: string; confirm?: string }> = [
    { status: "suspended", label: "停止", confirm: "この人の閲覧を止める（次の操作から効く）。停止する？" },
    { status: "active", label: "再開" },
    { status: "revoked", label: "失効", confirm: "この人の閲覧権限を失効させる。失効する？" },
  ];
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1d1d1f] pb-1">
        <h2 className="text-[15px] font-semibold">閲覧権限（招待・停止・失効）</h2>
        <span className="text-[11px] text-[#6e6e73]">
          DDの閲覧権限はワークスペースやコックピットへの入場を含まない。付与してもメールは送られない（本人がログイン画面でメールアドレスを入れるとリンクが届く）。
        </span>
      </div>
      {state.grants.length === 0 ? (
        <p className="text-[12px] text-[#6e6e73]">まだ誰にも付与していない。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-[#6e6e73]">
                <th className="px-2 py-1 font-medium">メールアドレス・所属</th>
                <th className="w-[140px] px-2 py-1 font-medium">状態</th>
                <th className="w-[200px] px-2 py-1 font-medium">できる操作</th>
                <th className="w-[110px] px-2 py-1 font-medium">期限</th>
                <th className="w-[230px] px-2 py-1 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {state.grants.map((grant) => (
                <tr key={grant.id} className="border-t border-[#f0f0f2] align-top">
                  <td className="px-2 py-2">
                    <span className="font-medium">{grant.email}</span>
                    <span className="block text-[11px] text-[#6e6e73]">
                      {grant.organizationName ?? "所属未入力"}・最終ログイン {grant.lastLoginAt ? formatDdDate(grant.lastLoginAt) : "なし"}
                    </span>
                  </td>
                  <td className="px-2 py-2">{DD_GRANT_STATUS_LABEL[grant.status]}</td>
                  <td className="px-2 py-2">
                    {grant.capabilities.map((capability) => DD_CAPABILITY_LABEL[capability]).join("・")}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          {
                            action: "update_grant",
                            grantId: grant.id,
                            capabilities: grant.capabilities.includes("dd.download") ? ["dd.view"] : ["dd.view", "dd.download"],
                          },
                          "できる操作を変えた",
                        )
                      }
                      className="ml-2 rounded border border-[#d2d2d7] px-1.5 py-0.5 text-[11px] hover:bg-[#f5f5f7]"
                    >
                      {grant.capabilities.includes("dd.download") ? "ダウンロードを外す" : "ダウンロードを許可"}
                    </button>
                  </td>
                  <td className="px-2 py-2">{grant.expiresAt ? formatDdDate(grant.expiresAt) : "なし"}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {statusActions
                        .filter((action) => action.status !== grant.status && !(action.status === "active" && grant.status === "invited"))
                        .map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            disabled={pending}
                            onClick={() => run({ action: "update_grant", grantId: grant.id, status: action.status }, `「${DD_GRANT_STATUS_LABEL[action.status]}」にした`, action.confirm)}
                            className={`rounded border px-2 py-1 text-[12px] ${action.status === "revoked" ? "border-[#f5c2c2] text-[#b71c1c] hover:bg-[#fff5f5]" : "border-[#d2d2d7] hover:bg-[#f5f5f7]"}`}
                          >
                            {action.label}
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(
            {
              action: "create_grant",
              packageId: state.package.id,
              email,
              organizationName: organization,
              capabilities: download ? ["dd.view", "dd.download"] : ["dd.view"],
              expiresAt: expiresAt || null,
              createAccount,
            },
            "閲覧権限を付与した（メールは送っていない）",
            "この人にDDの閲覧権限を付与する。パッケージが「公開中」になると閲覧できる。付与する？",
          );
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3 text-[12px]"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[#6e6e73]">メールアドレス</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-9 w-64 rounded border border-[#d2d2d7] px-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#6e6e73]">所属（投資家・金融機関名）</span>
          <input value={organization} onChange={(event) => setOrganization(event.target.value)} className="min-h-9 w-56 rounded border border-[#d2d2d7] px-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#6e6e73]">期限（任意）</span>
          <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="min-h-9 rounded border border-[#d2d2d7] px-2" />
        </label>
        <label className="flex items-center gap-1.5 self-center">
          <input type="checkbox" checked={download} onChange={(event) => setDownload(event.target.checked)} />
          添付のダウンロードも許可
        </label>
        <label className="flex items-center gap-1.5 self-center">
          <input type="checkbox" checked={createAccount} onChange={(event) => setCreateAccount(event.target.checked)} />
          外部アカウントが無ければ作る
        </label>
        <button type="submit" disabled={pending} className="min-h-9 rounded-md border border-[#d2d2d7] bg-white px-3 font-semibold hover:bg-[#f5f5f7]">
          付与する
        </button>
      </form>
    </section>
  );
}
