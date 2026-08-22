# S5_REVISION_PLAN.md — P1 査読シミュレーション統合改稿計画

*S5 前半 (6並列査読) の統合仕分け。個別 report 全文 = `paper_p1_reviews/` 配下6ファイル。まさ確認後に改稿実行 (S5後半)。初版 2026-07-03。*

## 1. 判定サマリ

| 査読者 | 判定 | 一言 |
|---|---|---|
| RPエディター | **desk-reject** (再投稿推奨付き) | 骨格は RP 向き。定理の射程・理論:政策比 (52% vs 6.6%)・§6 検証可能性が門前払い要因 |
| 社会選択理論家 | major (reject 境界) | **Theorem 3 は現ステートメントでは立たない**。ただし建設的修理パスを提示 |
| 実オプション経済学者 | major | Theorem 4 の証明は別モデルを解いている。∂θ*/∂F 符号が文献・自§7と衝突 |
| 実証イノベーション研究者 | major (reject 境界) | §6 は end-to-end 検証不能。C3 への反証文献 (certification effects) 未対峙 |
| TTO実務家 | major | C3=ハロー効果問題・E3=戦略的非開示報酬・実務装置 (HEInnovate/KEF) 未接続 |
| 引用照合 | — | **幻覚引用ゼロ**。30 OK / 4 軽微修正 / 孤児2 |

**全員一致の救済判定**: 二層測定 + 停止規則 + 登録プログラムの骨格は出版価値あり。死んでいるのは主張の張り方で、理論の芯ではない。

## 2. 収束した本質的発見 (複数査読者が同一点を指摘)

1. **Theorem 3 の現行版は「強すぎる主張 × 弱すぎる証明」** (editor / SC / empirical):
   - strict-Φ クラスの排除は実は C1 だけで3行 (自明) — C2 含意・C3/C4 不使用
   - 一方、実務の合成 (乗法 `SPS·(1+ECR)`・幾何・CES) は境界で退化し **strict クラスの外** = 現定理は看板の相手を撃っていない
   - ordinal C3 の下では反例 `f = min(SPS, κ(A))` が存在 → 「あらゆる単調合成の不可能性」は**現公理系では偽**
2. **C3 が急所** (SC / empirical / practitioner の三方向から):
   - 型が不正 (R,S が f の座標かつ A の関数)
   - **論文自身が C3 違反**: §5/SM-D は機関効果を F-slack・σ-exposure 経由でルーティング = C3 が禁じるチャネル。登録した Hansen-J は設計上自分の公理を棄却する
   - 実証文献の反証: certification/endorsement 効果 (Stuart-Hoang-Hybels 1999; Hsu 2004; Howell 2017)、日本の「東大発プレミアム」
3. **Corollary 3.1(i) Simpson 反転は現仮定から導出不能** (SC): 非負 within-slope + 非負 composition からは反転が出ない。選択 (collider) メカニズムが必要 — 皮肉にも §6 の「強い機関ほど早期案件を host する」がまさにそれ
4. **§6 の検証可能性ゼロ** (editor / empirical / practitioner): 数値ゼロ・P/R/S 操作化なし・4/4 hindsight・phantom 参照 (「bottom panel」「survival panel」)・T の表 (NO_GO) vs 本文 (WAIT) 不一致・GO三分法が定理 (binary/interior) と不整合
5. **モノグラフ deferral 問題** (editor / RO / SC): 21 GAP のうち計 **13件が投稿ブロッカー** (SC 8 + RO 5)。未出版・未引用のモノグラフへの委譲は査読で通らない

## 3. 修理パッケージ (優先順・担当ステージ)

| # | 修理 | 中身 | 由来 |
|---|---|---|---|
| R1 | **Theorem 3 再手術** | SC の建設的パスを採用: f を**動学的価値 (value function)** として定義し、A は (R,S,F) の運動法則にのみ入る構造に (C3 を「公理」から「モデル構造」へ変換 — 型エラーと自己違反が同時に消える)。定理を2部構成に: (i) strict クラス境界退化 (自明性を明示、制度論として活かす) / (ii) 本命 = universal-domain 公理を明示した上で非 strict 合成を含む排除定理を**新規証明** (min(SPS,κ) 反例を殺す形)。「first impossibility」主張は Fishburn 1976 / Bouyssou-Marchant / Gorman-BPR と接続して soften | SC/editor |
| R2 | **C3 再位置づけ** | 公理 → 「検証対象の識別仮定」へ。certification effects 文献と正面対決する小節新設。f の価値概念 (private price vs social value) を定義 — ハローが breaks するのは price 版のみ、と切り分け。graceful degradation (C3 破れでも生存する結果の明示)。Hansen-J は拡張チャネル (F/σ-exposure 込み) のヌルに再設計 | SC/emp/prac |
| R3 | **Theorem 1/2/Prop 1 修理** | cross-K coherence 公理を明示追加 (現状ないと定理は偽 = SC)。E2-s (等間隔) を定理文へ昇格。essentiality 循環解消。G1/G2 不整合修正。**E3 の戦略的非開示インセンティブ** (隠すと ECR↑) に開示ルール (audited K_obs) を追加。Theorem 2 は cardinal 主張として正直に再ステート | SC/prac |
| R4 | **Theorem 4/Prop 2 修理** | F-クロック問題: 証明を実モデルに合わせるか、命題を条件付きに格下げ。single-crossing を明示仮定に。∂θ*/∂F は pre/post-entry slack を分離し Boyle-Guthrie 2003 と対峙。ECR→dynamics の「nothing lost」主張は conjecture へ格下げ or 形式化。「endogenous」新規性を「auditable constructed state variable」に差し替え。**SM-C.5 を synthetic values で実行**して Fig.3 を計算版に。Guo-Miao-Morellec 2005 等を引用 | RO |
| R5 | **Corollary 3.1 再導出** | Simpson 反転を **selection (collider) 明示の DGP** から導出し直す — 「強い機関が早期案件を host する」構造をモデル化 (§6 の実観察と一貫)。(ii) と §6 fingerprint の整合。Mood problem・Hausman df 修正。門前の乗法スコアも捕捉できる signature 設計に | SC/emp |
| R6 | **§6 再構築** | P/R/S の操作化定義を §3 に新設。rubric 値を実表示 (composite のまま)。phantom 参照削除・T=WAIT 統一・GO三分法と定理の対応表・4/4 が hindsight である旨の明記と misfire 議論・IRR/blind re-scoring・COI 正式声明 | emp/prac/editor |
| R7 | **§7 増強 (3倍)** | ~515語 → ~1,800語。閾値付き加算 (Horizon Europe 標準) = 「実務は既に半分正しい」と接続。HEInnovate (同じ8次元!)・KEF (composite 拒否を実装済み) との対応表。**設立期限付き補助金 = 負のタイミング装置**の1段落定式化 (practitioner 提案の目玉)。レバー写像の §5/§7 統一。π_kk は「belief であって dial ではない」(単年度予算主義) | prac/editor |
| R8 | **修辞・体裁** | 領域宣言トーンダウン (登録プログラムは維持)。「calibrating a nonexistent instrument」を証明範囲に整合。valley of death・Vohora-Wright-Lockett・scoreboard 批判を §2 に追加。書誌修正4件 + Atkinson 削除 + Cobb-Douglas 引用追加。abstract 確定 | editor/refs |
| R9 | **GAP 解消** | 投稿ブロッカー 13件を SM 内で閉じる (R1/R3/R4 の新規証明作業と一体)。残りは明示的仮定 or 外部引用 (Scott 1964, Ishii-Koike, Peskir-Shiryaev 等) に変換。モノグラフは「companion monograph (in preparation)」の引用形式に統一 | SC/RO |
| R10 | **論文外アクション (まさ判断待ち・急がない)** | **OSF に登録簿を deposit し、M (=CX) と N (=SX) の予測をタイムスタンプ** — 設立はともに **2027-03頃** 予定 (まさ確認 2026-07-03。旧記載 CX 2026-08 / SX 2027-04 は古い)。設立判断前に打てば真の前向き予測2件が Tier B で成立。P6 (検証論文) の初弾データにもなる。期限は 2027-03 の設立判断前 = 余裕あり | emp |
| R11 | **非専門家リーダビリティ** | 読者層を「RP 査読者 + 産連メンバー・VC・政策実務家」に拡張定義 — 論文は AMD の信頼財で、「さすがAMD、そこまで考えてるのか」と言わせることが出版目的の一つ (まさ 2026-07-05)。学術精密性は落とさず「主張の階段の可視化」で対応: ①**abstract 再設計** (R8 の abstract 確定と統合) — 最強主張を「委員会の誰もが個別に頷く4つの穏当な要件 + 技術移転の現場なら誰でも知る2つの事実 (SH/ED) ⇒ 機関調整済み単一スコアは数学的に存在しない ⇒ それでも使い続けた場合にデータへ残る傷跡を事前登録」の3段構造で、非専門家が一読で掴める形に ②**§1 に plain-language 段落** (数式ゼロ: 何が禁止され・何が生き残り・審査会は明日から何をすべきか) ③**§1–§2 に merger-in-the-wild 実例** — 「誰も合体を望んでいない」反論の先回り封じ: NIH Overall Impact の Environment 基準 (+2025 簡素化改革が分離方向へ動いた事実) / 英 REF の environment 合成 vs KEF の composite 拒否 / EIS・大学発ベンチャー数ランキング等 (**全件 web 照合後に挿入**、幻覚ゼロ規律) ④**用語初出ガード** (SPS/ECR/σ_SU/SH/ED の初出に日常語1行) ⑤R7 の「実務は既に半分正しい — 定理は良い実務に免許を発行する」reframe と一体運用。実行タイミング: R4/R5 完了後、R7/R8 と一体 (abstract は本文最終形の要約なので最後) | まさ 2026-07-05 |

## 4. 突っぱねる (rebut) もの

- 「N=8 では何も言えない」→ §6 は illustration と再宣言した上で維持 (Tier A)。ただし R6 の透明化が前提
- 機関実名の要求 → composite + type 名 + 監査アクセス (editor 宛て) で防衛 (P-001 と整合)
- 「数理をもっと削れ」(editor の 52% 指摘) → 削るのではなく §7 側を増やして比率を直す (PF-001 の精神)

## 5. モノグラフへのフィードバック (P1 → BZM 理論本体)

S5 が発見した欠陥は **Ch 10.4 / Ch 9 / Ch 5.5 の skeleton 自体の欠陥**でもある。改稿と同時に L2 判例化すべき項目:
1. Ch 10.4: Theorem 3 の「C1 単独自明性 + strict クラスが実務合成を外す」問題 → 動学的価値関数ベースの再定式化 (R1) をモノグラフ側にも反映
2. Ch 10.4: Simpson 反転の導出には selection メカニズムが必要 (R5)
3. Ch 9: cross-K coherence 公理の欠落 (R3)、E3 の戦略的非開示問題
4. Ch 5.5: F-クロック/時間非斉次問題、pre/post-entry slack 分離 (R4)
→ 次モノグラフセッションで D-06x として判例化 + 各 SKELETON への修正周知

## 6. 実行順 (S5 後半)

1. R8 の軽微修正 + R6 の機械的修正 (phantom 参照・T 統一・書誌4件) — 即日
2. **R1+R2+R9 の理論再手術** — 最重量。フレッシュコンテキストで、SC report の建設的パスに沿って実行 (新規証明はエージェント起草→検収の S4 方式)
3. R3/R4/R5 — R1 の新構造が確定してから (依存)
4. R6 残り (P/R/S 操作化・rubric 表示) + R7 増強 + R11 (非専門家リーダビリティ — abstract 再設計は本文確定後の最後)
5. R10 (OSF deposit) — **まさの判断が出次第、改稿と独立に即実行可能**
6. 全修理後: 語数再検量 (増える見込み → SM への逃がし再設計) → S5 完了 → S6 (投稿パッケージ)

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | 初版。6並列査読の統合仕分け (R1-R10)、モノグラフへのフィードバック5点、実行順 | えいみ |
| 2026-07-05 | R11 追加 (非専門家リーダビリティ、まさ指示: 産連・VC 読者に最強主張が刺さる構造へ。abstract 3段構造 + plain-language 段落 + merger-in-the-wild 実例 + 用語ガード)。実行順 4 に反映 | えいみ |
