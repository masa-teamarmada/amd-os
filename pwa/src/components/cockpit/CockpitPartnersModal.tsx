"use client";

/**
 * 興味を持っている事業会社モーダル: 協業先 (collab) / 顧客候補 (customer)。
 * type 別に表示・編集フィールドが切り替わる。
 */

import { useEffect, useState } from "react";
import {
  fetchPartners,
  upsertPartner,
  deletePartner,
  type ProjectPartner,
  type PartnerType,
} from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  onClose: () => void;
}

interface Draft {
  id?: string;
  partner_name: string;
  partner_type: PartnerType;
  partner_role: string;
  sales_target_date: string | null;
  remaining_conditions: string;
  is_sold: boolean;
  sales_actuals_text: string; // 自由文 (金額・契約条件等)
  notes: string;
}

const emptyDraft: Draft = {
  partner_name: "",
  partner_type: "collab",
  partner_role: "",
  sales_target_date: null,
  remaining_conditions: "",
  is_sold: false,
  sales_actuals_text: "",
  notes: "",
};

function actualsToText(meta: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  if (typeof meta.text === "string") return meta.text;
  try {
    return JSON.stringify(meta);
  } catch {
    return "";
  }
}

export function CockpitPartnersModal({ projectId, onClose }: Props) {
  const [partners, setPartners] = useState<ProjectPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setPartners(await fetchPartners(projectId));
    setLoading(false);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startNew = (type: PartnerType) =>
    setDraft({ ...emptyDraft, partner_type: type });
  const startEdit = (p: ProjectPartner) =>
    setDraft({
      id: p.id,
      partner_name: p.partner_name,
      partner_type: p.partner_type,
      partner_role: p.partner_role ?? "",
      sales_target_date: p.sales_target_date,
      remaining_conditions: p.remaining_conditions ?? "",
      is_sold: p.is_sold,
      sales_actuals_text: actualsToText(p.sales_actuals),
      notes: p.notes ?? "",
    });

  const onSave = async () => {
    if (!draft) return;
    if (!draft.partner_name.trim()) return;
    setSaving(true);
    await upsertPartner(projectId, {
      id: draft.id,
      partner_name: draft.partner_name.trim(),
      partner_type: draft.partner_type,
      partner_role: draft.partner_type === "collab" ? draft.partner_role.trim() || null : null,
      sales_target_date: draft.partner_type === "customer" ? draft.sales_target_date : null,
      remaining_conditions:
        draft.partner_type === "customer" ? draft.remaining_conditions.trim() || null : null,
      is_sold: draft.partner_type === "customer" ? draft.is_sold : false,
      sales_actuals:
        draft.partner_type === "customer" && draft.is_sold && draft.sales_actuals_text.trim()
          ? { text: draft.sales_actuals_text.trim() }
          : {},
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    setDraft(null);
    await reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("この事業会社を削除しますか?")) return;
    setSaving(true);
    await deletePartner(projectId, id);
    setSaving(false);
    await reload();
  };

  const collabs = partners.filter((p) => p.partner_type === "collab");
  const customers = partners.filter((p) => p.partner_type === "customer");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[680px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">興味を持っている事業会社</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-4">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">読み込み中…</p>
          ) : (
            <>
              {/* 協業先 */}
              <div>
                <h4 className="text-[12px] font-semibold text-slate-700 mb-1">🤝 協業先</h4>
                {collabs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">まだなし</p>
                ) : (
                  <ul className="divide-y divide-[#f1f5f9]">
                    {collabs.map((p) => (
                      <li key={p.id} className="py-2 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium">{p.partner_name}</div>
                          {p.partner_role && (
                            <div className="text-[11px] text-slate-600 mt-0.5">役割: {p.partner_role}</div>
                          )}
                          {p.notes && <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap">{p.notes}</div>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => startEdit(p)} className="text-[11px] text-blue-600 hover:underline">
                            編集
                          </button>
                          <button onClick={() => onDelete(p.id)} className="text-[11px] text-red-600 hover:underline">
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!draft && (
                  <button
                    onClick={() => startNew("collab")}
                    className="mt-2 text-[11px] px-2 py-1 rounded-md border border-dashed border-[#cbd5e1] text-blue-700 hover:bg-blue-50"
                  >
                    + 協業先を追加
                  </button>
                )}
              </div>

              {/* 顧客候補 */}
              <div>
                <h4 className="text-[12px] font-semibold text-slate-700 mb-1">🛒 顧客候補</h4>
                {customers.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">まだなし</p>
                ) : (
                  <ul className="divide-y divide-[#f1f5f9]">
                    {customers.map((p) => (
                      <li key={p.id} className="py-2 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium">
                            {p.partner_name}
                            {p.is_sold && (
                              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                販売済
                              </span>
                            )}
                          </div>
                          {p.is_sold ? (
                            <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">
                              実績: {actualsToText(p.sales_actuals) || "(未記入)"}
                            </div>
                          ) : (
                            <>
                              {p.sales_target_date && (
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                  販売予定: {p.sales_target_date}
                                </div>
                              )}
                              {p.remaining_conditions && (
                                <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">
                                  残条件: {p.remaining_conditions}
                                </div>
                              )}
                            </>
                          )}
                          {p.notes && <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap">{p.notes}</div>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => startEdit(p)} className="text-[11px] text-blue-600 hover:underline">
                            編集
                          </button>
                          <button onClick={() => onDelete(p.id)} className="text-[11px] text-red-600 hover:underline">
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!draft && (
                  <button
                    onClick={() => startNew("customer")}
                    className="mt-2 text-[11px] px-2 py-1 rounded-md border border-dashed border-[#cbd5e1] text-blue-700 hover:bg-blue-50"
                  >
                    + 顧客候補を追加
                  </button>
                )}
              </div>
            </>
          )}

          {draft && (
            <div className="border border-blue-100 bg-blue-50/40 rounded-md p-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                <span className="text-muted-foreground">事業会社名</span>
                <input
                  value={draft.partner_name}
                  onChange={(e) => setDraft({ ...draft, partner_name: e.target.value })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">種別</span>
                <select
                  value={draft.partner_type}
                  onChange={(e) =>
                    setDraft({ ...draft, partner_type: e.target.value as PartnerType })
                  }
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                >
                  <option value="collab">🤝 協業先</option>
                  <option value="customer">🛒 顧客候補</option>
                </select>
              </label>
              <div />

              {draft.partner_type === "collab" && (
                <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                  <span className="text-muted-foreground">事業会社の役割 (業務分担)</span>
                  <input
                    value={draft.partner_role}
                    onChange={(e) => setDraft({ ...draft, partner_role: e.target.value })}
                    className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                    placeholder="例: 量産工程の OEM、販路開拓担当"
                  />
                </label>
              )}

              {draft.partner_type === "customer" && (
                <>
                  <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                    <span className="text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={draft.is_sold}
                        onChange={(e) => setDraft({ ...draft, is_sold: e.target.checked })}
                        className="mr-1.5 align-middle"
                      />
                      販売済 (チェックすると残条件→販売実績に切替)
                    </span>
                  </label>
                  {draft.is_sold ? (
                    <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                      <span className="text-muted-foreground">販売実績 (金額・数量・契約条件など自由記述)</span>
                      <textarea
                        value={draft.sales_actuals_text}
                        onChange={(e) => setDraft({ ...draft, sales_actuals_text: e.target.value })}
                        rows={2}
                        className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[12px]"
                        placeholder="例: 2026-04 月 ¥3M / 5 件、年契約"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="flex flex-col gap-0.5 text-[11px]">
                        <span className="text-muted-foreground">販売予定日</span>
                        <input
                          type="date"
                          value={draft.sales_target_date?.slice(0, 10) ?? ""}
                          onChange={(e) =>
                            setDraft({ ...draft, sales_target_date: e.target.value || null })
                          }
                          className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                        />
                      </label>
                      <div />
                      <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                        <span className="text-muted-foreground">売買契約までの残条件</span>
                        <textarea
                          value={draft.remaining_conditions}
                          onChange={(e) => setDraft({ ...draft, remaining_conditions: e.target.value })}
                          rows={2}
                          className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[12px]"
                          placeholder="例: PoC 結果の社内承認 / 価格交渉 / 法務レビュー"
                        />
                      </label>
                    </>
                  )}
                </>
              )}

              <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                <span className="text-muted-foreground">メモ</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[12px]"
                />
              </label>

              <div className="col-span-2 flex justify-end gap-2 mt-1">
                <button
                  onClick={() => setDraft(null)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#e5e5e7] hover:bg-white"
                >
                  キャンセル
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || !draft.partner_name.trim()}
                  className="text-[11px] px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
