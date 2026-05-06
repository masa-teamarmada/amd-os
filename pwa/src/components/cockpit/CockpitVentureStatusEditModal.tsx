"use client";

/**
 * CockpitVentureStatus 用イベント編集モーダル。
 *
 * - 既存 event の更新 / 削除
 * - 新規 event 追加 (グラフ空白 tap 由来)
 *
 * フィールド: occurred_on (date), kind, label, meta (jsonb 自由入力)
 */

import { useEffect, useState } from "react";
import {
  insertProjectEvent,
  updateProjectEvent,
  deleteProjectEvent,
  parseEventTextWithLLM,
  type ProjectEventRow,
  type ProjectEventKind,
} from "@/lib/venture-status-data";
import { MentionTextarea } from "./MentionTextarea";

const KIND_OPTIONS: { value: ProjectEventKind; label: string; placeholder: string }[] = [
  { value: "hire", label: "人事", placeholder: "例: @まさ がCEOから降任、@きよ がCFOに就任 / 山田太郎が CTO として入社、報酬は月 80 万円 + ストックオプション" },
  { value: "funding", label: "資金調達", placeholder: "例: シードラウンドで Build VC からリード 3000 万円、エンジェル 2 名で 500 万円、合計 3500 万円調達" },
  { value: "deal", label: "事業契約", placeholder: "例: 大学発ベンチャー A 社と PoC 契約 (期間 6 ヶ月、金額 200 万円)" },
  { value: "tech_progress", label: "技術進捗", placeholder: "例: 試作 3 号機が稼働、収率 85% で安定。TRL 4→5 相当の進展" },
  { value: "governance", label: "ガバナンス", placeholder: "例: 取締役会で資金調達方針を決議、まさが議長、決議事項 3 件すべて承認" },
  { value: "xrl_obs", label: "XRL 観測", placeholder: "例: ラボでの試作機が稼働、TRL 4 相当。ボトルネックは収率の安定化" },
  { value: "amd_score_override", label: "AMD スコア手動補正", placeholder: "例: 大型契約で勢いつき、+10 加点したい" },
  { value: "note", label: "メモ", placeholder: "PJ にまつわる出来事を自由に。LLM が文章から構造化する想定。" },
];

interface Props {
  projectId: string;
  editing: ProjectEventRow | null;
  initialDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}

/** 既存 event の meta から自由文を取り出す (raw_text 優先、なければ JSON 文字列で fallback) */
function metaToFreeText(meta: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  if (typeof meta.raw_text === "string") return meta.raw_text;
  if (typeof (meta as { _raw?: unknown })._raw === "string") return (meta as { _raw: string })._raw;
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return "";
  }
}

export function CockpitVentureStatusEditModal({
  projectId,
  editing,
  initialDate,
  onClose,
  onSaved,
}: Props) {
  const [date, setDate] = useState<string>(editing?.occurred_on || initialDate || "");
  const [kind, setKind] = useState<ProjectEventKind>(editing?.kind || "note");
  const [label, setLabel] = useState<string>(editing?.label || "");
  const [rawText, setRawText] = useState<string>(metaToFreeText(editing?.meta || {}));
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(editing?.occurred_on || initialDate || "");
    setKind(editing?.kind || "note");
    setLabel(editing?.label || "");
    setRawText(metaToFreeText(editing?.meta || {}));
    setParsedPreview(null);
  }, [editing, initialDate]);

  const onPreviewParse = async () => {
    if (!rawText.trim()) {
      setParsedPreview(null);
      return;
    }
    setParsing(true);
    const parsed = await parseEventTextWithLLM({ kind, label, raw_text: rawText.trim() });
    setParsing(false);
    if (parsed) setParsedPreview(parsed);
  };

  const placeholder = KIND_OPTIONS.find((o) => o.value === kind)?.placeholder ?? "";

  const onSave = async () => {
    if (!date || !label.trim()) {
      setError("日付とラベルは必須");
      return;
    }
    setSaving(true);
    setError(null);
    const trimmed = rawText.trim();
    // meta は parsedPreview があればそれ + raw_text、なければ raw_text のみ。
    // (パースしてないときも保存後に裏で parse できる設計)
    const meta: Record<string, unknown> = trimmed ? { raw_text: trimmed } : {};
    if (parsedPreview) Object.assign(meta, parsedPreview);

    if (editing) {
      const r = await updateProjectEvent(editing.id, { occurred_on: date, kind, label, meta });
      if (!r) {
        setError("更新に失敗");
        setSaving(false);
        return;
      }
    } else {
      const r = await insertProjectEvent(projectId, { occurred_on: date, kind, label, meta });
      if (!r) {
        setError("追加に失敗");
        setSaving(false);
        return;
      }
    }

    // 新規 / プレビューしてない更新 → 裏で LLM パースして meta を充実させる (失敗してもエラー出さない)
    if (trimmed && !parsedPreview) {
      parseEventTextWithLLM({ kind, label, raw_text: trimmed }).then(async (parsed) => {
        if (!parsed || !editing) return;
        const newMeta = { raw_text: trimmed, ...parsed };
        await updateProjectEvent(editing.id, { meta: newMeta });
      });
    }
    onSaved();
    setSaving(false);
  };

  const onDelete = async () => {
    if (!editing) return;
    if (!confirm("このイベントを削除しますか?")) return;
    setSaving(true);
    const ok = await deleteProjectEvent(editing.id);
    if (!ok) {
      setError("削除に失敗");
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">{editing ? "イベント編集" : "イベント追加"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">日付</span>
            <input
              type="date"
              value={date.slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">種別</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProjectEventKind)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">ラベル (1 行サマリ)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: シードラウンド ¥30M クローズ / 山田 (CTO) 入社 / 大学契約締結"
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground flex items-center justify-between">
              <span>詳細 (自由文)</span>
              <button
                onClick={onPreviewParse}
                disabled={parsing || !rawText.trim()}
                type="button"
                className="text-[10px] text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {parsing ? "解析中…" : "✨ LLM で構造化プレビュー"}
              </button>
            </span>
            <MentionTextarea
              projectId={projectId}
              value={rawText}
              onChange={(v) => {
                setRawText(v);
                if (parsedPreview) setParsedPreview(null);
              }}
              placeholder={placeholder}
              rows={5}
              className="w-full border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[12px]"
            />
            <span className="text-[10px] text-muted-foreground">
              文章で書けば OK。保存時に Gemini が裏で構造化 (金額・人名・期間等を自動抽出) します。
            </span>
          </label>

          {parsedPreview && (
            <div className="border border-blue-100 bg-blue-50 rounded-md px-2 py-2 text-[11px] font-mono">
              <div className="text-[10px] text-blue-700 mb-1">LLM 構造化結果 (保存時に meta に格納)</div>
              <pre className="whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(parsedPreview, null, 2)}</pre>
            </div>
          )}

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-between gap-2">
          {editing ? (
            <button
              onClick={onDelete}
              disabled={saving}
              className="text-[12px] text-red-600 hover:underline disabled:opacity-50"
            >
              削除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-[12px] px-3 py-1.5 rounded-md border border-[#e5e5e7] hover:bg-[#fafafa] disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="text-[12px] px-3 py-1.5 rounded-md bg-black text-white hover:bg-[#222] disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
