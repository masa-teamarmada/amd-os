"use client";

/**
 * 数式パネル共通キット。
 *
 * AMD OS で「数式 + パラメータ実値 + 出典」を出すパネルは、見た目をここに一本化する。
 * 個別画面で padding / font-size / 装飾を刻み直さない。
 *
 * 🚫 このキットに cyber HUD デザインコード (黒背景 / ネオン発光 / SVG コーナーフレーム /
 * 全角トラッキングの英大文字見出し) を持ち込まない。まさ確定 2026-08-21:
 * 「HUDデザインコードを混ぜないでくれればいいだけ」。数式パネルは、それが置かれる画面
 * (シーズ詳細モーダル等) の通常デザイン (border-border / bg-card / text-muted-foreground)
 * に溶け込ませ、そこだけ別世界にしない。
 *
 * 現在の利用者:
 * - /seeds シーズ詳細モーダル「一次選別スクリーニング帯」 … SpsFormulaPanel
 *
 * 適用対象外: PJ コックピット「スコア詳細」タブ (CockpitAmdScoreDetailTab →
 * CurrentSpsAssessmentCard / Bzm22ProvisionalObservatory)。台帳向けの密度重視レイアウト。
 */

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** 外枠 + 見出し + KaTeX 調整。全数式パネル共通のシェル。 */
export function FormulaPanelShell({
  testId,
  title,
  lead,
  badge,
  children,
}: {
  testId?: string;
  title: string;
  lead: ReactNode;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="formula-panel rounded border border-border bg-card px-4 py-4 text-[13px] leading-relaxed text-foreground"
    >
      <style jsx global>{`
        .formula-panel .katex {
          font-size: 1.06em;
        }
        .formula-panel .katex-display {
          margin: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.15rem 0;
        }
        .formula-panel .katex-display > .katex {
          font-size: 1.2em;
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="text-[14px] font-semibold text-foreground">{title}</div>
          <div className="mt-1.5 max-w-4xl text-[12px] leading-relaxed text-muted-foreground">{lead}</div>
        </div>
        <div className="rounded border border-border bg-muted/50 px-2.5 py-1.5 text-right font-mono text-[11px] text-muted-foreground">
          {badge}
        </div>
      </div>

      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** 数式のかたまり 1 ブロック。左端に細いアクセントレール (発光させない)。 */
export function FormulaBlock({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "primary" | "info" | "caution";
  children: ReactNode;
}) {
  const rail =
    accent === "caution" ? "bg-rose-400/70" : accent === "info" ? "bg-sky-400/70" : "bg-emerald-400/70";

  return (
    <section className="relative overflow-hidden rounded border border-border bg-muted/20 py-3 pl-4 pr-3">
      <div className={`absolute left-0 top-0 h-full w-[3px] ${rail}`} />
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <div className="text-[13px] font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** 記号 1 個の意味を説明するチップ。 */
export function MeaningChip({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[16px] font-semibold text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{title}</span>
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}

/** ラベル + 数式 1 行。 */
export function FormulaLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 rounded border border-border bg-muted/30 px-3 py-2 md:grid-cols-[210px_1fr] md:items-center">
      <div className="font-mono text-[11px] text-muted-foreground">{label}</div>
      <div className="min-w-0 overflow-x-auto text-[13px]">{children}</div>
    </div>
  );
}

/**
 * 記号 + 意味 + このケースでの実値。
 *
 * symbol は ReactNode。数式に出てくる記号は必ず <Tex> を渡して LaTeX で出す
 * (まさ指摘 2026-08-21:「ここがまだLaTeX担ってない」)。
 *
 * detail を渡すとカード全体がクリックで開き、その数字がどう出てきたかを見せる
 * (まさ指示 2026-08-21:「そのカードをクリックしたら、その数字が算出されたプロセスが
 * 分かるようにしてほしい。そのパラメータが別の数式で表されてるなら、その数式もそこに表示して」)。
 */
export function ParamRow({
  symbol,
  label,
  children,
  detail,
}: {
  symbol: ReactNode;
  label: string;
  children: ReactNode;
  /** クリックで開く算出過程。省略するとただのカード (開かない) */
  detail?: ReactNode;
}) {
  const head = (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[12px] font-semibold text-foreground">{symbol}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-[13px] font-medium text-foreground">{children}</div>
    </>
  );

  if (!detail) {
    return <div className="rounded border border-border bg-muted/30 px-3 py-2">{head}</div>;
  }

  return (
    <details className="group h-fit rounded border border-border bg-muted/30 open:bg-muted/50">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{head}</div>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground">
          <span className="group-open:hidden">算出過程</span>
          <span className="hidden group-open:inline">閉じる</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="space-y-2 border-t border-border px-3 py-2.5">{detail}</div>
    </details>
  );
}

/** ParamRow の展開内で使う、番号つきの算出ステップ 1 段。 */
export function DetailStep({ n, title, children }: { n: number | string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[9px] font-semibold text-muted-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** ParamRow の展開内で数式を 1 本置く。横に長い式は自前でスクロールさせる。 */
export function DetailFormula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-background/70 px-2.5 py-2 text-[12px]">
      {children}
    </div>
  );
}

/** ParamRow の展開内の注記 (出典・規律・未記録の断り)。 */
export function DetailNote({ tone = "muted", children }: { tone?: "muted" | "caution"; children: ReactNode }) {
  const cls =
    tone === "caution"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      : "border-border bg-muted/40 text-muted-foreground";
  return <div className={`rounded border px-2.5 py-2 text-[11px] leading-relaxed ${cls}`}>{children}</div>;
}

/** ブロック末尾の出典。 */
export function Citation({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">{children}</div>;
}
