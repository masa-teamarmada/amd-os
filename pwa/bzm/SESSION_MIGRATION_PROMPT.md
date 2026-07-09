# Book A 出版準備セッション 引き継ぎプロンプト (2026-07-09 → 次セッション)

BZM Book A『ディープテック起業の経営学』(仮) の出版準備専用セッション。前セッションで第2章の起草をステージ4 (段落 draft) まで進めた。**次の最優先タスクは第2章の敵対検証を resume で完成させ、正本化すること。**

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — 大原則。共通人格・作業姿勢・安全運用・記憶管理・正本参照ルールの正本。全セッションの起点。ここを飛ばして技術作業に入らない。
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — **AMD level memory (cwd が AMD 配下なので冒頭で必ず読む)**。全社共通 feedback (契約雛形 / まさ役割 / 対外資料スタイル等) はここに集約。
3. cwd が `/Users/masa/projects/AMD/before-zero/...` 配下なら、そのセッションの auto-load memory (MEMORY.md) も読む。
4. `origin/main:pwa/bzm/HANDOFF_BOOK_A_2026-07-09.md` — 前セッション要約 + 未解決タスク + 次アクション (読み方は下記「作業方式」)。
5. `origin/main:pwa/bzm/BOOK_A_CHAPTER_2_PROGRESS.md` — 第2章 L3。**「resume 手順」「取得済み must_fix / should_fix」を必ず読む** (次タスクの実行手順そのもの)。
6. `origin/main:pwa/bzm/BOOK_A_MASTER_PLAN.md` — Book A 専用 L1。§7 制作 pipeline + **制作モデルミックス** / §9 Ch 2・Ch 3 章別詳細。
7. `origin/main:pwa/bzm/BOOKS_PORTFOLIO.md` — ポートフォリオ L1 上位。特に **PF-015 (自費出版+監修体制)・PF-016 (分量帯域+モデルミックス)** / PF-012 / PF-014 / §5 露出台帳 / §7-16 商標調査結果。
8. 必要参照: `origin/main:pwa/bzm/terminology_glossary.md` §5 (開示Lv1-4・戻る/復帰条件) / `BOOK_DECISIONS.md` (D-014 章 pipeline、D-056〜061)。

## 作業方式 (bzm ファイルの読み書き手順)

ローカル checkout に bzm ファイル群はない。
- **読む**: `cd /Users/masa/projects/AMD/amd-os && git fetch origin main && git show origin/main:pwa/bzm/<file>`
- **書く**: origin/main ベースの一時 worktree を作り (`git worktree add --detach <tmp> FETCH_HEAD`)、対象ファイルだけ編集 → commit → `git push origin HEAD:main` → worktree remove。push が弾かれたら fetch → `git rebase origin/main` → push。**ローカル main は触らない。新規ブランチは作らない** (AGENTS.common.md の全面禁止ルール)。
- bzm の md / 台帳 / handoff 系の commit + push は**承認を取らず即実行** (まさ確定済み feedback)。
- **並走セッションあり**: P1 論文セッション・商標調査ワーカーが同じ正本 (BOOKS_PORTFOLIO / BOOK_DECISIONS) を触る。push 前に必ず fetch。

## 状態スナップショット (2026-07-09 時点)

- **origin/main HEAD**: この handoff bundle の commit (商標ワーカー `b58450f2` の上)。まず `git fetch` で最新を取る。
- **第2章の本文 v1**: `pwa/bzm/BOOK_A_CH2_DRAFT_v1.md` に退避済み (9節・約17,800字・WIP・非正本)。§2.8 のみ must_fix 3件反映済み、他8節は生 draft。**正本 `book-a-ch-2.md` はまだ無い。UI (bzm-chapters.ts) 未登録。**
- **第2章の制作 run**: `wf_ea405cb2-201` (script = `~/.claude/projects/-Users-masa-projects-AMD-before-zero--claude-worktrees-relaxed-curie-c02686/f4da7fee-5c87-4b5c-90e9-96fca1900d60/workflows/scripts/book-a-ch2-draft-wf_ea405cb2-201.js`)。前セッションで student/auditor persona に出力制約 (findings 最大10件・引用50字以内) を追記済み。**別セッションからは同 run の cache に到達できない可能性が高い** — その場合のフォールバックは L3 参照。
- **第1章**: v1 draft 完成 (17,007字、AMD OS `/bzm/book-a-ch-1` 公開済み、status in-progress)。ステージ6 (まさ段落確定) 未了。PF-016 で分量論点は解消済み。
- **15章 TOC v1 = まさ承認確定 (PF-014)**。仮題『ディープテック起業の経営学』+ 副題「— 会社設立前 (Before Zero) の評価と意思決定」。商標調査で「Before Zero」系 全0件 = タイトル確定の追い風 (単著+監修なら K7 はまさ一存で確定可)。

## 次タスク詳細 (この順で実行)

### 1. 🔥 handoff bundle を push (未 push なら) → 第2章 verify を resume で完成
- L3 `BOOK_A_CHAPTER_2_PROGRESS.md` の「resume 手順」を実行: `Workflow({scriptPath: "<上記script>", resumeFromRunId: "wf_ea405cb2-201"})`。
- 走ると: outline/draft/verify(instructor/editor/theorist) は cached 即返し、verify(**student/auditor**) が live 新規実行、fix が全 must_fix 再集計で live 再反映。
- **student (読者体験・知財の足場かけ) と auditor (匿名化・Tier規律・場面クレーム規律) が第2章品質の最終ゲート**。この2観点の must_fix は必ず反映する。
- resume が別セッションで効かない場合: `BOOK_A_CH2_DRAFT_v1.md` を起点に、L3 の「取得済み must_fix / should_fix」を手で反映 (script 本体は再利用可)。**統合判断・裁定はえいみ本体でやる** (子エージェント = Sonnet/Opus)。

### 2. 第2章を正本化 (verify 完成後)
- 完成本文を `pwa/bzm/book-a-ch-2.md` として作成 (KaTeX 数式は $...$、ただし本章は数式ゼロ回)。
- `pwa/src/app/(app)/bzm/bzm-chapters.ts` に登録: part=`book-a`、slug=`book-a-ch-2` (第1章 `book-a-ch-1` の登録形が手本)、status=`in-progress`。
- `pwa/src/lib/build-info.ts` の BUILD_VERSION を bump。
- push → AMD OS `/bzm/book-a-ch-2` で表示確認 (Vercel 自動 deploy、承認不要)。
- `BOOK_A_CH2_DRAFT_v1.md` を削除 (正本化済みなので不要)。L3 のステージ6 を ✅ に、正本パスを記帳。

### 3. まさ詳細レビュー (ステージ6)
- 第2章の申し送り**論点1** (第1章章末予告「あの支援会議の場面に戻る」と第2章章頭 [別の会議室] の接続 — 第1章側の一文を「別の会議室から始めます」等に微修正する案) と**論点3** (B面の答え合わせで「メール = HOLD・登記 = WAIT」と言い切りつつ「語彙の当て方は分岐し得る」と添えるバランス) を draft を見せて確定。
- 第1章のステージ6 (段落確定) も未了なので、第1章側の一文微修正と併せてまさに提示。

### 4. 第3章の起草 (第2章が片付いたら)
- 同 pipeline: 節 skeleton (3 persona × synth、本体で統合) → まさ確定 → 段落 outline/draft (Sonnet 5、9節前後並列) → adversarial verify (5 persona、Opus 4.8、student/auditor には出力制約を最初から入れる) → must_fix 反映 (Sonnet) → 本体で裁定 → 正本化。
- Ch 3 = 評価問題の定式化 (DCF の限界 + 期待値分解 E[V]=P×R×S)。TOC 仕様は `BOOK_A_MASTER_PLAN.md` §9 Ch 3。素材 = model-overview.md (章頭)・why-valuation-fails.md (was 挿話)。

### 5. (低優先・まさ指示待ち) 石原先生打診パッケージ
- Book A **監修**依頼 + P1 **共著**依頼の1パッケージ (D-061 / PF-015 で共著→監修に変わり得る点に注意)。えいみドラフト可。

## このPJで確立済みの運用ルール (事故防止)

- **執筆規律 (絶対)**: 数式は全部入り (PF-001)。教育的順序 = 直感→式→worked example→演習。worked example は全て架空パラメータ、校正定数の採用値は非公開 (PF-010)。定理の初出はしない (学術初出は P1・モノグラフ専属)。素材は実戦書ドラフト17章のみ (PF-004)。章頭ストーリー冊子間0%共有。
- **対外本文にプロセスを混入させない** (AGENTS.common.md): ペルソナ / ワークフロー / スケルトン / must_fix / PF-xxx / D-xxx / 「モノグラフ」「Book B」等の内部語、実名 (機関名・人名・PJ略称 KENQ/SX/TIEM/YD/JC 等)、validation 語彙を本文に出さない。ケースは匿名化 composite 宣言。draft workflow の機械検査 (BANNED 語リスト) がこれを検出する。
- **分量帯域 (PF-016)**: 章 15,000〜18,000字 (数理章 22,000字まで)。字数上限は水増し検出用であり削るためではない。帯域超過時のみ減圧順序 (L1 §8) を適用。
- **制作モデルミックス (PF-016)**: outline/draft/fix = Sonnet 5、verify = Opus 4.8、統合/裁定/記帳 = 本体。品質ゲート = 5 persona verify + まさ確定。
- **記帳の順序**: 決定・成果は必ず正本 md (L1 / L3 / glossary / PF 判例) に記帳してから commit + push。
- **コスト意識**: 完了通知のたびに細かく動かず、まとめて処理してターン数を最小化 (本体の文脈読み直しが主コスト)。本体は Opus 4.8 セッション推奨。

## このセッションで作った branch/worktree

なし (origin/main ベースの一時 worktree で編集 → push → remove。新規ブランチなし)。
