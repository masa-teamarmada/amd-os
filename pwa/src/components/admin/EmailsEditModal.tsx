"use client";

/**
 * EmailsEditModal — 関係先メアドの一覧表示 + 個別追加・削除 + 一括保存。
 *
 * まさ #16 (2026-05-24) 確定:
 *  - admin/projects の `report_emails` 列が「a@b.com, c@d.com, ...」と長くなりがちで
 *    行幅を膨らませていた。
 *  - 普段は「N件 ▸」の chip 表示にして、クリックでこのモーダルを開き、
 *    モーダル内で個別削除 / 追加 / 保存できる。
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  title?: string;
  emails: string[];           // 初期メアドリスト (= 親が CSV を split したもの)
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (emails: string[]) => void | Promise<void>;
}

function isLikelyEmail(s: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(s.trim());
}

export function EmailsEditModal({ title, emails: initial, open, saving = false, onOpenChange, onSave }: Props) {
  const [emails, setEmails] = useState<string[]>(initial);
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // open のたびに最新 initial で reset
  useEffect(() => {
    if (open) {
      setEmails(initial);
      setDraft("");
      setError(null);
    }
  }, [open, initial]);

  function addDraft() {
    setError(null);
    const lines = draft
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const next = [...emails];
    const seen = new Set(emails.map((e) => e.toLowerCase()));
    const invalid: string[] = [];
    const dup: string[] = [];
    for (const e of lines) {
      const lower = e.toLowerCase();
      if (!isLikelyEmail(e)) { invalid.push(e); continue; }
      if (seen.has(lower)) { dup.push(e); continue; }
      seen.add(lower);
      next.push(e);
    }
    setEmails(next);
    setDraft("");
    if (invalid.length > 0 || dup.length > 0) {
      const parts: string[] = [];
      if (invalid.length > 0) parts.push(`メアド形式が変: ${invalid.join(", ")}`);
      if (dup.length > 0) parts.push(`重複スキップ: ${dup.join(", ")}`);
      setError(parts.join(" / "));
    }
  }

  function removeAt(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (saving) return;
    setError(null);
    // 末尾 draft が未追加なら自動的に追加して保存
    if (draft.trim()) {
      addDraft();
      return;
    }
    await onSave(emails);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[640px] w-[92vw] max-h-[80vh] overflow-y-auto p-0">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-5 py-3 backdrop-blur">
          <DialogTitle className="text-[15px] font-semibold">
            関係先メアド編集 {title ? `— ${title}` : ""}
          </DialogTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            個別に削除 / 追加できる。保存ボタンで反映 (= 親 cell に CSV で書き戻し)。
          </p>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* リスト */}
          <section>
            <h3 className="text-[12px] font-semibold text-foreground mb-2">
              現在のメアド <span className="text-muted-foreground font-normal">({emails.length}件)</span>
            </h3>
            {emails.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic">まだ登録なし。下のフォームから追加。</p>
            ) : (
              <ul className="space-y-1">
                {emails.map((email, i) => (
                  <li
                    key={`${email}:${i}`}
                    className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5"
                  >
                    <span className="flex-1 min-w-0 text-[12px] font-mono break-all">{email}</span>
                    {!isLikelyEmail(email) && (
                      <span className="text-[10px] text-red-600 shrink-0">形式注意</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      disabled={saving}
                      className="text-[10px] rounded border border-red-200 bg-red-50 text-red-700 px-1.5 py-0.5 hover:bg-red-100 disabled:opacity-40"
                      title="このメアドを削除"
                    >
                      ✕ 削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 追加フォーム */}
          <section>
            <h3 className="text-[12px] font-semibold text-foreground mb-2">追加</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addDraft(); }
                }}
                placeholder="a@b.com  (Enter で追加。複数はカンマ / 空白 / 改行区切りも OK)"
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-[12px] font-mono"
                disabled={saving}
              />
              <button
                type="button"
                onClick={addDraft}
                disabled={saving || !draft.trim()}
                className="rounded border border-border bg-muted px-3 py-1.5 text-[11px] hover:bg-muted-foreground/10 disabled:opacity-40"
              >
                + 追加
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-[11px] text-amber-700">{error}</p>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 border-t border-border bg-white/95 px-5 py-3 flex items-center gap-2 backdrop-blur">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded border border-border bg-background px-3 py-1.5 text-[12px] hover:bg-muted disabled:opacity-40"
          >
            キャンセル
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 text-white px-4 py-1.5 text-[12px] font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
