# BZM 本書 BOOK_DECISIONS.md

*位置付け: 本書 (Before Zero Model モノグラフ 940p / 18ヶ月) について、まさが下した設計判断を append-only で蓄積する判例集 (L2)。L1 (BOOK_MASTER_PLAN.md) の不変項を変更する場合、まず本ファイルに judgment / rationale / applies_to_chapters / date / status で entry を作り、その上で L1 を書き換える。*

*初版: 2026-06-27 / source: 2026-06-25 まさ最終決定 + 2026-06-24 桑折 MTG + Book 0-VI 提案 5 経済学者 persona 査読 + 進化経済 Ch 10 OPENER 11 節 major revision + 既存運用反省 5 件*

---

## 1. 運用ルール

### append-only
- 既存 entry は削除・改変しない
- 判断変更は新 entry を append し、旧 entry の status を `superseded` に書き換え (status 書き換えは例外的に許可される唯一の更新)。`supersedes` / `superseded_by` 双方向リンクで明示
- superseded entry は §3 / §4 の位置に残し、§5 History に short reference を append (検索性優先)

### entry 形式 (フィールド)
- `judgment`: 下した判断 (1-3 文)
- `rationale`: なぜそう判断したか (1-5 文、査読所見 / 反省も含む)
- `applies_to_chapters`: 影響する章 / Book
- `date`: YYYY-MM-DD
- `status`: active | pending | superseded
- `supersedes`: D-XXX (新 active entry が旧 entry を取って代わる時)
- `superseded_by`: D-YYY (旧 superseded entry に付ける)

### status の意味
- **active**: 現在有効、L1 は本 entry に従う
- **pending**: まさが先に判断する必要がある開放論点
- **superseded**: 後続 entry によって取って代わられた

### 反省 5 件は §2 に固定 (persistent rules、status 概念対象外)

---

## 2. Persistent rules (反省 5 件)

### R-1: 既存本流 BZM を読まずに古い v3.2 を最新と誤認しない
- 新規セッション初手で `pwa/bzm/COMMANDER_TASKS.md` + `pwa/bzm/` の章 md を必ず読む。`before-zero/theory/` (v3.2) は新規追記しない
- enforced_since: 2026-06-25

### R-2: pwa repo commit で BUILD_VERSION を patch bump
- code / spec 含む commit は `pwa/src/lib/build-info.ts` の BUILD_VERSION を patch bump up。docs / handoff only commit は除外
- enforced_since: 2026-06-25

### R-3: 提案物 / 設計ノート / 本書本文を混同しない
- 本書本文 draft は `pwa/bzm/public-manuscript/` または `pwa/bzm/textbook/` 配下、提案物は `pwa/bzm/2026-06-25_*.md`、進捗は `CHAPTER_*_PROGRESS.md` と分離
- enforced_since: 2026-06-25

### R-4: 学術書翻訳指示は専門用語日本語化方針を最初から明示
- 日本語訳が定着している経済学・統計学用語は必ず日本語化、英語維持は人名・数式変数・略号・journal 名・ある程度定着した固有名詞に限定。詳細は L1 §10 + `pwa/bzm/terminology_glossary.md`
- enforced_since: 2026-06-25

### R-5: セッション初手で task ledger を開く
- 新規セッション初手で `pwa/bzm/COMMANDER_TASKS.md` を開く
- enforced_since: 2026-06-25

---

## 3. Active decisions

### D-001: publishing path をデュアル経路に確定 (Cambridge UP + Research Policy)
- **judgment**: 本書 940p をモノグラフとして Cambridge UP Schumpeter シリーズに投稿、同時に Book II Ch 5/5.5/9/10.4 の load-bearing 定理を約 12k word 論文として Research Policy 特集号巻頭に出す
- **rationale**: 5 経済学者 persona 査読 3 ラウンドで進化経済 NO → 軽微修正に到達、他 4 条件付き受理。Cambridge UP が新領域宣言の home、Research Policy が経験的計量査読を通すルート
- **applies_to_chapters**: 全 Book + 付録
- **date**: 2026-06-25
- **status**: active
- *注: ICC (Industrial and Corporate Change) 第三伴走の追加は P-009 で確定後 D-001 を supersede する*

### D-002: 総ページ 940p / 18ヶ月 / Tier 3 学術モノグラフ
- **judgment**: 総ページ 940p (Book 0=70 / I=110 / II=272 / III=200 / IV=110 / V=90 / VI=60 + 付録 A=70 / B=55 / C=35)、執筆期間 18ヶ月、Tier 3 学術モノグラフ
- **rationale**: 当初 870p の Book II=230p から、Ch 10 OPENER 11 節 72p 化 + Ch 11.5 新設 14p で +42p、Book II 総 272p に。Book III は当初配分 256p から 200p に再縮約 (各章 2-6p 削減)
- **applies_to_chapters**: 全 Book + 付録 (ページ予算)
- **date**: 2026-06-27 (supersedes D-002 旧版の 870p)
- **status**: active
- **supersedes**: (初版なし、初出が 940p)

### D-003: scope を Ch 0.0 で明示限定
- **judgment**: 射程を (a) deep-tech, (b) 日本の大学・国研文脈, (c) Before Zero 段階に明示限定。普遍的アントレプレナーシップ一般理論として主張しない
- **rationale**: 5 経済学者 persona 全員が「scope 限定が領域宣言の擁護可能性を支える」と指摘
- **applies_to_chapters**: Ch 0.0 (front-load), Ch 38 (環を閉じる)
- **date**: 2026-06-25
- **status**: active

### D-004: 中核命題 (load-bearing) の正準オーナー分担 + 前向き登録簿
- **judgment**: 本書の中核を支える形式的対象は (1) 二層非可換性定理 [Ch 9 = ERS 加重和代数 / Ch 10.4 = Theorem 3 Arrow スタイル不可能性 + 系 3.1] / (2) GO 演算子最適停止導出 [Ch 5.5] / (3) F-CES 分解 [Ch 7 形式 + Ch 10.3 ρ Kmenta 識別] / (4) Klepper 入れ子 [Ch 10.5] / (5) Malerba SSI 全射 [Ch 10.6] / (6) Murmann 双方向 coupling [Ch 10.7]。加えて (7) 前向き予測登録簿 [Ch 26b]
- **rationale**: 5 経済学者 persona 全員が「load-bearing 形式的対象なしには新領域宣言不可」。Major revision (2026-06-25) で Ch 10 OPENER が load-bearing 中核に昇格し、進化経済への形式接続 3 つ (Klepper / Malerba / Murmann) が並行理論から真の精緻化への移行根拠
- **applies_to_chapters**: Ch 0.4 (front-load), Ch 5.5, Ch 7, Ch 9, Ch 10.3, Ch 10.4, Ch 10.5, Ch 10.6, Ch 10.7, Ch 26b, Ch 38
- **date**: 2026-06-27 (supersedes D-004 旧版の中核命題 3 つ)
- **status**: active

### D-005: 確定モデル正本所在 (メタ判断)
- **judgment**: PRS = `pwa/design/amd_score.md`、ERS = `pwa/design/institution_readiness.md`、F-CES / σ_SU / GO / S / Theorem 3 / 統合ハザード / 全射 φ / 双方向 coupling / h パラメータ族 / Andrews-Quandt sup-Wald = `pwa/bzm/2026-06-25_book2_evol_econ_major_revision.md` + Book 0-VI 提案 + BZSF が正本。式そのものは正本 md に置き、L1 §4 表は正準オーナー紐付けのみを管理
- **rationale**: 式を L2 にも持つと正本更新時に二重保守。メタ判断 (正本所在) のみ L2 化
- **applies_to_chapters**: 全 Book、特に Ch 2 / Ch 3 / Ch 5 / Ch 5.5 / Ch 6 / Ch 7 / Ch 8 / Ch 9 / Ch 10
- **date**: 2026-06-27
- **status**: active

### D-006: F-CES パラメータ数値を Book 0 / I / III の章アンカーで書かない
- **judgment**: F-CES の (a, ρ) は Book 0 / I / III アンカーで数値固定しない。Ch 7 で形式 + 校正手続き、Ch 10.3 で ρ を Kmenta 識別。事後分布の信用区間 + Cobb-Douglas / Leontief / 加法的への horse-race を提示 (D-032 で posterior 化を独立宣言)
- **rationale**: DSGE persona critical: 「a=0.6, ρ=-2 を Book 0 で fiat 固定すると逆算フィットに見える」
- **applies_to_chapters**: Ch 0.1, Ch 0.3, Ch 0.4, Book I 全章, Book III 全章 (アンカーから数値削除), Ch 7, Ch 10.3, 付録 A.1
- **date**: 2026-06-25
- **status**: active

### D-007: 書き順 — Book II Ch 5 → 5.5 → 10.4 → 9 → 7 → 10.3 → 8 → 10.5 → 10.6 → 10.7 → 10.8 → 10.9 → 10.10 → 11 → 11.5 → 6 → Book III → Book 0 → I → IV → V → VI
- **judgment**: Book II 中核は `Ch 5 → 5.5 → 10.4 (Theorem 3) → 9 (ERS 加重和) → 7 (F-CES 形式) → 10.3 (ρ Kmenta) → 8 → 10.5 (Klepper) → 10.6 (Malerba) → 10.7 (Murmann) → 10.8 (ファジー境界) → 10.9 (試験) → 10.10 (統合) → 11 → 11.5 → 6`、全体は Book II 中核 → Book III → Book 0 → I → IV → V → VI → 付録
- **rationale**: Ch 10 OPENER が load-bearing 中核に昇格、Ch 10.4 Theorem 3 を Ch 9 ERS 加重和より先行させて Arrow スタイル骨格を立てる。Ch 6 PRS 期待値分解は Ch 7/8/9 で S 内部を展開した後の方が整合的
- **applies_to_chapters**: 全 Book
- **date**: 2026-06-27 (supersedes D-007 旧版)
- **status**: active

### D-008: 章型 = 章頭ストーリー → 解説 → 匿名化実例 → 章末の問い
- **judgment**: 4 要素章型。例外は L1 §11 参照 (Book II load-bearing 章 / Ch 10 OPENER 11 節 / Book III 機関章 / Book VI 宣言章)
- **rationale**: 2026-06-13 章割で確定
- **applies_to_chapters**: 全 Book + 付録 C
- **date**: 2026-06-13
- **status**: active

### D-009: 専門用語日本語化方針宣言
- **judgment**: 日本語訳が定着している経済学・統計学用語は必ず日本語化。英語維持は人名・数式変数・略号・journal 名・ある程度定着した固有名詞のみ。1:1 対応表は `pwa/bzm/terminology_glossary.md` に切り出して保守 (L1 は方針宣言のみ)
- **rationale**: R-4 から派生。Tier 3 学術モノグラフの日本語学術界読者層への筆致統一。訳語選択の文脈揺れは許容
- **applies_to_chapters**: 全 Book + 付録
- **date**: 2026-06-25
- **status**: active

### D-010: PJ ケース割当て + TIEM 露出制限
- **judgment**: TIEM = Ch 12 主 / BWE = Ch 13 主 / CX = Ch 14 主 / SX = Ch 15 主 / CTB = Ch 16 主 / YD = Ch 17 主 / JC = Ch 18 主 / CLG = Ch 19 主。**TIEM の他章露出は Ch 4 / Ch 26 / Ch 37 / 付録 C のみに限定** (付録 C は Y-001/Y-004 完全展開のため露出制限対象外)
- **rationale**: 監査所見 5: TIEM 過剰露出が本書全体を premature scaling 事例集に見せる
- **applies_to_chapters**: Ch 4, Ch 12-19, Ch 26, Ch 29, Ch 30, Ch 37, 付録 C
- **date**: 2026-06-25
- **status**: active

### D-011: 機関ケース割当て + 暫定 type 名のみ匿名化
- **judgment**: 機関ケース割当ては Research-Org-Type = Ch 20 / Private-Engineering-Univ-Type = Ch 21 / Regional-National-Univ-Type 群 = Ch 22 / Integrated-Large-Univ-Type = Ch 23 / International-TTO-Type = Ch 24 (新設)
- **rationale**: 機関匿名化方針本体は D-034 で独立判決
- **applies_to_chapters**: Ch 0.0, Ch 20-24
- **date**: 2026-06-25
- **status**: superseded
- **superseded_by**: D-034 (匿名化方針部分のみ supersede、ケース割当て骨格は D-034 に引き継がれ active)

### D-012: 桑折 KUTE MTG 2026-06-24 一次情報の正準オーナー = Ch 21
- **judgment**: 桑折先生 MTG 一次情報の正準オーナーは Ch 21。7 論点 (出資金 / シーズ転用 / COI / 退路 / 学生責任 / 論文-特許順序事故 / 取締役個人責任) を Ch 21 で完全展開、他章は pointer 形式で書き一次情報を二重露出しない
- **rationale**: 監査所見 7: 桑折 MTG 論点が分散露出すると一次情報の整合性が崩れる
- **applies_to_chapters**: Ch 21 (集約), Ch 28, Ch 30, Ch 32, Ch 33
- **date**: 2026-06-25
- **status**: active

### D-013: やらかし図鑑 Y-001〜Y-005 確定
- **judgment**: Y-001 (シリーズ A 命名) / Y-002 (CTO 非開示) / Y-003 (CEO 中間管理職化) / Y-004 (早すぎる拡大) / Y-005 (Cabot 機会逃し) を付録 C 確定。Y-006/Y-007/Y-008 は P-007 で個別判断
- **rationale**: Y-001〜Y-005 は既に複数章の後付け校正で参照されており、本書骨格として固定可能
- **applies_to_chapters**: Ch 4, Ch 12 (Y-001/004), Ch 23 (Y-002/003), Ch 11 (Y-005), 付録 C
- **date**: 2026-06-25
- **status**: active

### D-014: 章単位 6 ステージ pipeline + Tier B 追加ステージ
- **judgment**: (1) 節 skeleton → (2) まさ確定 → (3) 段落 outline → (4) 段落 draft → (5) 5 経済学者 persona adversarial verify → (6) まさ段落確定 + BUILD_VERSION bump + commit。Tier B 章 (Ch 10.9, Ch 26b) では追加で OSF 事前登録 + 事前コミット効果量登録 + 反証ルール公開をデータアクセス前に必須化
- **rationale**: 査読プロセスを章執筆 in-loop に組み込む + Tier B 信頼性革命規律
- **applies_to_chapters**: 全 Book + 付録、追加ステージは Ch 10.9 / Ch 26b 限定
- **date**: 2026-06-27 (supersedes D-014 旧版)
- **status**: active

### D-015: 3 層 md フレーム + terminology_glossary 補助
- **judgment**: L1 (BOOK_MASTER_PLAN.md) / L2 (BOOK_DECISIONS.md) / L3 (CHAPTER_<n>_PROGRESS.md) + 補助 `pwa/bzm/terminology_glossary.md` (用語 1:1 対応表)
- **rationale**: セッションをまたいで方向ドリフトを防ぐ。用語表は L1 から分離して保守
- **applies_to_chapters**: 全 Book + 付録 (運用 doc)
- **date**: 2026-06-27
- **status**: active

### D-016: 後付け校正 vs validation の用語分離
- **judgment**: 「後付け校正 (retrospective calibration)」と「validation (検証)」を厳密分離。Ch 26a は「校正」のみ、Ch 26b は前向き登録簿で deliverable は登録簿プロトコル設計まで
- **rationale**: DSGE / 経験的計量 persona critical: 8 PJ 後付け校正を validation と呼ぶと領域主張の信頼性が崩壊。D-031 (Tier 階層分離) と D-033 (置換関係) の用語規律の起源
- **applies_to_chapters**: Ch 26a, Ch 26b, Ch 37, 付録 B
- **date**: 2026-06-25
- **status**: active

### D-017: Ch 24 国際比較章を新設 (新設のみ active、対象機関は P-002)
- **judgment**: Ch 24 国際比較章を Book III に新設、12p (新規 page budget)。対象機関は P-002 で確定
- **rationale**: 監査批判 persona 3 強化提案 6: scope 限定 (日本) の擁護のため非日本機関 1 件の後付け校正が必要
- **applies_to_chapters**: Ch 24 新設, Ch 0.0 (scope 宣言で Japan-particular を明示)
- **date**: 2026-06-25
- **status**: active

### D-018: Ch 25 を識別から所見提示に縮小
- **judgment**: Ch 25 を「∂(ΔR/Δt)/∂ERS_k を識別する」方法章から「強い事前分布下の記述的事後分布、illustrative であって識別されていない」所見提示章に縮小、14p (Tier A)
- **rationale**: DSGE persona critical: 56 セルで 40+ 構造パラメータ識別は構造的に不可能
- **applies_to_chapters**: Ch 25 (Tier A 確定), Ch 11
- **date**: 2026-06-25
- **status**: active

### D-019: Ch 37 真正面比較を新設 (Tier B)
- **judgment**: Ch 37 (BZM vs Triple Helix vs Effectuation vs Nelson-Winter vs Bozeman) を Book VI に新設、20p。共通スコアリング規則 = 24ヶ月 outcome class log-loss (Tier B)
- **rationale**: 監査批判 persona 1+2: BZM が dominate しなかった場合の reporting policy なしでは advocacy tract に見える
- **applies_to_chapters**: Ch 37 新設, Ch 0.4 (front-load 予告)
- **date**: 2026-06-25
- **status**: active

### D-020: Ch 32 (運用者向け) と Ch 36 (funder/政策向け) の射程分離
- **judgment**: Ch 32 = 運用者向けプレイブック (Atlas 8 軸 × Lv1-5 × 凹みパターン処方)、Ch 36 = funder / 政策向け、機関横断比較可能 KPI を Goodhart's Law 回避しつつ設計
- **rationale**: 監査所見 15: 読者層と方法が異なるのに混在
- **applies_to_chapters**: Ch 32, Ch 36
- **date**: 2026-06-25
- **status**: active

### D-021: Ch 11 BVAR の方法的格下げ + Tier A 化
- **judgment**: Ch 11 = h パラメータ族の h↑∞ 境界事例として再アンカリング、「強い事前分布下の事後分布要約と honest 不確実性」と TOC 表記。Tier A に明示分類
- **rationale**: DSGE persona critical: 56 セルで 40+ パラメータ BVAR は識別不能、Minnesota prior は persistence へ shrink するだけ
- **applies_to_chapters**: Ch 11, Ch 10.8, Ch 25, 付録 A
- **date**: 2026-06-27 (旧 D-021 + Tier A 化 + TOC 表記変更を統合)
- **status**: active

### D-022: 0.2b 未engage 文献群を新設
- **judgment**: Ch 0.2b を新設、10p。Reynolds-Curtin PSED I/II / Stam-van de Ven entrepreneurial ecosystems / Cohen-Levinthal absorptive capacity / Teece dynamic capabilities を未engage 文献として処理
- **rationale**: 監査批判 persona 2+4: 四スクールだけでは未engage 文献の網羅性が示せず、PSED nascent panel literature 重複疑念を招く
- **applies_to_chapters**: Ch 0.2b 新設, Ch 0.2a, Ch 0.3, Ch 3, Ch 7, Ch 10 (依存先)
- **date**: 2026-06-25
- **status**: active

### D-023: σ_SU の Triple Helix CD 再定式化を新領域宣言アンカーに
- **judgment**: σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1 (Triple Helix Cobb-Douglas) を Ch 5 が担う。Leydesdorff 2003/2008 + Park-Leydesdorff 2010 mutual information T(AIG) との cross-walk を Ch 5.1 に
- **rationale**: DSGE persona: Triple Helix CD 再定式化が最も真に新規、Ch 5 を SSM として担うのであれば領域主張のアンカーになる
- **applies_to_chapters**: Ch 5, Ch 10 (進化経済への寄与の一つ目)
- **date**: 2026-06-25
- **status**: active

### D-024: Ch 8 (x,y) 確率過程を 2D jump-diffusion で明示
- **judgment**: (x, y) を「drift μ_x(R), μ_y(R_net - B), Brownian Σ, jump intensity λ_x(σ_SU, ERS) と λ_y(B-ショック, Y-001/004/005 級イベント) の 2D jump-diffusion」と明示。Pr(τ_x < τ_y) は Monte Carlo、賭博者破産は stylized スカラー極限
- **rationale**: DSGE persona high: Ch 8 は diffusion / Markov chain / heuristic を混在、どれが primitive か不明
- **applies_to_chapters**: Ch 8, 付録 A
- **date**: 2026-06-25
- **status**: active

### D-025: y 5 成分集約 rule
- **judgment**: y の 5 成分 (cash / moat / trust / options / focus) → スカラー y を CES (F-CES と同じ厳密さで elicitation) で指定。または aggregation が制約付きで fiat に加法的であることを誠実に認める
- **rationale**: DSGE persona high: aggregation rule なしでは S は本書が計算しない量の名前
- **applies_to_chapters**: Ch 8, 付録 A
- **date**: 2026-06-25
- **status**: active

### D-026: BWE 健全型主要参照昇格 + CLG 追い風依存型主要参照昇格
- **judgment**: BWE = Ch 13 健全型主要参照 (F-CES 補完成功)、CLG = Ch 19 追い風依存型主要参照 (σ_SU 高 → R_net 立たず F_char 摩耗)
- **rationale**: D-010 TIEM 露出制限の代替として釣り合いを取る
- **applies_to_chapters**: Ch 13, Ch 19, Ch 7, Ch 5, Ch 8, Ch 30, Ch 31.3, Ch 32
- **date**: 2026-06-25
- **status**: active

### D-027: SX = R-bundle min (GRL 律速) 主要事例
- **judgment**: SX を Ch 2.3 R-bundle min (GRL 律速) 主要事例。COI / 兼業株式論点は Ch 32 pointer
- **rationale**: 監査所見 5: R-bundle min 主要事例が不在
- **applies_to_chapters**: Ch 2.3, Ch 15, Ch 32
- **date**: 2026-06-25
- **status**: active

### D-028: CTB = Ch 29 GAP 期主要事例 + Ch 8.4 鋸歯型
- **judgment**: CTB を Ch 29 GAP 期主要事例 + Ch 8.4 鋸歯型 + Ch 7.5 F_cap 経験順序
- **rationale**: 監査所見 5: Ch 29 で CTB を主要事例化、鋸歯型典型
- **applies_to_chapters**: Ch 16, Ch 29, Ch 8.4, Ch 7.5
- **date**: 2026-06-25
- **status**: active

### D-029: JC = 自走型主要参照
- **judgment**: JC を Ch 18 で自走型主要参照 (σ_SU 低 / F 高 / R_net 早期)。浅技術型固有構造は Ch 22 pointer
- **rationale**: 監査所見 3: 自走型主要参照不在
- **applies_to_chapters**: Ch 18, Ch 22
- **date**: 2026-06-25
- **status**: active

### D-030: YD = Ch 26b 前向き登録簿アンカーケース
- **judgment**: YD (波力、UE 律速 NO_GO、即落型) を Ch 26b 前向き登録簿アンカーケース。NO_GO 判定の日付印付き公開記録 1 例を登録簿に登録
- **rationale**: 監査批判 persona 全 4: 予測登録簿の deliverable 化が credibility 唯一最高レバレッジ。kWh コスト試算根拠が明示的で prototype として最適
- **applies_to_chapters**: Ch 17, Ch 26b, 付録 B
- **date**: 2026-06-25
- **status**: active

### D-031: 実証主張の Tier 階層分離 (DSGE persona 4 条件 #4)
- **judgment**: Tier A (記述的類型論) と Tier B (識別された経験論) を厳密分離。Ch 11, Ch 12-24, Ch 25, Ch 26a = Tier A (「校正」「記述的事後分布」「illustrative」のみ、validation / 識別主張禁止)。Ch 10.9, Ch 26b, Ch 37 = Tier B (「前向き予測」「事前登録」「Andrews-Quandt sup-Wald」「ファジー RD identification」、OSF 事前登録必須)
- **rationale**: DSGE persona 4 条件第 4 条件への構造手術。D-016 用語分離を構造原理に格上げし、Ch 11/Ch 25/Ch 26a/Ch 26b にまたがる用語規律を本書全体の不変項として L1 §3.5 + §16 で固定
- **applies_to_chapters**: Ch 10.9, Ch 11, Ch 12-25, Ch 26a, Ch 26b, Ch 37, 付録 B
- **date**: 2026-06-27
- **status**: active

### D-032: F-CES を事後分布 (Bayesian posterior) として推定
- **judgment**: Ch 7 + Ch 10.3 で a, ρ を Bayesian posterior として推定。事後分布の信用区間 + Cobb-Douglas / Leontief / 加法的への horse-race を提示。posterior は (P, F, B) と独立に elicitate される事前分布から導出。点推定で報告しない
- **rationale**: DSGE 4 条件 #3 (F-CES 事後分布化)。D-006 が数値固定回避までしか言及していないので、posterior 化を明示宣言
- **applies_to_chapters**: Ch 7, Ch 10.3, 付録 A
- **date**: 2026-06-27
- **status**: active

### D-033: 前向き予測登録簿による validation 主張の置換関係
- **judgment**: Ch 26a 後付け校正は「校正のみ、validation 主張なし」、validation 主張は Ch 26b 前向き登録簿に全面譲渡。8 PJ 後付け校正を「validation」と呼ぶ叙述を本書全体から禁止
- **rationale**: DSGE 4 条件 #1 (前向き予測登録簿への置換)。D-016 を構造的置換関係に格上げ
- **applies_to_chapters**: Ch 11, Ch 26a, Ch 26b, Ch 37, 付録 B, 全 Book (叙述禁止ルール)
- **date**: 2026-06-27
- **status**: active

### D-034: 機関匿名化方針の暫定運用 (supersedes D-011 匿名化部分)
- **judgment**: P-001 解決まで全 7 機関を type 名のみで通す。L1 §8 機関ケース割当て表でも実機関名 (NIMS / KUTE / 愛媛 / 香川 / 京大 / 山口大 / 東京科学大) を露出せず、type 名 (Research-Org-Type / Private-Engineering-Univ-Type / Regional-National-Univ-Type 群 / Integrated-Large-Univ-Type / International-TTO-Type) のみで言及。実機関名は L2 ledger (本ファイル) と内部メモのみで保持。P-001 解決時に再 supersede 予定
- **rationale**: DSGE persona: semi-state な匿名化は擁護不能、完全 identification か完全 typological のどちらかにコミット必要。append-only ルール下で「暫定 active」状態を明示的に独立判決化。2026-06-27 まさ追認: 本書執筆全期間で type 名のみ運用、P-001 解決時に再判断する立場で確定
- **applies_to_chapters**: Ch 0.0, Ch 20-24, L1 §8
- **date**: 2026-06-27
- **status**: active
- **supersedes**: D-011 (匿名化方針部分のみ)

### D-035: Klepper 入れ子化の形式接続
- **judgment**: 統合ハザード `h(t,n;θ) = 𝟙{t<τ_B}·h_pre + 𝟙{t≥τ_B}·h_post` (Klepper 1996/2002) + 命題 4 (F_char→1 極限で Klepper に縮退) + 命題 5 (τ_B での Δlog h 符号条件 = Var[F_char|survived]·ρ_F-CES vs α_1·N(τ_B+))。系: Klepper の industry life-cycle hazard 推定値は [0, τ_B] 上の h_pre の面積分だけ下方バイアス。正準オーナー = Ch 10.5
- **rationale**: 進化経済 persona が NO → 軽微修正に動いた最大要因の一つ。Klepper を BZM の特別事例として入れ子化することで並行理論から精緻化に移行
- **applies_to_chapters**: Ch 5, Ch 7, Ch 8, Ch 10.5, 付録 A
- **date**: 2026-06-27
- **status**: active

### D-036: Malerba SSI 全射埋め込みの形式接続
- **judgment**: 全射 `φ: {1..8} → 2^{K,A,I,D,T}` (命題 5.M カバレッジ) + レーン添字付け重み w(L), L ∈ {Deep-tech, Bio, Material} + 事前コミット符号制約 w_2(Bio) > others / w_8(Material) > others / w_6(Deep-tech) > others (Klevorick-Levin-Nelson-Winter 1995 三つ組経由) + 系 5.NW (ERS = N-W 選抜の pre-firm 双対)。正準オーナー = Ch 10.6
- **rationale**: BZM がレーン横断で Wald 検定可能になる根拠
- **applies_to_chapters**: Ch 3, Ch 10.6, Book III セクターレーン章, Ch 32
- **date**: 2026-06-27
- **status**: active

### D-037: Murmann 双方向 ERS-PRS coupling の形式接続
- **judgment**: 命題 10.6.3 (η_jt VAR(1) + Ψ·N_jt フィードバック) + 定理 10.6.5 (τ_B での B 卒業数ファジー RD による Ψ identification, Murmann 2003 言語的逆因果交絡を破る) + 系 10.6.4 (Granger リードラグ Cov(η^k_{j,t-1}, ΔPRS_{j,t})>0)。正準オーナー = Ch 10.7
- **rationale**: BZM が 並行理論 から 真の精緻化 へ移行した中核成果
- **applies_to_chapters**: Ch 5, Ch 8, Ch 3, Ch 9, Ch 10.7, Ch 22 (地域双対), Ch 34, 付録 A
- **date**: 2026-06-27
- **status**: active

### D-038: F-CES ρ Kmenta 識別 (C2)
- **judgment**: F-CES 委譲不可能コアを公理から Kmenta-1967 二次モーメント識別へ格下げ。命題 1 (sign(ρ)=sign(δ_3), ρ̂=2δ̂_3/[α̂(1-α̂)]) + 系 1 (P(ρ<0|data)≥0.95 → Inada コーナー / P(ρ≥0)>0.05 → Nelson-Winter 復権) + 事前登録 H_C2: ρ<0。正準オーナー = Ch 10.3
- **rationale**: 進化経済 persona 最重要修正要求。本書最大の構造手術、ρ を事前登録可能化することで Tier B 試験 (Ch 10.9 / Ch 26b) のアンカーになる
- **applies_to_chapters**: Ch 7, Ch 10.3, 付録 A
- **date**: 2026-06-27
- **status**: active

### D-039: Theorem 3 Arrow スタイル不可能性 (C3) 正準オーナー = Ch 10.4
- **judgment**: 4 公理 (A1 PRS 消滅 / A2 ERS 単調性 / A3 因果チャネル制限 ∂f/∂A_k = (∂f/∂R)(∂R/∂A_k) + (∂f/∂S)(∂S/∂A_k) / A4 連続性) + 系 3.1 (Simpson 反転 / 四分位不安定性 / Hausman 棄却) + N-W スカラー適合度復権条項。Ch 9 (ERS 加重和代数) を受けて不可能性定理化、両章の役割分担は L1 §16 で明示
- **rationale**: D-004 で「中核命題 3 つ」と名前のみだったものを Arrow スタイル不可能性として独立判決化。Cambridge UP 級と進化経済 persona が評価
- **applies_to_chapters**: Ch 9, Ch 10.4, Ch 25, Ch 26
- **date**: 2026-06-27
- **status**: active

### D-040: シャープ → ファジー境界 h パラメータ族 (C6)
- **judgment**: 定義 6.1 (B_h(t) = K((t-t*_mid)/h), Gaussian-CDF or logistic) + 命題 6.1 (シャープな C1 = lim h↓0, Ch 11.5 滑らかな極限 = lim h↑∞) + 命題 6.2 (Bai-Perron 1998 多重分断検定で [t*_start, t*_end] を一致推定) + 反証可能主張 F6 (corr(ĥ_i, σ_{ΔPRS,i}) > 0)。正準オーナー = Ch 10.8
- **rationale**: Revision 1 で残った唯一の内的整合性苦情を解消した一手
- **applies_to_chapters**: Ch 5, Ch 10.8, Ch 11, Ch 11.5
- **date**: 2026-06-27
- **status**: active

### D-041: N≈32 試験プロトコル §10.9 前倒し (C7) + Ch 11.5 新設
- **judgment**: 試験プロトコルを Book VI に埋めず Ch 10.9 OPENER 内に前倒し配置。Andrews-Quandt sup-Wald W_n* (観測された π_i で評価、探索しない) + Cox 比例ハザード with time-varying σ_SU × 𝟙{t≥τ_B} 交互作用 + 事前コミット効果量 β̂_3 ∈ [0.4, 1.2] per IQR-σ_SU log-hazard + 機関クロック IV (会計年度境界 / GAP-AMED ゲート / PCT-30m) + コホート設計 (AMD-8 + 機関後付け 7 + 国際 17 = MIT Deshpande / EPFL TTO / ETH Pioneer / Karolinska)。データアクセス前 OSF 事前登録必須。**Ch 11.5 を新設** (14p) し、レジストリ更新メカニズム + N=32 → 64 段階ゲートの運用実装を担う
- **rationale**: 両 persona (進化経済 + モノグラフ編集者) が最も強く要求した一手。Tier B credibility 確保
- **applies_to_chapters**: Ch 10.9 新設, Ch 11.5 新設, Ch 26b, 付録 B, Book VI
- **date**: 2026-06-27
- **status**: active

### D-042: Book II ページ拡張 + Ch 10 11 節 72p 化 + Ch 11.5 14p 新設
- **judgment**: Book II Ch 10 を 30p → 72p (11 節 OPENER 構成、L1 §5 詳細表参照)、Ch 11.5 を 14p で新設、Book II 総 230p → 272p。Book III は当初章別合計 256p から 200p に再縮約 (各章 2-6p 削減)、総ページ 940p に再固定 (D-002 で確定)
- **rationale**: Ch 10 load-bearing 中核昇格を page budget に反映
- **applies_to_chapters**: Book II / Book III ページ予算
- **date**: 2026-06-27
- **status**: active

### D-043: Ch 6 を Book II 中核の最後に位置付け
- **judgment**: 書き順 (D-007) で Ch 6 PRS 期待値分解を Book II 中核の最後 (Ch 11.5 → Ch 6) に位置付け。Ch 7/8/9/10 で S 内部 + 二層構造を展開した後の方が PRS 期待値分解が整合的
- **rationale**: 当初書き順では Ch 6 が Ch 5.5 直後だったが、D-004 で中核命題の正準オーナーが Ch 10 に分散したため、Ch 6 を後置することで前方参照を減らす
- **applies_to_chapters**: Ch 6, Book II 書き順
- **date**: 2026-06-27
- **status**: active

### D-044: ICC 第三伴走の publishing portfolio 拡張案
- **judgment**: §10.6-10.7 (Malerba 全射 + Murmann coupling) を Book III Ch 26b の N=64 試験データ到着後に ICC へ抽出。D-001 の 2 chevron 構造を 3 chevron (Cambridge UP モノグラフ + Research Policy 巻頭 + ICC 第三伴走) に拡張する候補
- **rationale**: モノグラフ編集者 publication_recommendation の三段ポートフォリオ順序
- **applies_to_chapters**: D-001 拡張、N=64 試験データ到着後
- **date**: 2026-06-27
- **status**: pending
- *注: P-009 で確定後、D-001 を supersede する*

### D-045: σ_SU MS-SSM の regime 数 K=3 を Ch 5 で pre-commit + Ch 11 で K∈{2,3,4} horse-race
- **judgment**: Ch 5.3 σ_SU MS-SSM の regime 数を K=3 (S₀ 沈静 / S₁ 中位 / S₂ 三位一体追い風) として Ch 5 で pre-commit。Ch 11 BVAR 推定で K∈{2,3,4} horse-race を AIC / BIC / log-marginal-likelihood で比較。反証可能仮説 F-5.1 として Ch 26b 予測登録簿に事前登録
- **rationale**: K=2 では CX 三位一体 (S₂) と CX 前 (S₁) と YD (S₀) の 3 状態 narrative が分離できず §5.0 章頭フックと §5.6 装置適用が弱まる。K≥4 は識別困難。Ch 5 Kingpin 1 として擦り合わせ確定
- **applies_to_chapters**: Ch 5.3, Ch 5.4, Ch 5.6, Ch 11, Ch 26b
- **date**: 2026-06-27
- **status**: active

### D-046: Cobb-Douglas weight ω を Ch 11 で IV 推定、baseline (1/3,1/3,1/3) は観測等価類の中心として残置
- **judgment**: σ_SU CD の重み ω = (ω_A, ω_I, ω_G), Σω_x=1 を Ch 11 で IV 推定 (政策ショック G への先行効果 / A,I への lag 効果を外生変動として使う)。baseline (1/3,1/3,1/3) は現行 amd_score.md と整合する「観測等価類の中心」として §5.2 で参照、棄却・採択は Ch 11 で実施。領域依存性 (CX/YD/VSX で異なる ω) は反証可能仮説 F-5.5 として Ch 26b に事前登録
- **rationale**: Triple Helix 文献への BZM の貢献 (CD theoretical justification + SIP CE2023 institutional grounding) の頑健性は ω の external validity に依存。baseline 固定では Park-Leydesdorff (2010) との差別化が弱い。Ch 5 Kingpin 2 として擦り合わせ確定
- **applies_to_chapters**: Ch 5.2, Ch 5.7, Ch 11, Ch 26b
- **date**: 2026-06-27
- **status**: active

### D-047: Book II load-bearing 章の証明深さ = スケッチ本文 + 完全証明付録 A
- **judgment**: Ch 5 (§5.1 cross-walk 三定理 / §5.2 識別補題 / §5.3 MS-SSM 命題 / §5.4 命題 5.5) および Book II load-bearing 章 (Ch 5.5 GO 演算子 / Ch 7 F-CES / Ch 9 ERS 加重和 / Ch 10.3 ρ Kmenta / Ch 10.4 Theorem 3 / Ch 10.5-10.8 など) の証明は本文ではスケッチ (5-10 行)、完全証明は付録 A 数学補遺に逃がす。§5.1 冒頭で本方針を pre-commit
- **rationale**: 28p heavy 数学の頁配分上、全証明本文は §5.6 装置適用 demonstration を圧迫し、Triple Helix 文献への貢献 3 点 (§5.7) も短縮を余儀なくされる。Cambridge UP モノグラフの慣例的方針 (証明スケッチ + 詳細付録) とも整合。Ch 5 Kingpin 3 として擦り合わせ確定
- **applies_to_chapters**: Ch 5, Ch 5.5, Ch 7, Ch 9, Ch 10.3, Ch 10.4, Ch 10.5, Ch 10.6, Ch 10.7, Ch 10.8, 付録 A
- **date**: 2026-06-27
- **status**: active

### D-048: Nelson-Winter 選抜環境節を §5.0 末尾 + §5.3 冒頭で 1p 弱に圧縮、本格展開は Book 0 Ch 0.3 へ逆流
- **judgment**: Ch 5 内で Nelson-Winter (1982) 選抜環境を σ_SU の意味論的母体として位置付ける議論は §5.0 末尾 + §5.3 冒頭で 1p 弱 (3-4 段落) に圧縮。Schumpeter → Nelson-Winter → Dosi → Malerba 系譜整理は本格展開を Book 0 Ch 0.3 (進化経済系譜の意味論的母体) へ逆流させ、Ch 5 では参照のみ
- **rationale**: Ch 5 28p heavy 数学の頁配分上、独立節 3p 確保は §5.6 装置適用を圧迫。Evolutionary persona への意味論的 supply は最小限で十分、本格展開は本書序章で先行宣言する方が論理弧が clean。Ch 5 Kingpin 8 として擦り合わせ確定
- **applies_to_chapters**: Ch 5.0, Ch 5.3, Book 0 Ch 0.3
- **date**: 2026-06-27
- **status**: active

---

## 4. Pending decisions (まさ判断待ち)

### P-001: 機関匿名化方針 — type 名のみ vs 個別同意取得後の併記
- **question**: 7 機関すべて type 名のみ (現状 D-034 暫定) か、個別同意取得後に「Private-Engineering-Univ-Type (工学院大学)」のような併記にするか
- **trade-off**: type 名のみは安全だが Ch 21 / Ch 22 一次情報の credibility 担保が弱い。併記は同意プロセスに時間、Cambridge UP 査読圏信頼性は高い
- **input_needed_from_masa**: 桑折先生 + 愛媛大 + 香川大 + 京大 + 山口大 + 東京科学大 への同意取得の現実性。KUTE 桑折先生は同意可能性高そうだが、京大 / 山口大 / 東京科学大 が全拒否時に KUTE だけ実名は形が悪い
- **applies_to_chapters**: Ch 0.0, Ch 20-24
- **date**: 2026-06-25
- **status**: pending

### P-002: 国際比較章 (Ch 24) 対象機関
- **question**: MIT Deshpande Center / EPFL TTO / TU Munich UnternehmerTUM / KIT Karlsruhe / Tsinghua x-lab のうちどれ
- **trade-off**: MIT は公知情報多いがファンドサイズが桁違いで「日本 scope」前提が崩れる。EPFL は規模感が Integrated-Large-Univ-Type に近い。Tsinghua はアジア比較で Japan-particular vs universal 論点に近い
- **applies_to_chapters**: Ch 24
- **date**: 2026-06-25
- **status**: pending

### P-003: Ch 26b 前向き登録簿 18ヶ月以内 ≥20 case 登録 commitment の現実性
- **question**: DSGE / 経験的計量 persona が「>=20-30 ケースの事前登録」を要求、18ヶ月 window 内で AMD + KUTE + 協力機関で実際に >=20 active ケース登録可能か
- **trade-off**: 可能なら領域宣言 credibility 一気に進む。不可能なら Ch 26b を「登録簿プロトコル設計」までに縮小 (D-016 保険)
- **applies_to_chapters**: Ch 26b, 付録 B
- **date**: 2026-06-25
- **status**: pending

### P-004: Ch 21 (KUTE) を N≥15 半構造化インタビュー program の wave-1 にするか
- **question**: wave-1 化するか、桑折 MTG 一次情報 1 件のみで通すか
- **trade-off**: wave-1 化で経験的計量 persona の「実証基盤拡張」要求に応える。18ヶ月並列負担 + 桑折先生以外への同意取得要
- **applies_to_chapters**: Ch 21, Ch 22 / 23 (展開時)
- **date**: 2026-06-25
- **status**: pending

### P-005: ALQ4 / Grit / Resilience の psychometric controversy への対応
- **question**: ALQ4 (Antonakis 2016) / Grit (Credé 2017) controversy について、Ch 7 F-char measurement で (a) 採用しない (b) 限定的採用 + controversy front-load (c) 独自尺度提案、のどれにするか
- **trade-off**: (a) AE persona F_char 操作的定義空疑念、(b) controversy 引用増えるが honest、(c) 工数大
- **applies_to_chapters**: Ch 7, 付録 A/B
- **date**: 2026-06-25
- **status**: pending

### P-006: Ch 37 head-to-head 比較で BZM dominate しなかった場合の reporting policy
- **question**: (a) 領域宣言を「進化的イノベーション研究内の方法論的に統合されたフレームワーク」に和らげる (b) honest 報告 + 領域宣言維持 (c) Ch 37 削除
- **trade-off**: (a) scope 狭めるが査読的安全、(b) credibility 圧力継続、(c) 監査批判 persona 1/2 強化提案を裏切る
- **applies_to_chapters**: Ch 37, Ch 0.4, Ch 38
- **date**: 2026-06-25
- **status**: pending

### P-007: やらかし図鑑 Y-006 / Y-007 / Y-008 確定
- **question**: 付録 C に確定するか、別カテゴリに送るか
- **trade-off**: Y-007 / Y-008 を付録 C に入れると桑折 MTG 一次情報露出が Ch 21 + 付録 C の 2 か所 (D-012 集約点ルールと部分矛盾)。Ch 21 pointer 形式統一の場合、付録 C は外部公知事例で代替要
- **input_needed_from_masa**: 桑折 MTG 6, 7 を Y-007/Y-008 として付録に上げるか、Ch 21 のみで止めるか
- **applies_to_chapters**: 付録 C, Ch 21, Ch 30, Ch 33
- **date**: 2026-06-25
- **status**: pending

### P-008 (分解 → P-008a-e): 進化経済査読軽微修正残課題の個別具体化
- **note**: 旧 P-008 を 5 件に分解、まさが個別判断できるようにする

### P-008a: C1 — N≈32 power calc の目標値とコホート構成
- **question**: AMD-8 + 機関後付け 7 + 国際 17 の N=32 で power 0.8 を達成するか、N=64 段階拡張時の中間 stop ルール
- **applies_to_chapters**: Ch 10.9, 付録 B
- **date**: 2026-06-27
- **status**: pending

### P-008b: C2 — §10.8 kernel (Gaussian-CDF or logistic) identifiability
- **question**: Bai-Perron 多重分断検定で kernel 選択の事前登録ルール
- **applies_to_chapters**: Ch 10.8, 付録 A
- **date**: 2026-06-27
- **status**: pending

### P-008c: C3 — F_char measurement validity (P-005 と統合可能性)
- **question**: ALQ4 / Grit / Resilience controversy 対応との関係 (P-005 と同じ judgement で同時解決するか分離するか)
- **applies_to_chapters**: Ch 7, Ch 10.3, 付録 A/B
- **date**: 2026-06-27
- **status**: pending

### P-008d: C4 — International-17 cohort selection (P-002 と統合可能性)
- **question**: Ch 24 国際比較対象機関 (P-002) と International-17 cohort を統合するか分離するか
- **applies_to_chapters**: Ch 10.9, Ch 24, 付録 B
- **date**: 2026-06-27
- **status**: pending

### P-008e: C5 — Theorem 3 A3 (因果チャネル制限) defense scope
- **question**: A3 の defense を Ch 10.4 内で完結させるか、付録 A で別途展開するか
- **applies_to_chapters**: Ch 10.4, 付録 A
- **date**: 2026-06-27
- **status**: pending

### P-009: ICC (Industrial and Corporate Change) 第三伴走を publishing path に追加するか
- **question**: モノグラフ編集者 publication_recommendation で §10.6-10.7 を N=64 試験データ到着後に ICC へ抽出する三段ポートフォリオ案。D-001 の 2 chevron を 3 chevron に拡張するか、ICC を別 avenue として保留するか
- **applies_to_chapters**: D-001 (publishing path)
- **date**: 2026-06-27
- **status**: pending

### P-010: Ch 9 と Ch 10.4 の正典オーナー分担最終確定
- **question**: 二層非可換性定理の代数バックボーン (Ch 9) と Arrow スタイル不可能性 + 系 3.1 (Ch 10.4) のどちらを load-bearing 中核として読者に示すか。書き順 (D-007) と D-004 中核命題記述に影響
- **note**: 現状暫定で Ch 10.4 → Ch 9 (Arrow スタイル骨格を先に立てる) を採用 (D-007)
- **applies_to_chapters**: Ch 9, Ch 10.4, L1 §6 書き順
- **date**: 2026-06-27
- **status**: pending

### P-011: §10.9 N≈32 試験の OSF 事前登録タイミング
- **question**: AMD パイプライン上の active PJ (AMD-8) は既に観測中、機関後付け 7 + 国際 17 がいつ揃うか不明。事前登録タイミングは (a) AMD-8 のみ先行登録 (b) 全 N=32 を待つ (c) wave 設計で段階登録、のどれにするか
- **applies_to_chapters**: Ch 10.9, Ch 26b, 付録 B
- **date**: 2026-06-27
- **status**: pending

---

## 5. History (supersede された entry の short reference)

- D-002 (2026-06-25, superseded by D-002 2026-06-27 版): 総ページ 870p → 940p
- D-004 (2026-06-25, superseded by D-004 2026-06-27 版): 中核命題 3 つ + 登録簿 → 6 つ + 登録簿
- D-007 (2026-06-25, superseded by D-007 2026-06-27 版): 書き順 Ch 5/5.5/9 先行 → Ch 5/5.5/10.4/9/7/10.3/8/10.5-10 10 先行
- D-011 (2026-06-25, superseded by D-034): 機関匿名化方針の暫定運用を独立判決化
- D-014 (2026-06-25, superseded by D-014 2026-06-27 版): 6 ステージ pipeline + Tier B 追加ステージ
- D-021 (2026-06-25, superseded by D-021 2026-06-27 版): Ch 11 BVAR Tier A 化 + TOC 表記変更

*entry 本体は §3 / §4 の位置に status=superseded のまま残す。*

---

*L2 終端。次の entry は D-045 から、または P-012 から append すること。append-only、既存 entry の改変は status / supersedes / superseded_by の書き換えのみ許可。*

