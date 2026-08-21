"use client";

/**
 * 数式パネル共通キット (cyber HUD デザインコード正本の実装)。
 *
 * AMD OS で「数式 + パラメータ実値 + 出典」を出すパネルは、
 * 見た目をここに一本化する。個別画面で padding / font-size / 装飾を
 * 刻み直さない (2026-08-21 まさ指摘: シーズモーダルだけ寸法が縮んでいた)。
 *
 * 現在の利用者:
 * - /seeds シーズ詳細モーダル「一次選別スクリーニング帯」 … SpsFormulaPanel (唯一の live 利用者)
 * - AmdScoreFormulaPanel … 2026-08-21 時点で route から到達不能 (AmdScoreView / AmdScoreRetrofit が
 *   どこからも import されていない)。復活時に寸法が再分岐しないようキットへ載せてある。
 *
 * 適用対象外: PJ コックピット「スコア詳細」タブ (CockpitAmdScoreDetailTab → CurrentSpsAssessmentCard /
 * Bzm22ProvisionalObservatory)。あちらは台帳向けの密度重視レイアウトで、HUD パネルとは役目が違う。
 *
 * 正本: pwa/design/cyber_hud_design_code.md (HUD フレームの主形状は SVG で作る)
 */

import type { ReactNode } from "react";

/** 外枠 + HUD フレーム + KaTeX 発光。全数式パネル共通のシェル。 */
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
      className="formula-hud-panel relative overflow-hidden border border-cyan-300/34 bg-slate-950/90 px-5 py-5 text-[13px] leading-relaxed text-cyan-50 shadow-[0_0_46px_rgba(34,211,238,.18),inset_0_0_52px_rgba(14,165,233,.10)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(103,232,249,.18)_1px,transparent_1.8px)] bg-[size:15px_15px]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(103,232,249,.08)_1px,transparent_1px),linear-gradient(180deg,rgba(103,232,249,.06)_1px,transparent_1px)] bg-[size:88px_100%,100%_34px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2 12H954L998 64V708H42L2 664Z" fill="none" stroke="rgba(103,232,249,.42)" strokeWidth="1" />
          <path d="M24 36h154M228 36h46M702 36h76M800 36h112M28 684h240M340 684h42M648 684h258" stroke="rgba(103,232,249,.54)" strokeWidth="2.2" />
          <path d="M525 36h12M548 36h54M616 36h13M420 684h12M444 684h52M510 684h12" stroke="rgba(244,114,182,.64)" strokeWidth="2" />
        </svg>
      </div>

      <style jsx global>{`
        .formula-hud-panel .katex {
          color: #e6fdff;
          font-size: 1.08em;
          text-shadow: 0 0 14px rgba(103, 232, 249, 0.58);
        }
        .formula-hud-panel .katex-display {
          margin: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.15rem 0;
        }
        .formula-hud-panel .katex-display > .katex {
          font-size: 1.28em;
        }
      `}</style>

      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-cyan-300/24 pb-3">
        <div>
          <div className="text-[16px] font-black uppercase tracking-[0.2em] text-cyan-100 drop-shadow-[0_0_14px_rgba(103,232,249,.72)]">
            {title}
          </div>
          <div className="mt-2 max-w-4xl text-[13px] font-semibold text-cyan-100/78">{lead}</div>
        </div>
        <div className="border border-pink-300/42 bg-pink-500/8 px-3 py-2 text-right font-mono text-[12px] font-black uppercase tracking-[0.12em] text-pink-200 shadow-[0_0_20px_rgba(244,114,182,.18)]">
          {badge}
        </div>
      </div>

      <div className="relative flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** 数式のかたまり 1 ブロック。左端に accent レール。 */
export function FormulaBlock({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "cyan" | "sky" | "rose";
  children: ReactNode;
}) {
  const color =
    accent === "rose"
      ? "border-rose-300/38 text-rose-200"
      : accent === "sky"
        ? "border-sky-300/38 text-sky-200"
        : "border-cyan-300/38 text-cyan-200";
  const rail =
    accent === "rose" ? "bg-rose-300 shadow-rose-300/80" : accent === "sky" ? "bg-sky-300 shadow-sky-300/80" : "bg-cyan-300 shadow-cyan-300/80";

  return (
    <section className={`relative overflow-hidden border bg-slate-950/72 px-4 py-3 shadow-[inset_0_0_24px_rgba(2,8,23,.92)] ${color}`}>
      <div className={`absolute left-0 top-0 h-full w-[3px] ${rail} shadow-[0_0_15px_currentColor]`} />
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-cyan-300/16 pb-2">
        <div className="font-mono text-[13px] font-black uppercase tracking-[0.16em]">{title}</div>
        <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-100/54">{subtitle}</div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** 記号 1 個の意味を説明するチップ。 */
export function MeaningChip({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded border border-cyan-300/22 bg-slate-950/62 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[18px] font-black text-cyan-100">{label}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200/78">{title}</span>
      </div>
      <div className="mt-1 text-[11px] font-semibold leading-relaxed text-cyan-50/72">{body}</div>
    </div>
  );
}

/** ラベル + 数式 1 行。 */
export function FormulaLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border border-cyan-300/16 bg-cyan-300/5 px-3 py-2 md:grid-cols-[210px_1fr] md:items-center">
      <div className="font-mono text-[12px] font-black uppercase tracking-[0.08em] text-cyan-100/64">{label}</div>
      <div className="min-w-0 overflow-x-auto text-[13px]">{children}</div>
    </div>
  );
}

/** 記号 + 意味 + このケースでの実値。 */
export function ParamRow({ symbol, label, children }: { symbol: string; label: string; children: ReactNode }) {
  return (
    <div className="border border-cyan-300/16 bg-cyan-300/5 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[12px] font-black tracking-[0.06em] text-cyan-200/86">{symbol}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-100/48">{label}</span>
      </div>
      <div className="mt-1 text-[13px] font-bold text-cyan-50">{children}</div>
    </div>
  );
}

/** ブロック末尾の出典。 */
export function Citation({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-[11px] font-semibold leading-relaxed text-cyan-100/54">{children}</div>;
}
