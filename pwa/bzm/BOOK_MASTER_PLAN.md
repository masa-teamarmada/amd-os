# BZM 本書 Book 0-VI BOOK_MASTER_PLAN.md

*位置付け: 本書 (Before Zero Model モノグラフ 940p / 18ヶ月) の不変項 (L1) を集約する正本。中核命題、確定モデル、章構成、書き順、ケース割当て、専門用語日本語化方針、章間 dependency、page budget、publishing path、章単位 6 ステージ pipeline、実証主張の Tier 階層分離を、セッションをまたいで方向ドリフトを起こさせないために固定する。確定済み判断の判例集は `BOOK_DECISIONS.md` (L2)。章単位の進捗 (節 skeleton, 段落 outline, draft, 査読履歴) は `bzm/CHAPTER_<n>_PROGRESS.md` (L3)。本ファイルは構造変更が発生した場合のみ更新し、書き換えは BOOK_DECISIONS.md に判例として残してからこのファイルに反映する。*

*初版: 2026-06-27 / source: 2026-06-25 まさ最終決定 + Book 0-VI 提案 (`pwa/bzm/2026-06-25_proposal_book0_vi.md`) + 進化経済軽微修正 (`_book2_evol_econ_major_revision.md` Ch 10 OPENER 11 節 72p) + 既存→新章 mapping (`_mapping_existing_to_new.md`)*

---

## 1. ボトムライン

- **総ページ**: 980p (本文 = Book 0 70p + I 110p + II 300p + III 200p + IV 110p + V 90p + VI 72p + 付録 A 70p + B 55p + C 35p)
  - 当初 870p から +70p。Book II Ch 10 が 30p → 72p (進化経済 6 軽微修正課題 + 統合節 + 試験前倒し配置) に拡張、Ch 11.5 を新設 (28p)
  - 2026-07-02 (D-056) で +40p: Ch 9.5 (RT 結合機構、28p) と Ch 37.5 (自己批判とオープンプロブレム、12p) を新設、940p → 980p
- **総期間**: 18ヶ月
- **ターゲット tier**: Tier 3 学術モノグラフ
- **publishing path**: Cambridge UP Schumpeter モノグラフ + Research Policy 特集号巻頭論文 (デュアル) + ICC 第三伴走 (D-035, P-009 で確定後)
- **学術領域宣言**: Before Zero Studies (新サブ領域、進化経済 × イノベーション・システム × 学術アントレ研究 の交差点)
- **査読合意状態 (2026-06-25)**: 5 経済学者 persona のうち 4 (DSGE / IS / 経験的計量 / AE) が条件付き受理、1 (進化経済) が当初 NO → 軽微修正 6 件 (C1-C6) で軽微修正に到達
- **scope (Ch 0.0 で明文化)**: (a) deep-tech, (b) 日本の大学・国研文脈, (c) 法人化以前 (Before Zero) を含む BZ 段階。普遍的アントレプレナーシップ一般理論として主張しない

---

## 2. publishing path

### Cambridge UP Schumpeter モノグラフ
- 本書 940p 全体 (Book 0-VI + 付録 A/B/C) をモノグラフとして投稿
- 査読対応の中軸は進化経済 persona の軽微修正 6 件 + 他 4 persona の条件付き受理に対する構造手術
- 18ヶ月 window 内に完了

### Research Policy 特集号巻頭論文
- Book II Ch 5/5.5/9/10.4 の中核を支える定理 (二層非可換性 Arrow スタイル不可能性、GO 演算子最適停止導出、ERS 加重和導出) を約 12k word 論文として抽出
- モノグラフより先に published prior art として確立 → モノグラフの正統性を補強

### ICC (Industrial and Corporate Change) 第三伴走
- §10.6-10.7 (Malerba 全射 + Murmann 双方向 coupling) を N=64 試験データ到着後に ICC へ抽出
- P-009 で最終確定

---

## 3. 中核命題 (load-bearing) と反証可能仮説

本書が独立の新学術領域 (Before Zero Studies) として成立するためには、以下の形式的対象 + 一つの研究プログラム宣言を生み出さねばならない。

### 中核命題

1. **二層非可換性定理 — 二段階完成 (Ch 9 + Ch 10.4)**
   - Ch 9 = ERS 加重和導出の代数的バックボーン (正準オーナー: 加重和形式)
   - Ch 10.4 = Theorem 3 Arrow スタイル不可能性 (4 公理 A1 PRS 消滅 / A2 ERS 単調性 / A3 因果チャネル制限 / A4 連続性) + 系 3.1 (Simpson 反転 / 四分位不安定性 / Hausman 棄却) (正準オーナー: 不可能性定理 + 反証可能系)
2. **GO 演算子の最適停止導出 (Ch 5.5)** — `GO(t,i) = 𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)` を実オプション最適停止の一次条件として導出。θ_σ* は (P, F, B, レジーム遷移) に対して内生的
3. **F-CES 分解 (Ch 7) + ρ Kmenta 識別 (Ch 10.3)** — 委譲不可能 F_char × 委譲可能 F_cap を CES で結合。Ch 7 は形式定義 + 校正手続き、Ch 10.3 は ρ を公理から Kmenta-1967 二次モーメント識別へ格下げ。事前登録 H_C2: ρ<0 (P(ρ<0|data)≥0.95 → Inada コーナー / P(ρ≥0)>0.05 → Nelson-Winter 復権)
4. **Klepper 入れ子 (Ch 10.5)** — 統合ハザード `h(t,n;θ) = 𝟙{t<τ_B}·h_pre + 𝟙{t≥τ_B}·h_post` + 命題 4 (F_char→1 極限で Klepper に縮退) + 命題 5 (τ_B での Δlog h 符号条件)
5. **Malerba SSI 全射埋め込み (Ch 10.6)** — 全射 `φ: {1..8} → 2^{K,A,I,D,T}` + レーン重み w(L) + 事前コミット符号制約 (w_2(Bio) > others / w_8(Material) > others / w_6(Deep-tech) > others)
6. **Murmann 双方向 ERS-PRS coupling (Ch 10.7)** — 命題 10.6.3 (η_jt VAR(1) + Ψ·N_jt フィードバック) + 定理 10.6.5 (τ_B での B 卒業数ファジー RD による Ψ identification)

### 仮説的第三柱 — RT 結合機構 (D-056、中核命題 1-6 とは Tier を分離)
- 本書は「観測二層 (PRS/ERS) + 結合機構 (RT)」の三項構造を Ch 0.1 で宣言する。貢献の主柱は検証済みの二層観測、**RT は「仮説的機構 + 検証プログラム付きの第三の柱」として明示** (検証済みと主張しない)
- RT の主張の二分: (a) 定義・命題 (成立3条件の形式化 = 証明可能な純理論、Ch 9.5) / (b) 実証仮説 (Ψ_j = Ψ̄ + β·ICT_j 等 → Ch 26b に「ICT 測定開始の事前登録」として登録、β 推定は追補)
- ERS 側接続 (ICT レンズ + 最小サブ軸 + 二重計上ガード) の正本 = `BZSF/rt_roundtable_theory.md` §13.4-13.6 (v0.2)
- 独禁の扱い (D-058): Ch 9.5 の仮定 L Box + 「実務で契約設計する際は専門家と確認」の注意喚起で足りる。書籍のための Tier 規律の留保であり実務ブロックではない (実務適法性は AMD の20超SU実績で担保)。弁護士発注・印刷ゲート追加は不要。

### 前向き予測登録簿 (Ch 26b)
学術領域の実証研究プログラムとして事前登録される deliverable。本書の射程内では「校正」のみ、validation 主張は本書 deliverable 外として後続論文へ譲る。

### 反証可能仮説 (反証されたら本書は死ぬ)
- σ_SU ゲートが GO/WAIT/NO_GO を弁別できない (Brier > 0.25)
- F-CES の単調性が違反される (F_char と F_cap の代替性が ρ ≥ 0 へ動く / H_C2 棄却)
- ERS 加重和形が乗法結合形に予測精度で負ける
- 26b 前向き登録簿で BZM が 4 競合フレームワーク (Triple Helix CD 単独 / Effectuation / Nelson-Winter / Bozeman) に dominate しなかった場合の reporting policy は Ch 37 で公開

---

## 3.5 実証主張の Tier 階層分離 (DSGE persona 4 条件 #4 への構造手術)

本書全体を貫く用語規律として、実証主張を二層に階層分離する。各章は Tier A / Tier B のいずれかに割り当てられ、Tier 間の用語 (校正 / 後付け / 前向き / 検証 / validation) を混用しない。

### Tier A — 記述的類型論 (descriptive typology)
- 該当章: Ch 11 (強い事前分布下の事後分布要約), Ch 12-24 (PJ + 機関後付け校正), Ch 25 (層間結合の記述的所見、識別主張なし), Ch 26a (標本内整合性チェック)
- 許される語彙: 「後付け校正 (retrospective calibration)」「記述的事後分布」「illustrative」「強い事前分布下の事後分布要約」
- 禁じられる語彙: 「validation」「識別された」「因果効果」

### Tier B — 識別された経験論 (identified empirics)
- 該当章: Ch 10.9 (N≈32 試験前倒し、事前登録), Ch 26b (前向き予測登録簿), Ch 37 (真正面比較 共通スコアリング規則)
- 許される語彙: 「前向き予測」「事前登録 (pre-registration)」「Andrews-Quandt sup-Wald」「ファジー RD による Ψ identification」「24ヶ月 outcome class log-loss」
- 反証ルールはデータアクセス前に OSF 事前登録必須

### Tier 間の置換関係 (D-033)
- 8 PJ 後付け校正を「validation」と呼ぶ叙述を本書全体から禁止
- validation 主張は Ch 26a (Tier A) から Ch 26b (Tier B) に全面譲渡

---

## 4. 確定モデル一覧 (FIXED MODEL — Book 0 で fiat 固定する数式パラメータは禁止、章レベル参照のみ)

| 対象 | 形式 | 主出現章 | 正準オーナー md / 章 |
|---|---|---|---|
| PRS | `PRS = P × R × S` (乗法、案件単位) | Ch 2, Ch 6 | `pwa/design/amd_score.md` |
| ERS | `ERS = 100 · Σ w_k A_k / Σ w_k` (加重和、機関単位、軸 7 = precondition) | Ch 3, Ch 9 | `pwa/design/institution_readiness.md` |
| F | `F = CES(F_char, F_cap; a, ρ)` (a, ρ は Ch 7 校正 + Ch 10.3 で Kmenta 識別、Book 0/I/III で数値固定禁止)<br>注: shift +1 形式 `(F+1) = CES(F_char+1, F_cap+1; ...)` は付録 A で零底回避の数値手続きとして導入、本文では shift なし形式を採用 | Ch 7, Ch 10.3 | Ch 7 (形式定義) + Ch 10.3 (ρ 識別) |
| σ_SU | `σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1`, Triple Helix Cobb-Douglas | Ch 5 | Ch 5 (Leydesdorff 2003/2008 mutual information T(AIG) との cross-walk は Ch 5.1) |
| S | `S = Pr(τ_x < τ_y)`, 2D jump-diffusion 上の first passage probability。drift μ_x(R), μ_y(R_net - B), Brownian Σ, jump intensity λ_x(σ_SU, ERS), λ_y(B-ショック, Y-001/004/005 級イベント) | Ch 8 | `BZSF/before_zero_theory.md` + Ch 8 |
| y 集約 | 5 成分 (cash / moat / trust / options / focus) → スカラー y、CES または fiat に加法的 (D-025) | Ch 8 | Ch 8 + 付録 A |
| GO | `GO(t,i) = 𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)` (Ch 5.5 最適停止導出、θ_σ* 内生的) | Ch 5.5 | Ch 5.5 |
| 二層結合禁止 | PRS (乗法、案件) と ERS (加重和、機関) を単一スコアへ乗法結合してはならない | Ch 9 + Ch 10.4 | Ch 9 (代数) + Ch 10.4 (不可能性定理 + 系 3.1) |
| Theorem 3 | Arrow スタイル不可能性、4 公理 A1-A4 + 系 3.1 (Simpson 反転 / 四分位不安定性 / Hausman 棄却) | Ch 10.4 | Ch 10.4 |
| 統合ハザード | `h(t,n;θ) = 𝟙{t<τ_B}·h_pre + 𝟙{t≥τ_B}·h_post` (Klepper 1996/2002 入れ子) | Ch 10.5 | Ch 10.5 |
| 全射 φ | `φ: {1..8} → 2^{K,A,I,D,T}` + レーン重み w(L), L ∈ {Deep-tech, Bio, Material} | Ch 10.6 | Ch 10.6 |
| 双方向 coupling | η_jt VAR(1) + Ψ·N_jt フィードバック + ファジー RD Ψ identification at τ_B | Ch 10.7 | Ch 10.7 |
| h パラメータ族 | `B_h(t) = K((t-t*_mid)/h)` (Gaussian-CDF or logistic)、シャープ (h↓0) と Ch 11.5 滑らかな極限 (h↑∞) を境界事例として包摂 | Ch 10.8 | Ch 10.8 |
| Andrews-Quandt sup-Wald W_n* | 観測された π_i で評価 (探索しない) + 事前コミット効果量 β̂_3 ∈ [0.4, 1.2] per IQR-σ_SU log-hazard | Ch 10.9 | Ch 10.9 |
| 前向き予測登録簿 | 事前登録予測 + スコアリング規則 (24ヶ月 outcome class log-loss) + 反証条件 (Brier > 0.25 等) | Ch 26b | Ch 26b |
| RT / CRL / ICT | RT = keystone 型多者共同体 (定義 + 成立3条件の命題化)。CRL L0-L5 (案件レンズ)、ICT (機関レンズ、ERS 加重和に足さない)。Ψ_j = Ψ̄ + β·ICT_j 分解仮説。**仮説的第三柱 (Tier 分離、D-056)** | Ch 9.5 | `BZSF/rt_roundtable_theory.md` v0.2 + Ch 9.5 |

**重要**: F-CES のパラメータ値 (a, ρ) は Book 0 / Book I / Book III の章アンカーに数値で書かない (DSGE persona critical 指摘 + D-006 への対応)。Ch 7 + Ch 10.3 が正準オーナー。ρ は事後分布 (posterior) として推定 (D-032)、点推定でなく信用区間と Cobb-Douglas / Leontief / 加法的への horse-race を提示。

---

## 5. Book 0-VI 章別 TOC + page budget

### Book 0 — 序章 — Before Zero という領土の宣言 (70p, 6 章)

| Ch | タイトル | p |
|---|---|---:|
| 0.0 | 本書の射程と匿名化方針 — 何を主張し、何を主張しないか | 8 |
| 0.1 | Before Zero 領土宣言 — 状態空間 (ι, F, S0, I) と二層観測 | 14 |
| 0.2a | 四スクールからの継承 — Shane, Sarasvathy, Etzkowitz, Nelson-Winter | 18 |
| 0.2b | 未engage の文献群 — PSED, ecosystems, ACAP, dynamic capabilities | 10 |
| 0.3 | 二層 readiness 方法論 — 宣言形 (導出は Book II) | 12 |
| 0.4 | 本書の貢献の三つ — 何を新規に主張するか | 8 |

### Book I — 領土の定義 — 観測量と典型動学 (110p, 4 章)

| Ch | タイトル | p |
|---|---|---:|
| 1 | 状態空間と観測量 — Before Zero を測るとはどういうことか | 30 |
| 2 | PRS — 天井 × 到達 × 生存の概念体系 | 30 |
| 3 | ERS — 苗床という第二の対象 (含: unknown vs not_started 区別の正準オーナー = Ch 3.5) | 30 |
| 4 | 失敗パターンの抽象 — Book II 数学装置への索引 (前方参照ティーザー) | 20 |

### Book II — 機構 — 数学装置層 (300p, 10 章 + Ch 10 11 節構成) [load-bearing core]

| Ch | タイトル | p |
|---|---|---:|
| 5 | Triple Helix SSM と σ_SU の生成 (Ch 5.1 = Leydesdorff mutual information T(AIG) との cross-walk) | 28 |
| 5.5 | GO ゲートの導出 — 実オプション最適停止からの一次条件 | 18 |
| 6 | PRS = P × R × S — 期待値分解の honest 位置付け | 22 |
| 7 | S の内部構造 — F-CES と委譲不可能コア (形式定義 + 校正手続き) | 38 |
| 8 | 戦略余力動学 — 2D jump-diffusion と τ_x/τ_y、y 5 成分集約 | 32 |
| 9 | ERS 加重和の導出 (二層非可換性定理の代数的バックボーン) | 34 |
| 9.5 | ラウンドテーブル — 二層を結合する組成機構 (仮説的第三柱、D-056。定義・命題 = 純理論 / 実証仮説 = Ch 26b 送り) | 28 |
| 10 | 進化経済学への形式接続 — Klepper / Malerba / Murmann の入れ子化 (11 節 OPENER) | 72 |
| 11 | h パラメータ族の h↑∞ 境界事例 — 強い事前分布下の事後分布要約と honest 不確実性 | 14 |
| 11.5 | §10.9 事前登録試験の運用実装 — レジストリ更新メカニズム、N=32 → 64 段階ゲート | 14 |

#### Ch 10 OPENER 11 節構成 (72p)

| 節 | タイトル | 対応する進化経済修正課題 / 機能 |
|---|---|---|
| 10.0 | プロローグ | 物語的橋渡し |
| 10.1 | 設定 — 6 軽微修正課題 (C1-C6) と本章の射程 | I1 |
| 10.2 | C1 — レジーム切換え B (法人化境界) の formal definition | I2 |
| 10.3 | C2 — F-CES ρ Kmenta 識別 (命題 1 + 系 1 + 事前登録 H_C2: ρ<0) | I3 |
| 10.4 | C3 — Theorem 3 二層非可換性 Arrow スタイル不可能性 + 系 3.1 | I4 |
| 10.5 | Klepper 入れ子 (統合ハザード + 命題 4-5) | I5 系譜橋渡し |
| 10.6 | Malerba SSI 全射 φ + レーン重み w(L) (命題 5.M / 5.L + 系 5.NW) | I5 系譜橋渡し |
| 10.7 | Murmann 双方向 ERS-PRS coupling (命題 10.6.3 + 定理 10.6.5 + 系 10.6.4) | I5 系譜橋渡し |
| 10.8 | シャープ → ファジー境界 h パラメータ族 | I6 |
| 10.9 | N≈32 試験プロトコル前倒し (Andrews-Quandt sup-Wald + OSF 事前登録) | I7 |
| 10.10 | 統合 — BZM = Klepper と Murmann に境界づけられた Nelson-Winter の法人化前精緻化 | 統合 |

### Book III — 動機付け事例とパターン・ライブラリ (200p, 16 章)

| Ch | タイトル | p | 主軸 (詳細は L2 D-010 etc) |
|---|---|---:|---|
| 12 | TIEM — 早すぎ起業の解剖 (ゾンビ型 参照事例) | 16 | Y-001 + Y-004 |
| 13 | BWE — 健全型 参照事例と F_cap 補完成功 | 14 | F-CES 補完 |
| 14 | CX — Carbon, R_net 共食いの観測 | 12 | μ_I 単独高位 |
| 15 | SX — 半導体、σ_SU 追い風 × R_net 共食い | 14 | R-bundle min |
| 16 | CTB — 創薬、鋸歯型軌跡と段階補充 | 14 | Ch 8.4 鋸歯型 |
| 17 | YD — 波力、UE 律速 NO_GO (即落型) | 12 | Ch 26b アンカー |
| 18 | JC — 浅技術型、自走型 参照事例 | 10 | σ_SU 低 / F 高 |
| 19 | CLG — σ_SU 追い風依存型 参照事例 | 10 | 摩耗事例 |
| 20 | Research-Org-Type 機関 | 12 | NIMS |
| 21 | Private-Engineering-Univ-Type 機関 — 桑折 MTG 7 論点正準オーナー | 14 | KUTE |
| 22 | Regional-National-Univ-Type 機関群 | 14 | 愛媛 + 香川 |
| 23 | Integrated-Large-Univ-Type 機関 | 12 | 京大 / 山口大 / 東京科学大 |
| 24 | 国際比較 — International-TTO-Type 後付け校正 [新設] | 12 | P-002 で対象機関確定 |
| 25 | 層間結合の実質的所見 (記述、識別主張なし) | 14 | Tier A |
| 26a | 標本内整合性チェック — 校正であって validation ではない | 10 | Tier A |
| 26b | 前向き反証プロトコル — 何が反証されたら本書は死ぬか | 10 | Tier B |

*Book III ページ合計 = 200p に再調整 (当初 Ch 章別合計 256p から 56p 縮約、各章 2-6p 削減)*

### Book IV — 時系列現場接続 — 実践の背骨 (110p, 5 章)

| Ch | タイトル | p |
|---|---|---:|
| 27 | 技術シーズの掘り起こし — P(t) を待たずに U(t) を広げる | 20 |
| 28 | 先生が第一歩を踏み出すとき — 賭け金の全量と F の起点 (Ch 21 pointer) | 22 |
| 29 | GAP ファンド期 — 機関 ERS が y を非希薄化的に厚くする時間窓 (CTB 主) | 22 |
| 30 | 会社設立期 — B の起動と F の充足を一致させる不可逆 GO (CLG 主、Ch 21 pointer) | 22 |
| 31 | 資金調達期 — F の現場運用、J カーブ批判、撤退四経路 | 24 |

### Book V — 機関側設計 (90p, 4 章)

| Ch | タイトル | p |
|---|---|---:|
| 32 | ERS 8 軸別処方 — 運用者向けプレイブック | 30 |
| 33 | GAP + URA + EIR — 三制度を一つの導線に (Ch 21 論文-特許順序事故 pointer) | 22 |
| 34 | 地域 産学官 双対動態 — σ_SU を県境で読む | 22 |
| 35 | BZ 段階への政策含意 — σ_SU と ERS を政策レバーに翻訳 | 16 |

### Book VI — 新領域宣言と次の研究プログラム (72p, 4 章)

| Ch | タイトル | p |
|---|---|---:|
| 36 | 機関 KPI と ERS — Goodhart 回避の評価指標化 (funder 向け) | 18 |
| 37 | 真正面の比較 — BZM vs Triple Helix vs Effectuation vs Nelson-Winter (Tier B) | 20 |
| 37.5 | 自己批判とオープンプロブレム — 第二版への課題 (RT 含む全理論の弱点・未検証点・想定されるツッコミを著者自ら列挙、D-056) | 12 |
| 38 | 新領域宣言 — 何が獲得され、何が次の 10 年に持ち越されたか | 22 |

### 付録

| 記号 | タイトル | p |
|---|---|---:|
| A | 数学補遺 — 導出、校正、感度、shift +1 数値手続き | 70 |
| B | データ仕様、プロトコル、予測登録簿、OSF 事前登録手続き | 55 |
| C | やらかし図鑑 Y-001〜Y-008 全文 | 35 |

---

## 6. 書き順 (改訂版、Ch 10 load-bearing 昇格を反映)

**Book II 中核**: `Ch 5 → Ch 5.5 → Ch 10.4 (Theorem 3) → Ch 9 (ERS 加重和導出) → Ch 7 (F-CES 形式) → Ch 10.3 (ρ Kmenta 識別) → Ch 8 → Ch 10.5 (Klepper) → Ch 10.6 (Malerba) → Ch 10.7 (Murmann) → Ch 9.5 (RT 結合機構、D-056: Ch 8 の y/λ・Ch 9 の ERS・Ch 10.7 の Ψ が全て確定した後) → Ch 10.8 (ファジー境界) → Ch 10.9 (試験前倒し) → Ch 10.10 (統合) → Ch 11 → Ch 11.5 → Ch 6`

**全体**: Book II 中核 → Book III 案件章 (Ch 12-19) → Book III 機関章 (Ch 20-24) → Book III 結合章 (Ch 25-26b) → Book 0 → Book I → Book IV → Book V → Book VI → 付録 A/B/C

### 根拠
- Ch 10 が load-bearing 中核 (Theorem 3 + ρ Kmenta 識別 + Klepper/Malerba/Murmann 形式接続) に昇格したので Book II 内の順序を再構成
- Theorem 3 (Ch 10.4) と ERS 加重和導出 (Ch 9) は二段階完成なので、Ch 10.4 → Ch 9 (代数バックボーンの後出し) または Ch 9 → Ch 10.4 (不可能性定理の後出し) のどちらか。本書は **Ch 10.4 → Ch 9** を採用 (Arrow スタイル骨格を先に立てる)。最終確定は P-010
- Ch 6 (PRS 期待値分解) は Ch 7 / Ch 8 / Ch 9 で S 内部を展開した後に位置付ける方が整合的なため、Book II 中核の最後

---

## 7. PJ ケース割当て (露出制限ルール = D-010)

| PJ | 主章 | 役割 | 露出制限 |
|---|---|---|---|
| TIEM | Ch 12 | ゾンビ型代表、Y-001 + Y-004 重複原型 | **本章 + Ch 4 + Ch 26 + Ch 37 + 付録 C のみ** |
| BWE | Ch 13 | 健全型代表、F_char 高 × F_cap 後発補完成功 (Ch 7 F-CES) | 標準露出 |
| CX | Ch 14 | R_net 負号観測、μ_I 単独高位 Triple Helix 不均衡 | 標準露出 |
| SX | Ch 15 | σ_SU 追い風 × R_net 共食い、Ch 2.3 R-bundle min (GRL 律速) 主要事例 | 標準露出 |
| CTB | Ch 16 | 鋸歯型主要参照 (Ch 8.4)、F_cap 経験順序 (Ch 7.5)、Ch 29 GAP 期主要事例 | 標準露出 |
| YD | Ch 17 | UE 律速 NO_GO、即落型 (Ch 8.4)、**Ch 26b 予測登録簿アンカー** | 標準露出 |
| JC | Ch 18 | shallow tech、自走型主要参照 (σ_SU 低 / F 高 / R_net 早期) | 標準露出 |
| CLG | Ch 19 | 追い風依存型 (σ_SU 高 → R_net 立たず F_char 摩耗)、Ch 30 設立期主要事例 | 標準露出 |

---

## 8. 機関ケース割当て

| 機関 | 主章 | type | 一次情報状況 |
|---|---|---|---|
| (Research-Org-Type 1 機関) | Ch 20 | Research-Org-Type | 公知 + 一部一次 |
| (Private-Engineering-Univ-Type 1 機関) | Ch 21 | Private-Engineering-Univ-Type | **桑折 MTG 2026-06-24 一次情報の正準オーナー (7 論点)** |
| (Regional-National-Univ-Type 2 機関) | Ch 22 | Regional-National-Univ-Type 群 | 一次 |
| (Integrated-Large-Univ-Type 3 機関) | Ch 23 | Integrated-Large-Univ-Type | 一次 |
| (International-TTO-Type 1 機関) | Ch 24 | International-TTO-Type | 公知のみ (P-002 で対象確定) |

*暫定方針 (D-034 supersedes D-011): P-001 解決まで全 7 機関を type 名のみで通す。実機関名 (NIMS / KUTE / 愛媛 / 香川 / 京大 / 山口大 / 東京科学大) は L2 ledger と内部メモのみで保持、L1 では type 名でのみ言及。*

### 桑折 KUTE MTG 2026-06-24 7 論点 (Ch 21 が正準オーナー、他章は pointer のみ)
1. 出資金 (Ch 28 pointer)
2. シーズ転用
3. COI (Ch 32 pointer)
4. 退路 (Ch 28 pointer)
5. 研究室学生責任 (Ch 28 pointer)
6. 論文-特許順序事故 (Ch 33 pointer、Y-007 候補)
7. 取締役個人責任 (Ch 30 pointer、Y-008 候補)

---

## 9. やらかし図鑑 Y-001〜Y-008 (付録 C)

| ID | 内容 | 主章 |
|---|---|---|
| Y-001 | シリーズ A 命名 | Ch 12 TIEM |
| Y-002 | CTO 非開示 | Ch 23 / Ch 7 F-cap |
| Y-003 | CEO 中間管理職化 | Ch 23 / Ch 7 F-cap |
| Y-004 | 早すぎる拡大 (premature scaling) | Ch 12 TIEM |
| Y-005 | Cabot 機会逃し | Ch 4 / Ch 11 BVAR |
| Y-006 | 未確定 (unknown vs not_started 誤読候補) — P-007 | TBD (現象正準オーナーは Ch 3.5) |
| Y-007 | 未確定 (論文-特許順序事故候補) — P-007 | TBD (Ch 21 / Ch 33) |
| Y-008 | 未確定 (取締役個人責任説明不在候補) — P-007 | TBD (Ch 21 / Ch 30) |

*付録 C は TIEM 露出制限 (D-010) の対象外 (Y-001 / Y-004 を完全展開する場として明示)。*

---

## 10. 専門用語日本語化方針 (反省 #4)

学術界で日本語訳が定着している経済学・統計学用語は必ず日本語化する。訳語の 1:1 対応表は別 doc `pwa/bzm/terminology_glossary.md` に切り出して保守 (L1 は方針宣言のみ)。

### 方針
- 日本語化対象 = 経済学・統計学の学術用語で日本語訳が定着しているもの (識別不能、一次条件、内生的、後付け校正、レジーム切換え、事前/事後分布、最適停止、状態空間、単一スコア、因果 DAG、条件付き受理、中核を支える 等)
- 英語維持 = 人名 / 数式変数 / 略号 (PRS, ERS, BZM, TRL, GAP, URA, EIR, TTO, DSGE, BVAR, SSM, IV, RD 等) / journal 名 (Research Policy, R&D Management, Industrial and Corporate Change) / ある程度定着した固有名詞 (Cobb-Douglas, Triple Helix, real options, Kalman filter, Markov, Bayes, Minnesota prior, jump-diffusion, CES, Leontief, Brier score, Goodhart's Law, J カーブ, Andrews-Quandt sup-Wald, OSF)
- 文脈による訳語選択の揺れ (例: load-bearing → 「中核を支える」「骨格となる」「中核」) は許容、用語表で 1:1 固定しない

---

## 11. 章型 (確定 2026-06-13)

各章は (i) 章頭ストーリー (匿名化、合成事例 OK) → (ii) 解説 (数式・図) → (iii) 匿名化実例 (PJ / 機関 / 桑折 MTG 論点 / やらかし図鑑) → (iv) 章末の問い、の 4 要素で構成する。

### 例外
- Book II load-bearing 章 (Ch 5/5.5/7/8/9/9.5/10.4/10.5/10.6/10.7): 章頭 → 数学導出 → 後付け校正例 → 章末前方参照 (Ch 9.5 は「後付け校正例」の代わりに SX/EWIR・KENQ の Tier A 観測記述 + Ch 26b への実証 flush)
- Ch 37.5 (自己批判章): 章頭 → 弱点の自己列挙 (理論別) → オープンプロブレム定義 → 第二版課題宣言
- Ch 10 OPENER (11 節 72p) 構成: プロローグ (10.0) → 設定 (10.1) → 三貢献 (10.2-10.4) → 三系譜橋渡し (10.5-10.7) → シャープ → ファジー統合 (10.8) → 試験 (10.9) → 統合 (10.10)
- Book III ケース章 (Ch 12-19): 章頭 → 後付け校正 → load-bearing 章 pointer → 章末問い
- Book III 機関章 (Ch 20-24): 章頭 → 8 軸プロファイル → type 横断対比 → 章末
- Book VI 宣言章 (Ch 38): 章頭 → 何が獲得されたか → 何が次の 10 年に持ち越されたか → 環を閉じる

---

## 12. 章間 dependency 表 (節レベル粒度、Ch 10 を 10.0-10.10 に展開)

| 章 / 節 | 依存先 | 依存内容 |
|---|---|---|
| 0.0 | — | 射程宣言は first-mover |
| 0.1 | 1, 2, 3 | 状態空間と二層観測の宣言 |
| 0.2a | — | 文献継承 |
| 0.2b | — | 文献継承 (PSED / ecosystems / ACAP / dynamic capabilities), Book 0.3 / Ch 3 / Ch 7 / Ch 10 が依存元 |
| 0.3 | 5, 8, 9 | 二層 readiness 方法論の宣言形 |
| 0.4 | 5, 5.5, 7, 9, 10.4 | 三貢献は load-bearing 定理を要約 |
| 1 | — | 状態空間定義は first-mover |
| 2 | 1 | PRS 概念体系 |
| 3 | 1 | ERS 概念体系 (Ch 3.5 = unknown vs not_started 正準オーナー) |
| 4 | 1, 2, 3 | 失敗パターン抽象は Book II 索引 |
| **5** | — | Book II 起点 (書き順 1 番目) |
| **5.5** | 5; 概念依存 {2, 7, 8} (前方参照: θ_σ* の内生性は Ch 5.5 内で仮宣言、Ch 7/Ch 8 で正式定義) | GO 最適停止 |
| 6 | 2, 5.5, 7, 8, 9 | PRS 期待値分解、二層結合禁止の運用 |
| 7 | 2, 5, 6 | F-CES (S 内部) |
| 8 | 5, 7 | 2D jump-diffusion + y 5 成分集約 |
| **9** | 3, 5, 7, 8 | ERS 加重和導出 (二層非可換性代数バックボーン) |
| **9.5** | 8, 9, 3, 10.7 (Ψ 分解の前提); 前方参照 {26b} | RT 結合機構 (D-056): 定義・成立3条件の命題化・CRL/ICT・y/λ 主経路割当・Ψ_j 分解仮説。実証主張は Ch 26b へ flush |
| **10.0-10.1** | 全 Book II 先行節 | プロローグ + 設定 |
| **10.2** | 5, 8 | C1 レジーム切換え B の formal definition |
| **10.3** | 7 | C2 F-CES ρ Kmenta 識別 (Ch 7 形式定義の後継、ρ 校正の正準オーナー) |
| **10.4** | 3, 9 | C3 Theorem 3 Arrow スタイル不可能性 (Ch 9 代数バックボーンを受けて不可能性定理化) |
| **10.5** | 5, 7, 8 | Klepper 統合ハザード (命題 4 = F_char→1 極限 = Ch 7 / 命題 5 = Δlog h 符号条件 = Ch 5 σ_SU × Ch 7 F_char 分散) |
| **10.6** | 3 | Malerba SSI 全射 φ + レーン重み w(L) (Ch 3 ERS 8 軸定義の埋め込み) |
| **10.7** | 5, 8, 3, 9, 10.2 | Murmann 双方向 coupling (ファジー RD Ψ identification at τ_B) |
| **10.8** | 5, 11, 11.5 | ファジー境界 h パラメータ族 (シャープ h↓0 と Ch 11.5 滑らかな極限 h↑∞ を境界事例として包摂) |
| **10.9** | 5, 7, 10.2, 26b | N≈32 試験前倒し (Ch 26b と並走、OSF 事前登録) |
| **10.10** | 全 Book II 節 + 37, 38 | 統合 (BZM = Klepper と Murmann に境界づけられた Nelson-Winter の法人化前精緻化) |
| 11 | 5, 5.5, 6, 7, 8, 9, 10.8, 25 | h↑∞ 境界事例として再アンカリング (Tier A 用語規律を Ch 25 から継承) |
| 11.5 | 10.9, 26b | 事前登録試験運用実装、N=32 → 64 段階ゲート |
| 12-19 | 5, 5.5, 6, 7, 8, 9, 10.5, 10.6 | 案件ケース後付け校正 |
| 20-24 | 3, 9, 10.6, 10.7 | 機関ケース後付け校正 |
| 24 | 20-23 + 10.6 | 国際比較は ERS 8 軸 + Malerba SSI レーン重み w(L) で jurisdiction 跨ぎ可搬性を校正 |
| 25 | 12-24, 11 | 層間結合所見 (Tier A、識別主張なし) |
| 26a | 11, 12-24 | 標本内整合性チェック (Tier A) |
| 26b | 5.5, 7, 8, 9, 10.4, 10.9, 11, 25 | 前向き登録簿 (Tier B、Ch 25 用語規律継承) |
| 27 | 1, 2, 6 | 掘り起こし期 |
| **28** | 7, 8, **21** | 起点期 (桑折 MTG 出資金/退路/学生責任 = Ch 21 pointer) |
| 29 | 5.5, 8, 16 | GAP 期 (CTB) |
| **30** | 5.5, 8, 19, **21** | 設立期 (CLG + 桑折 MTG 取締役個人責任 = Ch 21 pointer) |
| 31 | 7, 8 | 資金調達期 |
| 32 | 3, 9, 20-24, **21** | 機関 8 軸別処方 (運用者向け、桑折 MTG COI = Ch 21 pointer) |
| 33 | 21, 23 | GAP + URA + EIR (桑折 MTG 論文-特許順序事故 = Ch 21 pointer) |
| 34 | 5, 22, 10.7 | 地域双対動態 |
| 35 | 5.5, 32 | 政策含意 |
| 36 | 3, 9, 32 | 機関 KPI (funder/政策向け、Goodhart 回避) |
| 37 | 全 load-bearing 章 + 全ケース章 + **26a, 26b** | 真正面比較 (Tier B 共通スコアリング規則 = 24ヶ月 outcome class log-loss) |
| 37.5 | 全章 (特に 9.5, 26b, 11, 25) | 自己批判とオープンプロブレム — 弱点の自己列挙と第二版課題の宣言 (D-056) |
| 38 | 全章 | 新領域宣言 |

---

## 13. 章単位 6 ステージ pipeline

各章は以下 6 ステージで書き上げる。`bzm/CHAPTER_<n>_PROGRESS.md` (L3) に記録。

1. **節 skeleton workflow** (3 persona × 3 lens × synth)
2. **まさ確定 (節レベル)** → BOOK_DECISIONS.md に append
3. **段落 outline workflow** (節を 12-25 段落見出しまで展開)
4. **段落 draft workflow** (節ごとに 3-5 段落単位で本文 draft)
5. **adversarial verify** (5 経済学者 persona: DSGE / 進化経済 / IS / 経験的計量 / AE)
6. **まさ段落確定** + `pwa/src/lib/build-info.ts` の BUILD_VERSION patch bump + commit

### Ch 10.9 / Ch 26b 限定の追加ステージ (Tier B 章のみ)
- 試験プロトコル OSF 事前登録 (データアクセス前必須)
- 事前コミット効果量 β̂_3 ∈ [0.4, 1.2] per IQR-σ_SU log-hazard の登録
- 反証ルール (Brier > 0.25 等) のデータアクセス前公開

### 反省 #2 接続
pwa repo に code / spec 含む commit を作る際は必ず BUILD_VERSION を patch bump up する。docs / handoff only commit は除外。本書 commit はこのルールの対象。

---

## 14. 3 層 md role 分担

| 層 | ファイル | 役割 | 更新頻度 |
|---|---|---|---|
| L1 (不変項) | `pwa/bzm/BOOK_MASTER_PLAN.md` (本ファイル) | 中核命題 / Tier 階層分離 / 確定モデル / 章構成 / 書き順 / ケース割当て / 章間 dependency / page budget / publishing path / 6 ステージ pipeline | 構造変更時のみ、変更は L2 判例化が先行 |
| L2 (判例集) | `pwa/bzm/BOOK_DECISIONS.md` | まさの設計判断を judgment / rationale / applies_to_chapters / date / status で append-only | まさ判断ごとに append |
| L3 (章進捗) | `pwa/bzm/CHAPTER_<n>_PROGRESS.md` (n = 0.0, 0.1, ..., 10.0, ..., 10.10, 11, 11.5, ..., 38, A, B, C) | 節 skeleton / 段落 outline / draft / 査読履歴 / 確定段落 | 章執筆中は逐次 |
| 補助 | `pwa/bzm/terminology_glossary.md` | 専門用語日本語化 1:1 対応表 (時間と共に増減) | 用語追加時 |

---

## 15. セッション開始時の必読リスト (反省 #1, #5 への対応)

1. `pwa/bzm/COMMANDER_TASKS.md` (task ledger)
2. `pwa/bzm/BOOK_MASTER_PLAN.md` (本ファイル)
3. `pwa/bzm/BOOK_DECISIONS.md` (特に active と pending)
4. 該当章の `pwa/bzm/CHAPTER_<n>_PROGRESS.md`
5. 素材源 (`pwa/bzm/2026-06-25_mapping_existing_to_new.md` の Ch n entry → 既存 md)
6. 確定モデル正本: `pwa/design/amd_score.md` (PRS) / `pwa/design/institution_readiness.md` (ERS) / `BZSF/before_zero_theory.md` (理論) / `pwa/bzm/2026-06-25_book2_evol_econ_major_revision.md` (Ch 10 OPENER)

### 禁止
- 古い v3.2 (`before-zero/theory/`) を最新と誤認しない (R-1)
- `before-zero/theory/` には新規追記しない (R-1)
- 提案物 / 設計ノート / 本書本文を混同しない (R-3) — 本書本文 draft は `pwa/bzm/public-manuscript/` または `pwa/bzm/textbook/` 配下、提案物は `pwa/bzm/2026-06-25_*.md`、進捗は `CHAPTER_*_PROGRESS.md` と分離

---

## 16. Cross-references (本書全体の整合性チェック点)

### 中核命題の正準オーナー
- 二層非可換性 ERS 加重和代数 = Ch 9 (Ch 10.4 への前提供給)
- Theorem 3 Arrow スタイル不可能性 + 系 3.1 = Ch 10.4 (Ch 9 を受けて不可能性定理化)
- GO 最適停止導出 = Ch 5.5 (他章は式参照のみ、再導出禁止)
- F-CES 形式定義 = Ch 7 / F-CES ρ Kmenta 識別 = Ch 10.3 (パラメータ数値は他章で書かない)
- Klepper 入れ子 = Ch 10.5
- Malerba SSI 全射 = Ch 10.6
- Murmann 双方向 coupling = Ch 10.7
- ファジー境界 h パラメータ族 = Ch 10.8
- Andrews-Quandt sup-Wald + N≈32 試験前倒し = Ch 10.9
- 前向き予測登録簿プロトコル = Ch 26b
- 真正面比較 (Tier B 共通スコアリング規則) = Ch 37
- RT 結合機構 (定義・命題・CRL/ICT) = Ch 9.5 (仮説的第三柱、D-056。ERS 側接続の理論正本は `BZSF/rt_roundtable_theory.md` v0.2 §13.4-13.6。実証仮説は Ch 26b、弱点自認は Ch 37.5)

### Tier A vs Tier B の用語規律
- Ch 11, Ch 12-24, Ch 25, Ch 26a = **Tier A** (「校正」のみ、validation 主張なし、識別主張なし)
- Ch 10.9, Ch 26b, Ch 37 = **Tier B** (「前向き予測」「事前登録」「識別された」、OSF 事前登録必須)
- 8 PJ 後付け校正を「validation」と呼ぶ叙述を本書全体から禁止 (D-033)

### 桑折 KUTE MTG 2026-06-24 一次情報
- 集約点 = Ch 21 (Private-Engineering-Univ-Type)
- 分岐先: Ch 28 (出資金/退路/学生責任) / Ch 30 (取締役個人責任) / Ch 32 (COI) / Ch 33 (論文-特許順序事故)
- 分岐先の章では Ch 21 への pointer 形式で書き、一次情報を二重露出しない

### TIEM 露出制限 (D-010)
- Ch 12 (主) + Ch 4 + Ch 26 + Ch 37 + 付録 C のみ
- Book IV / V では TIEM を引かず、CTB / CLG / BWE を主要事例に

### unknown vs not_started 区別の正準オーナー
- 現象 = Ch 3.5 (ERS 8 軸運用補注として、Ch 33 は制度間適用)
- やらかし図鑑 Y-006 候補としての収録は P-007 で確定後に決定

### 後付け校正 vs validation の用語規律
- 「後付け校正 (retrospective calibration)」と「validation (検証)」を厳密分離
- Ch 26a は「校正」と呼ぶ、validation と呼ばない (Tier A)
- Ch 26b は前向き登録簿、本書 deliverable は登録簿プロトコル設計まで、実 validation は後続論文へ (Tier B)

### Murmann co-evolution と地域双対の役割分担
- Ch 10.7 = Murmann 双方向 coupling の正準オーナー (η_jt VAR(1) + Ψ identification)
- Ch 22 = Regional-National-Univ-Type 機関群の 8 軸プロファイル (Ch 10.7 への一次情報供給)
- Ch 34 = 地域 産学官 双対動態の政策・実務翻訳 (Ch 10.7 から導出)

---

*L1 終端。本ファイルへの構造変更は L2 (BOOK_DECISIONS.md) に判例として記録してから反映すること。*

