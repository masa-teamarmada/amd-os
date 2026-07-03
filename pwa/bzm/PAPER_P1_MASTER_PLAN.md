# PAPER_P1_MASTER_PLAN.md — Research Policy 論文 (P1) 抽出設計正本 (L1)

*位置づけ: PF-013 第1波 P1 = D-001 の執行。モノグラフ Ch 5/5.5/9/10.4 の load-bearing 定理を Research Policy (RP) 論文として抽出するための不変項 (節構成・word budget・スコープ境界・規律・パイプライン)。章単位の進捗は `PAPER_P1_PROGRESS.md` (L3、ステージ2着手時に新設)。変更は `BOOK_DECISIONS.md` (L2) への判例化を先行させる。*

*初版: 2026-07-03 / source: PF-013 (Publication-first、2026年内投稿目標) + D-001/D-059 + Ch 5/5.5/9/10.4 skeleton 資産*

---

## 1. ボトムライン

- **ジョブ**: Before Zero Studies の**領域宣言マニフェスト**を兼ねた旗艦理論論文。モノグラフより先に published prior art を確立し、モノグラフの正統性を補強する (D-001)
- **投稿先**: Research Policy、**通常投稿** (SI 待ちにしない、PF-013)
- **分量**: **本文+脚注+文献+表内テキスト込みで 9,500 words 目標 / 10,000 上限**。RP 投稿規定は「Research Article = 8-10,000 words (including footnotes, references and text in tables)。技術詳細は Supplementary Material Online へ」。⚠️ D-001 の「約 12k word」は RP 規定に対し過大 — **9.5k + SM 構成に実務修正** (まさ追認後、D-060 として判例化)
- **言語**: 英語 (起草はえいみ/Fable、PF-009 Q10 の LLM 英訳前提と同型)
- **時期**: **2026年内投稿** (PF-013 年内投稿マップ)
- **著者**: まさ判断待ち (§10-1)。単著 or 石原先生共著

## 2. 論文のジョブ・新規性・ポジショニング

**中核メッセージ**: 法人設立前 (Before Zero) のディープテック案件と、それを育てる研究機関は、**構造の異なる2つの台帳 (two ledgers)** で観測しなければならない。案件は乗法 (PRS = P×R×S、1軸ゼロで全体ゼロ)、機関は加重和 (ERS、欠損が見える充足率)。両者を単一スコアに合成することは**公理的に不可能** (Theorem 3)。そして案件側の GO/WAIT/NO_GO は、恣意的なチェックリストではなく**実オプション最適停止の一次条件**として導出される (θ_σ* 内生化)。

**3つの定理貢献** (すべて学術初出 = P1 が正式初出、モノグラフは P1 を引用する):

1. **二層非可換性の不可能性定理 (flagship)** — Ch 10.4 Theorem 3: 公理 (A1) PRS 消滅 / (A2) ERS 単調性 / (A3) 因果チャネル制限 / (A4) 連続性 を満たす案件価値関数 f は、いかなる f = Φ(g(P,R,S), h(A)) 型の二層分離表現も持たない。三方向崩壊 (純乗法は A3 違反 / 純加法は A1 違反 / 一般単調合成は Thomsen 条件不成立) + 系 3.1 (Simpson 反転・四分位不安定性・Hausman 棄却 = 反証可能な経験的シグネチャ)
2. **ERS 加重和の公理的一意導出** — Ch 9 Theorem 9.1/9.2: 4 公理 (可分性・外部性補償可能性・欠損可視性・単調性) + KLST 結合測定でERS 加重和形がアフィン同値を除き一意。Proposition 9.3 (軸7 precondition gate) + Theorem 9.4 (ERS×PRS 結合の二重計上禁止 = Theorem 3 への bridge)
3. **GO 演算子の最適停止導出** — Ch 5.5 命題 5.5.1-5.5.4: GO(t,i) = 𝟙[σ_SU ≥ θ_σ*]·g_TRL(t) を value-matching + smooth-pasting から導出、θ_σ*(P,F,B,Π) の陰関数一意性と比較静学 (∂θ*/∂P<0、∂θ*/∂B>0、∂θ*/∂F<0)、g_TRL 直交分解

**RP 読者へのフック (政策的含意)**: TTO・評価委員会・政策実務に蔓延する「機関補正済み総合スコア」(案件スコア × 機関係数のような合成) は**原理的に壊れている**という negative result。単一 readiness 総合指標 (composite indicator) への警告として、Arrow 不可能性の伝統をイノベーション評価実務に持ち込む。

**先行研究ポジション**: readiness levels (TRL 系・composite indicators) × Triple Helix (Etzkowitz-Leydesdorff) × 実オプション参入タイミング (Dixit-Pindyck 系) × 社会選択・結合測定 (Arrow 1963, Debreu 1960, KLST 1971) の交差点。大学発ディープテック SU の pre-founding 段階という未計測領域 (Before Zero) を宣言する。

## 3. スコープ境界 (入れない物 = 他 deliverable の血肉)

| 入れない | 理由 / 行き先 |
|---|---|
| σ_SU の MS-SSM / BVAR 推定・identification | モノグラフ Ch 5/11。P1 では σ_SU は定義 + 所与の状態変数 |
| F-CES の Kmenta 識別 (ρ 事後分布) | Ch 10.3。P1 では公理 A1 の正当化として1段落のみ (委譲不可能コア → min 極限) |
| Klepper 入れ子 / Malerba 全射 / Murmann coupling | P4 (ICC、D-059) |
| RT / CRL / ICT | P5 (R&D Mgmt or Technovation) |
| ERS 機関実証 (7機関×84評価の本格分析) | P3 (JOTT)。P1 では illustrative 言及まで |
| 出口ポートフォリオ論の展開 | P2 (研究技術計画) が主戦場。P1 は含意で1段落 |
| 前向き検証・予測精度主張 | P6。P1 は Ch 26b 型登録簿の「宣言」のみ (research program として) |
| 校正定数の値 (K、α群、閾値具体値) | PF-010。手続きの記述のみ |

## 4. 節構成 skeleton + word budget (S1 = 本ファイル、まさ確定待ち)

| § | 節 | words | 中身 (抽出元) |
|---|---|---|---|
| 1 | Introduction | 1,150 | 単一スコア実務の破綻例 (composite 化した URA 会議の匿名 vignette) → Before Zero の定義 → 貢献3点 + 領域宣言 |
| 2 | Two evaluation problems, one field | 1,050 | 先行研究: TRL/readiness・composite indicators 批判、Triple Helix、大学発SU評価、実オプション。gap = pre-founding 二層の測定理論不在 |
| 3 | The two-layer observation system | 1,500 | PRS = P×R×S 定義 (乗法の経済的根拠 = Liebig/O-ring)、σ_SU 定義 (CD 幾何平均、Leydesdorff T(AIG) との概念的区別を1段落)、ERS 4公理 → **Theorem 1 (=9.1/9.2 統合 statement)** 加重和一意性、**Proposition 1 (=9.3)** precondition gate、**Theorem 2 (=9.4)** 二重計上禁止。証明→SM |
| 4 | The impossibility theorem | 1,700 | 公理 A1-A4 (各公理の経済的意味づけ厚め) → **Theorem 3** + 三方向崩壊 + **Corollary 3.1** 反証可能シグネチャ。証明骨格は本文2段落 (Arrow 崩壊テンプレ × Thomsen 不成立)、完全証明→SM |
| 5 | GO as an optimal stopping rule | 1,400 | 最適停止定式化 → value-matching/smooth-pasting → **Theorem 4 (=命題5.5.2)** θ_σ* 陰関数一意性 + **Proposition 2 (=5.5.3)** 比較静学 (政策レバー解釈: 補助金→P、GAP fund→F、バーン圧→B) + g_TRL 直交分解 statement。HJB 粘性解の技術→SM |
| 6 | Retrospective calibration: eight projects | 1,000 | **Tier A 語彙のみ** (retrospective calibration / illustrative、validation 禁止)。8PJ 一覧表 (type 名・composite 宣言) + TIEM (σ_SU 高 ∧ TRL=0 → NO_GO 再現) / YD (P 律速) の2 vignette |
| 7 | Policy implications and a research program | 700 | 単一スコア実務への warning、二台帳ガバナンス (機関整備と案件判定の分離)、前向き登録簿宣言 (falsification 条件付き research program = 領域宣言の作法) |
| 8 | Conclusion | 300 | — |
| — | References | ~1,400 | 主要引用 §2/§4/§5 に集中 (~55件想定) |
| — | 表・図内テキスト | ~300 | 表2 (8PJ) + 図2-3点 |
| **計** | | **9,500** | 超過時の cut 順: §6 vignette 圧縮 → §2 圧縮 → §5 比較静学の表化 |

**Supplementary Material Online**: (SM-A) Theorem 1/2 完全証明 (KLST 表現定理の適用)、(SM-B) Theorem 3 完全証明 + 三方向崩壊の形式化、(SM-C) 最適停止の存在・一意性 (粘性解) + 数値例、(SM-D) ERS 8軸 rubric 概要 + 8PJ retrofit 表、(SM-E) 記号表。

**図の計画**: Fig.1 二層観測系の概念図 (BZM 三項構造から RT を除いた二層版)、Fig.2 Theorem 3 の反例幾何 (Simpson 反転)、Fig.3 θ_σ* の比較静学 (レジーム別閾値)。

## 5. 章資産マッピング

| 論文節 | 抽出元資産 | 変換 |
|---|---|---|
| §3 前半 (PRS/σ_SU) | `pwa/design/amd_score.md` + Ch 5 outline §5.1.7-5.1.13 | 定義と概念区別のみに圧縮 (SSM は落とす) |
| §3 後半 (ERS) | `CHAPTER_9_SKELETON.json` §9.1-9.4 | Theorem 9.1/9.2 → Thm 1、Prop 9.3 → Prop 1、Thm 9.4 → Thm 2 に改番 |
| §4 | `CHAPTER_10_4_SKELETON.json` 全節 | Theorem 3 番号は維持 (flagship)。10.4.3 の GMM 事前登録は「登録簿宣言」として §7 へ |
| §5 | `CHAPTER_5_5_SKELETON.json` §5.5.1-5.5.4 | 命題 5.5.2 → Thm 4、5.5.3 → Prop 2。レジーム K=3 は言及に留め SM 詳細 |
| §6 | `BZSF/before_zero_theory.md` retrofit 節 + `retrofit/su_timelines.ts` | type 名 + composite 宣言で再記述 |
| 記号 | `terminology_glossary.md` §3 | 英語版 notation に変換 (SM-E) |

## 6. 規律 (3冊 + 論文で共通)

- **Tier 規律**: P1 全体が Tier A。「validation」「identified」「causal effect」禁止。§6 は retrospective calibration / illustrative
- **数値開示**: PF-010 準拠 — 式の形はすべて公開、校正定数 (K、α群、σ_SU 閾値の採用値) は非公開 (校正手続きの記述のみ)
- **匿名化**: 機関 = type 名 (P-001 未解決のため)。PJ = composite 宣言 + type 名。実名化は P-001 確定後の校正で反映
- **初出**: 定理・公理・導出は P1 が学術初出。モノグラフ該当章は「詳細は本書、初出は P1」の引用構造に (Ch 5.5/9/10.4 の PROGRESS に反映要)
- **COI / データ宣言**: 著者 = AMD 運営当事者である旨を Declaration of Competing Interest に明記。データは proprietary operational records、匿名化 summary を SM で提供
- **カニバリ**: P2 (研究技術計画) は P1 の定理を「結果として引用」し制度応用に振る。同一貢献の日本語先行出版はしない (PF-013)

## 7. 執筆パイプライン (モノグラフ D-014 と同型、6ステージ)

1. **S1 節 skeleton** = 本ファイル §4 → **まさ確定** ← いまここ
2. **S2 節ごと段落 outline** (英語、各節 para-level で主張・引用・数式を割付け) → `PAPER_P1_PROGRESS.md` 新設
3. **S3 節ごと英語 draft** (§4→§3→§5→§6→§2→§1→§7→§8 の順 = flagship から書く)
4. **S4 全体組み上げ** + word budget 刈り込み + SM 分離
5. **S5 persona 査読** 5人 (RP editor / social choice 理論家 / real options 経済学者 / 経験的イノベーション研究者 / TTO 実務家) → 改稿
6. **S6 まさ最終確定** → 投稿パッケージ (cover letter / highlights 5点 / abstract 150w / CRediT / declarations / SM 一式)

## 8. リスクと対策

| リスク | 対策 |
|---|---|
| RP が「理論のみ」に厳しい | §6 の empirical grounding + §7 の政策含意を必須枠として死守。cover letter で「measurement theory for evaluation practice」と位置づけ |
| 三定理で焦点が散る | Theorem 3 を flagship に固定。Thm 1/2 は「二層それぞれの正当化」、Thm 4 は「案件側の運用」として従属配置 (§4 が最長 budget) |
| 12k→9.5k 刈り込み | 最初から SM 分離設計 (§4 の cut 順を pre-commit) |
| デスクリジェクト (scope 外判定) | 投稿前に RP 掲載の近縁論文 (readiness / TTO evaluation / research commercialization) を §2 で明示的にアンカー |
| P-001 未解決のまま投稿 | type 名 + composite で自己完結する設計 (実名はボーナス、P3 で効かせる) |

## 9. 投稿パッケージ要件 (S6)

Research Article / 単一 PDF + SM。Highlights (3-5 bullets)、abstract ≤ 150 words 推奨帯、CRediT authorship statement、Funding statement (該当なし or AMD 自己資金)、Declaration of Competing Interest (AMD 当事者性)、Data availability statement。参考: [RP Guide for Authors](https://www.sciencedirect.com/journal/research-policy/publish/guide-for-authors)

## 10. まさ判断点 (S3 起草開始までに)

1. **著者構成**: 単著 (最速) or 石原先生共著 (Book A 体制と整合、P-001 追い風、ただし査読往復の調整コスト)。→ W アクション (共著打診パッケージ) と合流可
2. **タイトル方向** (3案、S2 で磨く):
   - (a) *Before zero: why no single score can rank deep-tech ventures and their institutional nurseries*
   - (b) *Two ledgers before the founding: an impossibility theorem for evaluating university deep-tech spin-outs*
   - (c) *Ready, or not: a two-layer theory of go/no-go timing for deep-tech ventures before incorporation*
3. **9.5k 修正の追認**: D-001 の「約12k」→「9.5k + SM」。追認で D-060 判例化

*S2 (段落 outline) は skeleton 確定後に自動着手。S1 の確定はこの3点への回答で成立。*

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | 初版。PF-013 P1 の抽出設計 (9.5k+SM、節構成、章資産マッピング、6ステージ、まさ判断3点) | えいみ |
