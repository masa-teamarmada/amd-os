// 技術台帳（project_tech_topics / project_tech_entries）の表示専用ブロック。
// PJコックピット・ワークスペースの技術／競合比較／ビジネスモデルタブ（CockpitTechnology）と、
// DDパッケージの公開版（DdTechTopicView）が同じ見た目で描くために切り出した（2026-09-30）。
// 状態も取得も持たない。DD には出典の社内参照（source_ref / source_url）を空にした行だけを渡す。

import {
  CONFIDENCE_LABEL,
  RATING_FULL_LABEL,
  RATING_LABEL,
  SOURCE_KIND_LABEL,
  formatTechValue,
  matrixColumns,
  matrixRows,
  type TechConfidence,
  type TechEntry,
  type TechPresentation,
  type TechRating,
  type TechSourceKind,
} from "@/lib/project-tech";

export const CONFIDENCE_STYLE: Record<TechConfidence, string> = {
  high: "text-[#1b5e20]",
  medium: "text-[#6e6e73]",
  low: "text-[#8d6e00]",
  unverified: "text-[#b71c1c]",
};

export const RATING_STYLE: Record<TechRating, string> = {
  excellent: "text-[#1b5e20]",
  good: "text-[#2e7d32]",
  fair: "text-[#8d6e00]",
  poor: "text-[#b71c1c]",
  na: "text-[#c7c7cc]",
  unknown: "text-[#86868b]",
};

export const RATINGS: TechRating[] = ["excellent", "good", "fair", "poor", "na", "unknown"];
/** 星取り表の最小幅 = 比較軸の列 + 相手の列の数 × 1列の幅 (最小520px)。スマホでは横スクロールになる。 */
export const MATRIX_AXIS_COL_PX = 128;
export const MATRIX_COL_PX = 96;
/**
 * 社外に出す形の星取り表は、PDF と同じく相手の列を一度に見せたいので列を細くする。
 * トピック一覧が左にある xl 以上なら、窓の幅 1300px 前後でも 9列 (自社＋8社) が横スクロールなしに収まる幅 (104 + 9 × 68 = 716px)。
 * 広い画面では列が等分に広がる (table-fixed)。
 */
export const SHEET_AXIS_COL_PX = 104;
export const SHEET_COL_PX = 68;

/** 要確認の理由。値の下に赤字で出し、何を確かめるのかを本文を読まずに分かるようにする。 */
export function CheckNote({ reason }: { reason: string | null }) {
  return (
    <div className="mt-0.5 text-[11px] leading-4 text-[#b71c1c]">⚠ 要確認{reason ? `: ${reason}` : ""}</div>
  );
}

/** 出典を1行で。根拠のない数値を作らないための表示 (出典が無ければ「出典なし」と赤で出す)。 */
export function SourceCell({
  sourceKind,
  sourceRef,
  sourceUrl,
}: {
  sourceKind: TechSourceKind;
  sourceRef: string | null;
  sourceUrl: string | null;
}) {
  const label = SOURCE_KIND_LABEL[sourceKind] ?? sourceKind;
  const body = sourceRef ? `${label}: ${sourceRef}` : label;
  if (sourceUrl) {
    return (
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-[#007aff] underline hover:opacity-80">
        {body}
      </a>
    );
  }
  return <span>{body}</span>;
}

/* ------------------------------------------------------------------ *
 * ブロック本体
 * ------------------------------------------------------------------ */

/** 成立条件 — 項目 × 値 × 条件 × 確度 × 出典。「どの範囲なら使えるか」を1枚で読む。 */
export function ConditionBlock({ entries }: { entries: TechEntry[] }) {
  if (entries.length === 0) return <EmptyRows hint="項目・下限・上限・単位・条件を1行ずつ足す" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">項目</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">値</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">条件</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">時点</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">確度</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">出典</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.tech_entry_id} className={`align-top ${e.needs_check ? "bg-[#fffaf0] hover:bg-[#fff5e6]" : "hover:bg-[#fafafa]"}`}>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">
                {e.needs_check && <span className="mr-1 text-[#b71c1c]">⚠</span>}
                {e.row_label}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">
                {formatTechValue(e)}
                {e.note && <div className="mt-0.5 text-[11px] leading-4 text-[#86868b]">{e.note}</div>}
                {e.needs_check && <CheckNote reason={e.check_reason} />}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">{e.condition_text || "—"}</td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#6e6e73]">{e.observed_on || "—"}</td>
              <td className={`border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap ${CONFIDENCE_STYLE[e.confidence]}`}>
                {CONFIDENCE_LABEL[e.confidence]}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                <SourceCell sourceKind={e.source_kind} sourceRef={e.source_ref} sourceUrl={e.source_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 星取り表 — 比較軸 × 相手。セルは記号 + 実数値で、根拠はホバーで出す。 */
export function MatrixBlock({ entries }: { entries: TechEntry[] }) {
  const cols = matrixColumns(entries);
  const rows = matrixRows(entries);
  if (cols.length === 0 || rows.length === 0) {
    return <EmptyRows hint="比較軸 (行) と相手 (列) を決めて、1マスずつ足す" />;
  }
  const cell = (row: string, col: string) => entries.find((e) => e.row_label === row && e.col_label === col);
  // 相手が多い表 (SXの競合比較は8列) をスマホ幅で押しつぶさないよう、列の数から表の最小幅を決めて横スクロールで読ませる。
  const minWidth = Math.max(520, MATRIX_AXIS_COL_PX + cols.length * MATRIX_COL_PX);
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-auto max-w-full border-collapse text-[12px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="sticky left-0 top-0 z-30 border-b border-r border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1.5 font-medium">
              比較軸
            </th>
            {cols.map((c) => (
              <th key={c} className="sticky top-0 z-20 border-b border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1.5 text-center font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="group hover:bg-[#fafafa]">
              <th className="sticky left-0 z-10 border-b border-r border-[#f0f0f2] bg-white px-2 py-1.5 text-left align-top font-medium text-[#1d1d1f] group-hover:bg-[#fafafa]">
                {r}
              </th>
              {cols.map((c) => {
                const e = cell(r, c);
                if (!e) {
                  return (
                    <td key={c} className="border-b border-[#f0f0f2] px-2 py-1.5 text-center text-[#c7c7cc]">
                      —
                    </td>
                  );
                }
                // 記号を持たないセル (条文の要件を並べる表など) は記号を出さず値だけを出す。
                // 「調べていない」は rating='unknown' を明示して入れる (null を「?」扱いしない)。
                const rating = e.rating;
                const tip = [
                  rating ? RATING_FULL_LABEL[rating] : "",
                  e.note || "",
                  e.source_ref ? `出典: ${SOURCE_KIND_LABEL[e.source_kind]} ${e.source_ref}` : SOURCE_KIND_LABEL[e.source_kind],
                ]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <td
                    key={c}
                    className={`border-b border-[#f0f0f2] px-2 py-1.5 align-top ${rating ? "text-center" : "text-left"}`}
                    title={tip}
                  >
                    {rating && <div className={`text-[15px] font-semibold leading-5 ${RATING_STYLE[rating]}`}>{RATING_LABEL[rating]}</div>}
                    {(e.value_text || e.value_min !== null || e.value_max !== null) && (
                      <div className={`${rating ? "mt-0.5" : ""} text-[11px] leading-4 tabular-nums text-[#1d1d1f]`}>{formatTechValue(e)}</div>
                    )}
                    {e.note && <div className="mt-0.5 text-[10px] leading-4 text-[#86868b]">{e.note}</div>}
                    {e.needs_check && <CheckNote reason={e.check_reason} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[#86868b]">
        {RATINGS.filter((r) => r !== "unknown" && r !== "na")
          .map((r) => RATING_FULL_LABEL[r])
          .join(" ／ ")}
        。マスにマウスを乗せると根拠が出る。
      </p>
    </div>
  );
}

/** 社外に出す形の星取り表の記号の色。OS の色の決まり (spec 2-7) に合わせ、◎○ は sky、△ は注意色、× は赤、—と? は灰。 */
export const SHEET_RATING_STYLE: Record<TechRating, string> = {
  excellent: "text-[#0267b2]",
  good: "text-[#027FDC]",
  fair: "text-[#d97706]",
  poor: "text-[#b71c1c]",
  na: "text-[#aeaeb2]",
  unknown: "text-[#aeaeb2]",
};

/**
 * 社外に出す資料 (VC 提出用の PDF) と同じ形の星取り表。トピックが presentation を持つときだけ使う。
 * 2026-09-14 まさ「PDFの比較表めっちゃよく出来てるから、この３つそのままOSにも入れておいてほしい」。
 * 並びは PDF と同じ (見出し → 表の上の一文 → 説明 → 表 → 注記) で、自社の列と強調する行に色を付ける。
 * 色は OS の決まり (sky と白・灰) を使い、PJ のブランドの色は画面に持ち込まない (PDF だけが SolvioraX の色)。
 */
export function MatrixSheet({ entries, presentation }: { entries: TechEntry[]; presentation: TechPresentation }) {
  const cols = matrixColumns(entries);
  const rows = matrixRows(entries);
  const selfCol = presentation.selfCol && cols.includes(presentation.selfCol) ? presentation.selfCol : null;
  const highlight = new Set(presentation.highlightRows);
  const cell = (row: string, col: string) => entries.find((e) => e.row_label === row && e.col_label === col);
  const minWidth = Math.max(520, SHEET_AXIS_COL_PX + cols.length * SHEET_COL_PX);
  return (
    <div data-testid="tech-matrix-sheet" className="rounded-lg border border-[#e5e5e7] bg-white px-4 py-4">
      {presentation.heading && (
        <div className="mb-2">
          <p className="text-[18px] font-bold leading-6 text-[#0267b2]">{presentation.heading}</p>
          <div aria-hidden className="mt-1.5 h-[3px] w-10 rounded-full bg-[#027FDC]" />
        </div>
      )}
      {presentation.eyecatch && <p className="text-[15px] font-bold leading-6 text-[#1d1d1f]">{presentation.eyecatch}</p>}
      {presentation.lead && <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{presentation.lead}</p>}
      {cols.length === 0 || rows.length === 0 ? (
        <div className="mt-3">
          <EmptyRows hint="比較軸 (行) と相手 (列) を決めて、1マスずつ足す" />
        </div>
      ) : (
        // PDF と同じく表は1枚で全行を見せる (表の中で縦にスクロールさせない)。狭い画面だけ表の中で横にスクロールする。
        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[12px]" style={{ minWidth }}>
            <colgroup>
              <col style={{ width: SHEET_AXIS_COL_PX }} />
              {cols.map((c) => (
                <col key={c} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 border border-[#e5e5e7] bg-[#f5f5f7] px-2 py-2 text-left text-[11px] font-medium text-[#6e6e73]">
                  比較軸
                </th>
                {cols.map((c) => (
                  <th
                    key={c}
                    className={`border px-1 py-2 text-center text-[11.5px] font-semibold leading-4 ${
                      c === selfCol ? "border-[#027FDC] bg-[#027FDC] text-white" : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f]"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const emphasized = highlight.has(r);
                return (
                  <tr key={r}>
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 border border-[#e5e5e7] px-2 py-2 text-left align-top text-[11.5px] font-semibold leading-5 text-[#1d1d1f] ${
                        emphasized ? "bg-[#e8f3fc] shadow-[inset_4px_0_0_#027FDC]" : "bg-[#fafafa]"
                      }`}
                    >
                      {r}
                    </th>
                    {cols.map((c) => {
                      const e = cell(r, c);
                      const tone =
                        c === selfCol ? (emphasized ? "bg-[#d9ebfa]" : "bg-[#f2f8fd]") : emphasized ? "bg-[#f7fbfe]" : "bg-white";
                      if (!e) return <td key={c} className={`border border-[#e5e5e7] ${tone}`} />;
                      const rating = e.rating;
                      const tip = [
                        rating ? RATING_FULL_LABEL[rating] : "",
                        e.note || "",
                        e.source_ref ? `出典: ${SOURCE_KIND_LABEL[e.source_kind]} ${e.source_ref}` : SOURCE_KIND_LABEL[e.source_kind],
                      ]
                        .filter(Boolean)
                        .join(" / ");
                      return (
                        <td
                          key={c}
                          title={tip}
                          className={`border border-[#e5e5e7] px-1 py-2 align-top ${rating ? "text-center" : "text-left"} ${tone}`}
                        >
                          {rating && (
                            <div className={`text-[17px] font-bold leading-6 ${SHEET_RATING_STYLE[rating]}`}>{RATING_LABEL[rating]}</div>
                          )}
                          {(e.value_text || e.value_min !== null || e.value_max !== null) && (
                            <div className="text-[11.5px] font-medium leading-4 text-[#1d1d1f]">{formatTechValue(e)}</div>
                          )}
                          {e.note && <div className="mt-1 text-[10px] leading-[14px] text-[#6e6e73]">{e.note}</div>}
                          {e.needs_check && <CheckNote reason={e.check_reason} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {presentation.note && <p className="mt-2 text-[11px] leading-5 text-[#6e6e73]">{presentation.note}</p>}
    </div>
  );
}

/** 到達実績 — 何を、いつ、どこまで。同じ項目が複数あれば古い順に並べて推移として読む。 */
export function RecordBlock({ entries }: { entries: TechEntry[] }) {
  if (entries.length === 0) return <EmptyRows hint="測る対象・到達値・測定日・出典を1行ずつ足す" />;
  const grouped = new Map<string, TechEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.row_label) ?? [];
    list.push(e);
    grouped.set(e.row_label, list);
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">測る対象</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">到達値</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">測定日</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">条件・備考</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">出典</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([label, list]) => {
            const sorted = [...list].sort((a, b) => (a.observed_on || "").localeCompare(b.observed_on || ""));
            return sorted.map((e, i) => (
              <tr key={e.tech_entry_id} className={`align-top ${e.needs_check ? "bg-[#fffaf0] hover:bg-[#fff5e6]" : "hover:bg-[#fafafa]"}`}>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">
                  {e.needs_check && <span className="mr-1 text-[#b71c1c]">⚠</span>}
                  {i === 0 ? label : <span className="text-[#c7c7cc]">〃</span>}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">
                  {formatTechValue(e)}
                  {e.needs_check && <CheckNote reason={e.check_reason} />}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#6e6e73]">{e.observed_on || "—"}</td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                  {[e.condition_text, e.note].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                  <SourceCell sourceKind={e.source_kind} sourceRef={e.source_ref} sourceUrl={e.source_url} />
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyRows({ hint }: { hint: string }) {
  return <p className="rounded-lg border border-dashed border-[#d2d2d7] px-3 py-2 text-[11px] text-[#86868b]">{hint}</p>;
}
