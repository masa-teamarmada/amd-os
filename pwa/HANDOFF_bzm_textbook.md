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

## 次セッションの最初の一手 (モデル校正・データ収集フェーズ)

**最優先は B (モデル) の前進。まさと一緒にやる必要があるのはデータ収集。**

1. **P (潜在規模) と ライスワーク実益 (RW) の各 PJ データ収集** — 新式 retrofit の前提。ティエム以外 (輝翠/ctb/sx/cx/bwe/yd/LiSTie) を埋める。**軸値は捏造しない**、まさ口述 + L2 (`project_xrl_log` / `project_knowledge`) から。CX=アカデミア市場開拓 (まさ確定済)。ティエム依存を減らすのが目的。
2. **重み αP/αRW の校正** と **スケール頂点の方針** (IPO=100,000 単一頂点 vs 潜在規模 P に応じた多元的成功スケール)。試算で新式が現行7軸より低く出るのは K 正規化の副作用。
3. **本番 AMD Score 実装に2軸追加** (`pwa/src` の amd-score 系)。データと校正が固まってから。現行ロジックを壊さず拡張 (まさ合意済の順序: 試算→データ→校正→本番)。
4. **論文 §1.1 の DCF 記述修正**: 「DCF は設立前に使えない」はえいみの作文の誇張。まさ認識=「DCF は作れるが精度低く評価に使いにくい」に直す。
5. **概念図 G1 (二層構造フロー) / G3 (Triple Helix 螺旋) は外部生成依頼** (まさ)。PNG を `pwa/public/bzm/` に配置して教科書7-1・論文§3.1に組み込む。
6. (低優先) 論文 §2 先行研究の文中引用さらに精緻化。

## ポインタ

- **モデル議論の正本** ⭐⭐⭐: `/Users/masa/projects/knowledge/before_zero_theory.md` (monorepo 外、新章 P×R×S)
- ティエム固有 (モノリス/パウダー・商社案・retrofit): `/Users/masa/projects/knowledge/tiem.md`
- 教科書 全14章: `pwa/bzm/*.md` / 論文化設計: `pwa/design/bzm_paper.md` / 論文ドラフト: `pwa/design/bzm_paper_draft.md`
- データ図ジェネレータ: `pwa/scripts/bzm_figures.py` (F1-F5) / 新式試算: `pwa/scripts/prxs_retrofit_test.py`
- AMD Score / theory 正本: `/Users/masa/projects/AMD/before-zero/theory/amd_score.md` (monorepo の**外**)、`pwa/design/amd_score.md`、`pwa/design/institution_readiness.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` / バグ: `pwa/BUGS.md`
- deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (直 `npx vercel` 禁止)、deploy 前に必ず BUILD_VERSION bump。グラフは matplotlib 統一。
