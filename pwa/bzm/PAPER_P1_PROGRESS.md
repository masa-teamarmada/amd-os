# PAPER_P1_PROGRESS.md — P1 (Research Policy 論文) 進捗台帳 (L3)

*L1 = `PAPER_P1_MASTER_PLAN.md` / S2 成果物 = `PAPER_P1_OUTLINE.md`。ステージ定義は L1 §7。*

## ステージ進捗

| ステージ | 状態 | 日付 | 備考 |
|---|---|---|---|
| S1 節 skeleton | ✅ 確定 | 2026-07-03 | L1 §4。まさ回答3点反映 (D-060/D-061、タイトル (b)) |
| S2 段落 outline | ✅ 完了 | 2026-07-03 | `PAPER_P1_OUTLINE.md` 58 paras。E/C 公理リネーム・定理番号マップ確定 |
| S3 節 draft (英語) | ✅ 全節完了 | 2026-07-03 | `PAPER_P1_DRAFT.md` 本文 7,251w (+refs/表で ~9,000w 圏内) |
| S4 組み上げ + 刈り込み | ✅ 完了 | 2026-07-03 | Table 1/2・References 36件・Fig 1 (二層概念図 SVG)・Fig 2 (Simpson模式図 SVG)・**SM-A〜E 統合済み** (`PAPER_P1_SM.md`、証明3本はエージェント起草→検収)。Fig 3 は SM-C.5 の数値スキームで S6 前に作図 |
| S5 persona 査読 (5人) | ✅ 完了 | 2026-07-09 | ✅ 6並列査読完了 (5 persona + 引用照合36件=幻覚ゼロ)。判定: editor=desk-reject / 他4=major。**統合改稿計画 = `S5_REVISION_PLAN.md` (R1-R11)**、個別report = `paper_p1_reviews/`。改稿 R1–R11 完了 (まさの手2項目と R10 を除く)。**語数刈り込みも完了** (下の刈り込み行)。改稿ログは下の「S5後半 改稿実行ログ」 |
| S5末 語数刈り込み | ✅ 完了 | 2026-07-09 | 本文 §1–§8 を ~15.1k → **9,933w (Word相当=数式除外) / 10,079w (数式1トークン) / 10,222w (全展開)** — D-060 上限10k は Word相当で適合、目標9.5k までの残り ~430w は §4 証明スケッチ等の芯を削らない限り出ない (非推奨、S6 でまさ判断)。§3/§4/§5 = エージェント3体起草→えいみ検収 (定理・命題・系ステートメントと全数式の byte 不変を機械検証)。§1/§2/§6/§7/§8 = えいみ直接圧縮3ラウンド。**SM 受け皿新設**: SM-A.1 practice reading / SM-B.1 C1′ microfoundation 1文 / SM-B.8 certification 全文 / SM-B.9 lineage / SM-C.6 filtered readings / SM-D.4 scoring disciplines+layer split / SM-D.5 outcome classes+24mo窓 / SM-D.6 instruments 対応表 (旧本文 Table 3、[verify] 4個ごと移設)。**References 分割**: SM 専用引用16件 (Berkson/Bertola/Blackorby/Bouyssou/Caballero/Fishburn×2/Foster-Shorrocks/Gorman/Hausman/Holmström/Little-Rubin/Mood/Peskir/Scott/Stevens) を SM 末尾の補足リストへ、本文リストは46件 (本文引用のみ)。[verify at S6] 16個維持 (本文12+SM4)。**Figure 2 参照を Cor 3.1 に追加** (旧本文からの欠落を修理)。fig1.svg 公理表記 C1′–C4′ 更新。**PREVIEW.html 再生成 (v0.6)** — 旧プレビューの Fig3 は撤回済み主張の模式図だったのを計算版 SVG+新キャプションに是正。HTML はパーサ+構造の機械検証済み (ブラウザペイン不調で目視未、まさ確認推奨)。commits: e3d88efd (本文+SM) / f43341fa (プレビュー+fig1) |
| S6 まさ最終確定 + 投稿パッケージ | — | — | cover letter / highlights / CRediT / declarations。**S6 追加タスク**: 引用照合の対象が本文46+SM16 の2リスト構成に変わった点を反映 / RP 提出形式で SM 独立文献リストが許容されるか Guide for Authors 確認 (不可なら統合リストに戻す、+~350w) |

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
| R3 (Thm1/2/Prop1 修理) | ✅ 完了 | 2026-07-03 | **M6/M7/M8 + practitioner MC6 を解消** (SM-A 全面改修、エージェント起草→えいみ検収、修正2点)。E4 全観測軸 strict (essentiality 循環解消 = M7a)・**E5 新設**で単一重みベクトル導出 (cross-K GAP 解消 = M7b、Foster-Shorrocks 系譜)・E2-s を定理文に明示 + equal-interval reporting convention として正直化 (M7c、practitioner 指摘反映)・equal weights ≠ normalization (M7d)・continuum 化 = Assumption A-1 (M7e、Scott 1964)・**Prop 1 の G1/G2 矛盾解消** (G0)/(G2′) + 存在例 (M8)・**Theorem 2 = reporting-scale 結果に再ステート** (M6: ordinal E1 非違反を正直に認め、interval-scale 破壊 + venture-contingent credit を証明内容に。gate 非有罪 remark で Prop 1 との整合も解決)・**E3 audited 化 + SM-A.5** (MC6: 戦略的非開示は floor コーディング、K_obs 剥がし禁止、Rubin ignorability)。SM-A GAP 4→0 (全体 20→16)。References +2 (照合済み)。語数: 本文 9,142w・SM-A 3,855w |
| R5 | ✅ 完了 | 2026-07-05 | **Simpson (i) を selection DGP から再導出** (SM-B.6 全面改修、エージェント起草→検収)。Def SM-B.2 (score-selected sampling) + Lemma SM-B.3: 単一スコア採択 = collider (分布仮定なし)、**conditional gating では依存恒等ゼロ = 推奨設計がオフスイッチ** + Lemma SM-B.4 (Gaussian、δ は採択率で固定) + Prop SM-B.1 (反転条件 δ>δ̄、非空 ⟺ w_a/w_v>β_a/β_v、worked example: 採択率10%で pooled −0.56 vs within +0.15)。(ii) = Prop SM-B.2 (decision-time stratification の導出命題、annihilated cell 分離、SH=軸別交差 / ED=残余曝露減衰、trajectory conditioning=残差ゼロで §6 の「矛盾」解消)。(iii) = cluster-robust Wald 主検定 (χ²₄)、Hausman remark 格下げ。caveats 5本 (Mood/EIV/FWER/power+TOST/soft-signal) + coverage matrix。本文 §4/§6/§1/§7 整合。Refs +2 (要照合)。M10(a)-(d)+MC6 解消、SM-B.6 GAP→0 |
| R4 | ✅ 完了 | 2026-07-05 | **Thm 4/Prop 2 修理 + SM-C 全面改修 + Fig.3 計算版** (理論+数値の2エージェント並列起草→検収、数値事実を理論へ還流)。Thm 4 = 2D free-boundary curve θ*(k;F) に再ステート (F-クロック正面対応)、SC 命名仮定 (common loading 下で証明 Lemma C.3 + 数値 up-set 0 violations)、GEN checkable 化 ((E) 671点 / (J) interior 全点で検証)。**資金規約 (E)/(J) 2本立て — ∂θ*/∂F の符号は I の払い手に依存**: (E) dip 型 (旧 uniform 主張撤回、旧 region 節は誤った端をフェンス) / (J) 全域正・deadline で Marshallian collapse。Boyle-Guthrie 正面対峙 (Lemma C.4 2チャネル分解 → §7 は「WAIT を買う金」と「bar を下げる金」の2レバーに書換え)。**π_kk per-regime: S0 は正 = founding tax (旧主張は偽)**、政策レバーは cross ∂θ*(S1)/∂π_{S2S2}<0 へ付替え (証明+数値)。Lemma C.5 (ERS→運動法則、M6)・Conjecture C.1 (sufficiency 正直格下げ)・**Def C.1 GO/WAIT/NO_GO 三分法** (R6 の定理側接続を先取り、NO_GO = attainable set で entry region 空)。(TG) 明示化 + 4行 restart。OU 化・Q=λ_u(Π−Id)・σ 有界整合。C.5 数値実行済み (7診断、synthetic 開示値)。本文 §5 全置換 + §1/§2/§7/abstract/Table 2 N。SM-A.4 P→X。Fig.3 計算版。Refs +9 (要照合)。SM-C GAP 12→0、**モノグラフ委譲ゼロ** |
| R7 | ✅ 完了 | 2026-07-05 | **§7 増強 797→2,156語 + Table 1 第4ファミリー** (エージェント起草→検収)。gated-additive (Horizon Europe 標準 / 機関 certification gate) = 「定理が禁じる縮約を構成しない」= admissible as decision architecture — 「最も真剣な機関が既に運用する設計が生き残る」reframe を §4/§7 に実装 (practitioner MC1)。HEInnovate/KEF/AUTM-ASTP 対応表 = Table 3 (MC2、公理化が足すもの = 集計免許/gate/監査付き欠測規律/C3′ carriers)。**設立期限付き補助金 = 負のタイミング装置** centerpiece 段落 ((J)-deadline の Marshallian collapse で定式化、修理 = milestone に期限を移す)。audit-defensibility (gate は連続係数より監査に強い)。π_kk = belief object の humility (MC8)。instrument bundle (tranche design が loading を選ぶ、MC7)。agency translation 段落。§1 fn1 正直化・§2 認知文。[verify at S6] 14 tags、新規参照ゼロ |
| R6 | ✅ ほぼ完了 | 2026-07-05 | **§3 操作化 + §6 透明化 + COI + SM-D 増強** (エージェント起草→検収。**rubric 実値の表示のみ未了 = まさとの校正セッション待ち** — BZSF 正本「0-9 値は捏造しない・校正未実施」による)。§3: P/R/S の5段階 rubric 操作化・P = attainable-unit-economics-priced addressable scale (viability zero も P-zero = Y の正確な読み、MC7 double-duty 解消)・decision-date 情報規律・domain boundary ex-ante 固定・公開/専有レイヤ分割。§6: 開示5本化 (実効 retrodiction = 外部4件・circularity = bundle 評価の hedged 開示)・misfire honesty・outcome class = 「資金が何を買ったか」(T zombie vs R progressing 非対称解消)・24mo defense + 48/60mo 再読・blind 2-rater を registry 要件化・T regime 整合 (vignette→表 S_2)。COI 宣言ブロック。SM-D: **axis 7 アンカー 0-4 全公開 (gate=level 2)**・level 0 の2状態分離・相関測定 (one-office)・missing axis 除外理由。§7 bylaws-first → deal-rule 共進化 (MC5iii)。**AUTHOR-CONFIRM 9項目あり (HANDOFF 参照、まさ確認要)** |
| R11+R8 | ✅ 完了 | 2026-07-05 | **abstract 3段構造で確定** (問題→最強主張 = 「4要件+現場の2事実 ⇒ どんな重み付けでも不可能 + score-selection が Simpson 反転を製造」→生き残る設計、264w)。**§1 plain-language 段落** (数式ゼロ、「既にゲートする委員会はずっと正しかった」)。**§2 merger-in-the-wild** (web 照合済み: NIH 2025 簡素化改革 = Environment を数値スコアから外し sufficiency 判定へ / REF vs KEF = 英国が merger の両側を運用 / Grupp-Mogee・Grupp-Schubert)。§2 valley of death + Vohora-Wright-Lockett (§4 SH の実証裏付けにも)。§8 トーンダウン。**notation 整理完了** (gate score→ERS()・CES ρ→q・composite S→Z・Θ_k、SM-E 整理行)。References 62件。用語初出ガードは §1 既存定義で充足確認 |
| — (日付訂正) | ✅ | 2026-07-03 | **CX・SX の設立予定はともに 2027-03頃** (まさ確認 — 旧記載 CX 2026-08 / SX 2027-04 は古い)。Table 2 M 行 = 2027 (sched.) に修正、S5_REVISION_PLAN R10・HANDOFF・knowledge/ (cx.md / sx.md / su.md / partner_institutions.md) も同日修正。**R10 (OSF) は急がない** (期限 = 2027-03 設立判断前) |

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-03 | 新設。S1-S2 完了を記録、S3 起草順を固定 | えいみ |
| 2026-07-03 | S5後半開始。改稿実行ログ新設、R8+R6 の軽微修正分を記録 | えいみ |
| 2026-07-03 | R1 完了を記録。次の重量級 = R2 残り (certification effects 文献対峙・private price vs social value・graceful degradation) → R3/R4/R5 (新構造確定済みなので依存解消)。PREVIEW.html は R1 で本文が大きく変わったため stale (全改稿完了後に再生成) | えいみ |
| 2026-07-03 | R2 完了を記録 (certification 段落 + 引用3件 web 照合済み追加)。残 = R3/R4/R5 (相互独立、新構造確定済み) → R6 残り/R7 → R8 残り/R9 残り。R10 はまさ判断待ちで独立 | えいみ |
| 2026-07-03 | R3 完了 + CX/SX 設立予定の日付訂正 (2027-03頃、まさ確認) を記録。残 = R4/R5 → R6 残り/R7 → R8 残り/R9 残り。R10 は急がない (2027-03 前) | えいみ |
| 2026-07-05 | R4/R5 完了を記録 (S5後半セッション2)。**R11 (非専門家リーダビリティ) 新設** (まさ指示: 産連・VC 読者に最強主張が刺さる構造へ)。live GAP 残 1 件のみ (SM-B.7 instrument list = registered-program 委譲、査読者判定 acceptable)。語数: 本文 ~11.3k (要刈り込み)・References 58 (S6 照合待ち 18)。残 = R6 残り/R7 → R11+R8 → 語数再検量+PREVIEW 再生成 → S6 | えいみ |
| 2026-07-05 | R6 (rubric 値以外)/R7 完了 (同日セッション続行)。本文 ~14.6k words (計画的超過、S5 末に §3-§5→SM 逃がしで刈り込み)。**残 = ①まさ: rubric 校正セッション + AUTHOR-CONFIRM 9項目 ②R11+R8 ③刈り込み+PREVIEW ④S6**。R9 は R4/R5 で実質完了 (live GAP 1 = acceptable deferral) | えいみ |
| 2026-07-05 | R11+R8 完了 (同日3本目)。**S5 改稿は R10 (まさ判断) と rubric 校正 (まさの手) を除き全完了**。残 = 語数刈り込み (~15.1k→9.5-10k、§3-§5→SM 逃がし) + PREVIEW 再生成 → S6 (照合 22件 + instrument 書誌 + [verify at S6] 16 tags) | えいみ |
| 2026-07-09 | **語数刈り込み完了** (S5末)。本文 15.1k→9.9k (Word相当)。エージェント3体 (§3/§4/§5) 起草→検収 + えいみ直接圧縮 (§1/§2/§6/§7/§8 ×3ラウンド)。SM 受け皿8節新設・References 2リスト分割・Fig2 参照修理・fig1 表記更新・PREVIEW v0.6 再生成。**残 = ①まさ: rubric 校正 + AUTHOR-CONFIRM 9項目 ②R10 (OSF、2027-03 前) ③S6 投稿パッケージ** | えいみ |
| 2026-07-11 | **レンズ名改称** PRS→SPS / ERS→ECR (まさ確定、terminology_glossary §1.5) を本文・SM・S6パッケージ・図1-2・PREVIEW (v0.7) に適用。記号ラベルのみ、定理・式は不変 (機械検証)。§1/§3 に英語正式名 (seed prospect score / ecosystem construction rate) を追加、S6 abstract 案は正式名込み 249w に再調整。刈り込み後語数 (改称後): 9,951w (数式除外)。SM 書誌 FIX 2件反映。過去ログの旧記号は読み替え規律で据え置き | えいみ |
