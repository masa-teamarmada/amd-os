"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { saveMarketSeedLink } from "@/lib/seed-needs-data";
import type { MarketNeed, MarketSeedLink, NeedSeed } from "@/lib/seed-needs";
import styles from "./seed-needs.module.css";

// 市場から候補を直接追加。既存の編集dialogの寸法・書体・色・余白を揃える。
export function MarketSeedEditor({
  market,
  seeds,
  original,
  onClose,
  onSaved,
}: {
  market: MarketNeed;
  seeds: NeedSeed[];
  original?: MarketSeedLink;
  onClose: () => void;
  onSaved: (link: MarketSeedLink) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [seedId, setSeedId] = useState(original?.seed_id ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const close = () => {
    if (!saving && (!dirty || window.confirm("保存していない変更を破棄する？")))
      onClose();
  };
  const options = seeds.filter(
    (s) =>
      s.id === seedId ||
      `${s.title} ${s.org_name} ${s.researcher_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      onSaved(
        await saveMarketSeedLink(
          {
            dataset: market.dataset,
            market_need_id: market.id,
            seed_id: seedId,
            rationale: String(fd.get("rationale") ?? "").trim(),
            gap: String(fd.get("gap") ?? "").trim(),
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
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="market-seed-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit} onChange={() => setDirty(true)}>
        <div className={styles.dialogHeader}>
          <div>
            <h2 id="market-seed-title">
              関連シーズのリンクを{original ? "編集" : "追加"}
            </h2>
            <p>{market.title}｜技術が適合するかは別途確認。</p>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            disabled={saving}
            onClick={close}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <fieldset className={styles.formBody} disabled={saving}>
          <label className={styles.field}>
            <span>シーズを検索</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="技術名・研究機関・研究者"
            />
          </label>
          <label className={styles.field}>
            <span>関連するシーズ *</span>
            <select
              value={seedId}
              required
              onChange={(e) => setSeedId(e.target.value)}
            >
              <option value="">{options.length}件から選択</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}｜{s.org_name}・{s.researcher_name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>このニーズに関連する理由 *</span>
            <textarea
              name="rationale"
              required
              maxLength={5000}
              rows={3}
              defaultValue={original?.rationale}
            />
          </label>
          <label className={styles.field}>
            <span>不足していること・確かめたいこと</span>
            <textarea
              name="gap"
              maxLength={5000}
              rows={3}
              defaultValue={original?.gap}
            />
          </label>
        </fieldset>
        <div className={styles.dialogFooter}>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={close}
            disabled={saving}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={saving}
          >
            {saving ? "保存中…" : "リンクを保存"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
