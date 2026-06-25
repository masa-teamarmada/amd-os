# Book II 進化経済学 OPENER 構造手術 (Ch 10 → 章頭 move)

*生成: 2026-06-25 / source: workflow `wbe83ceaf` (7 agents, 273k tokens, 10 min, effort=high)*

*位置付け: synth (`wakbxq1i2`) で 5 経済学者批判のうち唯一 NO 判定だった Evolutionary Economist 査読を「yes-if-fixed」に動かすための構造手術。Book II Ch 10 (進化経済学拡張) を Book II の OPENER (章頭) に move し、進化経済学を parent framework として位置付けつつ BZM の 3 つの差別化寄与を formal/falsifiable に書き起こす。再 adversarial verify で verdict 変化を確認した。*

---

## 0. ボトムライン

### 査読 verdict の変化

| 査読 | Baseline (`wakbxq1i2` synth) | 構造手術後 | 差分 |
|---|---|---|---|
| Evolutionary Economist | NO | **yes-if-fixed (Major Revision)** | C1 が決定打 |
| Evol Econ Monograph Editor (Cambridge UP Schumpeter 系) | — | **yes-if-fixed** | publication path 明示 |

### 決定打 = C1 (regime-switching τ_x at B-trigger)

Evolutionary Economist 査読の言葉:

> Moved from NO to yes-if-fixed. The decisive contribution is C1 (regime-switching τ_x at B-trigger), supported by the smooth-limit handoff (new Ch 11.5). C1 alone would have flipped my verdict because it presents a generator-level departure from Jovanovic with a corollary that is falsifiable on real data (hazard break test at τ_B). C2 (F-CES non-delegable core) is interesting but is the weakest of the three — non-delegability is more of an axiom restatement than a derivation, and the Inada corner is imposed by choosing ρ=-2 a priori rather than discovered. C3 (two-layer non-commutativity) is technically the most ambitious — the causal-DAG non-identification argument against scalar collapse is genuinely novel within evolutionary-economics discussions of fitness aggregation — but its dependence on an instrument Z_j for ERS is empirically demanding and the algebraic-incompatibility argument (R_>0,×) vs (R_≥0,+) feels closer to a definitional choice than a discovered structural fact. What did NOT move me: the lineage diagram in Book 0 and the loyalty rhetoric in §5.1. Loyalty rhetoric without formal handoff would have been cosmetic. The smooth-limit Proposition in Ch 11.5 is what makes the loyalty credible. Net: NO → yes-if-fixed is driven by C1 + the smooth-limit Ch 11.5, with C2 and C3 as supporting but not load-bearing contributions.

---

## 1. 進化経済学 lineage マップ (Ch 10 の新基底)

**全体サマリ**: 進化経済学 1982–2010 は (a) Nelson-Winter の selection-mutation-retention + routine-as-replicator、(b) Jovanovic の selection-through-learning による hitting-time 生存解析、(c) Dosi の technological paradigm/trajectory による方向性ある変異、(d) Klepper の industry life cycle、(e) Malerba の sectoral systems と Murmann の co-evolution、を 4 本柱として、非均衡・経路依存・population thinking という方法論 (Witt, Metcalfe) の上に確立した。単位は firm、選抜環境は industry/sector、fitness は単一 scalar が前提。

### 主要文献 (12 件)

| 著者 (年) | タイトル | 中核貢献 | BZM との関係 |
|---|---|---|---|
| Richard R. Nelson & Sidney G. Winter (1982) | An Evolutionary Theory of Economic Change | Established the modern evolutionary-economics program: firms as bundles of routines (the analogue of genes), behavior governed by satisficing search rather than maximization, industry change as a p... | Parent framework. BZM keeps the selection-mutation-retention triad at the macro level and keeps routine-as-replicator for F_cap (delegable capability). BZM departs sharply on two fronts: (a) F_char... |
| Boyan Jovanovic (1982) | Selection and the Evolution of Industry (Econometrica) | Formalized selection-through-learning: each firm has an unknown productivity θ revealed via noisy signals; the firm exits when its posterior mean falls below a threshold. Survival becomes a hitting... | Direct ancestor of Gen-3 S = Pr(τ_x < τ_y). BZM extends Jovanovic in two ways: (i) the survival process becomes 2D (achievement x and runway y) rather than 1D learning of θ; (ii) the process is reg... |
| Giovanni Dosi (1982) | Technological paradigms and technological trajectories (Research Policy) | Introduced 'technological paradigm' as a cognitive-economic frame that selects problems and 'technological trajectory' as the path of incremental progress within it. Innovation is structured, path-... | Conceptual ancestor of TRL inside the R-bundle. Dosi gives the justification for treating technology readiness as a structured, ordinal trajectory rather than an exogenous shock. BZM imports the tr... |
| Giovanni Dosi (1988) | Sources, Procedures, and Microeconomic Effects of Innovation (JEL) | Systematized the determinants of innovation: opportunity, appropriability, cumulativeness, knowledge-base properties. Provided the empirical scaffolding behind the paradigm/trajectory view. | Provides part of the conceptual basis for the R-bundle's componentization (different RLs capture different appropriability/cumulativeness regimes). BZM does not contradict Dosi 1988; it operational... |
| Steven Klepper (1996) | Entry, Exit, Growth, and Innovation over the Product Life Cycle (AER) | Showed empirically and theoretically that industries follow a life-cycle pattern: early high entry, shake-out, late concentration; pre-entry capability ('heritage') strongly predicts post-entry sur... | Klepper's heritage result is consistent with BZM's claim that pre-formation founder F_char + F_cap shape post-formation outcomes. BZM departs by pushing the analysis further upstream (heritage form... |
| Steven Klepper (2002) | Firm Survival and the Evolution of Oligopoly (RAND) | Extended the life-cycle work to show that early entrants with strong heritage become dominant; selection in early industry phases is decisive for long-run structure. | Reinforces BZM's claim that the Before Zero phase is structurally decisive. BZM's GO(t,i) timing rule (𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)) is the BZ-stage analogue of Klepper's early-entry-decisiveness, but... |
| Franco Malerba (2002) | Sectoral systems of innovation and production (Research Policy) | Defined the sectoral-system-of-innovation framework: a sector is characterized by its actors, knowledge base, technological regime, institutions, and demand. Innovation outcomes depend on the archi... | Direct ancestor of ERS's 8-axis decomposition. Malerba justifies treating the selection environment as multi-dimensional and architecture-dependent. BZM departs by (a) quantifying ERS as a weighted... |
| Johann Peter Murmann (2003) | Knowledge and Competitive Advantage: The Coevolution of Firms, Technology, and National Institutions | Empirically established (via the synthetic-dye industry across UK/Germany/US, 1857–1914) that firms, technologies, and national institutions co-evolve, and that institutional configurations (univer... | Direct historical justification for σ_SU = Triple Helix CD(μ_A, μ_I, μ_G). Murmann shows co-evolution of academia, industry, and government determines which projects can crystallize. BZM operationa... |
| J. Stanley Metcalfe (1998) | Evolutionary Economics and Creative Destruction | Formalized Fisher's principle and replicator dynamics in economic settings; argued that variation, selection, and retention together produce non-equilibrium dynamics where average fitness rises but... | Methodological grounding. Metcalfe justifies BZM's refusal to use equilibrium closed-form models and its commitment to stochastic-process / regime-switching machinery. BZM does not depart methodolo... |
| Pier Paolo Saviotti & Andreas Pyka (2004) | Economic development by the creation of new sectors (Journal of Evolutionary Economics) | Modeled economic growth as the outcome of variety creation — new sectors emerge, diffuse, and saturate; diversity dynamics drive long-run growth. Connected variation (the V in V-S-R) to macro outco... | Provides the variation-side argument for why pre-formation projects matter at the population level. BZM's Before Zero focus is implicitly the upstream tap of Saviotti-Pyka's variety creation: the B... |
| Ulrich Witt (2008) | What is specific about evolutionary economics? (Journal of Evolutionary Economics) | Articulated the ontological commitments of evolutionary economics: novelty emergence, irreversibility, path dependence, population thinking. Distinguished 'continuity hypothesis' (Darwinian analogi... | Provides the philosophical license for BZM's methodological choices. BZM commits to all four Witt criteria (novelty, irreversibility, path dependence, population thinking) and adds one BZ-specific ... |
| Christine M. Beckman (2006) | The influence of founding team company affiliations on firm behavior (Academy of Management Journal) | Demonstrated empirically that founder-team prior-affiliation diversity shapes firm strategy and outcomes — i.e., founder heterogeneity (composition) matters beyond aggregate capability. | Empirical handle for testing Departure 2 (F_char non-delegability). Beckman shows founder composition matters; BZM sharpens this into a falsifiable claim that F_char (character) dominates F_cap (ca... |

### 進化経済学が Before Zero phase で扱えていないこと

進化経済学は確立した枠組みのなかで、Before Zero phase に固有の 4 つの構造を扱えていない。第一に pre-firm formation: 単位を firm に置くため、法人格成立以前の founder-project dyad は分析対象外で、その時期の selection が後段の industry dynamics を決めるという Klepper heritage の前段が空白になる。第二に founder character as non-delegable core: Nelson-Winter は skill = routine = 組織内で transferable と置くため、F_char が個人に anchored で委譲不可能であるという BZ-stage の事実を表現できず、CES ρ<0 の補完性で formal に書けない。第三に two-layer non-commutativity: 単一 scalar fitness が前提のため、案件 fitness (multiplicative PRS) と選抜環境 readiness (additive ERS) を別レイヤーに分けて非可換に保つ必要性を欠き、両者を industry-level selection に押し込めてしまう。第四に B-trigger regime switch: Jovanovic の hitting time は単一 regime での learning に閉じており、burn rate B が立ち上がる瞬間に選抜環境そのものが redefine される 2D jump-diffusion regime switch を扱えない。これら 4 点は進化経済学を否定するのではなく、その射程の外側にある BZ-stage 固有の構造であり、BZM が parent framework を継承しつつ拡張すべき領域である。

### BZM が進化経済学から継承する点 (継承表)

- Selection-mutation-retention triad as the macro skeleton: BZM inherits the population-level logic but relocates 'selection environment' into ERS (8軸加重和) as the nursery-layer readiness state of the institutional substrate, not as ex-post firm survival rate.
- Co-evolution (Murmann 2003, Nelson-Winter institutional embedding) as the formal grounding of σ_SU = Triple Helix CD(μ_A, μ_I, μ_G): institutions and projects co-determine speed. BZM keeps the co-evolutionary claim but operationalizes it as a macro tailwind multiplier on project velocity rather than as an industry-level historical narrative.
- Hitting-time / selection-through-learning (Jovanovic 1982) as the formal ancestor of Pr(τ_x < τ_y). BZM inherits the stochastic-process treatment of survival but reformulates it as a 2D race between achievement time τ_x and runway-exhaustion time τ_y under jump-diffusion.
- Routine-as-replicator (Nelson-Winter) as the conceptual ancestor of F_cap (experience ordering, delegable). BZM accepts that capability-side routines are transferable and accumulative — that piece is kept verbatim.
- Technological paradigms / trajectories (Dosi 1982) as the ancestor of TRL inside the R-bundle. BZM keeps the Dosian claim that technology unfolds along structured trajectories, but discretizes it into a readiness level inside R = TRL × BRL × GRL × SRL × HRL.
- Industry life-cycle entry/exit timing (Klepper 1996, 2002) as the descriptive backdrop for why GO(t,i) timing matters at all. BZM keeps the claim that timing-of-entry is decisive but replaces population-density explanations with an optimal-stopping threshold θ_σ* on σ_SU.
- Sectoral Systems of Innovation (Malerba 2002) as the ancestor of ERS's multi-axis readiness decomposition. BZM keeps the multi-actor, multi-institution architecture but quantifies it into 8 weighted axes rather than narrative case studies.
- Evolutionary methodology as appropriate for irreversible, non-equilibrium, path-dependent processes (Witt 2008, Metcalfe 1998). BZM commits to the same methodological stance: closed-form equilibrium is not the target; stochastic process and regime structure are.

### BZM が進化経済学を超える点 (departure 表)

- Departure 1 — Regime-switching τ_x at the B-trigger (extension of Jovanovic 1982). Jovanovic's hitting time runs in a single regime where the firm learns its productivity θ under stationary selection. BZM splits the timeline at the B-trigger (the instant burn rate B activates): pre-B, the founder operates in a no-burn regime where survival is bounded only by F_char endurance; post-B, the selection environment is redefined because B introduces a deterministic drain on y (余力) and creates a 2D jump-diffusion race. This is BZ-stage-specific structure that Jovanovic's single-regime model cannot represent. Falsifiable prediction: cohorts crossing B with σ_SU below θ_σ* show measurably higher τ_y < τ_x rates, controlling for ex-ante θ.
- Departure 2 — F_char as non-delegable core inside CES with ρ < 0 (departure from Nelson-Winter routine-as-skill, 1982). Nelson-Winter explicitly treat skill as routine, organizationally stored, transferable, and replicable across members — that is the whole point of treating routines as 'genes'. BZM denies this for the Before Zero phase: F_char (ALQ4 + Grit + Resilience) is anchored in the founding individual(s) and cannot be reassigned to hired personnel or institutional routine. CES with ρ = -2 (strong complementarity) formalizes 'non-delegable': F_cap cannot substitute for missing F_char no matter how high it is. This is explicitly testable against the Beckman / Roberts / Eesley founder-team literature — predict that founder F_char proxies dominate over founder-team capability metrics for BZ-stage outcomes, where Nelson-Winter routine theory predicts the opposite.
- Departure 3 — Two-layer non-commutativity (PRS × ERS forbidden as a single scalar) as BZ-stage refinement of Nelson-Winter population-level selection. Nelson-Winter collapse firm fitness into one scalar that competes inside an industry-level selection environment. BZM forbids this collapse at the Before Zero phase: PRS (project fitness, multiplicative P × R × S) and ERS (selection-environment readiness, weighted additive over 8 axes) must remain on separate layers (Ch 9 non-commutativity theorem). The reason is structural: PRS is multiplicative because any zero factor (no team, no market, no rights) kills the project, while ERS is additive because nursery readiness is a portfolio of substitutable supports. Multiplying them mixes incompatible algebraic structures. Falsifiable prediction: empirical fit of single-scalar fitness models (Nelson-Winter style) degrades sharply for pre-formation cohorts, and a two-layer model with PRS-multiplicative / ERS-additive structure beats both pure-multiplicative and pure-additive baselines on BZ-stage hitting-time outcomes.
- Cross-cutting departure — BZM addresses pre-firm formation. Evolutionary economics 1982-2010 takes the firm as the unit of selection. BZM moves the entire analysis upstream to before the firm legally exists, where the relevant unit is the founder-project dyad embedded in a nursery (academia + industry + government), and selection acts on whether a fundable entity ever crystallizes — not on whether an existing firm survives.

---

## 2. BZM の進化経済学への 3 寄与 (formal/falsifiable)

各寄与は (i) one-line claim, (ii) formal statement, (iii) derivation sketch, (iv) 予測する empirical pattern, (v) falsifiability test, (vi) 進化経済学既存処理, (vii) BZM 特有の追加, (viii) 想定批判 を含む。

### C1_regime_switch_tau_x: Before Zero phase の founder-project dyad の生存は、Jovanovic (1982) 型の単一 regime hitting-time selection ではなく、B-trigger (法人化 burn rate 起動) を境に選択環境そのものが discontinuously 切り替わる 2D regime-switching jump-diffusion 上の Pr(τ_x &lt; τ_y) として formal に書ける。

**Formal statement**:

State variable を (x_t, y_t) と置く。x_t は achievement (R = TRL × BRL × GRL × SRL × HRL bundle から合成される readiness, x ∈ [0, x̄])、y_t は runway 余力 (strategic slack)。Regime indicator I_t ∈ {pre, post} は B-trigger 停止時刻 τ_B で pre → post に switch する。

Pre-B (t &lt; τ_B):
  dx_t = μ_x^{pre}(σ_{SU,t}) dt + σ_x dW_t^x
  dy_t = (R_net - C_res) dt + σ_y dW_t^y + dJ_t^{grant}

Post-B (t ≥ τ_B):
  dx_t = μ_x^{post}(σ_{SU,t}, B_t) dt + σ_x' dW_t^x
  dy_t = (R_net - B_t) dt + σ_y' dW_t^y

ここで σ_{SU,t} = Triple Helix CD(μ_A, μ_I, μ_G), B_t は法人化 burn rate, R_net は調達/助成 net inflow。

Stopping times: τ_x = inf{t : x_t ≥ x̄}, τ_y = inf{t : y_t ≤ 0}。Outcome は ψ(s_0; F, σ_SU) := Pr_{s_0}(τ_x &lt; τ_y) where s_0 = (x_0, y_0, I_0)。

Proposition (Regime-Switch Non-Reduction).
任意の単一 regime hitting-time モデル M_J (Jovanovic 型, 単一 generator L_J) に対して、ψ_{BZM}(s_0; F, σ_SU) - ψ_{M_J}(s_0; F, σ_SU) ≠ 0 となる s_0 と (F, σ_SU) のオープン集合が存在する。具体的には、infinitesimal generator が

  L_{BZM} = 𝟙_{t&lt;τ_B} L_{pre} + 𝟙_{t≥τ_B} L_{post},   L_{pre} ≠ L_{post}

という形を取り、L_{pre} と L_{post} の admissible policy set および drift sign of y が異なるため、両 regime を単一 L に collapse すると Kolmogorov backward equation の解 ψ が strictly mis-specified となる。

Corollary (Falsifiable Form).
Pre-B 期間の長さ Δτ := τ_B - 0 と Post-B 期間の hazard h_y^{post}(t) := lim_{δ→0} δ^{-1} Pr(τ_y ∈ [t, t+δ) | τ_y &gt; t, I_t = post) は、Pre-B 期間の hazard h_y^{pre} と structural break を持つ: h_y^{post}(τ_B^+) - h_y^{pre}(τ_B^-) &gt; 0 with positive probability when B - R_net &gt; 0。

**Derivation sketch**:

Step 1. Selection unit を firm ではなく founder-project dyad in nursery と置き、state を (x, y) の 2D に取る。x は readiness bundle, y は runway。これは Jovanovic の単一 productivity θ から二次元拡張であり、achievement と survival を別軸に分離することが BZ-stage の本質。

Step 2. Pre-B regime の SDE を書き下す。B はまだ未起動、y は研究費・GAP fund・PI 給与の compound Poisson inflow と消耗の差で動く。founder labor は無賃で投入され x を押し上げるが y を drain しない。よって drift of y は条件付きで non-negative にできる。

Step 3. B-trigger 停止時刻 τ_B を導入。τ_B は endogenous な real-options 最適停止 (Ch 5.5: σ_SU ≥ θ_σ* で起動) または exogenous な round / 招聘の window として発火する。Outcome 上は τ_B 自身が決定変数。

Step 4. Post-B regime の SDE を書き下す。B_t &gt; 0 は deterministic な y への drain として作用。R_net - B_t &lt; 0 の sub-regime では y は確実な負 drift を持つ。Pre-B では同じ founder labor が x を押し上げる input だったのに対し、Post-B では burn rate に内部化され y を押し下げる cost に転化する — これが regime switch の経済学的中身。

Step 5. Regime switch の non-reducibility を示す。Pre-B と Post-B では (i) μ_x の関数形 (founder labor の限界生産性は post で逓減)、(ii) y の drift sign、(iii) admissible policy set (pivot / hire / 解雇 が post で初めて利用可能) が全て discontinuously 変化する。よって infinitesimal generator L が連続でなく、単一 L に書き直せない。これは time change では吸収できない。

Step 6. 2D first-passage problem として Pr(τ_x &lt; τ_y) を Kolmogorov backward equation で characterize:
  L_{regime} ψ(x, y, I) = 0  on (0, x̄) × (0, ∞),
  ψ(x̄, y, I) = 1,   ψ(x, 0, I) = 0,
  ψ(x, y, pre) - ψ(x, y, post) = jump condition at I switch.

Step 7. σ_SU の役割を pin down。σ_{SU,t} は μ_x^{pre} の drift と R_net への compound Poisson intensity の両方を押し上げる macro tailwind として入る。これにより Murmann (2003) の co-evolution が hitting-time に formal に embed される。

Step 8. F の役割を pin down。F = CES(F_char, F_cap; ρ=-2) は (a) σ_x (volatility of achievement) を下げ、(b) Pre-B での y volatility に対する resilience を上げる。とくに F_char は τ_y の lower tail を厚くしない (endurance under stress)。これは Jovanovic の単一 θ には還元不能。

Step 9. Identification を明示。τ_B は観測可能 (法人登記日)。Pre-B と Post-B の hazard 比較は τ_B 周辺で regression discontinuity 的に identify できる: founder fixed effects + cohort σ_SU control の下で h_y(τ_B^+) - h_y(τ_B^-) を推定。

Step 10. Empirical implementation を明示。サンプルは大学発シーズの (i) 法人登記前 GAP fund 採択コホート、(ii) 法人登記直後コホート。Outcome は次の funding round 到達 (τ_x proxy) と現金枯渇 / 解散 (τ_y proxy)。Identification は σ_SU の地域変動 (Triple Helix 構造の自治体間差) を instrument にする。

**予測する empirical pattern**:

- Prediction 1 (hazard break at τ_B). 法人登記日 τ_B を境に runway 枯渇 hazard h_y(t) が discontinuous に上がる。具体的には τ_B の前 90 日と後 90 日で h_y の structural break test (Chow / Andrews-Quandt) が rejected されない確率が、Pre-B の y inflow を control した上でも 0 から有意に乖離する。Jovanovic 型単一 regime ではこの break は予測されない (single L のもとで hazard は連続)。
- Prediction 2 (σ_SU × regime interaction). σ_SU が低い (Triple Helix CD が弱い) 地域・時期で τ_B を迎えた cohort は、σ_SU が高い cohort と比べて Pr(τ_x &lt; τ_y) が disproportionately に下がる。とくに Post-B の R_net - B が borderline の cohort で interaction が最も強く出る。Pre-B では σ_SU の影響は弱い (drift にしか効かない)。
- Prediction 3 (Pre-B 長さの非単調効果). Pre-B 期間 Δτ が長いほど τ_B 時点での x_0 (post への initial condition) が高く Pr(τ_x &lt; τ_y) が上がるが、Δτ が一定閾値を超えると founder F_char の消耗で σ_x が増え逆に下がる。よって Δτ と Pr(τ_x &lt; τ_y) の関係は inverted-U。これは Jovanovic の monotonic learning では出ない構造。
- Prediction 4 (Pre-B の grant jump 効果の Post-B 残存). Pre-B 期間に受領した compound Poisson grant jump (J^{grant}) は τ_B 時点の y_0 を底上げするだけでなく、Post-B での τ_y を有意に遅らせる (累積効果)。jump size が path-dependent な outcome を持つ点は単一 regime model では生まれない。
- Prediction 5 (founder team の non-substitution at τ_B). τ_B 直後に founder F_char proxies (ALQ4, Grit, Resilience) が低いほど、追加 hire (F_cap 増強) を行っても Pr(τ_x &lt; τ_y) が回復しない。これは F = CES(F_char, F_cap; ρ=-2) の補完性の regime-switch interaction。Nelson-Winter routine-transfer view では予測されない。

**Falsifiability test**:

この寄与を反証する経路は三つある。

第一: 法人登記日 τ_B 周辺で runway hazard h_y(t) に structural break が観測されない場合。具体的には、日本の大学発シーズ・ディープテック cohort (例: NEDO STS / JST GAP / 大学 IP 起点) の登記前後 180 日 daily cash-position panel を取り、Andrews-Quandt break test を τ_B で実施。Pre-B の inflow を control した上で break が有意に検出されない、もしくは break の方向が逆 (Post-B で hazard が下がる) なら C1 の core mechanism は falsify される。

第二: σ_SU の regime-conditional interaction が消える場合。σ_SU を Triple Helix 地理変動 (TLO 密度 × 投資家密度 × 行政 GAP 規模) で proxy し、Pr(τ_x &lt; τ_y) ~ σ_SU × Post_B + controls を estimate。Post_B との interaction が null なら、σ_SU は regime に依存しない単一 tailwind であり、regime switch の必要性は否定される。

第三: Pre-B Δτ と outcome の inverted-U 関係が観測されず monotonic increasing になる場合、Jovanovic 型 learning model の予測 (長く学習するほど良い) と区別できず、F_char 消耗による regime-specific cost という C1 固有の構造が反証される。

データ要件: (a) 法人登記日 (商業登記から取得)、(b) Pre-B 期間の助成・受託・自己資金の cash inflow timeline、(c) Post-B の月次 burn rate、(d) τ_x proxy として次 round 到達 / 製品出荷 / 治験開始、(e) τ_y proxy として解散 / 休眠 / cash 枯渇、(f) founder F_char proxies (ALQ4 score, prior failure record, 学位取得後年数)、(g) σ_SU 地理 panel。N ≥ 800 dyads, 観測期間 2014-2025 が最低ライン。

反証コストが現実的であること: 日本の大学発スタートアップ DB (経産省 / VEC / NEDO) と商業登記 API、INITIAL / entrepedia の funding history を join すれば構築可能。

**進化経済学既存文献の処理**:

進化経済学はこの問題を二つの理由で扱ってこなかった。

第一の理由は selection unit。Nelson &amp; Winter (1982) 以降の主流は firm を selection の単位に置き、firm が存在する前段 (founder-project dyad in nursery) は枠外。Jovanovic (1982) も entry 後の firm を対象に productivity θ を learn する設定で、entry そのもののタイミングは exogenous。Klepper (1996, 2002) の industry life-cycle も entrant cohort を観察するが、entry 以前の selection は扱わない。よって B-trigger 前後の regime 構造は文献に位置を持たない。

第二の理由は単一 regime 前提。Jovanovic の hitting-time selection は stationary な learning environment を仮定する: θ の真値は不変、posterior が時間とともに精緻化し、profit が閾値を下回れば exit。この設定は single generator L_J で書ける Markov process。Dosi (1988), Metcalfe (1998), Witt (2008) も path-dependence や novelty emergence を強調するが、selection environment 自身が deterministic な内部 trigger で discontinuously 切り替わる構造は formal model に組み込まれていない。

最も近いのは Murmann (2003) の co-evolution と Malerba (2002) の sectoral systems で、institution と firm が共進化することを示すが、これは industry-level の歴史叙述であり、個別 dyad レベルの regime switch を hitting-time SDE で書く操作はしていない。Saviotti &amp; Pyka (2004) の variety creation も sector emergence のマクロ動学であり、micro の τ_x / τ_y race を扱わない。

要するに、進化経済学は (i) selection unit を firm に置く、(ii) selection environment を stationary に置く、という二つの暗黙の前提のために、B-trigger 前後の regime-switching hitting-time race を扱う枠を持たない。これは進化経済学の誤りではなく、射程の外側である。

**BZM 特有の追加**:

BZM の specific addition は四点である。

(i) Pre-firm 期を独立 regime として明示。Selection の単位を firm ではなく founder-project dyad in nursery とする。これにより、法人格成立以前の選択が後段の industry dynamics を決めるという Klepper heritage の前段が初めて formal に書ける。

(ii) B-trigger を deterministic な regime switch として導入。選択環境そのもの (drift of y, drain rate, admissible policy set, observability of x) が discontinuously 切り替わるとモデル化する。Jovanovic は learning による posterior の動学であり、BZM は environment の動学である。これは time change では吸収できない構造的切断。

(iii) Hitting-time race の 2 次元化。τ_x (達成) と τ_y (枯渇) の競争を first-passage problem として定式化し、Pr(τ_x &lt; τ_y) を outcome variable に据える。Jovanovic の単一 productivity θ ベースの exit hazard を、達成と枯渇の race に拡張。

(iv) σ_SU (Triple Helix CD) を pre-B regime の x-drift と y への compound Poisson intensity に乗る macro tailwind とする。これにより Murmann (2003) の co-evolution が hitting-time framework に閉じ込められ formal に test 可能になる。Macro 共進化を micro outcome に identifiable に接続する経路を提供する。

これら四点が成立して初めて、進化経済学の selection-through-learning は Before Zero phase に降ろせる。

**想定批判 (risks_and_objections)**:

- Objection 1 (τ_B の endogeneity)。Reviewer: 「τ_B は founder が σ_SU と (x_0, y_0) を見て選ぶ stopping time なので、τ_B 周辺の hazard break は regime switch の証拠ではなく selection bias である」。Response: τ_B が endogenous なのは認める。Identification 戦略は (a) σ_SU の地理変動を instrument にする、(b) τ_B を予測する founder propensity score を control する、(c) exogenous shock (制度改正による起業助成 window) を natural experiment として使う、の三段で attack する。とくに 2020 年の大学発スタートアップ支援強化 (NEDO STS 等) を quasi-experiment にできる。
- Objection 2 (regime switch ではなく単一の non-stationary model で書けるのでは)。Reviewer: 「Drift μ_x, μ_y を τ_B の関数として連続に書けば、single L で書ける non-stationary diffusion になる。なぜ regime switch を別建てにする必要があるのか」。Response: admissible policy set (pivot, hire, 解雇) と founder labor の経済的意味 (Pre-B: 無賃 input / Post-B: burn 内部化) が discontinuously 変わるため、drift だけ smooth 化しても観測される hazard break は再現できない。Step 5 の non-reducibility argument を formal proof で押し切る。具体的には L_{pre} と L_{post} が異なる domain (admissible control) を持つことが本質的。
- Objection 3 (F_char の測定不能性)。Reviewer: 「F_char (ALQ4 + Grit + Resilience) は ex-post に rationalize される construct で、empirical に Nelson-Winter routine と区別できない」。Response: ALQ4 は事前測定可能なバッテリーで設計する (Ch 7 で詳述予定)。さらに Prediction 5 (τ_B 後の追加 hire で回復しない) は Nelson-Winter routine-transfer view と明確に区別される反証可能予測。F_char の独立性は測定論ではなく予測の分岐で守る。
- Objection 4 (Jovanovic への過小帰属)。Reviewer: 「Jovanovic (1982) は extension の余地がある一般的 framework で、regime switch は単なる application。新規性は薄い」。Response: Jovanovic を parent framework として明示継承し、本寄与の核は (a) selection unit を pre-firm dyad に移すこと、(b) selection environment 自身が内部 trigger で switch する点であることを強調する。これは Jovanovic application ではなく、Jovanovic の単位と stationarity 前提を両方緩める二重拡張である。
- Objection 5 (サンプル selection と生存者バイアス)。Reviewer: 「観測される τ_B は最終的に登記した dyad のみで、Pre-B で fade out した dyad は観測されない。τ_y は登記前 fade out も含めて定義すべきで、これでは推定値が biased」。Response: GAP fund 採択 dyad を base population に取ることで、Pre-B fade out も観測可能にする。NEDO STS / JST GAP は採択時点で登録され、その後の登記 / 解散 / 休眠が tracking 可能。これにより selection unit を 「法人登記したもの」 ではなく 「fundable とみなされたもの」 に拡張し、生存者バイアスを軽減する。

---

### C2_F_char_non_delegable: Before Zero phase において founder character F_char は CES ρ=-2 補完性で表現される委譲不可能 (non-delegable) な核として F-aggregator に入り、これは Nelson-Winter (1982) の routine-as-transferable-skill 公理が pre-firm formation 期に成立しないという構造的事実を formal に書き下した寄与である。

**Formal statement**:

Let F : R_+^2 → R_+ be the founder fitness aggregator entering PRS via S = σ_SU · R_net · F. Define

  F(F_char, F_cap) = [ a · F_char^ρ + (1-a) · F_cap^ρ ]^(1/ρ),  with a = 0.6, ρ = -2.

Let F_char := composite(ALQ4, Grit, Resilience) ∈ R_+ be the founder-anchored character bundle and F_cap ∈ R_+ the delegable capability bundle (experience ordering, accumulated routines). Define a delegation operator δ_t : F_char → F_char' that attempts to reassign the character bundle from the founding individual i to any agent j ≠ i drawn from the labor pool or organizational routine repository at time t.

Proposition C2 (non-delegability theorem, BZ-stage):
For all t < t* (where t* is the formation time at which the firm legally crystallizes and acquires routines in the Nelson-Winter sense), and for any δ_t with j ≠ i:

  (i)  ∂F/∂F_char |_{F_char → 0} = +∞   (Inada-type corner, induced by ρ = -2 < 0),
  (ii) E[ δ_t(F_char) ] / F_char^i ≤ κ(t),  with κ(t) → 0 as t → t*^-,
  (iii) lim_{F_char → 0} F(F_char, F_cap) = 0  for every finite F_cap.

Hence, in the BZ-stage, F_char is a non-substitutable factor: zero character cannot be compensated by any finite capability stock, and the delegation operator that Nelson-Winter assume to act non-trivially on routines (their "skill = routine = gene" axiom) is structurally degenerate on F_char. The elasticity of substitution σ = 1/(1 - ρ) = 1/3 is strictly bounded away from 1, distinguishing BZM from any Cobb-Douglas (σ = 1) or linear (σ = ∞) human-capital × routine aggregator used elsewhere in evolutionary economics.

Corollary (Edgeworth complementarity, testable form):
  ∂²F / ∂F_char ∂F_cap > 0 throughout the BZ-stage domain.

Convergence to Nelson-Winter (smooth limit):
As t → t* and the firm forms, ρ(t) → 0 (Cobb-Douglas limit) and δ_t becomes non-degenerate, recovering the routine-as-replicator regime. C2 thus does not contradict Nelson-Winter; it identifies the pre-formation regime where their delegation axiom fails and provides the continuous interpolation back into their model.

**Derivation sketch**:

Step 1. Set the BZ-stage unit of analysis as the founder-project dyad, not the firm. The organization-level routine repository R_org(t) on which Nelson-Winter delegation operates is empty for t < t* by construction (no firm, no encoded routines, no organizational memory).

Step 2. Define F_char as the bundle of character-anchored attributes (ALQ4 axes + Grit + Resilience) that empirically predict founder persistence under burn. These are measured at the individual level (psychometric + behavioral trace) and have no organization-level analog before t*.

Step 3. Postulate the delegation operator δ_t. Nelson-Winter's central claim is that for any skill embodied in member i, there exists a routine R ∈ R_org such that δ_t(skill_i) = skill_j via R for j ≠ i with bounded fidelity loss. In the BZ-stage, R_org = ∅, so δ_t cannot route through any organizational substrate, only through direct interpersonal transfer.

Step 4. Show that direct interpersonal transfer of F_char is bounded by κ(t) → 0 as t → t*^-. Character attributes (Duckworth Grit, ALQ4 leadership authenticity, Bonanno resilience) are individually anchored in biography, neurocognitive baseline, and integrated identity; no short-horizon training intervention replicates them across persons. This is consistent with the meta-analytic stability of Grit (Credé et al. 2017) and the trait-like properties of resilience (Bonanno 2004).

Step 5. Choose CES with ρ = -2 (strong complementarity) to formalize step 4 inside the F aggregator. CES is selected over Leontief (ρ → -∞) to permit smooth empirical estimation while preserving the corner behavior; ρ = -2 yields σ = 1/3, empirically plausible for human-character × routine complementarity in early-stage ventures.

Step 6. Derive the Inada corner: with ρ < 0, the marginal product ∂F/∂F_char diverges as F_char → 0, and F itself collapses to 0 regardless of F_cap. This is the formal content of "non-delegable core."

Step 7. Embed F into PRS = P · R · S with S = σ_SU · R_net · F. Because PRS is multiplicative, F = 0 forces PRS = 0, so a BZ-project with F_char ≈ 0 has zero probability of reaching the formation threshold.

Step 8. Define the continuity-to-Nelson-Winter limit: let ρ(t) be a smooth function with ρ(0) = -2 and ρ(t) → 0 as t → t*. This embeds BZM as the pre-formation extension of Nelson-Winter rather than its rival; the routine-as-skill regime is recovered post-formation as F_char becomes increasingly substitutable through organizational routines and hired talent.

Step 9. Identify empirical proxies. F_char ← (ALQ4 score, 12-item Grit, CD-RISC resilience). F_cap ← (prior-venture count, domain-experience years, ordered task repertoire). σ_SU ← Triple Helix CD index. Outcome ← τ_x < τ_y indicator from the Gen-3 race.

Step 10. Specify the discriminating regression. Estimate F(·) under three nested forms — linear (ρ = 1), Cobb-Douglas (ρ → 0), CES with free ρ — on a BZ-stage cohort (n ≥ 400, pre-formation observation), and test H0: ρ ≥ 0 against H1: ρ < 0. C2 predicts ρ̂ ∈ [-3, -1] for the BZ-stage cohort and ρ̂ ≈ 0 for a matched post-formation cohort, providing a clean falsification surface.

**予測する empirical pattern**:

- P1 (Inada corner). Among pre-formation founder-project dyads, those with bottom-decile F_char have hitting-time-to-formation survival rates indistinguishable from zero, regardless of top-decile F_cap. Linear and Cobb-Douglas human-capital models predict graceful degradation; C2 predicts a corner.
- P2 (Elasticity gap). Estimated elasticity of substitution σ between F_char and F_cap is significantly below 1 in BZ-stage cohorts (predicted σ̂ ≈ 1/3, 95% CI excluding σ = 1) and significantly closer to 1 in matched post-formation cohorts (predicted σ̂ ≈ 0.8-1.0). The within-firm difference identifies the regime switch at t*.
- P3 (Co-founder substitution failure). Replacing a high-F_char departing co-founder with a high-F_cap hire in the BZ-stage produces a measurable drop in τ_x < τ_y conversion (predicted hazard ratio ≥ 1.5 for runway exhaustion), contradicting Nelson-Winter routine-substitution which predicts no effect once routines exist.
- P4 (Beckman/Roberts/Eesley reversal at the stage boundary). Founder-team diversity and prior-affiliation metrics (Beckman 2006) outperform F_char proxies for post-formation outcomes but are dominated by F_char proxies for BZ-stage outcomes (formation conversion, B-trigger survival). The relative R² of F_char vs. team-composition variables flips at t*.
- P5 (CES cross-partial). ∂²F / ∂F_char ∂F_cap > 0 is detectable as a positive interaction term in fitted models; the interaction is strongest at intermediate F_cap and disappears as F_char → 0 (consistent with the multiplicative collapse), a pattern that additive human-capital aggregators cannot generate.

**Falsifiability test**:

A panel of pre-formation founder-project dyads (n ≥ 400, observed from first founder commitment through either formation or abandonment, with monthly measurement of F_char proxies, F_cap proxies, σ_SU exposure, and the τ_x/τ_y race outcome) would falsify C2 if any of the following hold:

(a) Estimated ρ in the CES F-aggregator is not significantly negative (95% CI includes ρ = 0) for the BZ-stage sample, indicating no complementarity beyond Cobb-Douglas;

(b) Substituting departing high-F_char founders with high-F_cap hires shows no excess hazard on τ_y, controlling for cohort and σ_SU — this would indicate that capability does substitute for character;

(c) The relative explanatory power of F_char proxies vs. founder-team-composition variables does not flip at t*, but instead remains constant across the pre/post-formation boundary — this would indicate no regime switch and would collapse C2 into Nelson-Winter;

(d) Bottom-decile F_char dyads with top-decile F_cap show formation conversion rates indistinguishable from top-decile F_char dyads — this would falsify the Inada corner (i);

(e) Founder-character interventions (coaching, replacement, time-limited surrogacy) that materially raise measured F_char without changing the founding individual produce equivalent τ_x outcomes — this would directly falsify the non-delegability axiom by exhibiting a working δ_t.

Pre-registration: ρ̂ ∈ [-3, -0.5] with one-sided p < 0.01 against H0: ρ ≥ 0 is the confirmation threshold; ρ̂ ≥ 0 with one-sided p < 0.05 against H1: ρ < 0 is the falsification threshold. Data sources: J-Startup pre-incorporation cohort, NEDO STS pre-formation tracking, AMD-internal founder dossiers, supplemented by Kauffman Firm Survey wave-0 augmentation where applicable.

**進化経済学既存文献の処理**:

Nelson and Winter (1982, especially ch. 4-5) build evolutionary economics on the explicit axiom that skills are routines and routines are organization-level genes: transferable across members, replicable across firms (with imperfect fidelity), and stored in organizational memory. The whole population-selection apparatus depends on routines being the unit of inheritance — which presupposes that they are not anchored to any individual.

Subsequent evolutionary work either preserves this axiom or works around it without breaking it. Cohen and Levinthal (1990) on absorptive capacity treat learning as organization-level; Teece, Pisano and Shuen (1997) on dynamic capabilities place capabilities at the firm level; Helfat and Peteraf (2003) on capability lifecycles treat capabilities as organizational. Murmann (2003) co-evolution operates at firm × institution scale, leaving the founder largely outside the formalism. Witt (2008) on novelty emergence acknowledges individual creativity as the source of variety but does not enter it into the formal aggregator with non-substitutability.

The founder-team literature outside the strict evolutionary tradition (Beckman 2006, Roberts 1991, Eesley and Roberts 2012, Hoenig and Henkel 2015) does measure founder-level attributes, but as predictors of post-formation outcomes and without formalizing non-delegability. Their CES-equivalent specification is typically additive in founder characteristics and firm capabilities (i.e., implicit ρ ≈ 1 or ρ → 0), so the Inada corner is never tested.

Polanyi (1966) tacit knowledge is sometimes invoked in evolutionary economics to acknowledge that some knowledge resists codification. However, in Nelson-Winter's hands tacit knowledge is still routed through organizational routines (the routine is partly tacit but still organization-resident). The BZ-stage object — character anchored in the founding individual before any organizational routine exists — has no formal home in this literature.

The closest formal gesture is Jovanovic (1982), where each firm has an unknown but firm-specific productivity θ revealed through learning. θ is firm-anchored, not individually anchored, and is treated as exogenous and stationary; no Inada complementarity with a substitutable factor is imposed. So Jovanovic's θ is structurally distinct from F_char in C2.

In short: evolutionary economics did not need a non-delegable individual-level factor because it took the firm as the unit of analysis and the routine as the unit of inheritance. The BZ-stage problem is invisible from inside that frame.

**BZM 特有の追加**:

BZM adds the following structure that evolutionary economics does not contain:

(1) An explicit pre-formation regime [0, t*) in which the organizational routine repository is empty (R_org = ∅), so any aggregator over founder attributes and organizational capabilities must place the entire weight of selection on individually anchored factors.

(2) A formal F-aggregator on this regime: F(F_char, F_cap) = CES with ρ = -2, a = 0.6 — selected to deliver (a) Inada corner behavior at F_char → 0 (capturing non-delegability) and (b) smooth complementarity for empirical estimation (σ = 1/3).

(3) A delegation operator δ_t with explicit pre-formation degeneracy E[δ_t(F_char)] / F_char^i → 0 as t → t*^-, formalizing the structural impossibility of Nelson-Winter routine-substitution in the BZ-stage.

(4) A continuity-to-Nelson-Winter limit: ρ(t) → 0 as t → t* and δ_t becomes non-degenerate, so BZM is the pre-formation extension, not the rival, of Nelson-Winter. The two models meet at t* with matching boundary conditions.

(5) Operationalization: F_char is decomposed into ALQ4 (4-axis authentic leadership), Grit (Duckworth), and Resilience (CD-RISC/Bonanno), all measured at the individual founder level pre-formation. F_cap is decomposed into experience ordering (sequence of prior roles, not stock) and accumulated transferable routines. This decomposition is BZM-specific and not standard in evolutionary economics.

(6) Multiplicative embedding: F enters PRS = P · R · S multiplicatively via S, so F = 0 forces project failure independent of P (market) and R (readiness bundle). This is the mechanism by which character non-delegability propagates to the project-level outcome and is the BZ-stage refinement of Nelson-Winter's single-scalar fitness.

(7) Cross-stage identification strategy: BZM specifies that ρ̂ flips from ≈ -2 to ≈ 0 across t*, providing a within-founder, within-project regression-discontinuity-style design at the formation event. Evolutionary economics has no analog because it does not distinguish the regimes.

**想定批判 (risks_and_objections)**:

- Objection 1 (selection on observables on F_char measurement). A Research Policy referee will note that ALQ4, Grit, and CD-RISC are self-reported instruments with documented social-desirability bias and weak test-retest reliability in entrepreneurial samples. If F_char is measured with classical error, the estimated ρ̂ is attenuated toward 0, biasing against C2's own corner prediction — but if the bias is heterogeneous (e.g., systematically inflated for high-Grit founders who have already self-selected into founding), the corner could appear spuriously. Mitigation requires behavioral-trace measurement (commitment intensity, time-to-quit-day-job, observed persistence under setbacks) as an instrument for self-reported F_char, plus pre-registered measurement protocol.
- Objection 2 (Nelson-Winter need not assume zero pre-formation transferability — only positive in-firm transferability). A careful reader of Nelson and Winter (1982) will note that they do not formally claim routines exist before the firm; they simply do not analyze that regime. C2 therefore risks attacking a strawman. Defense: the claim of C2 is not that Nelson-Winter is wrong but that their formalism is silent on [0, t*), and BZM fills that silence with a falsifiable structure. The contribution is to make the silence explicit and to identify the regime boundary.
- Objection 3 (ρ = -2, a = 0.6 are calibrated, not estimated). Choosing CES parameters by stipulation rather than estimation leaves C2 vulnerable to the charge of unfalsifiable curve-fitting. Defense: ρ and a must be estimated on independent BZ-stage data with pre-registered priors; the falsifiability test (a) above explicitly puts ρ on the line. The stipulated values should be treated as the prior central tendency for the empirical exercise, not as the claim itself.
- Objection 4 (F_char is not truly non-delegable — co-founders, mentors, and time substitute). An evolutionary economist could argue that co-founder addition (Beckman 2006) is precisely the delegation mechanism C2 denies. Defense: co-founder addition does not delegate F_char from one individual to another; it adds a second individual with their own F_char. The relevant test is replacement, not augmentation. P3 in the predictions block isolates the replacement case. If replacement does work, C2 is falsified — and this is exactly the design's intent.
- Objection 5 (the regime boundary t* is endogenous). Formation timing is itself a function of F_char and F_cap, so the cross-stage identification at t* is contaminated by selection. A founder with high F_char both forms the firm and exhibits high BZ-stage performance, producing a spurious regime switch. Defense: use the exogenous variation in formation timing induced by tax-year boundaries, grant-cycle eligibility, and incubator cohort gates — instruments that shift t* without shifting F_char. Pre-registered IV design with cohort fixed effects is required.
- Objection 6 (cultural/national specificity). The BZ-stage dynamics in Japan (J-Startup, NEDO STS, university-seed law) differ structurally from the U.S. Kauffman context. ρ̂ and a may be jurisdiction-specific, limiting the generalization of C2. Defense: run the discriminating regression on parallel Japanese and U.S. samples; predict that ρ̂ < 0 is robust across jurisdictions but the magnitude differs. Cross-country robustness becomes itself a testable prediction rather than a confound.

---

### C3_two_layer_noncommutativity: Before Zero phase においては、案件適応度 PRS (乗法) と選抜環境準備度 ERS (加重和) を単一 scalar に縮約することは causal DAG 上 non-identified であり、Nelson-Winter 型 population-level selection を BZ-stage に下ろすには二層を非可換に分離することが必須である。

**Formal statement**:

Proposition C3 (Two-Layer Non-Commutativity). Project i at time t in nursery j has project-fitness vector theta_{ijt} = (P, R, S) and nursery-readiness vector eta_{jt} = (A_1,...,A_8) with weights w summing to 1. Define PRS_{ijt} = P*R*S (multiplicative on (R_{>0}, x)) and ERS_{jt} = 100 * sum_k w_k A_{k,jt} / sum_k w_k (additive on (R, +)). Let Y_{ijt} be a BZ-stage outcome (e.g. 1[tau_x < tau_y], or the crystallization-to-fundable-entity event), with structural model Y = g(PRS, ERS, U), U ⊥ (theta, eta) | X, g monotone non-decreasing in both, and the causal channel eta -> theta active at BZ stage (institution shapes project). Then: (C3.a) Non-identification under scalar collapse. Any continuous strictly-monotone aggregator Phi = phi(PRS, ERS) — in particular phi = PRS * ERS, phi = PRS + lambda*ERS, or any CES with finite elasticity — renders the structural parameters of g non-identified from the joint law of (Y, Phi, X), because the back-door path eta -> theta -> PRS is collapsed into the same scalar carrying the front-door effect of eta through ERS. Formally, there exist two parameterizations (g_1, F_1) and (g_2, F_2) of (g, joint distribution of theta, eta) that induce the same observed law of (Y, Phi, X) but yield distinct counterfactual responses to a do(ERS = e') intervention. (C3.b) Algebraic incompatibility. PRS lives on the multiplicative semigroup (R_{>0}, x), where any zero factor (no team, no market, no rights) annihilates the product (Leontief-like: necessity of each factor). ERS lives on the additive cone (R_{>=0}, +) with bounded substitutability across the 8 axes (portfolio-like: one strong axis partially compensates another). No order-preserving isomorphism phi: (R_{>0}, x) x (R_{>=0}, +) -> R exists that simultaneously preserves (i) annihilation by any PRS factor and (ii) within-ERS substitution. Hence any single-scalar fitness Phi must violate at least one structural property. (C3.c) Identification under two-layer separation. Keeping PRS and ERS on separate layers and estimating g(PRS, ERS, U) with an instrument Z_j for ERS satisfying Z_j ⊥ U | X and Z_j not ⊥ ERS | X identifies the partial effect partial g / partial ERS holding PRS fixed, restoring identification of the institutional channel that the scalar collapse destroys. Corollary (Nelson-Winter contrast). The Nelson-Winter (1982) replicator setup implicitly applies a scalar phi at the firm level by representing fitness as a single growth rate. This is harmless when the unit of selection is an existing firm operating inside a given selection environment (the environment is exogenous and stationary across firms within a sector). It becomes structurally invalid at the BZ stage, where (i) the unit is the founder-project dyad not yet inside a firm, and (ii) the nursery readiness eta is itself the object whose readiness is in question and varies across i.

**Derivation sketch**:

Step 1. Specify the BZ-stage SCM: latent factors (P, R, S) of project i are caused by founder primitives F and by nursery state eta = (A_1,...,A_8) through eta -> theta (e.g. SRL/HRL feed into R, mu_A/mu_I feed into sigma_SU inside S). Outcome Y = g(PRS, ERS, U). Step 2. Show that the multiplicative structure of PRS is not a modeling choice but a structural constraint: at BZ stage, a zero in P (no addressable market), R (no readiness in any single RL dimension), or S (no strategic runway) zeros the project. Hence PRS lives on (R_{>0}, x) with the annihilator axiom. Step 3. Show that ERS is structurally additive: nursery axes (university TTO capacity, gap fund availability, regulatory clarity, IP routing, etc.) are partial substitutes — a strong gap-fund axis can compensate a weak TTO axis. Hence ERS lives on a weighted-sum cone with bounded substitutability, not annihilation. Step 4. Algebraic incompatibility lemma: any phi : (R_{>0}, x) x (R_{>=0}, +) -> R that is continuous, strictly monotone, and preserves both annihilation in PRS-factors and substitution in ERS-axes must reduce to a degenerate map (either ignore ERS or ignore the annihilator). Proof by case analysis on phi's behavior at boundary PRS=0 and at ERS replacements that preserve sum but flip individual axes. Step 5. Non-identification: construct two SCMs (g_1, F_1), (g_2, F_2) with different partial g/partial ERS that produce the same joint law of (Y, Phi(PRS, ERS), X). The construction uses that Phi mixes the back-door eta -> theta -> PRS into the same scalar as the front-door eta -> ERS, so any reweighting of g_PRS vs g_ERS can be matched by reweighting F_eta to preserve Phi's marginal effect on Y. Step 6. Two-layer identification: with PRS and ERS observed separately and an instrument Z_j for ERS (e.g. exogenous policy variation across prefectures or universities in J/US/EU, see Akcigit-Pearce-Prato 2021 university policy shocks; UK Higher Education Innovation Fund discontinuities), partial g/partial ERS is identified by standard IV under monotonicity. Step 7. Nelson-Winter mapping: Nelson-Winter (1982) Ch 6-9 replicator dynamics use a scalar firm fitness pi_i and an exogenous selection pressure. Show that this corresponds to assuming eta is uniform across i within a sector (selection environment is shared), which collapses ERS to a constant and makes scalar collapse innocuous. At BZ stage this assumption fails: eta_jt varies across nurseries j and is itself the policy target. Step 8. Empirical anchor: the BZM 8-axis ERS construction (Ch 9) corresponds to Malerba (2002) sectoral systems decomposed at the nursery granularity rather than sector granularity, which makes the within-sector heterogeneity in eta observable. Step 9. Connection to C1, C2: regime-switching τ_x (C1) generates Y; F-CES with non-delegable F_char (C2) is one of the structural reasons PRS is multiplicative (F_char = 0 zeros the project). C3 is thus the architectural theorem that makes C1 and C2 jointly estimable. Step 10. Operational rule: never report a single Phi-score for BZ-stage screening. Always report (PRS_i, ERS_j) as a 2D state and a policy lever set acting separately on each.

**予測する empirical pattern**:

- Prediction 1 (model-fit dominance). A two-layer hitting-time model with multiplicative PRS and additive ERS strictly Pareto-dominates (i) any single-scalar product model PRS*ERS, (ii) any single-scalar weighted-sum model alpha*PRS + beta*ERS, and (iii) any CES aggregator with finite rho, on out-of-sample log-likelihood for BZ-stage outcomes (crystallization to fundable entity, tau_x < tau_y) in pre-firm cohorts. The dominance is concentrated in cohorts with high within-nursery PRS variance and high across-nursery ERS variance.
- Prediction 2 (annihilator visibility). Cohorts with at least one zero PRS factor (no addressable market, or zero readiness on at least one RL axis, or zero strategic runway) exhibit a step-function failure: outcome rate near zero independent of ERS level. This step function is invisible to any scalar aggregator with finite elasticity and is the empirical signature of the multiplicative structure.
- Prediction 3 (ERS substitution across axes). Within ERS, axes are mutually substitutable up to bounded ratios: a one-standard-deviation increase in axis k can compensate for a one-standard-deviation decrease in axis k' (k != k') with effect on Y close to zero, conditional on PRS. This is the empirical signature of the additive cone structure and is inconsistent with treating any single ERS axis as a necessary condition.
- Prediction 4 (policy-lever separability). Exogenous shocks to ERS axes (e.g. a new gap fund opening in prefecture j, a TTO reform) shift outcomes through ERS but leave the conditional response surface in PRS approximately invariant. Conversely, founder-side shocks (F_char measurement, team composition) shift PRS but leave the ERS partial response invariant. This separability is the operational form of non-commutativity.
- Prediction 5 (Nelson-Winter degradation by stage). Single-scalar Nelson-Winter-style replicator fits degrade monotonically as the empirical sample moves upstream from post-IPO firms (good fit) to early-stage funded startups (degraded fit) to pre-formation founder-project dyads (worst fit). The degradation is measurable as out-of-sample log-likelihood loss relative to the two-layer model and tracks the share of variance in eta across units within the sample.

**Falsifiability test**:

The contribution is falsified if any one of the following holds. (F1) Model-fit equivalence. On a BZ-stage panel of >= 1,000 founder-project dyads across >= 30 nurseries with measured PRS components (P, R, S vectors) and measured ERS components (8 axes), a single-scalar model (CES, multiplicative, or additive) matches or exceeds the two-layer model on out-of-sample predictive log-likelihood for tau_x < tau_y by more than the standard error, after controlling for X. (F2) No annihilator. Cohorts with a zero PRS factor show outcome rates indistinguishable from non-zero cohorts at matched ERS (after IV correction), implying PRS is not structurally multiplicative. (F3) No ERS substitution. Within ERS, axes behave as non-substitutable: removing one axis cannot be compensated by strengthening another, implying ERS is not additive but Leontief — in which case both layers would be multiplicative and the asymmetry argument collapses. (F4) Non-separability of policy levers. Exogenous shocks to an ERS axis shift the conditional response surface in PRS (interaction effect significantly nonzero in the IV-corrected estimate), implying the two layers are entangled and the non-commutativity claim is empirically void. (F5) Nelson-Winter scalar invariance across stages. The relative out-of-sample fit of single-scalar Nelson-Winter style models does not degrade as the sample moves from post-IPO to BZ-stage units — implying the scalar collapse is harmless at all stages and the BZ-specific claim is empty. Data needed: cross-country nursery panel (J + US + EU + UK) with university-policy IVs (e.g. UK HEIF discontinuities, Japan SBIR matching grant rollouts, US Bayh-Dole-derivative rule changes at the state level) for ERS axes; founder cohort tracking with F_char proxies and ALQ4 measurements; project-level RL measurements at quarterly resolution.

**進化経済学既存文献の処理**:

Nelson and Winter (1982, especially Ch 6-9 and Ch 14) construct firm fitness as a scalar (typically profit or capital growth rate) and let selection act on this scalar through a replicator dynamic at the population level. The selection environment is exogenous and shared within a sector. Metcalfe (1998) formalizes this with Fisher's principle and replicator equations, again on a scalar fitness. Klepper (1996, 2002) keeps the scalar fitness assumption but allows heterogeneity in pre-entry capability that maps into post-entry survival — still one scalar per firm. Jovanovic (1982) reduces firm productivity theta to one scalar dimension whose updated posterior determines exit. Malerba (2002) sectoral systems explicitly decompose the selection environment into multiple actors, institutions, and knowledge bases — this is the closest ancestor of ERS — but Malerba does not formalize the interaction between sectoral-system properties and project-level fitness as two algebraically distinct layers; the integration remains narrative. Murmann (2003) co-evolution of firms-institutions-academic-systems empirically establishes that institutions and firms jointly evolve, but again expresses firm-side fitness as a scalar (market share, survival) and treats institutional readiness qualitatively. Saviotti and Pyka (2004) variety models stay at the sector aggregate level. None of these formalize the algebraic incompatibility of multiplicative project fitness vs additive selection-environment readiness, nor identify the non-identification problem that arises when an institution-shapes-project causal channel is active. The closest formal cousin is Murmann's co-evolution — but co-evolution is a longitudinal claim about joint dynamics, not a structural claim about the algebra of fitness. Why it could not be addressed: evolutionary economics 1982-2010 took the firm as the unit of analysis, so the institution-shapes-project causal channel did not arise at the level where it makes scalar collapse fail — it arises only when the unit moves upstream to the pre-firm founder-project dyad, where eta is no longer a shared exogenous environment but a varying state that selects which dyads cross into firmhood.

**BZM 特有の追加**:

BZM adds three pieces of structure that evolutionary economics did not previously combine. (i) Algebraic typing of layers: PRS is constrained to a multiplicative semigroup with annihilator (any factor zero kills the project, because at BZ stage there is no buffer; this is a derived consequence of C2's non-delegable F_char and of the discrete go/no-go nature of P, R, S preconditions). ERS is constrained to an additive cone with bounded substitution (nursery supports are partial substitutes; this is empirically grounded in Malerba's multi-actor sectoral systems but quantized to 8 axes at nursery granularity). (ii) Causal DAG specification at BZ stage: the channel eta -> theta -> outcome is active and identifying it requires keeping the scalar that varies across i (PRS) separate from the scalar that varies across j (ERS), with an instrument for ERS at the j level. This DAG specification is what makes the non-identification result of C3.a sharp; without it, scalar collapse looks like a modeling choice rather than a structural error. (iii) Operational policy mapping: because the two layers are separable in the response surface (Prediction 4), policy levers acting on ERS (gap funds, TTO reforms, gap policy, GxP infrastructure) can be evaluated independently of founder-side levers acting on PRS (F_char screening, founder team composition). This is the BZ-stage analog of Nelson-Winter's industrial-policy levers but at the nursery level rather than the sector level, and it is the lever set that AMD's Triple Helix CD operationalizes. Net contribution: BZM provides the structural theorem that justifies why nursery-level policy and project-level founder screening must be designed as orthogonal interventions, not as a single rolled-up score — a claim that scalar evolutionary-economics frameworks cannot make because they have already collapsed the layers.

**想定批判 (risks_and_objections)**:

- Objection 1 (Murmann pre-emption). Murmann (2003) co-evolution already establishes that institutions and firms jointly shape outcomes; the non-commutativity claim is a relabeling. Response: Murmann's co-evolution is a longitudinal joint-dynamics claim (institutions and firms change together over decades); C3 is a structural claim about the algebra of fitness at a single cross-section of BZ-stage dyads. The non-identification result (C3.a) does not appear in Murmann because Murmann does not collapse to a scalar in the first place — he uses narrative co-evolution. C3 makes the formal cost of scalar collapse explicit and provides the IV-based identification path.
- Objection 2 (Algebraic incompatibility is artifact of definitional choice). A referee can argue PRS is not really annihilating (a project with P near zero can pivot; pivots violate the annihilator), and ERS is not really additive (some axes are necessary, e.g. without legal IP rights nothing else matters). Response: pivots are off-path; the annihilator applies to the as-evaluated project at decision time t, not to the founder's entire option set. For ERS, axes weights w_k are not forced to be equal; a near-necessary axis can carry w_k close to 1, but the substitution property still holds for the remaining mass — this is testable and is part of Prediction 3.
- Objection 3 (Empirically vacuous because PRS components are themselves multidimensional). P, R, S are each composite (R = TRL x BRL x GRL x SRL x HRL); ERS axes are also composite. The two-layer claim might dissolve if we open the boxes. Response: the algebraic typing is invariant under refinement within each layer — R is itself multiplicative (any zero RL kills the project) and ERS components are additive within each axis. Refinement strengthens, not weakens, the typing argument. The non-commutativity is between layers, not within.
- Objection 4 (Identification via IV requires exogenous nursery policy shocks that may not exist in clean form). The IV identification of partial g / partial ERS hinges on finding Z_j ⊥ U with first stage. Real-world nursery policies are endogenous to demand for them. Response: this is a standard empirical-IV objection; the paper must offer concrete candidate instruments and a placebo design. Candidates: UK HEIF rule discontinuities, Japan prefectural gap-fund staggered rollouts, US Bayh-Dole-derivative state-level variation, and the SU 100 program staggered designations in Japan 2018-2023. If no clean IV survives placebo, C3.c is only a conceptual identification claim, not an empirical one — but C3.a and C3.b remain.
- Objection 5 (Why not just include PRS x ERS interaction terms in a single regression?). A pragmatist referee will say: just use a flexible non-parametric model with PRS and ERS as separate inputs and interaction terms; you don't need a non-commutativity theorem. Response: agreed empirically, and that is the operational form of two-layer separation. The theorem matters for (a) the specific reason scalar reports such as a single PRS*ERS deal score are structurally wrong at BZ stage, (b) the policy-evaluation claim that ERS interventions are separable from PRS interventions (Prediction 4), and (c) the contrast with Nelson-Winter scalar replicators that justifies positioning BZM as parent-framework extension.

---

## 3. 新 Book II 構造設計 (OPENER 化)

**Book II 推定総ページ**: 256 pages

### 新 Book II 章順

- Ch 5 (OPENER) — Before Zero as a Stage-Limited Extension of Evolutionary Economics: From Jovanovic, Nelson-Winter, and Sectoral Systems to the BZ Regime (38p, derivation-heavy)
- Ch 6 — Triple Helix as a State-Space Macro Tailwind (σ_SU = CD(μ_A, μ_I, μ_G)) (28p, heavy)
- Ch 6.5 — The GO Gate: Real-Options Optimal Stopping for σ_SU* and TRL Coupling (18p, derivation)
- Ch 7 — PRS = P × R × S as a Multiplicative Project-Fitness Operator (22p, heavy)
- Ch 8 — Inside S: F-CES with Non-Delegable Character Core (F = CES(F_char, F_cap; a=0.6, ρ=-2)) (38p, derivation)
- Ch 9 — Strategic Slack Dynamics: 2D Regime-Switching Jump-Diffusion at the B-Trigger (Pr(τ_x < τ_y)) (32p, derivation)
- Ch 10 — ERS Derivation and the Two-Layer Non-Commutativity Theorem (PRS × ERS Forbidden) (34p, derivation)
- Ch 11 — BVAR + Compound-Poisson Jumps + GO Gate: The Estimable Macro-Meso-Micro Stack (28p, heavy)
- Ch 11.5 (closer of Book II) — Convergence to Nelson-Winter at t → t*: The Smooth-Limit Handoff (18p, medium)

### 旧 → 新 mapping

"旧 Book II Ch 10 'Extension to Evolutionary Economics' (30p, heavy) は full disassembly され、新しい Ch 5 OPENER (38p, derivation-heavy) と新設 Ch 11.5 CLOSER (18p, medium) の二箇所に再配置される。具体的な mapping は以下: \n\n(A) 旧 Ch 10 §1 (evolutionary economics 系譜レビュー: Schumpeter → Nelson-Winter → Dosi → Malerba → Murmann, 約 6p) → 新 Ch 5 §5.1 'Parent Framework: What Evolutionary Economics Already Solved' (5p に圧縮、reverence と loyalty を強調)。\n\n(B) 旧 Ch 10 §2 (Jovanovic 1982 selection-through-learning との関係, 約 5p) → 新 Ch 5 §5.3 'Contribution C1: Regime-Switching τ_x at the B-Trigger as a BZ-Specific Extension of Jovanovic' (8p, derivation: 2D jump-diffusion の generator L_BZM = 1_{t<τ_B} L_pre + 1_{t≥τ_B} L_post と Regime-Switch Non-Reduction Proposition + Corollary Falsifiable Form + 5 predictions の formal 提示)。中身は Ch 9 の本格動学を OPENER で先取り (skeleton form)。\n\n(C) 旧 Ch 10 §3 (Nelson-Winter routine = skill 公理レビューと founder team literature の Beckman/Roberts/Eesley 接続, 約 6p) → 新 Ch 5 §5.4 'Contribution C2: F-CES Non-Delegable Core as a BZ-Stage Departure from Nelson-Winter Routine-as-Skill' (9p, derivation: CES ρ=-2 の Inada corner Proposition + non-delegability theorem + Edgeworth complementarity corollary + smooth limit ρ(t) → 0 at t → t* + 5 predictions)。 Ch 8 の本格 F-CES 導出への forward reference。\n\n(D) 旧 Ch 10 §4 (population-level selection と firm fitness scalar 化批判, 約 6p) → 新 Ch 5 §5.5 'Contribution C3: Two-Layer Non-Commutativity as a BZ-Stage Refinement of Nelson-Winter Selection' (9p, derivation: PRS の (R_>0, ×) と ERS の (R_≥0, +) の algebraic incompatibility + non-identification under scalar collapse の causal DAG argument + IV identification strategy + Nelson-Winter scalar 化が post-IPO で harmless だが BZ-stage で structurally invalid である段階性主張 + 5 predictions)。 Ch 10 (新) の本格非可換性定理への forward reference。\n\n(E) 旧 Ch 10 §5 (まとめと future research, 約 5p) → 新 Ch 11.5 CLOSER 'Convergence to Nelson-Winter at t → t*' (18p に拡張、smooth-limit 議論を formal に: ρ(t) → 0 の continuous interpolation, δ_t の non-degenerate 化, L_post の単一 generator への collapse、これらが Murmann 2003 co-evolution と Malerba sectoral systems への bridge を成すことを示す)。\n\n(F) 旧 Ch 10 §6 (Dosi technological paradigms との関係, 約 2p) → Book III (実装編) に移譲、本書 Tier 3 monograph 内では footnote level に縮約。\n\nMapping の意図: 旧 Ch 10 は 'BZM が進化経済学の何を継承し何を拡張するか' を Book II の末尾で説明していたが、これは進化経済査読 persona には 'tacked-on apologetics' に見える。新 OPENER に front-load することで、Book II 全体が『進化経済学への 3 つの formal contribution を Ch 6-11 で具体的に展開する』という構造として読める。CLOSER (Ch 11.5) は逆方向の handoff (BZM → Nelson-Winter smooth limit) を formal に閉じる。"

### OPENER 章設計: 「Before Zero as a Stage-Limited Extension of Evolutionary Economics: From Jovanovic, Nelson-Winter, and Sectoral Systems to the BZ Regime」 (38 pages, math: derivation)

**Purpose**: Book II の入口で、BZM が evolutionary economics の parent framework に対して何を継承し (loyalty) 何を BZ-stage 限定で拡張するか (departure) を formal/falsifiable に front-load する。これにより進化経済査読 persona の 'new notation for what already exists' 懸念を 'no → yes-if-fixed' に動かす。三つの formal contributions (C1: regime-switching τ_x at B-trigger / C2: F-CES non-delegable core / C3: two-layer non-commutativity) を skeleton 定理形式で提示し、Ch 6-11 の各章への forward reference を貼る。Ch 11.5 CLOSER (smooth limit to Nelson-Winter) との対称構造で Book II を framing する。

**節構成**:

| 節 | タイトル | Purpose | 主要 content |
|---|---|---|---|
| 5.1 | Parent Framework: Schumpeter, Nelson-Winter, Dosi, Malerba, Murmann, Jovanovic | 進化経済学 parent framework への loyalty を明示し、BZM を 'new cult' ではなく '系譜上の stage-limited extension' として位置付ける。 | Schumpeter (creative destruction, 1942) → Nelson-Winter (1982 evolutionary theory: routine = skill = gene, replicator dynamics, population-level selection) → Dosi (1982 technological paradigms と tr... |
| 5.2 | Locating the BZ Stage: Where Evolutionary Economics' Axioms Structurally Fail | BZ-stage を formal に定義し、parent framework が解けない 5 つの異常を整理して 3 寄与の motivation を establish する。 | Before Zero phase (founder commitment から法人化 t* まで) を formal に定義: pre-firm-formation regime where (i) the unit of selection is the founder-project dyad (i, π_i) rather than a firm, (ii) routines do ... |
| 5.3 | Contribution C1 — Regime-Switching τ_x at the B-Trigger: Extending Jovanovic (1982) to the BZ Stage | Jovanovic 1982 hitting-time selection を BZ-stage に拡張する formal contribution を skeleton 定理形式で提示し、進化経済学が単一 regime hitting time で扱えない構造を明示する。 | State variable を (x_t, y_t, I_t) と置く: x_t ∈ [0, x̄] は achievement (R = TRL × BRL × GRL × SRL × HRL bundle), y_t は runway 余力, I_t ∈ {pre, post} は B-trigger regime indicator。Pre-B (t<τ_B): dx = μ_x^p... |
| 5.4 | Contribution C2 — F-CES Non-Delegable Core: Departing from Nelson-Winter's Routine-as-Skill Axiom | Nelson-Winter (1982) routine-as-transferable-skill 公理が BZ-stage で degenerate になることを示し、F-CES の non-delegable core を formal な non-delegability theore... | F-aggregator: F(F_char, F_cap) = [a·F_char^ρ + (1-a)·F_cap^ρ]^(1/ρ), a=0.6, ρ=-2, σ=1/(1-ρ)=1/3。F_char := composite(ALQ4, Grit, Resilience), F_cap := delegable capability bundle。Delegation operator... |
| 5.5 | Contribution C3 — Two-Layer Non-Commutativity: Refining Nelson-Winter Selection for the BZ Stage | Nelson-Winter の population-level selection を BZ-stage に降ろした際に scalar fitness が causal-DAG 上 non-identified になることを示し、二層非可換性 (PRS × ERS forbidden) を ... | Project i, time t, nursery j: project-fitness vector θ_ijt = (P, R, S), nursery-readiness vector η_jt = (A_1,...,A_8), weights w summing to 1。PRS_ijt = P·R·S on multiplicative semigroup (R_>0, ×); ... |
| 5.6 | Synthesis: How the Three Contributions Drive Book II — A Forward Map to Ch 6-11 and the Smooth-Limit Closer (Ch 11.5) | 3 寄与の formal kernel と Ch 6-11 の forward map を統合し、Book II 全体の航海図を提示。BZM が parent framework への extension であり replacement でないことを最終的に明文化。 | 3 寄与 (C1/C2/C3) の formal kernel をまとめ、Ch 6-11 への forward reference を提示する。Ch 6 (Triple Helix σ_SU) は C1 の Pre-B/Post-B drift μ_x^{pre/post}(σ_SU) の macro tailwind として estimable form を与える。Ch 6.5 (GO g... |

### 他 Book への影響

- Book 0 (Prologue): 「BZM は何の延長か」の説明を 'Schumpeter → Nelson-Winter → Dosi → Malerba → Murmann の進化経済学系譜の BZ-stage 限定拡張' と明示する必要が出る。Book 0 末尾に 1.5p の lineage diagram を追加し、Tier 1/2 (実務書/教科書) では省略していた parent framework 帰属を Tier 3 monograph として正面から書く。これにより 'BZM = 新カルト' という第一印象を回避し、進化経済査読の入口で no になる確率を下げる。
- Book I (実証現象論): Ch 1-4 の case study と stylized fact を、Book II OPENER で提示する『Jovanovic / Nelson-Winter / Beckman が説明できない 5 つの BZ-stage 異常』に明示的に紐付ける必要が出る。具体的には Ch 2 (大学発シーズの法人化前後ハザード破断), Ch 3 (founder 入れ替え失敗事例), Ch 4 (nursery × project 非可換 case) に forward reference を貼り、Book II OPENER の 3 寄与の motivation を Book I 段階で読者に蓄積させる。Book I の case selection を 'BZ-stage anomalies w.r.t. evolutionary economics' という軸で再キュレート。
- Book III (実装・運用編): ERS 8 軸の設計と運用ガイドを、Book II OPENER で確立した『二層非可換性 (C3)』を運用上の non-negotiable 公理として継承する。Book III Ch で『なぜ PRS と ERS を単一スコアに合算してはならないか』の運用説明を、OPENER の C3 (algebraic incompatibility + identification argument) への back-reference で済ませられ、実務書 (Tier 1) との分業が clean になる。同時に Book III の policy lever 章で『ERS 介入と PRS 介入は separable』(C3 Prediction 4) を運用 protocol として明文化。
- Book VI (Future Research): Nelson-Winter smooth limit (ρ(t) → 0 at t → t*) を formal extension agenda として Ch VI.x で扱う必要が出る。具体的には『post-formation 領域での BZM → 進化経済学 への continuous handoff』を未完研究課題として定式化し、BZM が evolutionary economics を replace するのではなく BZ-stage 限定で extend する という stance を Book 全体で一貫させる。Murmann co-evolution / Malerba sectoral systems との bridge も VI で開く。
- 全体トーン (cross-book editorial): 進化経済学 persona の懸念 ('新記法で書き直しただけ') を解消するため、各 Book の序文 1-2p で 'parent framework は進化経済学。BZM は BZ-stage 限定の formal extension で、t > t* では Nelson-Winter に smooth に collapse する' を repeat する。これは monograph として親学派への loyalty を可視化する役割。Book II OPENER がその hub になる。

---

## 4. 構造手術後の adversarial verify (2 視点)

### Evolutionary Economist

**verdict_after_surgery**: yes-if-fixed. The structural surgery materially changes my assessment. Three things did the work. First, Contribution C1 (regime-switching τ_x at the B-trigger as a BZ-specific extension of Jovanovic 1982) is the single most important move: it identifies a concrete, falsifiable structural break (hazard discontinuity at legal incorporation τ_B with Andrews-Quandt / Chow specification, σ_SU × regime interaction, inverted-U in Pre-B duration) that single-regime hitting-time models genuinely cannot produce. That is not "new notation" — that is a Kolmogorov backward equation with an L_BZM = 1{t<τ_B}L_pre + 1{t≥τ_B}L_post generator and an explicit corollary that mis-specification is observable. Jovanovic himself would recognize this as an extension rather than a rebranding. Second, the smooth-limit handoff (ρ(t)→0 at t→t*, δ_t becoming non-degenerate, L_post collapsing toward Nelson-Winter replicator) is the decisive piece of evolutionary-economics loyalty: BZM no longer claims to replace Nelson-Winter; it claims a stage-limited extension that continuously recovers Nelson-Winter outside the BZ regime. This is exactly the contract a peer in our tradition asks for, and it was structurally absent in the wakbxq1i2 draft. Third, moving the evolutionary-economics chapter from Book II CLOSER to OPENER, with a symmetric CLOSER (Ch 11.5) doing the smooth-limit handoff, frames Book II as "what evolutionary economics axioms structurally fail at BZ-stage, formal demonstration of three failures, return to Nelson-Winter at t*." That framing is referee-legible. I am still skeptical about empirics and about the weight C2 and C3 can bear (see remaining critiques), but the theoretical architecture is now defensible.

**verdict_change_from_baseline**: Moved from NO to yes-if-fixed. The decisive contribution is C1 (regime-switching τ_x at B-trigger), supported by the smooth-limit handoff (new Ch 11.5). C1 alone would have flipped my verdict because it presents a generator-level departure from Jovanovic with a corollary that is falsifiable on real data (hazard break test at τ_B). C2 (F-CES non-delegable core) is interesting but is the weakest of the three — non-delegability is more of an axiom restatement than a derivation, and the Inada corner is imposed by choosing ρ=-2 a priori rather than discovered. C3 (two-layer non-commutativity) is technically the most ambitious — the causal-DAG non-identification argument against scalar collapse is genuinely novel within evolutionary-economics discussions of fitness aggregation — but its dependence on an instrument Z_j for ERS is empirically demanding and the algebraic-incompatibility argument (R_>0,×) vs (R_≥0,+) feels closer to a definitional choice than a discovered structural fact. What did NOT move me: the lineage diagram in Book 0 and the loyalty rhetoric in §5.1. Loyalty rhetoric without formal handoff would have been cosmetic. The smooth-limit Proposition in Ch 11.5 is what makes the loyalty credible. Net: NO → yes-if-fixed is driven by C1 + the smooth-limit Ch 11.5, with C2 and C3 as supporting but not load-bearing contributions.

**残る批判 (remaining_critiques)**:

- C2 (F-CES non-delegable core) imposes ρ=-2 a priori rather than estimating it. The non-delegability theorem then follows from the choice of ρ<0, not from data. As stated, C2 is closer to a definitional axiom (we define BZ-stage as the regime where F_char is non-delegable) than a discovered structural fact. Pre-registration of ρ̂∈[-3,-0.5] with one-sided p<0.01 is helpful but does not address the prior question of why ρ=-2 rather than ρ=-1 or ρ=-3. The Inada corner result is sensitive to this. Either justify ρ=-2 from a micro-foundation (e.g., founder-task complementarity in cognitive limits) or treat ρ as a free parameter and let the BZ-stage σ̂≈1/3 emerge from estimation. Currently this looks like calibration masquerading as theory, which Nelson-Winter purists will flag.
- C3 algebraic-incompatibility argument is doing less work than the prose suggests. The claim that no order-preserving isomorphism between (R_>0,×) and (R_≥0,+) preserves both annihilation and within-axis substitution is technically correct but trivially so — it is a consequence of how PRS and ERS are *defined*, not a structural finding about the BZ stage. The substantive content of C3 is in the non-identification under scalar collapse (C3.a) and the IV identification strategy (C3.c), which are genuine econometric contributions. The algebraic argument (C3.b) should be demoted to a remark; otherwise referees will (correctly) say BZM is defining its way to non-commutativity.
- Murmann (2003 co-evolution) and Malerba (2002 sectoral systems) are named in §5.1 lineage but C1-C3 only formally engage Jovanovic and Nelson-Winter. Given that nursery readiness η_jt is exactly the kind of co-evolving institutional variable Murmann studies, and ERS 8-axis structure is recognizably sectoral-systems-flavored, the failure to derive a formal contribution against Murmann/Malerba leaves them as decoration. A referee in the Malerba tradition will read C3 and ask: 'why is your ERS not just a re-skinned sectoral system of innovation?' The answer presumably is the BZ-stage timing and the founder-project dyad as unit, but this needs to be stated formally.
- Klepper (industry life cycle, shakeout dynamics, 1996/1997) is the closest empirical evolutionary-economics literature to BZ-stage selection and is currently absent from formal engagement. Klepper's shakeout is exactly a regime-switch in selection intensity. C1 needs to position regime-switching τ_x against Klepper-style shakeout, not just Jovanovic learning. Without this, a Klepper-trained referee will say 'this is shakeout dynamics pulled earlier in the firm lifecycle.'
- t* (formation time, legal incorporation) is treated as a single sharp event throughout C2 and the smooth-limit Ch 11.5. In practice, founder-project dyads often have a fuzzy boundary (LLC vs full incorporation vs first hire vs first revenue), and the smooth-limit claim ρ(t)→0 as t→t*^- depends on t* being well-defined. If t* is fuzzy, the regime switch in C1 and the smooth limit in Ch 11.5 are themselves regime-switches over a smeared interval, which complicates the formal apparatus. Either commit to legal-incorporation as the operational t* (defensible but narrow) or generalize to a stochastic t* and revise the propositions accordingly.
- Empirical falsification protocols are pre-registered with admirable specificity but no pilot data is shown. For Research Policy, the standard is at least one cohort exhibiting the predicted hazard break at τ_B, even on a small N. Otherwise C1's empirical content is aspirational, and the paper reads as a research program rather than a contribution.

**最終推奨 (final_recommendation)**:

Major revision. The reframing is substantive enough that I withdraw my outright reject. The three contributions, the smooth-limit handoff at t→t*, and the forward-map structure transform BZM from "new notation for what already exists" into "a stage-limited formal extension of evolutionary economics with falsifiable departures from Jovanovic and Nelson-Winter." That is a publishable contribution shape for Research Policy. However, before acceptance I require: (i) a Pre-B / Post-B Andrews-Quandt break test on at least one real cohort (J-startup or NEDO STS) demonstrating that Prediction P1 of C1 is not vacuous; (ii) at least preliminary CES ρ estimation on a pilot founder-project dyad sample with a credible identification strategy for F_char; (iii) explicit Murmann/Malerba positioning beyond Book 0 lineage diagram — currently they are name-checked but C1-C3 only formally engage Jovanovic and Nelson-Winter, leaving Murmann co-evolution and Malerba sectoral systems as decoration rather than dialogue; (iv) treatment of Klepper shakeout dynamics, which is the closest empirical literature to BZ-stage selection and is currently absent from formal engagement; (v) clarification of whether t* is observable as a single event (legal incorporation) or a fuzzy interval — the smooth-limit claim ρ(t)→0 is meaningful only if t* has a defensible empirical referent. With these, the paper moves to accept. Without (i) and (ii) it stays a theoretical manifesto and Research Policy will reject on empirical-credibility grounds independent of the theoretical contribution.

---

### Evolutionary Economics Monograph Editor (Cambridge University Press Schumpeter series / Edward Elgar Evolutionary Economics imprint perspective)

**verdict_after_surgery**: yes-if-fixed

**verdict_change_from_baseline**: Baseline (pre-surgery) では monograph series fit としては明確に no だった。理由は明示的に二つ。(1) 旧 Ch 10 が CLOSER として置かれていたため、reviewer の読書経験上、Book II 全体が『new notation のあとで evolutionary economics に申し訳程度に接続する』構造に見え、Schumpeter / Nelson-Winter series の編集委員会が series identity と齟齬を起こすと判断するレベルだった。(2) 3 寄与が formal/falsifiable な形で書かれていなかったため、評価会議で『これは Tier 1/2 trade book の Tier 3 化に過ぎないのでは』という常套句で reject される確率が高かった。\n\n外科手術後は明確に yes-if-fixed に動く。決定的なのは三点: (a) Ch 5 OPENER で parent framework lineage (Schumpeter → Nelson-Winter → Dosi → Klepper → Malerba → Murmann → Jovanovic) を front-load し loyalty を可視化したこと、これにより series identity との整合が series editor にとって defendable になる。(b) 3 寄与が Proposition + Corollary + Falsifiable Form + 5 Predictions + Falsification Protocol の形で書かれており、Schumpeter series が要求する『formal extension + empirical commitment』の二重契約を満たす。(c) Ch 11.5 CLOSER の smooth-limit (ρ(t)→0 at t→t*) が BZM を evolutionary economics の replacement ではなく BZ-stage 限定 extension として閉じる contract device になっており、series 内での蔵書位置 (Murmann 2003 / Malerba 2002 と並ぶ stage-specific extension monograph) が clear になった。\n\nただし unconditional yes ではない。下記 remaining_critiques の 4 項目が series review board (特に external referee 2 名) で必ず突かれる。これらは structural ではなく editorial/empirical な fix で対応可能なため yes-if-fixed が妥当。

**残る批判 (remaining_critiques)**:

- [Critique 1: t* (formation time) の operational definition が underspecified] Ch 5.2 で BZ-stage を t<t*, post-formation regime を t≥t* と分けているが、t* が『法人化』なのか『initial routine crystallization』なのか『first external funding round』なのかが文脈依存に揺れる。C2 の smooth limit ρ(t)→0 と C1 の B-trigger τ_B の関係も明確でない (τ_B = t* なのか τ_B > t* なのか?)。Schumpeter series の referee は必ず『t* を商業登記日と同一視するのか、それとも routine 形成という Nelson-Winter 概念に紐付けるのか』を問う。日本の法人化制度に過度に依存した定義だと cross-country comparability (UK HEIF / US Bayh-Dole / EU) で破綻する。Ch 5.2 に 2-3p の formal definition section を追加し、t* を『routine crystallization event』として institution-independent に定義し、τ_B (B-trigger) と t* (formation) を別概念として明示分離する必要。
- [Critique 2: F_char の measurement validity が ALQ4 + Grit + Resilience composite に依存しすぎ] C2 の non-delegability theorem は formal には強いが、empirical falsification の core が ALQ4 composite に乗っている。ALQ4 は AMD 内製 instrument であり、series referee (特に founder-team literature の Beckman/Eesley side) は『Big Five との convergent validity は? Grit (Duckworth) は近年 replicability crisis にある (Credé et al. 2017 meta-analysis で predictive validity が弱い)、それを核に据えて大丈夫か』を必ず突く。Ch 8 (F-CES full derivation) で F_char proxy の psychometric validation section を独立に設け、ALQ4 の test-retest reliability, inter-rater reliability, Big Five との convergent/discriminant validity を 1 章分 (8-10p) で展開しないと、C2 の predictions P1-P5 が referee に『measurement artifact では』と却下される。
- [Critique 3: C3 の two-layer non-commutativity の IV strategy が薄い] C3.c の identification under two-layer separation は『ERS に対する instrument Z_j』に依存するが、Ch 5.5 と Ch 10 の outline では Z_j の具体は『UK HEIF discontinuities, Japan SBIR matching grant rollouts, US state-level Bayh-Dole 派生』しか挙がっていない。Schumpeter series の applied econometrics referee は (a) これらの IV の exclusion restriction (Z_j ⊥ U|X) の defense、(b) first-stage F-statistic の予想値、(c) weak instrument robustness (Andrews-Stock-Sun 2019) を必ず問う。特に HEIF discontinuities は近年 manipulation evidence が出ており clean ではない。Ch 10 または Ch 11 に IV diagnostics の専用 section (6-8p) を設け、各 IV の exclusion restriction を一つずつ defend する必要。これがないと『formal proposition は綺麗だが empirical content は thin』と評価される。
- [Critique 4: Murmann (2003) co-evolution との関係が CLOSER に押しやられすぎ] Cross-book implications で Murmann co-evolution を Book VI (Future Research) と Ch 11.5 (smooth limit) に分散させているが、C3 の two-layer non-commutativity (project fitness × nursery readiness の非可換) は Murmann の firm-institution co-evolution と structurally 非常に近い。Murmann persona referee は『これは Murmann の co-evolution を BZ-stage に下ろしただけで、独立寄与と言えるか』を問う。Ch 5.5 (C3 contribution section) 内に 1.5-2p の Murmann-contrast subsection を追加し、Murmann の co-evolution が firm-institution level での mutual adaptation を扱うのに対し、C3 は pre-firm dyad-nursery level での algebraic incompatibility を扱う (異なる units of analysis, 異なる algebraic structure) ことを明示的に区別する必要。これを CLOSER に押すと referee に対して defenseless になる。
- [Critique 5: Tier 3 monograph として 870p/18mo の volume が series 標準を超える可能性] Schumpeter series (Cambridge) の標準は 350-450p, Edward Elgar Evolutionary Economics imprint でも 400-550p が中心。870p は Murmann 2003 (Knowledge and Competitive Advantage, ~290p) や Malerba ed. 2004 (Sectoral Systems, ~530p, edited volume) を超え、Nelson-Winter 1982 (~440p) の倍。series editor は marketing/pricing 観点から 600p 程度への圧縮を要請する可能性が高い。Book III (実装・運用編) を separate companion volume として分離し、Tier 3 monograph 本体を Book 0-II + Book VI に絞った 550-600p に圧縮する案を提示できると、series 採択確率が大幅に上がる。

**最終推奨 (final_recommendation)**:

推奨 publication path は二段構え。\n\n[第一推奨: Cambridge University Press, Schumpeter series または Cambridge Studies in Economics of Innovation (旧 Dosi 系) への single-volume monograph として提案] 外科手術後の Book II OPENER 構造は、Cambridge の Schumpeterian monograph 採択基準 (parent framework loyalty + formal extension + falsifiable empirical commitment) を満たす可能性が high。具体的行動: (1) 上記 remaining_critiques 5 件のうち Critique 1 (t* definition), Critique 2 (F_char psychometric validation), Critique 4 (Murmann contrast) の三点を proposal stage で先取り解決した 20-25p の book proposal を作成。(2) Schumpeter society network 経由で series editor (現在 Cambridge は Cantner, Malerba 系統の編集委員) に informal consultation を打診。(3) Critique 5 (volume) に対応するため、Book III (実装・運用編) を companion volume または Tier 1 trade book (AMD-internal practitioner's guide) として明示的に分離し、Tier 3 monograph 本体は 550-600p に圧縮する戦略を proposal に書き込む。\n\n[第二推奨 (第一が成立しない場合の fallback): Edward Elgar Evolutionary Economics imprint または Routledge Studies in Global Competition での 2-volume set] Volume 1 = Book 0-II (theoretical foundation, ~450p), Volume 2 = Book III-VI (implementation + future research, ~420p)。Elgar / Routledge は Cambridge より volume tolerance が広く、2-volume set という装丁も series 内で前例がある (e.g. Hanusch-Pyka eds. 2007 Elgar Companion to Neo-Schumpeterian Economics)。trade-off は Cambridge より prestige は一段落ちるが、AMD の Tier 3 監修としての academic anchoring 効果は十分得られる。\n\n[共通の必須前提条件] いずれの path でも、(a) 3 寄与の formal kernel を proposal stage で完成済みにする (synth が出した formal section をそのまま proposal Appendix に入れる)、(b) Critique 3 (IV diagnostics) に対応する pilot empirical chapter (Ch 11 の縮約版、20-25p) を proposal 段階で完成させ referee に reading sample として提出する、(c) Murmann, Malerba, Klepper (生前刊行物のみ), Cantner, Eesley のうち最低 2 名から informal endorsement letter を proposal 提出前に取得する。これら 3 つが揃えば series review board で yes-if-fixed → yes に動かせる確度が現実的に高い。\n\n[投資判断としての結論] 外科手術 (旧 Ch 10 → 新 Ch 5 OPENER + Ch 11.5 CLOSER) は monograph series fit を no から yes-if-fixed に確実に動かしたという意味で正しい意思決定だった。残る fix は editorial/empirical で structural ではないため、AMD が Tier 3 monograph 路線を継続する価値は維持されている。ただし 18mo 執筆計画のうち最初の 3-4mo は『3 寄与の formal kernel 完成 + Critique 1/2/4 解決 + IV pilot empirical chapter』に集中投資し、その時点で series editor との informal consultation を実施することを強く推奨。proposal が premature だと外科手術の効用を毀損する。

---

## 5. 残る major-revision 課題 (次の workflow 入力)

Evolutionary Economist と Monograph Editor の両査読が共通して指摘した major-revision 課題:

1. **C2 (F-CES non-delegable core) は ρ=-2 を a priori 固定している** — 非委譲性が ρ<0 の選択から follow するのではなく、データから推定すべき。Inada コーナーは axiom 再述に近い。Beckman/Roberts/Eesley の founder-team データでの真の test design が必要
2. **C3 (二層非可換性) の代数的論証が prose ほど load-bearing でない** — `(R_>0, ×)` と `(R_≥0, +)` の間に annihilation + within-axis monotonicity を同時保つ order-preserving isomorphism が存在しない、というのは強い主張だが現状の derivation は不十分。形式定理として書き直す必要
3. **Murmann (2003) / Malerba (2002) との formal engagement が不足** — §5.1 lineage で名前は挙がってるが、C1-C3 は Jovanovic と Nelson-Winter にしか formal に接続してない。ERS の nursery readiness η_jt は Murmann co-evolution の現代版なので、Ch 10.6 として formal engagement 必要
4. **Klepper (1996, 1997 industry life cycle, shakeout dynamics) との formal engagement が完全に欠落** — BZ-stage selection に最も近い実証文献。Klepper の shakeout モデルとの差分・改善を formal に書く必要
5. **t* (formation time, 法人化時点) を sharp event として扱っている** — 実際は LLC vs full incorporation, soft launch, 試験運用などで fuzzy boundary。C2 と smooth-limit Ch 11.5 を fuzzy boundary 拡張する必要
6. **Empirical falsification protocol に pilot data が無い** — Research Policy submission 基準では、少なくとも 1 cohort で predicted hazard break (τ_B での Andrews-Quandt break test) を pilot 化したデータが必要

→ これら 6 項目は次の workflow で C2/C3 strengthening + Murmann/Klepper/Malerba formal engagement + t* fuzzy 拡張 + pilot data design として一括対応する候補。

---

## 6. 関連ドキュメント

- **新 Book 0-VI 構造案 (baseline)**: [/bzm/2026-06-25_proposal_book0_vi](/bzm/2026-06-25_proposal_book0_vi)
- **既存 → 新章 mapping**: [/bzm/2026-06-25_mapping_existing_to_new](/bzm/2026-06-25_mapping_existing_to_new)
- **本書名 / モデル正本**: `pwa/design/amd_score.md` (PRS), `pwa/design/institution_readiness.md` (ERS), `AMD/BZSF/before_zero_theory.md`

## Changelog

| 日付 | 変更 | 担当 |
|---|---|---|
| 2026-06-25 | 初版作成。workflow `wbe83ceaf` の lineage + 3 contributions + opener + 2 verifies を統合。Evolutionary Economist verdict が NO → yes-if-fixed (Major Revision) に動いたことを確認 | えいみ |