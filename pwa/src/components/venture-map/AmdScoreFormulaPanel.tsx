"use client";

/**
 * SPS (シーズ有望度) primary + legacy AMD comparison モデル説明パネル。
 *
 * PJ cockpit のスコア詳細タブと
 * Retrofit ページ (/venture-map/amd-score/retrofit) の両方で同一のモデル構造を表示。
 *
 * 数式はすべて LaTeX (Tex) で表示。各引用文献を要素ごとに併記。
 *
 * 見た目 (外枠・HUD フレーム・ブロック・チップ) は数式パネル共通キット
 * @/components/formula/FormulaPanelKit に一本化している。ここで padding や
 * font-size を上書きしない (2026-08-21 まさ指摘: 画面ごとにデザインが分岐していた)。
 *
 * 仕様: pwa/design/amd_score.md「Triple Helix 観測モデル」+ before-zero/theory/state_space_model.md §4.1
 */

import { Citation, FormulaBlock, FormulaLine, FormulaPanelShell, MeaningChip } from "@/components/formula/FormulaPanelKit";
import { Tex } from "@/components/venture-map/Tex";
import { PRS_ALPHA_DEFAULT, type AlphaWeights } from "@/lib/amd-score";

export function AmdScoreFormulaPanel({ alpha }: { alpha: AlphaWeights }) {
  return (
    <FormulaPanelShell
      title="SPS シーズ有望度 (M·P·R·S) PRIMARY FORMULA"
      badge="FORMULA VECTOR"
      lead={
        <>
            主表示は{" "}
            <strong className="text-cyan-200">Macrotrend M (マクロ追い風)</strong> ×{" "}
            <strong className="text-emerald-200">Potential P</strong> ×{" "}
            <strong className="text-sky-300">Reach R</strong> ×{" "}
            <strong className="text-pink-200">Survival S (自走力)</strong>。2026-07-16 に σ_SU を S から分離して独立項 M へ
            (フラット Cobb-Douglas の結合則によりスコア数値は完全不変)。旧{" "}
            <strong className="text-cyan-200">M × X × F</strong> は下段に comparison layer として残す。呼称は{" "}
            <strong className="text-cyan-200">SPS = Seed Prospect Score (シーズ有望度)</strong> — 和名の略であって成分の頭字ではないため、4因子化しても名前は壊れない (旧 PRS は 2026-07-11 まさ確定で廃止、terminology_glossary §1.5)。
        </>
      }
    >
      <FormulaBlock title="PRIMARY OVERALL SCORE" accent="cyan" subtitle="主表示の SPS score。compact と expanded を両方表示">
        <div className="grid gap-2">
          <FormulaLine label="compact">
            <Tex tex={String.raw`\mathrm{Score}_{\mathrm{SPS}} \;=\; k \cdot M \cdot P \cdot R \cdot S`} />
          </FormulaLine>
          <FormulaLine label="expanded">
            <Tex tex={String.raw`\mathrm{Score}_{\mathrm{SPS}} \;=\; k \cdot (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma} \cdot (P_{\mathrm{input}}+1)^{\alpha_P} \cdot \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x} \cdot (\mathrm{FRL}+1)^{\alpha_F} \cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}`} />
          </FormulaLine>
          <FormulaLine label="k calibration">
            <Tex tex={String.raw`k \;=\; \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{SPS}} \alpha_x}}, \qquad \mathcal{A}_{SPS} \;=\; \{P, \mathrm{TRL}, \mathrm{BRL}, \mathrm{GRL}, \mathrm{SRL}, \mathrm{HRL}, \sigma_{\mathrm{SU}}, \mathrm{FRL}, R_{\mathrm{net}}\}`} />
          </FormulaLine>
        </div>
        <Citation>
          根拠: Cobb &amp; Douglas (1928). &quot;A theory of production.&quot;{" "}
          <em>American Economic Review</em>, 18(1), 139-165. — 多因子統合の経済学標準。各 α は弾力性 (= 軸が 1% 増えたとき score が何 % 増えるか) を表す。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="K / M / P / R / S INTUITION" accent="cyan" subtitle="式を経営判断として読むためのざっくり意味">
        <div className="grid gap-2 text-[12px] text-cyan-50/82">
          <div className="grid gap-2 md:grid-cols-5">
            <MeaningChip label="K" title="Calibration" body="全active axisが9点の時に100,000へ合わせる倍率。価値入力ではなく物差し。" />
            <MeaningChip label="M" title="マクロ追い風" body="いま、この分野に吹いている風。σ_SU (Triple Helix)。案件の属性ではなく時変の環境状態。" />
            <MeaningChip label="P" title="Potential" body="当たった時の大きさ。市場・事業・社会インパクトの天井。" />
            <MeaningChip label="R" title="Reach" body="そこへ届く準備。TRL/BRL/GRL/SRL/HRL の会社側 readiness。" />
            <MeaningChip label="S" title="自走力" body="外の資金が止まっても自分の力で走り続けられる体質。FRL × R_net。" />
          </div>
          <div className="rounded border border-cyan-300/24 bg-cyan-300/7 px-3 py-2 leading-relaxed">
            SPS は足し算の加点表ではなく、立ち上がるための必要条件を同時に見るモデル。
            P が大きくても R が低ければ届かない。M が吹いていても S (自走力) が低ければ環境で延命しているだけ。
            積にすると、どれか1つが弱い時に score が自然に抑えられ、4つが同時に揃った時だけ大きく伸びる。
            M と S を分けたことで「環境で延命しているのか、自走できるのか」を別々に診断できる (2026-07-16 まさ確定)。
          </div>
        </div>
      </FormulaBlock>

      <FormulaBlock title="MACROTREND M — マクロ追い風" accent="cyan" subtitle="環境の状態・タイミングの変数 / Triple Helix 観測モデル">
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
          2026-07-16 まさ確定で S から分離した独立項。P との分離基準は「案件の属性か、環境の状態か」— P はこの案件が当たったときの天井 (案件固有)、M はいまこの分野に吹いている風 (時変の環境)。
        </div>
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

      <FormulaBlock title="POTENTIAL P" accent="rose" subtitle="目標成功規模の ceiling。review 入力の P をそのまま使う">
        <Tex display tex={String.raw`P \;=\; (P_{\mathrm{input}}+1)^{\alpha_P}`} />
        <Citation>
          いまの P は review queue で決める事業ポテンシャル入力。未入力なら SPS を出さず、legacy AMD へ silent fallback しない。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="REACH R" accent="sky" subtitle="会社に帰属する 5 軸 readiness の到達可能性">
        <Tex
          display
          tex={String.raw`R \;=\; \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
        />
        <Citation>
          TRL / BRL / GRL / SRL / HRL は legacy AMD と同じ実測軸を使う。Shallow Tech モードでは TRL を除外し、k も同じルールで再校正。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="SURVIVAL S — 自走力" accent="cyan" subtitle="founder readiness × 純残存力。外の資金が止まっても走り続けられる体質">
        <Tex
          display
          tex={String.raw`S \;=\; (\mathrm{FRL}+1)^{\alpha_F} \cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}`}
        />
        <Citation>
          Survival = 自走力 (Survival = FRL × R_net)。<strong>FRL</strong> (founder readiness) と{" "}
          <strong>R_net</strong> (資源毀損を引いた純残存力) の積。σ_SU は 2026-07-16 に独立項 M へ分離 —
          「環境で延命している」と「自走できる」を別々に診断するため。R_net 未入力時は SPS を review pending で止める。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="LEGACY AMD OVERALL SCORE" accent="cyan" subtitle="比較用に残している旧 M × X × F モデル">
        <Tex display tex={String.raw`S_{\mathrm{legacy}} \;=\; k \cdot M \cdot X \cdot F, \qquad k \;=\; \frac{100{,}000}{10^{\sum_x \alpha_x}}`} />
        <Citation>
          comparison layer。過去比較と evidence 用に残している旧 AMD/MXF の式で、主表示としては読まない。M は上の MACROTREND M と同一の <Tex tex={String.raw`(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />。
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
          SPS α WEIGHT ARRAY
        </div>
        <div className="mt-2">
          α_F=<span className="font-mono text-rose-200">{PRS_ALPHA_DEFAULT.FRL}</span> &gt;
          α_σ=<span className="font-mono text-cyan-200">{PRS_ALPHA_DEFAULT.sigma_SU}</span> &gt;
          α_HRL=<span className="font-mono text-sky-200">{PRS_ALPHA_DEFAULT.HRL}</span> &gt;
          α_P=<span className="font-mono text-emerald-200">{PRS_ALPHA_DEFAULT.P}</span> =
          α_TRL=<span className="font-mono text-sky-200">{PRS_ALPHA_DEFAULT.TRL}</span> &gt;
          α_Rnet=<span className="font-mono text-cyan-200">{PRS_ALPHA_DEFAULT.R_net}</span> &gt;
          α_BRL=<span className="font-mono text-sky-200">{PRS_ALPHA_DEFAULT.BRL}</span> &gt;
          α_GRL=<span className="font-mono text-sky-200">{PRS_ALPHA_DEFAULT.GRL}</span> &gt;
          α_SRL=<span className="font-mono text-sky-200">{PRS_ALPHA_DEFAULT.SRL}</span>
        </div>
        <div className="mt-1">
          <Tex tex={String.raw`k = 100{,}000 / 10^{\sum_{x \in \mathcal{A}_{SPS}} \alpha_x}`} /> で全軸 9 (= IPO 級) を 100,000 に校正 ·
          Shallow Tech モード (TRL=null) では TRL を reach から除外して k を再校正。
        </div>
      </div>

      <div className="relative overflow-hidden border border-amber-300/48 bg-amber-300/8 px-4 py-3 text-[13px] text-amber-50 shadow-[0_0_24px_rgba(251,191,36,.12),inset_0_0_22px_rgba(251,191,36,.08)]">
        <div className="absolute inset-x-0 top-0 h-px bg-amber-200 shadow-[0_0_14px_rgba(251,191,36,.75)]" />
        <div className="mb-2 font-mono text-[14px] font-black uppercase tracking-[0.15em] text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,.58)]">
          SPS RATE-LIMITING AXIS
        </div>
        <div className="mb-2 font-semibold text-amber-50/82">
          「1 段階上げたとき SPS score が最も大きく増える軸」を律速とする。Cobb-Douglas の偏微分から:
        </div>
        <div className="overflow-x-auto border border-amber-200/24 bg-slate-950/82 px-3 py-2">
          <Tex
            display
            tex={String.raw`\frac{\partial \mathrm{Score}_{\mathrm{SPS}}}{\partial Z_i} \;=\; \frac{\alpha_i \cdot \mathrm{Score}_{\mathrm{SPS}}}{Z_i + 1} \quad\Rightarrow\quad \mathrm{bottleneck}_{SPS} \;=\; \arg\max_i \frac{\alpha_i}{Z_i + 1}, \qquad Z_i \in \mathcal{A}_{SPS}`}
          />
        </div>
        <div className="mt-2 font-semibold text-amber-50/78">
          重み α が大きいのに値 Z が低い軸 = 限界収益 (marginal contribution) が最大の軸 = 経営アクションで最初に手当てすべき軸。
        </div>
        <Citation>
          根拠: Cobb, C. W. &amp; Douglas, P. H. (1928). <em>American Economic Review</em>, 18(1), 139-165.
        </Citation>
      </div>

      <div className="relative overflow-hidden border border-cyan-300/28 bg-cyan-300/7 px-4 py-3 text-[12px] font-semibold text-cyan-100/78 shadow-[inset_0_0_22px_rgba(34,211,238,.08)]">
        <div className="absolute left-0 top-0 h-full w-1 bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,.9)]" />
        <div className="font-mono text-[13px] font-black uppercase tracking-[0.12em] text-cyan-100">
          LEGACY AMD α WEIGHT ARRAY
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
          LEGACY RATE-LIMITING AXIS
        </div>
        <div className="mb-2 font-semibold text-amber-50/82">
          comparison layer の旧 AMD で「1 段階上げたとき legacy score が最も大きく増える軸」を律速とする。
        </div>
        <div className="overflow-x-auto border border-amber-200/24 bg-slate-950/82 px-3 py-2">
          <Tex
            display
            tex={String.raw`\frac{\partial S_{\mathrm{legacy}}}{\partial X_i} \;=\; \frac{\alpha_i \cdot S_{\mathrm{legacy}}}{X_i + 1} \quad\Rightarrow\quad \mathrm{bottleneck}_{legacy} \;=\; \arg\max_i \frac{\alpha_i}{X_i + 1}`}
          />
        </div>
        <div className="mt-2 font-semibold text-amber-50/78">
          重み α が大きいのに値 X が低い軸 = 限界収益が最大の軸。legacy AMD ではこの軸を comparison 用に読む。
        </div>
        <Citation>
          根拠: Cobb, C. W. &amp; Douglas, P. H. (1928). <em>American Economic Review</em>, 18(1), 139-165.
        </Citation>
      </div>
    </FormulaPanelShell>
  );
}
