# PAPER_P1_PROGRESS.md — P1 (Research Policy 論文) 進捗台帳 (L3)

*L1 = `PAPER_P1_MASTER_PLAN.md` / S2 成果物 = `PAPER_P1_OUTLINE.md`。ステージ定義は L1 §7。*

## ステージ進捗

| ステージ | 状態 | 日付 | 備考 |
|---|---|---|---|
| S1 節 skeleton | ✅ 確定 | 2026-07-03 | L1 §4。まさ回答3点反映 (D-060/D-061、タイトル (b)) |
| S2 段落 outline | ✅ 完了 | 2026-07-03 | `PAPER_P1_OUTLINE.md` 58 paras。E/C 公理リネーム・定理番号マップ確定 |
| S3 節 draft (英語) | ✅ 全節完了 | 2026-07-03 | `PAPER_P1_DRAFT.md` 本文 7,251w (+refs/表で ~9,000w 圏内) |
| S4 組み上げ + 刈り込み | ✅ 完了 | 2026-07-03 | Table 1/2・References 36件・Fig 1 (二層概念図 SVG)・Fig 2 (Simpson模式図 SVG)・**SM-A〜E 統合済み** (`PAPER_P1_SM.md`、証明3本はエージェント起草→検収)。Fig 3 は SM-C.5 の数値スキームで S6 前に作図 |
| S5 persona 査読 (5人) | 🔄 改稿中 | 2026-07-03 | ✅ 6並列査読完了 (5 persona + 引用照合36件=幻覚ゼロ)。判定: editor=desk-reject / 他4=major。**統合改稿計画 = `S5_REVISION_PLAN.md` (R1-R10)**、個別report = `paper_p1_reviews/`。⏳ 後半 = 改稿実行 (R1 理論再手術が最重量)。改稿ログは下の「S5後半 改稿実行ログ」 |
| S6 まさ最終確定 + 投稿パッケージ | — | — | cover letter / highlights / CRediT / declarations |

## 節別 draft 状態 (S3 → 2026-07-03 全節 draft 済み)

| § | 節 | 実words | 状態 |
|---|---|---|---|
| 1 | Introduction | 970 | ✅ draft |
| 2 | Two evaluation problems, one field | 878 | ✅ draft |
| 3 | The two-layer observation system | 1,350 | ✅ draft (Thm 1 / Prop 1 / Thm 2) |
| 4 | The impossibility theorem | 1,304 | ✅ draft (C1-C4 / Thm 3 / Cor 3.1 / Table 1 参照) |
| 5 | Operating on the two ledgers: the GO operator | 1,115 | ✅ draft (Thm 4 / Prop 2) |
| 6 | Retrospective calibration: eight projects | 766 | ✅ draft (T/Y vignettes、Table 2 参照) |
| 7 | Policy implications and a research program | 503 | ✅ draft (OSF 登録簿宣言) |
| 8 | Conclusion | 193 | ✅ draft |

各節とも outline budget 比で 10-25% タイト = S5 査読対応の増量余地を確保。

## 未決・依存

- 石原先生共著打診 (D-061、打診と S3 は並行可) — 打診パッケージは BOOKS_PORTFOLIO §7-6
- Table 2 (8PJ) の素材確定: `BZSF/before_zero_theory.md` + `retrofit/su_timelines.ts` から S3-§6 で抽出
- 図3点 (Fig.1 概念図 / Fig.2 Simpson 反例幾何 / Fig.3 θ* 比較静学) は S4 残タスク
- SM-A〜E の証明完全版: モノグラフ Ch 9 / 10.4 / 5.5 skeleton の proof 詳細を読み込んでから書く (フレッシュコンテキスト推奨)
- §6.1 は censoring 明記に修正済み (5件完了 + 1件右打ち切り + 2件決定前) — Table 2 の T/Y/K/Q/R/L/M/N ↔ 実PJ対応は非公開 (composite)

## S4 検収での本文修正 (2026-07-03、エージェント指摘由来)

1. **E2×ゲート矛盾の解消**: E2 に軸7除外条項を明記、Prop 1 段落に「E1-E4 は非ゲート7軸を統治、軸7はゲート前提のみで入る」を追加 (SM-A 指摘)
2. **証明経路の格上げ**: Theorem 3 の排除条件を Thomsen → **sign-consistency (単一因子独立性)** に修正 (§4.7/§4.8/Table 1/§1.5/§2.6)。Thomsen は加法族の特徴付けで、全単調合成の排除には sign-consistency が正しい必要条件 (SM-B 指摘 — 定理はより強い足場に乗った)
3. **C3 の2読み明示**: 「(P,R,S) 固定で無価値」→「状態とその誘導 (R,S) 応答に条件付けて無価値」(frozen-state 読みだと C2 と矛盾し公理族が空になる、SM-B 指摘)
4. **§3.4 の8軸を正本準拠に修正** (institution_readiness.md の軸1-8)
5. **比較静学 B の適用領域の向き**: skeleton 準拠 (待機コスト効果が参入後コスト効果に支配される領域) — 本文は無記載でセーフ、SM-C が正記載
6. **[GAP] 21件**: SM 内に明示保持 (A:4 / B:5 / C:12)。多くはモノグラフ付録 A.5.5 / Ch 11 への deferral。S5 で「SM 内で閉じるべきもの」と「モノグラフ参照でよいもの」を仕分け

## S5後半 改稿実行ログ (R1-R10)

| R# | 状態 | 日付 | 中身 |
|---|---|---|---|
| R8 (軽微) | ✅ 完了 | 2026-07-03 | 書誌4件修正 (Arrow=Wiley / Nardo=Hoffmann・OECD Publishing / Debreu・Lakatos 頁) + Atkinson 削除 + Cobb-Douglas を σ_SU 段落に引用追加 + SM 引用済み4件 (Bertola/Caballero/Fishburn/Gorman) を参照リストへ追加 (S6 で再照合) + SM-A 誤参照3箇所 (§2→§3)。※ R8 の残り (トーンダウン・§2 文献追加・abstract 確定) は未了 |
| R6 (機械的分) | ✅ 完了 | 2026-07-03 | 幽霊参照削除 (「bottom panel」→ Table 2 / 「survival panel」→ outcome-class completeness)・Table 2 の gate 起因行 T・K を WAIT に統一 (empirical MC2。Y の NO_GO は P→0 起因で別物として維持)。※ R6 の残り (P/R/S 操作化・rubric 値表示・GO三分法の定義・hindsight 明記) は未了 |
| R1 (理論再手術) | ✅ 完了 | 2026-07-03 | Theorem 3 を動学的価値関数ベースに再定式化 (socialchoice 構成的修理パスどおり)。f = nurturing environment の価値関数 (SM-B 全面差し替え、エージェント起草→えいみ検収、検収修正3点)。**M1-M5/M9/M10a/M10c/M11 を解消**: C1′=min(P,S) 消滅 (M5)・C3′ をチャネルのクラス定義化 (M3 型エラー + M9 自己違反を同時解消、B.7 は channel completeness 検定に = R2 の Hansen-J 再設計も完了)・境界退化を Lemma に格下げ (M1 自明性を正直化)・新 Theorem 3 = SH/ED 豊富性条件下で**弱単調合成を排除** (M2 の min(PRS,κ) 反例を殺し「どんな単調合成でも」が真に)・Cor 3.2 (portfolio/universal domain)・非空性はクラス構築で解消 (M4)・Cor 3.1 を registered diagnostics 化 ((i) は selection 要 = M10a、χ² df 修正 = M10c)・lineage 軟化 (M11)。SM-B GAP 5→2。本文 abstract/§1/§2/§4/§5/§6/§7/§8/Table 1/SM-E 整合済み |
| R2 (C3 再位置づけ) | ✅ 完了 | 2026-07-03 | R1 の新構造と一体で完了。C3′ = クラス定義 + 検証対象 (channel completeness、B.7 で F/σ-exposure 込み4キャリア moment に再設計)。§4 に **certification effects 正面対決の段落**を新設 (Stuart-Hoang-Hybels 1999 ASQ / Hsu 2004 JF / Howell 2017 AER — 3件とも追加時に web 照合済み): price vs value の区別 (certification は資本アクセス = trajectory 経由 = チャネル内 (A_4/A_5/A_8→F/hazard/σ-exposure)、排除されるのは trajectory 固定の halo 残差のみ = J 検定の標的)、graceful degradation (J 棄却でも Theorem 3 は SH という観測可能な reversal のみに依存し崩壊しない) を明示。語数: 本文 8,887w (§4 2,389w)・SM-B 3,836w — R7 増強後に S5 末で再検量 |

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | 新設。S1-S2 完了を記録、S3 起草順を固定 | えいみ |
| 2026-07-03 | S5後半開始。改稿実行ログ新設、R8+R6 の軽微修正分を記録 | えいみ |
| 2026-07-03 | R1 完了を記録。次の重量級 = R2 残り (certification effects 文献対峙・private price vs social value・graceful degradation) → R3/R4/R5 (新構造確定済みなので依存解消)。PREVIEW.html は R1 で本文が大きく変わったため stale (全改稿完了後に再生成) | えいみ |
| 2026-07-03 | R2 完了を記録 (certification 段落 + 引用3件 web 照合済み追加)。残 = R3/R4/R5 (相互独立、新構造確定済み) → R6 残り/R7 → R8 残り/R9 残り。R10 はまさ判断待ちで独立 | えいみ |
