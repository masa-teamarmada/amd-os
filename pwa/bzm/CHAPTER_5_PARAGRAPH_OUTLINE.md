# Ch 5: Triple Helix SSM と σ_SU の生成 — 段落 outline (28p, heavy 数学)

本章は、Atlas signals 速報値で観察される CX 領域 (S₁→S₂ 三位一体追い風) と YD 領域 (S₀ stuck) の対照を起点に、Triple Helix 三レーン (μ_A, μ_I, μ_G) を Cobb-Douglas (CD) 合成で σ_SU(t) に縮約し、Markov 切換え状態空間モデル (MS-SSM, K=3, OU 駆動) として正準化する。中核命題 5.1 (MS-SSM 過程定義) + 5.1b (CD 合成 operator G[μ_t; ω]) + 5.3b (逐次識別順序 μ_G→μ_A→μ_I) + 5.5 (Π^pre ≠ Π^post 二段不連続) + 5.6 (η_jt softmax coupling) + cross-walk 3 定理 (5.1.1-5.1.3) + 系 5.1.4 を提示。Tier A 規律 (D-031) に従い本章本体は記述的類型論と強い事前分布下の事後分布要約に留め、Ch 26b 事前登録対象として反証可能仮説 F-5.1〜F-5.6 を §5.7 で commission する。供給先: Ch 5.5 (GO ゲート), Ch 9 (二層非可換性), Ch 10.2 (Jovanovic), Ch 10.5 (Klepper 対称二相), Ch 10.7 (Murmann 双方向), Ch 11 (BVAR 同時推定 + horse-race), Ch 26b (Tier B 事前登録), Book 0 Ch 0.3 (系譜逆流), Book V (institutional constraint), Book VI (新領域宣言)。D-047 に従い証明は本文スケッチ (5-10 行) + 完全証明付録 A に分離。D-048 に従い Nelson-Winter 選抜環境節は §5.0 末尾 1 段落 + §5.3 冒頭 2 段落の計 3 段落で 1p 弱に圧縮し、本格展開は Book 0 Ch 0.3 へ逆流。D-034 に従い機関名は type 名のみで匿名化 (Research-Org-Type / Private-Engineering-Univ-Type / Regional-National-Univ-Type 群 / Integrated-Large-Univ-Type / International-TTO-Type)。

## §5.0 章頭フック — CX 三位一体加速 (S₁→S₂) と YD の P 律速 NO_GO (S₀ stuck) (2.5p)

### 5.0.1 二つの領域、同じ時刻、対照的なレジーム — 章頭問い
- **core_proposition**: 2020-23 年の同一窓に CX 系と YD 系を置き、片方では Triple Helix 三レーンが同期加速し σ_SU が観測史上最高水準、他方では政策密度 P が立ち上がらず σ_SU が低位に張り付いた事実を示し、同じ歴史時刻が異領域では異なる選抜圧として観測される問いを提示する。
- **figures**: 図 5.0.1 CX vs YD σ_SU 時系列 4 panel (P / B / V / σ_SU 合成、2020Q4-2023Q4、type 匿名化)
- **references**: Atlas signals CX 領域 P/N/R 速報値; AMD OS TripleHelixMatrix.tsx
- **math_objects**: σ_SU(t) 予告、μ_A, μ_I, μ_G 予告
- **cross_chapter_refs**: §5.3, §5.6, Ch 11
- **estimated_words**: 140

### 5.0.2 政策密度 P の段階的上昇 — 2020 年 10 月 CN 宣言を起点とする
- **core_proposition**: 2020 年 10 月 CN 宣言を起点として CX 系領域の政策密度 P_t が四半期単位で階段状に上昇した経緯を Atlas signals 速報値で素描する。μ_G の構成要素 P が外生ショックで離散ジャンプした記述的事実であり、§5.3 MS-SSM レジーム切換えの動機素材となる。
- **figures**: 図 5.0.2 CX 領域 政策密度 P_t 四半期階段プロット (CN 宣言・GX 移行債・GX-ETS・SIP CE 第3期注記入り)
- **references**: 菅義偉 (2020) 所信表明演説; 内閣府 SIP 第3期 CE2023 公募要領
- **math_objects**: μ_G の P 成分予告
- **cross_chapter_refs**: §5.3, §5.6
- **estimated_words**: 120

### 5.0.3 公募予算 B の並走立ち上げ — GX 経済移行債 / GX-ETS / SIP CE 第3期
- **core_proposition**: 2021-23 年に GX 経済移行債、GX-ETS、SIP CE 第3期が連続立ち上げされ、CX 系領域の公募予算 B_t が同期して上昇した事実を Atlas signals で示す。政策宣言 P と予算 B の同期は稀であり、これが三レーン共振の前提条件となった (Tier A、強い事前分布下の事後分布要約)。
- **figures**: 表 5.0.1 CX 系領域 主要公募 B イベント表 (2021-23、type 匿名化 LP 集合)
- **references**: 内閣府 SIP 第3期 CE2023 公募要領; Atlas signals CX 領域 B 速報値
- **math_objects**: μ_G の B 成分予告
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 130

### 5.0.4 産業 μ_I と学術 μ_A の連動上昇 — 政策-研究ラグの 4-6Q 縮減
- **core_proposition**: 同期間に CVC・VC の脱炭素配分 V_t がピーク、論文 N_t と研究費 I_R が連動上昇、政策ショック→研究応答ラグが通常の 8-12Q から 4-6Q に縮んだ事実を Atlas signals 横断で観察。μ_A・μ_I・μ_G の三レーンが同位相で動いた稀な瞬間の記述、§5.3 の S₂ 同定素材となる。
- **figures**: 図 5.0.3 μ_A (N, I_R), μ_I (V), μ_G (P, B) 三レーン時系列重ね描き、ラグ相関注記
- **references**: Atlas signals CX 領域 N / I_R / V 速報値
- **math_objects**: μ_A, μ_I, μ_G 三成分予告
- **cross_chapter_refs**: §5.2, §5.3
- **estimated_words**: 130

### 5.0.5 CX 系 σ_SU の本書最高水準到達 — S₂ レジームの予告
- **core_proposition**: 三レーン同期の結果、CX 系 σ_SU 観測値が本書 8 PJ 後付け校正の中で最高水準 (7 超) に達した事実を提示し、§5.3 で MS-SSM レジーム S₂ (三位一体追い風) に同定することを予告。Tier A illustrative example であり、validation でも因果効果主張でもない (D-031)。
- **figures**: 図 5.0.4 σ_SU(t) CX 系 vs 8 PJ 後付け校正ヒストグラム上の位置 (top decile)
- **references**: Atlas signals CX 領域 σ_SU 後付け校正; AMD OS TripleHelixMatrix.tsx
- **math_objects**: σ_SU(t) MS-SSM 予告、S₂ レジーム予告
- **cross_chapter_refs**: §5.3, §5.6, Ch 11, Ch 26b F-5.1
- **estimated_words**: 140

### 5.0.6 対照事例 YD — μ_G フラット、Cobb-Douglas 幾何平均構造による σ_SU 抑制
- **core_proposition**: 同期間の YD 系 PJ では P と B が立ち上がらず μ_G がフラット推移、CD 合成 σ_SU = Π_l (μ_l+1)^{ω_l} - 1 の幾何平均構造により、μ_A と μ_I がそれなりに動いていても σ_SU 全体が 3-4 に抑えられた事実を示す。CD の代替弾力性 1 の含意 (一レーン零近傍が全体を引きずる) の illustrative 導入。
- **figures**: 図 5.0.5 YD 系領域 μ_A / μ_I / μ_G 三レーン + σ_SU 合成時系列、CX との対比凡例
- **references**: Atlas signals YD 領域 P/N/R 速報値
- **math_objects**: CD 合成 G[μ_t; ω] 予告、命題 5.1b 予告
- **cross_chapter_refs**: §5.2, §5.3
- **estimated_words**: 150

### 5.0.7 YD の P 律速 NO_GO — σ_SU は必要条件にすぎない
- **core_proposition**: YD 系は AMD OS 上で UE (顧客発見/人材確保段階) が律速判定で NO_GO に留まった事実を匿名化スクショで示す。σ_SU 低位領域では当然 NO_GO だが、CX 系でも σ_SU 高位だけでは GO が自動成立せず、P (Problem-fit) ベクトルとの非可換結合が必要。σ_SU は GO の必要条件であって十分条件ではないという二層非可換性 (Ch 9) を体感させる。
- **figures**: 図 5.0.6 YD 系 PJ の AMD OS GO/NO_GO 判定パネル匿名化スクショ、UE 律速ハイライト、type 名のみ
- **references**: AMD OS TripleHelixMatrix.tsx; amd_score.md Triple Helix 観測モデル節
- **math_objects**: 二層非可換性予告、P_UE 律速予告
- **cross_chapter_refs**: Ch 6, Ch 9, Ch 5.5
- **estimated_words**: 160

### 5.0.8 レジーム S₀ stuck / S₁ 中位 / S₂ 三位一体追い風 — K=3 MS-SSM の物語的予告
- **core_proposition**: YD 系を S₀ stuck、CX 系の 2020-21 移行期を S₁、2022-23 期を S₂ と読む K=3 レジーム MS-SSM の物語的予告。K=3 は D-045 に従い §5.3 で pre-commit、Ch 11 で K∈{2,3,4} horse-race 実施を宣言。
- **figures**: 図 5.0.7 S₀ / S₁ / S₂ 三レジーム概念図 (CX 時系列上に S₁→S₂ transition、YD 上に S₀ stuck 符号注記)
- **references**: Hamilton-Kim filter 教科書
- **math_objects**: MS-SSM K=3 予告、命題 5.1 予告
- **cross_chapter_refs**: §5.3, Ch 11, Ch 26b F-5.1
- **estimated_words**: 130

### 5.0.9 Triple Helix 三レーン同時駆動の稀少性 — Markov イベントとしての記述妥当性
- **core_proposition**: Etzkowitz-Leydesdorff Triple Helix が同位相同時駆動する瞬間は経済史的に稀であり、これを連続時間拡散 (単純 OU) ではなくレジーム切換え内蔵 MS-SSM で記述する選択が、Markov 構造化された稀少イベントの統計言語として妥当であることを宣言する。Etzkowitz vs Leydesdorff 系譜整理は Book 0 Ch 0.3 へ逆流委託。
- **figures**: なし
- **references**: Etzkowitz & Leydesdorff (2000) Research Policy; Leydesdorff (2021) JASIST
- **math_objects**: MS-SSM 設計動機
- **cross_chapter_refs**: §5.3, Book 0 Ch 0.3
- **estimated_words**: 120

### 5.0.10 Nelson-Winter 選抜環境への意味論的橋渡し — σ_SU は選抜強度のスカラー要約 [D-048 圧縮 1/3]
- **core_proposition**: σ_SU は Nelson-Winter (1982) 進化経済学的選抜環境 (selection environment) 強度を単一スカラーに要約する写像であり、lane-specific (μ_A, μ_I, μ_G) は選抜の異質性 (どのレーンが選抜していたか) を保存する。本格展開は Book 0 Ch 0.3 へ逆流委託し、本章では参照と概念橋渡しのみ (D-048)。§5.3 冒頭で再訪。
- **figures**: なし
- **references**: Nelson & Winter (1982); Dosi (1982) Research Policy
- **math_objects**: σ_SU の意味論的位置づけ
- **cross_chapter_refs**: §5.3 冒頭, Book 0 Ch 0.3
- **estimated_words**: 140

### 5.0.11 本章境界宣言 — Ch 5 の射程と他章への委託
- **core_proposition**: Ch 5 が扱うのは σ_SU の生成過程 (DGP) のみであり、GO ゲート閾値 θ_σ* の最適停止理論は Ch 5.5、二層非可換性の代数構造は Ch 9、Jovanovic / Klepper / Murmann 拡張は Ch 10.2 / 10.5 / 10.7、BVAR 推定実装と horse-race は Ch 11、F-5.1〜F-5.6 反証可能仮説の事前登録は Ch 26b に委ねる章分担を読者に明示する。
- **figures**: 表 5.0.2 Ch 5 章間 supply 表 (送り先章 × supply 内容)
- **references**: なし
- **math_objects**: 章間 supply 全体
- **cross_chapter_refs**: Ch 5.5, Ch 9, Ch 10.2, Ch 10.5, Ch 10.7, Ch 11, Ch 26b
- **estimated_words**: 130

### 5.0.12 §5.1-§5.7 load-bearing 命題の一行予告
- **core_proposition**: 本章で提示する load-bearing 命題 5.1 (σ_SU MS-SSM 定義), 命題 5.1b (CD 合成 operator G[μ_t; ω]), 命題 5.3b (逐次識別順序 μ_G→μ_A→μ_I), 命題 5.5 (Π^pre/Π^post 二段識別), 命題 5.6 (η_jt softmax coupling), cross-walk 三定理 (定理 5.1.1-5.1.3) + 系 5.1.4 を各一行で予告し、§5.1 の方法論 pre-commit (証明スケッチ本文 + 完全証明付録 A, D-047) に橋渡しする。
- **figures**: なし
- **references**: なし
- **math_objects**: 命題 5.1, 5.1b, 5.3b, 5.5, 5.6; 定理 5.1.1-5.1.3; 系 5.1.4
- **cross_chapter_refs**: §5.1, 付録 A
- **estimated_words**: 130

## §5.1 Triple Helix 相互情報 T(AIG) と Cobb-Douglas σ_SU の cross-walk 三定理 (5p)

### 5.1.1 §5.1 冒頭 pre-commit: 証明スケッチ本文 + 完全証明付録 A 方針
- **core_proposition**: D-047 に従い Book II 中核を支える Ch 5 では本文に statement と 5-10 行の証明スケッチのみを置き、完全証明は付録 A に配置する方針をここで pre-commit。judge A の『heavy 数学節の可読性』と judge B の『反証可能性のための証明完全性』を同時に満たす章運営規律で、§5.1-§5.5 の全命題・定理・補題・系に一律適用する。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: 付録 A, §5.2, §5.3, §5.4, §5.5
- **estimated_words**: 150

### 5.1.2 Tier A 規律と用語選択の宣言
- **core_proposition**: §5.1 三定理は D-031 Tier A の射程に留まり、『校正』『観測等価類の中心』『強い事前分布下の事後分布要約』の語彙で記述。『validation』『識別された因果効果』叙述は §5.7 で commission する Ch 26b 反証可能仮説 F-5.1〜F-5.6 の事前登録経由でのみ Tier B として許容され、§5.1 本体では cross-walk 三定理を表現変換の数学的事実として提示する。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Ch 26b, Ch 11
- **estimated_words**: 140

### 5.1.3 Leydesdorff (2003) T(AIG) の情報理論的書き下し
- **core_proposition**: Leydesdorff (2003 RP 32(3)) Triple Helix 相互情報量 T(AIG) = H(A)+H(I)+H(G) - H(AI) - H(AG) - H(IG) + H(AIG) を書き下し、負値が redundancy/シナジー (Theil 1972) を示す符号規約を確認。BZM が引き継ぐ唯一の量的装置であり、本書は『置き換える』のではなく『cross-walk する』立場を宣言。
- **figures**: 式 5.1.1 T(AIG) の情報理論的展開式と符号規約
- **references**: Leydesdorff (2003) RP 32(3); Theil (1972); Cover & Thomas (2006)
- **math_objects**: 式 5.1.1
- **cross_chapter_refs**: Book 0 Ch 0.3, 付録 A
- **estimated_words**: 180

### 5.1.4 Leydesdorff (2008) 改訂版と三国比較方法論
- **core_proposition**: Leydesdorff (2008 JASIST / RP) 改訂版 T(AIG) と三国比較方法論を要約、university-industry-government 三系を citation 共起から復元する標準パイプラインを整理。BZM はこの方法論的継承を明示しつつ、観測量を citation から事業化観測量 (P/B/V/R/I_R/N/C) に差し替える点で分岐することを 5.1.5 で展開する伏線とする。
- **figures**: なし
- **references**: Leydesdorff (2008) JASIST; Leydesdorff (2008) RP
- **math_objects**: なし
- **cross_chapter_refs**: §5.2
- **estimated_words**: 140

### 5.1.5 Park-Leydesdorff (2010) 韓国 proxy vs BZM 観測量の構造的非対称
- **core_proposition**: Park & Leydesdorff (2010 JOI) 韓国 citation-based proxy は『科学計量量で Triple Helix を観測する』設計、BZM 7 観測量 (P/B/V/R/I_R/N/C) は『事業化追い風強度』を観測する設計であり、観測対象の存在論的水準が異なる。観測量割り付けの非対称性が、5.1.10/5.1.13 の『MI と CD が異なる対象を測る』根拠となる。
- **figures**: 表 5.1.1 Park-Leydesdorff vs BZM 観測量対応表
- **references**: Park & Leydesdorff (2010) JOI
- **math_objects**: なし
- **cross_chapter_refs**: §5.2, §5.6
- **estimated_words**: 170

### 5.1.6 Etzkowitz 系譜と Leydesdorff 系譜の二分・BZM の位置取り
- **core_proposition**: Leydesdorff-Strand (2013) ノルウェー応用 (Leydesdorff 系: 定量装置志向) と Etzkowitz (2008 The Triple Helix) Entrepreneurial University モデル (Etzkowitz 系: 制度的志向) を二系統として整理。BZM は『institutional grounding は Etzkowitz 系を、定量装置は Leydesdorff 系を継承し、両者を CD operator で接合する第三の道』を採る立場を宣言。系譜の本格展開は Book 0 Ch 0.3 へ逆流。
- **figures**: 図 5.1.1 Triple Helix 文献系譜図 (Etzkowitz 系 vs Leydesdorff 系 vs BZM 接合)
- **references**: Leydesdorff & Strand (2013) RP; Etzkowitz (2008); Etzkowitz & Leydesdorff (2000) RP
- **math_objects**: なし
- **cross_chapter_refs**: Book 0 Ch 0.3, Ch 10.7
- **estimated_words**: 180

### 5.1.7 BZM σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1 の再掲と CD 幾何平均の経済学的根拠
- **core_proposition**: σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1 を amd_score.md から再掲。CD 幾何平均を採用する 3 つの経済学的根拠 — (i) Inada 条件型の補完性 (どれか一系がゼロなら σ_SU=0)、(ii) extreme-aversion (1 軸突出より三軸平均が報われる)、(iii) 対数加法性 (§5.3 OU 駆動 MS-SSM と相性が良い) — を述べる。+1 offset は μ_x∈[0,9] スコアの境界処理。
- **figures**: 式 5.1.2 σ_SU 定義式と境界条件
- **references**: なし
- **math_objects**: 式 5.1.2、命題 5.1b (§5.3 で formal)
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 190

### 5.1.8 対数線形展開 ξ_x = log(μ_x+1) と Gaussian 近似親和性
- **core_proposition**: 対数変換 ξ_x := log(μ_x+1) を導入すると log(1+σ_SU) = (1/3)(ξ_A+ξ_I+ξ_G) と書き換わり、σ_SU は対数空間で線形合成となる。log-linear 性は §5.3 MS-SSM が ξ-座標で Gaussian 駆動 OU 過程として閉じる理由であり、Kalman / Hamilton-Kim filter の適用可能性を担保する。ω=(1/3,1/3,1/3) は『観測等価類の中心』として参照、領域依存 ω は Ch 11 で IV 推定 (D-046)。
- **figures**: 式 5.1.3 対数線形展開と一般 ω の CD operator G[μ;ω]
- **references**: なし
- **math_objects**: 式 5.1.3、命題 5.1b
- **cross_chapter_refs**: §5.2, §5.3, Ch 11
- **estimated_words**: 190

### 5.1.9 定理 5.1.1 (一般 monotone 不成立) statement と反例構成
- **core_proposition**: 定理 5.1.1: 確率変数 (A,I,G) の joint distribution 集合 𝒫 上で T(AIG) と log(1+σ_SU) は一般に monotone 関係を持たない。P, Q ∈ 𝒫 で T(AIG)|_P < T(AIG)|_Q かつ log(1+σ_SU)|_P > log(1+σ_SU)|_Q を満たす組が存在。証明スケッチ: 2 点分布 (確率 1/2 で (9,9,9)、1/2 で (0,0,0)) と 一様分布を比較し T(AIG) と σ_SU が逆順位を取る具体例を構成 (詳細付録 A.5.1.1)。
- **figures**: 表 5.1.2 定理 5.1.1 反例分布の値 (H(A), H(AI), T(AIG), σ_SU 数値)
- **references**: Cover & Thomas (2006)
- **math_objects**: 定理 5.1.1, 付録 A.5.1.1
- **cross_chapter_refs**: 付録 A, Ch 11
- **estimated_words**: 210

### 5.1.10 定理 5.1.1 の系: 独立性下での退化と概念分離
- **core_proposition**: 系 5.1.1: P(A,I,G) = P(A)P(I)P(G) 独立性下では T(AIG) = 0 となるが、log(1+σ_SU) = (1/3)Σ E[ξ_x|_marginal] は周辺分布の対数平均に帰着。MI が完全に退化する地点で CD は依然として正値を取り、両者が異なる対象 (前者: 結合構造、後者: 周辺水準) を測ることが明示される。
- **figures**: なし
- **references**: なし
- **math_objects**: 系 5.1.1
- **cross_chapter_refs**: §5.6, 付録 A
- **estimated_words**: 150

### 5.1.11 定理 5.1.2 (感度方向の直交性) statement
- **core_proposition**: 定理 5.1.2: 摂動方向 v ∈ ℝ³ に対する T(AIG) と log(1+σ_SU) の方向微分は一般に直交する。具体的には (i) 一様増分 v = (1,1,1) の下で d log(1+σ_SU)/dε > 0 (線形)、d T(AIG)/dε = 0、(ii) ピーク偏在 v = (3,0,0) の下で d log(1+σ_SU)/dε は対数線形、T(AIG) は U-shape を取る。証明スケッチは Jensen 不等式と H の concavity から 4 行で導かれる (完全証明付録 A.5.1.2)。
- **figures**: 図 5.1.2 感度方向直交性: (μ_A, μ_I, μ_G) 空間の T(AIG) と log(1+σ_SU) 等高線 4 panel
- **references**: なし
- **math_objects**: 定理 5.1.2, 付録 A.5.1.2
- **cross_chapter_refs**: 付録 A, Ch 11
- **estimated_words**: 220

### 5.1.12 定理 5.1.2 の政策含意: 異なる目的関数を最適化している
- **core_proposition**: 定理 5.1.2 の含意として、T(AIG) を最大化する政策設計 (三系の結合度を上げる施策) と σ_SU CD を最大化する政策設計 (三系の水準を均等に底上げする施策) は数学的に異なる目的関数を最適化している。これは Ch 11 で『どちらが事業化結果を説明するか』を horse-race する理論的根拠を与える。Tier A 規律に従い『どちらが正しいか』ではなく『異なる対象を測る二つの装置である』と表現する。
- **figures**: なし
- **references**: なし
- **math_objects**: 定理 5.1.2
- **cross_chapter_refs**: Ch 11, §5.7, Ch 26b
- **estimated_words**: 160

### 5.1.13 定理 5.1.3 (概念的非等価): 表現変換であって理論的等価ではない
- **core_proposition**: 定理 5.1.3: T(AIG) は『redundancy/シナジーの符号付き量』を測る装置、σ_SU CD は『事業化追い風強度』を測る装置であり、両者の cross-walk (5.1.8 対数線形展開) は座標変換であって理論的等価性ではない。よって BZM の主張は『MI を CD に置き換える』のではなく『事業化用途では CD を、結合構造解析用途では MI を、目的に応じて選択する』というメタ理論的立場である。
- **figures**: なし
- **references**: なし
- **math_objects**: 定理 5.1.3
- **cross_chapter_refs**: §5.6, Book VI
- **estimated_words**: 170

### 5.1.14 系 5.1.4 (局所単調等価): 等価点の存在と Jensen 不等式
- **core_proposition**: 系 5.1.4: entropy unit を bit で固定し、ω=(1/3,1/3,1/3) かつ A,I,G が独立で同分布のとき、T(AIG) と log(1+σ_SU) は同じ単調変換族 {α log(1+σ_SU)+β : α>0} に属する局所等価点が存在する。証明スケッチ: 独立性下で H(AIG) = Σ H(x) より T(AIG) は H の対称関数に退化し、Jensen 不等式から log(1+σ_SU) の対称関数表現と単調一致する (詳細付録 A.5.1.3、補題 5.4 として参照)。
- **figures**: なし
- **references**: なし
- **math_objects**: 系 5.1.4, 補題 5.4, 付録 A.5.1.3
- **cross_chapter_refs**: 付録 A, §5.3
- **estimated_words**: 200

### 5.1.15 BZM が CD を主装置に採用する 4 つの理由
- **core_proposition**: 以上を踏まえ BZM が σ_SU CD を主装置に採用する 4 つの理由を整理する: (i) 経済学的補完性 (Inada 条件の自然な具体化)、(ii) 0-9 スコアとの整合 (境界処理を +1 offset で素直に解決)、(iii) §5.3 SSM 識別補題への接続性 (ξ 座標で Gaussian 駆動が閉じる)、(iv) §5.3 で導入する K=3 regime-switching 拡張 (D-045) との両立。MI はこれら 4 条件のいずれにも構造的に応えない。
- **figures**: 表 5.1.3 CD vs MI の 4 評価軸比較表
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.3, §5.6
- **estimated_words**: 180

### 5.1.16 Ch 11 horse-race protocol の予告 (§5.7 で commission)
- **core_proposition**: §5.1 を閉じるにあたり、T(AIG) baseline を MS-SSM (K=3, D-045) / AR(1) / random walk / 連続時間 Gaussian 状態空間モデルと並列に推定し、AIC / BIC / log-marginal-likelihood で比較する常時併走 horse-race protocol を Ch 11 に commission する旨を予告する。formal commission 文と F-5.1〜F-5.6 反証可能仮説の事前登録 (OSF) は §5.7 で行う。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Ch 11, Ch 26b
- **estimated_words**: 140

### 5.1.17 BZM の Triple Helix 文献への貢献 1 を明示
- **core_proposition**: §5.1 を経て BZM の Triple Helix 文献への貢献 1 として『事業化用途では MI ではなく CD を採用する理論的根拠 (定理 5.1.1-5.1.3 + 系 5.1.4)』を打ち立てる。残る貢献 2 (institutional grounding を Etzkowitz 系から、定量装置を Leydesdorff 系から接合) および貢献 3 (K=3 regime-switching 拡張) は §5.6 と §5.3 で完成し、Book VI 新領域宣言へ逆流する。§5.7 で 3 貢献を確定する。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.3, §5.6, §5.7, Book VI
- **estimated_words**: 160

## §5.2 観測方程式と loading matrix C — 三段識別と Phase 2 欠損下の識別パワー (5p)

### 5.2.1 観測量 7 種のデータソース別再整理 — Atlas / KAKEN / OpenAlex / 民間 DB の周波数とセクター・レーン
- **core_proposition**: BZM 観測ベクトル y_t = (P, B, V, R, I_R, N, C_compete) を出所別に層化し、四半期化済 16Q パネルへの集約規則と sector lane 帰属を表に固定する。Phase 1 で実装済みは P/N/R、Phase 2 commission は B/V/I_R/C である。
- **figures**: 表 5.2.1 7 観測量 × {データソース, 観測周波数, sector lane, Phase 1/2 status}
- **references**: amd_score.md; score-and-bottleneck.md; AMD OS TripleHelixMatrix.tsx
- **math_objects**: なし
- **cross_chapter_refs**: Book 0 Ch 0.5, Book V Ch 21
- **estimated_words**: 140

### 5.2.2 16Q 標準化 ỹ_p ∈ [0,9] と μ_x support 制約 — logistic link / censored OU 過程の脚注
- **core_proposition**: 前処理として各観測量を 16Q 期間内 min-max 標準化して ỹ_p ∈ [0,9] に揃え、潜在状態 μ_x ∈ [0,9] support 制約を logistic link または censored OU 過程で吸収する。cross-cutting concern #1 (境界吸収) は後者を選好する旨を脚注で pre-commit。
- **figures**: なし
- **references**: amd_score.md; Durbin & Koopman (2012)
- **math_objects**: support 制約 μ_x ∈ [0,9]
- **cross_chapter_refs**: §5.3, 付録 A
- **estimated_words**: 130

### 5.2.3 観測方程式 y_t = C μ_t + D x_t + ε_t の行列形式
- **core_proposition**: 観測方程式を y_t ∈ R^7 = C μ_t + D x_t + ε_t, ε_t 〜 N(0,R), μ_t = (μ_A, μ_I, μ_G)' と書き下し、C は 7×3 loading 行列、D は外生コントロール (時間 trend, セクター固定効果) の係数行列、R は対角ベースラインとする。
- **figures**: 式 5.2.1 観測方程式の行列形式 (次元注記付き)
- **references**: Harvey (1989); Durbin & Koopman (2012)
- **math_objects**: 観測方程式 (5.2.1)
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 130

### 5.2.4 現行 loading prior 行列 C の正本記法 — amd_score.md からの転記と行和正規化
- **core_proposition**: 現行実装 (P→μ_G=0.95, B→μ_G=0.85, V→μ_I=0.85, R→{μ_A=0.40, μ_I=0.35, μ_G=0.30}, I_R→{μ_A=0.70, μ_G=0.40}, N→μ_A=0.90, C→μ_I=0.85) を行和正規化 Σ_p c_xp=1 を適用した形で正本記法に整える。これは scale 識別問題の解消条件である (補題 5.3 参照)。
- **figures**: 表 5.2.2 loading 行列 C (7行×3列) の現行 prior 値、行和正規化後の値、出所列
- **references**: amd_score.md
- **math_objects**: 行和正規化 Σ_p c_xp=1
- **cross_chapter_refs**: Ch 11
- **estimated_words**: 130

### 5.2.5 loading 構造の領域別正当化 — P/B→μ_G、N/I_R→μ_A、V/C→μ_I の領域論拠
- **core_proposition**: P (政策密度) と B (補正予算) が μ_G に dominant に load するのは政策科学的正当化、N (論文・引用) と I_R (KAKEN 採択) が μ_A に dominant に load するのは学術 productivity 正当化、V (VC 投資) と C (競合密度) が μ_I に dominant に load するのは産業 market signal 正当化、R (PR・メディア露出) は横断 attention signal として三レーンに分散する。
- **figures**: なし
- **references**: 内閣府 SIP CE2023 連結ダイナミクス資料; Park & Leydesdorff (2010) JASIST
- **math_objects**: なし
- **cross_chapter_refs**: Book V Ch 22
- **estimated_words**: 140

### 5.2.6 機関 ERS 8軸の sector lane 制約が観測方程式に impose する institutional constraint
- **core_proposition**: 機関 j (Research-Org-Type / Private-Engineering-Univ-Type / Regional-National-Univ-Type 群 / Integrated-Large-Univ-Type / International-TTO-Type) ごとに sector lane が事前指定されているとき、機関 j に紐づく観測量の loading は j の lane 配分 (PRS/ERS) に追随する制約を formal に書く。これにより rank 3 条件が補強される。
- **figures**: 式 5.2.2 機関 ERS 制約 c^{(j)}_{xp} = c_{xp} · π_j(p)
- **references**: なし
- **math_objects**: 機関 ERS 制約式
- **cross_chapter_refs**: Book V Ch 21, Ch 10.7
- **estimated_words**: 150

### 5.2.7 内閣府 SIP CE2023 5RL 体系と Park-Leydesdorff citation proxy の比較 — institutional grounding の優越
- **core_proposition**: SIP CE2023 の 5 Readiness Level (BRL/GRL/SRL/HRL/TRL) を μ_G の P/B 観測に紐付け、Park-Leydesdorff (2010) の citation-based proxy より institutional grounding が強い (= rank 不足を起こしにくい) ことを比較表で示す。これは BZM の Triple Helix 文献への identification 論的貢献の準備である。
- **figures**: 表 5.2.3 Park-Leydesdorff proxy vs BZM 7観測 × 5RL 紐付け
- **references**: Park & Leydesdorff (2010) JASIST; 内閣府 SIP CE2023 連結ダイナミクス資料
- **math_objects**: なし
- **cross_chapter_refs**: Book VI
- **estimated_words**: 150

### 5.2.8 補題 5.3 (識別可能性): scale / rotation / permutation 三段不可識別の解消条件
- **core_proposition**: 補題 5.3 の formal statement を提示する。観測方程式 y_t = C μ_t + ε_t は (i) scale 不変 (Cα^{-1})(αμ_t)、(ii) rotation 不変 (CQ^{-1})(Qμ_t)、(iii) permutation 不変 (CΠ^{-1})(Πμ_t) の三段の不可識別を持つが、(i) 行和正規化 + (ii) 符号制約 (P↑⇒μ_G↑, V↑⇒μ_I↑, N↑⇒μ_A↑) の anchor restriction + (iii) latent ラベル anchor で局所識別可能となる。
- **figures**: 補題 5.3 三段識別補題の statement
- **references**: Komunjer & Ng (2011) Econometrica; Bai & Wang (2015) RES; Rubio-Ramírez, Waggoner, Zha (2010) RES
- **math_objects**: 補題 5.3
- **cross_chapter_refs**: 付録 A
- **estimated_words**: 200

### 5.2.9 補題 5.3 の証明スケッチ — anchor restriction の構成と Komunjer-Ng 識別条件への翻訳
- **core_proposition**: 証明スケッチ (5-10 行) として、行和正規化により scale 自由度を吸収、anchor 観測 (P, V, N) の符号制約から rotation 自由度を一意化、latent ラベル anchor で permutation を解消する三段論法を示し、Komunjer-Ng (2011) の DSGE 識別条件への帰着を確認する。完全証明は付録 A.5.3 に委ねる旨を明示 (D-047 pre-commit)。
- **figures**: なし
- **references**: Komunjer & Ng (2011) Econometrica
- **math_objects**: 補題 5.3 の証明スケッチ
- **cross_chapter_refs**: 付録 A.5.3
- **estimated_words**: 180

### 5.2.10 命題 5.3b (逐次識別順序の一意性): μ_G → μ_A → μ_I
- **core_proposition**: 命題 5.3b の statement: 機関 ERS lane 制約と loading 行列 C の符号構造 + rank 3 条件の下で、逐次識別順序 μ_G → μ_A → μ_I が一意に決まる。証明スケッチでは P/B が μ_G にほぼ純粋に load することで μ_G が最初に identify、N/I_R が μ_A を逐次識別、残差として μ_I が V/C で識別される構成的順序を示す。
- **figures**: 命題 5.3b 逐次識別順序の一意性命題と構成的証明スケッチ
- **references**: なし
- **math_objects**: 命題 5.3b
- **cross_chapter_refs**: Ch 11, 付録 A.5.3b
- **estimated_words**: 200

### 5.2.11 Triple Helix 文献への identification 論的貢献 — rank 3 成立性の institutional 多様性論拠
- **core_proposition**: Park-Leydesdorff の citation-based proxy では観測行列が rank 不足になりやすいのに対し、BZM の 7 観測 (P/B/V/R/I_R/N/C) は institutional 多様性 (5 機関 type × 7 観測) によって rank 3 が安定的に成立しやすい。これは Triple Helix 文献への BZM 三貢献の第一 (identification) として §5.7 で正式宣言、Book VI で逆流する。
- **figures**: なし
- **references**: Park & Leydesdorff (2010) JASIST; Leydesdorff & Etzkowitz (2003) RP
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Book VI, Book 0 Ch 0.3
- **estimated_words**: 140

### 5.2.12 Cobb-Douglas weight ω の識別問題と政策ショック IV 戦略
- **core_proposition**: CD 合成 weight ω = (ω_A, ω_I, ω_G), Σω_x = 1 は三つの latent が同期して動くと観測等価類の中で分離不能である。識別戦略として政策ショック (補正予算サプライズ、SIP 公募タイミング) を μ_G にのみ直接効き μ_A/μ_I には lag 経由でしか効かない外生変動として操作変数 (IV) に用いる。D-046 を formal に組み込む。
- **figures**: 図 5.2.1 ω 識別 DAG: 政策ショック → μ_G (即時) → μ_A/μ_I (lag) → σ_SU
- **references**: Stock & Watson (2016) Handbook of Macro
- **math_objects**: IV 識別条件 E[政策ショック × μ_A^pre] = 0
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 180

### 5.2.13 ω=(1/3,1/3,1/3) baseline は観測等価類の中心としての参照点 — 領域依存性は F-5.5 commission
- **core_proposition**: baseline ω=(1/3,1/3,1/3) は「強い事前分布下の事後分布要約」として観測等価類の中心に置く参照点である (Tier A 規律)。推定 ω との乖離と領域依存性 (CX vs YD vs DeepTech vs Bio) は反証可能仮説 F-5.5 として §5.7 経由で Ch 26b 予測登録簿に Tier B 事前登録される。D-046 pre-commit。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Ch 11, Ch 26b
- **estimated_words**: 130

### 5.2.14 Phase 2 欠損の missing observation matrix M_t 表現と Kalman update のスキップ
- **core_proposition**: Phase 2 未実装の B/V/I_R/C は missing observation indicator M_t ∈ {0,1}^7 で表現し、観測方程式を y_t^obs = M_t ⊙ (C μ_t + D x_t + ε_t) と書き換える。Kalman filter は M_t の 0 成分について Kalman gain を強制ゼロ化して観測 update をスキップし、状態推定は予測 step のみで進める仕組みを示す。
- **figures**: 式 5.2.3 missing observation matrix M_t を持つ Kalman update 式
- **references**: Durbin & Koopman (2012); Harvey (1989)
- **math_objects**: missing observation Kalman update
- **cross_chapter_refs**: 付録 A
- **estimated_words**: 150

### 5.2.15 補題 5.4 (missing 観測下の識別パワー): μ_G/μ_A は消費的に識別、μ_I は事前依存
- **core_proposition**: 補題 5.4 の statement: N=8 PJ × 16Q かつ B/V/I_R/C 欠損の Phase 1 データ環境下では、(μ_G, μ_A) は P/N/R の available 観測で消費的に識別 (posterior 分散が事前分散より厳密に小さい) されるが、μ_I の posterior は事前分布に漸近的に依存する。証明スケッチは Fisher information 行列の rank 検査から構成的に与える。なお 5.1.14 で参照される系 5.1.4 とは別物 (本書では補題 5.4 を §5.2 識別パワー、系 5.1.4 を §5.1 局所単調等価として運用)。
- **figures**: 補題 5.4 missing 観測下識別パワー補題と証明スケッチ
- **references**: Bai & Wang (2015) RES
- **math_objects**: 補題 5.4, Fisher information 行列 rank
- **cross_chapter_refs**: 付録 A.5.4, Ch 11
- **estimated_words**: 180

### 5.2.16 Atlas J 機関拡張による O(J) 識別パワー改善と Ch 11 への機関数選択要求
- **core_proposition**: Atlas signals の J 機関 × 8 PJ パネル化により、Fisher information 行列の固有値が概ね O(J) で増加し μ_I の posterior 分散も O(J^{-1}) で縮小することを示す。Ch 11 BVAR 推定の標本識別パワー目標から逆算した必要機関数 J* の計算指針を §5.7 経由で commission する。
- **figures**: 図 5.2.2 J × posterior 分散縮小カーブ (μ_G/μ_A/μ_I 別、log-log スケール)
- **references**: Bai & Wang (2015) RES; Stock & Watson (2016)
- **math_objects**: O(J) 識別パワー改善
- **cross_chapter_refs**: Ch 11, §5.7
- **estimated_words**: 160

### 5.2.17 観測誤差 R の対角性 baseline と Phase 3 off-diagonal 拡張 (P-B 連動) の境界宣言
- **core_proposition**: 観測誤差共分散 R は政策密度測定 (P) と論文計量 (N) が独立データソースに由来することから対角性を baseline 仮定とする。ただし P-B (政策密度と補正予算) は同一政策イベントを反映する可能性があるため、Phase 3 では R の対角外要素 r_{PB} を許容する拡張を行う旨を境界として宣言する。
- **figures**: なし
- **references**: Harvey (1989)
- **math_objects**: R = diag(σ_P^2, ..., σ_C^2) baseline
- **cross_chapter_refs**: Ch 11, Book V
- **estimated_words**: 130

### 5.2.18 loading prior の事前分布 sensitivity と Dirichlet prior 拡張への移行設計
- **core_proposition**: Phase 1 データ量では loading 行列 C の posterior が prior に過剰依存する懸念があるため、まず C を fixed-point 推定で扱い、Ch 11 で simplex 上 Dirichlet prior 拡張 (各行 c_x · 〜 Dir(α_x)) に移行する設計を予告する。sensitivity 検査の robustness 仕様も §5.7 経由で Ch 11 へ commission する。
- **figures**: 図 5.2.3 loading 行 c_x · が simplex Δ^2 上で Dirichlet 揺らぐ概念図
- **references**: Stock & Watson (2016)
- **math_objects**: c_x · 〜 Dir(α_x)
- **cross_chapter_refs**: Ch 11, §5.7
- **estimated_words**: 160

## §5.3 σ_SU の Markov 切換え状態空間モデル正準形 (K=3 regime, OU 駆動) (5p)

### 5.3.1 Nelson-Winter 選抜環境を σ_SU の意味論的母体として位置付ける [D-048 圧縮 2/3]
- **core_proposition**: σ_SU(t) の3軸 (μ_A, μ_I, μ_G) は Nelson & Winter (1982) 選抜環境 (selection environment) における外的圧力ベクトルの観測代理であり、本章では数式装置として最小限に圧縮し、本格的進化経済学的展開は Book 0 Ch 0.3 へ逆流する旨を D-048 に従い宣言する (§5.0.10 と合わせて 3 段落計の 2 つ目)。
- **figures**: なし
- **references**: Nelson & Winter (1982) Ch 6-10; Dosi (1982) RP
- **math_objects**: なし
- **cross_chapter_refs**: Book 0 Ch 0.3, §5.0 末尾
- **estimated_words**: 140

### 5.3.2 Schumpeter → Nelson-Winter → Dosi → Malerba 系譜の 1 段落整理 [D-048 圧縮 3/3]
- **core_proposition**: Schumpeter 創造的破壊を Nelson-Winter が個体群動態に翻訳し、Dosi の technological paradigm が paradigm-shift を構造化、Malerba の sectoral innovation system が selection を産業横断的に分節化したという系譜を 1 段落で整理し、3軸ベクトルが selection の3チャネル (Academic / Industrial / Governmental) として読めることを確認する。これで D-048 の §5.0+§5.3 計 3 段落圧縮が完了する。
- **figures**: なし
- **references**: Schumpeter (1942); Nelson & Winter (1982); Dosi (1982) RP; Malerba (2002) RP
- **math_objects**: なし
- **cross_chapter_refs**: Book 0 Ch 0.3
- **estimated_words**: 150

### 5.3.3 状態ベクトル μ_t と支持域 [0,9]^3 の確認
- **core_proposition**: 状態ベクトル μ_t = (μ_A(t), μ_I(t), μ_G(t))^T を連続時間潜在過程として定義し、支持域 [0,9]^3 は §5.2 の link function (logit-9 変換) によって担保されることを再掲、本節以降は変換後の実線空間で SDE を書くことを宣言する。
- **figures**: なし
- **references**: なし
- **math_objects**: 公式 5.3.1 (μ_t 状態ベクトル定義)
- **cross_chapter_refs**: §5.2
- **estimated_words**: 130

### 5.3.4 regime 指示変数 r_t ∈ {S₀, S₁, S₂} の導入と §5.0 narrative との紐付け
- **core_proposition**: regime 指示変数 r_t ∈ {S₀ 沈静, S₁ 中位, S₂ 三位一体追い風} を K=3 の離散潜在変数として導入し、§5.0 章頭の CX 領域 (S₁→S₂ 推移) と YD 領域 (S₀ stuck) の illustrative narrative に対応付け、regime が観測不可能な latent state であることを D-031 Tier A の射程内で強調する。
- **figures**: 図 5.3.1 K=3 regime 位相空間配置概念図 (μ_A-μ_I-μ_G 三軸上に S₀/S₁/S₂ attractor、CX-YD パスを軌道)
- **references**: なし
- **math_objects**: 定義 5.3.1 (regime 指示変数)
- **cross_chapter_refs**: §5.0, §5.6
- **estimated_words**: 160

### 5.3.5 各 regime での連続時間 Ornstein-Uhlenbeck SDE
- **core_proposition**: 各 regime r ∈ {S₀, S₁, S₂} での μ_t の連続時間動学を多変量 Ornstein-Uhlenbeck 過程 dμ_t = κ_r (θ_r - μ_t) dt + Σ_r^{1/2} dW_t として書き下し、平均回帰行列 κ_r、長期平均 θ_r、拡散行列 Σ_r が regime 依存であること、selection 強度の regime 別異質性が κ_r に符号化されることを示す。
- **figures**: なし
- **references**: Uhlenbeck & Ornstein (1930) Physical Review
- **math_objects**: 公式 5.3.2 (regime 依存多変量 OU SDE)
- **cross_chapter_refs**: Ch 5.5
- **estimated_words**: 180

### 5.3.6 離散時間 quarter step 版への変換
- **core_proposition**: 実証 panel が四半期粒度であることを承け、Euler-Maruyama 離散化 μ_{t+1} = (I - κ_r Δt) μ_t + κ_r Δt θ_r + η_{r,t+1}, η_{r,t+1} ~ N(0, Σ_r Δt) を導出し、Δt=0.25 (quarter) の下で離散化誤差が O(Δt) に抑えられることを Hamilton (1994) Ch 22 の標準結果として引く。
- **figures**: なし
- **references**: Hamilton (1994) Ch 22; Durbin & Koopman (2012)
- **math_objects**: 公式 5.3.3 (離散時間 MS-VAR(1) 表現)
- **cross_chapter_refs**: Ch 11, 付録 A.5
- **estimated_words**: 170

### 5.3.7 regime transition matrix Π の 3×3 stochastic matrix 定義
- **core_proposition**: regime 切換え過程を時間斉次 Markov 連鎖 Π = [π_{rs}], π_{rs} = P(r_{t+1}=s | r_t=r) として導入し、3×3 行確率行列 (各行和=1) であること、ここで定義される Π は τ_B 前の Π^pre であり、§5.4 で post-τ_B regime に二段化される旨を予告する。
- **figures**: 表 5.3.1 Π^pre の 3×3 行確率行列スキーマ (S₀/S₁/S₂ 間の遷移確率、対角優位性の事前分布)
- **references**: なし
- **math_objects**: 定義 5.3.2 (regime transition matrix Π^pre)
- **cross_chapter_refs**: §5.4, Ch 10.5
- **estimated_words**: 150

### 5.3.8 観測方程式の継承と MS-SSM joint 表現
- **core_proposition**: 観測方程式 y_t = C μ_t + ε_t (§5.2 を継承、loading 表記は C で統一) と状態方程式 (公式 5.3.3) および regime 過程 (定義 5.3.2) を合わせ、(state μ_t, observation y_t, regime r_t) の三層 joint 表現を書き下し、Kim & Nelson (1999) の state-space-with-regime-switching 標準形と一致することを確認する。
- **figures**: なし
- **references**: Kim & Nelson (1999) State-Space Models with Regime Switching, MIT Press
- **math_objects**: 公式 5.3.4 (MS-SSM joint 表現)
- **cross_chapter_refs**: §5.2, 付録 A.5
- **estimated_words**: 160

### 5.3.9 命題 5.1 (MS-SSM 正準形) の formal statement
- **core_proposition**: 命題 5.1 として (μ_A, μ_I, μ_G) は K=3 regime r_t ∈ {S₀, S₁, S₂} 上の Markov 切換え多変量 Ornstein-Uhlenbeck 過程として一意に正準形 (公式 5.3.4) で表現できることを述べ、証明スケッチ 5-10 行で Hamilton (1994) Ch 22 + Kim-Nelson (1999) Ch 4 の標準論証への帰着を示し、完全証明は付録 A.5 に置く (D-047 準拠)。
- **figures**: なし
- **references**: Hamilton (1994); Kim & Nelson (1999); Durbin & Koopman (2012)
- **math_objects**: 命題 5.1 (MS-SSM 正準形)
- **cross_chapter_refs**: 付録 A.5, Ch 5.5, Ch 10.2, Ch 11
- **estimated_words**: 200

### 5.3.10 命題 5.1b (Cobb-Douglas 合成 operator G[μ_t; ω]) の formal statement
- **core_proposition**: 命題 5.1b として σ_SU(t) = G[μ_t; ω] = ∏_{x∈{A,I,G}} (μ_x(t)+1)^{ω_x} - 1, Σ_x ω_x = 1 を regime 共通の決定論的合成子 (composition operator) として定義し、ω=(1/3,1/3,1/3) を D-046 に従い『観測等価類の中心』として §5.2 から継承、一般 ω の同定問題は Ch 11 で IV 推定に commission する旨を明示する。
- **figures**: なし
- **references**: なし
- **math_objects**: 命題 5.1b (CD 合成 operator)
- **cross_chapter_refs**: §5.2, Ch 11, §5.7
- **estimated_words**: 200

### 5.3.11 log(1+σ_SU) の対数線形性と MS-SSM Gaussian 近似との整合
- **core_proposition**: 命題 5.1b の系として log(1+σ_SU(t)) = Σ_x ω_x log(1+μ_x(t)) が成立し、状態方程式の Gaussian 増分 (公式 5.3.3) と相性が良く、Hamilton-Kim filter の対数尤度評価が閉形式 (regime 別 Gaussian 混合) で書ける点を §5.1 の対数線形展開から継承して確認する。
- **figures**: なし
- **references**: なし
- **math_objects**: 系 5.3.1 (σ_SU の対数線形性)
- **cross_chapter_refs**: §5.1, Ch 11
- **estimated_words**: 150

### 5.3.12 Hamilton (1989) forward filter と Kim (1994) smoother の Triple Helix 適用
- **core_proposition**: regime posterior P(r_t = s | y_{1:t}) は Hamilton (1989) forward filter の予測-更新ステップで逐次計算され、Kim (1994) smoother で full sample posterior P(r_t = s | y_{1:T}) を backward pass で得られること、計算複雑度は 8 PJ × 7 institutional type × T 四半期に対して O(K^2 T) = O(9T) 線形時間で処理可能であることを示す。
- **figures**: アルゴリズム 5.3.1 Hamilton-Kim forward-backward filter 擬似コード (predict / update / collapse / smooth)
- **references**: Hamilton (1989) Econometrica 57(2); Kim (1994) J. Econometrics 60(1-2); Krolzig (1997)
- **math_objects**: 公式 5.3.5 (forward filter), 公式 5.3.6 (Kim smoother)
- **cross_chapter_refs**: Ch 11, 付録 A.5
- **estimated_words**: 210

### 5.3.13 regime 数 K=3 の選択根拠と horse-race 事前登録
- **core_proposition**: K=3 を pre-commit する pragmatic 根拠を述べる: K=2 では CX 三位一体 (S₂)、CX 前準備 (S₁)、YD stuck (S₀) の 3 状態が分離できず識別表現力が不足し、K≥4 では Frühwirth-Schnatter (2006) の指摘する label-switching と弱識別問題が顕著化するため、D-045 に従い baseline を K=3 とし、Ch 11 で K∈{2,3,4} の horse-race を事前登録する。
- **figures**: なし
- **references**: Frühwirth-Schnatter (2006) Finite Mixture and Markov Switching Models
- **math_objects**: なし
- **cross_chapter_refs**: Ch 11, §5.7 (F-5.1)
- **estimated_words**: 180

### 5.3.14 命題 5.1 の系: σ_SU の経験密度は K-mixture of CD-of-OU
- **core_proposition**: 命題 5.1 と命題 5.1b を合成した系として、σ_SU(t) の周辺経験密度は K=3 個の Cobb-Douglas-of-Ornstein-Uhlenbeck 成分の Markov 重み付き混合として表現できることを述べ、これにより §5.0 で観察される CX と YD の σ_SU 時系列の多峰性 (multi-modality) が自然に説明されることを illustrative に指摘する。
- **figures**: なし
- **references**: なし
- **math_objects**: 系 5.3.2 (σ_SU の K-mixture 表現)
- **cross_chapter_refs**: §5.0, §5.6
- **estimated_words**: 150

### 5.3.15 regime 持続性と期待持続期間の calibration commission
- **core_proposition**: regime r の期待持続期間 E[duration_r] = 1/(1 - π_{rr}) は対角優位性 π_{rr} の関数として与えられ、本章では symbolic に提示するに留め、具体的な事前分布 (Beta(α_r, β_r) on π_{rr}) と事後分布要約は D-031 Tier A 規律に従い Ch 11 BVAR 推定に commission する旨を明示する。
- **figures**: なし
- **references**: なし
- **math_objects**: 公式 5.3.7 (regime 期待持続期間)
- **cross_chapter_refs**: Ch 11
- **estimated_words**: 140

### 5.3.16 対比モデル群と Ch 11 horse-race 候補の列挙
- **core_proposition**: MS-SSM 正準形に対する対比モデル群として (i) AR(1) σ_SU 単一系列、(ii) random walk σ_SU、(iii) 単一 regime continuous Gaussian SSM、(iv) T(AIG) 線形和 baseline、(v) K=2 MS-SSM、(vi) K=4 MS-SSM を Ch 11 horse-race の候補として並べ、選択基準は marginal likelihood + WAIC + 識別パワー三軸であることを §5.7 で事前登録する旨を予告する。
- **figures**: 表 5.3.2 Ch 11 horse-race 候補モデル一覧
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: Ch 11, §5.7
- **estimated_words**: 170

### 5.3.17 regime 不可観測性と σ_SU 観測性の区別の念押し
- **core_proposition**: 読者に向けて (a) regime r_t は latent (不可観測) であり posterior 確率としてのみ推測される、(b) μ_t は institutional ERS observation 経由で間接観測される、(c) σ_SU(t) = G[μ_t; ω] は derived score として posterior から導出される、という三層の観測可能性階層を明示し、D-031 Tier A に従い regime ラベリングは『観測等価類の中心』としてのみ解釈する旨を強調する。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.2, §5.6, §5.7
- **estimated_words**: 160

### 5.3.18 MS-SSM 正準形のまとめ図と章間 supply 予告
- **core_proposition**: MS-SSM 正準形を 3 ブロック (latent OU dynamics block / CD 合成 operator block / regime switch block) のブロック図にまとめ、§5.4 (Π^pre/Π^post 二段化)、Ch 5.5 (GO ゲート最適停止)、Ch 10.2 (Jovanovic 二レジーム退出ハザード coupling)、Ch 11 (BVAR 同時推定) への supply 経路を明示する。
- **figures**: 図 5.3.2 MS-SSM 正準形まとめ図 (3 ブロック構成と下流章 supply 経路図)
- **references**: なし
- **math_objects**: 命題 5.1, 命題 5.1b
- **cross_chapter_refs**: §5.4, Ch 5.5, Ch 10.2, Ch 11
- **estimated_words**: 170

## §5.4 τ_B 不連続 shift Π^pre ≠ Π^post と Jovanovic/Klepper supply (4p)

### 5.4.1 τ_B (法人化時刻) を BZM 共通 event marker として再定義する
- **core_proposition**: §5.3 までの MS-SSM は τ_B (法人化時刻) を構造の不連続点として明示してこなかった。本節では τ_B を BZM 全章で共有する event marker と位置づけ、pre-B (準備フェーズ) と post-B (事業フェーズ) で σ_SU(t) の生成過程が構造的に異なることを宣言する。τ_B 自体の内生決定は本節の射程外として §5.5 と Ch 5.5/Ch 10.2 へ送る。
- **figures**: 図 5.4.1 τ_B を境界とする pre-B / post-B 二段構造の概念図
- **references**: なし
- **math_objects**: §5.3 の MS-SSM 定義, τ_B (Book II Ch 4 時刻軸 τ 群)
- **cross_chapter_refs**: Ch 5.5, Ch 10.2, Book II Ch 4
- **estimated_words**: 140

### 5.4.2 二段化された MS-SSM: Π を Π^pre と Π^post に分離する
- **core_proposition**: §5.3 MS-SSM を τ_B 前後で s∈{0,1} の二レジームに拡張し、μ_{t+1} = A_{s,r_t} μ_t + B_{s,r_t} ε_t、r_t は s 依存の transition matrix Π^{(s)} に従う Markov 連鎖とする。すなわち Π^pre := Π^{(0)}、Π^post := Π^{(1)} と二段に分け、s の切換えは τ_B で外生的に起こると仮定する。s の内生化は Ch 5.5 へ。
- **figures**: なし
- **references**: Hamilton (1989)
- **math_objects**: 命題 5.5 (準備), §5.3 命題 5.1 (MS-SSM)
- **cross_chapter_refs**: Ch 5.5
- **estimated_words**: 180

### 5.4.3 命題 5.5 (τ_B 不連続 shift) の formal statement
- **core_proposition**: 命題 5.5: 上記二段 MS-SSM の下で一般に Π^pre ≠ Π^post であり、Δ_Π := Π^post − Π^pre は零行列でない。事前分布として pre-B では事業計画 drive で S₀→S₁→S₂ の上向き transition が dominant、post-B では市場 selection drive で S₂→S₁→S₀ の下向き drift が dominant という非対称仮説を pre-commit する。証明スケッチ本文 5-10 行、完全証明は付録 A.5.5 へ (D-047 準拠)。
- **figures**: 表 5.4.1 Π^pre / Π^post 事前分布の非対称性 (3×3 行列の対角優越 vs 下三角優越の対比)
- **references**: なし
- **math_objects**: 命題 5.5 (τ_B 不連続 shift), Δ_Π = Π^post − Π^pre
- **cross_chapter_refs**: 付録 A.5.5, Ch 10.2, Ch 10.5
- **estimated_words**: 200

### 5.4.4 識別戦略: τ_B 観測下の Bai-Perron と unobserved 下の MS smoother
- **core_proposition**: τ_B が観測可能であれば Π の不連続 shift は Bai & Perron (1998) の構造変化テストで識別可能であり、break date を τ_B に固定した制約付き sup-Wald 統計量で Π^pre ≠ Π^post を test できる。τ_B が unobserved の場合 (非法人 PJ や段階的 spin-out) は Hamilton-Kim filter による MS smoother と event-window 推定を併用する。本節は Tier A として識別可能性の structural 主張のみ、実データ適用は Ch 11 へ。
- **figures**: なし
- **references**: Bai & Perron (1998) Econometrica; Hamilton (1989)
- **math_objects**: 命題 5.5 系 (識別可能性), Bai-Perron sup-Wald 統計量
- **cross_chapter_refs**: Ch 11
- **estimated_words**: 190

### 5.4.5 両レジーム ergodicity: Foster-Lyapunov 条件と institutional rigidity
- **core_proposition**: 二段 MS-SSM が両レジームで ergodic であるための十分条件として Foster-Lyapunov drift 条件 (Meyn & Tweedie 2009) を導入する。spectral radius ρ(A_{s,r}) < 1 が両 s で成立すれば全体系は positive recurrent となる。ρ が institutional rigidity (機関 ERS の硬さ) に依存して変動するという観察を 1 段落で軽く差し込み、本格分析は Book V 機関章へ送る。
- **figures**: なし
- **references**: Meyn & Tweedie (2009) Markov Chains and Stochastic Stability
- **math_objects**: 補題 5.5 (Foster-Lyapunov drift 条件), spectral radius ρ(A_{s,r})
- **cross_chapter_refs**: Book V
- **estimated_words**: 170

### 5.4.6 Jovanovic (1982) 退出ハザード と σ_SU の coupling 形
- **core_proposition**: Jovanovic (1982) noisy selection 学習モデルにおける退出ハザード λ_i(t) を、本書では σ_SU(t) と coupling させて λ_i(t) = f(η_i, σ_SU(t)) の形に置く。f は σ_SU について単調減少と仮定し、σ_SU=S₂ (三位一体追い風) では λ_i が低く、σ_SU=S₀ (沈静) では λ_i が高い、という coupling の事前分布を pre-commit する。η_i はプロジェクト固有 productivity 信号で Jovanovic 元定式と整合。
- **figures**: 図 5.4.2 σ_SU regime (S₀/S₁/S₂) × η_i ハザード曲線族 λ_i(t)
- **references**: Jovanovic (1982) Econometrica
- **math_objects**: 定義 5.6 (退出ハザード coupling), λ_i(t) = f(η_i, σ_SU(t))
- **cross_chapter_refs**: Ch 10.2
- **estimated_words**: 190

### 5.4.7 二段 Π × σ_SU regime が Jovanovic 学習ハザードの識別を可能にする経路
- **core_proposition**: Ch 10.2 の Jovanovic 拡張主張 (退出ハザードの λ_i identification) への supply の formal 経路を整理する。pre-B/post-B 二段 + σ_SU の 3 regime という 2×3=6 cell 構造が、η_i と σ_SU の交互作用項を分離するための強い事前分布下の事後分布要約を提供する。本節では識別パワーの structural 経路のみを述べ、識別された因果効果の主張は行わない (D-031 Tier A 規律)。
- **figures**: なし
- **references**: Jovanovic (1982) Econometrica
- **math_objects**: 命題 5.5 + 定義 5.6 の合成
- **cross_chapter_refs**: Ch 10.2
- **estimated_words**: 170

### 5.4.8 Klepper (1996) shakeout と post-B regime の S₂→S₀ drift の整合性
- **core_proposition**: Klepper (1996) industry life cycle における shakeout phase は、市場成熟と R&D 集積に伴う退出の波であり、本書の二段 MS-SSM では post-B regime の S₂→S₁→S₀ 下向き drift と整合する。すなわち post-B の市場 selection drive な drift 構造は Klepper shakeout を MS-SSM 表現に embed したものとして読める。
- **figures**: なし
- **references**: Klepper (1996) AER
- **math_objects**: 命題 5.5 (Π^post の S₂→S₀ drift)
- **cross_chapter_refs**: Ch 10.5
- **estimated_words**: 150

### 5.4.9 BZM 独自視点: Klepper shakeout の『対称二相解釈』
- **core_proposition**: 本書は Klepper を pre-B 期にも拡張し、τ_B 到達失敗による撤退 (準備フェーズでの dropout) を pre-B 期 shakeout として扱う。すなわち shakeout は post-B 専有現象ではなく τ_B を境界とする『対称二相 shakeout』として書ける、というのが BZM 独自の解釈である。formal な対称性は Ch 10.5 で Klepper 対称二相定理として定式化することを flag する。
- **figures**: 図 5.4.3 対称二相 shakeout の概念図 (τ_B を中央に pre-B 期 dropout と post-B 期 shakeout を左右対称配置)
- **references**: Klepper (1996) AER
- **math_objects**: 命題 5.5 の対称性系 (Ch 10.5 へ predecessor)
- **cross_chapter_refs**: Ch 10.5
- **estimated_words**: 170

### 5.4.10 Pakes-Ericson (1998) active vs passive learning と二段 Π
- **core_proposition**: Pakes & Ericson (1998) の industry dynamics 区分 (active learning と passive learning) との対比で、本書の二段 Π は pre-B では active learning (事業計画と PoC drive の探索) を、post-B では passive learning (市場露呈による selection) を sustain する構造として読める。両学習様式の coexist を一つの MS-SSM に embed した点が本章の数学的特徴である。
- **figures**: なし
- **references**: Pakes & Ericson (1998) JET
- **math_objects**: 命題 5.5 の active/passive 分解解釈
- **cross_chapter_refs**: Ch 10.2
- **estimated_words**: 160

### 5.4.11 Murmann (2003) 共進化と η_jt の Π への入り方の予告
- **core_proposition**: 制度状態 η_jt (機関 ERS の状態変数) が transition matrix Π にどう入るか — すなわち Π = Π(η_jt) として η_jt 依存性を持たせるか、それとも Π を固定して η_jt は別経路で σ_SU に入るか — の選択は §5.5 で softmax coupling として扱う。Murmann (2003) 双方向結合への supply は §5.5 → Ch 10.7 で完結する、と本節では予告のみ行う。
- **figures**: なし
- **references**: Murmann (2003)
- **math_objects**: 命題 5.6 (η_jt softmax coupling) への予告
- **cross_chapter_refs**: §5.5, Ch 10.7
- **estimated_words**: 150

### 5.4.12 本節の境界宣言と射程明示
- **core_proposition**: τ_B 自体の内生決定 (when to incorporate) は本節の射程外であり、GO ゲート最適停止問題として Ch 5.5 (real options) と Ch 10.2 (Jovanovic 拡張) で扱う。本節は τ_B を外生 marker として受け入れた上での Π の不連続 shift と退出ハザードの coupling のみを扱う、という境界を明示する。本節の主張は全て Tier A (記述的類型論 + 強い事前分布下の事後分布要約) であり、Bai-Perron 適用結果は Ch 11 で報告する。
- **figures**: なし
- **references**: なし
- **math_objects**: 命題 5.5, 定義 5.6
- **cross_chapter_refs**: §5.5, Ch 5.5, Ch 10.2, Ch 11
- **estimated_words**: 160

### 5.4.13 supply 整理 — 本節が下流章に渡すもの
- **core_proposition**: 本節が下流章に渡す supply を整理する: (i) Π^pre / Π^post 二段構造 → Ch 10.2 (Jovanovic 退出ハザード identification) と Ch 10.5 (Klepper shakeout 対称二相)、(ii) 退出ハザード λ_i(σ_SU) coupling 形 → Ch 10.2、(iii) Klepper 対称二相解釈 → Ch 10.5、(iv) Bai-Perron 構造変化テスト適用方針 → Ch 11、(v) institutional rigidity と ergodicity の繋ぎ → Book V。η_jt softmax coupling は §5.5 へ送る。
- **figures**: 表 5.4.2 §5.4 supply 表 (下流章 × 供給物 × 命題/定義番号)
- **references**: なし
- **math_objects**: 命題 5.5, 定義 5.6, 補題 5.5
- **cross_chapter_refs**: Ch 10.2, Ch 10.5, Ch 11, Book V, §5.5
- **estimated_words**: 180

## §5.5 制度状態 η_jt と σ_SU の coupling — Murmann 共進化への pre-form (2.5p)

### 5.5.1 Murmann 共進化研究の要約と 8 軸 ERS 制度状態 η_jt の導入
- **core_proposition**: Murmann (2003) のドイツ合成染料産業共進化研究を要約し、企業群と科学/教育/規制制度が同時に形を変える歴史過程から抽出された 8 軸 ERS (Educational / Regulatory / Sectoral) を制度状態ベクトル η_jt ∈ R^8 として §5.5 全体の基本対象に据えることを宣言する。本節は §5.3 で導入した σ_SU の MS-SSM 過程に η_jt を結合する pre-form を与える。
- **figures**: 表 5.5.1 Murmann 8 軸 ERS の列挙 (η_E, η_R, η_S 他) と operational proxy
- **references**: Murmann (2003) Knowledge and Competitive Advantage, Cambridge UP; Nelson (1993) National Innovation Systems
- **math_objects**: η_jt ∈ R^8 (制度状態ベクトル)
- **cross_chapter_refs**: §5.3, Ch 10.7, Book V 機関章
- **estimated_words**: 140

### 5.5.2 η_jt が σ_SU の transition matrix を再スケールする生成形 — softmax coupling
- **core_proposition**: η_jt が σ_SU の K=3 レジーム切換え過程の transition matrix Π に入る経路を、π_{rs}(η_jt) = softmax_s(W_{rs} η_jt + b_{rs}) として書き、制度状態が r→s の遷移確率を smooth に再スケールする生成項であることを明示する。softmax により Σ_s π_{rs}=1 を保ちつつ η の連続変動を確率に写す。
- **figures**: 図 5.5.1 η_jt → Π → σ_SU の coupling 経路模式図
- **references**: Murmann (2003)
- **math_objects**: π_{rs}(η) = softmax(W_{rs} η + b_{rs}), Π(η_jt) ∈ Δ^{K-1}
- **cross_chapter_refs**: §5.3 命題 5.1 (K=3 MS-SSM), 付録 B
- **estimated_words**: 160

### 5.5.3 命題 5.6 (制度状態 coupling) の formal statement
- **core_proposition**: 命題 5.6: 制度状態 η_jt は σ_SU の transition matrix を Π(η_jt) = [π_{rs}(η_jt)]_{r,s=0}^{2} として駆動し、π_{rs}(η_jt) = softmax_s(W_{rs} η_jt + b_{rs}) と書ける。証明は §5.1 の方針 (D-047) に従いスケッチを本文に置き、完全証明は付録 A.5.6 へ送る。
- **figures**: なし
- **references**: Murmann (2003)
- **math_objects**: 命題 5.6 (制度状態 coupling), 付録 A.5.6
- **cross_chapter_refs**: §5.1 D-047 pre-commit, 付録 A
- **estimated_words**: 140

### 5.5.4 各軸が Π のどの entry に効くかの強い事前分布表 — 観測等価類の中心
- **core_proposition**: η の各軸が Π のどの entry に主に効くかについて、Murmann 歴史叙述と Aoki (2001) 比較制度分析から導かれる強い事前分布を表として与える: 教育制度 η_E は S₀→S₁ 遷移を promote する側 (π_{01} の係数 W_{01,E}>0)、規制制度 η_R は S₂→S₁ への drift 減速側 (W_{21,R}<0) に主効果を持つ。これは Tier A の強い事前分布下の事後分布要約であり、識別主張ではない (D-031)。
- **figures**: 表 5.5.2 η 8 軸 × Π entry 主効果プライア表
- **references**: Murmann (2003); Aoki (2001) Comparative Institutional Analysis, MIT Press; North (1990) Institutions, Cambridge UP
- **math_objects**: W_{rs} ∈ R^8, 事前分布 p(W_{rs})
- **cross_chapter_refs**: §5.1 (Tier A 規律), Ch 11 (事後分布推定)
- **estimated_words**: 180

### 5.5.5 本章境界宣言 — η_jt を外生扱いとし内生 feedback Ψ は Ch 10.7 へ委ねる
- **core_proposition**: 本章では η_jt を外生観測量として扱い、企業 σ_SU 軌道 → 制度 η_jt への逆方向 feedback (内生的 coupling) を司る operator Ψ の identify は Ch 10.7 (Murmann 双方向共進化) へ委ねることを境界宣言する。これは §5.3 で η_jt を所与とした MS-SSM 推定を可能にするための作業仮説であり、Ψ の存在自体を否定するものではない。
- **figures**: なし
- **references**: Murmann (2003)
- **math_objects**: operator Ψ: σ_SU 軌道 → η̇_jt (Ch 10.7 で identify)
- **cross_chapter_refs**: §5.3, Ch 10.7, §5.7
- **estimated_words**: 150

### 5.5.6 Granger 先行関係の事前登録仕様 — F-5.5/F-5.6 の commission
- **core_proposition**: η_E (教育制度軸) の上昇は σ_SU の S₁ 滞在確率を 4 quarter (1 年) 先行して上げる、という Granger 先行関係を反証可能仮説として §5.7 経由で Ch 26b 予測登録簿に commission する (η_jt 駆動 Granger 先行関係は F-5.6 として §5.7 で登録、ω 領域依存性 F-5.5 とは別)。Tier B (OSF 事前登録対象) であり、本節での提示はあくまで Tier B 命題の事前登録仕様の確定である。
- **figures**: 表 5.5.3 Granger 先行関係事前登録仕様 (帰無/対立仮説 / 検定統計量 / 棄却域 / 標本識別パワー試算)
- **references**: Hamilton (1994) Time Series Analysis, Princeton UP
- **math_objects**: Granger(η_E → P(σ_SU ∈ S₁), lead=4Q) > 0, Tier B 事前登録
- **cross_chapter_refs**: §5.7 commission, Ch 11 推定, Ch 26b 予測登録簿
- **estimated_words**: 170

### 5.5.7 8 PJ × 7 機関 panel での η_jt operational definition — Book V 機関章への参照
- **core_proposition**: η_jt の各軸の operational definition (Research-Org-Type / Private-Engineering-Univ-Type / Regional-National-Univ-Type 群 / Integrated-Large-Univ-Type / International-TTO-Type の 5 type を proxy 化する具体的観測方程式の係数) は Book V 機関章で扱う制度 ERS 観測方程式を参照し、ここでは type 名のみで匿名化する (D-034)。実装は AMD OS 機関プロファイルを operational proxy として転用するが、本書では type 名のみ露出する。
- **figures**: なし
- **references**: Murmann (2003)
- **math_objects**: η_jt = h(institution_type_j, t)
- **cross_chapter_refs**: Book V 機関章, D-034 機関匿名化, AMD OS 機関プロファイル
- **estimated_words**: 150

### 5.5.8 C 行列時間変化の境界宣言 — Ch 5 は時不変、Ch 10.7 で time-varying 化
- **core_proposition**: σ_SU の状態空間モデルにおける観測方程式の loading 行列 C (制度状態 η_jt から観測量への load) は Ch 5 では時不変 (C は j 機関依存だが t 不変) と仮定する。η_jt の時間変動が C の係数を駆動する time-varying loading 構造への拡張は Ch 10.7 で扱うことを境界宣言し、Ch 5 の数学的扱いを閉じた形に保つ。
- **figures**: なし
- **references**: Hamilton (1994); Kim (1994) ICC
- **math_objects**: C_j (時不変 loading 行列), time-varying 化: C_{jt} = g(η_jt) (Ch 10.7)
- **cross_chapter_refs**: §5.3, Ch 10.7, Ch 11
- **estimated_words**: 150

### 5.5.9 §5.5 の章間 supply 整理 — §5.7 への予告
- **core_proposition**: 本節で確定した coupling 経路 (i) 命題 5.6 softmax 生成形、(ii) W_{rs} 事前分布表、(iii) η_jt 外生扱いの境界宣言、(iv) Granger 先行関係 commission、(v) C 行列時不変宣言を、§5.7 章末の章間 supply 整理に含めることを予告し、Ch 10.7 Murmann 双方向共進化と Ch 11 BVAR 同時推定への供給ラインを確定する。
- **figures**: なし
- **references**: なし
- **math_objects**: 命題 5.6, Granger 先行関係 (F-5.6)
- **cross_chapter_refs**: §5.7, Ch 10.7, Ch 11, Ch 26b
- **estimated_words**: 140

## §5.6 装置を当てる — CX/YD への適用と 8 PJ generalizability (3p)

### 5.6.1 本節の位置づけ — demonstration であって validation ではない
- **core_proposition**: §5.6 は §5.2-§5.5 で構築した装置を CX/YD 二領域に当てはめて動作を見せる demonstration 節であり、本格的な推定と識別は Ch 11、反証可能仮説の事前登録は Ch 26b に委ねる。本節の数値はすべて強い事前分布下の事後分布要約であって、後付け校正であり validation ではない (D-031, D-033)。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.2, §5.3, §5.4, §5.5, §5.7, Ch 11, Ch 26b
- **estimated_words**: 140

### 5.6.2 CX 領域 7 観測量の時系列構築
- **core_proposition**: CX (2020-23) の P/B/V/R/I_R/N/C 四半期時系列を AMD OS Atlas signals から抽出し、§5.2 観測モデル (μ_A, μ_I, μ_G) → 7 観測量の loading 行列に当てはめる手順を示す。観測量は機関 type 名 (Research-Org-Type / Integrated-Large-Univ-Type) で集約し、実機関名は露出させない (D-034)。
- **figures**: 表 5.6.1 CX 領域 7 観測量四半期時系列 (2018Q1-2024Q4, type 集約)
- **references**: AMD OS CX 領域 Atlas signals 速報値
- **math_objects**: §5.2 観測方程式, loading 行列 C
- **cross_chapter_refs**: §5.2, Book IV
- **estimated_words**: 160

### 5.6.3 Kalman filter + Hamilton-Kim forward filter の実行手順
- **core_proposition**: §5.3 で formal 化した K=3 MS-SSM (D-045) に対し、連続時間 OU 駆動の (μ_A, μ_I, μ_G) を Kalman filter で更新し、離散時間 regime r_t ∈ {S₀, S₁, S₂} を Hamilton-Kim forward filter で同時推定する手順を擬似コードで示す。事前分布は CX/YD narrative から導出される強い事前分布を用い、その任意性は §5.7 で commission する (D-031)。
- **figures**: アルゴリズム 5.6.1 Kalman + Hamilton-Kim joint filter 擬似コード (predict / update / regime probability)
- **references**: Hamilton (1989) Econometrica; Kim (1994) J. Econometrics
- **math_objects**: 命題 5.1 (K=3 MS-SSM), §5.3 状態空間表現
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 180

### 5.6.4 CX の (μ_A, μ_I, μ_G) 3 レーン分解と事後分布要約
- **core_proposition**: CX の推定 (μ_A, μ_I, μ_G) 軌跡を 3 レーンに分解して提示し、事後平均と 90% 信用区間を band として描画する。これは識別された因果効果ではなく強い事前分布下の事後分布要約 (D-031) であり、軌跡は narrative との後付け校正で読まれるべきものである。
- **figures**: 図 5.6.1 CX の (μ_A, μ_I, μ_G) 3 レーン時系列 (事後平均 + 90% 信用区間)
- **references**: なし
- **math_objects**: §5.3 推定軌跡, §5.2 観測等価類
- **cross_chapter_refs**: §5.2, §5.3
- **estimated_words**: 150

### 5.6.5 CX の regime r_t 事後分布の時系列 — S₁ → S₂ transition
- **core_proposition**: CX regime posterior P(r_t=k | y_{1:t}) の時系列を 3 帯で描画し、2020Q4 までは S₁ 中位、2021Q2 以降 S₂ 三位一体追い風へ遷移する narrative と Spearman ρ > 0.7 で整合することを示す。ただしこの整合は narrative-derived 事前分布の自己無矛盾性確認であって独立検証ではない。
- **figures**: 図 5.6.2 CX の regime posterior 帯グラフ (S₀/S₁/S₂ stacked area, 2018Q1-2024Q4) + narrative annotation
- **references**: なし
- **math_objects**: 命題 5.1 (regime posterior), §5.4 transition probability 行列
- **cross_chapter_refs**: §5.0, §5.4
- **estimated_words**: 150

### 5.6.6 institutional 経路の分解 — P/B/N/V がどのレーンを駆動したか
- **core_proposition**: CX の 7 観測量のうち P と B の急増が μ_G レーンを、N の急増が μ_A レーンを、V の急増が μ_I レーンを主に駆動した経路を loading 行列と観測量寄与分解で示し、Triple Helix の三層が独立に動いた様子を可視化する。
- **figures**: 図 5.6.3 CX 観測量寄与分解 stacked bar
- **references**: なし
- **math_objects**: §5.2 loading 行列 C, §5.6 寄与分解
- **cross_chapter_refs**: §5.2
- **estimated_words**: 140

### 5.6.7 YD への装置適用 — μ_G フラットと S₀ stuck regime
- **core_proposition**: 同じ装置を YD に当てはめると、推定 (μ_A, μ_I, μ_G) 軌跡は μ_A 中程度、μ_I 一定上昇、μ_G フラットを示し、regime posterior は期間を通じて S₀ stuck に留まる。CX と YD の対比は §5.0 章頭フックの 4 panel 図 (図 5.0.1) を定量化したものであり、機関名は露出させず Regional-National-Univ-Type 群として記述する (D-034)。
- **figures**: 図 5.6.4 YD の (μ_A, μ_I, μ_G) 3 レーン + regime posterior 2 段組
- **references**: なし
- **math_objects**: 命題 5.1, §5.3
- **cross_chapter_refs**: §5.0, §5.3
- **estimated_words**: 160

### 5.6.8 Cobb-Douglas 幾何平均構造による μ_G フラットの増幅機構
- **core_proposition**: σ_SU = (μ_A+1)^{ω_A} · (μ_I+1)^{ω_I} · (μ_G+1)^{ω_G} - 1 の CD 合成 (命題 5.1b) は対数加法的であり、いずれか 1 レーンが低位に張りつくと幾何平均全体が抑圧される。YD の μ_G フラットが σ_SU 全体を S₀ に固定する機構を log-decomposition で示し、ω = (1/3,1/3,1/3) baseline 下での寄与を分解する (D-046)。
- **figures**: 図 5.6.5 YD の log(1+σ_SU) = ω_A log(1+μ_A) + ω_I log(1+μ_I) + ω_G log(1+μ_G) の 3 項分解時系列
- **references**: なし
- **math_objects**: 命題 5.1b (CD operator G), §5.2 観測等価類の中心
- **cross_chapter_refs**: §5.2, §5.3, Ch 11
- **estimated_words**: 160

### 5.6.9 SIP CE2023 公募の段階効果と政策 → 産業 → 学術 Granger 先行関係
- **core_proposition**: CX 期間中の SIP CE2023 公募イベントを Π off-diagonal 構造で読むと、μ_G に 1Q ラグで段階効果、μ_I に 6-8Q ラグで波及、μ_A に二次的波及という政策 → 産業 → 学術 Granger 先行関係が事後分布上で読み取れる。本格的 IV 推定は Ch 11 へ commission する。
- **figures**: 図 5.6.6 CX 期間 Π off-diagonal 行列の事後平均ヒートマップ + SIP CE2023 公募時点の段階効果 impulse response
- **references**: 内閣府 SIP 第3期 CE2023 公募要領; 経済産業省 (2023) GX 実現基本方針
- **math_objects**: 命題 5.5 (Π^pre / Π^post 二段), §5.4 Π 行列
- **cross_chapter_refs**: §5.4, Ch 10.2, Ch 11
- **estimated_words**: 180

### 5.6.10 τ_B 境界の含意 — σ_SU だけでは語れない GO ゲート問題
- **core_proposition**: CX は推定 τ_B 後に market selection レジーム (命題 5.5 Π^post) へ到達するが YD は到達しない。この差は σ_SU レベルだけでなく Ch 5.5 の GO ゲート最適停止閾値 θ_σ* に対する持続期間条件の問題でもあり、§5.5 で予告した境界宣言を再確認する。Klepper 対称二相 (Ch 10.5) との接続点でもある。
- **figures**: なし
- **references**: Klepper (1996) AER
- **math_objects**: 命題 5.5 (二段切換え), Ch 5.5 GO ゲート θ_σ*
- **cross_chapter_refs**: §5.4, §5.5, Ch 5.5, Ch 10.2, Ch 10.5
- **estimated_words**: 140

### 5.6.11 Park-Leydesdorff (2010) 系譜との比較 — Triple Helix 文献への 3 貢献の再確認
- **core_proposition**: Park-Leydesdorff (2010) の citation-based mutual information proxy では CX/YD の事業化追い風差を直接捉えられない。BZM が institutional 観測量 (P/B/V/R/I_R/N/C) を観測方程式に組み込み、CD 合成で σ_SU を定義する装置は Triple Helix 文献への 3 貢献 (Book VI で正式宣言) の一つを構成することを再確認する。
- **figures**: 表 5.6.2 Park-Leydesdorff MI proxy vs BZM σ_SU MS-SSM の比較表
- **references**: Park & Leydesdorff (2010) JASIST; Leydesdorff & Strand (2013) Scientometrics; Etzkowitz & Leydesdorff (2000) RP
- **math_objects**: なし
- **cross_chapter_refs**: §5.1, §5.7, Book 0 Ch 0.3, Book VI
- **estimated_words**: 160

### 5.6.12 8 PJ generalizability の予告 — TIEM/BWE/CTB/SX/JC/CLG への外挿
- **core_proposition**: CX/YD 二例での demonstration を 8 PJ (TIEM/BWE/CTB/SX/JC/CLG を含む) へ外挿する設計は、機関 type 群を横断する panel 推定として Ch 11 に正式 commission する。
- **figures**: 表 5.6.3 8 PJ × 5 機関 type の covering 表 (各セルで観測量 7 つの可用性 ○/△/× と推定期間)
- **references**: Book III Ch 14/Ch 17 事例予告
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Ch 11, Ch 26b, Book III Ch 14, Book III Ch 17
- **estimated_words**: 170

### 5.6.13 本節の境界宣言 — Tier A 内に留まる
- **core_proposition**: 本節の数値結果はすべて Tier A (記述的類型論、後付け校正、強い事前分布下の事後分布要約) に留まり、識別主張や因果効果叙述は §5.7 で commission する F-5.1〜F-5.6 の事前登録 (Ch 26b、Tier B) に委ねる。本節を「validation」と呼ぶ叙述は禁止 (D-033) であることを章末に向けて再宣言する。
- **figures**: なし
- **references**: なし
- **math_objects**: なし
- **cross_chapter_refs**: §5.7, Ch 11, Ch 26b
- **estimated_words**: 130

## §5.7 Triple Helix 文献への 3 貢献確定 + 下流章 supply + 章末問い (1p)

### 5.7.1 貢献 1 確定 — 事業化用途における CD 合成の理論的根拠化
- **core_proposition**: BZM の Triple Helix 文献への第 1 貢献として、相互情報量 (MI) ではなく Cobb-Douglas (CD) 合成を採用する理論的根拠を §5.1 cross-walk 3 定理 (定理 5.1.1〜5.1.3) + 系 5.1.4 が支えることを確定する。Park-Leydesdorff 系の MI ベース synergy は cross-section 記述子としては有効だが、事業化判断 (GO ゲート) で要求される一次条件と 0 排除性に対し CD が観測等価類の中心として位置することを宣言する。
- **figures**: なし
- **references**: Leydesdorff & Park (2014) JASIST; Strand & Leydesdorff (2013) TFSC; Park & Leydesdorff (2010) Scientometrics
- **math_objects**: 定理 5.1.1, 5.1.2, 5.1.3; 系 5.1.4
- **cross_chapter_refs**: §5.1, Ch 11, Book 0 Ch 0.3
- **estimated_words**: 140

### 5.7.2 貢献 2 確定 — SIP CE2023 5RL 体系との接続による μ_G の制度的根拠化と institutional rank 多様性
- **core_proposition**: 第 2 貢献として、μ_G を内閣府 SIP CE2023 の 5RL 体系 (BRL/GRL/SRL/HRL/TRL) に対応させる §5.2 比較表と institutional 多様性 (5 機関 type × 7 観測) による rank 3 安定性 (§5.2.11) が、Park-Leydesdorff の citation proxy より強い institutional grounding を提供することを確定する。AMED/JST/NEDO の政策文書群との対応関係が観測方程式の institutional constraint を与える点を強調する。
- **figures**: 表 5.7.1 BZM 貢献 3 点と先行系譜 (Etzkowitz / Leydesdorff / Park) との差分整理表
- **references**: Etzkowitz & Leydesdorff (2000) RP; 内閣府 SIP CE2023 5RL 体系文書
- **math_objects**: 補題 5.3, 命題 5.3b
- **cross_chapter_refs**: §5.2, Book V, Book 0 Ch 0.3
- **estimated_words**: 140

### 5.7.3 貢献 3 確定 — regime-switching SSM 化による Triple Helix の時系列計量装置化
- **core_proposition**: 第 3 貢献として、Leydesdorff 系の cross-section synergy 測定を、§5.3 MS-SSM (K=3 regime, D-045) + §5.4 τ_B 二段不連続 + §5.5 η_jt softmax coupling で時系列計量装置 (econometric apparatus) に拡張したことを確定する。これにより BVAR/Hamilton-Kim filter での事後分布要約と pre-commit horse-race が可能になる (Tier A 記述、強い事前分布下の事後分布要約)。
- **figures**: なし
- **references**: Hamilton (1989) Econometrica; Kim & Nelson (1999) Cambridge UP
- **math_objects**: 命題 5.1, 5.1b, 5.5, 5.6
- **cross_chapter_refs**: §5.3, §5.4, §5.5, Ch 11
- **estimated_words**: 150

### 5.7.4 下流章 supply 表 — Ch 5.5 / Ch 9 / Ch 10.2 / Ch 10.5 / Ch 10.7 / Ch 11 への引き渡し
- **core_proposition**: 本章が下流章に供給する主要 object を 1 表に集約する: σ_SU(t) MS-SSM 過程 → Ch 5.5 (GO ゲート最適停止)・Ch 10.2 (Jovanovic 二レジーム退出ハザード λ_i(σ_SU))・Ch 11 (BVAR 同時推定)、Π^pre/Π^post 二段 → Ch 10.2・Ch 10.5 (Klepper 対称二相)、η_jt softmax coupling → Ch 10.7 (Murmann 双方向共進化)、cross-walk 3 定理 + horse-race protocol → Ch 11、二層非可換性予告 → Ch 9 (代数構造) と Ch 10.4 (Arrow 不可能性定理)、institutional rigidity → Book V。
- **figures**: 図 5.7.1 下流章 supply 図 (TripleHelixMatrix.tsx 6×3 マトリクス素材転用、§5.x → Ch y.z の矢印 8 本)
- **references**: 本書 Ch 5.5 / Ch 9 / Ch 10.2 / Ch 10.4 / Ch 10.5 / Ch 10.7 / Ch 11 予告編
- **math_objects**: 命題 5.1, 5.5, 5.6
- **cross_chapter_refs**: Ch 5.5, Ch 9, Ch 10.2, Ch 10.4, Ch 10.5, Ch 10.7, Ch 11
- **estimated_words**: 200

### 5.7.5 Ch 26b 予測登録簿への反証可能仮説 F-5.1〜F-5.6 commission [D-031 例外条項]
- **core_proposition**: 本章で生成された反証可能仮説 F-5.1 (K=3 regime 数の AIC/BIC/log-ML 比較で MS-SSM が単一 regime SSM を上回る) / F-5.2 (CD operator が MI baseline を log-marginal-likelihood で上回る) / F-5.3 (Π^pre/Π^post 二段が単一相 baseline を上回り Bai-Perron sup-Wald で τ_B 不連続が検出される) / F-5.4 (退出ハザード λ_i(σ_SU) が σ_SU について単調減少) / F-5.5 (ω = (ω_A, ω_I, ω_G) の領域依存性が IV 推定で baseline (1/3,1/3,1/3) から有意に乖離) / F-5.6 (η_jt softmax coupling Granger 先行 η_E → S₁ 4Q lead > 0) の 6 件を Ch 26b 予測登録簿への Tier B 事前登録対象として OSF に commission することを宣言する (D-031 例外条項)。
- **figures**: 表 5.7.2 F-5.1〜F-5.6 仮説一覧 (仮説 ID / 帰無仮説 / 対立仮説 / 検証 protocol / 必要データ / Ch 26b 登録予定日)
- **references**: Nosek et al. (2018) PNAS; Gelman & Shalizi (2013) Br J Math Stat Psychol
- **math_objects**: F-5.1〜F-5.6
- **cross_chapter_refs**: Ch 11, Ch 26b
- **estimated_words**: 210

### 5.7.6 horse-race protocol 確定 — MS-SSM (K=3) vs 5 baselines + K∈{2,3,4} 内部 horse-race
- **core_proposition**: Ch 11 で実施する horse-race protocol を確定する: MS-SSM (K=3, D-045) を pre-commit baseline とし、(i) AR(1)、(ii) random walk (RW)、(iii) 連続 Gaussian SSM (単一 regime)、(iv) Triple Helix MI baseline T(AIG)、(v) 単一相 (τ_B 二段なし) MS-SSM の 5 候補と AIC / BIC / log-marginal-likelihood / WAIC の基準で比較する。さらに K∈{2,3,4} 内 horse-race を併走させ、K=3 pre-commit の事後妥当性を事後分布要約として点検する (Tier A、validation 用語は使わない)。
- **figures**: なし
- **references**: Gelman & Shalizi (2013); Bai & Wang (2015) JBES
- **math_objects**: 命題 5.1, 命題 5.1b
- **cross_chapter_refs**: §5.3, Ch 11
- **estimated_words**: 170

### 5.7.7 章末の問い 1 — σ_SU が動いても GO が立たない PJ はどこで救われるのか
- **core_proposition**: 章末の問い第 1: §5.6 demonstration で観察された Regional-National-Univ-Type のように、σ_SU が中位以上 (S₁/S₂) に動いていても GO ゲートが立たない PJ は本書のどこで救われるのか。Ch 5.5 (内生閾値 θ_σ* の調整)、Ch 8 (strategic slack と工程効果)、Ch 9 (二層非可換性 — μ 層と意思決定層の代数的非可換性) への伏線として明示する。
- **figures**: なし
- **references**: strategic-slack.md (Ch 8 予告編)
- **math_objects**: なし
- **cross_chapter_refs**: §5.6, Ch 5.5, Ch 8, Ch 9
- **estimated_words**: 130

### 5.7.8 章末の問い 2 — MI と CD は同じ現象を測っているのか
- **core_proposition**: 章末の問い第 2: MI と CD は経験的に弁別可能か。§5.1 cross-walk 3 定理は両者の形式的橋渡しを与えるが、観測等価類の重なりは empirical 検証 protocol に委ねる。具体的検証は Ch 11 (horse-race の log-ML 差分) と Ch 26b (F-5.2 事前登録) に commission する。本問いが Book VI 新領域宣言 (Triple Helix の時系列計量装置化) と Book 0 序章 (Etzkowitz vs Leydesdorff 系譜整理) への逆流タスクを駆動する。
- **figures**: なし
- **references**: Leydesdorff & Park (2014) JASIST; Nosek et al. (2018) PNAS
- **math_objects**: 定理 5.1.1, 5.1.2, 5.1.3
- **cross_chapter_refs**: §5.1, Ch 11, Ch 26b, Book 0 Ch 0.3, Book VI
- **estimated_words**: 160

## 章末まとめ
- 全段落数: 96 (§5.0=12 / §5.1=17 / §5.2=18 / §5.3=18 / §5.4=13 / §5.5=9 / §5.6=13 / §5.7=8 — D-048 圧縮 3 段落 (5.0.10 + 5.3.1 + 5.3.2) を含む)
- 全 estimated_words: 約 15,300 字 (heavy 数学節 §5.1-§5.5 で約 11,200 字、light 節 §5.0/§5.6/§5.7 で約 4,100 字)
- pages_check: 28p × 1400 字/p ≒ 39,200 字目安に対し outline は 15,300 字 — outline は paragraph 中核命題のみで本文展開時に約 2.5 倍に膨らむ前提 (D-047 証明スケッチ 5-10 行 / 図表説明 / 引用文の本文展開分) で整合
- 節 page 配分: 2.5 + 5 + 5 + 5 + 4 + 2.5 + 3 + 1 = 28p、各節の paragraph 数と word 配分は heavy 節 (§5.1-§5.4) で 13-18 paragraphs / 段落 150-210 字、light 節 (§5.0/§5.6/§5.7) で 8-13 paragraphs / 段落 120-180 字に収まり整合

