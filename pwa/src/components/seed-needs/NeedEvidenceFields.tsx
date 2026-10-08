"use client";

import { Plus, X } from "lucide-react";
import {
  CONFIDENCE_LABEL,
  MARKET_SCOPE_LABEL,
  SOURCE_LABEL,
  type MarketSize,
  type NeedConfidence,
  type NeedDataset,
  type NeedSource,
} from "@/lib/seed-needs";
import styles from "./seed-needs.module.css";
import list from "./market-needs.module.css";

// 会議中に根拠を照合する編集面。OSの白・slate・sky、薄い境界、4px基準、14px本文を共有する。
export function NeedSourceFields({
  sources,
  onChange,
}: {
  sources: NeedSource[];
  onChange: (sources: NeedSource[]) => void;
}) {
  const change = (id: string, patch: Partial<NeedSource>) =>
    onChange(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <section className={list.evidenceSection} aria-label="出典の編集">
      <div className={list.sectionHeading}>
        <h3>
          出典となる情報 <span>{sources.length}件</span>
        </h3>
        <button
          type="button"
          className={styles.textButton}
          onClick={() =>
            onChange([
              ...sources,
              {
                id: crypto.randomUUID(),
                kind: "primary",
                title: "",
                publisher: "",
                date: "",
                url: "",
                note: "",
              },
            ])
          }
        >
          <Plus size={14} />
          出典を追加
        </button>
      </div>
      <p className={styles.muted}>
        資料・ヒアリングごとに、何を裏付ける情報かを記録。公開URLのない情報も登録可能。
      </p>
      {sources.map((source, i) => (
        <div key={source.id} className={list.editBlock}>
          <div className={list.sectionHeading}>
            <strong>出典 {i + 1}</strong>
            <button
              type="button"
              aria-label={`出典${i + 1}を外す`}
              className={styles.iconButton}
              onClick={() =>
                onChange(sources.filter((s) => s.id !== source.id))
              }
            >
              <X size={16} />
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>資料名・ヒアリング名 *</span>
              <input
                aria-label={`出典${i + 1}の資料名`}
                value={source.title}
                required
                maxLength={300}
                onChange={(e) => change(source.id, { title: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>情報の種類</span>
              <select
                aria-label={`出典${i + 1}の種類`}
                value={source.kind}
                onChange={(e) =>
                  change(source.id, {
                    kind: e.target.value as NeedSource["kind"],
                  })
                }
              >
                {Object.entries(SOURCE_LABEL).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>発行元・確認相手</span>
              <input
                aria-label={`出典${i + 1}の発行元`}
                value={source.publisher}
                maxLength={500}
                onChange={(e) =>
                  change(source.id, { publisher: e.target.value })
                }
              />
            </label>
            <label className={styles.field}>
              <span>発行・実施日</span>
              <input
                aria-label={`出典${i + 1}の日付`}
                type="date"
                value={source.date}
                onChange={(e) => change(source.id, { date: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>出典URL</span>
              <input
                aria-label={`出典${i + 1}のURL`}
                type="url"
                value={source.url}
                maxLength={2000}
                onChange={(e) => change(source.id, { url: e.target.value })}
              />
              <small>公開URLがない場合は空欄。資料名と確認内容を記録。</small>
            </label>
            <label className={styles.field}>
              <span>何を裏付けるか・確認できた範囲 *</span>
              <textarea
                aria-label={`出典${i + 1}の根拠`}
                rows={3}
                value={source.note}
                required
                maxLength={5000}
                onChange={(e) => change(source.id, { note: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}

export function MarketAssessmentFields({
  dataset,
  sources,
  sizes,
  confidence,
  note,
  onSizes,
  onConfidence,
  onNote,
}: {
  dataset: NeedDataset;
  sources: NeedSource[];
  sizes: MarketSize[];
  confidence: NeedConfidence;
  note: string;
  onSizes: (sizes: MarketSize[]) => void;
  onConfidence: (confidence: NeedConfidence) => void;
  onNote: (note: string) => void;
}) {
  const change = (index: number, patch: Partial<MarketSize>) =>
    onSizes(sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  return (
    <>
      <section className={list.evidenceSection} aria-label="情報の確度を評価">
        <h3>ニーズ情報の確度</h3>
        <p className={styles.muted}>
          ニーズの存在・内容の裏付けを評価。出典数だけで自動判定せず、市場規模の推計とは分けて扱う。
        </p>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>確度ランク</span>
            <select
              aria-label="情報の確度"
              value={confidence}
              onChange={(e) => onConfidence(e.target.value as NeedConfidence)}
            >
              {Object.entries(CONFIDENCE_LABEL).map(([key, value]) => (
                <option
                  key={key}
                  value={key}
                  disabled={dataset === "example" && ["a", "b"].includes(key)}
                >
                  {value}
                </option>
              ))}
            </select>
            <small>
              A：直接確認・一次資料で裏付け。B：間接情報に基づく。C：推測・仮説が中心。記入例はCまたは未評価。
            </small>
          </label>
          <label className={styles.field}>
            <span>
              評価理由・残る不確かさ{confidence !== "unassessed" && " *"}
            </span>
            <textarea
              aria-label="確度の評価理由"
              value={note}
              required={confidence !== "unassessed"}
              rows={3}
              maxLength={5000}
              onChange={(e) => onNote(e.target.value)}
            />
          </label>
        </div>
      </section>
      <section className={list.evidenceSection} aria-label="市場規模の推計">
        <div className={list.sectionHeading}>
          <h3>このニーズが生む年間市場規模</h3>
          <button
            type="button"
            className={styles.textButton}
            onClick={() =>
              onSizes([
                ...sizes,
                {
                  scope: "japan",
                  year: new Date().getFullYear(),
                  min_oku: NaN,
                  max_oku: NaN,
                  definition: "",
                  basis: "",
                  source_id: "",
                },
              ])
            }
          >
            <Plus size={14} />
            推計を追加
          </button>
        </div>
        <p className={styles.muted}>
          対象となる製品・サービスの年間市場を億円で記録。業界全体の規模と混同せず、推計の範囲と計算方法を残す。外貨を換算した場合は為替条件も記入。
        </p>
        {sizes.map((size, i) => (
          <div key={i} className={list.editBlock}>
            <div className={list.sectionHeading}>
              <strong>市場規模 {i + 1}</strong>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`市場規模${i + 1}を外す`}
                onClick={() => onSizes(sizes.filter((_, index) => index !== i))}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>対象地域</span>
                <select
                  aria-label={`市場規模${i + 1}の地域`}
                  value={size.scope}
                  onChange={(e) =>
                    change(i, { scope: e.target.value as MarketSize["scope"] })
                  }
                >
                  {Object.entries(MARKET_SCOPE_LABEL).map(([key, value]) => (
                    <option value={key} key={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>対象年 *</span>
                <input
                  aria-label={`市場規模${i + 1}の年`}
                  type="number"
                  min={2000}
                  max={2100}
                  step={1}
                  required
                  value={Number.isFinite(size.year) ? size.year : ""}
                  onChange={(e) =>
                    change(i, {
                      year:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>下限・単一推計額（億円/年） *</span>
                <input
                  aria-label={`市場規模${i + 1}の下限`}
                  type="number"
                  min={0}
                  max={100000000}
                  step="any"
                  required
                  value={Number.isFinite(size.min_oku) ? size.min_oku : ""}
                  onChange={(e) =>
                    change(i, {
                      min_oku:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>上限（億円/年）</span>
                <input
                  aria-label={`市場規模${i + 1}の上限`}
                  type="number"
                  min={0}
                  max={100000000}
                  step="any"
                  value={Number.isFinite(size.max_oku) ? size.max_oku : ""}
                  onChange={(e) =>
                    change(i, {
                      max_oku:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
                <small>幅を持たせない場合は空欄で下限と同額。</small>
              </label>
              <label className={styles.field}>
                <span>市場の対象範囲 *</span>
                <textarea
                  aria-label={`市場規模${i + 1}の対象範囲`}
                  rows={2}
                  value={size.definition}
                  required
                  maxLength={2000}
                  onChange={(e) => change(i, { definition: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>根拠となる出典 *</span>
                <select
                  aria-label={`市場規模${i + 1}の出典`}
                  value={size.source_id}
                  required
                  onChange={(e) => change(i, { source_id: e.target.value })}
                >
                  <option value="">出典を選択</option>
                  {sources.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.title || "資料名未記入"}
                    </option>
                  ))}
                </select>
                <small>上の「出典となる情報」に登録した資料から選択。</small>
              </label>
            </div>
            <label className={styles.field}>
              <span>算定方法・前提・推計の不確かさ *</span>
              <textarea
                aria-label={`市場規模${i + 1}の算定根拠`}
                rows={3}
                required
                value={size.basis}
                maxLength={5000}
                onChange={(e) => change(i, { basis: e.target.value })}
              />
            </label>
          </div>
        ))}
      </section>
    </>
  );
}
