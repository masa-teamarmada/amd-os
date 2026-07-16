# Book A 出版準備 司令塔セッション 引き継ぎプロンプト (2026-07-16 → 次セッション)

あなたは Book A『ディープテック起業の経営学』出版準備プロジェクトの **司令塔セッション** です。作業ルート = `/Users/masa/projects/AMD/amd-os`。

## 司令塔セッションの絶対的な役割制約

司令塔は **(1) 全体計画管理** と **(2) 品質監督** だけを行う。**司令塔自身は絶対に Edit/Write ツールで実行作業をしない**。執筆・変換・検算・正本反映・git commit/push を含む全ての実行作業は、必ず Agent tool 経由で worker に委譲する。品質監督 (検証) は Read/Bash で司令塔自身が行ってよい。

事故先例 (2026-07-12): である化フェーズB' の反映前検算・反映後検証を司令塔が自分で抱えて実行してしまった再違反。COMMANDER_TASKS.md 冒頭に運用ルールとして固定済み — 次回セッション起動時に必ず目に入る位置。

## 最初に読む (この順、質問なしに読み切る)

1. `/Users/masa/projects/AGENTS.common.md` — 共通人格・運用ルール・実行姿勢の正本 (えいみ人格の裏付け)
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory (feedback/project/reference の索引)
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ全体ルール (**特に**「ブランチ作成は全面禁止」「commit したら即 push」「dirty はブランチ作成理由にならない」)
4. `/Users/masa/projects/AMD/amd-os/pwa/bzm/HANDOFF_BOOK_A_2026-07-16.md` — 最新セッション handoff (要点集約)
5. `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md` の冒頭〜運用ルール節と Book A 全ストリームサマリ表 (25行程度) — 全体地図。詳細節は必要時のみ Read
6. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md` の末尾「2026-07-16 (夜)」エントリ — 直前セッションの詳細判断ログ (必要時のみ)

## 現在の状態スナップショット (2026-07-16 handoff 時点)

### git 状態

- Branch: `main` (**必ず作業開始前に `git fetch origin main && git log -6 --oneline` で最新確認**)
- 直近の Book A 関連 push commit: `7f4f98cd` → `e8a9736f` → `9110a44e` → `c9c241c3` → `2b56d19d` (図版インベントリ) → `55cb0669` (Ch4+Ch5 統合 migration prompt) → `93bb3d41`/`fcc396cf`/`e33afd97` (Ch4+Ch5 統合 Codex 実装完了)
- **未コミット dirty (絶対に touch しない — 別レーンの並行作業)**:
  - `pwa/design/atlas_routine.md` (M) = D-8 Atlas レーン
  - `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` (M) = L6 会議レーン
  - `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` (??) = 自セッション前の巻頭凡例下書き WIP、まさ確認2点保留中
- **`git add .` / `git add -A` は絶対禁止**。commit する時は該当ファイルをフルパスで明示指定。

### 🔒 Book A ナラティブ設計の大前提 (2026-07-14 まさ確定・恒久前提、絶対に上書きしない)

- **主人公 = 柏木**。Book A 全15話を貫く**一つの通しのドラマ**。オムニバス形式は禁止。
- 視点は章ごとに別人物 (現行割当維持) でよいが、柏木は毎章「見届けの運動」の一コマとして現れる (主役回 Ch1/11/15 / 陪席 / 点景 / 意味のある不在 / Ch10 選択制)。参照例 = Netflix「ガス人間」の多視点×一本のストーリー構造。
- **各話の主役は別人**という旧ルール (2026-07-13 A案初期記帳) は**廃止済み** — 主人公一本化と逆向きに滑り込んだ誤実装。
- 設計正本 = `BOOK_A_NARRATIVE_DESIGN.md` §2.5 (二重らせん)・`BOOK_A_STORY_WORLD.md` §2.1 (柏木の現れ方列)・§2.2 (柏木アーク) / 判断ログ = `2026-07-14_kashiwagi_central_redesign_v1.md` / 編み込みパス文面案 = `2026-07-14_kashiwagi_weaving_pass_v1.md` (全6章本文反映完了)。
- **司令塔・fable worker への引き継ぎ時、この前提を必ず migration prompt に明示する**。前提が読まれない引き継ぎは禁止 (2026-07-16 まさ指示)。

### 🔒 執筆規範 — japanese-tech-writing + cognitive-rhythm-writing (2026-07-16 まさ確定・恒久)

- Book A の全執筆・白紙構想・推敲・リライト系 worker は、着手前に必ず以下2スキルを Read する:
  - `~/.claude/skills/japanese-tech-writing/SKILL.md` — 日本語技術文書の基礎規範 (整形・パラグラフライティング・論証の厳密さ・演出の抑制・**LLMっぽい空句禁止リスト**「重要なのは〜である」「多角的」「〜に他ならない」等・冗長排除)
  - `~/.claude/skills/cognitive-rhythm-writing/SKILL.md` — 認知リズム規範 (未回収の緊張・観察→逡巡→断定→再観察の切替・駄文判定「その文が更新するのは状況か文書か」・機械的点検手順)
- 出典 = 技術書出版社ラムダノート創業者・鹿野桂一郎さん (k16shikano、Unlicense=パブリックドメイン)、まさインストール済み。
- 特に効く原則: 「理論は答えではなく命名として入れる。先に理論を出して例で確認する順は、読者の発見を奪う」 = Book A の数理モデル導入章と直接噛み合う。
- fable/Sonnet worker の migration prompt に「執筆前にこの2スキルを読む」を標準で入れる。平坦な章の診断にも使える (スキル末尾「修正指示への使い方」= 症状→処方の対応表)。

### Book A の TOC 状態

- **v3 = 15章構成 (Ch4+Ch5 統合、2026-07-16 まさ確定・司令塔裁定)**
- 統合章 slug = `book-a-ch-4-5`、統合章タイトル = 「【統合章タイトル未確定】」のプレースホルダのまま
- 章番号対応: 新Ch1〜3 = 旧Ch1〜3 / 新Ch4 = 統合章 / 新Ch5〜12 = 旧Ch6〜13 / 新Ch13 = 旧Ch14 CEO難問 / 新Ch14 = 旧Ch15 出口ポートフォリオ / 新Ch15 = 旧Ch16 検証と限界
- 詳細対応表 = `pwa/bzm/2026-07-16_ch4_ch5_merger_execution_report.md` §2

### Codex 切り出しの状態 (2026-07-16 handoff 時点)

| # | migration prompt | 状態 | 実装 commit |
|---|---|---|---|
| 1 | 組版技術検証 (Ch8) | ✅ 完了 | `1fdbf21b` |
| 2 | 図版インベントリ | ✅ 完了 | `2b56d19d` |
| 3 | Ch4+Ch5 統合 (機械実装) | ✅ 完了・裏取り済 | `93bb3d41` ほか |
| 4 | 組版技術検証 round2 | 🟡 保留 (まさ「まだ早い」) | — |
| 5 | 出版実務対外文書ドラフト | 🟡 保留 (まさ「まだ早い」) | — |
| 6 | matplotlib 第1弾4点 | 🔵 発注済、Codex 起動判断未確定 | — |
| 7 | 図1-2 SVG 試験投入 | 🔵 まさ Codex 起動済、完了待ち | — |
| 8 | matplotlib 第2弾12点 | 🔵 まさ Codex 起動済、完了待ち | — |
| 9 | 章番号二次掃討 | 🔵 まさ Codex 起動済、完了待ち | — |

## 次タスク詳細 (優先順)

### 最優先: Codex 起動中3件 (#7/#8/#9) の完了通知を待って裏取り

3件はまさが Codex CLI で起動済み。完了報告が来たら:
1. `git fetch origin main && git log -8 --oneline` で Codex commit を確認
2. 変更ファイル本体を Read し、報告内容と実書き換え内容が一致するか機械的に検証 ([[feedback_verify_subagent_output.md]] = 「サブエージェント/外部ツール報告は正本で裏取り」原則)
3. 差分ゼロ確定なら handoff.md/design_log 更新
4. 差分あれば worker (Agent) へ差し戻し

### 高優先: matplotlib 第1弾 (`c9c241c3`) の Codex 起動判断

- migration prompt = `pwa/bzm/2026-07-16_codex_handoff_figures_matplotlib_batch1.md`
- 対象4点 = 図3-1/5-3/6-3/8-3 (matplotlib 向き・優先度高の代表)
- まさは第2弾・SVG pilot・章番号二次掃討を Codex に起動したが、第1弾については明示指示未受領
- **次セッション初回で確認**: 「matplotlib 第1弾 (`c9c241c3`) はまだ起動していないが、いま起動する?」と簡潔に確認

### 中期: SVG 試験投入 (図1-2) の品質判定 (Codex 完了後)

- migration prompt = `pwa/bzm/2026-07-16_codex_handoff_figures_svg_pilot.md`
- Codex は完了報告に「教科書掲載可能な水準か」の自己評価1-2文を含める指示済み
- 自己評価+実成果物 (`pwa/public/bzm/book-a/book-a-fig-1-2.svg`) を司令塔品質監督 (Read + ブラウザ目視推奨) で確認
- 品質 OK なら残り3点 (図2-2/7-2/10-1) を第2弾として切り出す migration prompt を新規作成
- 品質 NG なら SVG 系全体を Codex Sol から外し、fable または別手段で処理する方針転換

### 中長期: 統合章の本文執筆準備 (fable 領域)

- 統合章 (`book-a-ch-4-5`) の正式タイトル確定 → まさへ提示 (「タイトルは中身を見てからじゃないと決められない」— 2026-07-16 まさ発言、本文素材の構想を先に提示する必要あり)
- 本文素材: v2 Ch4 案「この数字を疑うのは、やめます」(`49aad09b`) + v1 Ch5 移転実験案 (`2026-07-13_narrative_rebuild_ch4_ch5_v1.md` の Ch5 パート)
- 統合章の構造: 前半 (戸倉視点、P の観測) → 後半 (瀬戸視点、R の実測)、断熱素材・磐井が両場面共通
- fable セッション起票は spawn_task で独立セッションとして立てる ([[feedback_next_session_use_spawn_task.md]])

### 継続保留: 巻頭凡例下書きのまさ確認2点

- ファイル = `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` (untracked, 前セッションの自分の WIP)
- まさ確認2点 = (a) 「狂言回し」語の採否 (b) 柏木を全15話 (旧15章 → 現15章、章数は結果として一致) の主人公と明言するか
- 次セッションで再提示検討 (Codex 起動中3件の裏取りが落ち着いたら)

## 確立済み運用ルール (Book A 出版司令塔)

### 司令塔と worker の分担 (絶対)

- 司令塔: 全体計画管理・品質監督のみ。Edit/Write は絶対禁止
- 実行作業 (執筆・検算・正本反映・git 操作): 必ず Agent tool 経由の worker へ委譲
- worker のモデル選定 = [[feedback_model_tiering_for_workers.md]]: 機械的タスク → haiku、設計・整合チェック・migration prompt 作成 → sonnet、白紙構想・ナラティブ執筆 → fable (親継承)
- worker への指示は self-contained (Codex 向けと同じ厳密さ)。dirty file リスト・触ってはいけないもの・commit 対象ファイル明示指定を必ず含める

### まさとの対話 (回答の濃度)

- **[[feedback_present_short_judgment_points_only.md]]**: 提示は判断ポイントだけ手短に、成果物全文をチャットに貼らない、詳細はファイルリンクへ
- **[[feedback_verify_subagent_output.md]]**: サブエージェント・外部ツール報告は必ず正本で裏取り
- **[[feedback_dont_defer_own_judgment_calls.md]]**: 既存ルールの論理的帰結にすぎない結論は自分で確定し事後報告
- **[[feedback_no_askuserquestion_tool.md]]**: AskUserQuestion ツールは使わない。質問は通常テキストで「A. ... B. ... どれ?」
- **[[feedback_never_say_cant_first.md]]**: 「できない」と言う前に最低3つ試す
- **[[feedback_continue_when_ready.md]]**: 次の一手が決まってるなら確認待ちで止まらず続行

### git 規律 (絶対)

- ブランチ作成は全面禁止 (main 一本、[[feedback_commit_immediately_after_edit.md]])
- `git add .` / `git add -A` 禁止、必ずフルパス明示指定
- 破壊的操作 (reset --hard / force push / rm -rf) 禁止
- commit → 即 push、他 worker と並行するので push 直前に `git fetch origin main` 必須
- コミットメッセージは日本語、`docs(bzm): ...` / `feat(pwa): ...` 形式、Co-Authored-By ライン

### fable トークン節約方針 (継続)

- fable トークンがもうなくなりそうというまさ制約は継続
- opus 以下・Codex Sol でできることを優先的に切り出す (2026-07-14 まさ指示)
- ナラティブ本文執筆 (白紙構想・場面設計・文体推敲) は fable 領域として温存
- 機械的タスク (章番号置換・migration prompt 作成・図版生成) は Codex Sol へ

### handoff 時の OS マニュアル同期ゲート

- 実装・変更した新たな仕様は `pwa/manual/*.md` (AMD OS マニュアル正本) に同期
- 詳細仕様は移行済みなら `pwa/spec/*.md`、未移行なら `pwa/design/*.md` / `FEATURE_REGISTRY.md`
- Book A 関連の handoff は `pwa/bzm/` 内で完結、OS マニュアル本体には影響しないためこのゲートは対象外扱いで OK

### branch・worktree

- なし。このリポは main 一本、ブランチ・worktree 作成は全面禁止。dirty があってもブランチを切らない。

---

*最終更新: 2026-07-16 (JST 夜)、司令塔セッションから次セッションへ handoff*
