"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface Setting {
  key: string;
  label?: string;
  value?: string;
  type?: string;
  description?: string;
  updated_at?: string;
}

interface Props {
  settings: Setting[];
}

const BLANK: Setting = {
  key: "",
  label: "",
  value: "",
  type: "string",
  description: "",
};

export function AdminSettingsClient({ settings: initial }: Props) {
  const [rows, setRows] = useState<Setting[]>(initial);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; row: Setting } | null>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const openNew = () => setModal({ mode: "new", row: { ...BLANK } });
  const openEdit = (r: Setting) => setModal({ mode: "edit", row: { ...r } });
  const closeModal = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    if (!modal.row.key.trim()) { setHint("Key は必須です"); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const payload = { ...modal.row, updated_at: now };

    let error;
    if (modal.mode === "new") {
      ({ error } = await supabase.from("settings").insert(payload));
      if (!error) {
        setRows((prev) => [...prev, payload]);
        setHint(`"${modal.row.key}" を追加しました`);
      }
    } else {
      ({ error } = await supabase
        .from("settings")
        .update({ ...payload })
        .eq("key", modal.row.key));
      if (!error) {
        setRows((prev) => prev.map((x) => x.key === modal.row.key ? { ...x, ...payload } : x));
        setHint(`"${modal.row.key}" を保存しました`);
      }
    }

    if (error) {
      setHint(`エラー: ${error.message}`);
    } else {
      closeModal();
    }
    setSaving(false);
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`"${key}" を削除してもいい？`)) return;
    const { error } = await supabase.from("settings").delete().eq("key", key);
    if (!error) {
      setRows((prev) => prev.filter((x) => x.key !== key));
      setHint(`"${key}" を削除しました`);
    } else {
      setHint(`削除エラー: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={openNew}
          className="text-[12px] bg-foreground text-background px-3 py-1.5 rounded"
        >
          ＋ 追加
        </button>
      </div>

      {hint && <div className="text-[12px] text-muted-foreground mb-2">{hint}</div>}

      {rows.length === 0 ? (
        <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
          設定がありません。「＋ 追加」から登録してください。
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2 font-medium">Key</th>
                <th className="text-left px-3 py-2 font-medium">ラベル</th>
                <th className="text-left px-3 py-2 font-medium">値</th>
                <th className="text-left px-3 py-2 font-medium">型</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">説明</th>
                <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">更新日時</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11px]">{r.key}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.label || "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.value ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{r.type || "string"}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{r.description || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">
                    {r.updated_at?.slice(0, 10) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(r)}
                        className="text-[11px] border border-border px-2 py-0.5 rounded hover:bg-muted/40"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteSetting(r.key)}
                        className="text-[11px] text-red-600 border border-red-200 px-2 py-0.5 rounded hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-[14px] font-semibold mb-4">
              {modal.mode === "new" ? "設定を追加" : "設定を編集"}
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Key（変更不可）</label>
                <input
                  type="text"
                  value={modal.row.key}
                  readOnly={modal.mode === "edit"}
                  onChange={(e) => setModal((m) => m ? { ...m, row: { ...m.row, key: e.target.value } } : null)}
                  placeholder="例: nudge_reminder_day"
                  className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">ラベル</label>
                <input
                  type="text"
                  value={modal.row.label || ""}
                  onChange={(e) => setModal((m) => m ? { ...m, row: { ...m.row, label: e.target.value } } : null)}
                  placeholder="例: Nudgeリマインド日"
                  className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">値</label>
                <input
                  type="text"
                  value={modal.row.value || ""}
                  onChange={(e) => setModal((m) => m ? { ...m, row: { ...m.row, value: e.target.value } } : null)}
                  className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">型</label>
                <select
                  value={modal.row.type || "string"}
                  onChange={(e) => setModal((m) => m ? { ...m, row: { ...m.row, type: e.target.value } } : null)}
                  className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">説明</label>
                <input
                  type="text"
                  value={modal.row.description || ""}
                  onChange={(e) => setModal((m) => m ? { ...m, row: { ...m.row, description: e.target.value } } : null)}
                  placeholder="例: 月次リマインドを送る日（1〜28）"
                  className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={closeModal}
                className="text-[12px] text-muted-foreground border border-border px-4 py-1.5 rounded"
              >
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="text-[12px] bg-foreground text-background px-4 py-1.5 rounded disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
