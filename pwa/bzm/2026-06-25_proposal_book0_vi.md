# BZM Book 0–VI 構造再設計案 (synth 出力)

*生成: 2026-06-25 / source: workflow `wakbxq1i2` (26 agents, 1.6M tokens, 25 min wall clock)*

*位置付け: BZM (Before Zero Model) の章構成を Book 0–VI + 付録に根本から再設計する提案物。本文ではない。本文ドラフトは `pwa/bzm/` 直下の各章 md。本ドキュメントは「現状ドラフト → 新構造」の transition plan として読む。*

*生成プロセス: 5 経済学者 persona の adversarial critique + 2 coherence 監査を吸収済み。4/5 が `yes-if-fixed`、1 (進化経済) が `no` → synth はそれらの強化要求を吸収して構造を補強した最終形。*

---

## 0. ボトムライン

- **Total: 870 pages / 18 months**
- Books: 0, I, II, III, IV, V, VI + 付録 A/B/C
- ターゲット: Tier 3 学術モノグラフ (Research Policy / R&D Management / Industrial and Corporate Change)
- スコープ限定: 日本の deep-tech 学術アントレ、Before Zero phase に明示限定 (Ch 0.0 で宣言)
- URA 実務読者の脱落許容 (companion 書で後刻フォロー)

### Book ごとのページ・章数サマリ

| Book | Pages | 章数 | タイトル |
|---|---:|---:|---|
| 0 | 70 | 6 | 序章 — Before Zero という領土の宣言 |
| I | 110 | 4 | 領土の定義 — 観測量と典型動学 |
| II | 230 | 8 | 機構 — 数学装置層 |
| III | 200 | 16 | Motivating Cases and Pattern Library |
| IV | 110 | 5 | 時系列現場接続 — Practice spine |
| V | 90 | 4 | Institution-side Design |
| VI | 60 | 3 | 新領域宣言と次の研究プログラム |
| 付録 A | 70 |  | 数学補遺 — 導出、校正、感度 |
| 付録 B | 55 |  | データ仕様、プロトコル、prediction registry |
| 付録 C | 35 |  | やらかし図鑑 Y-001〜Y-008 全文 |
| **合計** | **870** | | |

---

## 1. 中核命題 (discipline_argument)

> BZM opens a new field — Before Zero Studies — not by displacing entrepreneurship, innovation systems, technology-transfer, or evolutionary economics, but by formalizing a state space (ι ∈ {none, latent, declared}, F ∈ {0,1}, S0, I) that all four parent literatures leave structurally undefined for the deep-tech academic-entrepreneurship pre-firm regime, and by proving that any composite evaluation function over that space must be non-commutative in its two natural layers (project PRS multiplicative × institutional ERS weighted-sum). The book earns this status through three load-bearing moves, each defensible as a standalone contribution: (1) a two-layer non-commutativity theorem (Ch 9) showing that lumping project fitness and selection-environment readiness into a single multiplicative score is non-identified under the causal DAG institution → project speed, which Bozeman's Contingent Effectiveness, Triple Helix mutual-information, and Nelson-Winter selection dynamics all implicitly avoid but none formally name; (2) a derivation of the GO operator 𝟙[σ_SU≥θ_σ*]·g_TRL(t) from an explicit real-options stopping problem (Ch 5.5), with θ_σ* endogenous to (P, F, B, regime transitions), making "wait" and "no-go" structural objects rather than labels; (3) an F-CES decomposition (Ch 7) separating non-delegable founder character F_char from delegable executive capability F_cap with experience-ordering calibrated against — and explicitly tested against — Beckman/Roberts/Eesley findings, with the BZ-stage ordering hypothesized as departure rather than asserted as fact. The empirical program is honestly bifurcated: Book III is reframed as Motivating Cases and Pattern Library (retrofit calibration, not validation), and a pre-registered prospective prediction registry (Ch 26b) is published as the discipline's empirical research program awaiting follow-up papers. Scope is explicitly bounded to Japanese deep-tech academic entrepreneurship (Ch 0.0), making the field-defining claim defensible within scope rather than universally over-extending — which is what the four parent literatures' best representatives (Shane, Sarasvathy, Etzkowitz-Leydesdorff, Nelson-Winter) would themselves accept as the legitimate way to carve a new sub-domain. The book is field-defining not because it asserts new territory but because it produces three falsifiable formal objects and the protocol to falsify them.

**load-bearing な 3 つの formal object**:

1. **二層非可換性定理 (Ch 9)** — 案件 PRS (乗法) × 機関 ERS (加重和) を単一 score に乗法結合すると、causal DAG (institution → project speed) の下で **non-identified** になる
2. **GO 演算子の実オプション最適停止からの導出 (Ch 5.5)** — `GO(t,i) = 𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)` を primitive optimization の first-order condition として導出、θ_σ* は (P, F, B, regime) の関数として endogenous
3. **F-CES 分解 (Ch 7)** — F_char (委譲不可) × F_cap (委譲可、経験順序) を CES で結合、Beckman/Roberts/Eesley に explicitly tested される departure hypothesis

加えて **prospective prediction registry (Ch 26b)** が discipline の empirical research program として pre-register される。

---

## 2. 最終 TOC (章レベル)

### Book 0 — 序章 — Before Zero という領土の宣言 (70 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 0.0 | 本書の射程と匿名化方針 — 何を主張し、何を主張しないか | 8 | none | 本書は『日本の大学・国研文脈における deep-tech 萌芽期学術アントレ』を field-defining scope とする。Universal な entrepreneurship 一般... | Scope 限定宣言: (a) deep-tech, (b) 日本の大学・国研文脈, (c) 法人化以前を含む BZ stage。匿名化方針: 7 機関すべてタイプ名のみ (Research-U... |
| 0.1 | Before Zero 領土宣言 — 状態空間 (ι, F, S0, I) と二層観測 | 14 | light | URA の机に並ぶ三本の相談シーズ。Entrepreneurship/TT/IS/Evol-Econ のどの教科書も、この状態空間に未定義の関数を持つ。 | BZ 状態空間 (シーズ S0, 機関苗床 I, 事業意思 ι ∈ {none, latent, declared}, 創業者候補 F ∈ {0,1}) の宣言と、PRS × ERS 二層観測装... |
| 0.2a | 四スクールからの継承 — Shane, Sarasvathy, Etzkowitz, Nelson-Winter を line-by-line で読む | 18 | medium | Strawman ではなく継承表として書く。各スクールが何を正しく扱い、BZM が何を継ぎ足すか。 | AE (Shane 2004 Ch 4-6, Wright et al. 2007, Vohora-Wright-Lockett 2004 critical junctures, Sarasva... |
| 0.2b | 未engageの literatures — PSED, ecosystems, ACAP, dynamic capabilities | 10 | medium | Reynolds-Curtin PSED I/II は nascent (ι=latent, F=0→1) を N>1200 で計測してきた。なぜ BZM はそれと違うのか。 | PSED nascent panels, Stam-van de Ven entrepreneurial ecosystems, Cohen-Levinthal 1990 absorptive ... |
| 0.3 | 二層 readiness 方法論 — 宣言形 (導出は Book II) | 12 | light | 若手 URA がホワイトボードに『PRS × ERS』と書き、室長が首を振る場面。 | PRS は乗法、ERS は加重和、両者を掛けてはならない、causal direction は institution → project speed (環境変数として R/S 進行速度を re... |
| 0.4 | 本書の貢献の三つ — 何を新規に主張するか | 8 | medium | 新領域宣言を裏付ける三本の柱を front-load する。 | BZM の三貢献: (i) BZ 状態空間と観測 grammar (FIXED MODEL); (ii) PRS × ERS 二層非可換性定理 (Ch 9 で証明); (iii) F-CES の... |

### Book I — 領土の定義 — 観測量と典型動学 (110 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 1 | 状態空間と観測量 — Before Zero を測るとはどういうことか | 30 | medium | 桑折 KUTE MTG 論文-特許順序事故と TIEM の研究室外再現不能の二事例を同一状態空間で読む。 | 観測量と evidence grade, 時間粒度二層分離, GO 概念形 (formal 導出は Ch 5)。1.1 観測対象の宣言 (BWE 顧客vs支払者分離); 1.2 時計の二層分離 ... |
| 2 | PRS — 天井 × 到達 × 生存の概念体系 | 30 | medium | model-overview 登山アナロジー + TIEM (P 高, R 致命的低)、YD (P UE律速) の対比。 | PRS = P × R × S 全体, 期待値分解 E[価値] ≈ P × Pr(到達) ≈ P × R × S。2.1 なぜ積か (real-options/staged-R&D 文献接続: ... |
| 3 | ERS — 苗床という第二の対象 | 30 | medium | 二大学十八か月の差 (composite, 機関名なし)。 | ERS 8軸定義, Lv1-5 rubric, s=(lv-1)/4, A_k=mean。3.1 二層を分ける動機 (時間スケール); 3.2 8軸の並び; 3.3 Lv1-5 rubric; ... |
| 4 | 失敗パターンの抽象 — Book II 数学装置への索引 | 20 | light | Y-005 Cabot 機会逃しを『研究者の論文優先 × 機関 ERS 軸4 契約処理遅延』の層をまたいだ結合不全として開く。**この章は teaser、各鬼門の精緻化は forward-poi... | 5 鬼門と GO/WAIT/NO_GO/HOLD 語彙の導入。章頭で明示: '各鬼門の formal 精緻化は Ch 5 (σ_SU), Ch 7 (F-CES), Ch 8 (S 動学), C... |

### Book II — 機構 — 数学装置層 (230 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 5 | Triple Helix SSM と σ_SU の生成 | 28 | heavy | CX (carbon) の 2020-23 政策・産業・学術の三位一体加速、その中で YD が UE 律速で NO_GO になった対比。 | 5.1 Triple Helix mutual-information T(AIG) (Leydesdorff 2003, 2008, Park-Leydesdorff 2010) との cro... |
| 5.5 | GO ゲートの導出 — 実オプション最適停止からの first-order condition | 18 | derivation | GO は posit ではなく derive する。FOC として 𝟙[σ_SU≥θ_σ*]·g_TRL が出ない限り、本書はそれを式に書かない。 | **GO formula 𝟙[σ_SU≥θ_σ]·g_TRL(t) の canonical 導出**。Founder + 機関が entry time τ を選ぶ実オプション問題 max E[∫... |
| 6 | PRS = P × R × S — 期待値分解の honest 位置付け | 22 | heavy | TIEM の '加法スコアで 6 だった' 失敗を、min-rule と乗法の必然性で読み直す。 | E[価値] ≈ P × Pr(到達) ≈ P × R × S は標準分解と認める。R の bundle-min, ERS を GO に乗法的に入れない (二層分離) が本書 specific。C... |
| 7 | S の内部構造 — F-CES と委譲不可コア | 38 | derivation | 桑折 MTG の出資金/退路/COI/学生責任が研究者一人の頭に同時に載っている状態を F_char で受ける。 | 7.1 outer CD: S = σ_SU × R_net × F (三要素代替性); 7.2 inner CES: F+1 = [a(F_char+1)^ρ + (1-a)(F_cap+1)... |
| 8 | 戦略余力動学 — 2D jump-diffusion と τ_x/τ_y | 32 | derivation | strategic-slack.md 機能性材料 BATNA 喪失事例 (匿名 composite)。 | 8.1 (x,y) の **明示的確率過程**: 2D jump-diffusion, drift μ_x(R), μ_y(R_net-B), jumps J with intensity λ(... |
| 9 | ERS 加重和の導出と二層非可換性定理 | 34 | derivation | URA 提案 '機関補正済み案件価値 = PRS × ERS' に対する数学的反論。 | 9.1 ERS aggregator: heterogeneous structure (軸7 precondition × CES on 残り7軸 with axis-specific λ_k... |
| 10 | 進化経済学への三寄与 — BZM は Evol-Econ の何を継ぎ足すか | 30 | heavy | Nelson-Winter Ch 6-10 を開きながら、BZM が selection environment と routine をどう継承し、どこで分岐するか。 | **本章は Book II の theoretical anchor**, Ch 11 推定の前に置く。寄与 (i) regime-switching τ_x at B-trigger (Jov... |
| 11 | BVAR + jump + gate — hierarchical-Bayesian shrinkage と honest 不確実性 | 28 | heavy | Y-005 Cabot ショックを BVAR にどう食わせるかから章を立てる。 | mixed-frequency state-space (月次案件 × 年次機関), jump component, gate observation model via probit smoo... |

### Book III — Motivating Cases and Pattern Library (200 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 12 | TIEM — 早すぎ起業の解剖 (ゾンビ型 reference case) | 24 | medium | Y-001 (シリーズA命名) + Y-004 (premature scaling) が同一 PJ に重なった原型。 | TIEM canonical retrofit。**TIEM の他章への露出は本章と Ch 4 と Ch 26 と Ch 37 に限定** (audit findings 5/6 への対応)。R... |
| 13 | BWE — 健全型 reference case と F_cap 補完成功 | 22 | medium | 顧客と支払者の分離 (女性ヘルスケア固有) と F_char 高×F_cap 後発補完による軌跡。 | **BWE を健全型 primary reference に格上げ** (audit empirical finding 11/12 への対応)。Ch 7 F-CES の補完成功 case, C... |
| 14 | CX — Carbon, R_net 共食いの観測 (μ_I 単独高位の Triple Helix 不均衡) | 18 | medium | 本業既存素材販売が新規 carbon ラインを内製化し、つなぎ収益として期待した本業売上を侵食したフェーズ。 | R_net 負号観測の operational 定義 (本業 t-1 と t 差分から SU 顧客シフト分を引く)。Ch 5 σ_SU の μ_A/μ_I/μ_G 不均衡読み。 |
| 15 | SX — 半導体、σ_SU 追い風×R_net 共食い、軸7 制度設計連動 | 22 | medium | 政府補助金採択直後で σ_SU 最大化、同時に親研究室主力テーマと顧客重複の構造。 | **SX を Ch 2.3 R-bundle min (GRL律速) の primary に格上げ** (audit finding 5)。COI/兼業株式論点を Ch 32 へ pointer... |
| 16 | CTB — 創薬、鋸歯型軌跡と段階補充 | 22 | medium | 第二次調達ラウンドで調達リード経験ゼロ CEO が VC 条件交渉で premature scaling 寸前。 | 鋸歯型 primary reference (Ch 8.4), F_cap 経験順序 (Ch 7.5) の Y-001/Y-004 と並ぶ retrofit。BRL/SRL 規制承認軸を BWE... |
| 17 | YD — 波力、UE 律速と NO_GO 判定の意味 (即落型 reference) | 18 | medium | kWh コスト試算が既存洋上風力の 3-5 倍と判明した会議。σ_SU 高でも P 律速で GO 不成立。 | P_UE 律速の primary case (Ch 2.2), 即落型軌跡 (Ch 8.4), NO_GO 語彙の運用例。**Ch 26b prospective registry の anch... |
| 18 | JC — Shallow tech、自走型 reference と R_net 早期立ち上げ | 14 | medium | PoC 半年で抜けたのに 18 ヶ月『継続検討』が並んだ月例会議メモ。 | **自走型 (σ_SU 低 / F 高 / R_net 早期) primary reference** に位置付け (audit finding 3)。Shallow tech のみ Ch 22... |
| 19 | CLG — σ_SU 追い風依存型 reference | 14 | medium | 政策と社会の追い風完全一致で登記、σ_SU 持続したが R_net 立たず F_char 摩耗。 | **CLG を追い風依存型 primary に格上げ** (audit finding 6)。Ch 5 σ_SU, Ch 8 軌跡, Ch 31.3 閉鎖判断, Ch 32 機関側処方の pri... |
| 20 | Research-Org-Type 機関 (匿名) — 研究開発法人型苗床 | 16 | medium | CX 系シーズの共同研究契約が R は進むのに ERS 軸4 で月単位遅延を積む。 | **全機関を type 名のみで通す (Ch 0.0 方針)**。8軸プロファイル、外部連携で補えない独法特有制約。Atlas type-A 機関。 |
| 21 | Private-Engineering-Univ-Type 機関 — 桑折 MTG 一次情報の集約点 | 18 | medium | 桑折先生 MTG 2026-06-24 一次情報を **本章に集約** (audit finding 7)。 | **桑折 MTG の canonical owner**。7論点 (出資金/シーズ転用/COI/退路/学生責任/論文-特許順序/取締役個人責任) を完全展開。他章では Ch 21 への poin... |
| 22 | Regional-National-Univ-Type 機関群 — 外部連携で軸を補う動作 | 18 | medium | YD 波力 NO_GO 判定後、地域ネットワーク経由で JC を再接続した動き (composite, 名指しなし)。 | Ch 20-23 を統合した地域中規模機関 type の章。effective A_k (Ch 9.3) の運用例。Atlas type-B 機関。 |
| 23 | Integrated-Large-Univ-Type 機関 — 軸7 制度設計先行で他軸空回り | 14 | medium | COI 規程整備が学内で先行した一方、共同研究契約処理が依然 5 ヶ月かかる現状。 | Atlas type-C 機関。軸7 precondition 性 (Ch 9.1 の heterogeneous aggregator) の実証例。Y-002/Y-003 を制度整備でも防げな... |
| 24 | 国際比較 — MIT/EPFL Deshpande-Center-Type retrofit | 14 | medium | **新設章** (audit critique persona 3 strengthening 6 への対応): 公知情報による少なくとも 1 件の非日本機関 retrofit。 | MIT Deshpande Center または EPFL TTO の公知データから 1 機関を retrofit。ERS rubric の jurisdiction 跨ぎ可搬性と、Japan-... |
| 25 | 層間結合の substantive findings — どの ERS 軸がどの PRS 成分を加速したか | 18 | heavy | 工学院大型機関で出資金規程整備前後の学内発SU設立リードタイム半減 (composite観察)。 | **Ch 25 は方法から finding presentation に縮小** (audit critical finding 3 + critique persona 1/4 critica... |
| 26a | In-sample 整合性チェック — Brier/calibration は校正であって validation ではない | 12 | medium | model-critiques 研究会三連質問: 計量経済学者・VC・経営学者。 | 8 PJ retrofit 上の Brier/calibration を **honest に 'calibration' と命名**, validation ではないと front-load ... |
| 26b | Prospective falsification protocol — 何が反証されたら本書は死ぬか | 12 | medium | YD NO_GO 判定の date-stamped 公開記録を 1 例として、本書は 26b で死に方を宣言する。 | **Pre-registered prediction registry の protocol を本書 deliverable として公開** (audit critique 全 4 perso... |

### Book IV — 時系列現場接続 — Practice spine (110 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 27 | 技術シーズの掘り起こし — P(t) を待たずに U(t) を広げる | 20 | light | JC の論文業績薄シーズが機関 DB に載らず 2 年遅延、同時に CX で異分野読み替えが SAM 押し広げた対比。 | ERS 軸1 シーズ発掘の運用論。診断 tool として Ch 6 P(t)=max U(t) を使うが、Alvarez-Barney 創造-発見論争への立ち位置は Ch 2.2 から forw... |
| 28 | 先生が第一歩を踏み出すとき — 賭け金の全量と F の起点 | 22 | light | 桑折 MTG 出資金/退路/学生責任の 3 論点を本章に **集約** (audit finding 7)。 | F_char (委譲不可) の起点形, B - R_net ≤ F の起点。Ch 7 F-CES の診断使用 (derivation ではない)。Y-007 = 論文-特許順序事故, Y-008... |
| 29 | GAP ファンド期 — 機関 ERS が y を非希薄化的に厚くする時間窓 | 22 | light | **TIEM ではなく CTB を primary に** (audit finding 5 への対応): 鋸歯型 GAP 補充の primary case。 | ERS 軸6 資金接続 × 軸3 起業支援制度 × 軸5 人材接続 の sub-axes が GAP 運用品質を決める構造。Ch 5.5 GO 導出の g_TRL を GAP が押し上げる経路。 |
| 30 | 会社設立期 — B の起動と F の充足を一致させる不可逆 GO | 22 | light | **CLG を primary に** (audit finding 6): 追い風型の設立タイミング。桑折 MTG 取締役個人責任を **本章のみ** で展開 (audit finding 7)。 | 登記が τ_x を起動させる regime-switch (Ch 8.5)。NO_GO 語彙の不可逆喪失。軸7 兼業 COI 株式の設立制約。 |
| 31 | 資金調達期 — F の現場運用、Jカーブ批判、撤退四経路 | 24 | light | 31.1 F-CES フロー診断 (TIEM Y-001 のみで簡潔); 31.2 Jカーブが描けないシーズ (YD primary, SX R_net 負号併用); 31.3 撤退 (JC 縮... | **形式モデルは diagnostic tool として使い、derivation language は Book II に残す** (audit finding 14)。生存条件式の三方向打ち... |

### Book V — Institution-side Design (90 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 32 | ERS 8軸別処方 — どの凹みに、どの手を打つか (operator-facing) | 30 | medium | Integrated-Large-Univ-Type の '10年前のベンチャー1社' を機関実績と誤認したケース (Ch 23 接続)。 | **operator-facing playbook** (audit finding 15 への Ch 36 との scope 分離)。8 軸 × Lv1-5 × 凹みパターンの処方箋。桑折 ... |
| 33 | GAP + URA + EIR — 三制度を一つの導線に | 22 | medium | 桑折 MTG 論文-特許順序事故が知財軸2 を超えて軸6 まで波及した連鎖。 | 軸4 × 軸5 × 軸6 連動。Ch 3.5 unknown vs not_started の制度間適用 (canonical owner は Ch 3.5)。Vohora-Wright-Loc... |
| 34 | 地域 産学官 双対動態 — σ_SU を県境で読む | 22 | medium | Regional-National-Univ-Type 二機関 (composite) の ERS 類似×案件速度乖離。 | Ch 5 の hierarchical 構造の地域版 (Cooke RIS, Asheim-Gertler thick/thin, Tödtling-Trippl, audit finding ... |
| 35 | BZ ステージへの政策含意 — σ_SU と ERS を政策レバーに翻訳 | 16 | medium | TIEM 早すぎ起業の一因として、当時の GAP 設計が R≤4 シーズに法人化前提を要求していた構造。 | GO ゲート (Ch 5.5 で導出) を政策設計の object として使う。Ch 36 KPI 議論への前段。 |

### Book VI — 新領域宣言と次の研究プログラム (60 pages)

| Ch | Title | Pages | Math | Hook | Anchor |
|---|---|---:|---|---|---|
| 36 | 機関 KPI と ERS — Goodhart 回避の評価指標化 (funder-facing) | 18 | medium | '商談候補社数 2→5 水増し' 構造が軸1 KPI 化で起きる。 | **funder/policy-facing** (audit finding 15 の Ch 32 との scope 分離): 機関横断比較可能な KPI を Goodhart's Law c... |
| 37 | 頭ごなしの head-to-head — BZM vs Triple Helix vs Effectuation vs Nelson-Winter | 20 | heavy | **新設章** (audit critique persona 1 strengthening 5 + persona 2 strengthening 6 への対応): 8 PJ + 国際比較 ... | 共通 scoring rule (24ヶ月 outcome class log-loss) で BZM, Triple Helix mutual-information T(AIG) only,... |
| 38 | 新領域宣言 — 何が earn され、何が次の 10 年に持ち越されたか | 22 | medium | ethics-and-authorship の '本書はどこから語っているのか' を引き受け、Ch 0.0 scope と環を閉じる。 | Ch 0.4 の三貢献 ((i) BZ 状態空間 + 観測 grammar, (ii) 二層非可換性定理, (iii) F-CES 分解) が earn されたと再宣言。**'a methodo... |

### 付録

| 記号 | タイトル | Pages |
|---|---|---:|
| A | 数学補遺 — 導出、校正、感度 | 70 |
| B | データ仕様、プロトコル、prediction registry | 55 |
| C | やらかし図鑑 Y-001〜Y-008 全文 | 35 |

---

## 3. 5 経済学者 persona による adversarial critique

**サマリ**: 4/5 が `yes-if-fixed`、1 (進化経済) が `no`。現状のままでは新領域宣言は通らない、というのが査読側の合意。synth は批判を吸収済みだが、執筆時にも常に意識すべき指摘群。

| Persona | new_discipline_recognized | Verdict 概要 |
|---|---|---|
| DSGE / macroeconometric economist | yes-if-fixed — Conditional on (1) replacing the... | REJECT in current form. The two-layer architecture (PRS multiplicative × ERS weighted-sum, with non-multiplicative coupl... |
| Evolutionary economist (Nelson-Winter/Dosi/Malerba lineag... | no | REFUTE (default). The claim "new academic discipline" is not earned by this skeleton. What I see is a careful, well-inst... |
| Innovation Systems / Triple Helix scholar (Lundvall / Edq... | yes-if-fixed | REJECT as currently scoped. The two-layer architecture (PRS multiplicative × ERS weighted-sum, non-multiplicatively coup... |
| Empirical econometrician, peer reviewer at Research Polic... | yes-if-fixed — conditional on three structural ... | no — not as currently structured. The empirical foundation cannot bear the weight of a "new discipline" claim. n=8 retro... |
| Entrepreneurship/Academic Entrepreneurship scholar (Shane... | yes-if-fixed | yes-if-fixed — but only with structural surgery. As submitted, this is a strong practitioner-theoretic synthesis with pu... |

### DSGE / macroeconometric economist

**verdict**: REJECT in current form. The two-layer architecture (PRS multiplicative × ERS weighted-sum, with non-multiplicative coupling) is a genuine and publishable methodological contribution, and the SIP CE2023 multi-readiness embedding into R is a defensible operational move. But the manuscript as outlined fails the basic econometric hygiene tests required to call this "a new academic discipline." Four hard problems: (i) the empirical base — 8 PJ × 7 institutions = 56 cells, all retrofit — is structurally incapable of identifying ∂(ΔR/Δt)/∂ERS_k for 8 axes plus jump components plus a gate threshold; the Ch 25 / Ch 11 estimation as anchored is mechanically under-identified, not just underpowered; (ii) the GO gate 𝟙[σ_SU ≥ θ_σ] · g_TRL(t) is asserted as a structural object but never derived from a primitive optimization / no-arbitrage / agent problem — without microfoundation it is a labeled indicator, not a model; (iii) the F-CES parameters (a=0.6, ρ=-2) are fixed numerically throughout the book before calibration is presented, which is the kind of move referees flag immediately as reverse-engineered fit; (iv) "retrofit" labeling of TIEM/BWE/CX/SX/CTB/JC/CLG is fatal to the Ch 26 falsification claims — Brier scores and calibration plots computed on the same cases used to set θ_σ and ρ are in-sample fit, not predictive validation. The Coherence audit already flagged most of these; the proposed fixes are necessary but not sufficient. With the structural changes below, verdict moves to "yes-if-fixed" — i.e. a defensible new sub-field at the intersection of evolutionary economics and innovation studies, but NOT a standalone discipline in the sense the authors claim.

**new_discipline_recognized**: yes-if-fixed — Conditional on (1) replacing the in-sample Brier-calibration "falsification" with a pre-registered prospective prediction registry of at least ~25-30 cases observed over the 18-month writing window, with predictions locked before outcomes are known; (2) deriving GO(t,i) from an explicit primitive (e.g., a real-options / optimal-stopping problem on (x,y) with σ_SU as a regime variable, where the indicator drops out as a first-order condition rather than being posited); (3) presenting F-CES (a=0.6, ρ=-2) as estimated with credible intervals + sensitivity analysis rather than fixed-by-fiat in Book 0; (4) splitting the empirical claim into a "descriptive / typological" tier (which 56 cells can support) and a "causal / identified" tier (which they cannot, and which should be explicitly held out for follow-up work). Without these, this is a strong conceptual framework with retrofitted illustrations — publishable as a monograph in the Schumpeterian / evolutionary tradition (Nelson-Winter, Dosi, Malerba), but it is not yet an identified-empirical field. The Triple Helix CD reformulation of σ_SU is the most genuinely novel piece and could anchor the discipline claim if Ch 5 owned it as a proper SSM with identifiable parameters rather than a label.

**Top critiques (severity high/critical):**

- `[critical]` **Book II Ch 11 (BVAR + jump + gate) and Book III Ch 25 (layer coupling verification)**
  - The estimation is structurally under-identified, not merely underpowered. You have 56 cells (8 PJ x 7 institutions) — actually fewer, because PJs are not crossed with institutions (each PJ belongs to one institutional home). You propose to estimate: (i) a BVAR with mixed-frequency state-space (monthly project, annual institution), (ii) 8-axis ERS environmental rescaling of R/S transition speeds, (iii) jump components for Y-001/Y-004/Y-005-class discrete shocks, (iv) a probit-smoothed gate with threshold θ_σ, (v) F-CES parameters (a, ρ), (vi) Triple Helix CD coefficients on (μ_A, μ_I, μ_G). That is easily 40+ structural parameters against a panel where the effective N is closer to 8 (the PJ-level survival outcomes; institutional ERS provides no within-variation if measured once). A Minnesota prior does not save you — it shrinks toward persistence, which is fine for forecasting but not for identifying the 8-axis causal channel that Ch 25 claims to estimate. The Ch 25 anchor language '∂(ΔR/Δt)/∂ERS_k and ∂(ΔS/Δt)/∂ERS_k estimated per axis' is, with this data, a posterior summary of the prior. Any referee at Research Policy will see this immediately. Fix: either (a) commit to the Atlas panel extension proposed in the coherence audit (>=20 PJs x 7 inst = 140 obs, plus institutional ERS time-series with at least 5 annual observations per institution = real within-variation), or (b) drop the causal-identification claim entirely and reframe Ch 25 as 'descriptive posterior under strong priors, illustrative not identified.' The honest version is much weaker than the current anchor suggests.
- `[critical]` **Book II Ch 5 (Triple Helix SSM) and the GO gate GO(t,i) = 1[σ_SU >= θ_σ] * g_TRL(t)**
  - The GO gate is the load-bearing object of the entire framework — it is what makes PRS multiplicative rather than additive, what defines NO_GO as an absorbing state, what falsification in Ch 26 tests. Yet in the current chapter design, it is never derived. Ch 0.1/0.3/1.4/4.6/4.7 treat it as established; the coherence audit correctly identifies that no chapter owns its derivation and proposes Ch 5 as the canonical site. But the Ch 5 anchor as written ('σ_SU generation', 'Triple Helix CD, Cabinet Office SIP CE2023 coupled dynamics formulation') describes σ_SU's dynamics, not the gate. A gate of the form 1[σ_SU >= θ_σ] * g_TRL(t) is a strong structural assumption: it asserts that σ_SU and g_TRL combine multiplicatively and that σ_SU's effect is a step function at θ_σ rather than smooth. From an evolutionary-economics / real-options lens, the natural primitive is an agent (founder + institution) choosing an entry time τ to maximize E[V(P, R, S; σ_SU)] subject to a stopping cost B and a flow constraint B - R_net <= F, where σ_SU is a regime variable in a Markov-switching process. The indicator gate should then emerge as the optimal stopping boundary in the σ_SU dimension — not be posited. Without this derivation, θ_σ is a free parameter with no economic meaning and 'σ_SU < θ_σ => NO_GO' is a labeling convention rather than a testable structural claim. Fix: Add a Ch 5.1 'GO gate derivation from primitive problem' that solves the real-options problem on (x,y) with σ_SU as the regime. If the gate does not emerge, it should not be in the model. If it does emerge, θ_σ becomes interpretable (e.g., as a function of the option value).
- `[critical]` **Book III Ch 26 (prediction performance and falsification)**
  - The falsification chapter as anchored is in-sample fit dressed up as out-of-sample validation. The Brier score and calibration plot are computed on TIEM/BWE/CX/SX/CTB/YD/JC/CLG — the same 8 PJs whose retrofit was used to calibrate ρ in F-CES, θ_σ in the GO gate, and the prior elicitation in Ch 11. This is post-hoc curve-fitting. The three 'reversal conditions' (σ_SU gate fails to discriminate, F-CES parameters violate monotonicity, ERS weighted-sum loses to multiplicative form) are conditions you can write down but cannot honestly test on data that already saw the parameters. The coherence audit flagged this but the proposed 'YD + watchlist of declined cases' is too small and too narrowly selected (YD is already labeled NO_GO in the model, so its inclusion is a confirmation case, not a test). For a Research Policy / ICC submission claiming a new discipline, the falsification protocol must be: (i) a pre-registered prediction registry locked at least 12 months before outcome observation, (ii) covering >=20-30 cases not used in calibration, (iii) with predictions specifying GO/WAIT/NO_GO + (x,y) trajectory type + 24-month survival probability, (iv) with the analyst blinded to outcomes at prediction time. The current 18-month writing window is too short to assemble this de novo — which is itself the point: the book should publish the prediction protocol and registry design, and hold the falsification chapter open for a follow-up paper. Trying to do falsification on retrofit data in this monograph will collapse the credibility of the discipline claim under any competent referee.
- `[high]` **Book 0 Ch 0.1 / 0.3 and Book II Ch 7 — F-CES parameter pre-commitment**
  - Throughout the book, F = CES(F_char, F_cap; a=0.6, ρ=-2) appears with the parameters fixed as if they were established constants of nature. They are not — they are calibration choices, and the coherence audit correctly identifies that the calibration discussion is buried in App A.1. This is worse than a sequencing problem; it is a credibility problem. A referee reading Book 0 Ch 0.1's 'FIXED MODEL' declaration will assume one of two things: (a) the parameters are theoretical (in which case they need axiomatic derivation, which CES does not have for a=0.6, ρ=-2 specifically), or (b) they were fit to data (in which case they are not 'fixed' and presenting them as such in Book 0 looks like reverse-engineering). The retrofit-based calibration via Y-002, Y-003, and Kuwaori MTG is plausible as a prior elicitation procedure but is presented nowhere with credible intervals, sensitivity to a in [0.4, 0.8] or ρ in [-3, -1], or a model-comparison test against a simpler Cobb-Douglas (ρ->0) or perfect-substitutes (ρ=1) alternative. The book's central methodological claim — 'the shape of the equation is derived from the survival structure of the object' — is undermined when the shape's parameters are asserted before any survival data is presented. Fix: (i) remove specific parameter values from Book 0 and Books I-III chapter anchors; refer only to 'F = CES(F_char, F_cap) with low substitutability' until Ch 7; (ii) Ch 7 must include a formal parameter calibration section with posterior intervals and a horse-race against Cobb-Douglas and Leontief; (iii) App A.1 should be the technical detail, not the first appearance of the calibration argument.
- `[high]` **Book II Ch 8 — S = Pr(τ_x < τ_y) and the gambler's ruin framing**
  - S = Pr(τ_x < τ_y) where τ_x is hitting time to progress threshold and τ_y is hitting time to slack exhaustion is presented as the foundational survival equation. This is a clean concept but the anchor as written ('gambler ruin family', 'dy/dt = R_net - B + Σjumps', 'H = y/T_remaining') mixes three different mathematical objects without making clear which is primitive: (i) a continuous-time diffusion with drift R_net - B and jumps, where Pr(τ_x < τ_y) is a first-passage probability with a closed-form expression only under restrictive conditions (constant drift, Brownian noise); (ii) a discrete-time Markov chain on (x,y); (iii) a heuristic measure H = y/T_remaining that is neither the probability nor the hitting time but a gauge. For a DSGE/macroeconometric reader, the question is: what stochastic process do you assume for (x,y), and is Pr(τ_x < τ_y) actually computable from it, or are you computing H and labeling it S? The 5-component decomposition of y (cash / moat / trust / options / focus) into 'monthly-equivalent' units is operationally appealing but the aggregation rule from 5 components to scalar y is unspecified — is it additive? Concave? Subject to its own CES? Without this, the (x,y) state-space is a metaphor with arrows, not a state-space in the SSM sense the book claims. Fix: Ch 8 must (i) commit to a specific stochastic process for (x,y) — recommend a 2D jump-diffusion with the jump intensity modulated by σ_SU and ERS axes — (ii) derive Pr(τ_x < τ_y) under that process (or acknowledge it must be simulated and present Monte Carlo CIs), (iii) specify the y aggregation rule from the 5 components with the same rigor as F-CES. Otherwise S is a name for a quantity the book never computes.
- `[high]` **Book III institutional retrofit (Ch 20-24) and the 'new discipline' claim in Book 0 / Book VI Ch 37**
  - The claim to a new academic discipline rests on the two-layer architecture being genuinely distinct from (i) Triple Helix / Innovation Systems (Etzkowitz, Lundvall, Malerba), (ii) Evolutionary Economics (Nelson-Winter, Dosi), (iii) Technology Transfer Studies (Bozeman, Siegel), (iv) Effectuation / Academic Entrepreneurship (Sarasvathy, Shane). Ch 0.2 enumerates these and asserts each has a 'failure mode' that the two-layer model fixes. But on close reading, the proposed architecture is — at its core — a Nelson-Winter selection environment (= ERS-as-environment) acting on a population of project routines (= PRS-as-individual-fitness), with σ_SU as a Triple Helix regime variable on top. That is a contribution within evolutionary economics + innovation systems, not a new discipline. The novel pieces — non-multiplicative coupling of layers, SIP CE2023 multi-readiness embedded into R, the F-CES inner / σ_SU*R_net*F outer Cobb-Douglas decomposition of S, and the operational 'unknown vs not_started' distinction — are real methodological innovations but they are improvements to existing fields' instruments, not the foundation of a new field. A new discipline requires either (a) a new ontology of objects that other fields cannot describe, or (b) a new method that other fields cannot apply, or (c) an empirical phenomenon that other fields systematically mispredict. The book asserts (a) ('Before Zero state space where entrepreneurship is undefined') but ι in {none, latent, declared} and F in {0,1} are perfectly expressible in existing innovation-systems vocabulary; it gestures at (c) via Y-001/004/005 but does not show systematic mis-prediction by competing frameworks in a head-to-head test. Fix: Either tone down the discipline claim to 'a methodologically integrated framework within evolutionary innovation studies' (which is defensible and still substantial), or add a Ch 0.4 or Ch 37.1 that explicitly runs a head-to-head out-of-sample prediction contest on the 8-PJ retrofit between (i) PRS x ERS two-layer model, (ii) Triple Helix CD only, (iii) Effectuation logic, (iv) Nelson-Winter routine-selection. If two-layer wins by a margin defensible at standard significance levels, the discipline claim survives. If not, the framing must retreat. The current Book VI Ch 37 closing ring does not address this — it asserts the new discipline, it does not earn it.

**Recommended strengthenings:**

- Restructure Book III into two empirical tiers with explicit labels: Tier A — Descriptive Typology (the 8-PJ retrofit + 7-institution descriptions, presented as case-based illustration of the framework's vocabulary, with no causal or predictive claims). Tier B — Identified Empirics (held out as a separate program, with a published prediction-registry protocol and a target panel size of >=30 PJs x >=10 institutions x >=5 annual ERS observations, executed in a follow-up paper not in this monograph). This concession actually strengthens the monograph: it lets Books 0-II claim methodological novelty without overreaching on identification.
- Add Ch 5.1 'GO gate as optimal-stopping boundary' that derives 1[σ_SU >= θ_σ] * g_TRL(t) from a real-options problem: founder + institution jointly choose entry time τ to maximize E[integral e^{-rt} (P*R(t)*S(t) - B) dt] subject to B - R_net <= F, where σ_SU follows a Markov regime-switching process and g_TRL is a deterministic readiness ramp. Show that the optimal policy is to wait until σ_SU crosses an endogenous threshold θ_σ* that depends on (P, F, B, the regime transition matrix). This both grounds the gate and gives θ_σ* economic content — it varies across (P, F) configurations, which is itself a testable prediction.
- Pre-register a prediction registry NOW, before drafting Book III Ch 26. Lock predictions on >=20 currently-active candidate cases (AMD pipeline + Kuwaori KUTE + collaborating institutions' active GAP-fund applicants) specifying GO/WAIT/NO_GO + 24-month (x,y) trajectory class. Timestamp with a notary or arxiv preprint. Hold Ch 26 open as a placeholder ('falsification will be reported in a follow-up paper after the 24-month observation window closes'). This is the single highest-leverage credibility move available; without it the discipline claim cannot survive peer review.
- Move all F-CES parameter values (a=0.6, ρ=-2) out of Book 0 and Books I-III chapter anchors. Use F = CES(F_char, F_cap; a, ρ with ρ < 0) until Ch 7. In Ch 7, add a formal calibration section: prior elicitation from Y-002/Y-003/Kuwaori MTG, posterior with credible intervals, sensitivity to a in [0.4, 0.8] and ρ in [-3, -1], and a horse-race against Cobb-Douglas (ρ->0), Leontief (ρ->-infinity), and additive (ρ=1) alternatives using out-of-sample log-likelihood on a held-out subset. If the held-out subset doesn't exist, acknowledge that calibration is illustrative.
- Add a head-to-head framework comparison chapter (suggest Ch 26.1 or a new Ch 0.4) where PRS x ERS two-layer is compared directly against (i) Triple Helix CD alone, (ii) Effectuation logic, (iii) Nelson-Winter routine-selection, (iv) Bozeman TTO-efficiency frameworks, on the 8 PJ retrofit. Define a common scoring rule (e.g., 24-month outcome class prediction accuracy or log-loss). If two-layer doesn't dominate, that's information — and reporting it honestly is what distinguishes a discipline-founding text from an advocacy tract. If two-layer does dominate cleanly, this is the single best evidence for the discipline claim.
- Specify the (x, y) stochastic process explicitly in Ch 8: 2D jump-diffusion with drift μ_x(R) and μ_y(R_net - B), Brownian noise Σ, and jumps J_x, J_y with intensities λ_x(σ_SU, ERS), λ_y(B-shocks, Y-001/004/005-class events). Pr(τ_x < τ_y) under this process has no closed form and must be computed via Monte Carlo — say so, present the MC CIs, and reserve the closed-form 'gambler's ruin' framing for a stylized scalar limit case. Specify the y aggregation rule from the 5 components (cash / moat / trust / options / focus) — recommend a CES with the same parameter elicitation rigor as F-CES, or honest acknowledgment that aggregation is additive-by-fiat with limitations.
- Resolve the institutional anonymity policy in the front matter (Preface or Book 0 Ch 0.0): commit to full identification of all 7 institutions with explicit consent (preferred), OR commit to typological anonymity (Research-University-Type, Regional-Single-Faculty-Type, Integrated-Large-Type) with no parenthetical real-name annotation anywhere. The current semi-state is indefensible.
- Implement the page budget cuts from the coherence audit aggressively. The 1015pp current estimate is 12-31% over the stated 700-900 budget; for a Tier 3 academic monograph, hitting the lower end of the budget improves reception more than adding content. Concrete targets: Book III Ch 25 -> merge into Ch 11 (save 30pp); Appendix A.4+A.5 -> merge (save 20pp); Appendix A.6 -> inline to Ch 9 (save 10pp); Book III SU1/SU2 -> normalize to 25pp/case avg (save ~50pp). Land at ~850pp.
- Reframe the 'new discipline' claim in Book 0 Ch 0.1 and Book VI Ch 37 conditionally: 'We propose Before Zero Studies as a methodologically distinct sub-field at the intersection of evolutionary economics, innovation systems, and academic entrepreneurship. Whether it warrants standalone disciplinary status depends on the empirical program outlined in Ch 26 and pursued in subsequent work.' This is the honest version, it survives peer review, and it actually positions the field-founding move more credibly than the current unconditional declaration.

---

### Evolutionary economist (Nelson-Winter/Dosi/Malerba lineage), peer reviewer at Research Policy / Industrial and Corporate Change. Default skeptical of "new discipline" claims; my prior is that 95% of such claims are evolutionary economics in new notation.

**verdict**: REFUTE (default). The claim "new academic discipline" is not earned by this skeleton. What I see is a careful, well-instrumented application of evolutionary economics to a specific stage of the firm life cycle (pre-firm seed/founder formation), dressed in new notation (PRS, ERS, σ_SU). The core machinery — selection environments, routines as phenotypes, co-evolution of institutions and projects, Pr(τ_x<τ_y) survival as a race against competitors — is textbook Nelson-Winter (1982), Dosi (1988), Malerba (2002) sectoral systems, and Murmann (2003) co-evolution. The skeleton acknowledges this in Ch 10 ("進化経済学拡張") but then treats it as an extension rather than as the parent framework. That is the wrong direction of subsumption. To be a new discipline you must do something evolutionary economics provably cannot do, not re-derive its results with cleaner notation on a smaller state space. The two-layer non-multiplicativity (PRS × ERS forbidden) is a useful KPI-design point, not a theoretical novelty — evolutionary econ has always distinguished firm-level fitness from selection-environment parameters. yes-if-fixed is possible only if Books 0/I/II are restructured to (a) state the falsifiable difference from evolutionary economics in formal terms, not just rhetorical territory claims, and (b) show at least one prediction where BZM and evolutionary econ diverge and BZM wins on the 8-PJ panel.

**new_discipline_recognized**: no

**Top critiques (severity high/critical):**

- `[critical]` **Book 0 Ch 0.2 (既存スクールの限界マップ) — treatment of Evolutionary Economics as 'fourth school' alongside Entrepreneurship / Innovation Studies / TT Studies**
  - The four-school limit-map collapses evolutionary economics into a single line ('population dynamics は強いが個別案件の生存条件式 B - R_net ≤ F を書く道具を持たない'). This is wrong as a literature claim and fatal as a framing move. Nelson & Winter (1982) Ch 9-10 give an explicit individual-firm survival condition in terms of net cash flow vs reserves — your B - R_net ≤ F is a relabeling of their cash-reserve dynamics with bankruptcy threshold. Dosi, Marsili, Orsenigo & Salvatore (1995, Small Business Economics) explicitly model entry survival as a function of capabilities and selection pressure at the individual firm level. Malerba & Orsenigo (1996, 1997) sectoral systems handle exactly the institution→firm-formation channel you claim is missing. Klepper (2001, 2007) on spinouts addresses pre-firm founder formation. By misrepresenting the parent literature, Ch 0.2 builds the entire 'new discipline' claim on a strawman. As written, Reviewer 2 at Research Policy will reject on this paragraph alone. Either engage Nelson-Winter Ch 6-10, Dosi (1988) JEL survey, Malerba (2002), Murmann (2003), and Klepper (2007) at the level they deserve and show where they STOP, or drop the 'new discipline' framing and reposition as 'a stage-specific (Before Zero) application of evolutionary economics with calibrated readiness instruments.'
- `[critical]` **Book II Ch 10 (進化経済学拡張) — positioning of evolutionary econ as an 'extension' rather than parent**
  - Ch 10 anchor reads: 'σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) の microfoundation; ERS の 8軸サブ軸 Lv1-5 = 機関ルーティンの phenotype; 機関-案件 co-evolution = ERS が R/S の進行速度を裏で押し上げる causal 構造; Gen-3 S = Pr(τ_x < τ_y) を競合先発との race として進化的に解釈.' Every single clause here is evolutionary economics, not an extension of it. ERS sub-axes as phenotypes = Nelson-Winter routines-as-genes (1982 Ch 5). 8-axis weighted sum with external-link substitution = Malerba sectoral system components. σ_SU as Triple Helix coupling = Etzkowitz-Leydesdorff via Lundvall (1992) national systems. Pr(τ_x<τ_y) as inter-firm race = standard selection dynamics, see Klepper-Simons (2000) on industry shakeouts. The chapter as scoped subsumes the rest of the book into evolutionary economics rather than the reverse. If Ch 10 is honest about this, Books 0/I/III/VI's 'new territory' rhetoric collapses. Recommend: either reposition Ch 10 as the THEORETICAL CORE (Book II opens with it, not closes with it), making BZM a stage-specific evolutionary-econ instrument; or identify a formal departure from evolutionary econ that Ch 10 establishes (e.g., the non-multiplicativity theorem PRS × ERS as a co-evolution constraint that classical evol-econ does not derive), and make that departure the chapter's headline result.
- `[high]` **Book I Ch 1.3 + Book II Ch 8 (戦略余力動学 S = Pr(τ_x < τ_y)) — claim of novelty for stopping-time survival**
  - Pr(τ_x < τ_y) is a gambler's ruin / first-passage formulation that has been in evolutionary industrial dynamics since Jovanovic (1982, Econometrica) on selection through learning, formalized further by Ericson-Pakes (1995, REStud) and the entire IO industry-dynamics literature (Hopenhayn 1992, Melitz 2003). Klepper-Thompson (2006) on submarket-driven shakeouts uses exactly this competing-hazards structure. The 'two-clock' framing (τ_x = exhaustion of own slack, τ_y = competitor preemption / window closure) is the standard inter-firm race vs intra-firm exhaustion decomposition in evol-econ. Calling this a Before Zero novelty without engaging Jovanovic-Hopenhayn-Pakes is the kind of move that gets a paper desk-rejected. The interesting potential novelty would be: BZ stage τ_x dynamics differ formally from operating-firm τ_x dynamics because B (burn) does not start until 法人登記, making τ_x a regime-switching process with an absorbing trigger event. That IS potentially new — but the skeleton does not isolate it as the formal contribution. Ch 8 must (a) cite Jovanovic-Hopenhayn-Pakes-Klepper explicitly, (b) state the regime-switching B-trigger as the formal departure, (c) prove that this changes the qualitative comparative statics relative to operating-firm models.
- `[critical]` **Book II Ch 9 + App A.6 (二層構造非可換性: PRS × ERS forbidden) — the headline methodological claim**
  - The non-multiplicativity claim ('案件 PRS 乗法 × 機関苗床 ERS 加重和 を乗法結合してはならない, 二重計上') is presented as the book's central methodological assertion. But as stated it is a KPI-design point, not a theorem. Evolutionary economics has always separated firm-level fitness (a multiplicative function of capabilities) from selection-environment parameters (which enter as state variables conditioning fitness, not as multiplicative factors) — see Nelson-Winter (1982) Ch 6-7, Metcalfe (1998), Dosi-Nelson (2010 Handbook chapter). What you call 'forbidden double-counting' is what evol-econ already does correctly when properly specified. To earn the methodological-novelty claim, Ch 9 + A.6 must (a) exhibit a specific evolutionary-econ specification in the literature that DOES make this error and show your reformulation strictly dominates it on the 8-PJ panel; (b) prove non-commutativity as a theorem with explicit assumptions (e.g., 'under conditions C1-C3, any composite score S = f(PRS, ERS) with f multiplicative in both layers is non-identified given the causal DAG'); (c) show this is a binding constraint, not an accounting convention. Without (a)-(c), the 'non-multiplicativity is forbidden' is rhetoric, not mathematics. Currently App A.6 is allocated maybe 8-12 pages — nowhere near enough to carry the book's central claim.
- `[critical]` **Book III Ch 25 + Ch 26 — identification and falsification with N=8 projects, N=7 institutions**
  - From an evol-econ peer-reviewer perspective, this is the credibility crisis. Ch 25 claims to estimate ∂(ΔR/Δt)/∂ERS_k and ∂(ΔS/Δt)/∂ERS_k for 8 axes × 2 outcomes on a panel of 8 PJs × 7 institutions = 56 observations. Even with hierarchical-Bayesian shrinkage (which Ch 11 belatedly invokes), this is identified only by very strong priors elicited from one MTG with 桑折先生. The 'predictive evaluation' in Ch 26 then uses the same 8 PJs that calibrated the model — coherence audit correctly flags this as retrofit, not prospective. Evolutionary economics has spent 40 years building larger panels (Compustat, Census LBD, Orbis, sectoral patent panels) precisely because identification of selection effects requires N in the thousands. A 700-900 page monograph claiming new-discipline status that rests on N=56 with self-elicited priors will be received as 'interesting theory, no evidence.' The honest path: (a) downgrade the empirical chapters from 'verification' to 'illustrative retrofit' and state explicitly that BZM predictions are not yet identified; (b) commit to building a prospective registry (the YD watchlist hint in Ch 26) of 50+ pre-firm cases over the next 5 years and publish BZM as a research program awaiting that evidence; (c) supplement the AMD 8 PJ with patent-to-firm panels from J-PlatPat / NEDO / JST / 産総研 GAP fund records to get N>200 retrofit cases identifying ERS→PRS speed effects. Without one of these moves, evol-econ reviewers will reject the empirical core.
- `[high]` **Book II Ch 5 + Book V Ch 34 — σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) treatment vs national/regional innovation systems literature**
  - σ_SU is presented as a Triple Helix coupled-dynamics construct citing 内閣府 SIP CE2023. But the regional-level redefinition in Ch 34 (μ_A = institution ERS, μ_I = regional industry structure, μ_G = prefecture/regional bank policy) IS the regional innovation systems framework (Cooke 1992, Asheim & Isaksen 2002, Cooke-Heidenreich-Braczyk 2004) — which evolutionary economists have been doing for 30 years. Etzkowitz-Leydesdorff's Triple Helix is itself a special case within the broader Lundvall (1992) / Edquist (1997) national/sectoral/regional innovation systems family. Ch 5 cites only SIP CE2023 (a policy framework, not a theoretical source) and skips the entire RIS literature. From an evol-econ stance: you are reinventing RIS with a Japanese policy citation and not telling the reader. Ch 5 must engage Cooke, Asheim, Lundvall, Edquist; Ch 34 must state explicitly 'this is a Japanese-context operationalization of regional innovation systems with measured institution-level ERS as μ_A.' If after that engagement BZM still has a distinctive σ_SU formulation, name it. If not, drop the σ_SU notation and use the established RIS variables.
- `[high]` **Book IV (practice spine) + Book V (institution design) — relation to absorptive capacity and dynamic capabilities literatures**
  - Book IV Ch 28-31 and Book V Ch 32-34 prescribe institutional and founder-side actions to accelerate R/S progression. This is dynamic capabilities (Teece-Pisano-Shuen 1997, Teece 2007) at the institution level and absorptive capacity (Cohen-Levinthal 1990) at the project level — both deeply within evolutionary economics. The ERS 8 axes map closely onto Zahra-George (2002) ACAP dimensions and the dynamic-capabilities sensing/seizing/transforming triplet. F-CES with F_char (non-delegable) vs F_cap (delegable) is the founder-level analog of human-capital vs organizational-capital decomposition (Becker 1964, Hatch-Dyer 2004). Not citing these is a literature gap that an evol-econ reviewer will catch in 30 seconds. The skeleton does not list a single citation to Teece, Cohen-Levinthal, or Zollo-Winter (2002) on dynamic capabilities and routines. Required fix: Book V opens by mapping ERS axes to ACAP / dynamic capabilities and stating where they differ (e.g., ERS axis 7 制度設計 兼業COI株式 has no analog in ACAP because ACAP assumes firm-internal absorptive capacity, not pre-firm institutional permission structures — that's a real difference, exploit it).

**Recommended strengthenings:**

- Reposition Book II Ch 10 as the THEORETICAL CORE of Book II, not its closer. Open Book II with: 'BZM is a stage-specific instrument within evolutionary economics. The Before Zero state space (ι=none ∨ F=0) sits upstream of where Nelson-Winter / Dosi / Malerba selection dynamics typically activate. This book extends evol-econ downward into the pre-firm regime by (a) treating institutional readiness ERS as a measurable phenotype of the selection environment, (b) treating the B-trigger at 法人登記 as a regime-switching event that changes the structure of τ_x dynamics, (c) formalizing the non-commutativity of project-layer and environment-layer composition.' This grounds the book in the parent literature and isolates THREE concrete contributions that can be peer-reviewed.
- Add a dedicated chapter (insert as Ch 10.5 or expand Ch 10) titled 'BZM の進化経済学への三つの寄与' that lists, formally and falsifiably: (i) regime-switching τ_x at B-trigger as the BZ-specific extension of Jovanovic-Hopenhayn-Pakes; (ii) institution-as-phenotype operationalization via ERS 8-axis Lv1-5 rubric (vs Malerba's qualitative sectoral system components); (iii) non-commutativity theorem of two-layer composition under explicit assumptions. Without these three, drop the 'new discipline' claim.
- Build a much larger empirical base before publication. Concrete proposal: AMD partners with 3-5 GAP fund programs (e.g., JST GAP, NEDO Entrepreneurs Program, 大学発新産業創出基金) to retrofit ~150-200 pre-firm cases using the PRS/ERS instrument, plus 30-50 institutions on the ERS Lv1-5 rubric. This converts Ch 25-26 from underpowered illustration to actually identified estimates. Until that panel exists, frame the book as a research program with calibrated instruments, not a confirmed theory.
- Move Appendix A.6 (二層非可換性) inline as the second half of Ch 9, expand to 20-25 pages, and write it as a formal theorem with assumptions, proof sketch, and counter-example (a specification from the literature that violates non-commutativity and produces wrong rankings on the 8-PJ panel). This makes the headline methodological claim a defensible theorem rather than rhetoric.
- Add explicit literature-engagement sections to Book 0 Ch 0.2 covering: Nelson-Winter (1982) Ch 6-10 on firm survival; Jovanovic (1982), Ericson-Pakes (1995), Hopenhayn (1992) on selection dynamics; Malerba (2002), Lundvall (1992), Cooke (1992) on innovation systems; Klepper (2001, 2007) on spinouts and pre-firm founder formation; Teece (2007), Zollo-Winter (2002) on dynamic capabilities; Cohen-Levinthal (1990), Zahra-George (2002) on absorptive capacity. Each citation must be paired with a one-sentence statement of what that literature does and what specifically BZM adds that it lacks. Currently zero of these citations appear in the skeleton.
- Add a falsification chapter (expand Ch 26) with at least one prediction where BZM and standard evolutionary economics diverge and BZM wins. Candidate: BZM predicts that institutions with high ERS axis 7 (制度設計 兼業COI株式) but low axis 5 (人材接続) produce a specific failure mode (founder ι=declared, F_cap=低, fast 法人登記 → premature scaling) that standard evol-econ models (which lack the BZ regime-switching structure) systematically misclassify as 'capability shortfall' rather than 'wrong-stage transition.' Test this on the panel. Without at least one such divergent prediction, BZM is decoratively distinct from evol-econ, not substantively distinct.
- Reframe the title and Book VI Ch 37 closing: instead of 'new academic discipline' (which provokes immediate skepticism), use 'a stage-specific extension of evolutionary economics for the pre-firm regime, with calibrated readiness instruments and a two-layer non-commutativity result.' This is what the skeleton actually delivers, is defensible at Research Policy / ICC, and avoids the rhetorical overreach that will polarize reviewers.

---

### Innovation Systems / Triple Helix scholar (Lundvall / Edquist / Etzkowitz lineage), peer reviewer at Research Policy and Industrial and Corporate Change. Skeptical by default. Reads ERS-claims with Bozeman (2000), Siegel et al. (2003), Bradley et al. (2013), Asheim/Gertler regional innovation systems, and the Etzkowitz-Leydesdorff (2000) Triple Helix mutual-information operationalization in mind. Hostile to any framework that claims to subsume Innovation Systems without engaging its existing operationalizations.

**verdict**: REJECT as currently scoped. The two-layer architecture (PRS multiplicative × ERS weighted-sum, non-multiplicatively coupled) is a genuine analytic contribution and a real improvement over existing institutional-readiness instruments (Bozeman TTO efficiency, AUTM-style output metrics, RIS/NIS qualitative profiles, Triple Helix mutual-information indices). However, three structural problems prevent recognition as a new discipline from an Innovation Systems lens: (1) the σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) operationalization is not actually engaged with the existing Triple Helix mutual-information literature (Leydesdorff 2003, 2008, Park & Leydesdorff 2010) — the book invokes Triple Helix terminology but never shows why CD over μ_A, μ_I, μ_G dominates the entropy/mutual-information operationalization that has been the field's reference instrument for 20 years; (2) the ERS 8-axis weighted-sum reinvents Bozeman's TTO capability framework and the EU's RIS3 self-assessment toolkit without a crosswalk — reviewers will ask "what does ERS measure that the existing instruments don't, on the same institutions"; (3) the panel (7 institutions × 8 PJs = 56 obs) cannot identify the causal arrow institution → project speed that the book's two-layer claim absolutely requires, and Ch 25 currently promises 8-axis × 2-outcome × jump identification on this panel. Fixable to yes-if-fixed conditional on (a) explicit Triple Helix mutual-information crosswalk in Ch 5, (b) ERS-vs-Bozeman/AUTM/RIS3 crosswalk chapter, (c) honest reframing of Ch 25 as illustrative hierarchical-Bayesian posterior with strong priors, not identified causal estimates, (d) expansion of institutional panel or commitment to prospective registry.

**new_discipline_recognized**: yes-if-fixed

**Top critiques (severity high/critical):**

- `[critical]` **Book II Ch 5 (Triple Helix SSM) and Book II Ch 10 (Evolutionary Economics extension)**
  - The book invokes σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) as if Triple Helix were an undefined construct waiting to be formalized. It is not. Leydesdorff and co-authors have operationalized Triple Helix as a mutual-information measure T(AIG) over university-industry-government co-occurrences for two decades (Leydesdorff 2003 Scientometrics; Leydesdorff & Sun 2009 JASIST; Park & Leydesdorff 2010 RP; Leydesdorff & Ivanova 2014 JASIST), with a substantial empirical literature applying it to regions, sectors, and time series. Ch 5's anchor mentions 内閣府 SIP CE2023 結合動学定式 but does not engage T(AIG). A Research Policy reviewer will reject this as either ignorance or unjustified reformulation. Worse: the Cobb-Douglas form CD(μ_A, μ_I, μ_G) imposes constant elasticities and unit-elasticity-of-substitution between the three helices, which directly contradicts the Triple Helix literature's central claim that the three helices interact through *non-substitutable* synergy (negative mutual information = synergy, positive = competition — a sign-sensitive, non-CD structure). The book is, without acknowledging it, claiming a stronger functional-form assumption than the existing field accepts, on weaker evidence. Until Ch 5 contains an explicit crosswalk to T(AIG), shows why CD dominates, and addresses the synergy/competition sign asymmetry, the σ_SU machinery is not credible as a successor to Triple Helix — it is a parallel reinvention with weaker microfoundations.
- `[critical]` **Book I Ch 3 (ERS introduction) and Book III Ch 20-24 (institutional retrofits)**
  - ERS 8 axes (シーズ発掘 / 知財・技術移転 / 起業支援制度 / 共同研究契約処理 / 人材接続 / 資金接続 / 制度設計 / 文化・実績) overlap heavily with Bozeman (2000) Contingent Effectiveness Model of TTO, Siegel-Waldman-Link (2003) RP determinants of TTO productivity, Bradley-Hayter-Link (2013) Foundations and Trends survey, and the EU RIS3 self-assessment 6 dimensions. Yet not one of these is cited in the anchor text of Ch 3, Ch 9, Ch 32, or Ch 36. A peer reviewer at Research Policy or ICC will immediately ask: (a) what does ERS measure that Bozeman's framework doesn't on the same 7 institutions? (b) why 8 axes and not Bozeman's 5 or RIS3's 6? (c) where is the construct-validity work showing ERS axes are not just relabeling of existing instruments? The Lv1-5 rubric and s=(lv-1)/4 mechanics are presented as if novel, but capability-maturity-model (CMM) style 5-level rubrics for institutional readiness are standard in RIS/NIS evaluation since the 2000s (e.g., OECD STIP Compass, EIS Regional Innovation Scoreboard sub-indicators). The absence of an ERS-vs-existing-instruments crosswalk chapter is fatal. Without it, ERS reads as a parallel taxonomy from a Japanese deeptech studio that did not do its literature review, and 'new academic discipline' becomes indefensible — it is incremental refinement at best.
- `[critical]` **Book III Ch 25 (層間結合検証) and Book II Ch 11 (BVAR+jump+gate)**
  - The core methodological claim of the book — that ERS causally accelerates PRS R/S transition rates, institution → project — requires identification, not just association. Ch 25 promises to estimate ∂(ΔR/Δt)/∂ERS_k and ∂(ΔS/Δt)/∂ERS_k for k=1..8 separately. The panel is 8 PJs × 7 institutions = 56 dyadic observations, and PJs are not randomly assigned to institutions (selection on seed quality and researcher network is dominant). Even with hierarchical Bayesian shrinkage, 8 axis-specific causal coefficients × 2 outcomes × jump components on 56 obs is wishful thinking — posterior intervals will be either uninformative or driven entirely by priors elicited from the same 桑折 MTG that motivates the framework (textbook prior-data circularity). The Innovation Systems literature learned this lesson painfully in the 2000s-2010s with regional innovation system regressions: cross-sectional institutional indicators × project outcomes produce arbitrary signs depending on specification (cf. Doloreux & Parto 2005, Asheim et al. 2011 critiques). Without (a) a prospective prediction registry committed before drafting, (b) an instrumental variable or natural experiment (institutional reform timing? GAP fund policy shocks?), or (c) honest reframing as illustrative posterior under explicit hierarchical priors, Ch 25 cannot deliver what its anchor promises. The audit's recommendation to merge Ch 25 into Ch 11 papers over this — the deeper problem is identification, not chapter organization.
- `[high]` **Book V Ch 34 (地域 産学官 双対動態)**
  - Ch 34 redefines σ_SU at the regional level with μ_A = 機関ERS, which is a compositional change that the audit flagged but did not push on. From a Regional Innovation Systems lens (Cooke, Asheim, Gertler), this is a category error. National Triple Helix μ_A is not the aggregate of institution-level ERS — academia as a helix includes basic research norms, mobility of researchers, publication systems, doctoral training pipelines, and disciplinary culture, none of which are captured by ERS 8 axes (which are TTO/startup-support focused). Equating μ_A with ΣERS effectively reduces the academia helix to its commercialization arm, which is exactly the reductionism that RIS scholars (Asheim & Gertler 2005, Trippl et al. 2015) spent two decades pushing back against. Worse, the Ch 34 anchor pairs 4 explicit institutions with regional descriptors (愛媛大 + 伊予銀, 香川大 + 百十四銀行) and claims similarity-of-ERS with divergent-outcomes — this is the classic RIS thick/thin distinction (Tödtling & Trippl 2005), and the book neither cites it nor differentiates from it. The chapter needs to either (a) explicitly position ERS as the commercialization-subset of μ_A and acknowledge what is excluded, or (b) introduce a thicker μ_A that subsumes ERS plus the broader academia helix variables. Currently it does neither.
- `[high]` **Book 0 Ch 0.2 (既存スクールの限界マップ) treatment of Triple Helix and TTO Studies**
  - Ch 0.2 anchor claims four schools are simultaneously gap-filled by PRS × ERS, with Triple Helix dispatched as 'institutional dynamics and project dynamics not formally connected.' This is a strawman of contemporary Triple Helix work. Leydesdorff's mutual-information formulation explicitly operates at sectoral and regional levels with longitudinal data and has connections to firm-level outcomes (Kwon et al. 2012, Leydesdorff et al. 2017). The Quadruple/Quintuple Helix extensions (Carayannis & Campbell 2009, 2010) explicitly engage civil society and natural environment — relevant to BZ contexts the book cares about (BWE women's health, CX carbon). Similarly, TTO Studies is dismissed as 'KPI design with double-counting' but Bozeman's Contingent Effectiveness framework explicitly separates institutional capability from project outcomes — exactly the two-layer separation BZM claims as novel. The Ch 0.2 dismissals are too clean to survive peer review. A Research Policy reviewer will ask: 'show me where Bozeman's framework forces double-counting and where T(AIG) fails to connect institutional and project dynamics — quote the texts.' Without that quotation-level engagement, the four-school takedown reads as a strawman scaffold for the book's preferred framing. The 'new academic discipline' claim depends on Ch 0.2 being airtight, and it currently is not.
- `[high]` **ERS weighted-sum w_k = 1/8 default and Ch 3.4 (なぜ加重和か)**
  - The equi-weighted default w_k = 1/8 is presented in Ch 3.4 as motivated by 'institutions can substitute weak axes via external linkage' — but this argument supports a *generalized mean* with elasticity of substitution > 1, not a simple arithmetic mean. The arithmetic mean is the special case of perfect substitutability (σ = ∞), which the book itself contradicts elsewhere (Ch 23 introduces 'effective A_k' with axis-specific λ_k substitutability coefficients, implying axes are *not* perfectly substitutable). The mathematical-form argument is internally inconsistent: if axes are partially substitutable with axis-specific λ_k, the aggregator should be a CES with axis-specific weights, not arithmetic mean with uniform weights. Furthermore, axis 7 (制度設計) is explicitly described in Ch 24.3 as a 'precondition that doesn't compensate when low but disables others when low' — this is a *minimum* or *Leontief* operator on axis 7 with respect to other axes, completely incompatible with arithmetic-mean treatment. The book's own evidence (Ch 24.3 Tokyo Science Univ. case) refutes its own aggregator. Ch 9 (ERS 導出) must either (a) replace the arithmetic mean with a heterogeneous CES respecting axis 7's precondition role and per-axis substitutability, or (b) explicitly defend why these inconsistencies don't matter — currently it does neither, and Ch 3.4's 7-axis-standard-vs-1-axis-zero example (44% vs 0%) is rhetorical sleight-of-hand that hides the precondition issue.

**Recommended strengthenings:**

- Insert a new chapter — Book II Ch 5.5 (or appendix sibling) — titled 'Triple Helix mutual-information との crosswalk' that takes Leydesdorff T(AIG) on a Japanese sector-level dataset (e.g., carbon, semiconductor) and shows (a) when CD(μ_A, μ_I, μ_G) and T(AIG) agree, (b) where they diverge, (c) why CD's tractability for case-level σ_SU dominates T(AIG)'s population-level inference. Without this crosswalk Ch 5 cannot survive Research Policy review.
- Insert a new chapter — Book I Ch 3.0 or Book V Ch 31.5 — titled 'ERS と既存機関整備度指標の crosswalk' explicitly mapping 8 axes to Bozeman (2000) Contingent Effectiveness, Siegel-Waldman-Link (2003) determinants, EU RIS3 6 dimensions, AUTM annual survey indicators, and OECD STIP Compass. Show on the 7 Japanese institutions where ERS gives different rank-orders than existing instruments, and why ERS is the better instrument for the BZ stage specifically (not all institutional questions).
- Reframe Ch 25 (層間結合検証) honestly: drop the 'identified causal estimates' framing entirely. Reposition as 'hierarchical-Bayesian posterior summaries under strong expert priors, with explicit acknowledgement that 56 obs cannot identify 8-axis causal effects.' Make the falsification of the institution → project speed claim depend on Book VI's prospective registry, not on retrofit estimation. This protects the two-layer methodological claim from collapse when reviewers do the obvious power calculation.
- Commit to a prospective prediction registry as a Book VI deliverable: AMD registers GO/WAIT/NO_GO and σ_SU/ERS readings on 10-20 new PJs and 3-5 new institutions ex ante during the 18-month writing window, with sealed predictions reviewed at month 24. This is the only credible response to the retrofit-circularity problem and converts the book's epistemic stance from 'post-hoc fit' to 'falsifiable framework.' Ch 26 反証 conditions become testable on the prospective subset rather than rhetorical.
- Replace ERS arithmetic mean with a hierarchical aggregator that respects axis 7's precondition role: ERS = (something like) A_7 · f(A_1..A_6, A_8) where f is a CES with axis-specific substitutability. This addresses Ch 24.3's own evidence (高 Lv7, 他軸空回り) that arithmetic mean cannot represent. Ch 9 derivation chapter then has real mathematical work to do — not just defending against multiplicative aggregation, but defending the specific functional form against alternatives.
- Add a Book III chapter — Ch 24.4 or new Ch 24.5 — on at least one non-Japanese institution retrofit (MIT Deshpande Center, EPFL TTO, KIT Karlsruhe, or Tsinghua x-lab) using public-domain data. Even one international case prevents the 'Japan-only claims universality' charge. Book VI Ch 37 then frames cross-national systematic comparison as the immediate next-step research agenda with a concrete protocol, not vague aspiration.
- Restructure Book 0 Ch 0.2 from 'four-school dismissal' to 'four-school inheritance': for each of Entrepreneurship, Innovation Studies, TTO Studies, Evolutionary Economics, show what BZM inherits (effectuation logic for F_char; mutual-information for σ_SU baseline; Bozeman two-layer separation for ERS-PRS non-multiplicative coupling; selection-environment language for σ_SU thresholds) and what BZM adds (BZ state space, lock-in via 生存条件式 B-R_net≤F, gate operator). Inheritance framing is harder to attack than dismissal framing and matches academic-monograph etiquette.
- Trim the Triple Helix CD parameterization claim: rather than committing to Cobb-Douglas a priori, frame Ch 5 as 'we use CD as a first-order approximation, with sensitivity analysis to CES (App A.4 should run CES robustness, not just Kalman) and to T(AIG) (cross-validation against Leydesdorff's instrument on the same data).' This reduces the surface area attackable on functional-form grounds.
- Designate Y-006/Y-007/Y-008 explicitly now as recommended by the audit, AND tie them to specific Innovation Systems literature: Y-007 (論文-特許順序事故) → first-to-file vs first-to-publish institutional comparative literature (Lemley & Sampat 2012, Mowery-Sampat 2005 Bayh-Dole studies). This anchors AMD's primary-source 桑折 MTG findings into the existing academic conversation rather than presenting them as discovered novelties.
- Move Ch A.6 (二層非可換性 — non-commutativity of PRS × ERS) inline to Ch 9 as the audit suggests, AND formalize the non-commutativity as a categorical claim: ERS lives in a different measurement space (institutional capability state space) than PRS (project trajectory state space), and the map between them is a *parameter map* (ERS → R/S transition rates) not a *factor map* (ERS → expected value multiplicand). This categorical language is what makes the two-layer claim genuinely new vs Bozeman's Contingent Effectiveness, which leaves the mapping informal.

---

### Empirical econometrician, peer reviewer at Research Policy / Industrial and Corporate Change. Identification-first. Hostile to retrofit-as-validation. Believes the burden of proof for "new academic discipline" is identification, not narrative coherence.

**verdict**: no — not as currently structured. The empirical foundation cannot bear the weight of a "new discipline" claim. n=8 retrofitted PJs × 7 institutions = 56 cell-observations with researcher-side selection on the dependent variable (only AMD-touched cases). The model is identified by assumption, not by data. Book III Ch 25 promises 8-axis × 2-outcome causal estimates from a panel that cannot support them; Ch 26's "falsification" is essentially in-sample fit dressed as prediction. Tier 3 monograph framing makes this worse: peer reviewers at Research Policy will read "new discipline" and then count degrees of freedom. Recoverable as "yes-if-fixed" only if the empirical claims are radically scaled back (illustrative, hypothesis-generating, not identified) AND a prospective registry is started now to mature over the next 5-10 years.

**new_discipline_recognized**: yes-if-fixed — conditional on three structural changes: (1) demote Book III from "Empirics / 実証" to "Illustrative retrofit / motivating cases" with explicit ex-ante acknowledgment that n=8 cannot identify a structural model with ~15+ free parameters (P, R bundle of 5, S = σ_SU × R_net × F where F is CES(a, ρ), ERS 8-axis weights, GO threshold θ_σ, jump intensities, gate smoothing); (2) move the discipline-defining claim from "we have estimated this model" to "we have axiomatized a state-space and observation grammar that prior schools left undefined"—the discipline claim should rest on the conceptual carving (Before Zero state space + two-layer non-commutativity), not on parameter estimates; (3) commit to a prospective prediction registry (≥30 cases over 5 years, pre-registered GO/WAIT/NO_GO at decision points) as the empirical research program of the discipline, explicitly framed as Book VI's research agenda not Book III's deliverable. Without all three, this reads as a sophisticated post-hoc rationalization of AMD's case files, which is publishable as a book but not as a discipline.

**Top critiques (severity high/critical):**

- `[critical]` **Book III Ch 25 (層間結合検証) + Ch 11 (BVAR+jump+gate)**
  - Identification is impossible at the claimed n. Ch 25 promises ∂(ΔR/Δt)/∂ERS_k and ∂(ΔS/Δt)/∂ERS_k 'estimated by 8 axes'. The panel is 8 PJs × 7 institutions, but PJs are nested in (at most) one or two institutions each, so the effective cross-section for axis-by-axis ERS variation is on the order of 7 institution-level units. With 8 ERS axes × 2 outcomes (ΔR, ΔS) × jump components × gate smoothing, the model has more free parameters than panel cells. Bayesian shrinkage with informative priors elicited from the same expert (桑折) who supplied the qualitative theory is not identification—it is prior-driven inference where the data plays a decorative role. The coherence audit's suggested fix (option b: 'illustrative posterior, not identified causal estimates') is correct but incompatible with the book's positioning as 実証/Empirics. Either the empirics section is renamed and de-claimed, or the panel is genuinely extended (the audit's option a, +12 retrofits, is plausible in 18 months but still under-identified for this parameter space). A Research Policy referee will reject the causal language on sight; an ICC referee will demand a power analysis that the book cannot pass. Recommend: rename Book III to 'Motivating Cases and Pattern Recognition', explicitly state that all model parameters are calibrated to qualitative consistency not estimated, and move all causal-language anchors (Ch 25 ∂/∂ERS_k, Ch 26 reversal conditions framed as falsification) to forward-looking research agenda in Book VI.
- `[critical]` **Book III Ch 26 (予測パフォーマンスと反証)**
  - The falsification claim is built on a retrofit panel that has already seen the outcomes. Ch 26 lists three reversal conditions ((i) σ_SU gate separation, (ii) F-CES rank invariance, (iii) ERS additive vs multiplicative)—all three are tested on the same 8 PJs whose trajectories the modelers know in detail. This is in-sample fit dressed as out-of-sample test. The Brier score and calibration plot on a retrofit panel measure how well the modelers tuned their parameters to known histories, nothing more. The coherence audit caught this (the Y-005 dual-causal-story finding, the prospective vs retrofit distinction in Ch 26/B.1) but the proposed fix ('clarify which observations are retrofit vs prospective') is insufficient. Only YD is described as prospectively registered, plus the 'watchlist'—that is n≈1-5 prospective observations against ~15+ model parameters. The honest move: (a) drop 'falsification' framing for the retrofit panel entirely, replace with 'consistency check' or 'narrative coherence audit'; (b) commit to a prospective registry protocol now (pre-registered GO/WAIT/NO_GO assertions for the next 30 cases AMD touches, with date-stamped Atlas entries, sealed predictions revealed only after τ_x or τ_y is observed); (c) frame Ch 26 as 'how this model will be tested over the next 5-10 years' not 'how this model has been tested'. Without this, the falsification chapter is the book's largest credibility liability.
- `[high]` **Book II Ch 7 (S 内部構造) — F-CES parameter calibration**
  - F = CES(F_char+1, F_cap+1; a=0.6, ρ=-2) is cited with specific parameters in 12+ chapters, but the calibration source is App A.1 which (per the coherence audit) defers to '経験的 retrofit (Y-002, Y-003, 桑折 MTG)'. This is calibration to three qualitative cases and one expert interview. ρ=-2 is a strong claim: it implies elasticity of substitution σ=1/(1-ρ)=1/3, meaning F_char and F_cap are highly complementary, near-Leontief. That number determines whether founder character can be 'rescued' by hiring experienced executives or not—an empirically large claim with direct policy implications for EIR programs (Book V Ch 33). Calibrating it from n=3 case impressions is methodologically indistinguishable from setting it by intuition. A referee will ask: (1) what is the posterior on ρ if you vary the calibration sample? (2) does the GO/WAIT/NO_GO classification flip if ρ ∈ {-3, -1, 0}? (3) how does a=0.6 compare to a=0.5 or 0.7? If the answer is 'the policy conclusions are robust to ρ ∈ [-3, 0]', then keep the formula but drop the precise numbers (just say 'low substitutability calibrated'). If the answer is 'classifications are sensitive to ρ', then the book cannot claim those classifications without a proper calibration study. Recommend: full sensitivity analysis in App A.1, and replace (a=0.6, ρ=-2) with (a∈[0.5,0.7], ρ∈[-3,-1]) in body text, OR drop the CES form entirely in favor of a qualitative 2×2 typology of (F_char, F_cap) until enough data exists for calibration.
- `[high]` **Book III Ch 12-19 (8 PJ SU retrofit) — selection on the dependent variable**
  - All 8 retrofitted PJs are AMD-touched cases. AMD's selection into which seeds to engage is itself a function of perceived P, R, S, and ERS quality. This means the panel is selected on the model's own independent variables (and almost certainly on the dependent variable—AMD did not retrofit cases that never crossed its desk). The TIEM/BWE/CX/SX/CTB/YD/JC/CLG sample is a convenience sample from a single startup-studio's pipeline, not a population sample of Before Zero situations in Japanese deep-tech. The implications: (a) the 'failure pattern' inventory (Ch 4 やらかし) is conditional on the failure modes AMD's process exposes—failure modes invisible to AMD's screening are absent by construction; (b) the F-CES calibration cases are non-randomly drawn from founders AMD agreed to work with, who have above-average F_char by AMD's revealed preference; (c) the institution retrofits cover institutions AMD has relationships with, again non-random. The coherence audit caught the related issue of empirical balance (CLG under-anchored, TIEM over-anchored) but missed the deeper sampling issue. A referee will ask for a comparison set: how many Japanese deep-tech seeds entered Before Zero state in 2015-2025? What fraction did AMD see? How does the 8-PJ sample's (P, R, S, ERS, founder F) distribution differ from the population? Without this, the book is documenting AMD's house style, not Before Zero as a domain. Recommend: add an explicit 'sampling and external validity' section in Ch 1 or App B.1 acknowledging this; gather counterfactual cases from sister studios (Beyond Next, Mirai Souzou, IndiePartners, Anri seeds, etc.) even as secondary data; reframe the 8 PJs as 'AMD's training corpus' not 'the empirical base of the discipline'.
- `[high]` **Book 0 + Book VI — the 'new discipline' claim itself**
  - The discipline claim rests on two pillars in the design: (1) prior schools (Entrepreneurship, Innovation Studies, TTO Studies, Evolutionary Econ) leave Before Zero undefined; (2) PRS × ERS two-layer non-commutativity is a unifying formal device. Pillar (1) is defensible but overstated—Effectuation, Discovery-Driven Planning, Lean Startup all have explicit pre-firm phases, and the Triple Helix literature has institution-level dynamics. The claim 'four schools leave BZ undefined' is true only under a narrow reading; a referee will list at least 8-10 adjacent literatures the book ignores (entrepreneurial ecosystems literature à la Stam & van de Ven; nascent entrepreneurship PSED panels; absorptive capacity à la Cohen-Levinthal as a pre-firm capability construct; user-entrepreneurship à la Shah-Tripsas; science-based entrepreneurship beyond Shane—Vohora-Wright-Lockett 2004 'stages of academic spin-out development' is directly the Before Zero topic and is not in the design). Pillar (2) is the strong claim, but two-layer modeling is not novel—DSGE has sectors × firms, ecology has community × population dynamics, organizational ecology has institutional × organizational layers (Hannan & Freeman 1977 onward). What is novel is the specific carving (PRS multiplicative × ERS additive, non-commutativity warning, institution-as-environment-variable for project speed)—but that is a methodological contribution to the existing field of entrepreneurship-and-innovation, not a new discipline. A discipline needs (a) a unique object of study, (b) a research community larger than its founders, (c) a journal/conference infrastructure, (d) cumulative findings. The book has (a) arguably, but not (b)-(d). Recommend: downgrade 'new discipline' to 'new sub-field' or 'reframe of academic entrepreneurship around Before Zero state space'; add a literature review chapter that engages Vohora-Wright-Lockett, Clarysse-Heirman, Mustar et al., the PSED panels, and the entrepreneurial ecosystems literature; reserve 'discipline' for a 10-year retrospective if the prospective program succeeds.
- `[high]` **Book II Ch 5 + Ch 11 — GO formula identification**
  - GO(t,i) = 𝟙[σ_SU ≥ θ_σ] × g_TRL(t) is the central observational gate of the model. The coherence audit flags the canonical-owner problem, but the deeper issue is identification of θ_σ and the functional form of g_TRL. σ_SU itself is constructed from Triple Helix CD(μ_A, μ_I, μ_G), which requires identifying three latent macro factors from national-level academic publication, industry investment, and government policy series—then projecting onto a project-specific σ_SU. Each step has identification choices: (a) the CD aggregator's elasticity weights, (b) the projection from national μ to project-level σ_SU exposure, (c) the threshold θ_σ above which GO 'fires', (d) the shape of g_TRL(t)—is it logistic? Step function at TRL=6? Multiplicative in BRL? The Book II design assigns this to Ch 5 (per the audit's suggested fix) but with only 8 PJs and 7 institutions, none of these can be identified from data. They are all set by assumption + qualitative consistency check. That is fine for a theory book, but the book also wants Ch 26 to evaluate predictive performance of the GO gate—which is circular if the gate's parameters were calibrated to the same cases the prediction is evaluated on. Recommend: be explicit in Ch 5 anchor that σ_SU construction is a measurement model with strong identifying assumptions, list those assumptions, and commit Ch 11 (BVAR) to estimating only what is identifiable (probably: persistence of μ macro series, jump intensities at known shocks like COVID/CHIPS Act) while treating θ_σ, g_TRL shape, and project-level σ_SU mapping as fixed-by-assumption sensitivity parameters with explicit robustness analyses.

**Recommended strengthenings:**

- Rename Book III from '実証 Empirics' to 'Motivating Cases and Pattern Library'. Move all causal-estimation language (Ch 25 ∂/∂ERS_k, Ch 26 falsification) to Book VI as 'the prospective research program'. This single rename removes 80% of the identification objections without losing narrative substance.
- Add a methods chapter or substantive App B subsection titled 'Identification, Sampling, and What This Book Cannot Claim'. Explicitly state: (1) n=8 PJs is a convenience sample from one startup studio; (2) institution panel n=7 is too small for axis-by-axis causal identification; (3) all model parameters (a=0.6, ρ=-2, θ_σ, w_k weights, λ_k substitutabilities) are set by qualitative consistency with the retrofit panel, not estimated; (4) the book's contribution is the formal grammar (state space, observation gate, two-layer non-commutativity), not parameter values. This honest framing is what makes Research Policy / ICC referees willing to accept a theory paper at all.
- Commit now to a prospective Atlas registry: AMD pre-registers GO/WAIT/NO_GO assertions on every new seed it engages from 2026 forward, sealed and date-stamped, revealed only after τ_x or τ_y resolves. Target 30+ cases over 5 years. Publish the registry protocol as an appendix to the book. This converts the discipline claim from 'we have shown' to 'we have committed to a falsifiable program'—a much stronger epistemic stance for the book's positioning.
- Replace the (a=0.6, ρ=-2) and similar specific numerical parameter claims throughout the body with qualitative parameter ranges + sensitivity bounds. Move the precise calibration to App A.1 with full sensitivity analysis (does classification flip under reasonable parameter variation?). If classifications are robust, drop the precise numbers from body; if they flip, drop the classification claim until more data exists.
- Engage the missed literatures in a substantial Book 0 Ch 0.2 expansion (currently 'four schools'—expand to include Vohora-Wright-Lockett 2004 stages-of-academic-spin-out, Clarysse-Heirman 2007, Mustar et al. 2006 typology, PSED nascent entrepreneurship panels, Stam-van-de-Ven entrepreneurial ecosystems, Cohen-Levinthal absorptive capacity as pre-firm capability, Shah-Tripsas user entrepreneurship). Without this engagement, Ch 0.2's 'why four schools failed' is a strawman and the discipline claim is dismissed in the first reviewer pass.
- Downgrade 'new academic discipline' framing to 'a reframe of academic entrepreneurship around the Before Zero state space and two-layer readiness observation grammar'. This is a strong sub-field contribution claim that is defensible from the material; the discipline claim is not defensible until items 1-3 above mature. Reserve 'discipline' as a possible retrospective claim in a 10-year-anniversary edition if the prospective program succeeds.
- Resolve the dual-causal-story problem for Y-005 (Cabot機会逃し) at the protocol level: every やらかし case in App C must have a structured 'causal anatomy' template (case → ERS axis(es) involved → PRS factor(s) affected → counterfactual where each could have prevented it). This prevents the App C vs Ch 4.6 inconsistency the coherence audit flagged and makes the case library auditable.
- For the institution layer: either commit to full anonymization of all 7 institutions (no 'NIMS' / '工学院大学' name-mentioning anywhere in body, only structural types) OR commit to full disclosure with prior written consent on file. The current half-disclosure ('京大 (匿名)' style) is the worst option—it neither protects subjects nor enables verification. Recommend full anonymization for the empirical chapters (Ch 24, Ch 25, Ch 34) and full disclosure only for the 'thank you' / methodology appendix where consent can be documented.

---

### Entrepreneurship/Academic Entrepreneurship scholar (Shane 2004; Wright et al. 2007; Sarasvathy 2001, 2008; Eisenhardt; Audretsch). Peer reviewer at Research Policy / Industrial and Corporate Change. Reads the BZM proposal as a competing claim that wants to displace 25 years of AE literature with a Japanese deeptech startup-studio practitioner framework wearing an academic monograph's clothing. Defaults skeptical to "new academic discipline" claims, especially when the empirical base is 8 retrofit cases from a single firm.

**verdict**: yes-if-fixed — but only with structural surgery. As submitted, this is a strong practitioner-theoretic synthesis with publishable monograph-grade components (the two-layer non-multiplication argument, the σ_SU × R_net × F decomposition, the F-CES with experience-ordering for F_cap), but the "new academic discipline" claim does not survive AE-literature scrutiny. The proposal asserts that Shane (2004), Sarasvathy (2008), and Eisenmann (2021) have firm-exists / individual-founder / post-formation assumptions that fail in Before Zero — yet the proposal itself relies on PRS at the *case* level (an already-identifiable opportunity-founder-resource bundle in Shane's terms) and treats ι=none / F=0 mostly as ERS environmental conditions, not as the analytical object. That is not a new state space; it is Shane's nascent-entrepreneurship phase with a Japanese institutional overlay (URA/GAP/TLO) and a richer readiness vector. To earn "new discipline" status the book must (a) prove that the (ι, F, S0, I) state space contains structural features not reducible to nascent-entrepreneurship + Triple Helix + RBV-of-TTO, (b) survive an identification audit (8 retrofit PJs + 7 institutions is below the threshold for the causal claims in Ch 11/25/26), and (c) stop treating P(t)=max U(t) (機会創造観) as a settled premise when AE literature has fought about discovery-vs-creation for 20 years (Alvarez & Barney 2007; Davidsson 2015). With the structural changes below — especially a head-on Shane/Sarasvathy/Alvarez confrontation chapter, a prospective-prediction subset with pre-registration, and a clearer demarcation of what BZ adds beyond nascent + TH + AE — it can plausibly become field-defining for a Japanese-institutional-context subfield of AE / TT studies. As a standalone new discipline displacing four schools simultaneously: no.

**new_discipline_recognized**: yes-if-fixed

**Top critiques (severity high/critical):**

- `[critical]` **Book 0 Ch 0.1–0.2 (領土宣言 + 既存スクール限界マップ)**
  - The core claim that Entrepreneurship is 'undefined' on (ι=none ∨ F=0) is a strawman of Shane (2004) and the entire nascent-entrepreneurship literature (Reynolds & Curtin PSED I/II; Davidsson 2006; Wright et al. 2007 on academic spinouts). Shane's individual-opportunity nexus *requires* a pre-firm state; PSED has measured exactly the (ι=latent, F=0→1) transition since 1998 with N>1,200. Sarasvathy (2001, 2008) effectuation is explicitly pre-firm and explicitly non-individual when extended to networks (Sarasvathy & Dew 2005 on stakeholder commitment). Alvarez & Barney (2007) creation-discovery debate is *exactly* about P(t)=max U(t) territory — the book treats 機会創造観 as a definitional move without engaging Alvarez/Barney/Davidsson 2015 'reflections on opportunity'. Ch 0.2's four-school matrix is structurally correct but its 'failure mode' column for Entrepreneurship ('firm-exists assumption') is empirically false. The territory you want exists; it is called *nascent academic entrepreneurship in deep-tech institutional contexts*. That is publishable. 'New discipline' is not. Unless Ch 0.2 is rewritten with a direct, line-by-line confrontation against Shane (2004) Ch 4–6, Wright et al. (2007), Vohora et al. (2004) critical junctures model (which already maps to your Book IV time-series spine and which you do not cite), and Alvarez & Barney (2007), the declaration is going to be torched in the first review round at any A-journal-adjacent press.
- `[high]` **Book II Ch 6 + Book 0 Ch 0.3 (PRS = P × R × S 期待値分解 'is not CD regrouping')**
  - The proposal repeatedly insists 'E[価値] ≈ P × R × S は CD 再グルーピングではない' but never shows why. Algebraically, given P=ceiling and Pr(reach) = R × S, this *is* a standard expected-value decomposition that AE/strategy already uses (real-options framings of staged R&D; Adner & Levinthal 2004; McGrath 1997). The novelty has to be either: (i) the *measurement* protocol for R as the bundled min(TRL,BRL,GRL,SRL,HRL) — which is a SIP CE2023 policy framework you adopted, not derived; (ii) the S=σ_SU × R_net × F internal CD with experience-ordered F_cap — which is the genuinely novel contribution; or (iii) the gating GO=𝟙[σ_SU≥θ_σ]×g_TRL — which is a threshold rule, not an expected-value decomposition. Ch 6 needs to honestly admit that the P × R × S *form* is standard and locate the novelty inside S. Otherwise reviewers will read the multiplicative form as warmed-over real-options + readiness rebranded. Worse, the 'P(t)=max U(t) 機会創造観' is grafted onto P without engaging that this is a *contested* position in AE: many opportunities in deep-tech are arguably discovered, not created, and treating max U(t) as the operational definition pre-commits the book to a creation-school metaphysics that half the field rejects.
- `[high]` **Book II Ch 7 — F = CES(F_char, F_cap; a=0.6, ρ=-2) experience ordering and committee F_char**
  - This is the most genuinely original contribution in the book, and it is the most under-defended. (1) Where does a=0.6 come from? The current plan buries calibration in App A.1; you cannot calibrate a CES weight from 8 retrofit PJs — that's underdetermined (1 parameter, 8 obs, no exogenous variation in F_char vs F_cap). (2) ρ=-2 implies σ_substitution ≈ 0.33; this is a strong empirical claim and the cited evidence (Y-002, Y-003, 桑折 MTG) is not nearly enough for an A-journal reviewer. (3) The experience ordering IPO/Exit ≫ 調達リード ≫ PL ≫ 同業界 ≫ 知識 directly contradicts well-known AE findings (Beckman et al. 2007 on founder team composition; Eesley & Roberts 2012 on prior experience effects in MIT alumni) where domain experience is often equally or more predictive than financing experience for deep-tech. You need a head-on engagement with Beckman/Roberts/Eesley and either a Japanese-institutional explanation for why your ordering differs, or an admission that the ordering is conditional on Before-Zero stage specifically. (4) F_char as 'ALQ4 + Grit + Resilience' — ALQ (Walumbwa et al. 2008) has been substantially critiqued (Antonakis et al. 2016; Alvesson & Einola 2019 'Warning for excessive positivity'); Grit (Duckworth) has well-known meta-analytic effect-size collapse (Credé et al. 2017). Building F_char on these three psychometric instruments without addressing their replication problems is going to draw immediate fire.
- `[critical]` **Book III Ch 11 + Ch 25 + Ch 26 (BVAR+jump+gate, layer coupling, falsification)**
  - The identification claims are not survivable. 8 PJ × monthly observations + 7 institutions × annual observations, even in a mixed-frequency BVAR with Minnesota priors, cannot identify (i) 8 ERS axes × 2 PRS outcomes (R, S) causal effects, (ii) jump components for Y-001–Y-008 type shocks, (iii) θ_σ threshold, and (iv) g_TRL function — that is dozens of parameters on what is functionally 56 institution-PJ cells with massive within-cell autocorrelation. The coherence audit already flags this (Finding 13) and recommends honest reframing as hierarchical-Bayesian shrinkage. I agree, but stronger: the falsification conditions in Ch 26 (σ_SU≥θ_σ survival differential, F-CES rank preservation, ERS weighted-sum vs multiplicative) are *not testable* on retrofit data because the model was fit on the same 8 PJs. This is textbook overfit-then-validate-on-training-set. The YD NO_GO 'prospective' claim is one observation. To make Ch 26 credible you need either (a) a pre-registered prospective panel of ≥30 PJs and ≥15 institutions over ≥3 years (incompatible with 18-month timeline), or (b) a clean ex-ante / ex-post split where some PJs are held out, plus an external validation cohort (e.g., NEDO/JST databases, AUTM-Japan TLO surveys). Without one of these, Ch 25/26 cannot make causal claims and the 'new discipline' status collapses to 'plausible framework, untested'.
- `[high]` **Book III Ch 12–19 (8 PJ retrofit) — single-firm sample, hindsight bias, no comparison group**
  - All 8 PJs come from AMD's own portfolio. This is a clinical-case-series, not an empirical base for discipline-defining claims. Three problems an AE reviewer will hit immediately: (1) selection bias — AMD chose which deep-tech seeds to engage; the universe of seeds NOT selected (and their fates) is unobserved, so survival/failure rates are conditional on AMD's own ex-ante screening. (2) hindsight bias — retrofitting PRS values to TIEM after 'early-stage' is known to have been 'too early' is exactly the trap Eisenmann (2021) warns against; reviewers will demand the *ex-ante* PRS scoring (with date stamps) vs the *ex-post* outcome. The proposal hints at this with 'AMD 8 PJ 予測登録ログ' in Ch 26 but does not commit to producing ex-ante records. (3) no comparison group — for the ERS→PRS causal claim you need PJs from non-AMD institutional contexts and PJs that survived without AMD support. Without this, every 'finding' in Book III is consistent with 'AMD's house style worked for AMD's selected cases.' Recommend a 'shadow cohort' chapter (e.g., 5-10 published Japanese academic spinout cases retrofitted by the same protocol — Spiber, PeptiDream, Mirai Genomics, etc.) to break the single-firm sample problem.

**Recommended strengthenings:**

- Add a new chapter to Book 0 (or split Ch 0.2 into 0.2a/0.2b): a 25–35pp head-on confrontation with the four schools' best representatives — Shane (2004) Academic Entrepreneurship Ch 4–6, Wright et al. (2007), Vohora et al. (2004) critical-junctures, Sarasvathy (2008), Alvarez & Barney (2007) creation-vs-discovery, Eisenmann (2021), Eesley & Roberts (2012), Etzkowitz & Leydesdorff (2000), Bozeman (2000), Siegel et al. (2003), Kneller (2007), Walsh-Cohen-Cho (2007). For each, state precisely what they get right, what they miss in BZ, and what BZM adds — *without* the strawman that they are 'undefined' on (ι=none ∨ F=0). Honestly position the contribution as 'a formalization of nascent academic entrepreneurship in deep-tech Japanese institutional contexts via a two-layer non-multiplicative readiness model' rather than 'a new discipline displacing four schools.' Paradoxically this *strengthens* the field-defining claim because it lets the genuinely novel pieces (F-CES, two-layer non-multiplication, R as bundle-min) breathe.
- Designate Book II Ch 7 (S internal CES) as the primary novelty chapter and write it as if it were a standalone Research Policy article. Add: (i) explicit derivation of why CES (not CD, not linear, not Leontief) for F_char × F_cap, with the substitutability intuition tied to BZ-stage decision constraints; (ii) full calibration protocol for (a, ρ) using both retrofit and an explicit external validation set; (iii) sensitivity analysis showing how conclusions shift for ρ ∈ [-5, +0.5] and a ∈ [0.3, 0.8]; (iv) direct engagement with Beckman et al. (2007), Eesley & Roberts (2012), Colombo & Grilli (2005) on founder-team experience effects, with explicit hypothesis about why BZ-stage experience ordering differs from post-formation ordering; (v) replacement or supplementation of ALQ4/Grit/Resilience with measures that have stronger replication track records, or explicit acknowledgment of the psychometric controversies.
- Split Ch 26 into Ch 26a (in-sample fit on 8 retrofit PJs, honestly framed as calibration not validation) and Ch 26b (prospective falsification protocol). Ch 26b commits to a pre-registered prediction registry — register the next 10–15 PJs (AMD's own + shadow-cohort partners) with timestamped PRS/ERS scores and pre-specified GO/WAIT/NO_GO predictions before outcomes are observed. Even if the registry cannot mature in 18 months, the protocol's existence makes the falsification conditions actually testable and signals scientific seriousness. Add a 'shadow cohort' methods sub-section that retrofits 8–10 published Japanese deep-tech spinouts (Spiber, PeptiDream, Mirai Genomics, TBM, etc.) using the same protocol, breaking the single-firm sample problem.
- Resolve the σ_SU compositional/recursion problem with a clean formalism in Ch 5: define σ_SU at the national level with μ_A as aggregate academic productivity (publications, patents, conference activity — Leydesdorff-style), and add a separate Ch 5.x or Ch 34.x where the institutional ERS enters as a *moderator* of how national σ_SU translates into local opportunity windows for a given PJ. This is a hierarchical/multi-level structure (national σ_SU → institutional ERS → project R/S) that AE multi-level literature (Audretsch et al. 2006; Acs et al. 2009 knowledge spillover theory) already speaks. It removes circularity and connects to a literature you currently don't engage.
- Ration empirical anchors per the coherence audit's recommendations, but with one addition: build a 'taxonomy table' at the front of Book III that explicitly assigns each of the 8 PJs to a primary role (TIEM=ゾンビ型/早すぎ起業 reference; BWE=健全型/F_cap補完成功 reference; CTB=鋸歯型/段階補充 reference; YD=即落型/NO_GO reference; CX=R_net 共食い reference; SX=σ_SU 追い風×共食い reference; JC=shallow tech/自走型 reference; CLG=σ_SU 追い風依存型 reference) and a secondary role. Then every chapter outside Book III uses each PJ only in its assigned role. This solves TIEM over-deployment and CLG under-deployment simultaneously, and gives reviewers a single defensible mapping rather than ad-hoc case selection per chapter.
- Restructure 桑折先生 KUTE MTG 2026-06-24 from 'all-purpose primary evidence' to one (rich, named) data point in a structured Japanese-deep-tech-faculty interview program of N≥20 across ≥3 institutional types. Budget ~3 months of the 18-month timeline for interview wave 1 (≥15 interviews) and code transcripts against the seven 桑折 axes (出資金/シーズ転用/COI/退路/学生責任/論文-特許順序順序事故/取締役個人責任) plus emergent codes. Report inter-rater reliability. This converts the book's single-MTG dependency into a defensible qualitative dataset and gives Book V Ch 32–34 the institutional-design evidence it currently lacks.
- Cut total pages to 750–800 by adopting the coherence audit's specific cuts (App A trim, Ch 25 merge into Ch 11, Book III.SU2 normalization, Book 0 Ch 0.3 declarative-only) AND by removing the multiplicative-cosmetic uses of formulas in Book IV practice chapters (Ch 31.1–31.3) that the audit Finding 14 already flags. A tighter book reads as more confident; 1015pp signals 'we couldn't decide what to cut' to an editorial board considering monograph endorsement.
- Add an explicit 'scope statement' at the end of Book 0 stating: 'This book is about nascent deep-tech academic entrepreneurship in Japanese university and national-research-organization contexts. Generalization to (a) non-Japanese institutional environments, (b) non-deep-tech ventures, (c) corporate spinouts not from research institutions, and (d) social-mission startups requires further work. We claim discipline-defining status for this scope; we do not claim it for entrepreneurship-in-general.' This is the move that makes 'new academic discipline' defensible: stop trying to displace AE/Innovation/TT/Evolutionary at the universal level; carve out a defensible sub-territory and own it completely. Field-defining within a scope is a real thing (Audretsch's 'entrepreneurial society' did this; Wright/Lockett did this for academic spinouts). Field-defining without a scope is what reviewers reject.

---

## 4. Coherence 監査 (critical / high 問題のみ)

### coherence_audit

**Overall**: Total pages ~1015 — significantly over the 700-900 budget (12-31% bloat); Appendix at 270pp alone is ~30% of the entire book and needs sharp trim. Math depth pacing is well-shaped (Book II peaks Ch 5-11; Book IV/V/VI descend correctly), but the model is front-loaded in Book 0 to a degree that creates redundancy with Book I Ch 2-4. Empirical case allocation is reasonably distributed but TIEM appears in ~22 chapters as illustrative example (risk of fatigue) while CLG appears in only 3-4 chapters despite being one of 8 anchor PJs and getting its own retrofit chapter (Ch 19). 桑折先生 KUTE MTG 2026-06-24 placement is over-deployed (20+ chapters) — the intended Book I Ch 4 + Book IV Ch 28 anchoring is correct but the same material is repeatedly cited as 'first-source evidence' elsewhere, diluting its weight. Key cross-Book coherence issues: (a) GO formula 𝟙[σ_SU≥θ_σ]×g_TRL(t) is introduced informally in Ch 1 and Ch 4.7 before its formal derivation site (which is never clearly assigned — Ch 5? Ch 11? Ch 26 evaluates it but no chapter owns its derivation); (b) 'unknown vs not_started' is the operational core of ERS yet is split across Ch 3.5, Ch 24.2, Ch 33 without a canonical owner; (c) Book III Ch 25 (層間結合検証) does the causal-coupling estimation but Book II Ch 11 (BVAR+jump+gate) is the natural place for it — these two chapters overlap heavily; (d) the 'second generation of failure typology' (Ch 4.1-4.7 rubric of GO/WAIT/NO_GO/HOLD + 5 鬼門) is built in Book I before the math 装置 exists, which works as a teaser but means Book II readers have already seen the conclusions. Recommend: cut Appendix by ~100pp, merge Ch 25 into Ch 11, designate Ch 5 as canonical owner of GO formula derivation, designate Ch 3.5 as canonical owner of unknown/not_started, ration 桑折 MTG citations to ~6-8 chapters max.

**Critical / high findings:**

- `[critical]` **Sum across all chunks: Book 0 (64) + Book I.front (50) + Book I.back (70) + Book II.front (70) + Book II.mid (74) + Book II.B (110) + Book III.SU1 (90) + Book III.SU2 (114) + Book III.SU3 (52) + Book **
  - **issue**: Total page count ~1015 vs budget 700-900 — ~115-315 pages over
  - **fix**: Cut ~150pp to land at upper bound 900pp (allowing 200pp headroom for figures/refs). Specific cuts: (1) Appendix A (CES/CD/BSDE/Kalman/BVAR/non-commutativity, 6 sub-chapters) is ~120pp by implication — trim to 80pp by moving A.6 (二層非可換性) inline to Ch 9 where it belongs and merging A.4+A.5 into one BVAR chapter (~20pp save). (2) Book III Ch 25 (layer coupling, 55pp) overlaps Ch 11 (BVAR+jump+gate, ~40pp of the 110pp chunk) — merge, save ~30pp. (3) Book III.SU2 (Ch 15-17, 114pp for 3 case retrofits) is inflated vs Book III.SU3 (Ch 18-19, 52pp for 2 cases) — normalize SU2 to ~75pp, save ~40pp. (4) Book 0 Ch 0.3 (二層方法論) duplicates Book II Ch 9 and Ch 11 framing — trim Ch 0.3 to declarative form only, save ~10pp.
- `[high]` **Anchor text in Ch 0.1, 0.3, 1.4, 2.4, 4.6, 4.7 treats GO as defined; Ch 5 (Triple Helix SSM) anchor says 'σ_SU の生成' but does not claim GO ownership; Ch 6 (PRS導出) anchor explicitly says 'ERS を GO に乗法的に**
  - **issue**: GO formula 𝟙[σ_SU≥θ_σ]×g_TRL(t) has no canonical derivation chapter — it is referenced as established in Ch 1.2/1.4/4.6/4.7 (Book I) and used in Ch 25/26 (Book III) but never owned
  - **fix**: Designate Ch 5 (Triple Helix SSM) as the canonical derivation site. Add explicit anchor language to Ch 5: 'σ_SU の生成過程から GO(t,i) = 𝟙[σ_SU≥θ_σ]×g_TRL(t) を導出する。θ_σ の校正・g_TRL の推定は Ch 11、予測力評価は Ch 26 に委ねる。' Then in Book I Ch 1-4 anchors, change phrasing from 'GO(t,i) = ...' to 'GO(t,i) (Ch 5 で導出) ...' so readers know where to look.
- `[high]` **Ch 11 anchor: 'ERS は環境変数として案件 R/S の transition speed を rescale; mixed-frequency state-space で月次案件と年次機関を同居' — Ch 25 anchor: '二層構造の causal 結合: ∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を 8 軸別に推定'**
  - **issue**: Book II Ch 11 (BVAR+jump+gate) and Book III Ch 25 (層間結合検証) treat overlapping content — both estimate ∂(ΔR/Δt)/∂ERS_k and the institution→project causal channel
  - **fix**: Split cleanly: Ch 11 owns the method (BVAR specification, identification, prior elicitation, jump+gate machinery, posterior diagnostics) and runs on the full 8-PJ + 7-institution panel for the headline result. Ch 25 becomes a focused chapter on the substantive finding (which ERS axes most causally accelerate which PRS components, with axis-by-axis posterior plots and counterfactual decomposition) — methods now back-reference Ch 11. This way Ch 25 shrinks from 55pp to ~30pp and the method/finding separation is clean.
- `[high]` **Ch 3.5 (unknown と not_started を分ける — 評価の運用核心) introduces it; Ch 24.2 (地方単科型 — unknown を not_started と誤読した機関) uses it as the chapter thesis; Ch 33 (GAP+URA+EIR) re-applies it ('EIR は無い のか 卒業生経営人材プールが未棚**
  - **issue**: 'unknown vs not_started' is described as the operational core of ERS but the canonical Lv-flag operational definition is fragmented across three chapters
  - **fix**: Make Ch 3.5 the canonical site with the full 3-state operational definition (confirmed / unknown / not_started + 外部連携補完中). Ch 24.2 then becomes a case of misreading rather than a definitional site. Ch 33 cites Ch 3.5 explicitly. Add a one-page protocol sidebar in App B.4 that operationalizes the distinction for raters. Avoid re-defining in each appearance.
- `[high]` **Cited in Ch 0.1, 0.2, 0.3, 1, 2, 4 (multiple), 7, 10, 12, 13, 14, 15, 21 (own chapter), 23, 25, 27, 28 (intended anchor), 30, 32, 33, 35, A.6, C — appears in ~20+ slots**
  - **issue**: 桑折先生 KUTE MTG 2026-06-24 is cited in 20+ chapters as 'first-source evidence' — dilutes its weight as the centerpiece of Book IV Ch 28
  - **fix**: Ration to 6-8 high-value citations: Ch 0.1 (declaration), Ch 4.1 or 4.2 (鬼門 introduction via 論文-特許順序事故), Ch 21 (工学院大学 KUTE own chapter), Ch 28 (第一歩 — primary anchor as intended), Ch 30 (設立期 — 取締役個人責任), Ch 33 (GAP+URA+EIR connection — institutional design), Ch 35 (政策含意). Other citations should reference the MTG indirectly via earlier chapters or be substituted with composite institutional evidence. The MTG should feel like a recurring motif, not a universal solvent.
- `[high]` **Ch 25 anchor; Ch B.1 (Atlas データ仕様 — 8 PJ retrofit 観測台帳) confirms only 8 PJs; institutional ERS panel is 7 institutions (4 explicit + 3 anonymous) per Book III Ch 20-24**
  - **issue**: Book III Ch 25 anchor claims '∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を 8 軸別に推定' but the panel data (8 PJ × 7 institutions = 56 observations) is severely underpowered for 8-axis × 2-outcome × jumps estimation
  - **fix**: Either: (a) extend the Atlas panel — propose adding ~12 additional retrofit PJs across the 7 institutions to reach ~20 PJs × 7 inst = 140 obs (much better identification); or (b) acknowledge in Ch 25 that estimation is hierarchical-Bayesian with strong priors (effectively shrinkage to pooled estimates) and reframe as 'illustrative posterior' not 'identified causal estimates'. Option (b) is more honest given 18-month timeline. Add explicit limitation discussion to Ch 25 + Ch 26 反証 conditions.
- `[high]` **App C anchor: 'Y-005 Cabot 機会逃し — TIEM のシーズ段階で Cabot から打診があったが研究者が論文優先で握り潰し、3 年後に同等技術が他国で実用化された経緯'; Ch 4.6 anchor: 'TIEM が Cabot からの早期問い合わせに対応できず... 問い合わせ時点では σ_SU が立っていたが、機関側の契約処理速度 (ERS 軸4) が間に合わなかっ**
  - **issue**: App C (やらかし図鑑 全文) hook describes Y-005 Cabot 機会逃し as '研究者が論文優先で握り潰した' but Ch 4.6 / Ch 12 / Y-005 references throughout describe it as '機関側の契約処理速度 (ERS 軸4) が間に合わなかった' — two different causal stories for the same case
  - **fix**: Resolve the causal narrative for Y-005 before drafting. Most plausible: it was both (researcher publication preference + institutional contracting friction) and the layered causation is precisely the point — a single-cause framing collapses the two-layer structure. Rewrite App C hook to: 'Y-005 — TIEM のシーズ段階で Cabot からの打診があった際、研究者の論文優先と機関側 (ERS 軸4 契約処理) の速度不足が層をまたいで結合し、3 年後に同等技術が他国で実用化された経緯。本書の二層構造が causal に効くことを示す代表ケース。' Then Ch 4.6 owns the layered analysis.
- `[high]` **Ch 26 anchor: 'AMD 8 PJ 予測登録ログ (TIEM/BWE/CX/SX/CTB/YD/JC/CLG)' — but the retrofit nature of the 8 PJs means predictions are post-hoc, not registered ex ante. YD is described as 'UE律速 NO_GO 判定の事前公開と検証'**
  - **issue**: Book III Ch 26 (予測パフォーマンスと反証) lists three reversal conditions but the 'σ_SU ≥ θ_σ 案件の生存率が σ_SU < θ_σ 案件と統計的に区別できないなら GO ゲート反証' condition is testable only if a prediction registry exists prospectively
  - **fix**: Clarify in Ch 26 anchor + App B.1 (Atlas データ仕様) which observations are retrofit vs prospective. Honest framing: 'TIEM/BWE/CX/SX/CTB/JC/CLG = retrofit (post-hoc model fit, used for parameter calibration not validation); YD + 見送り案件ウォッチリスト = prospective (registered prediction, used for falsification). 反証 conditions are only meaningful on the prospective subset.' This is a credibility-critical distinction for the academic-monograph positioning.

---

### empirical_anchor_audit

**Overall**: 8 PJ カバレッジは概ね健全だが、TIEM が 20+ 章で primary/co-primary anchor として登場し過剰露出 (over-anchored)、CLG が 2 章のみで under-anchored。Y-001〜Y-005 は Book I Ch 4 で適切に抽象化され Book IV で実務再登場する構造になっており設計通り。機関 retrofit の命名ポリシーは「明示 4 + 匿名 3」を宣言しているが、Book III Ch 23 で香川大が明示扱い (本体は明示4が NIMS/工学院/愛媛/香川と読める) で fixed model の「明示 4 機関」と整合する一方、匿名 3 (京大/山口大/東京科学大) が複数章で「匿名」と明示されておりラベリングは一貫している。桑折先生 MTG は Book 0/I/III/IV/V/Appendix の 12 章以上に分散しており「全書 spine 的に効く一次情報」としての扱いは強いが、Book I Ch 0.2/Ch 1/Ch 4 で同じ「論文-特許順序事故」が反復され冗長性が出ている。未 anchor の概念データ点として (i) F_char が高位で F_cap 低位の補完成功ケース、(ii) R_net 厳密に負値のクリーンな共食い検出ケース、(iii) F_cap 補完による pivot 成功ケース、(iv) ALQ4 委譲不可性を示す対比ケース、(v) 健全型軌跡 (鋸歯でも即落でもない) の primary case がそれぞれ複数章で「予告/伏線」のみで本格展開されていない点が懸念される。

**Critical / high findings:**

- `[high]` **Book 0.1/0.3、Book I Ch 1/2/2.3/2.5/3.1、Book III Ch 12/20/21/24/24.1/25、Book IV Ch 27/29/30/31.1/31.3、Book V Ch 32、Book VI Ch 35/37、Appendix A.3/A.5/B.1/C**
  - **issue**: TIEM が 20+ 章で primary または co-primary anchor として登場し過剰露出。Book 0.1/0.3、Book I Ch 1/2/2.3/2.5/3.1、Book III Ch 12 (専属章)、Ch 20/21/24/24.1/25、Book IV Ch 27/29/30/31.1/31.3、Book V Ch 32、Book VI Ch 35/37、Appendix A.3/A.5/B.1/C で primary or 強い secondary。読者が『TIEM ばかり』『この本は TIEM の事後解剖か』と感じるリスク。
  - **fix**: TIEM の専属章 (Ch 12) と Book 0 領土宣言/Book III 層間結合 (Ch 25) と Appendix C やらかし図鑑には残し、Book I 概念章 (Ch 1.3/2.3/2.5)、Book IV Ch 27/29/30、Book V Ch 32 では BWE/CX/SX への置換または『TIEM は Ch 12 詳述、本章は他事例で多様性を担保』と明示。具体的には Ch 2.3 R-bundle min は SX 半導体 (GRL 律速) に主役交代、Ch 30 設立期 は CLG (追い風型の設立) を primary に。Ch 29 GAP 期は CTB (鋸歯型 GAP 補充) を primary に。
- `[high]` **Book III Ch 24/24.1/24.2/24.3、Ch 25、Book V Ch 32/33/34、Book VI Ch 36**
  - **issue**: 機関 retrofit の命名ポリシーは「明示 4 機関 (NIMS/工学院/愛媛/香川) + 匿名 3 機関 (京大/山口大/東京科学大)」で一貫しているが、Book III Ch 24.1/24.2/24.3 で『京大 (匿名)』『山口大 (匿名)』『東京科学大 (匿名)』と機関名を併記しており、これは fixed model の宣言 (匿名) と矛盾する半開示状態。本としての守秘責任と分析的識別性のバランスが曖昧。
  - **fix**: 二択を本書冒頭 (Book 0 または Preface) で明示宣言する必要。選択肢A: 匿名 3 は『研究大学型/地方単科型/統合大型』のタイプ名のみで通し、京大/山口大/東京科学大の実名は一切出さない (一貫匿名)。選択肢B: 全 7 機関を実名公表し、AMD 関係筋への事前同意取得を前提とする。現状の『匿名 (京大)』表記は最悪のハイブリッド。Ch 24.1-24.3 の章 anchor 欄から実名を削除し、Ch 34 地域動態でも『関西産業圏 / 山口瀬戸内 / 首都圏資本市場』の地域記述に止める。
- `[high]` **Book 0.1/0.2/0.3、Book I Ch 1/4/4.1、Book III Ch 12/13/14/21/23/25、Book IV Ch 28/29/30/31.3、Book V Ch 32/33、Book VI Ch 35、Appendix A.6/C**
  - **issue**: 桑折先生 KUTE MTG 2026-06-24 一次情報が Book 0.1/0.2/0.3、Book I Ch 1/4/4.1、Book III Ch 12/13/14/21/23/25、Book IV Ch 28/29/30/31.3、Book V Ch 32/33、Book VI Ch 35、Appendix A.6/C の 20 章以上で参照されている。これ自体は『一次情報を全書 spine として効かせる』設計と整合するが、同じ 7 論点 (出資金/シーズ転用/COI/退路/学生責任/論文-特許順序事故/取締役個人責任) が複数章で同じ文脈 (たとえば論文-特許順序事故が Ch 0.2/Ch 4.2/Ch 21/Ch 25/Ch 33 で反復) を繰り返し、読者は『また桑折』『また論文-特許』と感じる飽和リスク。
  - **fix**: 桑折先生 MTG を『専属章』として Book III Ch 21 (工学院大学 KUTE) に一次情報の全文を集約し、他章では論点ごとに 1:1 で割り当てる: (i) 論文-特許順序事故 → Ch 4.2 と Ch 21 のみ、(ii) 出資金/退路 → Ch 28 (先生が第一歩を踏み出すとき) のみ、(iii) 取締役個人責任 → Ch 30 (設立期) のみ、(iv) COI/兼業株式 → Ch 15 (SX 共食い) と Ch 32 (ERS 軸 7 処方) のみ、(v) 学生責任 → Ch 28 のみ、(vi) シーズ転用 → Ch 27 (掘り起こし) のみ。同じ論点が 2 章を超えて anchor になっている箇所は『Ch 21 参照』にポインタ化。

---

## 5. まさへの開放論点 (open_questions_for_masa)

1. 匿名化方針の確定: Ch 0.0 で7機関すべてを type 名のみとする案を採用したが、桑折先生からの個別同意取得が可能であれば 'Private-Engineering-Univ-Type (工学院大学 KUTE)' のような括弧付き併記を Ch 21 のみ例外的に許す選択肢もある。桑折先生・NIMS・愛媛大・香川大のうち、書面同意が取れる先と取れない先を 1 ヶ月以内に切り分ける必要。
2. 国際比較章 (Ch 24) の retrofit 対象機関の選定: MIT Deshpande Center / EPFL TTO / TU Munich UnternehmerTUM / KIT Karlsruhe / Tsinghua x-lab のうち、AMD が一次情報にアクセスできる先はあるか。完全公知情報のみで書く場合、MIT Deshpande が AUTM 系資料との接続で書きやすいが、深さは出ない。
3. Prospective prediction registry (Ch 26b) の 18 ヶ月以内 ≥20 case 登録 commitment が現実的か。AMD pipeline 8 PJ に加えて新規 12 PJ を BZ stage で観測・登録する協力先確保 (GAP fund 採択者経由, 桑折 KUTE 経由, 共同研究先大学経由) の見通し。
4. Ch 21 (Private-Engineering-Univ-Type) の桑折 MTG を N≥15 半構造化インタビュー program の wave-1 とする path を採るか、単一深層インタビューに留める path を採るか。前者は Book V の institutional evidence を厚くするが追加 3 ヶ月の field work を要する。
5. Ch 37 head-to-head 比較章で BZM が 4 frameworks (BZM / Triple Helix T(AIG) only / Effectuation / Nelson-Winter) に明確に dominate しなかった場合の reporting policy。完全 honest に書く (discipline claim を retreat させる) か、scope を絞って勝つ条件を探すか。事前に方針を握っておきたい。
6. やらかし図鑑 Y-006/Y-007/Y-008 の確定命名: 提案は Y-006 = unknown/not_started 誤読, Y-007 = 論文-特許順序事故, Y-008 = 取締役個人責任説明不在。Y-006 は機関側事故, Y-007/Y-008 は桑折 MTG 由来。この三件で図鑑が discipline 全体を覆うか、追加候補 (Y-009 法人化後の研究者-CEO 役割境界, Y-010 国研法人特有の出資制約) を視野に入れるか。
7. 書き順 (writing order): 提案は Book II Ch 5/5.5/9 (load-bearing 定理) → Book III Ch 12-19 (case library) → Book 0 (序章は最後) → Book I → Book IV → Book V → Book VI の dependency order。これで進めるか、Book 0 序章宣言を先に固めて全体の語彙を凍結してから derivation に入る古典的 monograph 順を採るか。
8. ALQ4/Grit/Resilience の psychometric controversy (Antonakis 2016, Credé 2017) への対応: F_char 指標を ALQ4 のまま走らせて Ch 7.4 で controversy を flag するか、Implicit Theories (Dweck) や HEXACO-Honesty-Humility 等の代替指標に置き換えるか。Y-002/Y-003 の retrofit 採点との互換性が変わる。

---

## 6. Book 別 chunk 設計 (詳細)

各 chunk = 1 つの workflow 設計 agent の出力。本書執筆時の 1 次素材として、各章の existing_content_to_reuse / new_content_needed / prior_lit_engaged を保存する。

### Book 0 序章 — 新領域宣言 (`book_0_declaration`)

**Book**: BZM / **Pages total**: 64

**Purpose**: Tier 3 学術モノグラフとして「Before Zero は新しい学術領域である」と上向きに宣言する load-bearing 序章。Entrepreneurship/Innovation Studies/Technology Transfer/Evolutionary Economics の既存スクールが Before Zero を扱えない理由を構造的に示し、PRS × ERS の二層 readiness 方法論を「対象の生存構造と評価目的から数式の形が導かれる」という方法論的主張として打ち出す。URA 実務読者の脱落を許容し、研究者・査読者・後続研究者に向けて領土の境界線を引く。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 0.1 | Before Zero — 領土宣言 | 18 | light | TIEM (透明断熱エアロゲル, 早すぎ起業の代表例) — 研究室外で再現しない素材を抱えて設立した瞬間、Entrepreneurship の教科書が一斉に無力 |
| 0.2 | 既存スクールの限界マップ — なぜ四つのディシプリンは Before Zero に届かなかったか | 22 | medium | Shane (2004) Academic Entrepreneurship: firm-exists assumption の射程限界, Sarasvathy |
| 0.3 | 二層 readiness 方法論 — 数式の形は対象の生存構造から導かれる | 24 | heavy | TIEM retrofit: PRS 内訳 (P 大, R の自社製造軸が穴, S は均衡) と機関側 ERS (匿名京大ケース) を別レイヤーで並べて、二重計 |

**Prior lit engaged**: Shane (2004) Academic Entrepreneurship, Sarasvathy (2001, 2008) Effectuation, Eisenmann (2021) Why Startups Fail / premature scaling literature, Etzkowitz & Leydesdorff (1995, 2000) Triple Helix, Freeman (1987), Lundvall (1992) National Innovation Systems, Bozeman (2000) Effectiveness of technology transfer, Siegel, Waldman & Link (2003) TTO performance, Bradley, Hayter & Link (2013) TTO models review, Nelson & Winter (1982) Evolutionary Theory of Economic Change, Dosi (1988) Sources of technological change, Metcalfe (1998) Evolutionary economics and creative destruction, Cabinet Office SIP CE2023 マルチ・レディネス・レベル枠組み, Mansfield (1995, 1998) Academic research and industrial innovation, Jensen & Thursby (2001) Proofs and prototypes for sale, Aghion, Dewatripont, Stein (2008) Academic freedom and incentives, Hellmann (2007) When do employees become entrepreneurs

**既存 bzm/ 内容再利用**: /Users/masa/projects/AMD/amd-os/pwa/bzm/preface.md の URA の場面と『会社になる前の時間』の言葉遣い (Ch 0.1 冒頭ストーリーの骨格) / /Users/masa/projects/AMD/amd-os/pwa/bzm/why-valuation-fails.md の四つの壁 (Ch 0.2 既存スクール限界マップの一部, 特に DCF が実質 P のみを測っていた点) と『二つの結末』のケース合成 (Ch 0.2 と 0.3 の retrofit ブリッジ) / /Users/masa/projects/AMD/amd-os/pwa/bzm/model-overview.md の二層構造節 (Ch 0.3 二層方法論の核, 判定層と動学層の区別, 戦略余力を 10 本目の軸にしない設計判断, 第一-第三世代の進化系譜) / model-overview.md の三件会議冒頭ストーリー (Ch 0.3 ホワイトボード場面の骨格として再利用可能) / preface.md の章型 (冒頭場面→解説→匿名化実例→章末問い) を Book 0 全章で踏襲

**新規執筆必要**: (1) Ch 0.1 冒頭の『新領域宣言』明示パラグラフ — Tier 3 学術モノグラフとして『Before Zero is a new academic discipline』を最初の見開きで打ち出す宣言文 (経済学者の verdict を踏まえた強い断言). (2) Ch 0.1 BZ 状態空間の formal definition — 観測量 (S0, I, ι, F, 制度的構成可能性) を Book I Ch1 への伏線として書き下す. (3) Ch 0.2 四スクール × 四 failure mode マトリクスの新規執筆 — Entrepreneurship/Innovation Studies/TT Studies/Evolutionary Econ それぞれの代表文献を 2-3 本ずつ正面から引用し、BZ への到達距離を測る. これは既存 bzm/ 章に存在しない. (4) Ch 0.2 各スクールから本書が継承する部品の明示 (Triple Helix → σ_SU, Effectuation → non-predictive logic, TTO 文献 → ERS 8軸, Nelson-Winter → population view). (5) Ch 0.3 乗法 vs 加重和の formal derivation — 『なぜ PRS は積で ERS は和か』を生存構造と評価目的から導く一節. why-valuation-fails.md には積の必然性しか書かれておらず、加重和の必然性と二者の対比は新規執筆. (6) Ch 0.3 二重計上回避の line-by-line 規則 — 同じ特許の『達成』面と『機関能力』面の切り分けプロトコル. (7) Ch 0.3 causal direction (institution → project speed) の明示 — 月単位 vs 年単位の時間スケール分離も新規. (8) 桑折先生 KUTE MTG 2026-06-24 一次情報の Book 0 への組み込み (論文-特許順序事故, 取締役個人責任, 学生責任). (9) Y-001 〜 Y-005 やらかし図鑑からの Book 0 用 condensed reference. (10) Book 0 → Book I/II/III への明示的な橋渡し節 (各章末).

---

### Book I 領土の定義 前半 (Ch 1-2) (`book_I_first_half`)

**Book**: BZM / **Pages total**: 50

**Purpose**: Book 0 で宣言した Before Zero 領域を、観測可能な対象として測定理論レベルで定式化する前半。Ch 1 は案件レイヤーの状態空間と観測量を、関係者ごとの時計差・支援の局所最適から逆算して定義し、なぜ「会社になる前」の量はスナップショットではなく時刻競合の構造を要求するのかを宣言する。Ch 2 は PRS 三因子 (P × R × S) の概念的導出 — 期待値分解、積であることの含意、足し算評価との非可換性 — を、機構詳細 (Triple Helix SSM や CES 内部) へ降りる手前で固める。Book II (機構層) の手前の、概念の正本になる二章。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 1 | 状態空間と観測量 — Before Zero を測るとはどういうことか | 22 | light | TIEM, 桑折 KUTE MTG 2026-06-24 (論文-特許順序事故), Y-002 CTO非開示, BWE |
| 1.1 | 観測対象の宣言 — 何を量として認めるか | 6 | none | BWE (女性ヘルスケアの顧客 vs 支払者分離), field-clocks 磨かれたピッチ事例 |
| 1.2 | 時計の二層分離 — 案件 (月) と機関 (年) を一つの軸にしない | 5 | light | field-clocks 七人の支援者事例, 工学院大学 (URA体制), Y-003 CEO中間管理職化 |
| 1.3 | 状態空間 (x, y) の導入 — 到達度と余力の二軸平面 | 6 | medium | TIEM, model-overview 医療系プロジェクト事例, CTB (drug discovery の段階補充型 y) |
| 1.4 | 観測者と時計 — 誰の時計で測ると何が見えなくなるか | 5 | none | Y-005 Cabot機会逃し, field-clocks 関係者×時計の地図, 愛媛大 (地方URA体制) |
| 2 | PRS — 天井 × 到達 × 生存の概念体系 | 28 | medium | TIEM, YD (UE律速 NO_GO), BWE, JC (shallow tech), Y-001 シリーズA命名, Y-004 premature sc |
| 2.1 | なぜ積か — 期待値の標準分解から PRS へ | 6 | medium | TIEM, model-overview 登山アナロジー |
| 2.2 | P — 潜在規模としての天井 | 6 | light | BWE, JC, CX (carbon market の天井動学) |
| 2.3 | R — 到達度の bundle 構造 | 7 | medium | TIEM (TRL 応用×組織 min), Y-002 CTO非開示 (HRL), SX (semiconductor の GRL), CTB (BRL/SRL |
| 2.4 | S — 生存と、三要素 CD の予告 | 7 | medium | YD (NO_GO 事例), CTB, JC, Y-005 Cabot機会逃し (σ_SU の時間窓) |
| 2.5 | PRS と Valuation の関係 — DCF は P だけを精緻化していた | 5 | light | Y-001 シリーズA命名, Y-004 premature scaling, TIEM (DCF的天井で R を覆った典型) |

**Prior lit engaged**: DCF / 標準 Valuation 理論, 内閣府SIP CE2023 (TRL/BRL/GRL/SRL/HRL bundle), リーンスタートアップ (前提が『ゼロの後』である点への批判), Triple Helix (Etzkowitz, Leydesdorff) — Ch 2.4 で予告として登場、本格展開は Book II Ch 5, Cooper Stage-Gate (GO/NO_GO 判定の比較対象), Real Options 理論 (戦略余力動学の前史として Ch 1.3 で軽く参照), Valley of Death 文献 (Auerswald & Branscomb 等) — Before Zero の領域宣言の周辺文献

**既存 bzm/ 内容再利用**: model-overview.md の三件並走会議は Ch 2 冒頭ストーリーの原型として再利用するが、Tier 3 学術モノグラフ向けに『悩みの会議』描写を圧縮し、TIEM/YD の二件並列に置き換える。model-overview の §『なぜ積なのか — 期待値の標準分解』『DCFは何を測っていたのか』『判定層と動学層』『戦略余力を10本目の軸にしない理由』は Ch 2.1, 2.5, 1.2, 1.3 の骨格としてそのまま素材化できるが、上位本では『進化の三世代』の語りを序章 (Book 0) に移し、本章では完成形だけを宣言する。field-before-zero.md の七つの不確実性は Ch 1.1 の観測量定義の母集合として使うが、列挙的記述から evidence grade の枠組みへ再フォーマット。field-clocks.md の関係者×時計の地図と七人の支援者事例は Ch 1.2 と 1.4 の核として再利用し、温度差 vs 時計差の議論を観測者依存性の節 (1.4) の出発点にする。

**新規執筆必要**: (1) 状態空間 (x, y) の正式な宣言と、PRS という観測量がこの空間の上にどう乗るかの図解 — 既存 bzm/ には平面の絵が断片的にしかなく、新規書き下ろしが要る。(2) 観測量の evidence grade を測定理論レベルで定式化する節 (Ch 1.1) — 既存は散文的記述に留まる。(3) 二層分離 (PRS 乗法 × ERS 加重和) を時間粒度から導く方法論的主張 (Ch 1.2) — 既存 bzm/ には ERS との対比節がなく、本書の中心的方法論的主張として新規。(4) 観測者依存性の節 (Ch 1.4) — field-clocks の時計差を観測理論の語彙に翻訳する作業。(5) R bundle の Yes/No チェックリスト原則の概念定義 (Ch 2.3) — 既存 r-readiness は実務寄りで、SIP CE2023 への学術的接続が薄いので Tier 3 向けに書き下ろす。(6) S 三要素 CD と Pr(τ_x<τ_y) の橋渡し (Ch 2.4) — strategic-slack と s-survival に素材はあるが、両者を Book II の機構詳細へ送る形で要約圧縮する書き下ろしが必要。(7) PRS vs DCF の上位互換性主張を経済学・経営学的に擁護する節 (Ch 2.5) — Book III Ch 25/26 の批判への伏線となる定式化を新規執筆。経験的アンカーは TIEM/YD/BWE/JC/CTB/SX/CX に Y-001~005 と桑折 KUTE MTG を分散配置。

---

### Book I 後半: ERS 概念 と 失敗パターン抽象 (`book-I-back`)

**Book**: BZM / **Pages total**: 70

**Purpose**: Book I の前半で導入された状態空間と PRS 概念を、機関レイヤー (ERS) と失敗パターンの体系化へ拡張する。Ch 3 では、研究機関を「ベンチャーを生み育てる装置」として 8 軸加重和で測る方法論を導入し、PRS の乗法と ERS の加重和が「異なる対象・異なる目的だから異なる数式の形を取る」という本書の核心的方法論主張を確立する。Ch 4 では Before Zero の典型失敗を Y-001〜Y-005 系として抽象化し、後の Book II 数学装置層で扱う σ_SU / F / 戦略余力動学 / GO判定 への伏線を、まず物語と分類学として埋め込む。Book I の閉じとして、二層構造の片側 (機関側) と、二層をまたいで現れる失敗構造の両方を、数式を本格化させる前に直観として読者に渡す役割を負う。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 3 | 機関整備度 (ERS) — 苗床という第二の対象 | 32 | medium | NIMS, 工学院大学 (桑折研), 愛媛大学, 香川大学, 京大 (匿名), 山口大学 (匿名), 東京科学大 (匿名), 桑折先生 KUTE MTG 202 |
| 3.1 | なぜ案件と分けて『土壌』を測るのか | 6 | none | 冒頭の二大学 composite (NIMS と工学院大学の運用差を匿名合成) |
| 3.2 | 8 軸とその並び — 研究成果が会社になるまでの経路 | 8 | light | 工学院大学 (桑折研, 株式保有・SO 制度の論点), Y-002 CTO 非開示 (制度設計の欠落事故), NIMS (TLO 機能の実装例) |
| 3.3 | Lv1-5 rubric と充足率の計算 | 7 | medium | 工学院大学 (株式・SO 規程の現状), NIMS TLO サブ軸の rubric, 愛媛大学・香川大学の知財・契約軸 |
| 3.4 | なぜ加重和か — 数式の形は対象から導かれる | 6 | heavy | 7 軸標準・1 軸欠落の合成シミュレーション, 京大 (匿名, 外部 TLO 連携で軸 2 を実効補完) |
| 3.5 | unknown と not_started を分ける — 評価の運用核心 | 4 | none | 地方大 composite (愛媛・香川の運用経験合成), 山口大学 (匿名, 卒業生 EIR の発掘) |
| 3.6 | 案件と機関を混ぜない — 二重計上禁止の現場運用 | 5 | light | 国立大 (匿名, 成功体験の解体ケース), 工学院大学 (桑折研, 個人と機関の責任配分), Y-001 シリーズ A 命名 (個人責任が機関に流れた構造) |
| 4 | 失敗パターンの抽象 — やらかし図鑑から鬼門の分類学へ | 38 | light | TIEM (透明断熱エアロゲル, 早すぎ起業代表), Y-001 シリーズ A 命名, Y-002 CTO 非開示, Y-003 CEO 中間管理職化, Y-0 |
| 4.1 | 取り返しのつく失敗とつかない失敗 — 鬼門という概念 | 4 | none | TIEM 開示事故 composite, 桑折先生 MTG 2026-06-24 (論文-特許順序事故の一次情報) |
| 4.2 | 鬼門 I — 外部開示の順序が壊す四つのもの | 6 | light | TIEM 開示事故 composite, 桑折先生 MTG (論文-特許順序事故), Y-002 CTO 非開示 (開示設計の欠落事故) |
| 4.3 | 鬼門 II — 会社化のタイミングと退路の喪失 | 8 | medium | TIEM (早すぎ起業代表), Y-001 シリーズ A 命名 (登記後の資金期待固定), Y-004 premature scaling, 桑折先生 MTG  |
| 4.4 | 鬼門 III — CEO 機能の早すぎる要求と F-CES への伏線 | 7 | light | Y-003 CEO 中間管理職化, TIEM (CTO/CEO 配置の試行錯誤), BWE (女性ヘルスケア, F_cap 補完の成功例), CTB (drug |
| 4.5 | 鬼門 IV — 役割空欄と『悪い知らせの運び手』 | 6 | none | field-who-carries ケース 1 (機能性材料, 完璧な CEO 探しで一年止まった案件), field-who-carries ケース 2 (検 |
| 4.6 | 鬼門 V — 機会逃しと σ_SU タイミング | 5 | medium | TIEM/Y-005 Cabot 機会逃し, CX (carbon, σ_SU タイミング事例), SX (semiconductor, 政策 σ_SU との同 |
| 4.7 | 判断語彙と Book II への橋渡し — GO / WAIT / NO_GO / HOLD | 2 | light | field-gates.md 実例 2 (機能性材料の WAIT 設計), YD (UE 律速 NO_GO の正しい運用), BWE (GO 判断のタイミング) |

**Prior lit engaged**: Etzkowitz & Leydesdorff (Triple Helix, 1995/2000) — σ_SU の概念基盤として ERS 軸の並びの正当化に参照, 内閣府 SIP CE 2023 (TRL×BRL×GRL×SRL×HRL bundle 定義) — ERS 軸 2 (知財) と軸 4 (契約) の rubric が依拠する制度文書, Ries, E. (The Lean Startup, 2011) — premature scaling (Y-004) 批判の出発点として、ただし Before Zero では Lean MVP 以前の不可逆性が支配するという批判的継承, Blank, S. (Four Steps to the Epiphany, 2005) — customer development の語彙、ただし研究シーズには探索期間が桁違いに長いという反論, Christensen, C. (The Innovator's Dilemma, 1997) — R_net の共食い概念, Kahneman, D. (Thinking Fast and Slow, 2011) — 失敗記録の粒度と認知バイアスの議論, Schumpeter (1934/1942) — 企業家機能の分解 (Book II F-CES への伏線として Ch 4.4 で参照), 産総研・JST・AMED の URA/EIR 制度設計文書 — ERS 軸 3, 5 の rubric 根拠, 桑折一郎 (工学院大学, 出資金・COI・株式保有・退路に関する一次情報, KUTE MTG 2026-06-24) — 軸 7 制度設計の現場知見, Mazzucato (The Entrepreneurial State, 2013) — μ_G の役割と GAP ファンド政策の位置づけ

**既存 bzm/ 内容再利用**: nursery-ers.md (約 240 行) は Ch 3 の主要素材として節構成 (3.1-3.6) にほぼ一対一にマップできる: 冒頭の二人の研究者場面 → 3.1、8 軸表とサブ軸内容 → 3.2、Lv1-5 rubric (軸 2/6/7 の rubric テーブル) と計算式 → 3.3、加重和 vs 乗法論争節 → 3.4、unknown/not_started 区別節 → 3.5、二層混同禁止節と二つの実例 → 3.6。レーダーチャート図 (f4_ers_radar.png) と二層図 (g17_nursery_two_layer.svg) はそのまま流用。field-gates.md (約 320 行) は Ch 4 の主要素材で、鬼門概念 → 4.1、外部開示の順序 → 4.2、会社化タイミング → 4.3、CEO 機能 → 4.4、判断語彙 → 4.7 へマップ。図 g08_ip_order / g09_registration_branch / g10_ceo_decompose / g11_go_wait_vocab を流用。field-who-carries.md (約 225 行) は Ch 4.4-4.5 の素材として、創業者機能 5 分解、九十日メモ、悪い知らせの運び手、失敗記録の四行型を提供。図 g26_placement_matrix / g14_role_template / g15_failure_granularity を流用。

**新規執筆必要**: Ch 3 の新規執筆量は中程度: (a) Book II の F-CES / σ_SU / GO判定 への明示的伏線を 3.4 と 3.6 に追記 (既存 nursery-ers.md は単独章として書かれており Book II 数学装置との接続が薄い)、(b) 桑折先生 MTG 2026-06-24 で得た工学院大学の制度設計 (軸 7) 一次情報を 3.2-3.3 の rubric 例として組み込む、(c) NIMS / 工学院大 / 愛媛大 / 香川大の明示機関 + 京大 / 山口大 / 東京科学大の匿名機関を Book III 機関章 (Ch 20-24) への伏線として 3.5-3.6 で軽く参照する補強が必要。Ch 4 の新規執筆量は大きい: 既存 field-gates.md と field-who-carries.md は鬼門 I-III + 役割空欄を扱うが、(a) Y-001 から Y-005 までの『やらかし図鑑』分類学としての体系化 (4.1 で総覧、各 Y 番号を本章のどこで扱うかの対応表) が新規、(b) 鬼門 V (機会逃し / Y-005 Cabot) の節 (4.6) は既存にないため完全新規執筆 — TIEM の Cabot 機会逃しを σ_SU タイミングと ERS 軸 4/5 の結合不全として再記述する内容、(c) 4 章全体の橋渡し節 (4.7) は Book II 数学装置との明示的な対応表を要する新規執筆、(d) 8 PJ retrofit (TIEM/BWE/CX/SX/CTB/YD/JC/CLG) のうち失敗側面を抽出して Y-001〜Y-005 と紐付ける表を 4.1 末尾に新規作成。

---

### Book II 機構 前半 — Triple Helix SSM と PRS 期待値分解導出 (`book_ii_first_half_th_prs`)

**Book**: book_ii / **Pages total**: 70

**Purpose**: Book II の前半として、Book I で概念導入した PRS = P × R × S と Triple Helix 環境動学に、学術monograph 水準の数学装置を与える。Ch 5 は σ_SU を産生する Triple Helix を 3 状態の SSM (内閣府SIP CE2023 Coupled Dynamics) として定式化し、Etzkowitz/Leydesdorff の言語社会学的記述から計量可能な状態空間モデルへ橋を架ける。Ch 6 は意思決定理論の標準的期待値分解 E[V] ≈ 賞金 × 到達確率 から出発し、Pr(到達) = R × S への分解、さらに S の内部分解 σ_SU × R_net × F (CES) への接続まで、なぜ「乗法」「三因子」「この順序」かを公理から導出する。両章とも Book I の直観モデルを Book III 実証・Book IV 実務での運用に耐える形式へ昇格させる位置にある。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 5 | Triple Helix 状態空間モデル — μ_A, μ_I, μ_G の Coupled Dynamics と σ_SU の生成 | 32 | derivation | CX, SX, YD, CTB, 桑折先生 KUTE MTG 2026-06-24 |
| 6 | PRS = P × R × S の期待値分解導出 — なぜ積か、なぜ三因子か、なぜこの順序か | 38 | derivation | TIEM, BWE, JC, Y-001, Y-004, Y-005 |

**Prior lit engaged**: Etzkowitz & Leydesdorff (Triple Helix), 内閣府 SIP Coupled Dynamics 2023 (CE2023), Savage / Raiffa 意思決定理論の期待値分解, NASA TRL (Mankins 1995) と SIP 5視点 (TRL/BRL/GRL/SRL/HRL), Sarasvathy (Effectuation, 機会創造観), Christensen / Eisenmann (premature scaling), Kerr-Nanda-Rhodes-Roberts (founder selection), Damodaran (DCF と startup valuation の限界)

**既存 bzm/ 内容再利用**: model-overview.md の「なぜ積なのか — 期待値の標準分解」節、「判定層と動学層 — モデルの二層構造」節、「モデルの進化 — 第一世代→第二世代→第三世代」節は Ch 6 の直観導入と歴史的動機づけにそのまま流用する (Book I で既出のため Ch 6 では再掲せず参照のみ)。p-potential.md の P(t) = max_u U(t) 定義式とTAM/SAM/SOM 三層の証拠の質議論は Ch 6 の P 公理化に転用。r-readiness.md の R 不可逆性、TRL 応用×組織マトリクスの min 演算、Yes/No 観測項目への分解は Ch 6 の R を「確率」ではなく「進捗ストック」として読む論証部分に直接接続。Triple Helix に関する model-overview.md の σ_SU 言及は Ch 5 冒頭の橋渡しに用い、本格的な SSM 定式化は新規。

**新規執筆必要**: Ch 5 では Triple Helix を 3 変量連続時間 SSM として書き下す形式 (状態方程式 dμ/dt = A μ + B u + Σ dW、観測方程式 y_t = C μ_t + ε_t)、安定性条件、結合行列 A の符号制約 (cross-helix positive feedback と self-damping)、σ_SU = f(μ_A, μ_I, μ_G) の集約関数の選び方 (CES vs 線形 vs min)、BVAR 推定の同定問題と jump 項の必要性、を新規執筆。SIP CE2023 の式と本書記号の対応表を付録 A 候補として準備。Ch 6 では期待値分解の公理化 (linearity / multiplicativity of independent factors / why not additive)、P と R の独立性が成り立つ条件と崩れる条件、Pr(到達) を R と S に分けることの情報理論的意味 (現在位置と燃料が独立な情報)、ERS を案件 GO に乗法的に組み込まない理由を二層分離定理として書き下す、第一世代 (加法) を Cobb-Douglas 統合に置き換えても救えない反例を TIEM retrofit から構成、を新規執筆。両章とも章末問いは判定層と動学層の往復を意識した形式に再設計。

---

### Book II 機構 中盤 — S 内部構造と戦略余力動学 (`book_II_mid_S_dynamics`)

**Book**: book_II / **Pages total**: 74

**Purpose**: Book II 中盤は、PRS のうち最も内部構造の深い S を二章に分けて完全に展開する。Ch 7 は S = σ_SU × R_net × F の三要素分解とその「代替的合成」の構造、特に F の内側だけが CES (ρ=-2) で補完的に折れる二段構えの非対称性を厳密に導出する。Ch 8 はその静的スナップショットを (x, y) 平面上の二時刻競争 S = Pr(τ_x < τ_y) として動学化し、ギャンブラーの破産問題の系として戦略余力動学を定式化する。フロー条件 (生存条件式 B-R_net≤F) からストック動学 (鋸歯軌跡) への持ち上げが、この二章の方法論的中核である。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 7 | S の内部構造 — 代替的三要素と補完的二層 F | 36 | heavy | TIEM (早すぎ起業: F_cap=低のまま B 起動), BWE (女性ヘルスケア: σ_SU 追い風と R_net 共食い両面), Y-001 (シリーズ |
| 8 | 戦略余力動学 — S = Pr(τ_x < τ_y) と二時刻競争 | 38 | derivation | CTB (創薬: R_net=0 でも鋸歯型で初到達確率高), YD (波力: UE律速で τ_x 発散・NO_GO 判定の典型), CX (carbon: σ |

**Prior lit engaged**: Walker & Avant / Luthans & Avoluo: Authentic Leadership 四次元 (F_char の測定基盤), Duckworth: Grit — passion and perseverance for long-term goals, Connor-Davidson Resilience Scale (CD-RISC), Unger et al. (2011) human capital meta-analysis (経験 vs 知識の事業成果相関), Kaplan, Sensoy, Stromberg: Founder team quality and VC investment decisions, Bernstein, Korteweg, Laws (RCT on AngelList): 創業チーム情報が投資判断を支配する実証, Arrow, Chenery, Minhas, Solow (1961): CES production function, Cobb & Douglas (1928): production function (S 外側の代替的合成の原型), Etzkowitz & Leydesdorff: Triple Helix (σ_SU の理論基盤), 内閣府 SIP CE2023: TRL×BRL×GRL×SRL×HRL bundle (R との連結), Feller (1968) An Introduction to Probability Theory Vol.1: Gambler's ruin problem (S = Pr(τ_x<τ_y) の原型), Karlin & Taylor: First-passage times of diffusion processes, Eisenhardt & Schoonhoven (1990): Founding team and new venture performance, Blank & Dorf: Customer Development (premature scaling 批判の系譜), Marmer et al. Startup Genome: premature scaling 実証, Gornall & Strebulaev: VC value creation and J-curve dynamics, Ries: The Lean Startup (Jカーブ一律適用への批判素材), Goldfarb & Kirsch: Bubbles and Crashes (σ_SU 過熱期の生存歪み)

**既存 bzm/ 内容再利用**: bzm/s-survival.md は Ch 7 のほぼ全骨格を提供する: 分離膜審査会の冒頭ストーリー、生存条件式 B-R_net≤F の導出、三要素テーブル、R_net の「種類で差別しない/純で測る」二注意、F の二層 (Authentic Leadership 四因子 + Grit + Resilience の F_char と IPO/Exit≫調達リード≫PL≫業界≫知識の F_cap)、CES ρ=-2 a=0.6 の数値表 (8×8=8.00 vs 8×1=2.05)、設立を遅らせる選択肢、Jカーブ一律適用批判、二相談ケース、章末問い 8 項目 — これらは Tier 3 monograph 化にあたり数式厳密化と prior lit 引用補強の上で全面再利用。bzm/strategic-slack.md は Ch 8 の骨格を提供する: (x,y) 平面定義、y の五成分、月単位への共通換算、健全性指標 H、鋸歯グラフと軌跡四類型 (健全/ゾンビ/即落/鋸歯)、機能性材料ケース、ライセンス 4 点セットと料率三原則、章末問い — ただし monograph では交渉論/ライセンス料率実務パート (Lv1-4 開示設計・ロイヤリティ 25% ルール等) は実務寄りすぎるため Book IV (Practice spine) Ch 30-31 へ移管し、本章は S = Pr(τ_x < τ_y) の確率論的定式化に集中させる。f6-f8 (slack plane / sawtooth / trajectories) および g24/g25 (pillars / condition) は図版資産として継承。

**新規執筆必要**: Ch 7 では、(1) F の CES が ρ=-2 a=0.6 で確定する根拠を、F_char 委譲不可性と F_cap 補完可性から「補完弾力性 σ=1/(1-ρ)=1/3 < 1」として導出する補題、(2) 外側 CD と内側 CES の非対称が「測定スケールの違い (要素は 0-9 離散、F 内層は連続的経験曲線)」から正当化されることの方法論注、(3) 期待値分解 E[価値] ≈ P×R×S と S 内の CD 再グルーピングが「乗法構造の二重カウントではない」ことの形式的注記、(4) 桑折 MTG の出資金/退路/COI/学生責任を F_char の内在化道徳観 (Authentic Leadership 第4次元) と F_cap の PL責任経験の交点として位置づける節、(5) ALQ4 + Grit + Resilience の心理測定論的妥当性レビュー、を新規執筆。Ch 8 では、(1) S = Pr(τ_x<τ_y) を二次元拡散過程の初通過時刻問題として書き下し、x のドリフト μ_x (R-progress) と y のドリフト μ_y = R_net - B、ジャンプ項 (調達/助成金/有償PoC) を含む SDE 形を定式化、(2) 鋸歯軌跡を piecewise drift + Poisson jump 過程として閉じた式で書き、純 R_net=0 でも τ_y 期待値が長い鋸歯型 (創薬・CTB) で S が下がらないことを定理化、(3) 軌跡四類型を (μ_x, μ_y, jump intensity) パラメータ空間の領域として分類、(4) 健全性指標 H = y/T_remaining が局所マルコフ近似下で生存確率の単調変換になる条件、(5) GO(t,i) = 𝟙[σ_SU≥θ_σ] × g_TRL(t) と本章動学の連結 — ERS が GO に乗法で入らない理由を τ_x のドリフト押上げ効果として再導出、(6) Gen-3 dynamics への接続を新規執筆。両章とも BVAR+jump+gate 推定 (Ch 11) への前方参照を明示。

---

### Book II 機構 後半: ERS 加重和導出, 進化経済拡張, BVAR 推定 (`II-B`)

**Book**: II / **Pages total**: 110

**Purpose**: Book II 後半は、案件レイヤー (PRS 乗法) から機関レイヤー (ERS 加重和) へとレイヤーを切り替えた瞬間に、なぜ数式の形そのものが変わらなければならないのかを methodological argument として確立する三章である。Ch 9 は ERS 加重和を「補完で動く対象 × 欠損可視化という目的」の両条件から導き、PRS の乗法と並べて二層分離が二重計上禁止に至る筋を完成させる。Ch 10 は進化経済学 (Nelson-Winter ルーティン進化、Triple Helix CD) で BZM を上位理論に接続し、ERS を「機関ルーティンの population state」、σ_SU を Triple Helix の selection environment として書き直す。Ch 11 は二層を同時推定する計量装置として BVAR+jump+gate モデルを提示し、案件 (月次, jump) × 機関 (年次, 緩慢ドリフト) × GO ゲート (σ_SU 閾値) の three-clock structure を識別問題ごと提示する。本 chunk が確立した方法論枠が、Book III の retrofit 検証で動くことになる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 9 | ERS 加重和の導出 ― レイヤーが変われば数式の形が変わる | 42 | derivation | NIMS, 工学院大学, 愛媛大, 桑折 KUTE MTG 2026-06-24 (兼業COI規程の Lv 評定), 匿名地方大 (ギャップ資金 Lv1 で全体 |
| 10 | 進化経済学拡張 ― ルーティン・selection environment・co-evolution | 30 | medium | NIMS (材料分野の selection environment), 京大 (iPS 周辺の高 σ_SU 帯), 東京科学大 (旧東工大-医科歯科統合後の c |
| 11 | BVAR + jump + gate ― 二層を同時推定する三時計の計量装置 | 38 | heavy | 8 PJ retrofit panel (TIEM/BWE/CX/SX/CTB/YD/JC/CLG の月次系列をデータ仕様サンプルとして提示), Y-001 シ |

**Prior lit engaged**: Cobb (1928) / Douglas - Cobb-Douglas production function, Nelson & Winter (1982) An Evolutionary Theory of Economic Change, Etzkowitz & Leydesdorff (1995, 2000) Triple Helix, Leydesdorff & Ivanova (2014) mutual information measure of Triple Helix synergy, 内閣府 SIP CE2023 readiness 体系 (TRL/BRL/GRL/SRL/HRL), Bernstein, Korteweg & Laws (2017) Journal of Finance - investor decision experiment, Sims (1980) Macroeconomics and Reality - VAR, Litterman (1986) / Doan-Litterman-Sims - Bayesian VAR with Minnesota prior, Hamilton (1989) regime switching, Tong (1990) threshold models / TAR, Barro (2006) rare disasters / jump processes, Stokey (2009) Economics of Inaction - optimal stopping with thresholds, Aghion & Howitt - creative destruction (Gen-3 dynamics 接続), Dosi (1982) technological paradigms / trajectories, Murmann (2003) co-evolution of firms and institutions, Etzkowitz (2008) entrepreneurial university, Geuna & Muscio (2009) university technology transfer literature

**既存 bzm/ 内容再利用**: nursery-ers.md は Ch 9 のほぼ完成原稿として再利用できる。特に「掛け算ではなく加重和」節 (L140-156)、unknown/not_started 区別 (L184-191)、8軸 rubric (L83-110)、二重計上禁止の論証 (L160-170) は加重和導出の核を既に書ききっている。ただし Tier 3 monograph 化のため、(a) Cobb-Douglas vs additive vs CES vs Leontief を一覧化した formal taxonomy 表、(b) 加重和選択を axiomatize する 4 公理 (separability, externality-compensability, gap-visibility, monotonicity)、(c) Murmann/Geuna 等先行文献との位置づけを追加する必要がある。score-and-bottleneck.md は Book II 前半 (Ch 6-7) で使う PRS 計算装置の素材なので Ch 9 では参照のみ、ただし「加重和 vs Cobb-Douglas」比較表は score-and-bottleneck.md L66-72 の三方式比較表をそのまま引用して対称性を作る。Ch 10 と Ch 11 については bzm/ に直接の素材がない、新規執筆。

**新規執筆必要**: Ch 10 は完全新規。Nelson-Winter のルーティン進化を ERS 8軸の各サブ軸 Lv1-5 が「機関ルーティンの phenotype 状態」として読める形で書き直し、Triple Helix CD synergy (μ_A, μ_I, μ_G) を σ_SU の microfoundation として接続する。NIMS/工学院大学/京大などの機関 retrofit を Murmann 流 co-evolution の事例として早めに匂わせる。Ch 11 も大半新規。BVAR (Minnesota prior、機関軸の slow drift には tight prior、案件 jump component には diffuse) の数式、jump component (Y-001 や Cabot 機会逃しのような discrete shock)、gate (GO=𝟙[σ_SU≥θ_σ] × g_TRL(t) を probit smoothing で観測モデルに織り込む) の identification 戦略、データ仕様 (案件月次パネル × 機関年次パネルの mixed-frequency 推定)、桑折 MTG の一次情報を prior elicitation の例として組み込む。derivation appendix への参照を貼る。

---

### Book III SU retrofit 1: TIEM/BWE/CX (`book-3-su-retrofit-1`)

**Book**: BZM / **Pages total**: 90

**Purpose**: Book III の入口として、PRS×ERS 二層モデルを「結末の分かった 3 つの自社 PJ」に blind retrofit し、モデルが現実の軌跡をどこまで言い当てるかを示す。TIEM は R_internal ゼロ近辺が積構造で全体を潰した「早すぎ起業」の代表として PRS 乗法構造の検証を担う。BWE は σ_SU 高位でも F_char 欠落で停滞した、F-CES 非対称性の立証事例。CX は σ_SU 追い風と R_net の関係、本業との共食いを負の R_net として検出できるかを試す事例。3 章合わせて、retrofit-verification.md で予告した「定性的後悔がスコア差として再現される」「軌跡型が実データで分離する」「線引きが当てはめで磨かれる」を、初めて固有 PJ で具体検証する。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 12 | TIEM 透明断熱エアロゲルと早すぎ起業の解剖 | 32 | heavy | TIEM, Y-001, Y-004, Y-005, 桑折 MTG 2026-06-24 出資金/シーズ転用/退路 |
| 13 | BWE 女性ヘルスケアと sigma_SU 過信の罠 | 28 | medium | BWE, Y-002, Y-003, 桑折 MTG 2026-06-24 CEO 中間管理職化/学生責任/取締役個人責任 |
| 14 | CX Carbon 系と R_net 負号 本業からの共食いをモデルが検出できるか | 30 | medium | CX, Y-005, 桑折 MTG 2026-06-24 論文-特許順序事故/COI |

**Prior lit engaged**: Cooper Stage-Gate, Nanda & Rhodes-Kropf financing risk と P x S 分離, 内閣府 SIP CE2023 TRL/BRL/GRL/SRL/HRL bundle 出典, Pisano Science Business バイオ創薬の鋸歯型生存, Gans & Stern Commercialization Environment と sigma_SU, Eisenmann/Ries premature scaling Y-004 の理論裏付け, Etzkowitz Triple Helix sigma_SU の制度的下地, Kahneman 後知恵バイアス blind retrofit 設計の根拠

**既存 bzm/ 内容再利用**: retrofit-verification.md の実例「早すぎた設立」節 l.179-191 が Ch 12 TIEM の骨格そのもの。透明断熱材の設立時 sigma_SU 高位 x R_internal ほぼゼロ、量産壁での y 出血、ゾンビ型軌跡の読み直しを章末の「いつなら良かったのか」反実仮想で締める構造を継承。冒頭ストーリー l.11-39 段ボール二箱 は Book III 全体の入口エピグラフに移送し Ch 12 では再掲しない。「数値化を急がない 検証の順序」表 l.81-87 は Ch 12 の blind 採点パートで参照、各 PJ 章で繰り返さない。「軌跡パターン四型」l.98-104 は Ch 12 ゾンビ型 / Ch 13 鋸歯型からゾンビ型への遷移 / Ch 14 即落寸前で軌道修正 の参照点として使う。score-and-bottleneck.md の積構造解釈と p-potential.md の P 三層 TAM/SAM/SOM は Ch 12, Ch 14 の P 採点節で短く参照。s-survival.md / strategic-slack.md は 3 章共通の軌跡再構成 lens として薄く敷く。

**新規執筆必要**: 3 PJ それぞれの blind retrofit 採点シート TRL/BRL/GRL/SRL/HRL x 設立時点/現時点/もし待っていたら の仮想時点 を当時資料の出典付きで新規作成。TIEM では量産内製の R_internal を従来 TRL 単線から「応用x組織 matrix の min」へ拡張する具体記法を本書で初めて式として書き下ろす。BWE では F_char vs F_cap の retrofit 採点ルーブリックを初出として提示し Y-002/Y-003 の一次資料 CTO 招聘メモ、CEO の月次タスク配分 を採点根拠に紐付ける。CX では R_net の本業共食い項を四半期 P&L の retrofit から符号付きで再構成する手続きを初出で提示し sigma_SU を mu_A/mu_I/mu_G に分解して読む数値例を提示。3 章共通で「設立時点 PRS スコア」「数年後 PRS スコア」「ERS 機関側同時刻スナップショット」の三点セットを表で出し 二層構造 PRS x ERS 乗法結合禁止 ERS は速度パラメータとして R/S 進行に効く を経験的に示す。各章末は retrofit-verification.md の章末の問いフォーマットを踏襲しつつ PJ 固有の問いに置き換える。

---

### Book III SU retrofit 2 — SX / CTB / YD (`book3_retrofit2`)

**Book**: BZM / **Pages total**: 114

**Purpose**: 本チャンクは Book III 実証編の第二束として、AMD 8 PJ のうち SX (半導体)、CTB (創薬)、YD (波力) の三案件を retrofit にかける。三案件は PRS の各因子が「主役」になる構図がそれぞれ異なる — SX は σ_SU 追い風と R_net の本業共食いの綱引き、CTB は鋸歯型軌跡と F-CES (経験順序) と長 R 時間軸、YD は P_UE 律速による NO_GO 判定 — を通じて、二層モデルの予測力と限界を素材ごとに検証する。前章束 (TIEM/BWE/CX) が「早すぎ起業」と「市場形成」と「炭素規制 σ」を扱ったのに対し、本束では「大企業並走時の R_net 計算」「σ 不在下の鋸歯生存」「UE による GO 棄却」という三つの異なる生存条件式の運用を、blind retrofit と事前予測の二本立てで突き合わせる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 15 | SX — 半導体プロジェクト: σ_SU 追い風下の R_net 共食い | 38 | medium | SX, Y-002 CTO非開示, 桑折 MTG 2026-06-24 (兼業COI/取締役個人責任), 東京科学大 (匿名機関) |
| 16 | CTB — 創薬プロジェクト: 鋸歯型軌跡と F-CES 経験順序 | 42 | heavy | CTB, Y-004 premature scaling, Y-001 シリーズA命名, 桑折 MTG 2026-06-24 (論文-特許順序事故), NIMS |
| 17 | YD — 波力プロジェクト: P_UE 律速と NO_GO 判定の意味 | 34 | medium | YD, Y-005 Cabot機会逃し (対照: σ高×P未検証で逃した案件との比較), 愛媛大, 桑折 MTG 2026-06-24 (退路/学生責任) |

**Prior lit engaged**: Cabral & Mata (firm size distribution), Steinmueller / Mowery (semiconductor industrial policy), Pisano (Science Business — biotech anomaly, 鋸歯型 grant-driven 生存の典拠), Stern & Gans (commercialization environment), 内閣府SIP CE2023 (TRL/BRL/GRL/SRL/HRL bundle), Bergek et al. (Technological Innovation Systems), Hekkert TIS functions, MacKay (Sustainable Energy without the hot air — UE 物理上限の方法論), Christensen (innovator's dilemma — R_net 本業共食いの理論基盤), Etzkowitz Triple Helix

**既存 bzm/ 内容再利用**: retrofit-verification.md は本チャンク全章の方法論的骨格として直接引用される。具体的には: (a) 冒頭ストーリーの「段ボール箱2つから軌跡再構成」のテンプレートを SX/CTB/YD 各章の hook 直後に踏襲し、当時資料のみによる blind retrofit を明示。(b) 軌跡4型 (健全/ゾンビ/即落/鋸歯) は Ch 15 で「健全型未満→ゾンビ型遷移」(SX)、Ch 16 で「鋸歯型の教科書的実例」(CTB)、Ch 17 で「即落型ではなく NO_GO による不参入」(YD) に振り分け。(c) 後知恵バイアス対策の blind retrofit 手続きと「採点1行ごとに当時資料を紐付ける」運用は三章共通の検証プロトコルとして冒頭に再掲。(d) R/y 線引きの議論 (特許登録は R、独占期間は y) は Ch 15 の「大手契約による独占権受渡しが R を減らすか y を減らすか」の節で再利用。(e) 章末の問い8項目テンプレを各章末にカスタマイズして配置。

**新規執筆必要**: 三章とも完全新規執筆が必要。Ch 15 (SX): R_net 計算の数式展開 — 親研究室の本業 PL と SU の予想 PL を並べた共食い行列、σ_SU が高い時ほど R_net 検算が省略されるバイアスの定式化、Y-002 (CTO 非開示) と兼業COI処理の retrofit。Ch 16 (CTB): F-CES の F_cap 経験順序を創薬の各 milestone (IND/Phase I/II/III/承認) に対応づける写像、鋸歯型軌跡の補充周期と R 前進階段の整合性検査、Y-004 (premature scaling) の retrofit を 調達リード未経験 CEO のシリーズB前倒しケースで具体化。Ch 17 (YD): UE 閉鎖条件の物理ベース計算 (kWh単価 = CAPEX/(発電量×稼働率) の天井)、P(t) = max U(t) が「将来のコスト学習曲線まで含めても閉じない」NO_GO 判定の境界条件、σ高×P低 の典型パターンとしての「政策誘導型誤起業」の警告類型化。三章とも対照群として「見送り案件」追跡データを 公開特許・登記情報から再構成する小節を新設。

---

### Book III SU retrofit 3 — JC (shallow tech) と CLG (`book_III_su_retrofit_3`)

**Book**: book_III / **Pages total**: 52

**Purpose**: Book III の SU retrofit シリーズの第三ブロックとして、ディープテックの対照群となる shallow tech 案件 (JC) と、もう一つの SU 案件 (CLG) を retrofit する。前ブロックの「研究室発・技術律速」型 (TIEM/CTB/YD) と対比させ、PRS の各要素がどう構造を変えるか — 特に R の TRL 律速が緩み、代わりに S (R_net と F) が支配的になる shallow tech モードを示す。これにより、モデルが「ディープテック専用」ではなく案件の生存構造に応じて読み替えられる二層フレームであることを実証し、Ch 25 の層間結合検証への橋渡しとする。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 18 | JC retrofit — shallow tech モードでは何が律速になるのか | 26 | medium | JC, Y-003 CEO中間管理職化, Y-004 premature scaling, 桑折MTG 2026-06-24 退路・PL責任論点 |
| 19 | CLG retrofit — σ_SU 追い風依存型の S 動学 | 26 | medium | CLG, Y-001 シリーズA命名 (追い風期の調達ラベル誤り), Y-005 Cabot機会逃し対比, 桑折MTG 2026-06-24 出資金・退路論点 |

**Prior lit engaged**: Cooper Stage-Gate (shallow tech 標準モデルとの比較), Steve Blank / Eric Ries Customer Development / Lean Startup (premature scaling 概念), Etzkowitz & Leydesdorff Triple Helix (σ_SU の起源), Pisano Science Business (深さの異なる事業化モード比較), 内閣府SIP CE2023 readiness bundle 仕様, Kahneman 後知恵バイアス (blind retrofit 手続きの根拠)

**既存 bzm/ 内容再利用**: retrofit-verification.md の段ボール二箱の冒頭ストーリー構造と blind retrofit 手続き (当時資料のみで採点)、ゾンビ型/健全型/即落型/鋸歯型の軌跡パターン分類、(x,y) 平面再構成手順、スコア再現+軌跡描画の二段構え方法論はそのまま Ch 18/19 の章型骨格として再利用する。retrofit-verification.md の『早すぎた設立』実例 (透明断熱材ケース) は TIEM 章 (Ch 12) で消費済みのため、Ch 18 では JC の『早すぎなかったが立ち上がらなかった』対照ケース、Ch 19 では CLG の『追い風で立ち上がったが自走できない』ケースに置き換える。retrofit-verification.md の章末問い 8 項目フォーマットを各章末で再利用。

**新規執筆必要**: JC の shallow tech 固有の軌跡パターン (x が早期に伸びる→平坦化→y 出血) の図、TRL≠律速時の R bundle min(TRL, BRL, GRL, SRL, HRL) の支配軸が BRL/SRL に移る計算例、F-CES の ρ=-2 で F_cap 不足が F_char (Grit) で部分補完される具体的な数値プロファイル。CLG については σ_SU の時系列変動 (μ_A, μ_I, μ_G の年次推移) を内閣府データ・産業政策アーカイブから再構成する仕様、追い風型プロファイルの典型形と生存条件式 B - R_net ≤ F の臨界点判定。両章とも『ディープテック専用モデルではない』ことを示すための同一フレーム適用の手順記述と、Ch 25 層間結合検証へつなぐ ERS (8軸加重和) からの寄与 (機関 retrofit との結合点) の予告 1 節を新規執筆。

---

### Book III 機関 retrofit 明示三機関 (NIMS / 工学院大学 / 愛媛大) (`book_III_institution_retrofit_explicit`)

**Book**: BZM / **Pages total**: 70

**Purpose**: Book III 後半の機関レイヤー retrofit。Ch 12-19 で個別案件 (PRS 乗法) を 8 PJ で検証した後、評価軸を機関 (ERS 加重和) に切り替え、最初の三機関を実名で精読する。NIMS は研究開発法人型の苗床として軸 2/6 強・軸 4/7 の制度設計が独立行政法人特有の論点になる事例。工学院大学は桑折先生 KUTE 2026-06-24 一次情報の本体で、軸 7 (兼業 COI 株式) と軸 8 (文化・実績) の運用が小規模私立大の解像度で読み取れる初の章。愛媛大は地方国立大の典型で、軸 1/3 にギャップ資金 (SCORE/A-STEP) を絡めた「外部連携で補う」典型動作の実証。三機関を通じて読者は、ERS 加重和の sum 表示が「総合得点」ではなく「凹み診断」であること、unknown と not_started の区別が運用上の核心であること、そして機関整備度は案件側 R/S の進行速度に causal に効くだけで PRS に乗じてはいけないという二層分離が、抽象議論ではなく実機関の固有名詞で固まる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 20 | NIMS — 研究開発法人型の苗床、軸4と軸7の独法特有制約 | 22 | light | NIMS, CX (carbon), SX (semiconductor) |
| 21 | 工学院大学 KUTE — 桑折先生一次情報で読む小規模私立大の苗床 | 26 | light | 工学院大学 (KUTE), 桑折先生 MTG 2026-06-24, Y-002 (CTO非開示), Y-003 (CEO中間管理職化), TIEM (透明断熱 |
| 22 | 愛媛大 — 地方国立大、外部連携で弱い軸を補う典型動作 | 22 | light | 愛媛大, YD (波力, UE律速 NO_GO), JC (shallow tech), Y-005 (Cabot機会逃し) |

**Prior lit engaged**: Etzkowitz & Leydesdorff Triple Helix (機関と地域 σ_SU の接点として), 内閣府 SIP CE2023 readiness bundle (TRL/BRL/GRL/SRL/HRL), AUTM Licensing Activity Survey (米大学型 TLO ベンチマーク), OECD Science, Technology and Innovation Outlook (institution readiness の国際比較枠組み), Lerner (2009) Boulevard of Broken Dreams (公的苗床政策批判), Bayh-Dole 体制 (知財帰属の比較対照), 産業競争力強化法 大学発ベンチャー認定・出資制度 (軸 7 の日本固有制度), JST SCORE / A-STEP プログラム (軸 6 ギャップ資金の外部代替), 経産省 産学官連携ガイドライン (軸 4 契約処理)

**既存 bzm/ 内容再利用**: nursery-ers.md は Book V (機関側設計) の主素材だが、本 chunk の Ch 20-22 でも導入用に大規模再利用する。具体的には: (a) 二人の研究者の冒頭シーン → Ch 21 工学院大学冒頭の桑折一次情報に置き換える形で短縮再利用、(b) 8軸の表と Lv rubric (軸 2/6/7) → Ch 20 NIMS で軸 2/6、Ch 21 工学院大学で軸 7 をそのまま引用、(c) 「単発の成功はあるが pipeline にならない機関」事例 → Ch 21 工学院大学節の文化・実績軸 (軸 8) の議論で実名化、(d) 「弱い軸を外部連携で補って動き出した機関」事例 → Ch 22 愛媛大の本体としてほぼそのまま実名 retrofit、(e) ERS の加重和数式と「数字を上げること自体は目的ではない」結論 → 三章共通の章末小節として圧縮再利用。Ch 11 (BVAR+jump+gate 推定) で導入する causal channel (機関 → 案件 R/S 速度) は、本 chunk では数式は引かず言葉で参照のみ。

**新規執筆必要**: 三章それぞれで新規に書き下ろす必要があるのは: (1) NIMS については研究開発法人型苗床の独法特有制約 (役員兼業の国家公務員型ルール、株式対価不可の歴史と緩和、独立行政法人通則法と産競法の交差点) と、CX/SX 案件で実観測した契約速度の数字。(2) 工学院大学については桑折先生 KUTE MTG 2026-06-24 の一次情報を、本人匿名希望の有無を確認した上で、固有名詞付きでどこまで書くかの編集判断を含めて書き起こす。とくに「出資金」「シーズ転用」「学生責任」「論文-特許順序事故」「取締役個人責任」の五点を軸 7/8 の rubric に対応付けて記述。(3) 愛媛大については地方国立大の実規程・SCORE/A-STEP 採択履歴・卒業生ネットワーク経由 EIR 代替の具体事例を、YD/JC retrofit と接続して書き下ろす。共通して必要なのは、各章末に「この機関の ERS レーダー (8軸) と、その凹みが Book IV (時系列現場接続) のどの局面で案件側に現れるかの forward-reference 表」一枚。Ch 25 (層間結合検証) への伏線として、機関 ERS と案件 R 進捗速度の相関を語るための観測ノートも各章に仕込む。

---

### Book III 機関 retrofit — 香川大 + 匿名3機関 (京大/山口大/東京科学大) (`book3_institutions_chunk2`)

**Book**: BZM / **Pages total**: 52

**Purpose**: Book III の機関レイヤーを閉じるブロック。Ch23 で明示機関(香川大)の retrofit を完結させ、Ch24 で匿名 3 機関(京大/山口大/東京科学大)を「タイプの違うパターン標本」として並置する。目的は ERS 8 軸加重和を実機関の不均一プロファイルに当てて、(i) 凹みの位置で打ち手が決まる、(ii) 弱軸は外部連携で補えるという加重和構造の主張を実証で支える、(iii) 単発成功を装置誤認するアンチパターンを示す、こと。Book IV (案件側時系列) に進む前に「機関は環境変数として案件 R/S を裏で押し上げる」という二層構造の causal arrow を retrofit 実例で確定させる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 23 | 香川大 — 地方中規模・外部連携で補う苗床 | 22 | medium | 香川大, JC (shallow tech), 桑折 MTG 2026-06-24, Y-005 Cabot機会逃し |
| 24 | 匿名 3 機関 — タイプの違う苗床プロファイル | 30 | light | 京大 (匿名), 山口大 (匿名), 東京科学大 (匿名), TIEM, BWE, Y-002 CTO非開示, Y-003 CEO中間管理職化 |
| 24.1 | 研究大学型 — 単発成功を装置と誤認した機関 | 10 | light | 京大 (匿名), TIEM, Y-005 Cabot機会逃し |
| 24.2 | 地方単科型 — unknown を not_started と誤読した機関 | 10 | none | 山口大 (匿名), BWE, 桑折 MTG 2026-06-24 |
| 24.3 | 統合大型 — 制度設計先行で他軸が空回りした機関 | 10 | medium | 東京科学大 (匿名), Y-002 CTO非開示, Y-003 CEO中間管理職化, 桑折 MTG 2026-06-24 (取締役個人責任) |

**Prior lit engaged**: Etzkowitz & Leydesdorff Triple Helix, 内閣府 SIP CE2023 readiness bundle, Mowery et al. (Bayh-Dole 後の TLO 効果), Siegel et al. (TLO productivity), Lerner (public venture capital と地域), Feldman & Kelley (university spin-off determinants), Clarysse et al. (incubator typology), 経産省・文科省 大学発ベンチャー実態調査, JST GAP ファンド評価報告

**既存 bzm/ 内容再利用**: bzm/nursery-ers.md がこのブロックの理論骨格の主供給源。8 軸の rubric (Lv1-5)、加重和を採る理由 (案件は乗法・機関は加重和の二段論法)、unknown vs not_started 区別、90 日 pilot charter、二つの匿名実例 (単発成功の機関 / 外部連携で補った機関) は Ch24.1 と Ch23 の素材としてそれぞれほぼ直接展開できる。Ch23 (香川大) は nursery-ers.md の実例 2 (地方小規模大学 + 外部連携) を匿名から実名 retrofit に変換。Ch24.1 (京大匿名) は実例 1 (単発成功の機関) をそのまま深掘り。Ch24.2 と Ch24.3 は nursery-ers.md の章末問い 4・5・7 と運用作法 (unknown 区別、根拠ノート、自己評価バイアス) を独立章に展開。score-and-bottleneck.md は ERS レーダー読みの作法供給源。

**新規執筆必要**: 香川大の具体的 retrofit (8 軸プロファイル、外部連携先の特定、桑折先生視点での出資金/退路/学生責任の論点をどう ERS 軸に対応づけるか) を実機関データから組み立てる節が新規。匿名 3 機関について、京大/山口大/東京科学大 の実態を匿名化合成する筆致で 3 つの定性プロファイル類型を確定させる必要がある。とくに東京科学大型 (制度設計先行) は nursery-ers.md に対応実例がないため新規執筆。8 PJ 経験 (TIEM/BWE/JC) と機関プロファイルの対応マトリクス、および Y-002/Y-003/Y-005 のやらかしが各機関タイプでどう増幅されるかの分析も新規。Ch24 全体で「ERS プロファイル形状 → 処方箋」の対応表 (4-6 類型) を新作し、Book V (Ch32 ERS 8 軸別処方) への橋渡しを担保する。

---

### Book III 結合検証 + 予測反証 (`book_iii_coupling_falsification`)

**Book**: bzm / **Pages total**: 55

**Purpose**: Book III 第12-24章で個別 retrofit (8 SU + 7 機関) を済ませた読者に対し、本チャンクは二層構造そのものの実証的妥当性を二段で問う。Ch 25 は「ERS は案件側 R/S の進行速度を裏で押し上げる」という因果仮説を、機関-案件パネルデータと自然実験(GAPファンド採択前後、URA配置前後、COI制度改正前後)で識別する。Ch 26 は「では、このモデルは反証可能か」を正面から扱い、retrofit の後知恵バイアスを構造的に排除する「事前予測→答え合わせ→外れ案件の解剖」プロトコルを設計し、AMD自身の予測ログを開示する。Book III の知的誠実性の天井をここで確定させる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 25 | 層間結合の検証 — ERS が案件進行を本当に押し上げるか | 28 | heavy | 桑折 MTG 2026-06-24, 工学院大学 (KUTE), NIMS, 愛媛大, 香川大, 京大(匿名), 山口大(匿名), 東京科学大(匿名), TIE |
| 26 | 予測パフォーマンスと反証 — このモデルは何によって死ぬか | 27 | medium | AMD 8 PJ 予測登録ログ (TIEM/BWE/CX/SX/CTB/YD/JC/CLG), YD (波力, UE律速 NO_GO 判定の事前公開と検証),  |

**Prior lit engaged**: Goodhart (1975) on measurement-becomes-target, Manzi (2012) Uncontrolled — field experimentation in policy, Tetlock & Gardner (2015) Superforecasting — calibration scoring, Brier, Angrist & Pischke (2009) Mostly Harmless Econometrics — DiD/IV identification, Imbens & Rubin (2015) Causal Inference for Statistics, Henderson & Cockburn (1996) Scale, scope, and spillovers — institutional capability and pharma productivity, Mowery et al. (2004) Ivory Tower and Industrial Innovation — Bayh-Dole 後の TTO 効果, Lerner (2009) Boulevard of Broken Dreams — 公的VCの効果検証, Kahneman (2011) Thinking, Fast and Slow — hindsight bias, Popper (1959) Logic of Scientific Discovery — 反証可能性, Sarasvathy (2008) Effectuation — 機会創造観に対する予測の難しさ

**既存 bzm/ 内容再利用**: retrofit-verification.md の「軌跡の四型」「blind retrofit」「事前予測へ主役を移す」「見送り案件の事後追跡=対照群」「R/y 線引き検証」の節は、Ch 25 の「機関→案件速度」検証設計(自己選択対策, 対照群構築)と Ch 26 の予測プロトコル設計に直接接続できる。model-critiques.md の経済学者批判1-3(識別不能/後知恵/自己選択), 批判4(順序尺度), 経営学者批判4(グッドハート), 批判6(べき乗則と外れ値弾き) は Ch 26 の「反証可能性の運用設計」と「予測の評価指標選択」の議論骨格にそのまま流用できる。冒頭の「研究会で三人の批判者に正面から応えた発表者」のシーンは Ch 26 の開幕ストーリーに最適。8 PJ retrofit 章 (Ch 12-19) で確立した結末データと、機関章 (Ch 20-24) の ERS スコアを突き合わせる素材は Ch 25 のパネル構築に直結。

**新規執筆必要**: 機関-案件パネルデータの仕様 (機関 × 年 × 案件レベル, 観測変数: ERS各軸スコア, 案件側 ΔR/Δt, σ_SU 控除後の純機関効果), 識別戦略 (DiD with staggered adoption: GAPファンド採択/URA配置/COI制度改正をイベントとして用い, ERS軸別の効果を分解), 自己選択への対処 (見送り案件の公開情報追跡を対照群化, 機関選択の傾向スコアマッチング), 8軸 × 案件速度の異質性検証 (どの軸が R を押すか / どの軸が S を押すか / どの軸が両方か), 予測登録プロトコル (現在進行中案件 N=? について案件ID・予測スコア・予測軌跡型・予測月数を日付印で凍結→6/12/24ヶ月窓で答え合わせ), 外れ案件解剖手続 (予測外れを「P誤読/R誤読/S誤読/二層誤適用」のどれに帰属するか, 帰属を次世代モデルへの入力に変換), Brier スコアと calibration plot を本書評価指標として宣言, グッドハート対策の運用ログ仕様 (採点監査ログ, 採点者-受益者分離), べき乗則の外れ値を弾かない例外条項の制度化, AMD 8 PJ 中既に予測登録済みのもの (例: CTB の S 予測, CX の R 予測) の進捗開示。

---

### Book IV 時系列現場接続スパイン 前半 — 掘り起こしと先生の第一歩 (`book_IV_front`)

**Book**: BZM / **Pages total**: 48

**Purpose**: Book IV は Book II の数学装置と Book III の実証を、URA・GAP担当・産学連携が実際に立つ時間軸の上に降ろす実践スパインである。前半 2 章 (Ch 27, Ch 28) は、シーズが「研究成果」から「事業候補」として認識される最初期 — つまり Before Zero の起点 — を扱う。Ch 27 は機関側がシーズを探し当てる前段 (P と ERS シーズ発掘軸の接続)、Ch 28 は研究者本人が「会社化を検討する」へ最初の一歩を踏み出す瞬間 (F と研究者リスクの全量) を、桑折先生 KUTE MTG 一次情報と Y-001/Y-002 やらかしで地に着ける。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 27 | 技術シーズの掘り起こし — P(t) を待たずに $U(t)$ を広げる | 22 | light | JC, CX, TIEM, 工学院大学, 愛媛大, ERS第1軸 |
| 28 | 先生が第一歩を踏み出すとき — 賭け金の全量と F の起点 | 26 | medium | 桑折先生 KUTE MTG 2026-06-24, Y-001 シリーズA命名, Y-002 CTO非開示, TIEM, BWE, 工学院大学, Y-007 ( |

**Prior lit engaged**: Sarasvathy (Effectuation: 機会創造観の根拠), Shane (Academic Entrepreneurship), Etzkowitz (Triple Helix), Murray & Stern (科学者の二重身分), Ries (Lean Startup — Before Zero への適用限界として), Pisano (Science Business — 製薬の事業化時計), 内閣府SIP CE2023 (TRL×BRL×GRL×SRL×HRL bundle), Cooper (Stage-Gate — GO 判定形式の参照), Branscomb & Auerswald (Valley of Death 産学接続), Siegel et al. (TLO 効率性研究)

**既存 bzm/ 内容再利用**: field-before-zero.md の七つの不確実性 (再現性・用途・顧客・知財/公開順序・担い手・資金・制度) と「早すぎ/遅すぎ」窓は Ch 27 冒頭で「掘り起こし時点で何が未確定か」のチェックリストに転用する。field-who-carries.md の「最後は誰が背負うんですか」場面と五機能分解 (意思決定/対外/資金/組織/研究) は Ch 28 のストーリー冒頭にそのまま置き、Book IV では「第一歩の時点で既にこの分解の必要性が発生している」という時系列接続として再フレーム。p-potential.md の不整地ロボット事例 ($U(t)$ 拡張) と「P は戦略の関数」議論は Ch 27 中盤の「掘り起こしは $U(t)$ への書き込み行為である」節で短縮再利用。p-potential.md の「P で落とすべき案件」議論は Ch 27 末で「掘り起こしは選別ではない/選別は GAP 期以降」として明示分離。

**新規執筆必要**: Ch 27 では (a) ERS シーズ発掘軸の Lv1-5 rubric (学内棚卸し頻度・異分野横断 MTG 設置・産業文脈読み替えワークショップ・学外シーズ受け皿) を新規執筆、(b) 掘り起こし行為を「$U(t)$ に応用候補を書き込む生産行為」として定式化し、機関→案件速度の causal channel を二層構造の具体例として示す節、(c) JC/CX の retrofit 数字 (掘り起こし時の登録用途数と最終的に商談に乗った用途数の対比) を新規。Ch 28 では (a) 桑折先生 MTG 7 論点を F_char/F_cap/R_net/制度 (ERS 制度設計軸) の四象限へ写像する図、(b) 「研究者の起業意思は前提でない」AMD 立場と Shane 系既存文献 (研究者起業を前提に書かれた支援論) との明示的距離取り、(c) Y-001/Y-002 の起点 forensics (どの情報設計ミスがいつ仕込まれたか) を時系列で再構成、(d) 生存条件式 B - R_net ≤ F の「第一歩時点」形 — まだ B も R_net も 0 だが F_char の在庫だけが計測可能、という起点境界条件の議論。

---

### Book IV 時系列スパイン 中盤 — GAP獲得期と設立タイミング判定 (`book_IV_mid`)

**Book**: BZM / **Pages total**: 52

**Purpose**: 本チャンクは Book IV 時系列スパイン(掘り起こし→第一歩→GAP→設立→資金調達)の中央二章を担う。Ch 29 は GAP ファンド獲得期を、Ch 30 は会社設立の登記タイミング判定を、いずれも本書の固定モデル(PRS 乗法、ERS 加重和、二層構造、生存条件式 B-R_net≤F、F の CES 内部構造、戦略余力動学、GO 判定式)に逐一接続して読み直す。GAP 期は「機関側 ERS が案件側 R/S の進行速度を裏で押し上げる」二層結合のもっとも観測しやすい時間窓であり、設立期は B が左辺だけ先に走り出す不可逆 GO の代表点である。Y-001 シリーズA命名・Y-004 premature scaling、Tier 1 のやらかしを正面から扱い、桑折 KUTE MTG 一次情報(出資金/退路/取締役個人責任)を Ch 30 の柱に据える。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 29 | GAP ファンド獲得期 — 機関 ERS が案件の y を非希薄化的に厚くする時間窓 | 26 | medium | TIEM, YD, BWE, CTB, Y-005 Cabot 機会逃し (GAP 期に類似機会判定をどう仕組むか), NIMS GAP 運用, 工学院大学 K |
| 30 | 会社設立期 — B の起動と F の充足を一致させる不可逆 GO の判定 | 26 | heavy | Y-001 シリーズA命名, Y-002 CTO 非開示 (設立時の役員構成事故), Y-004 premature scaling, TIEM (早すぎ起業代 |

**Prior lit engaged**: Kerr-Nanda-Rhodes-Kropf (2014) entrepreneurial finance experimentation, Gompers-Lerner VC cycle, Bergemann-Hege (1998/2005) venture capital learning, Manso (2011) motivating innovation / tolerance for failure, Hellmann-Puri (2002) venture capital and professionalization (CEO succession), Wasserman (2012) Founder's Dilemmas (founder-CEO replacement), Cumming-Johan GAP/translational funding empirics, Lerner Boulevard of Broken Dreams (政府系シード批判), Murray-Lott (1995) public technology fund evaluation, Åstebro-Bernhardt (2003) start-up financing source × survival, Branscomb-Auerswald (2002) Darwinian Sea / Valley of Death, Auerswald-Branscomb (2003) early-stage technology funding gap, Eisenmann-Ries lean startup pivot taxonomy (premature scaling 文脈), Blank Four Steps to the Epiphany (customer development), 桑折 KUTE MTG 2026-06-24 一次情報 (出資金・シーズ転用・退路・取締役個人責任), 内閣府 SIP CE2023 5RL ガイドライン, Cabot Microelectronics CMP slurry 事業史 (Y-005 機会逃し参照点)

**既存 bzm/ 内容再利用**: field-gates.md の「鬼門その二: 会社化のタイミング」全節 (バーン開始・期待固定・退路喪失の三連鎖、登記で問いが硬くなる対応表、三択 いま/あとで/しない、WAIT の三部品、g09_registration_branch.svg) を Ch 30 の解説骨格にそのまま流用。同章の「鬼門その三: CEO 機能の分解表」と冒頭の送信予約ストーリーは Ch 30 後半 (Y-001/Y-002 連動部) で再用。s-survival.md の生存条件式 B-R_net≤F、CES (a=0.6, ρ=-2) 数表 (8/8→8.00, 8/1→2.05, 0/9→0.29, 9/0→0.57)、「早すぎる起業への警鐘」節、Jカーブ批判、二つの相談実例 (補完で F が立ち上がった案件、追い風×実行力で生き残った案件 vs 三要素全弱で静かに死んだ案件) を Ch 30 の判定材料として再構成。strategic-slack 章の (x,y) 軌跡と Pr(τ_x<τ_y) は Ch 29 で GAP 期の y 補充ダイナミクスとして前方接続のかわりに参照。

**新規執筆必要**: Ch 29 は GAP ファンドそのものを新規執筆 (既存 bzm/ にほぼ素材なし): GAP の制度的位置 (大学・JST・地域 GAP)、ERS 8 軸のうち「シーズ発掘/起業支援制度/資金接続」がどう R_net 立ち上がり前の y を非希薄化的に厚くするか、GAP 採択が σ_SU と独立に R/S の進行速度を上げる二層結合の数値例、GAP 期に組むべき開示レベル運用 (出願→GAP 申請書記述の順序)、GAP マイルストーンが TRL/BRL の Yes/No チェックを前倒しで詰めさせる効果、GAP 終了時の三分岐 (GO 設立 / WAIT 延長 / NO_GO ライセンス転換)、YD (波力) の UE 律速で GAP 段階に NO_GO を出せなかった事故、TIEM の GAP 期に F_cap が空席だった構造、明示機関 (NIMS/工学院/愛媛/香川) の GAP 運用差を 8 軸スコアで対比。Ch 30 は既存 field-gates.md/s-survival.md を再編しつつ、桑折 KUTE 一次情報 (出資金の出所と退路、取締役個人責任、論文-特許順序事故が設立判断に与える制約) を専用節として新規追加、Y-001 シリーズA命名と Y-004 premature scaling を生存条件式と CES 表で定量的に解剖する新規節、設立判定チェックリスト (B 推計・R_net 入口・F_cap 充足・σ_SU 持続性・GAP 完了状態の 5 ゲート) を新規作成、CTB/BWE/SX の設立タイミング比較表を新設。

---

### Book IV 終盤 — 資金調達期 (F の運用) (`book-iv-late`)

**Book**: BZM / **Pages total**: 68

**Purpose**: 時系列スパインの終端として、設立後の最重要局面である資金調達期を、F (CES 合成) の現場運用論として描く。Jカーブ前提への正面からの批判、調達不能時の合法的・建設的選択肢 (規模縮小・ライセンス転換・休眠・閉鎖) を、生存条件式 B − R_net ≤ F と戦略余力動学 S = Pr(τ_x < τ_y) で構造化する。Book V の機関側設計 (GAP/EIR 接続) への橋渡しを兼ねる。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 31.1 | 資金調達期の構造 — Fの現場運用と希薄化の動学 | 22 | medium | TIEM, Y-001 シリーズA命名, Y-002 CTO非開示, 桑折 MTG 2026-06-24 出資金/退路 |
| 31.2 | Jカーブ批判 — すべてのシーズが谷を掘れるわけではない | 26 | heavy | YD 波力 NO_GO, CX carbon 追い風型, BWE 女性ヘルスケア (中規模Pの自走型), Y-004 premature scaling |
| 31.3 | 調達不能のとき — 縮退・転換・休眠・閉鎖の四経路 | 20 | light | JC shallow tech 縮退, CLG 閉鎖判断遅延, Y-005 Cabot機会逃し, 桑折 MTG 退路/取締役個人責任, TIEM 早すぎ起業の調 |

**Prior lit engaged**: Gompers & Lerner『The Venture Capital Cycle』(Jカーブ前提), Kaplan & Strömberg (2003) VC契約と希薄化, Bernstein, Korteweg & Laws (2017) 創業チームの質と初期投資判断 (無作為化フィールド実験), Unger et al. (2011) 人的資本と起業成果メタ分析, Hellmann & Puri (2002) VC支援とプロフェッショナル化, 内閣府SIP CE2023 (BRL/GRL/SRL/HRL bundle), Pisano (2010) Science-Based Business の長期赤字構造, Gans, Hsu & Stern (2002) Cooperate or Compete: ライセンス vs 自社事業化, Razgaitis (2003) ロイヤリティ料率実務, Branscomb & Auerswald (2002) 'Valley of Death', Owen-Smith & Powell Triple Helix 文献群

**既存 bzm/ 内容再利用**: bzm/s-survival.md の「早すぎる起業への警鐘」「Jカーブ批判」節は Ch 31.2 の骨格として直接転用可能 (深掘り・拡張のみ要)。同章の F-CES 数値表 (8×8=8.00, 8×1=2.05 等) は Ch 31.1 の F 運用論で再掲し、調達期の実測キャリブレーションに展開する。bzm/strategic-slack.md の「ロイヤリティはどう決めるか」(イニシャル+ランニング+ミニマム保証, 25%ルール) と「『ライセンスだと買い叩かれる』は本当か」節は Ch 31.3 のライセンス転換経路に転用。鋸歯のグラフ (f7_slack_sawtooth.png) と軌跡パターン (f8_slack_trajectories.png) は Ch 31.2 の Jカーブ批判の視覚的対抗物として再利用する。

**新規執筆必要**: 三点の新規執筆が必要。(1) 希薄化動学の数式化 — F が低いまま調達するときの主導権喪失レート (持分×発言権の同時減耗) を、戦略余力 y の選択肢成分の関数として導出する節 (Ch 31.1)。既存 bzm にはフロー診断はあるが、ラウンド間の動学はない。(2) Jカーブ成立条件の閾値分析 — どの (P, σ_SU, F_cap) 領域で Jカーブが PRS 最大化解になるかを GO 判定 𝟙[σ_SU≥θ_σ] と組み合わせて領域図示する (Ch 31.2)。YD/CX/BWE/JC を平面上にプロットして retrofit する。(3) 計画的閉鎖の手順論 — 桑折 MTG 2026-06-24 の一次情報 (取締役個人責任、学生責任、出資金の取り扱い、シーズ転用) を、撤退の合法的・倫理的手順として構造化する節 (Ch 31.3)。これは BZM 全編で唯一「閉じ方」を扱う場所であり、機関側 ERS の文化・実績軸 (Book V Ch 32) への因果接続を担う。

---

### Book V — Institution-side Design (`book-v-institution-design`)

**Book**: V / **Pages total**: 82

**Purpose**: Book Vは、Book I-IIIで確立した ERS 8軸加重和モデルと二層構造方法論を、機関側の設計実務に翻訳する処方箋層である。Book IIIの機関 retrofit (NIMS/工学院大/愛媛大/香川大、匿名3機関) で観測された軸別欠損パターンを材料に、(i) 8軸ごとの具体的処方 (Ch 32)、(ii) GAPファンド・URA・EIR という3制度の接続設計 (Ch 33)、(iii) Triple Helix σ_SU の地域動態としての産学官運用 (Ch 34) を順に扱う。読者は機関執行部・URA・産学連携責任者・JST/AMED 等の支援機関担当者を想定する。乗法的 PRS は触れず、加重和 ERS と σ_SU マクロ追い風の運用設計だけに集中する——これが Book V を Book IV (案件側 practice spine) と分ける軸である。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 32 | ERS 8軸別処方 — どの凹みに、どの手を打つか | 32 | light | TIEM (透明断熱エアロゲル) 機関側コンテキスト, 匿名機関 (旧国立大、Book III Ch 24), NIMS (Book III Ch 20), 愛 |
| 33 | GAP+URA+EIR — 三制度を一つの導線につなぐ | 26 | none | 桑折先生 KUTE MTG 2026-06-24 (論文-特許順序事故、取締役個人責任、出資金、シーズ転用、退路、学生責任), BWE (女性ヘルスケア) GA |
| 34 | 地域 産学官 双対動態 — σ_SU を県境で読む | 24 | medium | 愛媛大学 + 地場素材産業 + 伊予銀(地銀), 香川大学 + 高松産業構造 + 百十四銀行, 工学院大学 + 新宿/東京西部産業集積, 匿名機関 京大 + 関 |

**Prior lit engaged**: 内閣府SIP CE2023 TRL/BRL/GRL/SRL/HRL bundle (機関整備への射影), Etzkowitz & Leydesdorff Triple Helix model (Ch 34 地域動態の基盤), Leydesdorff Triple Helix mutual information / synergy (σ_SU 観測), Bayh-Dole Act と日本版 (TLO 法、産業活力再生特別措置法、産業競争力強化法 SU出資条項) 制度史, Etzkowitz Entrepreneurial University thesis, Mowery et al. Ivory Tower and Industrial Innovation (TLO 効果の実証), Lerner public venture capital programs 評価文献, Feldman & Desrochers MIT/Johns Hopkins 地域インパクト研究, Saxenian Regional Advantage (シリコンバレー vs ルート128), OECD Innovation Policy Reviews 日本版 (URA・GAP fund 制度評価), AUTM Licensing Activity Survey (TLO ベンチマーク), JST GAP Fund / 大学発新産業創出プログラム (START) 制度設計文献, 文科省 URA 制度設計報告書 / RA協議会蓄積, 本書 Book I-III (二層構造・ERS 8軸定義・retrofit 観測)

**既存 bzm/ 内容再利用**: nursery-ers.md がこの Book V のほぼ全体の素材源である。8軸定義・Lv1-5 rubric・加重和の根拠・unknown vs not_started 区別・90日 pilot charter・「単発成功 vs pipeline」事例・外部連携代替論——これらは既に書かれている。Book V ではこれを (a) Ch 32 で 8軸×処方マトリクスへ展開、(b) Ch 33 で GAP/URA/EIR の3制度に絞った接続設計へ深掘り、(c) Ch 34 で σ_SU 地域動態へ拡張する。nursery-ers.md は Book III Ch 20-24 (機関 retrofit 章群) で観測データとして消費されており、Book V では再利用ではなく「観測→処方」の翻訳として位置づけ直す。90日 pilot は Ch 32 末で運用器として再登場、unknown/not_started 区別は Ch 32 各軸処方の前提として再掲。

**新規執筆必要**: 3つの新規執筆が必要。(1) 8軸×処方マトリクス: 各軸について「Lv1→Lv3 / Lv3→Lv5 の典型ジャンプ手順」と「外部連携で代替する場合の最小機能定義」を retrofit 機関の実例に紐づけて書く。(2) GAP/URA/EIR の三位一体接続設計: 日本では GAP fund (JST START・大学独自)、URA (文科省 URA 制度)、EIR (まだ未成熟) が制度的に別系統で導入され、現場で連動しない事故が多い——この3者の接続プロトコル (誰が最初の窓口になり、誰が出願タイミングを設計し、誰が経営人材を引き合わせるか) を、桑折先生 KUTE MTG (2026-06-24) の出資金/シーズ転用/COI/退路の論点と接続して書く。(3) Triple Helix CD の地域版: σ_SU(μ_A, μ_I, μ_G) を全国マクロから地域 (都道府県/政令市) へ降ろした双対動態——大学側の整備度 (ERS) と地域側の産業構造・自治体施策の相互作用——を、明示機関 (愛媛大・香川大の地域文脈、工学院大の東京圏文脈) と匿名機関 (山口大・京大) の対比で記述。Saxenian の地域比較を参照しつつ日本固有の県境/政令市/地銀構造を組み込む。

---

### Book VI 政策と次の研究 (`book_vi`)

**Book**: BZM / **Pages total**: 84

**Purpose**: Book VI は、PRS×ERS 二層モデルの政策的・制度的・知的含意を確定させ、Before Zero を独立した学術領域として宣言するクロージング・ブックである。Ch 35 は σ_SU(Triple Helix CD) と ERS 8 軸加重和を政策レバーに翻訳し、SBIR/GAP/特定研究成果活用支援事業/COI 株式保有ガイドライン/兼業規程の現行設計に対する具体的処方を提示する。Ch 36 は、機関の自己評価および外部評価のために ERS を運用可能な KPI 体系へ変換し、unknown vs not_started の運用、加重和の透明性、グッドハート対策、誰が誰を採点するかの統治を扱う。Ch 37 は新領域宣言として、Before Zero が valuation 学・アントレ研究・科学技術政策研究のいずれの拡張でもない独立領域であること、二層分離が方法論的主張そのものであること、未解決問題と次の 10 年の研究アジェンダを定式化する。Book VI は本書の知的負債を確定させ、批判可能な形で次の研究者群に手渡す章である。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 35 | 政策含意 — σ_SU と ERS を政策レバーに翻訳する | 28 | light | TIEM, YD, Y-001 シリーズA命名, Y-003 CEO中間管理職化, 桑折 KUTE MTG 2026-06-24, NIMS, 工学院大学, 愛 |
| 36 | 研究機関 KPI と ERS の評価指標化 | 32 | medium | 匿名 京大, 匿名 山口大, 匿名 東京科学大, NIMS, 工学院大学, 愛媛大, 香川大, Y-002 CTO非開示 |
| 37 | 新領域宣言 — Before Zero と次の 10 年の研究アジェンダ | 24 | light | TIEM, BWE, CX, SX, CTB, YD, JC, CLG, Y-001, Y-002, Y-003, Y-004, Y-005, 桑折 KUTE  |

**Prior lit engaged**: Etzkowitz & Leydesdorff Triple Helix, 内閣府SIP CE2023 TRL/BRL/GRL/SRL/HRL, Sarasvathy Effectuation, Teece Dynamic Capabilities, Goodhart's Law / Strathern, Bayh-Dole Act と日本版TLO制度, Lerner The Boulevard of Broken Dreams (SBIR/政策実証), Mazzucato The Entrepreneurial State, Gulati & Higgins / Hsu — VC signaling and IPO outcomes, Kerr/Nanda/Rhodes-Kropf VC and innovation, Murray MIT Engine / Tough Tech 政策モデル, Branscomb & Auerswald Valley of Death 研究, Geuna & Muscio TTO 経済学, Audretsch & Belitski Entrepreneurial Ecosystems, Cabot Industries 事例 (Y-005 関連)

**既存 bzm/ 内容再利用**: ethics-and-authorship.md は丸ごと Appendix C 直前の Book VI 結尾資料として吸収するのではなく、Ch 37『新領域宣言』の倫理セクションへ圧縮統合し、批判 (1)-(8) の枠組みを『新領域が抱える構造的倫理負債』として再フレームする。model-critiques.md の『割引率の三つの仕事』『パラメータ未識別』『後知恵バイアス』『自己選択』『順序尺度』『最適制御』『機会創造観』『逆U字スラック』『資質の構成概念妥当性』『グッドハート』『動的能力』『べき乗則均質化』の各論点は、Ch 37 の『次の 10 年の研究アジェンダ』の正式項目として番号付きで登録する。nursery-ers.md (既存) は Ch 35/36 の機関側処方の素材として全面再利用 — 特に 8 軸別の政策レバー対応表と機関 KPI 化の運用論を Ch 36 の中核に据える。score-and-bottleneck.md の『律速診断』議論は Ch 36 の KPI 設計部で『単一スコアの順位用途への限定』として再登場する。

**新規執筆必要**: 新規執筆の中核は三点。第一に、σ_SU と ERS を政策レバーに対応付ける『政策×軸 マトリクス』の構築 — SBIR / GAP / 特定研究成果活用支援事業 / COI ガイドライン / 兼業規程 / 株式保有ルール / 出資型補助金 / 大学発VC制度 の各政策と、ERS 8 軸 × σ_SU の各成分の causal 対応を表で確定する(Ch 35)。第二に、桑折先生 KUTE MTG 2026-06-24 で確認された七論点(出資金/シーズ転用/COI/退路/学生責任/論文-特許順序事故/取締役個人責任)を、機関 KPI の Lv1-5 ルーブリックに正式に組み込む新規ルーブリック節 — 特に『論文-特許順序事故の防止率』『取締役個人責任の事前説明実施率』は ERS 軸『制度設計(兼業COI株式)』の sub-axis として新規定義する(Ch 36)。第三に、Before Zero を独立学術領域として宣言する『領域定義書』 — 対象(法人成立前研究プロジェクト)・観測量(P, R, S, σ_SU, F, ERS)・時間スケール(月/年の二層)・方法論的主張(二層分離・乗法結合禁止・数式形の対象依存性)・既存領域との境界(valuation 学/アントレ研究/科技政策研究/イノベーション経済学との差異)を、批判可能な命題群として明示する(Ch 37)。Ch 37 末尾には『次の 10 年に解かれるべき 12 の問題』を番号付きで列挙し、本書を知的負債の宣言文として閉じる。

---

### 付録 — 数学補遺・データ仕様・やらかし図鑑全文 (`App-A-B-C`)

**Book**: App / **Pages total**: 270

**Purpose**: 本書の本文が選択した数学的形式・観測スキーム・経験的事例の三層を、参照可能な独立アーカイブとして固定する。本文は読み物として流れることを優先し、CES の代替弾力性 ρ=-2 の選択根拠、CD 偏微分から律速診断式 α_i/(X_i+1) を導く一行、戦略余力 S=Pr(τ_x<τ_y) の BSDE 表現、Triple Helix CD(μ_A, μ_I, μ_G) の Kalman フィルタによる潜在状態抽出、Atlas データソース台帳、retrofit ヒアリングプロトコル、ALQ16+Grit+Resilience 計測手順、Y-001 から Y-005 (および追補) のやらかし図鑑全文 — これらは本文中で必要な精度で参照されるが派生は出さない。付録 A/B/C はそれらの「裏帳簿」であり、reproducibility・再批判可能性・後継研究者の参照点を担う。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| A.1 | CES 関数の性質と F 内部合成の校正 | 22 | derivation | Y-002 CTO非開示, BWE, CTB |
| A.2 | Cobb-Douglas 偏微分と律速診断式の導出 | 18 | derivation | score-and-bottleneck 例題, 機能性材料 F-律速事例 |
| A.3 | 戦略余力動学 — S = Pr(τ_x<τ_y) の停止時刻定式化と BSDE 表現 | 26 | derivation | Y-004, YD 波力, TIEM |
| A.4 | Triple Helix CD(μ_A, μ_I, μ_G) の状態空間モデルと Kalman フィルタ | 24 | heavy | CX, SX, CTB |
| A.5 | BVAR + jump + gate 推定 — 事前分布・MCMC・GO 判定の閾値校正 | 28 | heavy | TIEM, BWE, JC, CLG |
| A.6 | 二層構造の数学的非可換性 — PRS 乗法と ERS 加重和を掛け合わせてはならない | 14 | medium | 桑折 KUTE MTG 2026-06-24, NIMS, 工学院大学 |
| B.1 | Atlas データ仕様 — 8 PJ retrofit 観測台帳 | 30 | none | TIEM, BWE, CX, SX, CTB, YD, JC, CLG |
| B.2 | Retrofit ヒアリングプロトコル — 半構造化インタビューと評定者間信頼性 | 18 | light | BWE, JC, CTB |
| B.3 | ALQ16 + Grit + Resilience 計測 — F_char 委譲不可性の操作化 | 20 | light | Y-003, BWE, SX |
| B.4 | ERS 8 軸 rubric — Lv1-5 アンカーと評定者ガイドライン | 26 | light | NIMS, 愛媛大, 工学院大学, 香川大 |
| C | やらかし図鑑 全文 — Y-001 から Y-008 | 44 | none | Y-001, Y-002, Y-003, Y-004, Y-005, TIEM, BWE, CTB, 桑折 KUTE MTG 2026-06-24 |

**Prior lit engaged**: Cobb & Douglas (1928) A Theory of Production, Arrow, Chenery, Minhas & Solow (1961) Capital-Labor Substitution and Economic Efficiency (CES), Etzkowitz & Leydesdorff (2000) The dynamics of innovation: from National Systems and Mode 2 to a Triple Helix, Mankins (1995) Technology Readiness Levels (NASA), 内閣府 SIP CE2023 readiness 体系 (TRL/BRL/GRL/SRL/HRL), Bernstein, Korteweg & Laws (2017) Attracting Early-Stage Investors, Journal of Finance, Duckworth et al. (2007) Grit: Perseverance and Passion for Long-Term Goals, Connor & Davidson (2003) CD-RISC, Avolio et al. (2007) Authentic Leadership Questionnaire (ALQ), Pardo & Pironneau (1999) BSDE と最適停止, Durbin & Koopman (2012) Time Series Analysis by State Space Methods, Koop & Korobilis (2010) Bayesian VAR, Eisenhardt & Graebner (2007) Theory Building from Cases, Blank & Dorf (2012) The Startup Owner's Manual (premature scaling 議論)

**既存 bzm/ 内容再利用**: 既存 bzm/ の素材は付録の各章に分配可能。score-and-bottleneck.md の §「なぜ掛け算か」「+1 シフトの2つの役割」「重み α」「K の校正」「律速診断」「軸どうしは独立ではない」のうち、本文 (Ch 6 PRS 導出) で要約され流される派生計算と例題の手取り足取り部分を A.2 に退避させる。s-survival および strategic-slack の停止時刻直感は A.3 BSDE 章の導入として再利用。model-overview の F-CES 図解は A.1 の極限解析の導入図として転用。retrofit-verification.md の 8 PJ 評価表ドラフトは B.1 Atlas 台帳の骨格に直接移植。nursery-ers.md の rubric 案は B.4 のアンカー記述子に展開。model-critiques.md の共線性反論への応答は A.2 末尾の補論として収録。やらかし図鑑系の散在記述 (Y-001〜Y-005) は C 章に集約・正規化。

**新規執筆必要**: 新規執筆が必要な核心ブロックは四つ。(1) A.3 の BSDE 表現 — bzm/ 内では戦略余力は直感的説明にとどまり、停止時刻のレース確率としての formal 定式化と生成子レベルの生存条件式導出は未着手。(2) A.4 の Triple Helix SSM の Kalman 実装 — σ_SU の概念図は model-overview にあるが、観測方程式・identifiability 議論・lag 推定の実装は新規。(3) A.5 の BVAR+jump+gate の事前分布と MCMC 仕様 — Ch 11 本文と整合する完全な technical appendix は未執筆で、posterior predictive check の reproducibility に必須。(4) B.3 の ALQ16+Grit+CD-RISC 日本語版適用と F_char/F_cap 弁別妥当性検証 — F-CES の経験的根拠の核で、創業者サンプル (n≈40 想定) のデータ取得設計と心理測定報告を新規に書く。加えて C やらかし図鑑は Y-006/007/008 (未命名の追補3件: 取締役個人責任事故・論文先行で特許権利化失敗・大学発出資金トラップ) を桑折 KUTE MTG 2026-06-24 の一次情報から立ち上げる必要がある。

---

## 7. 推奨書き順 (synth 提案)

```
Book II Ch 5/5.5/9 (load-bearing 定理) → Book III Ch 12-19 (case library)
→ Book 0 (序章は最後に固める)
→ Book I → Book IV → Book V → Book VI
```

- **理由**: Book 0 の領土宣言は、Book II の formal objects (二層非可換性定理 / GO 導出 / F-CES) が earned された後でないと書けない。古典的 monograph 順 (Book 0 先) と比較して、新領域宣言の defensibility が大きく違う。
- **代替**: 古典的順 (Book 0 → I → II → ...) でも書けるが、その場合は Book 0 が「予告」になり、Book II 完成後に Book 0 を書き直す二段階執筆が必要。

---

## 8. 関連ファイル

**既存 BZM 本文ドラフト** (`/Users/masa/projects/AMD/amd-os/pwa/bzm/`):
- `preface.md`, `field-before-zero.md`, `field-clocks.md`, `field-gates.md`, `field-toolkit.md`, `field-who-carries.md`
- `why-valuation-fails.md`, `model-overview.md`
- `p-potential.md`, `r-readiness.md`, `s-survival.md`, `strategic-slack.md`, `score-and-bottleneck.md`
- `model-critiques.md`, `retrofit-verification.md`, `nursery-ers.md`, `ethics-and-authorship.md`

**モデル設計正本** (`/Users/masa/projects/AMD/amd-os/pwa/design/`):
- `amd_score.md` (PRS = P × R × S)
- `institution_readiness.md` (ERS 8 軸加重和)
- `bzm_paper.md`, `bzm_paper_draft.md`

**理論正本**:
- `/Users/masa/projects/AMD/BZSF/before_zero_theory.md`
- `/Users/masa/projects/AMD/BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`

**本書実装コード** (`/Users/masa/projects/AMD/amd-os/pwa/src/lib/`):
- `amd-score.ts` (PRS 計算実装 + 旧 AMD Score legacy)
- `ers.ts` (ERS 計算実装)

**Workflow raw output**:
- `/private/tmp/claude-501/-Users-masa-projects-AMD-before-zero/3ccc7fef-2b26-42dc-8df9-355aa04729a0/tasks/wakbxq1i2.output` (227KB JSON, transient)

---

## Changelog

| 日付 | 変更 | 担当 |
|---|---|---|
| 2026-06-25 | 初版作成。workflow `wakbxq1i2` の synth + 5 critiques + 2 coherence + 18 chunk designs を吸収した Book 0-VI 構造再設計案 | えいみ (まさ判断 2026-06-25 KUTE 桑折先生 MTG 後セッション) |