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

> BZM は新領域 — Before Zero Studies — を切り拓く。それは entrepreneurship、innovation systems、technology-transfer、evolutionary economics を置き換えることによってではなく、deep-tech 学術アントレの法人化以前領域 (pre-firm regime) において四つの親文献がいずれも構造的に未定義のまま残してきた状態空間 (ι ∈ {none, latent, declared}, F ∈ {0,1}, S0, I) を formal 化し、かつその空間上の任意の合成評価関数が二つの自然な層 (案件 PRS 乗法 × 機関 ERS 加重和) において必ず非可換 (non-commutative) になることを証明することによって達成される。本書がこの地位を獲得するのは、それぞれ単独の貢献として擁護可能な三つの中核を支える (load-bearing) 動きを通じてである: (1) **二層非可換性定理 (Ch 9)** — 案件 fitness と選抜環境 readiness を単一の乗法 score にまとめると、因果 DAG「機関 → 案件 speed」の下で non-identified になることを示す。これは Bozeman の Contingent Effectiveness、Triple Helix の mutual information、Nelson-Winter 選択動学のいずれもが暗黙裡に回避してきたが、formal に名指ししたものはなかった。(2) **GO 演算子 𝟙[σ_SU≥θ_σ*]·g_TRL(t) を明示的な real options 停止問題から導出 (Ch 5.5)** — θ_σ* は (P, F, B, regime transitions) に対して endogenous に決まり、「wait」と「no-go」は label ではなく構造的対象となる。(3) **F-CES 分解 (Ch 7)** — 委譲不可能な founder character F_char と委譲可能な executive capability F_cap を分離し、経験順序を Beckman/Roberts/Eesley の知見に対して校正 — かつ明示的に検証 — する。BZ-stage 順序は事実として断定するのではなく departure hypothesis として仮説化される。実証プログラムは正直に二分される: Book III は Motivating Cases and Pattern Library として再構成され (後付け校正 (retrofit calibration) であって検証 (validation) ではない)、事前登録された prospective prediction registry (Ch 26b) が、後続論文を待つ discipline の実証研究プログラムとして公刊される。射程は明示的に日本の deep-tech 学術アントレに限定され (Ch 0.0)、field-defining な主張を普遍的に過剰拡張するのではなく射程内で擁護可能なものにする — これこそ四つの親文献の最良の代表者たち (Shane, Sarasvathy, Etzkowitz-Leydesdorff, Nelson-Winter) が、新しいサブ領域を切り出す正統な方法として自ら受け入れるであろうやり方である。本書が field-defining なのは新しい領土を主張するからではなく、三つの falsifiable な formal object と、それらを反証するためのプロトコルを生み出すからである。

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

**verdict**: 現状の形では REJECT。二層アーキテクチャ（PRS 乗法的 × ERS 加重和、非乗法的カップリング）は本物の、かつ公刊に値する方法論的貢献であり、SIP CE2023 の多重 readiness を R に埋め込んだのは擁護可能なオペレーショナルな一手である。しかし、構想されている原稿は「新しい学問分野」と称するのに必要な基礎的な計量経済学的衛生テストに耐えない。ハードな問題が 4 つある。(i) 実証基盤 — 8 PJ × 7 機関 = 56 セル、すべて retrofit — は、8 軸 + ジャンプ成分 + ゲート閾値に対して ∂(ΔR/Δt)/∂ERS_k を identification するには構造的に不可能であり、Ch 25 / Ch 11 の推定はアンカーされた通りでは、単に検出力不足なのではなく機械的に under-identified である。(ii) GO ゲート 𝟙[σ_SU ≥ θ_σ] · g_TRL(t) は構造的対象として主張されているが、プリミティブな最適化 / no-arbitrage / agent problem からは一度も導出されていない — microfoundation なしでは、これはラベル付きの indicator であってモデルではない。(iii) F-CES のパラメータ (a=0.6, ρ=-2) は calibration が提示される前から書籍全体を通じて数値固定されており、これは referee が即座に reverse-engineered fit としてフラグを立てる類の動きである。(iv) TIEM/BWE/CX/SX/CTB/JC/CLG に対する「retrofit」というラベル付けは Ch 26 の falsification 主張にとって致命的である — θ_σ や ρ の設定に使われたのと同じ事例に対して計算された Brier score と calibration plot は in-sample fit であって、予測的 validation ではない。Coherence audit はこれらの大半をすでにフラグしている。提案された fix は必要ではあるが十分ではない。下記の構造手術を施せば verdict は「条件付き yes (yes-if-fixed)」へ動く — つまり、進化経済学とイノベーション研究の交差点に位置する擁護可能な新しいサブ分野ではあるが、著者らが主張する意味での独立分野では「ない」。

**new_discipline_recognized**: yes-if-fixed — 次の 4 条件を満たすことを前提とする。(1) in-sample な Brier-calibration 「falsification」を、18 か月の執筆ウィンドウにわたって観測される少なくとも約 25–30 ケースの事前登録された prospective prediction registry に置き換え、予測は outcome 観測前にロックする。(2) GO(t,i) を明示的なプリミティブ（例: σ_SU を regime variable とする (x,y) 上の real options / optimal stopping 問題で、indicator が posit されるのではなく first-order condition として落ちてくる形）から導出する。(3) F-CES (a=0.6, ρ=-2) を Book 0 で fiat 固定するのではなく、credible intervals と sensitivity analysis 付きで estimated として提示する。(4) 実証主張を「descriptive / typological」階層（56 セルで支えられる）と「causal / identified」階層（支えられないので、明示的に follow-up work へ取り置く）に分割する。これらなしでは、本書は retrofit な illustration を伴う強力な概念フレームワーク — Schumpeter / 進化派の伝統（Nelson-Winter, Dosi, Malerba）のモノグラフとして公刊可能 — ではあるが、まだ identified-empirical field ではない。σ_SU の Triple Helix CD 再定式化は最も genuinely 新規なピースであり、Ch 5 がこれをラベルではなく identifiable parameters を伴う適切な SSM として担うのであれば、それが discipline 主張のアンカーになり得る。

**Top critiques (severity high/critical):**

- `[critical]` **Book II Ch 11 (BVAR + jump + gate) と Book III Ch 25 (層間カップリング検証)**
  - 推定は単に検出力不足なのではなく、構造的に under-identified である。56 セル（8 PJ x 7 機関）— 実際にはもっと少ない、なぜなら PJ は機関とクロスしていない（各 PJ は 1 つの機関に属する）ためである。提案している推定は以下を含む。(i) 混合周波数 state-space を伴う BVAR（月次 PJ、年次機関）、(ii) R/S の transition speed に対する 8 軸 ERS 環境的 rescaling、(iii) Y-001/Y-004/Y-005 級の離散ショックに対する jump 成分、(iv) 閾値 θ_σ を伴う probit-smoothed gate、(v) F-CES パラメータ (a, ρ)、(vi) (μ_A, μ_I, μ_G) に対する Triple Helix CD 係数。これは実効的な N が 8 に近いパネル（PJ レベルの survival outcome、機関 ERS が一度しか測定されないなら within-variation を提供しない）に対して、容易に 40+ の構造パラメータになる。Minnesota prior では救えない — persistence へ shrink するだけで、それは forecasting には良いが、Ch 25 が推定すると主張する 8 軸 causal channel を identification するには良くない。Ch 25 のアンカー文言「∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を軸ごとに推定」は、このデータでは prior の posterior summary である。Research Policy の referee なら誰でも即座に見抜く。Fix: (a) coherence audit が提案する Atlas パネル拡張（>=20 PJ x 7 機関 = 140 obs、加えて機関ごとに少なくとも年次 5 観測の機関 ERS 時系列 = 真の within-variation）にコミットする、または (b) causal-identification 主張を完全に取り下げて Ch 25 を「強い prior の下での descriptive posterior、illustrative であって identified ではない」と再フレーミングする、のいずれか。誠実版は現在のアンカーが示唆するよりはるかに弱い。
- `[critical]` **Book II Ch 5 (Triple Helix SSM) と GO ゲート GO(t,i) = 1[σ_SU >= θ_σ] * g_TRL(t)**
  - GO ゲートはフレームワーク全体の load-bearing object（中核を支える対象）である — PRS を加法的ではなく乗法的にし、NO_GO を absorbing state として定義し、Ch 26 の falsification が test するもの、それがこの GO ゲートである。にもかかわらず、現在の章設計では一度も導出されていない。Ch 0.1/0.3/1.4/4.6/4.7 はそれを既定として扱っている。coherence audit はどの章もその導出を担っていないことを正しく特定し、Ch 5 を canonical な記述場所として提案している。しかし現在書かれた Ch 5 のアンカー（「σ_SU 生成」「Triple Helix CD、内閣府 SIP CE2023 連結ダイナミクス定式化」）は σ_SU のダイナミクスを記述しているのであって、ゲートそのものを記述してはいない。1[σ_SU >= θ_σ] * g_TRL(t) という形のゲートは強い構造的仮定である。σ_SU と g_TRL が乗法的に結合し、σ_SU の効果が滑らかではなく θ_σ における step function であると主張している。進化経済学 / real-options のレンズから見れば、自然なプリミティブは agent（創業者 + 機関）が entry time τ を選んで E[V(P, R, S; σ_SU)] を最大化する問題であり、制約は stopping cost B と flow constraint B - R_net <= F、σ_SU は Markov-switching プロセス内の regime variable である。indicator gate はその際に σ_SU 次元における最適停止境界として現れるべきであって — posit されるべきではない。この導出なしには θ_σ は経済的意味を持たない自由パラメータであり、「σ_SU < θ_σ => NO_GO」は testable な構造的主張ではなくラベリング規約に過ぎない。Fix: Ch 5.1「プリミティブ問題からの GO ゲート導出」を追加し、σ_SU を regime とする (x,y) 上の real-options 問題を解く。ゲートが現れなければ、モデルに入れるべきではない。現れるなら、θ_σ は解釈可能になる（例えば option value の関数として）。
- `[critical]` **Book III Ch 26 (予測性能と falsification)**
  - アンカーされた通りの falsification 章は in-sample fit を out-of-sample validation として装飾したものである。Brier score と calibration plot は TIEM/BWE/CX/SX/CTB/YD/JC/CLG — F-CES の ρ、GO ゲートの θ_σ、Ch 11 の prior elicitation の calibration に retrofit が使われたのと同じ 8 PJ — の上で計算される。これは post-hoc な curve-fitting である。3 つの「reversal conditions」（σ_SU ゲートが discriminate に失敗する、F-CES パラメータが monotonicity に違反する、ERS 加重和が乗法形に負ける）は書き下せても、すでにパラメータを見たデータの上で誠実に test することはできない。coherence audit はこれをフラグしたが、提案された「YD + 却下事例 watchlist」は小さすぎ、かつ狭く選びすぎ（YD はモデル上すでに NO_GO とラベルされているので、その含有は test ではなく confirmation case である）。新しい discipline を主張する Research Policy / ICC への投稿のためには、falsification protocol は次のようでなければならない。(i) outcome 観測の少なくとも 12 か月前にロックされた事前登録 prediction registry、(ii) calibration に使われていない >=20–30 ケースをカバー、(iii) 予測は GO/WAIT/NO_GO + (x,y) trajectory type + 24 か月生存確率を指定、(iv) 予測時点で analyst は outcome に blind。現在の 18 か月の執筆ウィンドウは de novo にこれを組み立てるには短すぎる — それ自体が要点である。本書は prediction protocol と registry design を公刊し、falsification 章は follow-up paper のために open に保つべきである。retrofit データの上でこのモノグラフ内で falsification を行おうとすれば、有能な referee の下で discipline 主張の credibility は崩壊する。
- `[high]` **Book 0 Ch 0.1 / 0.3 と Book II Ch 7 — F-CES パラメータの先行コミット**
  - 本書全体を通じて F = CES(F_char, F_cap; a=0.6, ρ=-2) はパラメータが自然の確立された定数であるかのように固定されて登場する。違う — calibration の選択である。そして coherence audit は calibration の議論が App A.1 に埋もれていると正しく特定している。これは sequencing の問題よりも悪い。credibility の問題である。Book 0 Ch 0.1 の「FIXED MODEL」宣言を読む referee は次の 2 つのいずれかを仮定する。(a) パラメータは理論的（その場合、CES は a=0.6, ρ=-2 に特定的な公理的導出を持たないので、axiomatic derivation が必要）、または (b) データに fit された（その場合、それらは「固定」ではなく、Book 0 でそう提示するのは reverse-engineering に見える）。Y-002、Y-003、Kuwaori MTG 経由の retrofit ベース calibration は prior elicitation 手順としてもっともらしいが、credible intervals、a in [0.4, 0.8] や ρ in [-3, -1] への sensitivity、あるいはより単純な Cobb-Douglas (ρ->0) や perfect-substitutes (ρ=1) 代替案に対する model-comparison test を伴って提示されている箇所はどこにもない。本書の中心的方法論的主張 — 「方程式の形は対象の survival 構造から導かれる」— は、その形のパラメータが survival データが提示される前に主張される時、損なわれる。Fix: (i) Book 0 と Books I-III の章アンカーから specific なパラメータ値を削除し、Ch 7 まで「F = CES(F_char, F_cap) with low substitutability」のみを参照する。(ii) Ch 7 は posterior intervals と Cobb-Douglas および Leontief に対する horse-race を含む正式なパラメータ calibration セクションを含まなければならない。(iii) App A.1 は技術的詳細であるべきで、calibration 議論の初登場であってはならない。
- `[high]` **Book II Ch 8 — S = Pr(τ_x < τ_y) と gambler's ruin フレーミング**
  - S = Pr(τ_x < τ_y)、ここで τ_x は progress threshold への hitting time、τ_y は slack 枯渇への hitting time、これが foundational な survival 方程式として提示されている。クリーンな概念だが、書かれたアンカー（「gambler ruin family」「dy/dt = R_net - B + Σjumps」「H = y/T_remaining」）は 3 つの異なる数学的対象を混ぜていて、どれがプリミティブなのかを明確にしていない。(i) drift R_net - B と jumps を伴う連続時間 diffusion、ここで Pr(τ_x < τ_y) は制限的条件（定数 drift、Brownian noise）の下でのみ閉形式表現を持つ first-passage probability、(ii) (x,y) 上の離散時間 Markov chain、(iii) 確率でも hitting time でもなくゲージである heuristic 指標 H = y/T_remaining。DSGE/macroeconometric な読者にとっての問いは、(x,y) に対してどの確率過程を仮定するのか、Pr(τ_x < τ_y) は実際にそれから computable なのか、それとも H を計算してそれを S とラベル付けしているのか、ということである。y の 5 成分分解（cash / moat / trust / options / focus）の「月次相当」単位への分解は operationally appealing だが、5 成分からスカラー y への aggregation rule が未指定である — 加法的か？concave か？それ自身が CES に従うのか？これなしでは (x,y) state-space は矢印を伴う比喩であって、本書が主張する SSM の意味での state-space ではない。Fix: Ch 8 は (i) (x,y) に対する具体的な確率過程にコミットしなければならない — jump intensity を σ_SU と ERS 軸が変調する 2D jump-diffusion を推奨する — (ii) その過程の下で Pr(τ_x < τ_y) を導出する（あるいは simulate する必要があることを認め Monte Carlo CIs を提示する）、(iii) F-CES と同じ厳密さで 5 成分からの y aggregation rule を指定する。さもなくば S は本書が一度も計算しない量の名前である。
- `[high]` **Book III 機関 retrofit (Ch 20-24) と Book 0 / Book VI Ch 37 の「新しい discipline」主張**
  - 新しい学問分野の主張は、二層アーキテクチャが次のものから真に区別されることに依拠している。(i) Triple Helix / Innovation Systems (Etzkowitz, Lundvall, Malerba)、(ii) 進化経済学 (Nelson-Winter, Dosi)、(iii) Technology Transfer Studies (Bozeman, Siegel)、(iv) Effectuation / Academic Entrepreneurship (Sarasvathy, Shane)。Ch 0.2 はこれらを列挙し、それぞれが二層モデルが fix する「failure mode」を持つと主張する。しかし精読すれば、提案されたアーキテクチャは — その核心において — Nelson-Winter の selection environment（= ERS-as-environment）が project routines の population（= PRS-as-individual-fitness）に作用し、σ_SU が上位の Triple Helix regime variable として乗る、というものである。これは進化経済学 + イノベーション・システムズ「内」の貢献であって、新しい discipline ではない。新規なピース — 層の非乗法的カップリング、SIP CE2023 多重 readiness の R への埋め込み、S の F-CES inner / σ_SU*R_net*F outer Cobb-Douglas 分解、operational な「unknown vs not_started」区別 — は本物の方法論的革新ではあるが、既存分野の道具立てへの改良であって、新分野の基盤ではない。新しい discipline は (a) 他分野が記述できない新しい対象 ontology、(b) 他分野が適用できない新しい方法、または (c) 他分野が systematic に mispredict する経験的現象、のいずれかを要求する。本書は (a) を主張する（「entrepreneurship が undefined である Before Zero 状態空間」）が、ι in {none, latent, declared} と F in {0,1} は既存のイノベーション・システムズ語彙で完全に表現可能である。(c) を Y-001/004/005 を介して示唆するが、競合フレームワークが systematic に mispredict することを head-to-head test で示してはいない。Fix: discipline 主張を「進化的イノベーション研究内の方法論的に統合されたフレームワーク」（擁護可能でなお実質的）に和らげるか、または 8 PJ retrofit 上で (i) PRS x ERS 二層モデル、(ii) Triple Helix CD のみ、(iii) Effectuation logic、(iv) Nelson-Winter routine-selection の間で head-to-head の out-of-sample prediction contest を明示的に走らせる Ch 0.4 または Ch 37.1 を追加する。二層が標準的有意水準で擁護可能なマージンで勝つなら、discipline 主張は生き残る。そうでなければ、フレーミングは退却しなければならない。現在の Book VI Ch 37 の closing ring はこれに対処していない — それは新しい discipline を主張するが、勝ち取ってはいない。

**Recommended strengthenings:**

- Book III を明示的なラベル付きで 2 つの実証階層に再構成する。Tier A — Descriptive Typology（8 PJ retrofit + 7 機関の記述。フレームワークの語彙の事例ベースの illustration として提示し、causal あるいは predictive な主張なし）。Tier B — Identified Empirics（公刊された prediction-registry プロトコルと、>=30 PJ x >=10 機関 x >=5 年次 ERS 観測のターゲット・パネル・サイズで、本モノグラフではなく follow-up paper で実行する別プログラムとして取り置く）。この譲歩は実はモノグラフを強くする — Books 0-II に identification で overreach せずに方法論的新規性を主張させる。
- Ch 5.1「optimal-stopping boundary としての GO ゲート」を追加し、1[σ_SU >= θ_σ] * g_TRL(t) を real-options 問題から導出する。創業者 + 機関が共同で entry time τ を選んで E[integral e^{-rt} (P*R(t)*S(t) - B) dt] を最大化し、制約は B - R_net <= F、σ_SU は Markov regime-switching プロセスに従い、g_TRL は決定論的 readiness ramp である。最適政策は σ_SU が (P, F, B, regime transition matrix) に依存する内生的閾値 θ_σ* を超えるまで待つことだと示す。これによりゲートが基礎付けられ、θ_σ* に経済的内容が与えられる — それは (P, F) 配置を横切って変化し、それ自体が testable な予測である。
- 今、Book III Ch 26 のドラフト前に、prediction registry を事前登録する。現在 active な候補ケース >=20 件（AMD パイプライン + Kuwaori KUTE + 協力機関の active GAP-fund 申請者）に対して GO/WAIT/NO_GO + 24 か月 (x,y) trajectory class を指定する予測をロックする。公証人または arxiv preprint で timestamp する。Ch 26 をプレースホルダ（「falsification は 24 か月の観測ウィンドウが閉じた後の follow-up paper で報告される」）として open に保つ。これは利用可能な単一の最高レバレッジの credibility move である。これなしには discipline 主張は peer review を生き延びられない。
- すべての F-CES パラメータ値 (a=0.6, ρ=-2) を Book 0 と Books I-III の章アンカーから移す。Ch 7 まで F = CES(F_char, F_cap; a, ρ with ρ < 0) を使う。Ch 7 で正式な calibration セクションを追加する。Y-002/Y-003/Kuwaori MTG からの prior elicitation、credible intervals 付きの posterior、a in [0.4, 0.8] と ρ in [-3, -1] への sensitivity、そして held-out subset 上の out-of-sample log-likelihood を使って Cobb-Douglas (ρ->0)、Leontief (ρ->-infinity)、加法的 (ρ=1) 代替案に対する horse-race を行う。held-out subset が存在しないなら、calibration が illustrative であることを認める。
- Head-to-head なフレームワーク比較章を追加する（Ch 26.1 または新しい Ch 0.4 を推奨）。そこで PRS x ERS 二層を (i) Triple Helix CD 単独、(ii) Effectuation logic、(iii) Nelson-Winter routine-selection、(iv) Bozeman TTO-efficiency フレームワーク、と 8 PJ retrofit 上で直接比較する。共通の scoring rule（例: 24 か月 outcome class 予測精度または log-loss）を定義する。二層が dominate しないなら、それは情報である — そしてそれを誠実に報告することが、discipline-founding text を advocacy tract から区別する。二層が明確に dominate するなら、これが discipline 主張に対する単一最良の証拠である。
- Ch 8 で (x, y) 確率過程を明示的に指定する。drift μ_x(R) と μ_y(R_net - B)、Brownian noise Σ、そして強度 λ_x(σ_SU, ERS)、λ_y(B-ショック, Y-001/004/005 級イベント) を持つ jumps J_x, J_y を伴う 2D jump-diffusion。この過程下での Pr(τ_x < τ_y) は閉形式を持たないので Monte Carlo 経由で計算しなければならない — そう述べて MC CIs を提示し、閉形式の「gambler's ruin」フレーミングは stylized なスカラー極限ケースのために留保する。5 成分（cash / moat / trust / options / focus）からの y aggregation rule を指定する — F-CES と同じ厳密さのパラメータ elicitation を伴う CES を推奨する、または aggregation が制約付きで fiat に加法的であることを誠実に認める。
- 機関の匿名性ポリシーを巻頭部（Preface または Book 0 Ch 0.0）で解決する。7 機関すべての明示的同意を伴う完全な identification（推奨）にコミットするか、または括弧書きの実名注釈をどこにも入れない typological な匿名化（Research-University-Type、Regional-Single-Faculty-Type、Integrated-Large-Type）にコミットする。現在の semi-state は擁護不能である。
- coherence audit からのページ予算カットを積極的に実装する。1015pp の現在見積もりは記載された 700–900 予算を 12–31% 超過している。Tier 3 学術モノグラフでは、予算の下端に着地することがコンテンツ追加よりも reception を改善する。具体的目標は次の通り。Book III Ch 25 -> Ch 11 へマージ（30pp 節約）、Appendix A.4+A.5 -> マージ（20pp 節約）、Appendix A.6 -> Ch 9 へインライン化（10pp 節約）、Book III SU1/SU2 -> 25pp/case 平均に正規化（約 50pp 節約）。約 850pp に着地する。
- Book 0 Ch 0.1 と Book VI Ch 37 における「新しい discipline」主張を条件付きで再フレーミングする。「我々は Before Zero Studies を、進化経済学、イノベーション・システムズ、academic entrepreneurship の交差点に位置する方法論的に区別されるサブ分野として提案する。それが独立した分野的地位に値するかどうかは、Ch 26 で概説され後続の作業で追求される実証プログラムに依存する。」これが誠実版であり、peer review を生き延び、そして実は現在の無条件宣言よりも field-founding の動きをより credibly に位置付ける。

---
### Evolutionary economist (Nelson-Winter/Dosi/Malerba lineage)、Research Policy / Industrial and Corporate Change の peer reviewer。「新学問」主張に対してはデフォルトで懐疑的。私の prior では、その種の主張の 95% は新しい記法をまとった進化経済学である。

**verdict**: REFUTE (default)。「新学術領域」という主張は、この骨格では獲得できていない。私が目にしているのは、企業ライフサイクルの特定段階 (pre-firm seed/founder formation) に対する進化経済学の、慎重で計装の整った応用であって、それを新しい記法 (PRS, ERS, σ_SU) でまとっているにすぎない。中核機構 — selection environments、phenotype としての routines、機関と案件の co-evolution、競合との race としての Pr(τ_x<τ_y) 生存 — は教科書通りの Nelson-Winter (1982)、Dosi (1988)、Malerba (2002) sectoral systems、Murmann (2003) co-evolution である。骨格は Ch 10 (「進化経済学拡張」) でこれを認めているが、そこで親フレームワークではなく拡張として扱ってしまっている。包摂の向きが逆である。新学問たるには、進化経済学が証明可能に行えないことを行う必要があり、より小さい状態空間でその結果をより綺麗な記法で再導出することではない。二層非乗法性 (PRS × ERS 禁止) は有用な KPI 設計上の論点ではあるが、理論的新規性ではない — 進化経済学は常に、企業レベルの fitness と selection-environment パラメータを区別してきた。条件付き yes が可能なのは、Books 0/I/II を再構成して (a) 進化経済学との falsifiable な差を、修辞的な領域主張ではなく形式的な言葉で述べ、(b) BZM と進化経済学とが分岐し、かつ BZM が 8-PJ パネル上で勝つ予測を少なくとも一つ示した場合だけである。

**new_discipline_recognized**: no

**Top critiques (severity high/critical):**

- `[critical]` **Book 0 Ch 0.2 (既存スクールの限界マップ) — Evolutionary Economics を Entrepreneurship / Innovation Studies / TT Studies と並ぶ「第四のスクール」として扱っている件**
  - 四スクール限界マップは進化経済学を一行に潰している (「population dynamics は強いが個別案件の生存条件式 B - R_net ≤ F を書く道具を持たない」)。これは文献主張として誤りであり、フレーミングの一手としては致命的である。Nelson & Winter (1982) Ch 9-10 は、純キャッシュフローと準備金の関係で個別企業の生存条件を明示的に与えている — あなたの B - R_net ≤ F は、彼らの倒産閾値付きキャッシュ準備金ダイナミクスの貼り替えにすぎない。Dosi, Marsili, Orsenigo & Salvatore (1995, Small Business Economics) は、entry survival を個別企業レベルの capabilities と selection pressure の関数として明示的にモデル化している。Malerba & Orsenigo (1996, 1997) sectoral systems は、まさにあなたが欠落と主張する institution→firm-formation チャネルを扱っている。Klepper (2001, 2007) の spinout 研究は pre-firm founder formation を扱っている。親文献を誤って表象することにより、Ch 0.2 は「新学問」主張全体をわら人形論法の上に立てている。書かれているままだと、Research Policy の Reviewer 2 はこの段落だけで reject する。Nelson-Winter Ch 6-10、Dosi (1988) JEL survey、Malerba (2002)、Murmann (2003)、Klepper (2007) を相応のレベルで engage し、それらが STOP する地点を示すか、さもなくば「新学問」フレームを下ろし、「calibrated readiness instruments を備えた、進化経済学の段階特化 (Before Zero) 応用」として再配置せよ。
- `[critical]` **Book II Ch 10 (進化経済学拡張) — 進化経済学を親ではなく「拡張」として位置付けている件**
  - Ch 10 アンカーはこう読める: 「σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) の microfoundation; ERS の 8軸サブ軸 Lv1-5 = 機関ルーティンの phenotype; 機関-案件 co-evolution = ERS が R/S の進行速度を裏で押し上げる causal 構造; Gen-3 S = Pr(τ_x < τ_y) を競合先発との race として進化的に解釈.」ここの各節はすべて進化経済学そのものであり、その拡張ではない。phenotype としての ERS sub-axes = Nelson-Winter の routines-as-genes (1982 Ch 5)。外部リンク代替を伴う 8軸加重和 = Malerba sectoral system components。Triple Helix coupling としての σ_SU = Lundvall (1992) national systems を経由した Etzkowitz-Leydesdorff。企業間 race としての Pr(τ_x<τ_y) = 標準的な selection dynamics、industry shakeout に関する Klepper-Simons (2000) を見よ。スコープ通りに読むと、この章は本書の残りを進化経済学に包摂しており、逆ではない。Ch 10 がこれを正直に書くなら、Books 0/I/III/VI の「新領域」修辞は崩れる。推奨: Ch 10 を理論的中核として再配置する (Book II をこれで閉じるのではなく開く) ことで、BZM を段階特化型の進化経済学計装にする。あるいは、Ch 10 が確立する進化経済学からの形式的な departure を特定し (例: 古典進化経済学が導出していない co-evolution 制約としての二層非乗法性定理 PRS × ERS)、その departure を章の見出し結果に据える。
- `[high]` **Book I Ch 1.3 + Book II Ch 8 (戦略余力動学 S = Pr(τ_x < τ_y)) — stopping-time 生存の新規性主張**
  - Pr(τ_x < τ_y) は gambler's ruin / first-passage の定式化であり、Jovanovic (1982, Econometrica) の learning を通じた selection 以来、進化的産業動学に存在してきたものである。Ericson-Pakes (1995, REStud) や IO industry-dynamics 文献全体 (Hopenhayn 1992, Melitz 2003) がさらに形式化している。Klepper-Thompson (2006) の submarket-driven shakeouts は、まさにこの competing-hazards 構造を用いている。「二つの時計」フレーミング (τ_x = 自社余力枯渇、τ_y = 競合先制 / ウィンドウ閉鎖) は、進化経済学における企業間 race vs 企業内枯渇の標準的な分解そのものである。これを Jovanovic-Hopenhayn-Pakes に engage せずに Before Zero の新規性と称するのは、論文を desk-reject される類の動きである。興味深い潜在的新規性は次のようなものだろう: BZ stage の τ_x ダイナミクスは operating-firm の τ_x ダイナミクスと形式的に異なる。なぜなら B (burn) は法人登記まで始動しないため、τ_x は吸収トリガーイベントを持つ regime-switching プロセスになるからである。これは本当に新しい可能性がある — だが骨格はこれを形式的な貢献として切り出していない。Ch 8 は (a) Jovanovic-Hopenhayn-Pakes-Klepper を明示的に引用し、(b) regime-switching B-trigger を形式的 departure として述べ、(c) これが operating-firm モデルと比べて定性的な比較静学を変えることを証明する必要がある。
- `[critical]` **Book II Ch 9 + App A.6 (二層構造非可換性: PRS × ERS forbidden) — 看板の方法論的主張**
  - 非乗法性主張 (「案件 PRS 乗法 × 機関苗床 ERS 加重和 を乗法結合してはならない, 二重計上」) は、本書の中心的な方法論的主張として提示されている。しかし、書かれているままだと、これは定理ではなく KPI 設計上の論点である。進化経済学は常に、企業レベルの fitness (capabilities の乗法関数) と selection-environment パラメータ (乗法因子ではなく fitness を条件付ける状態変数として入る) を分離してきた — Nelson-Winter (1982) Ch 6-7、Metcalfe (1998)、Dosi-Nelson (2010 Handbook chapter) を見よ。あなたが「禁止された二重計上」と呼ぶものは、進化経済学が適切に定式化すれば既に正しく行っていることである。方法論的新規性の主張を獲得するためには、Ch 9 + A.6 は (a) この誤りを実際に犯している、文献中の特定の進化経済学的定式化を示し、あなたの再定式化が 8-PJ パネル上でそれを厳密に支配することを示す; (b) 非可換性を明示的仮定 (例えば「条件 C1-C3 の下で、両層について乗法的な合成スコア S = f(PRS, ERS) は、因果 DAG が与えられたとき non-identified である」) を伴う定理として証明する; (c) これが会計上の便宜ではなく拘束的制約であることを示す、必要がある。(a)-(c) がなければ、「非乗法性は禁止される」は数学ではなく修辞である。現状、App A.6 におそらく 8-12 ページしか割かれていない — 本書の中心的主張を支えるには到底足りない。
- `[critical]` **Book III Ch 25 + Ch 26 — N=8 projects, N=7 institutions での identification と falsification**
  - 進化経済学の peer-reviewer 視点では、これが信頼性危機である。Ch 25 は 8 軸 × 2 outcomes について ∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を 8 PJs × 7 機関 = 56 観測のパネルで推定すると主張している。階層 Bayesian shrinkage (Ch 11 で遅まきながら持ち出される) があっても、これは桑折先生との一度の MTG から引き出された非常に強い prior によってのみ identified となる。Ch 26 の「予測的評価」は、モデルを calibrate したのと同じ 8 PJs を使う — coherence audit が正しく指摘するように、これは prospective ではなく後付け校正 (retrofit) である。進化経済学は、selection effect の identification には N が千単位で必要だからこそ、40 年かけて (Compustat, Census LBD, Orbis, sectoral patent panels といった) より大きなパネルを構築してきた。N=56 で自己誘導した prior に乗った 700-900 ページの monograph が新学問を名乗っても、「興味深い理論、エビデンスなし」と受け取られる。誠実な道は: (a) 実証諸章を「verification」から「illustrative retrofit」に格下げし、BZM 予測がまだ identified ではないと明示する; (b) prospective registry (Ch 26 の YD watchlist のヒント) を 5 年で 50+ pre-firm cases として構築することにコミットし、BZM をエビデンス待ちの研究プログラムとして公刊する; (c) AMD 8 PJ を J-PlatPat / NEDO / JST / 産総研 GAP fund records からの patent-to-firm panels で補強し、ERS→PRS speed effects を identify する retrofit cases N>200 を得る。これらのいずれかを採らない限り、進化経済学の reviewer は実証コアを reject する。
- `[high]` **Book II Ch 5 + Book V Ch 34 — σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) の扱いと national/regional innovation systems 文献の関係**
  - σ_SU は 内閣府 SIP CE2023 を引用しつつ Triple Helix coupled-dynamics 概念として提示されている。しかし Ch 34 の regional-level 再定義 (μ_A = institution ERS、μ_I = regional industry structure、μ_G = 都道府県/地方銀行政策) は regional innovation systems フレームワーク (Cooke 1992, Asheim & Isaksen 2002, Cooke-Heidenreich-Braczyk 2004) そのものである — 進化経済学者が 30 年やってきたことだ。Etzkowitz-Leydesdorff の Triple Helix 自体が、より広い Lundvall (1992) / Edquist (1997) national/sectoral/regional innovation systems ファミリ内の特殊ケースである。Ch 5 は SIP CE2023 (政策フレームワークであり理論的源泉ではない) しか引用しておらず、RIS 文献全体を飛ばしている。進化経済学的視座から言えば: あなたは日本の政策引用で RIS を再発明しており、それを読者に伝えていない。Ch 5 は Cooke, Asheim, Lundvall, Edquist と engage しなければならない; Ch 34 は明示的に「これは μ_A として測定された機関レベル ERS を用いた regional innovation systems の日本文脈での operationalization である」と述べなければならない。その engage の後で BZM になお distinctive な σ_SU 定式化があるなら、名前を付けよ。そうでないなら、σ_SU 表記を下ろし、確立された RIS 変数を使え。
- `[high]` **Book IV (practice spine) + Book V (institution design) — absorptive capacity および dynamic capabilities 文献との関係**
  - Book IV Ch 28-31 と Book V Ch 32-34 は R/S 進行を加速するための機関側および創業者側のアクションを処方している。これは機関レベルでの dynamic capabilities (Teece-Pisano-Shuen 1997, Teece 2007)、案件レベルでの absorptive capacity (Cohen-Levinthal 1990) であり、どちらも進化経済学のど真ん中にある。ERS 8 軸は Zahra-George (2002) ACAP dimensions と dynamic-capabilities の sensing/seizing/transforming 三つ組に近接して写像する。F-CES の F_char (非委任可能) vs F_cap (委任可能) は、human-capital vs organizational-capital 分解 (Becker 1964, Hatch-Dyer 2004) の創業者レベル類似物である。これらを引用しないのは、進化経済学の reviewer なら 30 秒で気付く文献ギャップである。骨格には Teece、Cohen-Levinthal、dynamic capabilities and routines に関する Zollo-Winter (2002) への引用が一つもない。必須修正: Book V は ERS 軸を ACAP / dynamic capabilities に写像し、どこが異なるかを述べることから始める (例: ERS 軸 7 制度設計 兼業COI株式 は ACAP に類似物を持たない、なぜなら ACAP は firm-internal な absorptive capacity を前提とし、pre-firm 機関 permission structures を前提にしないからだ — それは本物の差であり、活用せよ)。

**Recommended strengthenings:**

- Book II Ch 10 を Book II の閉じではなく**理論的中核**として再配置せよ。Book II をこう開く: 「BZM は進化経済学内の段階特化型計装である。Before Zero 状態空間 (ι=none ∨ F=0) は、Nelson-Winter / Dosi / Malerba の selection dynamics が通常起動する地点より上流に位置する。本書は進化経済学を pre-firm regime に下方拡張する。それは (a) 機関 readiness ERS を selection environment の測定可能な phenotype として扱い、(b) 法人登記時点の B-trigger を τ_x ダイナミクスの構造を変える regime-switching event として扱い、(c) project 層と environment 層の合成の非可換性を形式化することによる。」これにより本書は親文献に接地し、peer review にかけられる**三つの具体的貢献**を切り分けられる。
- 専用章 (Ch 10.5 として挿入、あるいは Ch 10 を拡張) として「BZM の進化経済学への三つの寄与」を設け、形式的かつ falsifiable に次を列挙せよ: (i) B-trigger 時の regime-switching τ_x を Jovanovic-Hopenhayn-Pakes の BZ 特化拡張として; (ii) ERS 8軸 Lv1-5 rubric による institution-as-phenotype の operationalization (vs Malerba の定性的 sectoral system components); (iii) 明示的仮定下での二層合成の非可換性定理。この三つがなければ、「新学問」主張は下ろせ。
- 出版前により大きな実証ベースを構築せよ。具体提案: AMD は 3-5 の GAP fund programs (例: JST GAP、NEDO Entrepreneurs Program、大学発新産業創出基金) と提携し、PRS/ERS 計装を使って ~150-200 pre-firm cases を retrofit し、加えて 30-50 機関を ERS Lv1-5 rubric で評価する。これにより Ch 25-26 が power 不足の例示から実際に identified な推定へと変わる。そのパネルが存在するまでは、本書を確定された理論ではなく calibrated instruments を備えた研究プログラムとしてフレームせよ。
- Appendix A.6 (二層非可換性) を Ch 9 の後半としてインラインに移し、20-25 ページに拡張し、仮定、証明スケッチ、反例 (非可換性に違反し 8-PJ パネル上で誤ったランキングを生む文献中の定式化) を備えた形式的定理として書け。これにより看板の方法論的主張が修辞ではなく擁護可能な定理になる。
- Book 0 Ch 0.2 に明示的な文献 engage 節を加えよ。対象: 企業生存に関する Nelson-Winter (1982) Ch 6-10; selection dynamics に関する Jovanovic (1982), Ericson-Pakes (1995), Hopenhayn (1992); innovation systems に関する Malerba (2002), Lundvall (1992), Cooke (1992); spinout と pre-firm founder formation に関する Klepper (2001, 2007); dynamic capabilities に関する Teece (2007), Zollo-Winter (2002); absorptive capacity に関する Cohen-Levinthal (1990), Zahra-George (2002)。各引用は、その文献が何をしており、BZM が何を具体的に追加するか欠けているか、を一文で述べたものと対にせよ。現状、これらの引用は骨格にゼロ件である。
- falsification 章を加えよ (Ch 26 を拡張) — BZM と標準進化経済学が分岐し、かつ BZM が勝つ予測を少なくとも一つ。候補: BZM は、ERS 軸 7 (制度設計 兼業COI株式) が高いが軸 5 (人材接続) が低い機関は、特定の failure mode (founder ι=declared、F_cap=低、急速な法人登記 → premature scaling) を生む、と予測する。これを標準進化経済学モデル (BZ regime-switching 構造を欠く) は系統的に「capability shortfall」と誤分類し、「wrong-stage transition」とは分類しない。これをパネル上で検証せよ。そのような分岐予測が少なくとも一つなければ、BZM は進化経済学から装飾的に区別されているだけで、実質的に区別されてはいない。
- タイトルおよび Book VI Ch 37 の締めを再フレームせよ: 「新学術領域」(即座の懐疑を招く) ではなく、「pre-firm regime に対する進化経済学の段階特化型拡張であり、calibrated readiness instruments と二層非可換性結果を備える」と書け。これは骨格が実際に届けるものであり、Research Policy / ICC で擁護可能であり、reviewer を二極化させる修辞的行き過ぎを避ける。

---
### Innovation Systems / Triple Helix scholar (Lundvall / Edquist / Etzkowitz 系譜)、Research Policy および Industrial and Corporate Change の peer reviewer。デフォルトで懐疑的。ERS主張を、Bozeman (2000)、Siegel et al. (2003)、Bradley et al. (2013)、Asheim/Gertler regional innovation systems、そして Etzkowitz-Leydesdorff (2000) Triple Helix mutual-information operationalization を念頭に読む。既存の operationalization と向き合わずに Innovation Systems を包摂すると主張する枠組みには敵対的。

**verdict**: 現状の射程では REJECT。二層アーキテクチャ (PRS multiplicative × ERS weighted-sum、非乗法的に結合) は真に分析的な貢献であり、既存の制度整備度指標 (Bozeman TTO efficiency、AUTM式 output metrics、RIS/NIS の定性的プロファイル、Triple Helix mutual-information indices) に対する本物の改善である。しかし、Innovation Systems のレンズから「新しい学問分野」として認知するには、三つの構造的問題が立ちはだかる: (1) σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) の operationalization は、既存の Triple Helix mutual-information 文献 (Leydesdorff 2003, 2008、Park & Leydesdorff 2010) と実質的に対話していない — 本書は Triple Helix の用語を引用するが、なぜ μ_A, μ_I, μ_G 上の CD が、この分野で20年間 reference instrument であった entropy/mutual-information operationalization を凌駕するのかを一度も示していない; (2) ERS 8軸 weighted-sum は、Bozeman の TTO capability framework および EU の RIS3 self-assessment toolkit を、crosswalk なしに再発明している — reviewer は「同一機関に対して、既存指標が測れずに ERS は何を測るのか」を必ず問う; (3) パネル (7機関 × 8 PJs = 56 obs) では、本書の二層主張が絶対に要求する institution → project speed の因果矢印を identify できないにもかかわらず、Ch 25 はこのパネル上で 8軸 × 2-outcome × jump identification を約束している。修正されれば yes (条件付き yes、yes-if-fixed) になり得るが、条件は (a) Ch 5 における明示的な Triple Helix mutual-information crosswalk、(b) ERS-vs-Bozeman/AUTM/RIS3 crosswalk 章、(c) Ch 25 を「強い prior を伴う説明用の hierarchical-Bayesian posterior であり、identified された因果推定ではない」と honest に reframing すること、(d) 機関パネルの拡張、もしくは prospective registry へのコミット。

**new_discipline_recognized**: yes-if-fixed

**Top critiques (severity high/critical):**

- `[critical]` **Book II Ch 5 (Triple Helix SSM) and Book II Ch 10 (Evolutionary Economics extension)**
  - 本書は σ_SU = Triple Helix CD(μ_A, μ_I, μ_G) を、あたかも Triple Helix が形式化を待つ未定義の構成概念であるかのように引用する。だがそれは違う。Leydesdorff と共著者たちは20年にわたって、Triple Helix を大学・産業・政府の共起に対する mutual-information measure T(AIG) として operationalize してきており (Leydesdorff 2003 Scientometrics; Leydesdorff & Sun 2009 JASIST; Park & Leydesdorff 2010 RP; Leydesdorff & Ivanova 2014 JASIST)、地域・セクター・時系列に適用する相当量の実証文献が存在する。Ch 5 の anchor は 内閣府 SIP CE2023 結合動学定式 に触れるものの、T(AIG) と対話していない。Research Policy の reviewer は、これを無知か正当化されない再定式化のいずれかとして reject する。さらに悪いのは、Cobb-Douglas 形式 CD(μ_A, μ_I, μ_G) は、三つの helices 間に一定の elasticity と単位 elasticity-of-substitution を課すが、これは三つの helices が *代替不可能な* synergy を通じて相互作用する (負の mutual information = synergy、正 = 競争 — 符号に敏感で非CD的な構造) という Triple Helix 文献の中心的主張と真っ向から矛盾する。本書は、それを認めぬまま、より弱い証拠の上に既存分野が受容するよりも強い functional-form 仮定を主張していることになる。Ch 5 が T(AIG) への明示的 crosswalk を含み、なぜ CD が支配するのかを示し、synergy/competition の符号非対称性に応答するまで、σ_SU 機構は Triple Helix の後継としては信用できない — それは弱い microfoundations の上に作られた並行的な再発明にすぎない。
- `[critical]` **Book I Ch 3 (ERS introduction) and Book III Ch 20-24 (institutional retrofits)**
  - ERS 8軸 (シーズ発掘 / 知財・技術移転 / 起業支援制度 / 共同研究契約処理 / 人材接続 / 資金接続 / 制度設計 / 文化・実績) は、Bozeman (2000) Contingent Effectiveness Model of TTO、Siegel-Waldman-Link (2003) RP determinants of TTO productivity、Bradley-Hayter-Link (2013) Foundations and Trends survey、そして EU RIS3 self-assessment 6 dimensions と大幅に重複する。しかし Ch 3、Ch 9、Ch 32、Ch 36 の anchor 本文には、これらが一つも引用されていない。Research Policy や ICC の peer reviewer は即座に問うだろう: (a) 同じ7機関に対して、Bozeman のフレームワークが測れず ERS が測るものは何か? (b) なぜ8軸であって、Bozeman の5軸でも RIS3 の6軸でもないのか? (c) ERS 軸が既存指標の単なるラベル付け替えではないことを示す construct-validity の作業はどこにあるか? Lv1-5 rubric と s=(lv-1)/4 メカニクスは新規であるかのように提示されているが、制度整備度に対する capability-maturity-model (CMM) 風の5段階 rubric は、2000年代以降の RIS/NIS 評価において標準である (例: OECD STIP Compass、EIS Regional Innovation Scoreboard sub-indicators)。ERS-vs-既存指標 crosswalk 章の欠如は致命的だ。それがなければ、ERS は文献レビューをしていない日本のディープテック・スタジオによる並行 taxonomy として読まれ、「新しい学問分野」の主張は擁護不能となる — せいぜい漸進的な精緻化に留まる。
- `[critical]` **Book III Ch 25 (層間結合検証) and Book II Ch 11 (BVAR+jump+gate)**
  - 本書の中核的方法論主張 — ERS が PRS の R/S transition rates を因果的に加速する、すなわち institution → project — は identification を要求し、単なる相関では足りない。Ch 25 は k=1..8 について ∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を別々に推定すると約束する。パネルは 8 PJs × 7機関 = 56 dyadic observations で、PJs は機関にランダム割当されていない (seed 品質と研究者ネットワークによる selection が支配的)。hierarchical Bayesian shrinkage を入れても、56 obs 上で 8軸別 causal coefficients × 2 outcomes × jump components を推定するのは願望思考であり — posterior intervals は無情報になるか、あるいは枠組みを動機づけた当の 桑折 MTG から引き出した prior に完全に駆動される (教科書的な prior-data circularity)。Innovation Systems 文献は2000-2010年代に regional innovation system 回帰でこの教訓を痛烈に学んだ: 横断的な機関指標 × プロジェクト成果は、specification 次第で恣意的な符号を生む (cf. Doloreux & Parto 2005、Asheim et al. 2011 の批判)。(a) 起稿前にコミットされた prospective prediction registry、(b) instrumental variable または natural experiment (制度改革のタイミング? GAP fund policy shocks?)、または (c) 明示的な hierarchical priors の下での説明用 posterior としての honest な reframing がなければ、Ch 25 はその anchor が約束するものを届けられない。audit が Ch 25 を Ch 11 に統合せよと勧告するのはこの問題を取り繕うものだ — より深い問題は identification であって、章構成ではない。
- `[high]` **Book V Ch 34 (地域 産学官 双対動態)**
  - Ch 34 は σ_SU を地域レベルで再定義し μ_A = 機関ERS とするが、これは audit が flag したが押し込まなかった compositional change である。Regional Innovation Systems のレンズ (Cooke、Asheim、Gertler) から見ると、これはカテゴリーエラーである。National Triple Helix の μ_A は機関レベル ERS の総和ではない — helix としての academia には、基礎研究規範、研究者の流動性、出版システム、博士課程訓練パイプライン、ディシプリン文化が含まれ、これらのいずれも ERS 8軸 (TTO/起業支援に焦点) では捕捉されない。μ_A を ΣERS と等値することは、academia helix をその commercialization arm に縮約することであり、まさに RIS scholars (Asheim & Gertler 2005、Trippl et al. 2015) が二十年にわたって押し戻してきた還元主義そのものである。さらに悪いことに、Ch 34 anchor は4つの具体機関を地域記述子と組み合わせ (愛媛大 + 伊予銀、香川大 + 百十四銀行)、ERS の類似性と divergent outcomes を主張するが — これは古典的な RIS thick/thin distinction (Tödtling & Trippl 2005) であり、本書はそれを引用も差別化もしていない。当該章は (a) ERS を μ_A の commercialization-subset として明示的に位置づけ、何が除外されているかを認めるか、(b) ERS に加えてより広い academia helix 変数を包摂する厚い μ_A を導入する、のいずれかが必要である。現状はそのどちらもなされていない。
- `[high]` **Book 0 Ch 0.2 (既存スクールの限界マップ) treatment of Triple Helix and TTO Studies**
  - Ch 0.2 anchor は四つのスクールが同時に PRS × ERS によって gap-fill されると主張し、Triple Helix を「institutional dynamics と project dynamics が形式的に接続されていない」として一蹴する。これは現代の Triple Helix 研究に対するわら人形論法 (strawman) である。Leydesdorff の mutual-information formulation は、longitudinal data を伴うセクター・地域レベルで明示的に作動し、firm-level outcomes との接続を持つ (Kwon et al. 2012、Leydesdorff et al. 2017)。Quadruple/Quintuple Helix 拡張 (Carayannis & Campbell 2009, 2010) は市民社会と自然環境に明示的に取り組んでおり — 本書が関心を寄せる BZ 文脈 (BWE 女性ヘルス、CX カーボン) と関連性がある。同様に、TTO Studies は「double-counting を伴う KPI design」として退けられているが、Bozeman の Contingent Effectiveness framework は機関 capability とプロジェクト成果を明示的に分離している — まさに BZM が新規と主張する二層分離そのものである。Ch 0.2 の退けは peer review を生き残るには綺麗すぎる。Research Policy の reviewer は問うだろう: 「Bozeman のフレームワークが double-counting を強いる箇所と、T(AIG) が制度と project dynamics を接続できない箇所を、テキストから引用して示せ」。その引用レベルの engagement なしには、四スクール解体は本書の好む framing のためのわら人形論法的足場として読まれる。「新しい学問分野」の主張は Ch 0.2 が穴のないことに依存しており、現状はそうなっていない。
- `[high]` **ERS weighted-sum w_k = 1/8 default and Ch 3.4 (なぜ加重和か)**
  - 等加重デフォルト w_k = 1/8 は Ch 3.4 で「機関は弱軸を外部連携で代替できる」を根拠として動機づけられている — しかしこの議論は、elasticity of substitution > 1 を持つ *generalized mean* を支持するものであって、単純な算術平均ではない。算術平均は perfect substitutability (σ = ∞) の特殊ケースであり、本書自身が他所でこれと矛盾している (Ch 23 は axis-specific λ_k substitutability coefficients を持つ「effective A_k」を導入しており、軸が *完全には* 代替可能でないことを含意する)。数学形式の議論は内的に一貫していない: 軸が axis-specific λ_k で部分的に代替可能なら、aggregator は uniform weights の算術平均ではなく、軸別 weights を持つ CES であるべきだ。さらに軸7 (制度設計) は Ch 24.3 で「低いときに補償しないが、低いとき他軸を機能停止させる precondition」と明示されている — これは軸7に関する *minimum* または *Leontief* operator の他軸への適用であり、算術平均処理とは完全に両立しない。本書自身の証拠 (Ch 24.3 東京科学大ケース) が本書自身の aggregator を反駁している。Ch 9 (ERS 導出) は (a) 算術平均を、軸7の precondition 役割と軸別 substitutability を尊重する heterogeneous CES に置き換えるか、(b) これらの非一貫性がなぜ問題にならないかを明示的に擁護するか、いずれかでなければならない — 現状はそのどちらでもなく、Ch 3.4 の「7軸標準 vs 1軸ゼロ」例 (44% vs 0%) は precondition 問題を隠す修辞的すり替えである。

**Recommended strengthenings:**

- 新章 — Book II Ch 5.5 (または附録の姉妹章) — として「Triple Helix mutual-information との crosswalk」を挿入し、Leydesdorff の T(AIG) を日本のセクターレベルデータセット (例: carbon、semiconductor) に適用して、(a) CD(μ_A, μ_I, μ_G) と T(AIG) が一致する場面、(b) 乖離する場面、(c) なぜ case-level σ_SU に対する CD の扱いやすさが、T(AIG) の集団レベル推論を支配するのか、を示すこと。この crosswalk なしには Ch 5 は Research Policy の review を生き残れない。
- 新章 — Book I Ch 3.0 または Book V Ch 31.5 — として「ERS と既存機関整備度指標の crosswalk」を挿入し、8軸を Bozeman (2000) Contingent Effectiveness、Siegel-Waldman-Link (2003) determinants、EU RIS3 6 dimensions、AUTM annual survey indicators、OECD STIP Compass に明示的にマッピングする。7つの日本機関上で、ERS が既存指標と異なる rank-order を与える箇所、および BZ ステージ特異的に (すべての機関的問いではなく) ERS がより良い instrument である理由を示すこと。
- Ch 25 (層間結合検証) を honest に reframing する: 「identified causal estimates」という framing を完全に降ろす。「強い専門家 prior の下での hierarchical-Bayesian posterior summary であり、56 obs では 8軸 causal effects を identify できないことを明示的に認める」と位置づけ直す。institution → project speed 主張の反証可能性を、後付け校正 (retrofit) 推定ではなく Book VI の prospective registry に依存させる。これによって二層方法論主張は、reviewer が自明な power calculation を実行したときの崩壊から守られる。
- prospective prediction registry を Book VI の deliverable としてコミットする: AMD は18ヶ月の執筆ウィンドウ中に、10-20 の新規 PJs と 3-5 の新規機関について GO/WAIT/NO_GO と σ_SU/ERS の読みを ex ante 登録し、月24に封印された予測を review する。これが後付け校正循環 (retrofit-circularity) 問題への唯一信用に足る応答であり、本書の epistemic stance を「post-hoc fit」から「falsifiable framework」へと転換する。Ch 26 反証条件は、修辞ではなく prospective subset 上で testable になる。
- ERS 算術平均を、軸7の precondition 役割を尊重する hierarchical aggregator に置き換える: ERS = (例えば) A_7 · f(A_1..A_6, A_8)、ここで f は axis-specific substitutability を持つ CES。これは算術平均が表現できない Ch 24.3 自身の証拠 (高 Lv7、他軸空回り) に応答する。そうすれば Ch 9 導出章には実質的な数学作業がある — 乗法的集約に対する弁護だけでなく、特定の functional form を他の代替形式に対して擁護することになる。
- Book III に少なくとも1件の非日本機関の後付け校正章 — Ch 24.4 または新 Ch 24.5 — を追加する (MIT Deshpande Center、EPFL TTO、KIT Karlsruhe、または Tsinghua x-lab) を public-domain data で扱う。国際事例が一件あるだけで「日本限定で普遍性を主張」批判を防げる。Book VI Ch 37 は次に、漠然とした希望ではなく具体的プロトコルを伴う即時の次段研究アジェンダとして、国際横断的体系比較を位置づける。
- Book 0 Ch 0.2 を「四スクール解体」から「四スクール継承」へと再構築する: Entrepreneurship、Innovation Studies、TTO Studies、Evolutionary Economics のそれぞれについて、BZM が継承するもの (F_char に対する effectuation logic; σ_SU baseline に対する mutual-information; ERS-PRS 非乗法結合に対する Bozeman の二層分離; σ_SU 閾値に対する selection-environment 言語) と、BZM が付加するもの (BZ 状態空間、生存条件式 B-R_net≤F による lock-in、gate operator) を示す。継承 framing は解体 framing より攻撃しづらく、学術モノグラフのエチケットにも沿う。
- Triple Helix CD パラメタライゼーション主張を引き締める: Cobb-Douglas を a priori にコミットするのではなく、Ch 5 を「我々は一次近似として CD を用い、CES (App A.4 では Kalman だけでなく CES robustness を走らせるべき) と T(AIG) (同一データ上での Leydesdorff の instrument に対する cross-validation) への sensitivity analysis を伴う」と framing する。これにより functional-form 上で攻撃される面積が縮小する。
- Y-006/Y-007/Y-008 を audit の勧告どおりに明示的に指定し、かつ具体的な Innovation Systems 文献に紐づける: Y-007 (論文-特許順序事故) → first-to-file vs first-to-publish の制度比較文献 (Lemley & Sampat 2012、Mowery-Sampat 2005 Bayh-Dole studies)。これにより AMD の一次資料である 桑折 MTG 知見が、発見された新奇性として提示されるのではなく、既存の学術的対話に錨を下ろすことになる。
- Ch A.6 (二層非可換性 — non-commutativity of PRS × ERS) を audit が示唆するとおり Ch 9 にインラインで移し、かつ非可換性をカテゴリー的主張として形式化する: ERS は PRS (プロジェクト軌道状態空間) とは異なる測定空間 (機関 capability 状態空間) に存在し、両者を結ぶ写像は *factor map* (ERS → expected value multiplicand) ではなく *parameter map* (ERS → R/S transition rates) である。このカテゴリー的言語こそが、二層主張を Bozeman の Contingent Effectiveness (写像を非形式的なままに置く) に対して真に新規なものとする。

---
### Empirical econometrician、Research Policy / Industrial and Corporate Change の peer reviewer。Identification 第一主義。retrofit-as-validation（後付け校正を検証と称すること）に敵対的。「新たな学問分野」の立証責任は narrative coherence ではなく identification にあると信じている。

**verdict**: no — 現在の構造のままでは不可。実証的基盤は「新たな discipline」という主張の重みを支えられない。n=8 後付け retrofit PJ × 7 機関 = 56 セル観測、しかも従属変数側に研究者由来の selection（AMD が触った案件のみ）がかかっている。モデルは仮定によって identified されているのであって、データによってではない。Book III Ch 25 は支えきれないパネルから 8 軸 × 2 アウトカムの因果推定を約束しており、Ch 26 の「反証」も本質的には in-sample fit を予測と称して飾り立てたものだ。Tier 3 monograph という framing がこれを悪化させる：Research Policy の peer reviewer は「new discipline」を読んだ瞬間に自由度を数え始める。実証主張を徹底的にスケールダウンし（illustrative、仮説生成的、identified ではない）、かつ今から 5〜10 年かけて成熟させる prospective registry を立ち上げる場合に限り、(条件付き yes / yes-if-fixed) として回復可能。

**new_discipline_recognized**: yes-if-fixed — 以下三つの構造変更が条件：(1) Book III を「Empirics / 実証」から「Illustrative retrofit / motivating cases（説明用の後付けケース）」へ格下げし、n=8 では自由パラメタが ~15 以上ある構造モデル（P、R 5 要素 bundle、S = σ_SU × R_net × F で F は CES(a, ρ)、ERS 8 軸 weights、GO 閾値 θ_σ、jump intensities、gate smoothing）を identify できないことを ex-ante に明示すること；(2) discipline を規定する主張を「我々はこのモデルを推定した」から「我々は先行学派が未定義のまま放置していた state-space と observation grammar を公理化した」へ移すこと — discipline の主張は概念的な切り分け（Before Zero 状態空間 + 2 層 non-commutativity）に依拠すべきで、パラメタ推定値ではない；(3) prospective prediction registry（5 年で 30 事例以上、決定点での GO/WAIT/NO_GO を事前登録）を当該 discipline の実証研究プログラムとして約束し、Book III の deliverable ではなく Book VI の research agenda として明示的に framing すること。この三つが揃わなければ、本書は AMD のケースファイルを後付けで体系化した高度な post-hoc rationalization に読まれ、書籍としては出版可能だが discipline としては成立しない。

**Top critiques (severity high/critical):**

- `[critical]` **Book III Ch 25（層間結合検証）+ Ch 11（BVAR+jump+gate）**
  - 主張されている n では identification は不可能。Ch 25 は ∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を「8 軸で推定」と約束している。パネルは 8 PJ × 7 機関だが、PJ は高々 1〜2 機関にネストされているため、軸別 ERS 変動に対する実効的な cross-section は institution-level 単位で 7 程度に過ぎない。ERS 8 軸 × 2 アウトカム（ΔR, ΔS）× jump 成分 × gate smoothing を組み合わせると、自由パラメタ数がパネル・セル数を超える。同じ専門家（桑折）が定性理論を供給した上でその専門家から informative prior を引き出して Bayesian shrinkage をかけるのは identification ではない — それはデータが装飾的役割しか果たさない prior 駆動の推論だ。coherence audit の提案する修正（option b：「identified causal estimates ではなく illustrative posterior」）は正しいが、本書を 実証/Empirics として位置付ける限り両立しない。実証セクションの改名・主張取り下げか、パネルの本格的な拡張（audit の option a、+12 retrofit）のいずれかが必要だが、後者も 18 ヶ月で実現可能だとしても、このパラメタ空間に対しては依然として under-identified だ。Research Policy の referee は因果言説を一目で reject し、ICC の referee は本書が通せない power analysis を要求するだろう。推奨：Book III を「Motivating Cases and Pattern Recognition」に改名し、すべてのモデルパラメタは推定ではなく定性的整合性に対する calibration であると明示し、因果言説の anchor（Ch 25 ∂/∂ERS_k、Ch 26 反証として framing された反転条件）はすべて Book VI の forward-looking な research agenda へ移すこと。
- `[critical]` **Book III Ch 26（予測パフォーマンスと反証）**
  - 反証主張は、すでにアウトカムを見ている retrofit パネルの上に組み立てられている。Ch 26 は 3 つの反転条件 ((i) σ_SU gate separation、(ii) F-CES rank invariance、(iii) ERS additive vs multiplicative) を列挙しているが、いずれも軌跡を modeler が詳細に把握している同じ 8 PJ で検定される。これは in-sample fit を out-of-sample test と偽装したものだ。retrofit パネル上での Brier score と calibration plot は、modeler が既知履歴にパラメタをどれだけうまく合わせ込んだかを測っているだけで、それ以上のものではない。coherence audit はこれを捉えていた（Y-005 の二重因果ストーリー、Ch 26/B.1 の prospective vs retrofit 区分）が、提案された修正（「どの観測が retrofit でどれが prospective かを明確化する」）では不十分である。prospective に登録されたと記述されているのは YD と「watchlist」だけ — つまり prospective 観測は n≈1-5 に対し、モデルパラメタが ~15 以上ある。誠実な対応は：(a) retrofit パネルに対する「falsification」という framing を完全に放棄し、「consistency check」または「narrative coherence audit」に置き換える；(b) prospective registry プロトコルを今直ちに約束する（AMD が 2026 年以降に touch する次の 30 事例に対して GO/WAIT/NO_GO の主張を事前登録し、日付スタンプ付き Atlas エントリ、τ_x または τ_y が観測された後にのみ封印を解く sealed predictions）；(c) Ch 26 を「このモデルが今後 5〜10 年でどう検定されるか」と framing し、「このモデルがどう検定されてきたか」とはしない。これがなければ、反証章は本書最大の信頼性負債となる。
- `[high]` **Book II Ch 7（S 内部構造）— F-CES パラメタ calibration**
  - F = CES(F_char+1, F_cap+1; a=0.6, ρ=-2) は 12 章以上で具体的なパラメタ付きで引用されているが、calibration source は App A.1 であり、そこは（coherence audit によれば）「経験的 retrofit (Y-002, Y-003, 桑折 MTG)」に委ねられている。これは 3 つの定性事例と 1 つの専門家インタビューに対する calibration だ。ρ=-2 は強い主張である：これは代替弾力性 σ=1/(1-ρ)=1/3 を含意し、F_char と F_cap が高度に補完的で Leontief 型に近いことを意味する。この数値は、創業者の character を経験ある執行役員の採用で「救える」かどうかを規定する — EIR プログラム（Book V Ch 33）に直結する政策含意を持つ、実証的に大きな主張だ。n=3 の事例的印象から calibration するのは、方法論的には直観で設定するのと区別がつかない。referee は問うだろう：(1) calibration sample を変えたら ρ の posterior はどうなるか？ (2) ρ ∈ {-3, -1, 0} の範囲で GO/WAIT/NO_GO 分類は反転するか？ (3) a=0.6 は a=0.5 や 0.7 と比較してどうか？ もし答えが「政策的結論は ρ ∈ [-3, 0] に対して頑健」なら、式は残してよいが具体的な数値は落とすべき（「低代替性で calibration 済み」とだけ言う）。もし答えが「分類は ρ に敏感」なら、本書は適切な calibration 研究なしにそれらの分類を主張できない。推奨：App A.1 で完全な感度分析、本文中の (a=0.6, ρ=-2) を (a∈[0.5,0.7], ρ∈[-3,-1]) に置き換える、または calibration に十分なデータが集まるまで CES 形式を完全に捨て (F_char, F_cap) の定性的 2×2 typology に切り替える。
- `[high]` **Book III Ch 12-19（8 PJ SU retrofit）— 従属変数への selection**
  - retrofit 対象の 8 PJ はすべて AMD が touch した案件である。AMD がどの seed に engage するかという selection 自体が、知覚された P、R、S、ERS 品質の関数だ。つまりパネルはモデル自身の独立変数（およびほぼ確実に従属変数 — AMD が机に上らなかった案件は retrofit していない）の上で selection されている。TIEM/BWE/CX/SX/CTB/YD/JC/CLG は単一 startup-studio のパイプラインからの便宜的サンプルであって、日本のディープテックにおける Before Zero 状況の母集団サンプルではない。含意：(a)「failure pattern」inventory（Ch 4 やらかし）は AMD のプロセスが露出させる failure mode に条件付けされており、AMD のスクリーニングに不可視な failure mode は構造上欠落する；(b) F-CES calibration ケースは AMD が共に働くことに同意した創業者から非ランダムに引かれており、AMD の顕示選好により平均以上の F_char を持つ；(c) institution retrofit も AMD が関係を持つ機関を対象としており、これも非ランダム。coherence audit は実証的バランスの関連問題（CLG 過小、TIEM 過剰）は捉えたが、より深い sampling 問題は逃した。referee は比較集合を要求するだろう：2015-2025 年に何件の日本ディープテック seed が Before Zero 状態に入ったか？ そのうち AMD が見たのは何割か？ 8-PJ サンプルの (P, R, S, ERS, founder F) 分布は母集団とどう異なるか？ これがなければ、本書は Before Zero を領域として文書化しているのではなく、AMD のハウススタイルを文書化しているに過ぎない。推奨：Ch 1 または App B.1 に明示的な「sampling and external validity」セクションを追加してこの点を認める；姉妹スタジオ（Beyond Next、Mirai Souzou、IndiePartners、Anri seeds など）から二次データとして反事実ケースを収集する；8 PJ を「discipline の実証的基盤」ではなく「AMD の学習コーパス」として再 framing する。
- `[high]` **Book 0 + Book VI —「new discipline」主張そのもの**
  - discipline 主張は設計上 2 つの柱に依拠する：(1) 先行学派（Entrepreneurship、Innovation Studies、TTO Studies、Evolutionary Econ）は Before Zero を未定義のまま放置している；(2) PRS × ERS 二層 non-commutativity が統一的な formal device となる。柱 (1) は擁護可能だが誇張されている — Effectuation、Discovery-Driven Planning、Lean Startup はいずれも明示的な pre-firm phase を持ち、Triple Helix 文献には institution-level dynamics がある。「四学派は BZ を未定義にする」という主張は狭い読みの下でのみ真であり、referee は本書が無視している隣接文献を少なくとも 8〜10 個列挙するだろう（Stam & van de Ven 流の entrepreneurial ecosystems 文献；PSED nascent entrepreneurship panel；Cohen-Levinthal の absorptive capacity を pre-firm capability 概念として扱う流れ；Shah-Tripsas の user-entrepreneurship；Shane を超える science-based entrepreneurship — Vohora-Wright-Lockett 2004「stages of academic spin-out development」は Before Zero そのものを論じているが設計に含まれていない）。柱 (2) はより強い主張だが、二層モデリングは新規ではない — DSGE には sectors × firms、生態学には community × population、organizational ecology には institutional × organizational があり（Hannan & Freeman 1977 以降）。新規なのは特定の切り分け（PRS multiplicative × ERS additive、non-commutativity 警告、プロジェクト速度に対する environment-variable としての institution）だが、これは既存の entrepreneurship-and-innovation 領域に対する方法論的貢献であって新たな discipline ではない。discipline には (a) 固有の研究対象、(b) 創始者より大きな研究コミュニティ、(c) journal/conference のインフラ、(d) cumulative findings が必要だ。本書は (a) はかろうじて持つが (b)-(d) を持たない。推奨：「new discipline」を「new sub-field」または「Before Zero state space を中心に academic entrepreneurship を再 framing したもの」に格下げする；Vohora-Wright-Lockett、Clarysse-Heirman、Mustar et al.、PSED panel、entrepreneurial ecosystems 文献と engage する文献レビュー章を追加する；「discipline」は prospective program が成功した場合に 10 年振り返り版でのみ留保する。
- `[high]` **Book II Ch 5 + Ch 11 — GO 式の identification**
  - GO(t,i) = 𝟙[σ_SU ≥ θ_σ] × g_TRL(t) はモデルの中心的な観測 gate である。coherence audit は canonical-owner 問題を flag するが、より深い問題は θ_σ と g_TRL の関数形の identification だ。σ_SU 自体が Triple Helix CD(μ_A, μ_I, μ_G) から構築されており、これは国家レベルの academic publication、industry investment、government policy 系列から 3 つの latent macro factor を identify し、それをプロジェクト固有の σ_SU に projection する必要がある。各ステップに identification choices がある：(a) CD aggregator の elasticity weights、(b) 国家レベル μ からプロジェクトレベル σ_SU exposure への projection、(c) GO が「発火」する閾値 θ_σ、(d) g_TRL(t) の形状 — logistic か？ TRL=6 での step か？ BRL に対して multiplicative か？ Book II 設計はこれを Ch 5 に割り当てている（audit の提案修正に沿って）が、8 PJ × 7 機関ではこれらのいずれもデータから identify できない。すべて仮定 + 定性的整合性 check で設定される。それ自体は理論書として問題ないが、本書は同時に Ch 26 で GO gate の予測性能評価を行いたい — gate のパラメタが予測の評価対象と同じケースで calibration されていれば循環的だ。推奨：Ch 5 anchor で σ_SU 構築が強い identifying assumption を持つ measurement model であることを明示し、それらの仮定を列挙し、Ch 11（BVAR）には identify 可能なもの（おそらく：μ macro 系列の persistence、COVID/CHIPS Act のような既知ショックでの jump intensities）のみを推定させる一方、θ_σ、g_TRL 形状、project-level σ_SU mapping は明示的な robustness analysis を伴う fixed-by-assumption の感度パラメタとして扱うこと。

**Recommended strengthenings:**

- Book III を「実証 Empirics」から「Motivating Cases and Pattern Library」へ改名する。すべての因果推定言説（Ch 25 ∂/∂ERS_k、Ch 26 反証）を Book VI に「prospective research program」として移す。この単一の改名で identification の異議の 80% は語りの実体を失うことなく除去できる。
- 「Identification, Sampling, and What This Book Cannot Claim」と題する methods 章または App B の実質的サブセクションを追加する。明示的に述べる：(1) n=8 PJ は単一 startup studio からの便宜的サンプル；(2) institution panel n=7 は軸別因果 identification には小さすぎる；(3) すべてのモデルパラメタ（a=0.6, ρ=-2, θ_σ, w_k weights, λ_k 代替性）は retrofit パネルとの定性的整合性で設定されており、推定されていない；(4) 本書の貢献はパラメタ値ではなく formal grammar（state space、observation gate、二層 non-commutativity）である。この誠実な framing こそが Research Policy / ICC の referee に理論論文を受け入れる気にさせる。
- prospective Atlas registry を今約束する：AMD は 2026 年以降に engage する新規 seed すべてについて GO/WAIT/NO_GO の主張を事前登録し、封印・日付スタンプ付きで、τ_x または τ_y が解決した後にのみ開示する。5 年で 30 事例以上を目標とする。registry プロトコルを本書付録として publish する。これにより discipline 主張は「我々は示した」から「我々は falsifiable な program に commit した」へ転換する — 本書のポジショニングにとってはるかに強い認識論的スタンスとなる。
- 本文中の (a=0.6, ρ=-2) などの具体的な数値パラメタ主張を、定性的なパラメタ範囲 + 感度境界に置き換える。正確な calibration は完全な感度分析と共に App A.1 へ移す（合理的なパラメタ変動の下で分類は反転するか？）。分類が頑健であれば本文から具体数を落とす；反転するなら、より多くのデータが揃うまで分類主張自体を取り下げる。
- 見落とした文献に Book 0 Ch 0.2 の実質的拡張で engage する（現状「四学派」 — Vohora-Wright-Lockett 2004 stages-of-academic-spin-out、Clarysse-Heirman 2007、Mustar et al. 2006 typology、PSED nascent entrepreneurship panel、Stam-van-de-Ven entrepreneurial ecosystems、pre-firm capability としての Cohen-Levinthal absorptive capacity、Shah-Tripsas user entrepreneurship を含めるよう拡張）。この engagement なしには Ch 0.2 の「なぜ四学派は失敗したか」は わら人形論法（strawman）に過ぎず、discipline 主張は最初の reviewer pass で却下される。
- 「new academic discipline」という framing を「Before Zero 状態空間と二層 readiness observation grammar を中心とした academic entrepreneurship の再 framing」へ格下げする。これは資料から擁護可能な強い sub-field 貢献の主張であり；discipline 主張は上記項目 1-3 が成熟するまで擁護できない。「discipline」は prospective program が成功した場合の 10 周年記念版での回顧的主張として留保する。
- Y-005（Cabot 機会逃し）の二重因果ストーリー問題を protocol レベルで解決する：App C のすべての やらかし ケースは構造化された「causal anatomy」テンプレート（ケース → 関与する ERS 軸 → 影響を受ける PRS factor → それぞれが防止し得た反事実）を持たねばならない。これにより coherence audit が flag した App C vs Ch 4.6 の不整合を防ぎ、ケースライブラリを監査可能にする。
- institution layer については：7 機関すべての完全匿名化（本文中で「NIMS」/「工学院大学」の名指しは一切行わず、構造的タイプのみ）にコミットするか、書面同意取得済みでの完全開示にコミットするか、いずれかにする。現在の半開示（「京大（匿名）」スタイル）は最悪の選択肢で、対象を保護もせず検証も可能にしない。実証章（Ch 24、Ch 25、Ch 34）は完全匿名化、同意が文書化できる「謝辞」/方法論付録のみ完全開示を推奨する。

---
### Entrepreneurship/Academic Entrepreneurship scholar (Shane 2004; Wright et al. 2007; Sarasvathy 2001, 2008; Eisenhardt; Audretsch)。Research Policy / Industrial and Corporate Change の peer reviewer。BZM proposal を、25年分の AE 文献を日本のディープテック・スタートアップスタジオ実務家フレームワークで置き換えようとする競合主張として、学術モノグラフの装いをまとった形で読んでいる。「新しい学術ディシプリン」主張、特に実証ベースが単一企業による 8 件の retrofit ケースに留まる場合には、デフォルトで懐疑的。

**verdict**: yes-if-fixed (条件付き yes) — ただし構造手術が必要。提出された形では、これは強力な実務家＝理論統合であり、モノグラフ級の刊行に堪えうる構成要素（二層非乗算論、σ_SU × R_net × F 分解、experience-ordering を伴う F_cap の F-CES）を含むが、「新しい学術ディシプリン」という主張は AE 文献の精査には耐えない。Proposal は Shane (2004)、Sarasvathy (2008)、Eisenmann (2021) が firm-exists / 個人 founder / post-formation の前提を持ち Before Zero では成立しないと主張するが、Proposal 自身が *case* レベルでは PRS（Shane の用語でいうところの、すでに識別可能な機会＝起業家＝資源バンドル）に依拠しており、ι=none / F=0 を主に ERS の環境条件として扱っており、分析対象としては扱っていない。これは新しい状態空間ではなく、Shane の nascent-entrepreneurship フェーズに日本の institutional overlay（URA/GAP/TLO）とより豊かな readiness ベクトルを重ねたものに過ぎない。「新ディシプリン」の地位を獲得するためには、本書は (a) (ι, F, S0, I) 状態空間が nascent-entrepreneurship + Triple Helix + RBV-of-TTO に還元できない構造的特徴を含むことを証明し、(b) identification audit を通過し（8 retrofit PJ + 7 institutions は Ch 11/25/26 の causal claims にとっての閾値以下）、(c) AE 文献が discovery-vs-creation について 20 年戦ってきた事実（Alvarez & Barney 2007; Davidsson 2015）があるにもかかわらず P(t)=max U(t)（機会創造観）を確定済みの前提として扱うのをやめる必要がある。下記の構造的変更——とりわけ Shane/Sarasvathy/Alvarez に正面から対決する章、pre-registration を伴う prospective-prediction サブセット、そして BZ が nascent + TH + AE を超えて何を加えるのかというより明確な境界画定——を伴えば、AE / TT studies の日本 institutional context サブ分野については field-defining たり得る可能性がある。4 スクールを同時に置き換える独立した新ディシプリンとしては、no。

**new_discipline_recognized**: yes-if-fixed

**Top critiques (severity high/critical):**

- `[critical]` **Book 0 Ch 0.1–0.2 (領土宣言 + 既存スクール限界マップ)**
  - Entrepreneurship が (ι=none ∨ F=0) 上で「undefined」であるという中核主張は、Shane (2004) および nascent-entrepreneurship 文献全体（Reynolds & Curtin PSED I/II; Davidsson 2006; Wright et al. 2007 on academic spinouts）に対するわら人形論法である。Shane の individual-opportunity nexus は *pre-firm 状態を必要としており*、PSED は 1998 年以降 N>1,200 でまさに (ι=latent, F=0→1) 遷移を測定してきた。Sarasvathy (2001, 2008) の effectuation は明示的に pre-firm であり、ネットワークに拡張した場合（Sarasvathy & Dew 2005 on stakeholder commitment）には明示的に非個人的である。Alvarez & Barney (2007) の creation-discovery 論争は *まさに* P(t)=max U(t) の領土についての議論であり——本書は 機会創造観 を Alvarez/Barney/Davidsson 2015 'reflections on opportunity' と関わらずに定義的な move として扱っている。Ch 0.2 の 4 スクール・マトリクスは構造的には正しいが、Entrepreneurship 列の「failure mode」欄（'firm-exists assumption'）は実証的に誤りである。あなたが欲しい領土は存在し、それは *nascent academic entrepreneurship in deep-tech institutional contexts* と呼ばれている。それは刊行可能である。「New discipline」はそうではない。Ch 0.2 を Shane (2004) Ch 4–6、Wright et al. (2007)、Vohora et al. (2004) の critical junctures モデル（これはすでにあなたの Book IV time-series spine に対応しているが、あなたは引用していない）、そして Alvarez & Barney (2007) に対し直接的、行ごとの対決として書き直さない限り、A-journal-adjacent press での最初のレビューラウンドで宣言は焼き払われる。
- `[high]` **Book II Ch 6 + Book 0 Ch 0.3 (PRS = P × R × S 期待値分解 'is not CD regrouping')**
  - Proposal は「E[価値] ≈ P × R × S は CD 再グルーピングではない」と繰り返し主張するが、その理由を一度も示していない。代数的に、P=ceiling かつ Pr(reach) = R × S が与えられれば、これは AE/strategy がすでに用いている標準的な期待値分解（段階的 R&D の real-options framing; Adner & Levinthal 2004; McGrath 1997）*そのもの*である。新規性は以下のいずれかでなければならない: (i) bundled min(TRL,BRL,GRL,SRL,HRL) としての R の *測定* プロトコル——これはあなたが採用した SIP CE2023 政策フレームワークであって、導出したものではない; (ii) experience-ordered F_cap を伴う S=σ_SU × R_net × F の内部 CD——これが真に新規の貢献; あるいは (iii) gating GO=𝟙[σ_SU≥θ_σ]×g_TRL——これは閾値ルールであって期待値分解ではない。Ch 6 は P × R × S の *形式* が標準的であることを正直に認め、新規性を S の内部に位置づける必要がある。さもなくば、レビュアーは乗算形式を temannの real-options + readiness のリブランドと読むだろう。さらに悪いことに、「P(t)=max U(t) 機会創造観」は engaging せずに P に接ぎ木されており、これは AE において *係争中の* 立場である: ディープテックにおける多くの機会は arguably discovered であって created ではないとも言える。max U(t) を操作的定義として扱うことで、本書は分野の半分が拒否する creation-school の形而上学に pre-commit してしまう。
- `[high]` **Book II Ch 7 — F = CES(F_char, F_cap; a=0.6, ρ=-2) experience ordering and committee F_char**
  - これは本書において最も真に独創的な貢献であり、最も防御が薄い部分でもある。(1) a=0.6 はどこから来たのか? 現在の計画は校正を App A.1 に埋もれさせているが、8 retrofit PJ から CES weight を校正することはできない——これは underdetermined（1 パラメータ、8 観測、F_char と F_cap の外生変動なし）。(2) ρ=-2 は σ_substitution ≈ 0.33 を意味する; これは強い実証主張であり、引用されているエビデンス（Y-002, Y-003, 桑折 MTG）は A-journal レビュアーには到底足りない。(3) experience ordering IPO/Exit ≫ 調達リード ≫ PL ≫ 同業界 ≫ 知識 は、よく知られた AE 知見（Beckman et al. 2007 on founder team composition; Eesley & Roberts 2012 on prior experience effects in MIT alumni）と直接矛盾しており、これらにおいては domain experience は deep-tech について financing experience と同等以上に予測力を持つことが多い。Beckman/Roberts/Eesley と正面から engage し、あなたの ordering が異なる理由について日本 institutional な説明をするか、ordering が特に Before-Zero stage に conditional であることを認める必要がある。(4) F_char が「ALQ4 + Grit + Resilience」として——ALQ (Walumbwa et al. 2008) は実質的に批判されており（Antonakis et al. 2016; Alvesson & Einola 2019 'Warning for excessive positivity'）、Grit (Duckworth) はよく知られた meta-analytic effect-size collapse を抱えている (Credé et al. 2017)。これら 3 つの psychometric instrument の上に F_char を構築し、その replication 問題に触れないことは、即座に集中砲火を浴びることになる。
- `[critical]` **Book III Ch 11 + Ch 25 + Ch 26 (BVAR+jump+gate, layer coupling, falsification)**
  - Identification 主張は survivable でない。8 PJ × 月次観測 + 7 institutions × 年次観測では、Minnesota prior 付きの mixed-frequency BVAR であっても、(i) 8 ERS 軸 × 2 PRS outcome (R, S) の causal effect、(ii) Y-001–Y-008 型ショックの jump 成分、(iii) θ_σ 閾値、(iv) g_TRL 関数を identify することはできない——これは機能的には 56 institution-PJ cell（cell 内に大きな自己相関を持つ）に対する数十パラメータの推定である。Coherence audit がすでにこれをフラグしており（Finding 13）、hierarchical-Bayesian shrinkage への正直な reframing を推奨している。同意するが、より強く: Ch 26 の falsification 条件（σ_SU≥θ_σ の生存差分、F-CES rank preservation、ERS weighted-sum vs multiplicative）は retrofit data 上では *テスト不可能* である。なぜならモデルは同じ 8 PJ にフィットされているからだ。これは教科書的な overfit-then-validate-on-training-set である。YD NO_GO の「prospective」主張は 1 観測である。Ch 26 を信頼できるものにするには、(a) ≥30 PJ かつ ≥15 institutions × ≥3 年の pre-registered prospective panel（18 ヶ月タイムラインとは両立しない）、あるいは (b) 一部 PJ を hold out するクリーンな ex-ante / ex-post split に加え、外部検証コホート（例: NEDO/JST データベース、AUTM-Japan TLO サーベイ）が必要。これらのいずれかがなければ、Ch 25/26 は causal claim を成立させることができず、「新ディシプリン」ステータスは「もっともらしいフレームワーク、未検証」へと崩壊する。
- `[high]` **Book III Ch 12–19 (8 PJ retrofit) — single-firm sample, hindsight bias, no comparison group**
  - 8 PJ すべてが AMD 自身のポートフォリオから来ている。これは clinical case series であって、ディシプリン定義主張のための実証ベースではない。AE レビュアーが即座に突くであろう問題は 3 つ: (1) selection bias——AMD がどの deep-tech シーズに engage するかを選んでいる; 選ばれなかったシーズの宇宙（とその顛末）は観測されないため、生存/失敗率は AMD 自身の ex-ante スクリーニングに conditional である。(2) hindsight bias——TIEM が「early-stage」が「too early」だったと判明した後で PRS 値を retrofit することは、まさに Eisenmann (2021) が警告する罠である; レビュアーは *ex-ante* PRS スコア（日付スタンプ付き）と *ex-post* outcome を要求するだろう。Proposal は Ch 26 で「AMD 8 PJ 予測登録ログ」としてこれを示唆しているが、ex-ante 記録を生成することにコミットしてはいない。(3) no comparison group——ERS→PRS の causal claim には、AMD 以外の institutional context からの PJ と、AMD 支援なしで生存した PJ が必要。これがなければ、Book III のすべての「findings」は「AMD のハウススタイルは AMD が選んだケースに対しては機能した」と整合的である。「shadow cohort」章（例: Spiber、PeptiDream、Mirai Genomics 等、公刊された日本のアカデミックスピンアウト事例 5–10 件を同じプロトコルで retrofit）を推奨し、single-firm sample 問題を打破する。

**Recommended strengthenings:**

- Book 0 に新章を追加（または Ch 0.2 を 0.2a/0.2b に分割）: 4 スクールのベスト代表との 25–35pp の正面対決——Shane (2004) Academic Entrepreneurship Ch 4–6、Wright et al. (2007)、Vohora et al. (2004) critical-junctures、Sarasvathy (2008)、Alvarez & Barney (2007) creation-vs-discovery、Eisenmann (2021)、Eesley & Roberts (2012)、Etzkowitz & Leydesdorff (2000)、Bozeman (2000)、Siegel et al. (2003)、Kneller (2007)、Walsh-Cohen-Cho (2007)。それぞれについて、彼らが何を正しく捉え、BZ では何を見落とし、BZM が何を加えるかを精確に述べる——彼らが (ι=none ∨ F=0) 上で「undefined」であるというわら人形論法 *なしに*。貢献を「4 スクールを置き換える新ディシプリン」ではなく、「二層非乗算 readiness モデルを介した、日本 institutional context におけるディープテック nascent academic entrepreneurship の形式化」として正直に位置づける。逆説的だが、これは field-defining 主張を *強化* する。なぜなら本当に新規な部分（F-CES、二層非乗算、R as bundle-min）が呼吸できるようになるからだ。
- Book II Ch 7 (S 内部 CES) を主要な新規性章として指定し、独立した Research Policy 論文であるかのように書く。追加: (i) F_char × F_cap について CES（CD でも線形でも Leontief でもなく）を選ぶ理由の明示的導出、BZ-stage 意思決定制約に紐付けた substitutability の直観; (ii) (a, ρ) について retrofit と明示的な外部検証セットの両方を用いる完全な校正プロトコル; (iii) ρ ∈ [-5, +0.5]、a ∈ [0.3, 0.8] の範囲で結論がどう変化するかを示す sensitivity analysis; (iv) Beckman et al. (2007)、Eesley & Roberts (2012)、Colombo & Grilli (2005) の founder-team experience effects との直接的 engagement と、BZ-stage experience ordering が post-formation ordering と異なる理由についての明示的仮説; (v) ALQ4/Grit/Resilience を、より強い replication track record を持つ尺度で置換または補完するか、psychometric controversy を明示的に承認する。
- Ch 26 を Ch 26a（8 retrofit PJ 上の in-sample fit、検証ではなく校正として正直に framing）と Ch 26b（prospective falsification protocol）に分割する。Ch 26b は pre-registered prediction registry にコミットする——次の 10–15 PJ（AMD 自身 + shadow-cohort partners）を、outcome が観測される前に、タイムスタンプ付きの PRS/ERS スコアと事前指定された GO/WAIT/NO_GO 予測とともに登録する。registry が 18 ヶ月で成熟しなくとも、プロトコルが存在することで falsification 条件は実際にテスト可能となり、科学的真剣さのシグナルとなる。「shadow cohort」methods サブセクションを追加し、公刊された日本のディープテックスピンアウト 8–10 件（Spiber、PeptiDream、Mirai Genomics、TBM 等）を同じプロトコルで retrofit し、single-firm sample 問題を打破する。
- σ_SU の合成/再帰問題を Ch 5 でクリーンな形式論で解決する: σ_SU を国家レベルで定義し、μ_A を集計学術生産性（出版、特許、学会活動——Leydesdorff スタイル）とし、国家 σ_SU が所与の PJ に対する局所的機会窓に変換される様式の *moderator* として institutional ERS が入る別の Ch 5.x または Ch 34.x を追加する。これは hierarchical/multi-level 構造（national σ_SU → institutional ERS → project R/S）であり、AE multi-level 文献（Audretsch et al. 2006; Acs et al. 2009 knowledge spillover theory）がすでに語っている。これは循環性を取り除き、現在 engage していない文献に接続する。
- Coherence audit の推奨に従って実証アンカーを節約配分する。ただし 1 つ追加で: Book III の冒頭に「taxonomy table」を構築し、8 PJ それぞれに primary role を明示的に割り当てる（TIEM=ゾンビ型/早すぎ起業 reference; BWE=健全型/F_cap 補完成功 reference; CTB=鋸歯型/段階補充 reference; YD=即落型/NO_GO reference; CX=R_net 共食い reference; SX=σ_SU 追い風×共食い reference; JC=shallow tech/自走型 reference; CLG=σ_SU 追い風依存型 reference）と secondary role を設定する。その上で Book III 外のすべての章は、各 PJ をその割り当てられた役割でのみ使用する。これは TIEM の過剰登用と CLG の過少登用を同時に解決し、レビュアーに対し章ごとの ad-hoc ケース選択ではなく、防御可能な単一のマッピングを与える。
- 桑折先生 KUTE MTG 2026-06-24 を「万能の primary evidence」から、≥3 institutional types にわたる N≥20 の構造化された日本ディープテック教員インタビュー・プログラムの中の 1 つの（豊かで named な）データポイントへと再構成する。18 ヶ月タイムラインのうち ~3 ヶ月をインタビュー wave 1（≥15 件）に割り当て、トランスクリプトを 桑折 7 軸（出資金/シーズ転用/COI/退路/学生責任/論文-特許順序事故/取締役個人責任）に加え emergent code に対してコーディングする。Inter-rater reliability を報告する。これは本書の単一 MTG への依存を防御可能な質的データセットへと変換し、Book V Ch 32–34 に現在欠けている institutional-design エビデンスを与える。
- Coherence audit の具体的な削減（App A trim、Ch 25 を Ch 11 にマージ、Book III.SU2 normalization、Book 0 Ch 0.3 を宣言のみに）を採用し、加えて audit Finding 14 がすでにフラグしている Book IV 実践章（Ch 31.1–31.3）における formulas の乗算的＝化粧的用法を除去することで、総ページを 750–800 pp まで削減する。引き締まった本ほど自信を持って読まれる; 1015pp は、モノグラフ推薦を検討する編集委員会に対し「何を削るか決められなかった」と signaling してしまう。
- Book 0 の末尾に明示的な「scope statement」を追加する: 「本書は日本の大学および国研 context におけるディープテック nascent academic entrepreneurship についてである。(a) 非日本的 institutional 環境、(b) 非ディープテックベンチャー、(c) 研究機関由来でない corporate spinout、(d) social-mission スタートアップへの一般化はさらなる作業を要する。我々はこのスコープにおいてディシプリン定義的地位を主張するが、entrepreneurship-in-general についてそれを主張するわけではない。」これが「新しい学術ディシプリン」を防御可能にする move である: AE/Innovation/TT/Evolutionary を普遍レベルで置き換えようとするのをやめ、防御可能なサブ領土を切り出し、それを完全に所有する。スコープ内での field-defining は実在する（Audretsch の「entrepreneurial society」はそれを実現した; Wright/Lockett はアカデミックスピンアウトについてそれを実現した）。スコープなしでの field-defining はレビュアーが拒否するものである。

---
## 4. Coherence 監査 (critical / high 問題のみ)

### coherence_audit

**全体所見**: 総ページ数約1015pp — 700-900pp の予算を大幅に超過 (12-31% の膨張); Appendix だけで 270pp あり、本書全体の約30%を占めるため鋭く削る必要がある。数理深度のペース配分は形状として良好 (Book II が Ch 5-11 でピーク; Book IV/V/VI は正しく降下していく) だが、モデルが Book 0 に前倒しされすぎていて Book I Ch 2-4 と冗長性を生んでいる。実証ケースの配分は概ね均等だが、TIEM は約22章で例示として登場し (疲弊リスク)、CLG は 8 アンカー PJ の一つで独自の retrofit 章 (Ch 19) を持つにもかかわらず 3-4 章にしか登場しない。桑折先生 KUTE MTG 2026-06-24 の配置は過剰展開 (20+ 章) — 意図された Book I Ch 4 + Book IV Ch 28 のアンカリングは正しいが、同じ素材が他所でも繰り返し「第一次情報」として引用され、その重みが希釈されている。Book 間 coherence の主要な問題点: (a) GO 式 𝟙[σ_SU≥θ_σ]×g_TRL(t) は Ch 1 と Ch 4.7 で正式な導出地点より前に非公式に導入されている (導出の所属が明確に割り当てられていない — Ch 5? Ch 11? Ch 26 は評価するがどの章も導出を所有していない); (b) 'unknown vs not_started' は ERS の運用上の核心だが Ch 3.5, Ch 24.2, Ch 33 に分散し、正典所有章が無い; (c) Book III Ch 25 (層間結合検証) は causal-coupling 推定を担うが、Book II Ch 11 (BVAR+jump+gate) こそ自然な所属場所 — この二章は内容が大きく重複している; (d) 「失敗類型論の第二世代」(Ch 4.1-4.7 の GO/WAIT/NO_GO/HOLD + 5 鬼門の rubric) は数理 装置 が存在する前に Book I で構築されており、ティーザーとしては機能するが Book II の読者は既に結論を見てしまっていることになる。推奨: Appendix を約100pp 削減、Ch 25 を Ch 11 に統合、Ch 5 を GO 式導出の正典所有章に指定、Ch 3.5 を unknown/not_started の正典所有章に指定、桑折 MTG 引用は最大 6-8 章に配給する。

**critical / high 所見:**

- `[critical]` **全 chunk 合計: Book 0 (64) + Book I.front (50) + Book I.back (70) + Book II.front (70) + Book II.mid (74) + Book II.B (110) + Book III.SU1 (90) + Book III.SU2 (114) + Book III.SU3 (52) + Book **
  - **issue**: 総ページ数約1015 vs 予算 700-900 — 約115-315ページ超過
  - **fix**: 約150pp を削って上限 900pp に着地させる (図版/参考文献用に 200pp の余裕を確保)。具体的な削減: (1) Appendix A (CES/CD/BSDE/Kalman/BVAR/非可換性, 6 sub-chapters) は含意上約120pp — A.6 (二層非可換性) を本来属するべき Ch 9 にインライン移動し、A.4+A.5 を一つの BVAR 章に統合して 80pp にトリム (約20pp 節約)。(2) Book III Ch 25 (層間結合, 55pp) は Ch 11 (BVAR+jump+gate, 110pp chunk のうち約40pp) と重複 — 統合して約30pp 節約。(3) Book III.SU2 (Ch 15-17, 3 ケース retrofit で 114pp) は Book III.SU3 (Ch 18-19, 2 ケースで 52pp) に比して膨れている — SU2 を約75pp に正規化して約40pp 節約。(4) Book 0 Ch 0.3 (二層方法論) は Book II Ch 9 と Ch 11 のフレーミングを重複している — Ch 0.3 を宣言形式のみにトリムして約10pp 節約。
- `[high]` **Ch 0.1, 0.3, 1.4, 2.4, 4.6, 4.7 のアンカー本文は GO を定義済みとして扱っている; Ch 5 (Triple Helix SSM) のアンカーは「σ_SU の生成」と言うが GO 所有を主張していない; Ch 6 (PRS導出) のアンカーは明示的に「ERS を GO に乗法的に**
  - **issue**: GO 式 𝟙[σ_SU≥θ_σ]×g_TRL(t) には正典導出章が存在しない — Ch 1.2/1.4/4.6/4.7 (Book I) で既定として参照され、Ch 25/26 (Book III) で使用されるが、どこも所有していない
  - **fix**: Ch 5 (Triple Helix SSM) を正典導出地点に指定。Ch 5 に明示的アンカー文言を追加: 「σ_SU の生成過程から GO(t,i) = 𝟙[σ_SU≥θ_σ]×g_TRL(t) を導出する。θ_σ の校正・g_TRL の推定は Ch 11、予測力評価は Ch 26 に委ねる。」その上で Book I Ch 1-4 のアンカーの文言を「GO(t,i) = ...」から「GO(t,i) (Ch 5 で導出) ...」に変更して、読者がどこを参照すべきか分かるようにする。
- `[high]` **Ch 11 アンカー: 「ERS は環境変数として案件 R/S の transition speed を rescale; mixed-frequency state-space で月次案件と年次機関を同居」 — Ch 25 アンカー: 「二層構造の causal 結合: ∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を 8 軸別に推定」**
  - **issue**: Book II Ch 11 (BVAR+jump+gate) と Book III Ch 25 (層間結合検証) が重複内容を扱っている — どちらも ∂(ΔR/Δt)/∂ERS_k と institution→project の causal channel を推定している
  - **fix**: 綺麗に分割する: Ch 11 が方法 (BVAR specification, identification, prior elicitation, jump+gate machinery, posterior diagnostics) を所有し、見出し結果としての 8-PJ + 7-institution パネル全体で走らせる。Ch 25 は実質的所見 (どの ERS 軸がどの PRS 成分を最も causal に加速させるか、軸ごとの posterior plot と counterfactual decomposition 付き) に焦点を絞った章にする — 方法は Ch 11 を back-reference する。これにより Ch 25 は 55pp から約30pp に縮小し、方法/所見の分離も綺麗になる。
- `[high]` **Ch 3.5 (unknown と not_started を分ける — 評価の運用核心) で導入; Ch 24.2 (地方単科型 — unknown を not_started と誤読した機関) では章テーゼとして使用; Ch 33 (GAP+URA+EIR) で再適用 (「EIR は無い のか 卒業生経営人材プールが未棚**
  - **issue**: 「unknown vs not_started」は ERS の運用核心と説明されているが、正典 Lv-flag の運用定義が三つの章に分断されている
  - **fix**: Ch 3.5 を正典地点として、full 3-state の運用定義 (confirmed / unknown / not_started + 外部連携補完中) を置く。Ch 24.2 はその上で「定義地点」ではなく「誤読のケース」となる。Ch 33 は Ch 3.5 を明示的に引用する。App B.4 に rater のための区別を運用化した 1 ページのプロトコル sidebar を追加する。各出現箇所で再定義することは避ける。
- `[high]` **Ch 0.1, 0.2, 0.3, 1, 2, 4 (複数), 7, 10, 12, 13, 14, 15, 21 (独自章), 23, 25, 27, 28 (意図されたアンカー), 30, 32, 33, 35, A.6, C で引用 — 約20+ スロットに登場**
  - **issue**: 桑折先生 KUTE MTG 2026-06-24 が 20+ 章で「第一次情報」として引用されており、Book IV Ch 28 の中心としての重みを希釈している
  - **fix**: 高価値の 6-8 引用に配給する: Ch 0.1 (宣言), Ch 4.1 または 4.2 (鬼門導入 — 論文-特許順序事故経由), Ch 21 (工学院大学 KUTE 独自章), Ch 28 (第一歩 — 意図された一次アンカー), Ch 30 (設立期 — 取締役個人責任), Ch 33 (GAP+URA+EIR connection — 機関設計), Ch 35 (政策含意)。他の引用は先行章を経由して間接的に MTG を参照するか、複合的な機関的証拠で置き換えるべき。MTG は繰り返し現れるモチーフであるべきで、万能溶媒であってはならない。
- `[high]` **Ch 25 アンカー; Ch B.1 (Atlas データ仕様 — 8 PJ retrofit 観測台帳) は 8 PJ のみを確認; 機関 ERS パネルは Book III Ch 20-24 によれば 7 機関 (明示 4 + 匿名 3)**
  - **issue**: Book III Ch 25 のアンカーは「∂(ΔR/Δt)/∂ERS_k と ∂(ΔS/Δt)/∂ERS_k を 8 軸別に推定」と主張しているが、パネルデータ (8 PJ × 7 機関 = 56 観測) は 8軸 × 2-outcome × jumps の推定には深刻に underpowered
  - **fix**: 次のいずれか: (a) Atlas パネルを拡張する — 7 機関にわたって追加で約 12 の retrofit PJ を加え、約 20 PJ × 7 機関 = 140 観測に到達させる提案 (識別性は大幅改善); または (b) Ch 25 で推定が hierarchical-Bayesian かつ強い prior を用いる (実質的に pooled estimate への shrinkage) ことを認め、「identified causal estimates」ではなく「illustrative posterior」として再フレーミングする。18 ヶ月のタイムラインを踏まえると (b) の方が誠実。Ch 25 + Ch 26 反証 条件に明示的な限界の議論を追加する。
- `[high]` **App C アンカー: 「Y-005 Cabot 機会逃し — TIEM のシーズ段階で Cabot から打診があったが研究者が論文優先で握り潰し、3 年後に同等技術が他国で実用化された経緯」; Ch 4.6 アンカー: 「TIEM が Cabot からの早期問い合わせに対応できず... 問い合わせ時点では σ_SU が立っていたが、機関側の契約処理速度 (ERS 軸4) が間に合わなかっ**
  - **issue**: App C (やらかし図鑑 全文) の hook は Y-005 Cabot 機会逃し を「研究者が論文優先で握り潰した」と記述しているが、Ch 4.6 / Ch 12 / Y-005 の各所参照では「機関側の契約処理速度 (ERS 軸4) が間に合わなかった」と記述している — 同一ケースに対して二つの異なる causal ストーリーが並走している
  - **fix**: 起草前に Y-005 の causal narrative を決着させる。最も妥当なのは: 両方であった (研究者の論文優先 + 機関側の契約摩擦) というもので、その層化された causation こそが要点である — 単因説明では二層構造が崩壊する。App C の hook を次のように書き直す: 「Y-005 — TIEM のシーズ段階で Cabot からの打診があった際、研究者の論文優先と機関側 (ERS 軸4 契約処理) の速度不足が層をまたいで結合し、3 年後に同等技術が他国で実用化された経緯。本書の二層構造が causal に効くことを示す代表ケース。」その上で Ch 4.6 が層化分析を所有する。
- `[high]` **Ch 26 アンカー: 「AMD 8 PJ 予測登録ログ (TIEM/BWE/CX/SX/CTB/YD/JC/CLG)」 — しかし 8 PJ が retrofit 性質であることから、予測は ex ante 登録ではなく post-hoc である。YD は「UE律速 NO_GO 判定の事前公開と検証」と記述されている**
  - **issue**: Book III Ch 26 (予測パフォーマンスと反証) は三つの反転条件を挙げているが、「σ_SU ≥ θ_σ 案件の生存率が σ_SU < θ_σ 案件と統計的に区別できないなら GO ゲート反証」という条件は予測レジストリが prospective に存在する場合のみテスト可能
  - **fix**: Ch 26 アンカー + App B.1 (Atlas データ仕様) で、どの観測が retrofit でどれが prospective かを明確化する。誠実なフレーミング: 「TIEM/BWE/CX/SX/CTB/JC/CLG = retrofit (post-hoc モデルフィット、検証ではなくパラメータ校正に使用); YD + 見送り案件ウォッチリスト = prospective (登録予測、反証に使用)。反証 条件は prospective サブセット上でのみ意味がある。」これは「学術モノグラフ」としての位置づけにとって credibility-critical な区別である。

---
### empirical_anchor_audit

**Overall (全体所見)**: 8 PJ カバレッジは概ね健全だが、TIEM が 20+ 章で primary/co-primary anchor として登場し過剰露出 (over-anchored)、CLG が 2 章のみで under-anchored。Y-001〜Y-005 は Book I Ch 4 で適切に抽象化され Book IV で実務再登場する構造になっており設計通り。機関 retrofit の命名ポリシーは「明示 4 + 匿名 3」を宣言しているが、Book III Ch 23 で香川大が明示扱い (本体は明示4が NIMS/工学院/愛媛/香川と読める) で fixed model の「明示 4 機関」と整合する一方、匿名 3 (京大/山口大/東京科学大) が複数章で「匿名」と明示されておりラベリングは一貫している。桑折先生 MTG は Book 0/I/III/IV/V/Appendix の 12 章以上に分散しており「全書 spine 的に効く一次情報」としての扱いは強いが、Book I Ch 0.2/Ch 1/Ch 4 で同じ「論文-特許順序事故」が反復され冗長性が出ている。未 anchor の概念データ点として (i) F_char が高位で F_cap 低位の補完成功ケース、(ii) R_net 厳密に負値のクリーンな共食い検出ケース、(iii) F_cap 補完による pivot 成功ケース、(iv) ALQ4 委譲不可性を示す対比ケース、(v) 健全型軌跡 (鋸歯でも即落でもない) の primary case がそれぞれ複数章で「予告/伏線」のみで本格展開されていない点が懸念される。

**Critical / high findings (重大・高優先所見):**

- `[high]` **Book 0.1/0.3、Book I Ch 1/2/2.3/2.5/3.1、Book III Ch 12/20/21/24/24.1/25、Book IV Ch 27/29/30/31.1/31.3、Book V Ch 32、Book VI Ch 35/37、Appendix A.3/A.5/B.1/C**
  - **issue (論点)**: TIEM が 20+ 章で primary または co-primary anchor として登場し過剰露出。Book 0.1/0.3、Book I Ch 1/2/2.3/2.5/3.1、Book III Ch 12 (専属章)、Ch 20/21/24/24.1/25、Book IV Ch 27/29/30/31.1/31.3、Book V Ch 32、Book VI Ch 35/37、Appendix A.3/A.5/B.1/C で primary または強い secondary。読者が『TIEM ばかり』『この本は TIEM の事後解剖か』と感じるリスク。
  - **fix (対応)**: TIEM の専属章 (Ch 12) と Book 0 領土宣言/Book III 層間結合 (Ch 25) と Appendix C やらかし図鑑には残し、Book I 概念章 (Ch 1.3/2.3/2.5)、Book IV Ch 27/29/30、Book V Ch 32 では BWE/CX/SX への置換または『TIEM は Ch 12 詳述、本章は他事例で多様性を担保』と明示。具体的には Ch 2.3 R-bundle min は SX 半導体 (GRL 律速) に主役交代、Ch 30 設立期は CLG (追い風型の設立) を primary に。Ch 29 GAP 期は CTB (鋸歯型 GAP 補充) を primary に。
- `[high]` **Book III Ch 24/24.1/24.2/24.3、Ch 25、Book V Ch 32/33/34、Book VI Ch 36**
  - **issue (論点)**: 機関 retrofit の命名ポリシーは「明示 4 機関 (NIMS/工学院/愛媛/香川) + 匿名 3 機関 (京大/山口大/東京科学大)」で一貫しているが、Book III Ch 24.1/24.2/24.3 で『京大 (匿名)』『山口大 (匿名)』『東京科学大 (匿名)』と機関名を併記しており、これは fixed model の宣言 (匿名) と矛盾する半開示状態。本としての守秘責任と分析的識別性のバランスが曖昧。
  - **fix (対応)**: 二択を本書冒頭 (Book 0 または序文) で明示宣言する必要。選択肢A: 匿名 3 は『研究大学型/地方単科型/統合大型』のタイプ名のみで通し、京大/山口大/東京科学大の実名は一切出さない (一貫匿名)。選択肢B: 全 7 機関を実名公表し、AMD 関係筋への事前同意取得を前提とする。現状の『匿名 (京大)』表記は最悪のハイブリッド。Ch 24.1-24.3 の章 anchor 欄から実名を削除し、Ch 34 地域動態でも『関西産業圏 / 山口瀬戸内 / 首都圏資本市場』の地域記述に止める。
- `[high]` **Book 0.1/0.2/0.3、Book I Ch 1/4/4.1、Book III Ch 12/13/14/21/23/25、Book IV Ch 28/29/30/31.3、Book V Ch 32/33、Book VI Ch 35、Appendix A.6/C**
  - **issue (論点)**: 桑折先生 KUTE MTG 2026-06-24 一次情報が Book 0.1/0.2/0.3、Book I Ch 1/4/4.1、Book III Ch 12/13/14/21/23/25、Book IV Ch 28/29/30/31.3、Book V Ch 32/33、Book VI Ch 35、Appendix A.6/C の 20 章以上で参照されている。これ自体は『一次情報を全書 spine として効かせる』設計と整合するが、同じ 7 論点 (出資金/シーズ転用/COI/退路/学生責任/論文-特許順序事故/取締役個人責任) が複数章で同じ文脈 (たとえば論文-特許順序事故が Ch 0.2/Ch 4.2/Ch 21/Ch 25/Ch 33 で反復) を繰り返し、読者は『また桑折』『また論文-特許』と感じる飽和リスク。
  - **fix (対応)**: 桑折先生 MTG を『専属章』として Book III Ch 21 (工学院大学 KUTE) に一次情報の全文を集約し、他章では論点ごとに 1:1 で割り当てる: (i) 論文-特許順序事故 → Ch 4.2 と Ch 21 のみ、(ii) 出資金/退路 → Ch 28 (先生が第一歩を踏み出すとき) のみ、(iii) 取締役個人責任 → Ch 30 (設立期) のみ、(iv) COI/兼業株式 → Ch 15 (SX 共食い) と Ch 32 (ERS 軸 7 処方) のみ、(v) 学生責任 → Ch 28 のみ、(vi) シーズ転用 → Ch 27 (掘り起こし) のみ。同じ論点が 2 章を超えて anchor になっている箇所は『Ch 21 参照』にポインタ化。

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

**Purpose**: Tier 3 学術モノグラフとして「Before Zero は新しい学術領域である」と上向きに宣言する、中核を支える序章。Entrepreneurship/Innovation Studies/Technology Transfer/Evolutionary Economics の既存スクールが Before Zero を扱えない理由を構造的に示し、PRS × ERS の二層 readiness 方法論を「対象の生存構造と評価目的から数式の形が導かれる」という方法論的主張として打ち出す。URA 実務読者の脱落を許容し、研究者・査読者・後続研究者に向けて領土の境界線を引く。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 0.1 | Before Zero — 領土宣言 | 18 | light | TIEM (透明断熱エアロゲル, 早すぎ起業の代表例) — 研究室外で再現しない素材を抱えて設立した瞬間、Entrepreneurship の教科書が一斉に無力 |
| 0.2 | 既存スクールの限界マップ — なぜ四つのディシプリンは Before Zero に届かなかったか | 22 | medium | Shane (2004) Academic Entrepreneurship: firm-exists assumption の射程限界, Sarasvathy |
| 0.3 | 二層 readiness 方法論 — 数式の形は対象の生存構造から導かれる | 24 | heavy | TIEM retrofit: PRS 内訳 (P 大, R の自社製造軸が穴, S は均衡) と機関側 ERS (匿名京大ケース) を別レイヤーで並べて、二重計 |

**Prior lit engaged**: Shane (2004) Academic Entrepreneurship, Sarasvathy (2001, 2008) Effectuation, Eisenmann (2021) Why Startups Fail / premature scaling literature, Etzkowitz & Leydesdorff (1995, 2000) Triple Helix, Freeman (1987), Lundvall (1992) National Innovation Systems, Bozeman (2000) Effectiveness of technology transfer, Siegel, Waldman & Link (2003) TTO performance, Bradley, Hayter & Link (2013) TTO models review, Nelson & Winter (1982) Evolutionary Theory of Economic Change, Dosi (1988) Sources of technological change, Metcalfe (1998) Evolutionary economics and creative destruction, Cabinet Office SIP CE2023 マルチ・レディネス・レベル枠組み, Mansfield (1995, 1998) Academic research and industrial innovation, Jensen & Thursby (2001) Proofs and prototypes for sale, Aghion, Dewatripont, Stein (2008) Academic freedom and incentives, Hellmann (2007) When do employees become entrepreneurs

**既存 bzm/ 内容再利用**: /Users/masa/projects/AMD/amd-os/pwa/bzm/preface.md の URA の場面と『会社になる前の時間』の言葉遣い (Ch 0.1 冒頭ストーリーの骨格) / /Users/masa/projects/AMD/amd-os/pwa/bzm/why-valuation-fails.md の四つの壁 (Ch 0.2 既存スクール限界マップの一部, 特に DCF が実質 P のみを測っていた点) と『二つの結末』のケース合成 (Ch 0.2 と 0.3 の retrofit ブリッジ) / /Users/masa/projects/AMD/amd-os/pwa/bzm/model-overview.md の二層構造節 (Ch 0.3 二層方法論の核, 判定層と動学層の区別, 戦略余力を 10 本目の軸にしない設計判断, 第一-第三世代の進化系譜) / model-overview.md の三件会議冒頭ストーリー (Ch 0.3 ホワイトボード場面の骨格として再利用可能) / preface.md の章型 (冒頭場面→解説→匿名化実例→章末問い) を Book 0 全章で踏襲

**新規執筆必要**: (1) Ch 0.1 冒頭の『新領域宣言』明示パラグラフ — Tier 3 学術モノグラフとして『Before Zero は新しい学術領域である』を最初の見開きで打ち出す宣言文 (経済学者の判定を踏まえた強い断言). (2) Ch 0.1 BZ 状態空間の形式的定義 — 観測量 (S0, I, ι, F, 制度的構成可能性) を Book I Ch1 への伏線として書き下す. (3) Ch 0.2 四スクール × 四 failure mode マトリクスの新規執筆 — Entrepreneurship/Innovation Studies/TT Studies/Evolutionary Econ それぞれの代表文献を 2-3 本ずつ正面から引用し、BZ への到達距離を測る. これは既存 bzm/ 章に存在しない. (4) Ch 0.2 各スクールから本書が継承する部品の明示 (Triple Helix → σ_SU, Effectuation → non-predictive logic, TTO 文献 → ERS 8軸, Nelson-Winter → population view). (5) Ch 0.3 乗法 vs 加重和の formal derivation — 『なぜ PRS は積で ERS は和か』を生存構造と評価目的から導く一節. why-valuation-fails.md には積の必然性しか書かれておらず、加重和の必然性と二者の対比は新規執筆. (6) Ch 0.3 二重計上回避の line-by-line 規則 — 同じ特許の『達成』面と『機関能力』面の切り分けプロトコル. (7) Ch 0.3 causal direction (institution → project speed) の明示 — 月単位 vs 年単位の時間スケール分離も新規. (8) 桑折先生 KUTE MTG 2026-06-24 一次情報の Book 0 への組み込み (論文-特許順序事故, 取締役個人責任, 学生責任). (9) Y-001 〜 Y-005 やらかし図鑑からの Book 0 用 condensed reference. (10) Book 0 → Book I/II/III への明示的な橋渡し節 (各章末).

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

**Purpose**: Book II の前半として、Book I で概念導入した PRS = P × R × S と Triple Helix 環境動学に、学術モノグラフ水準の数学装置を与える。Ch 5 は σ_SU を産生する Triple Helix を 3 状態の SSM (内閣府SIP CE2023 Coupled Dynamics) として定式化し、Etzkowitz/Leydesdorff の言語社会学的記述から計量可能な状態空間モデルへ橋を架ける。Ch 6 は意思決定理論の標準的期待値分解 E[V] ≈ 賞金 × 到達確率 から出発し、Pr(到達) = R × S への分解、さらに S の内部分解 σ_SU × R_net × F (CES) への接続まで、なぜ「乗法」「三因子」「この順序」かを公理から導出する。両章とも Book I の直観モデルを Book III 実証・Book IV 実務での運用に耐える形式へ昇格させる位置にある。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 5 | Triple Helix 状態空間モデル — μ_A, μ_I, μ_G の Coupled Dynamics と σ_SU の生成 | 32 | derivation | CX, SX, YD, CTB, 桑折先生 KUTE MTG 2026-06-24 |
| 6 | PRS = P × R × S の期待値分解導出 — なぜ積か、なぜ三因子か、なぜこの順序か | 38 | derivation | TIEM, BWE, JC, Y-001, Y-004, Y-005 |

**Prior lit engaged**: Etzkowitz & Leydesdorff (Triple Helix), 内閣府 SIP Coupled Dynamics 2023 (CE2023), Savage / Raiffa 意思決定理論の期待値分解, NASA TRL (Mankins 1995) と SIP 5視点 (TRL/BRL/GRL/SRL/HRL), Sarasvathy (Effectuation, 機会創造観), Christensen / Eisenmann (premature scaling), Kerr-Nanda-Rhodes-Roberts (founder selection), Damodaran (DCF と startup valuation の限界)

**既存 bzm/ 内容再利用**: model-overview.md の「なぜ積なのか — 期待値の標準分解」節、「判定層と動学層 — モデルの二層構造」節、「モデルの進化 — 第一世代→第二世代→第三世代」節は Ch 6 の直観導入と歴史的動機づけにそのまま流用する (Book I で既出のため Ch 6 では再掲せず参照のみ)。p-potential.md の P(t) = max_u U(t) 定義式とTAM/SAM/SOM 三層の証拠の質議論は Ch 6 の P 公理化に転用。r-readiness.md の R 不可逆性、TRL 応用×組織マトリクスの min 演算、Yes/No 観測項目への分解は Ch 6 の R を「確率」ではなく「進捗ストック」として読む論証部分に直接接続。Triple Helix に関する model-overview.md の σ_SU 言及は Ch 5 冒頭の橋渡しに用い、本格的な SSM 定式化は新規。

**新規執筆必要**: Ch 5 では Triple Helix を 3 変量連続時間 SSM として書き下す形式 (状態方程式 dμ/dt = A μ + B u + Σ dW、観測方程式 y_t = C μ_t + ε_t)、安定性条件、結合行列 A の符号制約 (cross-helix positive feedback と self-damping)、σ_SU = f(μ_A, μ_I, μ_G) の集約関数の選び方 (CES vs 線形 vs min)、BVAR 推定の identification 問題と jump 項の必要性、を新規執筆。SIP CE2023 の式と本書記号の対応表を付録 A 候補として準備。Ch 6 では期待値分解の公理化 (linearity / multiplicativity of independent factors / why not additive)、P と R の独立性が成り立つ条件と崩れる条件、Pr(到達) を R と S に分けることの情報理論的意味 (現在位置と燃料が独立な情報)、ERS を案件 GO に乗法的に組み込まない理由を二層分離定理として書き下す、第一世代 (加法) を Cobb-Douglas 統合に置き換えても救えない反例を TIEM retrofit から構成、を新規執筆。両章とも章末問いは判定層と動学層の往復を意識した形式に再設計。

---

### Book II 機構 中盤 — S 内部構造と戦略余力動学 (`book_II_mid_S_dynamics`)

**Book**: book_II / **Pages total**: 74

**Purpose**: Book II 中盤は、PRS のうち最も内部構造の深い S を二章に分けて完全に展開する。Ch 7 は S = σ_SU × R_net × F の三要素分解とその「代替的合成」の構造、特に F の内側だけが CES (ρ=-2) で補完的に折れる二段構えの非対称性を厳密に導出する。Ch 8 はその静的スナップショットを (x, y) 平面上の二時刻競争 S = Pr(τ_x < τ_y) として動学化し、gambler's ruin 問題の系として戦略余力動学を定式化する。フロー条件 (生存条件式 B-R_net≤F) からストック動学 (鋸歯軌跡) への持ち上げが、この二章の方法論的中核である。

**Chapters**:

| Ch | Title | Pages | Math | Empirical |
|---|---|---:|---|---|
| 7 | S の内部構造 — 代替的三要素と補完的二層 F | 36 | heavy | TIEM (早すぎ起業: F_cap=低のまま B 起動), BWE (女性ヘルスケア: σ_SU 追い風と R_net 共食い両面), Y-001 (シリーズ |
| 8 | 戦略余力動学 — S = Pr(τ_x < τ_y) と二時刻競争 | 38 | derivation | CTB (創薬: R_net=0 でも鋸歯型で初到達確率高), YD (波力: UE律速で τ_x 発散・NO_GO 判定の典型), CX (carbon: σ |

**Prior lit engaged**: Walker & Avant / Luthans & Avolio: Authentic Leadership 四次元 (F_char の測定基盤), Duckworth: Grit — passion and perseverance for long-term goals, Connor-Davidson Resilience Scale (CD-RISC), Unger et al. (2011) human capital meta-analysis (経験 vs 知識の事業成果相関), Kaplan, Sensoy, Stromberg: Founder team quality and VC investment decisions, Bernstein, Korteweg, Laws (RCT on AngelList): 創業チーム情報が投資判断を支配する実証, Arrow, Chenery, Minhas, Solow (1961): CES production function, Cobb & Douglas (1928): production function (S 外側の代替的合成の原型), Etzkowitz & Leydesdorff: Triple Helix (σ_SU の理論基盤), 内閣府 SIP CE2023: TRL×BRL×GRL×SRL×HRL bundle (R との連結), Feller (1968) An Introduction to Probability Theory Vol.1: Gambler's ruin problem (S = Pr(τ_x<τ_y) の原型), Karlin & Taylor: First-passage times of diffusion processes, Eisenhardt & Schoonhoven (1990): Founding team and new venture performance, Blank & Dorf: Customer Development (premature scaling 批判の系譜), Marmer et al. Startup Genome: premature scaling 実証, Gornall & Strebulaev: VC value creation and J-curve dynamics, Ries: The Lean Startup (Jカーブ一律適用への批判素材), Goldfarb & Kirsch: Bubbles and Crashes (σ_SU 過熱期の生存歪み)

**既存 bzm/ 内容再利用**: bzm/s-survival.md は Ch 7 のほぼ全骨格を提供する: 分離膜審査会の冒頭ストーリー、生存条件式 B-R_net≤F の導出、三要素テーブル、R_net の「種類で差別しない/純で測る」二注意、F の二層 (Authentic Leadership 四因子 + Grit + Resilience の F_char と IPO/Exit≫調達リード≫PL≫業界≫知識の F_cap)、CES ρ=-2 a=0.6 の数値表 (8×8=8.00 vs 8×1=2.05)、設立を遅らせる選択肢、Jカーブ一律適用批判、二相談ケース、章末問い 8 項目 — これらは Tier 3 monograph 化にあたり数式厳密化と prior lit 引用補強の上で全面再利用。bzm/strategic-slack.md は Ch 8 の骨格を提供する: (x,y) 平面定義、y の五成分、月単位への共通換算、健全性指標 H、鋸歯グラフと軌跡四類型 (健全/ゾンビ/即落/鋸歯)、機能性材料ケース、ライセンス 4 点セットと料率三原則、章末問い — ただし monograph では交渉論/ライセンス料率実務パート (Lv1-4 開示設計・ロイヤリティ 25% ルール等) は実務寄りすぎるため Book IV (Practice spine) Ch 30-31 へ移管し、本章は S = Pr(τ_x < τ_y) の確率論的定式化に集中させる。f6-f8 (slack plane / sawtooth / trajectories) および g24/g25 (pillars / condition) は図版資産として継承。

**新規執筆必要**: Ch 7 では、(1) F の CES が ρ=-2 a=0.6 で確定する根拠を、F_char 委譲不可性と F_cap 補完可性から「補完弾力性 σ=1/(1-ρ)=1/3 < 1」として導出する補題、(2) 外側 CD と内側 CES の非対称が「測定スケールの違い (要素は 0-9 離散、F 内層は連続的経験曲線)」から正当化されることの方法論注、(3) 期待値分解 E[価値] ≈ P×R×S と S 内の CD 再グルーピングが「乗法構造の二重カウントではない」ことの形式的注記、(4) 桑折 MTG の出資金/退路/COI/学生責任を F_char の内在化道徳観 (Authentic Leadership 第4次元) と F_cap の PL責任経験の交点として位置づける節、(5) ALQ4 + Grit + Resilience の心理測定論的妥当性レビュー、を新規執筆。Ch 8 では、(1) S = Pr(τ_x<τ_y) を二次元拡散過程の初通過時刻問題として書き下し、x のドリフト μ_x (R-progress) と y のドリフト μ_y = R_net - B、ジャンプ項 (調達/助成金/有償PoC) を含む SDE 形を定式化、(2) 鋸歯軌跡を piecewise drift + Poisson jump 過程として閉じた式で書き、純 R_net=0 でも τ_y 期待値が長い鋸歯型 (創薬・CTB) で S が下がらないことを定理化、(3) 軌跡四類型を (μ_x, μ_y, jump intensity) パラメータ空間の領域として分類、(4) 健全性指標 H = y/T_remaining が局所マルコフ近似下で生存確率の単調変換になる条件、(5) GO(t,i) = 𝟙[σ_SU≥θ_σ] × g_TRL(t) と本章動学の連結 — ERS が GO に乗法で入らない理由を τ_x のドリフト押上げ効果として再導出、(6) Gen-3 dynamics への接続を新規執筆。両章とも BVAR+jump+gate 推定 (Ch 11) への前方参照を明示。

---

### Book II 機構 後半: ERS 加重和導出, 進化経済拡張, BVAR 推定 (`II-B`)

**Book**: II / **Pages total**: 110

**Purpose**: Book II 後半は、案件レイヤー (PRS 乗法) から機関レイヤー (ERS 加重和) へとレイヤーを切り替えた瞬間に、なぜ数式の形そのものが変わらなければならないのかを方法論的論証として確立する三章である。Ch 9 は ERS 加重和を「補完で動く対象 × 欠損可視化という目的」の両条件から導き、PRS の乗法と並べて二層分離が二重計上禁止に至る筋を完成させる。Ch 10 は進化経済学 (Nelson-Winter ルーティン進化、Triple Helix CD) で BZM を上位理論に接続し、ERS を「機関ルーティンの population state」、σ_SU を Triple Helix の selection environment として書き直す。Ch 11 は二層を同時推定する計量装置として BVAR+jump+gate モデルを提示し、案件 (月次, jump) × 機関 (年次, 緩慢ドリフト) × GO ゲート (σ_SU 閾値) の three-clock structure を identification 問題ごと提示する。本 chunk が確立した方法論枠が、Book III の retrofit 検証で動くことになる。

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

**Purpose**: Book III の入口として、PRS×ERS 二層モデルを「結末の分かった 3 つの自社 PJ」に盲検 retrofit し、モデルが現実の軌跡をどこまで言い当てるかを示す。TIEM は R_internal ゼロ近辺が積構造で全体を潰した「早すぎ起業」の代表として PRS 乗法構造の検証を担う。BWE は σ_SU 高位でも F_char 欠落で停滞した、F-CES 非対称性の立証事例。CX は σ_SU 追い風と R_net の関係、本業との共食いを負の R_net として検出できるかを試す事例。3 章合わせて、retrofit-verification.md で予告した「定性的後悔がスコア差として再現される」「軌跡型が実データで分離する」「線引きが当てはめで磨かれる」を、初めて固有 PJ で具体検証する。

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

**Purpose**: 本チャンクは Book III 実証編の第二束として、AMD 8 PJ のうち SX (半導体)、CTB (創薬)、YD (波力) の三案件を retrofit にかける。三案件は PRS の各因子が「主役」になる構図がそれぞれ異なる — SX は σ_SU 追い風と R_net の本業共食いの綱引き、CTB は鋸歯型軌跡と F-CES (経験順序) と長 R 時間軸、YD は P_UE 律速による NO_GO 判定 — を通じて、二層モデルの予測力と限界を素材ごとに検証する。前章束 (TIEM/BWE/CX) が「早すぎ起業」と「市場形成」と「炭素規制 σ」を扱ったのに対し、本束では「大企業並走時の R_net 計算」「σ 不在下の鋸歯生存」「UE による GO 棄却」という三つの異なる生存条件式の運用を、盲検 retrofit と事前予測の二本立てで突き合わせる。

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

**Prior lit engaged**: Goodhart (1975) 計測が目標に変質する問題, Manzi (2012) Uncontrolled — 政策現場における実験的検証, Tetlock & Gardner (2015) Superforecasting — calibration scoring, Brier, Angrist & Pischke (2009) Mostly Harmless Econometrics — DiD/IV identification, Imbens & Rubin (2015) Causal Inference for Statistics, Henderson & Cockburn (1996) Scale, scope, and spillovers — 機関の能力と製薬産業の生産性, Mowery et al. (2004) Ivory Tower and Industrial Innovation — Bayh-Dole 後の TTO 効果, Lerner (2009) Boulevard of Broken Dreams — 公的VCの効果検証, Kahneman (2011) Thinking, Fast and Slow — hindsight bias, Popper (1959) Logic of Scientific Discovery — 反証可能性, Sarasvathy (2008) Effectuation — 機会創造観に対する予測の難しさ

**既存 bzm/ 内容再利用**: retrofit-verification.md の「軌跡の四型」「blind retrofit」「事前予測へ主役を移す」「見送り案件の事後追跡=対照群」「R/y 線引き検証」の節は、Ch 25 の「機関→案件速度」検証設計(自己選択対策, 対照群構築)と Ch 26 の予測プロトコル設計に直接接続できる。model-critiques.md の経済学者批判1-3(identification 不能/後知恵/自己選択), 批判4(順序尺度), 経営学者批判4(グッドハート), 批判6(べき乗則と外れ値弾き) は Ch 26 の「反証可能性の運用設計」と「予測の評価指標選択」の議論骨格にそのまま流用できる。冒頭の「研究会で三人の批判者に正面から応えた発表者」のシーンは Ch 26 の開幕ストーリーに最適。8 PJ retrofit 章 (Ch 12-19) で確立した結末データと、機関章 (Ch 20-24) の ERS スコアを突き合わせる素材は Ch 25 のパネル構築に直結。

**新規執筆必要**: 機関-案件パネルデータの仕様 (機関 × 年 × 案件レベル, 観測変数: ERS各軸スコア, 案件側 ΔR/Δt, σ_SU 控除後の純機関効果), identification 戦略 (DiD with staggered adoption: GAPファンド採択/URA配置/COI制度改正をイベントとして用い, ERS軸別の効果を分解), 自己選択への対処 (見送り案件の公開情報追跡を対照群化, 機関選択の傾向スコアマッチング), 8軸 × 案件速度の異質性検証 (どの軸が R を押すか / どの軸が S を押すか / どの軸が両方か), 予測登録プロトコル (現在進行中案件 N=? について案件ID・予測スコア・予測軌跡型・予測月数を日付印で凍結→6/12/24ヶ月窓で答え合わせ), 外れ案件解剖手続 (予測外れを「P誤読/R誤読/S誤読/二層誤適用」のどれに帰属するか, 帰属を次世代モデルへの入力に変換), Brier score と calibration plot を本書評価指標として宣言, グッドハート対策の運用ログ仕様 (採点監査ログ, 採点者-受益者分離), べき乗則の外れ値を弾かない例外条項の制度化, AMD 8 PJ 中既に予測登録済みのもの (例: CTB の S 予測, CX の R 予測) の進捗開示。

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

**既存 bzm/ 内容再利用**: bzm/s-survival.md の「早すぎる起業への警鐘」「Jカーブ批判」節は Ch 31.2 の骨格として直接転用可能 (深掘り・拡張のみ要)。同章の F-CES 数値表 (8×8=8.00, 8×1=2.05 等) は Ch 31.1 の F 運用論で再掲し、調達期の実測校正に展開する。bzm/strategic-slack.md の「ロイヤリティはどう決めるか」(イニシャル+ランニング+ミニマム保証, 25%ルール) と「『ライセンスだと買い叩かれる』は本当か」節は Ch 31.3 のライセンス転換経路に転用。鋸歯のグラフ (f7_slack_sawtooth.png) と軌跡パターン (f8_slack_trajectories.png) は Ch 31.2 の Jカーブ批判の視覚的対抗物として再利用する。

**新規執筆必要**: 三点の新規執筆が必要。(1) 希薄化動学の数式化 — F が低いまま調達するときの主導権喪失レート (持分×発言権の同時減耗) を、戦略余力 y の選択肢成分の関数として導出する節 (Ch 31.1)。既存 bzm にはフロー診断はあるが、ラウンド間の動学はない。(2) Jカーブ成立条件の閾値分析 — どの (P, σ_SU, F_cap) 領域で Jカーブが PRS 最大化解になるかを GO 判定 𝟙[σ_SU≥θ_σ] と組み合わせて領域図示する (Ch 31.2)。YD/CX/BWE/JC を平面上にプロットして retrofit する。(3) 計画的閉鎖の手順論 — 桑折 MTG 2026-06-24 の一次情報 (取締役個人責任、学生責任、出資金の取り扱い、シーズ転用) を、撤退の合法的・倫理的手順として構造化する節 (Ch 31.3)。これは BZM 全編で唯一「閉じ方」を扱う場所であり、機関側 ERS の文化・実績軸 (Book V Ch 32) への因果接続を担う。

---

### Book V — 機関側設計 (`book-v-institution-design`)

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