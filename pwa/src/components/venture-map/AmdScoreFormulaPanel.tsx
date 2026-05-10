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

export function AmdScoreFormulaPanel({ alpha }: { alpha: AlphaWeights }) {
  void alpha; // alpha 一覧は将来表示用
  return (
    <div className="text-[11px] text-slate-700 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 leading-relaxed flex flex-col gap-3">
      <div>
        Before Zero Theory v3.2 — <strong>マクロ M</strong> × <strong>会社の XRL X</strong> ×{" "}
        <strong>CEO の FRL F</strong> の 3 大要素を Cobb-Douglas で統合。
        <br />
        マクロトレンドの流れがあって、会社の XRL が整っていて、それを FRL 高い CEO が牽引する。
      </div>

      {/* 全体式 */}
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          全体式 (S = AMD Score、k は IPO 級への校正定数)
        </div>
        <Tex display tex={String.raw`S \;=\; k \cdot M \cdot X \cdot F, \qquad k \;=\; \frac{100{,}000}{10^{\sum_x \alpha_x}}`} />
        <div className="text-[9px] text-muted-foreground mt-1">
          根拠: Cobb &amp; Douglas (1928). &quot;A theory of production.&quot;{" "}
          <em>American Economic Review</em>, 18(1), 139-165. — 多因子統合の経済学標準。各 α は弾力性 (= X が 1% 増えたとき S が何 % 増えるか) を表す。
        </div>
      </div>

      {/* ① マクロ M (Triple Helix 観測モデル 4 段) */}
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ① マクロ M (外部環境 / Triple Helix 観測モデル)
        </div>
        <div className="flex flex-col gap-1.5">
          <div>
            <span className="text-[10px] text-slate-500">M (マクロ寄与):</span>{" "}
            <Tex tex={String.raw`M \;=\; (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500">σ_SU (Triple Helix CD):</span>{" "}
            <Tex tex={String.raw`\sigma_{\mathrm{SU}} \;=\; \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500">μ_x (隠れ状態 ← 観測量):</span>{" "}
            <Tex tex={String.raw`\mu_x \;=\; \frac{\sum_p c_{xp} \, \tilde{y}_p}{\sum_p c_{xp}}, \quad p \in \{P, B, V, R, I_R, N, C\}`} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500">ỹ_p (観測値正規化):</span>{" "}
            <Tex tex={String.raw`\tilde{y}_p \;=\; 9 \, \frac{y_p - \min_t y_p}{\max_t y_p - \min_t y_p}`} />
            <span className="ml-1 text-[10px] text-slate-500">(過去 16 quarter で min-max)</span>
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground mt-2 space-y-0.5">
          <div>
            根拠 (Triple Helix): Etzkowitz &amp; Leydesdorff (2000). &quot;The dynamics of innovation: from National Systems and Mode 2 to a Triple Helix of university–industry–government relations.&quot;{" "}
            <em>Research Policy</em>, 29(2), 109-123.
          </div>
          <div>
            根拠 (状態空間モデル + C 行列 prior): <code className="rounded bg-slate-100 px-1">theory/state_space_model.md §4.1</code>
            {" / "}<code className="rounded bg-slate-100 px-1">theory/bvar_prior.md §3.2</code>
          </div>
        </div>
      </div>

      {/* ② 会社の XRL X */}
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ② 会社の XRL X (会社に帰属する 5 軸 readiness、内閣府 SIP 互換)
        </div>
        <Tex
          display
          tex={String.raw`X \;=\; \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
        />
        <div className="text-[9px] text-muted-foreground mt-1 space-y-0.5">
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
        </div>
      </div>

      {/* ③ CEO の FRL F */}
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ③ CEO の FRL F (個人に帰属する CEO リーダーシップ / 6 因子 = ALQ 4 + Grit + Resilience)
        </div>
        <Tex display tex={String.raw`F \;=\; (\mathrm{FRL}+1)^{\alpha_F}, \quad \mathrm{FRL} \;=\; 0.6 \cdot \overline{\mathrm{ALQ}_4} + 0.2 \cdot \mathrm{Grit} + 0.2 \cdot \mathrm{Resilience}`} />
        <div className="text-[9px] text-muted-foreground mt-1 space-y-0.5">
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
        </div>
      </div>

      {/* 重み α 一覧 + 校正定数 k */}
      <div className="text-[10px] text-muted-foreground space-y-1">
        <div>
          重み α (default): α_F=<span className="font-mono">1.5</span> &gt;
          α_σ=<span className="font-mono">1.3</span> &gt;
          α_HRL=<span className="font-mono">1.1</span> &gt;
          α_TRL=<span className="font-mono">1.0</span> &gt;
          α_BRL=<span className="font-mono">0.6</span> &gt;
          α_GRL=<span className="font-mono">0.3</span> &gt;
          α_SRL=<span className="font-mono">0.2</span>
        </div>
        <div>
          <Tex tex={String.raw`k = 100{,}000 / 10^{\sum \alpha}`} /> で全軸 9 (= IPO 級) を 100,000 に校正 · Shallow Tech モード (TRL=null) では TRL を X から除外して k を再校正。
        </div>
      </div>

      {/* 律速 */}
      <div className="text-[10.5px] text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-relaxed flex flex-col gap-1 mt-1">
        <div className="text-[11px] font-semibold">律速 (rate-limiting) の定義</div>
        <div>
          「1 段階上げたとき S が最も大きく増える軸」を律速とする。Cobb-Douglas の偏微分から:
        </div>
        <div className="bg-white rounded px-2 py-1 overflow-x-auto">
          <Tex
            display
            tex={String.raw`\frac{\partial S}{\partial X_i} \;=\; \frac{\alpha_i \cdot S}{X_i + 1} \quad\Rightarrow\quad \mathrm{bottleneck} \;=\; \arg\max_i \frac{\alpha_i}{X_i + 1}`}
          />
        </div>
        <div>
          重み α が大きいのに値 X が低い軸 = 限界収益 (marginal contribution) が最大の軸 = 経営アクションで最初に手当てすべき軸。
        </div>
        <div className="text-[9px] text-muted-foreground">
          根拠: Cobb, C. W. &amp; Douglas, P. H. (1928).{" "}
          <em>American Economic Review</em>, 18(1), 139-165.
        </div>
      </div>
    </div>
  );
}
