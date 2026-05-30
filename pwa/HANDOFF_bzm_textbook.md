# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-30 (後半2) / トピック: **モデルが P×R×S 3因子へ進化**。F3 生成・論文付録ABC・自走性/生存条件式/潜在規模を knowledge に正本化・新式(A=9軸)ティエム試算。次は P×ライスワーク実益データ収集→校正→本番AMD Score実装。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。
> 🚨 **モデル議論の正本は `/Users/masa/projects/knowledge/before_zero_theory.md`** (monorepo 外、新章「2026-05-30 P×R×S 3因子再構成」)。経営知識・モデル議論を `pwa/design/` に書くのは AGENTS.common 違反 (今セッションで是正済)。ティエム固有は `knowledge/tiem.md`。
> 📊 グラフは **matplotlib** で統一 (まさ指示、memory `feedback_graphs_matplotlib`)。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`, 全14章) とアカデミック論文 (JASVE 向け・日本語・IMRaD) を **並行育成**。コンテンツ正本は `pwa/bzm/*.md`、ページ実装 `pwa/src/app/(app)/bzm/`、レンダラ `BzmMarkdown` (KaTeX + `img`)。**モデル定義の議論正本は `knowledge/before_zero_theory.md` (monorepo 外)**。

## 最新セッション要約 (2026-05-30 後半2) — ここが今回の主成果

このセッションは「論文の図」から始まり、**AMD Score の根本的なモデル進化**に発展した。

### A. 図・論文 (前半)
- **F3 (retrofit 時系列図) を B案=自己整合再計算で生成** (`pwa/scripts/bzm_figures.py` の `fig_f3()` → `pwa/public/bzm/f3_retrofit_timeseries.png`)。theory §9 ティエム軸値を Cobb-Douglas に通して再計算。設立2012(133) vs 仮想2017(2861) ≈ 22倍 (期待値ベース23倍とほぼ一致=ロバスト)。教科書 6-1 §3.2 (図6-1) と論文 §4.2 (図5) に埋め込み。
- **論文ドラフト精緻化** (`pwa/design/bzm_paper_draft.md`): 付録A/B/C を「教科書参照」スタブから self-contained 化 (状態空間の固有値→螺旋, 記号表, ERS 8軸構造+7-c rubric)、§4.2 に表1 (ティエム時系列)。
- **v0.10.8 デプロイ済**。F3 本番配信確認済 (200)。

### B. モデル進化 P×R×S (後半・本丸)
まさのティエム振り返り (モノリス/パウダーで TRL が違う・VC 頼り切らずライスワークで自走) から、AMD Score の構造そのものを再設計:

```
AMD Score_new = P(潜在規模) × R(到達度=XRL群) × S(生存確率 = σ_SU × FRL × ライスワーク実益)
```
- **R = XRL群 (TRL/BRL/GRL/SRL/HRL 全部)**。GRL/SRL も「PJ が外部環境に侵食し始める Readiness」として含む。
- **S = σ_SU × FRL × ライスワーク実益**。内部自走性 × 外部資金環境 × 創業者力。
- **P = 潜在規模 (新設)**。従来 DCF ≒ P の上位互換 (到達度 R と生存確率 S を掛けて精度を上げる)。
- **生存条件式 `B − R_net ≤ F`** (B=本命バーン, R_net=ライスワーク純貢献, F=無理ない調達上限)。自走BEP は F=0 の特殊ケース。
- **(A) フラット9軸 Cobb-Douglas に確定** (現行7軸 + P + RW の2軸追加 = 既存を壊さない拡張)。
- **ティエム試算済** (`pwa/scripts/prxs_retrofit_test.py`、全て仮値): 史実(商社せずRW=0) vs 反実仮想(商社RW立ち上げ) で 2017 に 4.2倍差。「自走してれば生存確率Sが上がり評価が伸びた」を定量化。

### C. 是正・正本化
- **AGENTS.common 違反を是正**: モデル議論・ティエム経営知識を `pwa/design/bzm_retrofit_cases.md` に書いていた (場所違反 + tiem.md と重複) → `knowledge/before_zero_theory.md` (新章) + `knowledge/tiem.md` (相互リンク) に移管、design 側は削除。
- グラフ matplotlib 統一を memory 化。

## リポ状態

- **branch: `main` 直運用** (旧 `feat/bzm-textbook` は別セッションが main にマージ済・削除済。CLAUDE.md「main 直運用」ルール確定)。
- 今セッションの BZM commit はすべて main に push 済 (最終 `146679d`)。未 push なし。
- 作業ツリーは他セッションの dirty を多数含む。**`git add .` / broad revert 禁止**。対象ファイルのみ個別 stage → 即 push。
- BUILD_VERSION は別セッションが v0.10.9 に bump 済 (本番反映は別管轄)。

## 2026-05-30 後半3 セッション成果（データ収集→rubric化フェーズ）

**B(モデル)を大きく前進。確定事項と成果物:**

1. **収益化指数 (R_net) — 軸名・定義 確定（まさ）**: 旧「ライスワーク実益/RW」廃止（RW2文字は積と誤読/系統I連想）。**系統I(つなぎ事業)と系統II(本命の先行収益)を区別しない**＝本命/非本命問わず「事業が生む純キャッシュ貢献 R_net」。理由: ①収益あれば系統問わず生存↑ ②系統IIはR軸も上げるのでモデルが自然に差を吸収。生存条件式 `B−R_net≤F`。
2. **創薬RW=0問題 — まさ見解確定**: 創薬はRW=0でも事業化プロセスの型確立+大EXIT+大Pで S を別ルート確保→大差にならない。SをRW一本に依存させない。
3. **全9PJのP/R_net/XRLデータ収集完了**（捏造せず L2 + Web市場調査 + まさ口述）。各PJ md に出典付き記録。**LST.md 新規作成**（p07, 設立2023-07-06, Before0, UMI打診→星野CEO/まさCOO/2年弱体制構築）。jc/BWE/KT/yd/tiem/ctb に口述+Web反映。
4. **9PJ横断 retrofit スクリプト** `pwa/scripts/prxs_9pj_inputs.py`（push済）。設立時点スナップ・根拠付き0-9化。結果: ティエム(P最大でもTRL0でScore最下位級)・CTB(RW=0でも中位)がまさ直感どおり再現。図 `public/bzm/_prxs_9pj.png`（配信外）。
5. **判定 rubric v0.1 新設** `knowledge/xrl_rubric.md`（まさ依頼）: 各軸0-9を案件ごとブレずに埋める観測可能Yes/Noチェックリスト（「ラボで原理検証」「顧客からROI獲得」「COOいる」「CFOいる」等）。既存SIP9段階を観測項目に分解。9軸網羅。
6. **論文§1.1 DCF修正済**（前半）。

## 次セッションの最初の一手

**最優先: rubric を運用に乗せて値を締め、重み校正へ。**

1. **rubric v0.1 をまさレビュー** (`knowledge/xrl_rubric.md`)。チェック項目の過不足を磨く。承認後、9PJの0-9値を rubric ベースで再評価（現在の値は rubric 前の第一次置き）。
2. **重み校正**: αP/α収益化指数 を、まさの体感ランキングと9PJ retrofit 順位を照合して締める。
3. **多元スケール（まさ方針）**: 別指標を作らず、成功スケール(ユニコーン/中規模自走/ライセンス)ごとに **α を変えるだけ**で成立するか検証。足りなければ1-2変数追加。評価は「Pに対する達成」で読む。
4. **時点 = 経時で見る（まさ確定）**: 設立時点だけでなく時系列で rubric を当て、スコアの**理論値と実測値の乖離**を見る（データは激増するが価値大）。
5. **反実仮想ツール**（別軸で重要）: 「ティエムが商社やってたら」等、R_net を変えた複数ビジネスプラン比較。他PJのBM検討にも転用。
6. **本番 AMD Score 実装に2軸追加** (`pwa/src` amd-score系)。校正確定後。順序: 試算→データ→rubric→校正→本番。
7. (低優先) 概念図 G1/G3 外部生成依頼、論文§2 引用精緻化。

## ポインタ

- **モデル議論の正本** ⭐⭐⭐: `/Users/masa/projects/knowledge/before_zero_theory.md` (monorepo 外、新章 P×R×S + 収益化指数確定 + 判定rubric方針)
- **判定 rubric** ⭐ (各軸0-9のチェックリスト): `/Users/masa/projects/knowledge/xrl_rubric.md`
- ティエム固有 (モノリス/パウダー・商社案・retrofit): `/Users/masa/projects/knowledge/tiem.md`
- LiSTie 固有 (p07, リサイクル先行→装置販売, Before0): `/Users/masa/projects/knowledge/LST.md`
- 各PJのP/R_net生データ: 各 `knowledge/{pj}.md` の「P（潜在規模）」節 + before_zero_theory.md「データ収集」章
- 教科書 全14章: `pwa/bzm/*.md` / 論文化設計: `pwa/design/bzm_paper.md` / 論文ドラフト: `pwa/design/bzm_paper_draft.md`
- データ図ジェネレータ: `pwa/scripts/bzm_figures.py` (F1-F5) / 新式試算: `pwa/scripts/prxs_retrofit_test.py`
- AMD Score / theory 正本: `/Users/masa/projects/AMD/before-zero/theory/amd_score.md` (monorepo の**外**)、`pwa/design/amd_score.md`、`pwa/design/institution_readiness.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` / バグ: `pwa/BUGS.md`
- deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (直 `npx vercel` 禁止)、deploy 前に必ず BUILD_VERSION bump。グラフは matplotlib 統一。
