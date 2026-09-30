"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DD_CAPABILITY_LABEL,
  DD_GRANT_STATUS_LABEL,
  DD_ITEM_KIND_LABEL,
  DD_PACKAGE_STATUS_LABEL,
  DD_PART_ITEM_KINDS,
  DD_SECTIONS,
  normalizeDdUnverifiedNotes,
  type DdGrantStatus,
  type DdItemKind,
  type DdPackageStatus,
  type DdPart,
  type DdSectionKey,
} from "@/lib/dd-package-core";
import type { DdAdminItem, DdAdminState } from "@/lib/dd-package-server";
import type { DdSourceCandidate } from "@/lib/dd-sources";
import { formatDdDate } from "@/lib/dd-format";

// DDパッケージの管理画面（AMD admin 限定）。
// 読み取りはサーバコンポーネントが行い、この部品は操作（POST /api/admin/dd）だけを送る。送った直後に router.refresh() で読み直す。
// 公開・取り下げ・状態変更・付与の停止/失効は確認を挟む。投資家への招待メールは送らない（この画面にも送信機能は無い）。

type Props = { state: DdAdminState; candidates: DdSourceCandidate[]; projectId: string };

const EVENT_LABEL: Record<string, string> = {
  dd_package_viewed: "トップを閲覧",
  dd_item_viewed: "項目を閲覧",
  dd_file_opened: "添付を表示",
  dd_file_downloaded: "添付をダウンロード",
};

async function postAction(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const response = await fetch("/api/admin/dd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))) as {
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
  parts_not_supported: "この種類の項目では、載せる範囲を選べない",
  invalid_source_options: "載せる範囲などの指定が読めない。画面を開き直してから選び直す",
  same_origin_required: "画面を開き直してから操作する",
};

function errorText(error: string | undefined) {
  if (!error) return "操作に失敗した";
  return ERROR_TEXT[error] ?? error;
}

export function DdAdminPanel({ state, candidates, projectId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const run = (body: Record<string, unknown>, success: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await postAction(body);
      if (result.ok) {
        setMessage({ tone: "ok", text: success });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: errorText(result.error) });
      }
    });
  };

  const activeItems = state.items.filter((item) => item.status === "active");
  const archivedItems = state.items.filter((item) => item.status === "archived");
  const publishedCount = activeItems.filter((item) => item.published_publication_id).length;
  const changedCount = activeItems.filter((item) => item.sourceChanged).length;
  const documentItems = activeItems.filter((item) => item.item_kind === "document");
  const addedKeys = useMemo(() => new Set(state.items.map((item) => `${item.item_kind}|${item.source_key}`)), [state.items]);
  const previewHref = `/dd/${encodeURIComponent(state.package.slug)}`;

  return (
    <div className="space-y-6 text-[#1d1d1f]">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6e6e73]">DDパッケージ（投資家・金融機関向けの開示面）</p>
            <h1 className="text-[18px] font-semibold">{state.package.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={previewHref} target="_blank" className="inline-flex min-h-9 items-center rounded-md border border-[#027FDC] bg-[#027FDC] px-3 text-[12.5px] font-semibold text-white hover:bg-[#0267b2]">
              投資家の見え方をプレビュー
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] md:grid-cols-5">
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">パッケージの状態</dt>
            <dd className="mt-0.5 font-semibold">{DD_PACKAGE_STATUS_LABEL[state.package.status]}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">掲載項目</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{activeItems.length}件（公開版あり {publishedCount}件）</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">公開後に元データが変わった項目</dt>
            <dd className={`mt-0.5 font-semibold tabular-nums ${changedCount > 0 ? "text-[#a15c00]" : ""}`}>{changedCount}件</dd>
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
          <h2 className="text-[15px] font-semibold">掲載項目</h2>
          <span className="text-[11px] text-[#6e6e73]">外部に見えるのは「公開版」の列に版がある項目だけ。新しく足した項目は公開するまで見えない。</span>
        </div>
        {DD_SECTIONS.map((section) => {
          const rows = activeItems.filter((item) => item.section_key === section.key).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={section.key} className="pt-2">
              <h3 className="text-[13px] font-semibold">
                {section.label}
                <span className="ml-2 text-[11px] font-normal text-[#6e6e73]">{section.description}</span>
              </h3>
              {rows.length === 0 ? (
                <p className="py-1.5 text-[12px] text-[#6e6e73]">まだ項目がない。下の「元データから追加」で足す。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="mt-1 w-full min-w-[880px] border-collapse text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] text-[#6e6e73]">
                        <th className="px-2 py-1 font-medium">項目</th>
                        <th className="w-[120px] px-2 py-1 font-medium">種類</th>
                        <th className="w-[150px] px-2 py-1 font-medium">公開版</th>
                        <th className="w-[140px] px-2 py-1 font-medium">元データ</th>
                        <th className="w-[300px] px-2 py-1 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          projectId={projectId}
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
                  <button type="button" disabled={pending} onClick={() => run({ action: "restore_item", itemId: item.id }, "項目を戻した（未公開のまま）")} className="rounded border border-[#d2d2d7] px-2 py-1 hover:bg-[#f5f5f7]">
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
          <h2 className="text-[15px] font-semibold">閲覧記録</h2>
        </div>
        {state.events.length === 0 ? (
          <p className="text-[12px] text-[#6e6e73]">外部アカウントの閲覧記録はまだない（管理者のプレビューは記録しない）。</p>
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
                      {event.revision ? ` 第${event.revision}版` : ""}
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
      confirm: "付与された外部の人が、公開版のある項目を閲覧できるようになる。招待メールは送られない。公開を始める？",
    },
    { status: "closed", label: "受付を終了する", confirm: "付与があっても誰も閲覧できなくなる。受付を終了する？" },
  ];
  return (
    <section className="space-y-2">
      <div className="border-b border-[#1d1d1f] pb-1">
        <h2 className="text-[15px] font-semibold">パッケージの設定</h2>
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
  projectId,
  pending,
  run,
  editing,
  onToggleEdit,
  documentItems,
}: {
  item: DdAdminItem;
  projectId: string;
  pending: boolean;
  run: RunAction;
  editing: boolean;
  onToggleEdit: () => void;
  documentItems: DdAdminItem[];
}) {
  const current = item.publications.find((publication) => publication.id === item.published_publication_id) ?? null;
  const latest = item.publications[0] ?? null;
  return (
    <>
      <tr className="border-t border-[#f0f0f2] align-top">
        <td className="px-2 py-2">
          <span className="font-semibold">{item.title}</span>
          {item.summary && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[#6e6e73]">{item.summary}</p>}
        </td>
        <td className="px-2 py-2 text-[#424245]">{DD_ITEM_KIND_LABEL[item.item_kind]}</td>
        <td className="px-2 py-2">
          {current ? (
            <span>
              第{current.revision}版
              <span className="block text-[11px] text-[#6e6e73]">{formatDdDate(current.publishedAt)} 公開</span>
            </span>
          ) : (
            <span className="text-[#6e6e73]">
              未公開{latest ? `（取り下げ中・最終 第${latest.revision}版）` : ""}
            </span>
          )}
        </td>
        <td className="px-2 py-2 text-[12px]">
          {item.sourceError ? (
            <span className="text-[#b71c1c]">{item.sourceError}</span>
          ) : item.sourceChanged ? (
            <span className="font-semibold text-[#a15c00]">公開後に更新あり</span>
          ) : current ? (
            <span className="text-[#6e6e73]">公開版と同じ</span>
          ) : (
            <span className="text-[#6e6e73]">—</span>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/project/${encodeURIComponent(projectId)}/dd/preview/${item.id}`}
              target="_blank"
              className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]"
            >
              下書きを見る
            </Link>
            <button
              type="button"
              disabled={pending || Boolean(item.sourceError)}
              onClick={() => {
                const note = window.prompt(
                  current
                    ? "いまの元データで新しい公開版を作る。確認した内容のメモ（社内用・投資家には見えない）"
                    : "この項目を公開する。確認した内容のメモ（社内用・投資家には見えない）",
                  "",
                );
                if (note === null) return;
                run({ action: "publish_item", itemId: item.id, note }, current ? "新しい公開版を作った（内容が同じなら版は増えない）" : "公開した");
              }}
              className="rounded border border-[#027FDC] bg-[#027FDC] px-2 py-1 text-[12px] font-semibold text-white hover:bg-[#0267b2] disabled:opacity-50"
            >
              {current ? "更新して公開" : "公開"}
            </button>
            {current && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run({ action: "withdraw_item", itemId: item.id }, "取り下げた（公開版の記録は残る）", "外部から見えなくなる。取り下げる？")}
                className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]"
              >
                取り下げ
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
  const [lastEventId, setLastEventId] = useState<string>(typeof item.source_options?.lastEventId === "string" ? item.source_options.lastEventId : "");
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));
  const supportsParts = DD_PART_ITEM_KINDS.includes(item.item_kind) && item.partChoices.length > 0;
  const savedParts = Array.isArray(item.source_options?.includedParts)
    ? (item.source_options.includedParts as unknown[]).filter((key): key is string => typeof key === "string")
    : null;
  // 範囲を一度も保存していない項目は、元データの節・行をすべて載せる状態（全部にチェック）から始める。
  const [includedParts, setIncludedParts] = useState<Set<string>>(
    () => new Set(savedParts ?? item.partChoices.map((part) => part.key)),
  );
  const [partsTouched, setPartsTouched] = useState(false);

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
        <span className="text-[#6e6e73]">未確認事項（1行に1件。公開時に固定される）</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="rounded border border-[#d2d2d7] px-2 py-1" />
        <span className="flex items-center gap-1.5">
          <input id={`auto-${item.id}`} type="checkbox" checked={autoUnverified} onChange={(event) => setAutoUnverified(event.target.checked)} />
          <label htmlFor={`auto-${item.id}`}>元データの要確認・未定を自動で加える</label>
        </span>
        {autoUnverified && item.draftAutoUnverified.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-[11.5px] text-[#475569]">
            {item.draftAutoUnverified.slice(0, 12).map((note) => (
              <li key={note}>{note}</li>
            ))}
            {item.draftAutoUnverified.length > 12 && <li>ほか{item.draftAutoUnverified.length - 12}件</li>}
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
                  {!doc.published_publication_id && <span className="text-[11px] text-[#6e6e73]">（未公開）</span>}
                </label>
              ))
          )}
        </div>
        {supportsParts && (
          <PartPicker
            itemId={item.id}
            parts={item.partChoices}
            included={includedParts}
            savedAsAll={savedParts === null}
            onChange={(next) => {
              setIncludedParts(next);
              setPartsTouched(true);
            }}
          />
        )}
        {item.item_kind === "capital_policy" && item.capitalEvents.length > 0 && (
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[#6e6e73]">載せるラウンド（このラウンドまで）</span>
            <select value={lastEventId} onChange={(event) => setLastEventId(event.target.value)} className="min-h-9 rounded border border-[#d2d2d7] px-2">
              <option value="">すべてのラウンド</option>
              {item.capitalEvents.map((event) => (
                <option key={event.id} value={event.id}>{event.label}まで</option>
              ))}
            </select>
          </label>
        )}
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
                sourceOptions: {
                  autoUnverified,
                  ...(item.item_kind === "capital_policy" ? { lastEventId: lastEventId || null } : {}),
                  // 範囲に触ったときだけ送る（表題だけ直したときに、全部載せの状態を固定の選択へ変えない）。
                  ...(supportsParts && partsTouched ? { includedParts: Array.from(includedParts) } : {}),
                },
              },
              "保存した（公開版を変えるには「更新して公開」を押す）",
            )
          }
          className="rounded-md border border-[#027FDC] bg-[#027FDC] px-3 py-1.5 font-semibold text-white hover:bg-[#0267b2]"
        >
          保存
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ action: "archive_item", itemId: item.id }, "項目を外した（公開版の記録は残る）", "この項目をDDから外す。外部からも見えなくなる。外す？")}
          className="rounded-md border border-[#f5c2c2] px-3 py-1.5 text-[#b71c1c] hover:bg-[#fff5f5]"
        >
          DDから外す
        </button>
      </div>
    </div>
  );
}

/** 載せる範囲（本文の節・表の行・注意書き・段落）を選ぶ。チェックを外した部分は、下書きにも公開版にも入らない。 */
function PartPicker({
  itemId,
  parts,
  included,
  savedAsAll,
  onChange,
}: {
  itemId: string;
  parts: DdPart[];
  included: Set<string>;
  savedAsAll: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, DdPart[]>();
    for (const part of parts) {
      const list = map.get(part.group) ?? [];
      list.push(part);
      map.set(part.group, list);
    }
    return Array.from(map.entries());
  }, [parts]);
  const checkedCount = parts.filter((part) => included.has(part.key)).length;

  const setGroup = (groupParts: DdPart[], checked: boolean) => {
    const next = new Set(included);
    for (const part of groupParts) {
      if (checked) next.add(part.key);
      else next.delete(part.key);
    }
    onChange(next);
  };

  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className="text-[#6e6e73]">
        載せる範囲（{checkedCount}/{parts.length}）。外した節・行は、下書きにも公開版にも入らない
      </span>
      <div className="max-h-72 overflow-auto rounded border border-[#d2d2d7] bg-white px-2 py-1">
        {groups.map(([group, groupParts]) => (
          <fieldset key={group} className="border-t border-[#f0f0f2] py-1 first:border-t-0">
            <legend className="flex w-full items-center gap-2 py-0.5 text-[11.5px] font-semibold text-[#424245]">
              <span className="flex-1">{group}</span>
              <button type="button" onClick={() => setGroup(groupParts, true)} className="font-normal text-[#027FDC] hover:underline">すべて選ぶ</button>
              <button type="button" onClick={() => setGroup(groupParts, false)} className="font-normal text-[#027FDC] hover:underline">すべて外す</button>
            </legend>
            {groupParts.map((part) => (
              <label key={part.key} htmlFor={`part-${itemId}-${part.key}`} className="flex items-start gap-1.5 py-0.5">
                <input
                  id={`part-${itemId}-${part.key}`}
                  type="checkbox"
                  className="mt-0.5"
                  checked={included.has(part.key)}
                  onChange={(event) => {
                    const next = new Set(included);
                    if (event.target.checked) next.add(part.key);
                    else next.delete(part.key);
                    onChange(next);
                  }}
                />
                <span>{part.label}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <span className="text-[11px] leading-4 text-[#6e6e73]">
        {savedAsAll
          ? "いまは元データの節・行をすべて載せる状態。範囲を保存すると、あとから元データに増えた節・行は、ここで選ぶまで載らない。"
          : "範囲を保存済み。あとから元データに増えた節・行や、書き換わった段落は、ここで選ぶまで載らない。"}
        範囲を変えても、公開し直すまで外部には前の公開版が見える。
      </span>
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
    if (candidate.itemKind === "document") return "evidence";
    if (candidate.detail.includes("競合比較")) return "market";
    if (candidate.detail.includes("ビジネスモデル")) return "business";
    return "technology";
  };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1d1d1f] pb-1">
        <h2 className="text-[15px] font-semibold">元データから追加</h2>
        <span className="text-[11px] text-[#6e6e73]">追加しただけでは外部に見えない。追加した項目を「公開」すると、その時点の内容が公開版として固定される。</span>
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
                              `「${candidate.title}」を追加した（未公開）`,
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
