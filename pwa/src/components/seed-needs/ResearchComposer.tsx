"use client";

import { useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  RESEARCH_LABEL,
  type ExplorationSelection,
  type NeedDataset,
  type NeedResearch,
  type ResearchKind,
  type SeedNeedsData,
} from "@/lib/seed-needs";
import { validateResearch } from "@/lib/seed-needs-exploration";
import base from "./seed-needs.module.css";
import styles from "./exploration.module.css";

export function ResearchComposer({
  data,
  dataset,
  selection,
  original,
  onRemove,
  onClose,
  onSaved,
  save,
}: {
  data: SeedNeedsData;
  dataset: NeedDataset;
  selection: ExplorationSelection;
  original?: NeedResearch;
  onRemove: (field: keyof ExplorationSelection, id: string) => void;
  onClose: () => void;
  onSaved: (research: NeedResearch) => void;
  save: (
    record: Omit<NeedResearch, "created_at" | "updated_at">,
    original?: NeedResearch,
  ) => Promise<NeedResearch>;
}) {
  const [id] = useState(() => original?.id ?? crypto.randomUUID());
  const [kind, setKind] = useState<ResearchKind>(
    original?.kind ??
      (selection.seed_ids.length > 1
        ? "combination"
        : selection.seed_ids.length
          ? "application"
          : "new_seed"),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const close = () => {
    if (
      !saving &&
      (!dirty ||
        window.confirm("入力中の研究仮説を閉じる？ 未保存の文章は失われる。"))
    )
      onClose();
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = validateResearch(selection, kind);
    if (invalid) {
      setError(invalid);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const field = (key: string) => String(fd.get(key) ?? "").trim();
    if (!field("title")) {
      setError("研究テーマ名を入力。");
      form.current?.querySelector<HTMLInputElement>("[name=title]")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      onSaved(
        await save(
          {
            id,
            dataset,
            kind,
            title: field("title"),
            gap: field("gap"),
            hypothesis: field("hypothesis"),
            experiment: field("experiment"),
            success_criteria: field("success_criteria"),
            next_action: field("next_action"),
            ...selection,
          },
          original,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setSaving(false);
    }
  }
  const groups = [
    { field: "market_ids" as const, label: "市場", items: data.markets },
    {
      field: "company_ids" as const,
      label: "企業ニーズ",
      items: data.companies,
    },
    { field: "seed_ids" as const, label: "シーズ", items: data.seeds },
  ];
  return (
    <aside className={styles.composer} aria-label="研究仮説の編集">
      <form ref={form} onSubmit={submit} onChange={() => setDirty(true)}>
        <header>
          <div>
            <h2>{original ? "研究仮説を編集" : "研究仮説を組み立てる"}</h2>
            <p>図のチェックで構成要素を追加できる</p>
          </div>
          <button
            type="button"
            className={base.iconButton}
            aria-label="研究仮説の編集を閉じる"
            onClick={close}
            disabled={saving}
          >
            <X size={16} />
          </button>
        </header>
        <fieldset disabled={saving}>
          <div className={styles.ingredients}>
            {groups.map((g) => (
              <div key={g.field}>
                <span>
                  {g.label} {selection[g.field].length}
                </span>
                <div>
                  {selection[g.field].map((id) => (
                    <button
                      key={id}
                      type="button"
                      title={g.items.find((x) => x.id === id)?.title}
                      onClick={() => {
                        setDirty(true);
                        onRemove(g.field, id);
                      }}
                      aria-label={`${g.items.find((x) => x.id === id)?.title}を構想から外す`}
                    >
                      {g.items.find((x) => x.id === id)?.title || "参照を確認"}{" "}
                      <X size={12} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!selection.seed_ids.length && (
              <p>シーズがなくても、必要な技術から構想を残せる。</p>
            )}
          </div>
          <label className={base.field}>
            <span>研究の方向</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ResearchKind)}
            >
              {Object.entries(RESEARCH_LABEL).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={base.field}>
            <span>研究テーマ名 *</span>
            <input
              name="title"
              required
              maxLength={200}
              autoFocus
              defaultValue={original?.title ?? ""}
              placeholder="どんな技術・解決方法を生み出したい？"
            />
          </label>
          {(
            [
              [
                "gap",
                "いま足りない機能・知見",
                "既存技術とニーズの間にある溝は？",
              ],
              [
                "hypothesis",
                "生み出したいシーズ・研究仮説",
                "何を組み合わせ、何を変えると届きそう？",
              ],
              [
                "experiment",
                "最初に試すこと",
                "小さく確かめる実験・ヒアリング",
              ],
              [
                "success_criteria",
                "確かめたい変化・判定基準",
                "どうなれば次へ進める？",
              ],
              ["next_action", "次の確認", "誰と何を話す？"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label className={base.field} key={key}>
              <span>{label}</span>
              <textarea
                name={key}
                rows={2}
                maxLength={5000}
                defaultValue={original?.[key] ?? ""}
                placeholder={placeholder}
              />
            </label>
          ))}
        </fieldset>
        <footer>
          {error && (
            <p className={base.error} role="alert">
              {error}
            </p>
          )}
          <small>
            {dataset === "example"
              ? "議論用の仮説として保存"
              : "未検証の研究仮説として保存"}
            。シーズ台帳への登録は別途判断。
          </small>
          <button
            type="submit"
            disabled={saving}
            className={base.primaryButton}
          >
            {saving ? "保存中…" : "研究仮説を保存"}
          </button>
        </footer>
      </form>
    </aside>
  );
}
