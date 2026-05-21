"use client";

/**
 * AMD Score モデル説明パネル — 紫枠 (Before Zero Theory v3.2)。
 *
 * AMD Score 詳細ページ (/venture-map/amd-score/[projectId]) と
 * Retrofit ページ (/venture-map/amd-score/retrofit) の両方で同一のモデル構造を表示。
 *
 * 数式はすべて LaTeX (Tex) で表示。各引用文献を要素ごとに併記。
 *
 * 仕様: pwa/design/amd_score.md「Triple Helix 観測モデル」+ before-zero/theory/state_space_model.md §4.1
 */

import { Tex } from "@/components/venture-map/Tex";
import type { AlphaWeights } from "@/lib/amd-score";
import type { ReactNode } from "react";

export function AmdScoreFormulaPanel({ alpha }: { alpha: AlphaWeights }) {
  return (
    <div className="amd-score-formula-panel relative overflow-hidden border border-cyan-300/34 bg-slate-950/90 px-5 py-5 text-[13px] leading-relaxed text-cyan-50 shadow-[0_0_46px_rgba(34,211,238,.18),inset_0_0_52px_rgba(14,165,233,.10)]">
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
        .amd-score-formula-panel .katex {
          color: #e6fdff;
          font-size: 1.08em;
          text-shadow: 0 0 14px rgba(103, 232, 249, 0.58);
        }
        .amd-score-formula-panel .katex-display {
          margin: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.15rem 0;
        }
        .amd-score-formula-panel .katex-display > .katex {
          font-size: 1.28em;
        }
      `}</style>

      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-cyan-300/24 pb-3">
        <div>
          <div className="text-[16px] font-black uppercase tracking-[0.2em] text-cyan-100 drop-shadow-[0_0_14px_rgba(103,232,249,.72)]">
            AMD SCORE MODEL CORE
          </div>
          <div className="mt-2 max-w-4xl text-[13px] font-semibold text-cyan-100/78">
            Before Zero Theory v3.2 — <strong className="text-cyan-200">Macrotrend M</strong> ×{" "}
            <strong className="text-sky-300">XRL X</strong> ×{" "}
            <strong className="text-rose-300">FRL F</strong> を Cobb-Douglas で統合。
            世界課題の潮流、会社 readiness、founder readiness を同じ計器盤で読む。
          </div>
        </div>
        <div className="border border-pink-300/42 bg-pink-500/8 px-3 py-2 text-right font-mono text-[12px] font-black uppercase tracking-[0.12em] text-pink-200 shadow-[0_0_20px_rgba(244,114,182,.18)]">
          FORMULA VECTOR
        </div>
      </div>

      <div className="relative flex flex-col gap-3">
        <FormulaBlock title="OVERALL SCORE" accent="cyan" subtitle="S = AMD Score、k は IPO 級への校正定数">
        <Tex display tex={String.raw`S \;=\; k \cdot M \cdot X \cdot F, \qquad k \;=\; \frac{100{,}000}{10^{\sum_x \alpha_x}}`} />
          <Citation>
          根拠: Cobb &amp; Douglas (1928). &quot;A theory of production.&quot;{" "}
          <em>American Economic Review</em>, 18(1), 139-165. — 多因子統合の経済学標準。各 α は弾力性 (= X が 1% 増えたとき S が何 % 増えるか) を表す。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="M MACROTREND VECTOR" accent="cyan" subtitle="世界課題・政策・産業・学術の外部潮流 / Triple Helix 観測モデル">
          <div className="grid gap-2">
            <FormulaLine label="M (Macrotrend)">
            <Tex tex={String.raw`M \;=\; (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />
            </FormulaLine>
            <FormulaLine label="σ_SU (Triple Helix CD)">
            <Tex tex={String.raw`\sigma_{\mathrm{SU}} \;=\; \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`} />
            </FormulaLine>
            <FormulaLine label="μ_x (隠れ状態 ← 観測量)">
            <Tex tex={String.raw`\mu_x \;=\; \frac{\sum_p c_{xp} \, \tilde{y}_p}{\sum_p c_{xp}}, \quad p \in \{P, B, V, R, I_R, N, C\}`} />
            </FormulaLine>
            <FormulaLine label="ỹ_p (観測値正規化)">
            <Tex tex={String.raw`\tilde{y}_p \;=\; 9 \, \frac{y_p - \min_t y_p}{\max_t y_p - \min_t y_p}`} />
              <span className="ml-2 text-[11px] text-cyan-100/58">(過去 16 quarter で min-max)</span>
            </FormulaLine>
          </div>
          <Citation>
          <div>
            根拠 (Triple Helix): Etzkowitz &amp; Leydesdorff (2000). &quot;The dynamics of innovation: from National Systems and Mode 2 to a Triple Helix of university–industry–government relations.&quot;{" "}
            <em>Research Policy</em>, 29(2), 109-123.
          </div>
          <div>
            根拠 (状態空間モデル + C 行列 prior): <code className="rounded bg-slate-100 px-1">theory/state_space_model.md §4.1</code>
            {" / "}<code className="rounded bg-slate-100 px-1">theory/bvar_prior.md §3.2</code>
          </div>
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="X XRL VECTOR" accent="sky" subtitle="会社に帰属する 5 軸 readiness、内閣府 SIP 互換">
        <Tex
          display
          tex={String.raw`X \;=\; \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
        />
          <Citation>
          <div>
            根拠 (TRL): Mankins, J. C. (1995). &quot;Technology readiness levels.&quot;{" "}
            <em>NASA White Paper</em>. — 9 段階の技術成熟度の起源。
          </div>
          <div>
            根拠 (5 XRL 並列): 内閣府 SIP サーキュラーエコノミーシステム構築 公募要領 (令和 5 年, Ver 1.1). — TRL/BRL/GRL/SRL/HRL を**並列の評価軸**と規定。
          </div>
          <div>
            根拠 (SRL): EU Horizon Europe Multi-RL framework. — 社会受容性 9 段階。
          </div>
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="F FRL VECTOR" accent="rose" subtitle="CEO / founder readiness、6 因子 = ALQ 4 + Grit + Resilience">
        <Tex display tex={String.raw`F \;=\; (\mathrm{FRL}+1)^{\alpha_F}, \quad \mathrm{FRL} \;=\; 0.6 \cdot \overline{\mathrm{ALQ}_4} + 0.2 \cdot \mathrm{Grit} + 0.2 \cdot \mathrm{Resilience}`} />
          <Citation>
          <div>
            根拠 (Founder Quality 重要性): Bernstein, Korteweg &amp; Laws (2017). &quot;Attracting early-stage investors.&quot;{" "}
            <em>Journal of Finance</em>, 72(2), 509-538.
          </div>
          <div>
            根拠 (ALQ 4 次元 = オーセンティシティ): Walumbwa, Avolio, Gardner, Wernsing &amp; Peterson (2008).{" "}
            <em>Journal of Management</em>, 34(1), 89-126.
          </div>
          <div>
            根拠 (Grit = 集中力): Duckworth, Peterson, Matthews &amp; Kelly (2007).{" "}
            <em>Journal of Personality and Social Psychology</em>, 92(6), 1087-1101.
          </div>
          <div>
            根拠 (Resilience = タフさ): Markman, Baron &amp; Balkin (2005).{" "}
            <em>Journal of Organizational Behavior</em>, 26(1), 1-19.
          </div>
          <div>
            根拠 (Founder Network 効果): Hsu, D. H. (2007).{" "}
            <em>Research Policy</em>, 36(5), 722-741.
          </div>
          </Citation>
        </FormulaBlock>

        <div className="relative overflow-hidden border border-cyan-300/28 bg-cyan-300/7 px-4 py-3 text-[12px] font-semibold text-cyan-100/78 shadow-[inset_0_0_22px_rgba(34,211,238,.08)]">
          <div className="absolute left-0 top-0 h-full w-1 bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,.9)]" />
          <div className="font-mono text-[13px] font-black uppercase tracking-[0.12em] text-cyan-100">
            α WEIGHT ARRAY
          </div>
          <div className="mt-2">
            α_F=<span className="font-mono text-rose-200">{alpha.FRL}</span> &gt;
            α_σ=<span className="font-mono text-cyan-200">{alpha.sigma_SU}</span> &gt;
            α_HRL=<span className="font-mono text-sky-200">{alpha.HRL}</span> &gt;
            α_TRL=<span className="font-mono text-sky-200">{alpha.TRL}</span> &gt;
            α_BRL=<span className="font-mono text-sky-200">{alpha.BRL}</span> &gt;
            α_GRL=<span className="font-mono text-sky-200">{alpha.GRL}</span> &gt;
            α_SRL=<span className="font-mono text-sky-200">{alpha.SRL}</span>
          </div>
          <div className="mt-1">
            <Tex tex={String.raw`k = 100{,}000 / 10^{\sum \alpha}`} /> で全軸 9 (= IPO 級) を 100,000 に校正 · Shallow Tech モード (TRL=null) では TRL を X から除外して k を再校正。
          </div>
        </div>

        <div className="relative overflow-hidden border border-amber-300/48 bg-amber-300/8 px-4 py-3 text-[13px] text-amber-50 shadow-[0_0_24px_rgba(251,191,36,.12),inset_0_0_22px_rgba(251,191,36,.08)]">
          <div className="absolute inset-x-0 top-0 h-px bg-amber-200 shadow-[0_0_14px_rgba(251,191,36,.75)]" />
          <div className="mb-2 font-mono text-[14px] font-black uppercase tracking-[0.15em] text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,.58)]">
            RATE-LIMITING AXIS
          </div>
          <div className="mb-2 font-semibold text-amber-50/82">
            「1 段階上げたとき S が最も大きく増える軸」を律速とする。Cobb-Douglas の偏微分から:
          </div>
          <div className="overflow-x-auto border border-amber-200/24 bg-slate-950/82 px-3 py-2">
          <Tex
            display
            tex={String.raw`\frac{\partial S}{\partial X_i} \;=\; \frac{\alpha_i \cdot S}{X_i + 1} \quad\Rightarrow\quad \mathrm{bottleneck} \;=\; \arg\max_i \frac{\alpha_i}{X_i + 1}`}
          />
          </div>
          <div className="mt-2 font-semibold text-amber-50/78">
            重み α が大きいのに値 X が低い軸 = 限界収益 (marginal contribution) が最大の軸 = 経営アクションで最初に手当てすべき軸。
          </div>
          <Citation>
            根拠: Cobb, C. W. &amp; Douglas, P. H. (1928). <em>American Economic Review</em>, 18(1), 139-165.
          </Citation>
        </div>
      </div>
    </div>
  );
}

function FormulaBlock({
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

function FormulaLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border border-cyan-300/16 bg-cyan-300/5 px-3 py-2 md:grid-cols-[210px_1fr] md:items-center">
      <div className="font-mono text-[12px] font-black uppercase tracking-[0.08em] text-cyan-100/64">{label}</div>
      <div className="min-w-0 overflow-x-auto text-[13px]">{children}</div>
    </div>
  );
}

function Citation({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-[11px] font-semibold leading-relaxed text-cyan-100/54">{children}</div>;
}
