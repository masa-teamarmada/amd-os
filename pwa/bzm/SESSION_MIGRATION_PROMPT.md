# Book A 出版準備セッション 引き継ぎプロンプト (2026-07-09 第2セッション → 次セッション)

BZM Book A『ディープテック起業の経営学』(仮) の出版準備専用セッション。第2章は敵対検証・正本化・公開・まさレビュー①②まで**完全クローズ** (OS `/bzm/book-a-ch-2` 公開)。第1章の章末予告も第2章接続で修正済み。**次の最優先タスクは第3章の起草** (評価問題の定式化 = DCF の限界 + 期待値分解 E[V]=P×R×S)。

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — 大原則。共通人格・作業姿勢・安全運用・記憶管理・正本参照ルールの正本。全セッションの起点。ここを飛ばして技術作業に入らない。
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — **AMD level memory (cwd が AMD 配下なので冒頭で必ず読む)**。全社共通 feedback (契約雛形 / まさ役割 / 対外資料スタイル等) はここに集約。
3. cwd が `/Users/masa/projects/AMD/before-zero/...` 配下なら、そのセッションの auto-load memory (MEMORY.md) も読む。
4. `origin/main:pwa/bzm/HANDOFF_BOOK_A_2026-07-09.md` — 前セッション要約 + 未解決タスク + 次アクション。
5. `origin/main:pwa/bzm/BOOK_A_MASTER_PLAN.md` — Book A 専用 L1。**§9 Ch 3 (第3章 TOC 仕様)** / §7 制作 pipeline + 制作モデルミックス / §8 減圧順序。
6. `origin/main:pwa/bzm/BOOK_A_CHAPTER_2_PROGRESS.md` — 第2章 L3。**完成形の手本** (v2記録・pipeline の実際・敵対検証の反映粒度)。第3章を同じ流儀で起こすための最良の参照。
7. `origin/main:pwa/bzm/BOOK_A_CHAPTER_1_PROGRESS.md` — 第1章 L3。ステージ6 の残り論点 (申し送り2-5)。
8. `origin/main:pwa/bzm/BOOKS_PORTFOLIO.md` — ポートフォリオ L1 上位。**PF-015 (自費出版+監修体制)・PF-016 (分量帯域+モデルミックス)** / PF-012 / PF-014 / §7-16 商標調査結果。
9. 必要参照: `origin/main:pwa/bzm/terminology_glossary.md` (**§4 乗法/加重和/補完性の3層対応表** = 第3章 P×R×S の土台、§5 開示Lv1-4・戻る/復帰条件) / `BOOK_DECISIONS.md` (D-014 章 pipeline、D-056〜061)。

## 作業方式 (bzm ファイルの読み書き手順)

ローカル checkout に bzm ファイル群はない。
- **読む**: `cd /Users/masa/projects/AMD/amd-os && git fetch origin main && git show origin/main:pwa/bzm/<file>`
- **書く**: origin/main ベースの一時 worktree を作り (`git worktree add --detach <tmp> FETCH_HEAD`)、対象ファイルだけ編集 → commit → `git push origin HEAD:main` → worktree remove。push が弾かれたら fetch → `git rebase origin/main` → push。**ローカル main は触らない。新規ブランチは作らない** (AGENTS.common.md の全面禁止ルール)。
- bzm の md / 台帳 / handoff 系の commit + push は**承認を取らず即実行** (まさ確定済み feedback)。**git commit 前に staged set を `git status`/`git diff --staged --stat` で必ず確認**。
- **並走セッションあり**: amd-os 本体・P1 論文・商標調査ワーカーが同 main を触る。push 前に必ず fetch。BUILD_VERSION は並走が先に bump していることがあるので、書く直前の値を見てから +1 する。

## 状態スナップショット (2026-07-09 第2セッション終了時点)

- **origin/main HEAD**: この handoff bundle の commit (第1章予告修正 `431f5d4e` + 並走の上)。まず `git fetch` で最新を取る。
- **第2章**: ✅ 完全クローズ。`pwa/bzm/book-a-ch-2.md` 正本化・OS `/bzm/book-a-ch-2` 公開 (status in-progress)・BUILD_VERSION v0.39.18・まさレビュー①②承認済み。WIP退避ファイルは削除済み。**第3章を起こすときの手本 = 第2章の L3 と本文**。
- **第1章**: v1 公開済み (`/bzm/book-a-ch-1`、status in-progress)。1.6 予告文は第2章接続で修正済み (「別の会議室から始めます——…誰の時計だったのか、それを数えながら」)。**ステージ6 の段落確定 (申し送り論点2-5) は未了**。
- **第3章 (次の主戦場)**: 未着手。TOC 仕様は `BOOK_A_MASTER_PLAN.md` §9 Ch 3。素材 = 実戦書ドラフト (PF-004) の model-overview.md (章頭)・why-valuation-fails.md (was 挿話)。素材の所在は前 run の scratchpad か amd-os の実戦書ドラフト該当パス (第2章の素材は `ch2-sources` に集めた — 同様に集める)。**数式が戻る最初の章** (第1-2章は数式ゼロ/宣言のみ、第3章から E[V]=P×R×S の定式化、KaTeX $...$)。
- **bzm-chapters.ts の登録**: book-a-ch-1〜15 の slug/title/summary は**既に登録済み**。各章は正本化時に status を `not-started`→`in-progress` に変えるだけ (第2章と同じ)。
- **15章 TOC v1 = まさ承認確定 (PF-014)**。仮題『ディープテック起業の経営学』+ 副題「— 会社設立前 (Before Zero) の評価と意思決定」。「Before Zero」系 商標 全0件 = タイトル確定の追い風。

## 次タスク詳細 (この順で実行)

### 1. 🔥 第3章の起草 (評価問題の定式化)
- **同 pipeline** (第2章で実証済み): ①節 skeleton (3 persona 並列 [教科書編集者/MBA·MOT教員/BZM理論家] × 本体で synth統合) → ②まさ確定 (節構成レベル) → ③段落 outline/draft (Sonnet 5、9節前後並列) → ④adversarial verify (5 persona、Opus 4.8) → ⑤must_fix 反映 (Sonnet) → ⑥本体で裁定 → ⑦正本化。
- Ch 3 の中身 = DCF が Before Zero で壊れる四つの壁を示し、評価問題を **E[V] = P×R×S** へ定式化。乗法/加重和/補完性の**3層対応表** (terminology_glossary §4) を導入。TOC 詳細は `BOOK_A_MASTER_PLAN.md` §9 Ch 3。
- **第2章との接続**: 第2章 2.7 末尾が「複数の案件のどれに先に資源を入れるかを比べる物差しがまだない → 第3章の仕事」で閉じている。第3章 2.0 はこの物差しづくりから始める。第2章 2.3 の「計算は第3章から」「数式が戻ってくるのは第3章から」の約束を回収する。
- 正本化: `book-a-ch-3.md` 作成 → `bzm-chapters.ts` の book-a-ch-3 を status `in-progress` に (status 変更のみ) → `build-info.ts` BUILD_VERSION bump (直前値を確認して +1) → push → OS `/bzm/book-a-ch-3` 表示確認 (deploy 成功は `gh api repos/masa-teamarmada/amd-os/commits/<sha>/status` で確認可、/bzm は認証壁で curl 本文は取れない)。

### 2. 第1章ステージ6 (段落確定)
- 第1章 L3 `BOOK_A_CHAPTER_1_PROGRESS.md` の申し送り論点2-5 (章頭ケースの時間設計・演習1-3 出典整合・図版プレースホルダ・知財変数割当て) をまさ詳細レビューで確定。論点1 (分量) と論点6 (予告文) は確定済み。

### 3. (低優先・まさ指示待ち) 石原先生打診パッケージ
- Book A **監修**依頼 + P1 **共著**依頼の1パッケージ (D-061 / PF-015 で共著→監修に変わり得る点に注意)。えいみドラフト可。

## このPJで確立済みの運用ルール (事故防止)

- **執筆規律 (絶対)**: 数式は全部入り (PF-001、ただし第1-2章は数式ゼロ/宣言のみ、第3章から本格化)。教育的順序 = 直感→式→worked example→演習。worked example は全て架空パラメータ、校正定数の採用値は非公開 (PF-010)。定理の初出はしない (学術初出は P1・モノグラフ専属、本文では「本書の理論的基盤を与える学術書 (刊行準備中)」の一般形のみ)。素材は実戦書ドラフト17章のみ (PF-004)。章頭ストーリー冊子間0%共有。
- **対外本文にプロセスを混入させない** (AGENTS.common.md): ペルソナ / ワークフロー / スケルトン / must_fix / PF-xxx / D-xxx / 「モノグラフ」「Book B」等の内部語、実名 (機関名・人名・PJ略称 KENQ/SX/TIEM/YD/JC 等)、validation 語彙を本文に出さない。ケースは匿名化 composite 宣言。draft/verify workflow の機械検査 (BANNED 語リスト) がこれを検出する。
- **分量帯域 (PF-016)**: 章 15,000〜18,000字 (数理章 22,000字まで)。字数上限は水増し検出用であり削るためではない。帯域超過時のみ減圧順序 (L1 §8) を適用。
- **制作モデルミックス (PF-016)**: outline/draft/fix = Sonnet 5、verify = Opus 4.8、統合/裁定/記帳 = 本体。品質ゲート = 5 persona verify + まさ確定。
- **⚠️ verify workflow の実装知見 (第2章で確立 — 次章で必ず効く)**:
  - workflow の `resumeFromRunId` は**同一セッション限定**。別セッションからは前 run の cache/journal に到達できない。→ verify は**1セッション内で完走**させる設計にする。中断したら resume に頼らず、本文を素材ファイルに書き出して verify だけの新 workflow を回すフォールバックが確実 (第2章はこれで仕上げた)。
  - **5 persona の student と auditor には出力制約を最初から入れる**: 「findings は最大10件・issue 内の引用は各50字以内・fix_suggestion は2文以内」。これが無いと JSON 出力が大きくなりすぎて StructuredOutput が retry cap 超過で落ちる (第1章・第2章とも該当 persona が落ちた)。instructor/theorist が落ちても student/editor/auditor + 本体の理論突合でカバーできた実績あり。
  - verify は本文を素材ファイル (`ch<N>-body-v1.md` 等) に書き出して各 persona に Read させる方式が軽い。素材 (章頭ケース・glossary・前章本文・skeleton) も同じ scratchpad に集約する。
- **記帳の順序**: 決定・成果は必ず正本 md (L1 / L3 / glossary / PF 判例) に記帳してから commit + push。
- **コスト意識**: 完了通知のたびに細かく動かず、まとめて処理してターン数を最小化 (本体の文脈読み直しが主コスト)。本体は Opus 4.8 セッション推奨。

## このセッションで作った branch/worktree

なし (origin/main ベースの一時 worktree で編集 → push → remove。新規ブランチなし。closeout 時に `git worktree list` = amd-os 本体のみを確認済み)。
