"use client";

/**
 * 事業概要詳細モーダル: long_description (詳細) を表示し、ユーザー追記を受け取る。
 * 追記は単純な append でなく、つくよみ (Claude Sonnet) が既存に滑らかにマージする。
 *
 * - 上部: short_description (1〜2 行、PJ メタ編集で編集)
 * - 中央: long_description (markdown 風 textarea、直接編集可)
 * - 下部: 「追記したい内容」 textarea + 「✨ つくよみがマージ」ボタン
 *         クリック → /api/project-ventures/[projectId]/description-merge → long_description 更新
 */

import { useState } from "react";
import { mergeDescriptionWithLLM, updateProjectVenture } from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  shortDescription: string | null;
  longDescription: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CockpitDescriptionDetailModal({
  projectId,
  shortDescription,
  longDescription,
  onClose,
  onSaved,
}: Props) {
  const [longText, setLongText] = useState(longDescription ?? "");
  const [addition, setAddition] = useState("");
  const [merging, setMerging] = useState(false);
  const [saving, setSaving] = useState(false);

  const onMerge = async () => {
    if (!addition.trim()) return;
    setMerging(true);
    const result = await mergeDescriptionWithLLM({ projectId, addition: addition.trim() });
    setMerging(false);
    if (!result) {
      alert("マージに失敗しました");
      return;
    }
    setLongText(result.long_description);
    setAddition("");
    // long_description は API 側で保存済み。short_description も更新されることがある
    onSaved();
  };

  const onSaveDirect = async () => {
    setSaving(true);
    await updateProjectVenture(projectId, { long_description: longText });
    setSaving(false);
    onSaved();
  };

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
          <h3 className="text-sm font-semibold">事業概要 (詳細)</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          {shortDescription && (
            <div className="text-[12px] text-slate-600 italic border-l-2 border-[#cbd5e1] pl-2">
              {shortDescription}
            </div>
          )}

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground flex items-center justify-between">
              <span>詳細概要</span>
              <button
                onClick={onSaveDirect}
                disabled={saving}
                className="text-[11px] text-blue-600 hover:underline disabled:opacity-40"
              >
                {saving ? "保存中…" : "そのまま保存"}
              </button>
            </span>
            <textarea
              value={longText}
              onChange={(e) => setLongText(e.target.value)}
              rows={10}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px] leading-relaxed"
              placeholder="技術の本質・市場・差別化・ビジネスモデルなど、深めの説明をここに。つくよみが追記をマージする時のベースとして使われます。"
            />
          </label>

          <div className="border-t border-[#e5e5e7] pt-3 flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              ✨ 追記したい内容 (つくよみが既存にマージ)
            </span>
            <textarea
              value={addition}
              onChange={(e) => setAddition(e.target.value)}
              rows={4}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
              placeholder="例: 最近 NEDO の助成金が決まり、量産工程の開発が前倒しできる見込み。NIMS との共同研究契約は 2026-09 から。"
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={onMerge}
                disabled={merging || !addition.trim()}
                className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
              >
                {merging ? "つくよみが書いてます…" : "✨ つくよみがマージ"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              つくよみ (Claude Sonnet) が既存の詳細概要を読んで、追記内容を破綻なく統合します。
              重複は除き、矛盾があれば新情報を優先。short_description (1 行サマリ) も必要に応じて更新します。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
