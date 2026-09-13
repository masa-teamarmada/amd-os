"use client";

import { useState, type ReactNode } from "react";
import {
  APPLICATION_LABEL,
  CONFIDENCE_LABEL,
  STRAIN_LABEL,
  type CostApplication,
  type CostBreakdownKey,
  type CostStrain,
} from "@/lib/project-cost-model";

// コスト試算タブの小さな部品。操作パネル・結果・読み物の3か所から使う。

/**
 * 内訳の区分の色。積み上げ棒の並び (BREAKDOWN_ORDER) と同じ順で、隣り合う色が色覚の違いでも見分けられることを検査済み
 * (dataviz validate_palette、白地・隣接ペア)。赤字の rose・目標超の amber・emerald とは別の色にしている。
 * 黄とピンクは白地で薄いので、色だけで区分を伝えず、必ず区分名を並べて出す。
 */
export const CATEGORY_COLOR: Record<CostBreakdownKey, string> = {
  biomass: "#2a78d6",
  transport: "#eb6834",
  labor: "#4a3aa7",
  postProcess: "#e87ba4",
  consumables: "#eda100",
  capex: "#16a3b8",
};

/** 凡例と狭い欄で使う区分の短い呼び名。 */
export const CATEGORY_SHORT_LABEL: Record<CostBreakdownKey, string> = {
  biomass: "菌体費",
  transport: "運ぶ",
  labor: "作業",
  postProcess: "後処理",
  consumables: "消耗品など",
  capex: "償却",
};

export function Swatch({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${className}`} style={{ backgroundColor: color }} />;
}

export const num = (v: number, digits = 1) =>
  v.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const int = (v: number) => Math.round(v).toLocaleString("ja-JP");
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
/** 差の表示。マイナスは全角でなく数学のマイナス記号にして桁を揃える。 */
export const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${num(Math.abs(v), digits)}`;
/** 円を万円で。1万円未満は円のまま。 */
export const yen = (v: number) =>
  Math.abs(v) >= 10_000 ? `${(v / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円` : `${int(v)}円`;

/** 保存値からの差。差が無ければ何も出さない。色は付けない（試算の増減は良し悪しの判定ではない）。 */
export function Delta({ value, digits = 1, className = "" }: { value: number; digits?: number; className?: string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.5 * 10 ** -digits) return null;
  return (
    <span className={`whitespace-nowrap tabular-nums text-[#3c3c43] ${className}`} title="保存値からの差">
      {value > 0 ? "↑" : "↓"}
      {signed(value, digits)}
    </span>
  );
}

const CONFIDENCE_STYLE: Record<string, string> = {
  S: "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]",
  A: "bg-[#f0f9ff] text-[#0267b2] border-[#bae6fd]",
  B: "bg-[#f0f9ff] text-[#0369a1] border-[#e0f2fe]",
  C: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
  H: "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]",
  未設定: "bg-[#f2f2f4] text-[#6e6e73] border-[#d2d2d7]",
};

export function ConfidenceTag({ value }: { value: string | null }) {
  if (!value) return null;
  const cls = CONFIDENCE_STYLE[value];
  if (!cls) return null;
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-[1px] text-[10px] font-semibold ${cls}`}>
      {CONFIDENCE_LABEL[value] ?? value}
    </span>
  );
}

export function ScopeTag({ strain, application }: { strain: CostStrain | null; application: CostApplication | null }) {
  const parts = [strain ? `${STRAIN_LABEL[strain]}のみ` : null, application ? `${APPLICATION_LABEL[application]}のみ` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span className="ml-1 inline-flex shrink-0 items-center whitespace-nowrap rounded border border-[#d2d2d7] bg-[#f5f5f7] px-1.5 py-[1px] align-middle text-[10px] font-semibold text-[#3c3c43]">
      {parts.join("・")}
    </span>
  );
}

export function Card({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{title}</h3>
      {hint && <p className="mt-1 text-[11px] leading-5 text-[#6e6e73]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  ariaLabel,
  label,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {label && <span className="w-7 shrink-0 text-[11px] font-semibold text-[#3c3c43] xl:w-auto">{label}</span>}
      <div role="group" aria-label={ariaLabel} className="inline-flex min-w-0 flex-1 rounded-lg border border-[#d2d2d7] bg-white p-0.5 xl:flex-none">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`min-h-[40px] flex-1 whitespace-nowrap rounded-md px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cbceb] xl:min-h-[30px] xl:flex-none ${
                active ? "bg-[#027fdc] text-white" : "text-[#3c3c43] hover:bg-[#e8f3fc]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 1e6) / 1e6);
}

/**
 * 試算の数字の入力欄。打った瞬間に数字として読めれば onChange を呼ぶ（その場で再計算される）。
 * 保存値と違うときは枠を AMD Blue にし、「戻す」を出す。保存はしない。
 */
export function NumberField({
  value,
  baseline,
  onChange,
  allowNull = false,
  min,
  max,
  placeholder,
  ariaLabel,
  disabled = false,
  widthClass = "w-24",
  compact = false,
  wrapperClass = "inline-flex items-center gap-1",
}: {
  value: number | null;
  baseline: number | null;
  onChange: (value: number | null) => void;
  allowNull?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  widthClass?: string;
  /** 表の狭い欄では「戻す」を横に出さない（上の「保存していない変更」から戻せる）。 */
  compact?: boolean;
  /** 入力欄を包む要素の class。スマホ幅で欄いっぱいに広げるときに使う。 */
  wrapperClass?: string;
}) {
  const [text, setText] = useState(formatInput(value));
  // 下書きの取り消しや保存値の読み直しで値が変わったら、入力欄を追従させる（レンダー中の調整）。
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    const parsed = text.trim() === "" ? null : Number(text.replace(/,/g, ""));
    if (parsed !== value) setText(formatInput(value));
  }
  const changed = value !== baseline;

  const commit = (raw: string) => {
    const t = raw.replace(/,/g, "").trim();
    if (t === "") {
      if (allowNull) onChange(null);
      return;
    }
    const v = Number(t);
    if (!Number.isFinite(v)) return;
    if (min !== undefined && v < min) return;
    if (max !== undefined && v > max) return;
    onChange(v);
  };

  return (
    <span className={wrapperClass}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        title={changed ? `保存値: ${baseline === null ? "空欄" : baseline.toLocaleString("ja-JP")}` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(formatInput(value))}
        className={`${widthClass} min-h-[44px] rounded-md border px-2 text-right text-[16px] font-semibold tabular-nums text-[#1d1d1f] placeholder:font-normal placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#7cbceb] disabled:bg-[#f5f5f7] disabled:text-[#86868b] xl:h-7 xl:min-h-0 xl:text-[12px] ${
          changed ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
        }`}
      />
      {changed && !compact && (
        <button
          type="button"
          onClick={() => onChange(baseline)}
          className="min-h-[44px] rounded px-1 text-[11px] font-semibold text-[#0267b2] hover:underline xl:min-h-0"
          title={`保存値 ${baseline === null ? "空欄" : baseline.toLocaleString("ja-JP")} に戻す`}
        >
          戻す
        </button>
      )}
    </span>
  );
}

/**
 * 箇条書き・番号付きリスト・表・**強調** だけの軽量レンダラ。
 * 説明文のためだけに markdown ライブラリを足さない。
 */
export function MiniMarkdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-[#1d1d1f]">{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const cells = (row: string) =>
    row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  return (
    <div className="flex flex-col gap-2.5">
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        // markdown 表: 2行目が |---|---| の区切り行
        if (lines.length >= 2 && lines[0].trim().startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[1].trim())) {
          const head = cells(lines[0]);
          const body = lines.slice(2).map(cells);
          return (
            <div key={bi} className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[320px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#d2d2d7] text-left text-[10px] text-[#6e6e73]">
                    {head.map((h, i) => (
                      <th key={i} className={`px-2 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>{inline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {body.map((row, ri) => (
                    <tr key={ri} className="border-b border-[#eaeaec]">
                      {row.map((c, ci) => (
                        <td key={ci} className={`px-2 py-1.5 text-[#1d1d1f] ${ci > 0 ? "text-right" : ""}`}>{inline(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 番号付きリスト。"1. 〜" が並ぶブロックを ol として描く。
        const firstNumbered = lines.findIndex((l) => /^\s*\d+\.\s/.test(l));
        if (firstNumbered >= 0 && lines.slice(firstNumbered).every((l) => /^\s*\d+\.\s/.test(l))) {
          const lead = lines.slice(0, firstNumbered);
          const numbered = lines.slice(firstNumbered);
          return (
            <div key={bi} className="flex flex-col gap-1">
              {lead.map((l, li) => (
                <p key={li} className="text-[12px] leading-6 text-[#3c3c43]">{inline(l)}</p>
              ))}
              <ol className="ml-5 list-decimal space-y-1">
                {numbered.map((l, li) => (
                  <li key={li} className="text-[12px] leading-6 text-[#3c3c43]">
                    {inline(l.replace(/^\s*\d+\.\s/, ""))}
                  </li>
                ))}
              </ol>
            </div>
          );
        }

        // 箇条書きを含むブロック。先頭に見出し的なリード行があっても拾えるようにする。
        const firstBullet = lines.findIndex((l) => l.trim().startsWith("- "));
        if (firstBullet >= 0 && lines.slice(firstBullet).every((l) => l.trim().startsWith("- "))) {
          const lead = lines.slice(0, firstBullet);
          const bullets = lines.slice(firstBullet);
          return (
            <div key={bi} className="flex flex-col gap-1">
              {lead.map((l, li) => (
                <p key={li} className="text-[12px] leading-6 text-[#3c3c43]">{inline(l)}</p>
              ))}
              <ul className="ml-4 list-disc space-y-1">
                {bullets.map((l, li) => (
                  <li key={li} className="text-[12px] leading-6 text-[#3c3c43]">{inline(l.replace(/^\s*-\s/, ""))}</li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <p key={bi} className="text-[12px] leading-6 text-[#3c3c43]">
            {lines.map((l, li) => (
              <span key={li}>
                {inline(l)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
