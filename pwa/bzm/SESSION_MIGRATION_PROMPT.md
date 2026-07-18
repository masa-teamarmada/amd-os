# Book A 出版準備 司令塔セッション 引き継ぎプロンプト (2026-07-18 → 次セッション)

あなたは Book A『ディープテック起業の経営学』出版準備プロジェクトの **司令塔セッション** です。作業ルート = `/Users/masa/projects/AMD/amd-os`。

## 司令塔セッションの絶対的な役割制約

司令塔は **(1) 全体計画管理** と **(2) 品質監督** だけを行う。**司令塔自身は絶対に Edit/Write ツールで実行作業をしない**。執筆・変換・検算・正本反映・git commit/push を含む全ての実行作業は、必ず Agent tool 経由で worker に委譲する。品質監督 (検証) は Read/Bash で司令塔自身が行ってよい。

事故先例 (2026-07-12): である化フェーズB' の反映前検算・反映後検証を司令塔が自分で抱えて実行してしまった再違反。COMMANDER_TASKS.md 冒頭に運用ルールとして固定済み — 次回セッション起動時に必ず目に入る位置。

## 最初に読む (この順、質問なしに読み切る)

1. `/Users/masa/projects/AGENTS.common.md` — 共通人格・運用ルール・実行姿勢の正本 (えいみ人格の裏付け)
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory (feedback/project/reference の索引)
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ全体ルール (**特に**「ブランチ作成は全面禁止」「commit したら即 push」「dirty はブランチ作成理由にならない」)
4. `/Users/masa/projects/AMD/amd-os/pwa/bzm/HANDOFF_BOOK_A_2026-07-18.md` — 最新セッション handoff (要点集約)
5. `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md` の冒頭〜運用ルール節と Book A 全ストリームサマリ表 (25行程度) — 全体地図。**ただしサマリ表自体が 2026-07-16 時点のまま stale (全15章完備・巻頭巻末完成が未反映)、鵜呑みにせず HANDOFF と design_log で実態を確認する**
6. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md` の末尾「2026-07-17〜18 Book A 通し初稿完成・kaku全体ブラッシュアップ・Ch1レビュー対応 (司令塔04)」エントリ — 直前セッションの詳細判断ログ (必要時のみ)
7. `/Users/masa/projects/AMD/amd-os/pwa/bzm/2026-07-16_ch4_ch5_merger_secondary_sweep_report.md` §4/§9 — 次タスク最優先「節番号二層ズレ全面改番」の実体 (要人間確認6系統)

## 現在の状態スナップショット (2026-07-18 handoff 時点)

### git 状態

- Branch: `main` (**必ず作業開始前に `git fetch origin main && git log -6 --oneline` で最新確認**)
- 本 handoff 時点の origin/main HEAD: `fa4e89ee`。その後 kaku ブラッシュアップ・記号整理・タイムテーブル整備等が積まれ、本番 `BUILD_VERSION` は `v3.44.17`。
- **root checkout (`/Users/masa/projects/AMD/amd-os`) は stale branch `codex/019f6afff9097a60bada064e2d31df8b` (HEAD=`174513d2`) を指しており main ではない**。57件の dirty が残存 (Book A 関連14件含む)。個別 diff 検証済みで、origin/main とも自ブランチ HEAD とも一致しない第三の状態 (単純な「遅れ」でも「main 相当」でもない)。次セッションで個別ファイルごとに `git diff origin/main -- <file>` を取って裁定すること。
- root checkout の未 push コミット3件の帰属確認結果 (詳細は HANDOFF Repo State):
  - `c12253d8` = patch-equivalent 確定 (`git patch-id` で `91ea1fe5` と一致、破棄可)
  - `c810d932` = 内容的には `3642d25f` として main 反映済み (byte-identical ではないが機能的にはsupersede済み)
  - `174513d2` = 未確認・Book A 範囲外 (macOS レーン、担当セッションへ委譲)
- **`git add .` / `git add -A` は絶対禁止**。commit する時は該当ファイルをフルパスで明示指定。

### 🔒 Book A ナラティブ設計の大前提 (2026-07-14 まさ確定・恒久前提、絶対に上書きしない)

- **主人公 = 柏木**。Book A 全15話を貫く**一つの通しのドラマ**。オムニバス形式は禁止。
- 視点は章ごとに別人物 (現行割当維持) でよいが、柏木は毎章「見届けの運動」の一コマとして現れる (主役回 Ch1/11/15 / 陪席 / 点景 / 意味のある不在 / Ch10 選択制)。参照例 = Netflix「ガス人間」の多視点×一本のストーリー構造。
- **各話の主役は別人**という旧ルール (2026-07-13 A案初期記帳) は**廃止済み** — 主人公一本化と逆向きに滑り込んだ誤実装。
- 設計正本 = `BOOK_A_NARRATIVE_DESIGN.md` §2.5 (二重らせん)・`BOOK_A_STORY_WORLD.md` §2.1 (柏木の現れ方列)・§2.2 (柏木アーク) / 判断ログ = `2026-07-14_kashiwagi_central_redesign_v1.md` / 編み込みパス文面案 = `2026-07-14_kashiwagi_weaving_pass_v1.md` (全15章本文反映完了)。
- **司令塔・fable worker への引き継ぎ時、この前提を必ず migration prompt に明示する**。前提が読まれない引き継ぎは禁止 (2026-07-16 まさ指示)。

### 🔒 執筆規範 — japanese-tech-writing + cognitive-rhythm-writing (2026-07-16 まさ確定・恒久)

- Book A の全執筆・白紙構想・推敲・リライト系 worker は、着手前に必ず以下2スキルを Read する:
  - `~/.claude/skills/japanese-tech-writing/SKILL.md` — 日本語技術文書の基礎規範 (整形・パラグラフライティング・論証の厳密さ・演出の抑制・**LLMっぽい空句禁止リスト**「重要なのは〜である」「多角的」「〜に他ならない」等・冗長排除)
  - `~/.claude/skills/cognitive-rhythm-writing/SKILL.md` — 認知リズム規範 (未回収の緊張・観察→逡巡→断定→再観察の切替・駄文判定「その文が更新するのは状況か文書か」・機械的点検手順)
- 出典 = 技術書出版社ラムダノート創業者・鹿野桂一郎さん (k16shikano、Unlicense=パブリックドメイン)、まさインストール済み。
- 特に効く原則: 「理論は答えではなく命名として入れる。先に理論を出して例で確認する順は、読者の発見を奪う」 = Book A の数理モデル導入章と直接噛み合う。
- fable/Sonnet worker の migration prompt に「執筆前にこの2スキルを読む」を標準で入れる。平坦な章の診断にも使える (スキル末尾「修正指示への使い方」= 症状→処方の対応表)。
- **2026-07-17〜18セッションで全17ファイル (巻頭〜第15章〜巻末) に一巡適用済み**。今後の追記・修正 (特に次タスクの節番号改番で本文に手を入れる箇所) も、このkaku規範を通してから正本反映すること。

### Book A の TOC 状態 — 通し初稿完成

- **v3 = 15章構成 (Ch4+Ch5 統合)、全15章本文 + 章頭ナラティブ + 巻頭 + 巻末が完備 (2026-07-18時点)**
- 統合章 slug = `book-a-ch-4-5`、タイトル確定済み = 「第4章 外の必要と内の到達 — M と R を観測で採点する」(旧 book-a-ch-4.md / book-a-ch-5.md は履歴として残置、統合しない方針)
- 巻頭 = `book-a-frontmatter.md` (序・凡例・記号一覧、柏木主人公明言済み)、巻末 = `book-a-backmatter.md` (読書案内・索引)
- 記号系: **S₀→D₀ に改称済み (Book A 限定)**。モノグラフ・BZSF 理論正本は S₀ のまま不変 (glossary §1.6 参照)
- 詳細対応表 = `pwa/bzm/2026-07-16_ch4_ch5_merger_execution_report.md` §2

### Codex 切り出しラウンドの状態

- 2026-07-15〜16 に切り出した9件 (組版検証・図版インベントリ・Ch4+Ch5統合機械実装・matplotlib figures・SVG pilot・章番号二次掃討) は本セッションまでに完了・裏取り済み、成果は「全15章完備」等に統合済み。個別ステータス表は本プロンプトから撤去 (stale化防止、詳細が必要なら `HANDOFF_BOOK_A_2026-07-16.md` の旧表を参照)。
- **次の Codex 切り出し候補**: 節番号二層ズレ全面改番のうち、司令塔が理論接続先と節番号の対応を確定した後の機械置換パート (章参照の一括書き換え等)。判断が先、機械化はその後。
- 図版 (matplotlib/SVG) は完了分の品質判定が次タスクに残っている可能性あり。COMMANDER_TASKS.md ワークストリーム表 (要更新) で確認。

## 次タスク詳細 (優先順)

### 最優先: 節番号二層ズレ全面改番

- 実体 = `pwa/bzm/2026-07-16_ch4_ch5_merger_secondary_sweep_report.md` §4「要人間確認として残した項目」6系統:
  - Ch6: `λ_x(σ_SU, ECR) への前方参照で第5章に接続` (旧番号表記のまま)
  - Ch10: `完全版は第5章とモノグラフ`
  - Ch11: `Goodhart 回避の KPI 設計条件 lite (第5章へ接続)`
  - Ch12: `RT は第5章 λ_x(σ_SU, ECR) のブラックボックス...`
  - Ch13: `Ch 6 の F-CES`、`第5章 §6.7 表6-4`、`理論接続は第5章 §6.7`
  - Ch14: `Goodhart 回避 KPI (第5章の系の適用)`
- 同レポート§9の結論: 「単純な旧番号シフトでは、接続先の理論概念・節番号・Book A内章番号のどれを優先すべきかが確定しないため、機械掃討では不触にした」。**これは司令塔の理論判断が先で、機械置換はその後**という構造。
- 進め方の想定: (1) 司令塔が各系統の理論接続先が現行TOC v3のどの章・どの節に対応するかを一つずつ裁定 (2) 裁定結果をworkerへ委譲し本文修正 (3) kaku規範を通してから正本反映 (4) 全ファイル横断で章参照の再検算。
- COMMANDER_TASKS.md ワークストリーム L「章間整合パス (全15章 done 後)」に対応。全15章完備した今、着手条件は揃っている。

### 高優先: COMMANDER_TASKS.md サマリ表の更新

- ワークストリーム A〜N のサマリ表が 2026-07-16 時点のまま (「本文 第8〜15章 not-started/drafting」等)。実態 (全15章完備・巻頭巻末完成・kakuブラッシュアップ完了) と乖離している。
- 次セッション序盤でworkerへ委譲し、実態に合わせて更新する (司令塔はEdit禁止のため必ずAgent tool経由)。

### 中優先: root checkout dirty 57件の裁定

- `codex/019f6afff9097a60bada064e2d31df8b` ブランチ (HEAD=`174513d2`) 上の57件、うちBook A関連14件。個別に `git diff origin/main -- <file>` を取り、(a) origin/mainへ反映すべき未取り込み作業か (b) 既にsupersede済みの残骸か (c) 別レーンの進行中WIPかを分類する。
- macOS関連 (`174513d2` 含む) はmacOS担当セッションへ委譲。Book A関連のみ本司令塔スコープ。

### 中長期: 図版・組版の残タスク確認

- COMMANDER_TASKS.md 更新時に、matplotlib/SVG figures の品質判定・残り図版の要否を棚卸しする (2026-07-16セッションの「品質OKなら第2弾切り出し」判断が完了しているか要確認)。

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
- **patch-equivalent 性の検証は `git show <hash> | git patch-id` を使う**。`git diff A B` のフルツリー比較は分岐後の履歴差分も拾うため不適切 (2026-07-18セッションで実地検証、詳細は design_log 2026-07-17〜18エントリ)

### 共有 checkout での git 作法 (2026-07-17 事故 `0c498f2b` を受けて恒久化)

Book A は常時 5-10 セッションが同じ root checkout (`/Users/masa/projects/AMD/amd-os`) を共有する。**index (staged) も共有**されるため:

- **`git commit` は必ずパス指定付き** (`git commit <paths>` または `git commit --only -- <paths>`)。パス指定なし `git commit` は他セッションの staged を巻き込む (事故 `0c498f2b` = 他レーン 49 ファイル巻き込み push。`ios/BUGS.md` 2026-07-17 エントリ参照)
- commit 前に `git status` で staged 列を読む。自分の対象外が staged にあっても**除染しない** (他セッションの意図的 staged の可能性)、自分のファイルだけパス指定 commit する
- **non-FF (origin が先行) 時の正規経路**: 自セッション worktree を origin/main へ detach → cherry-pick (または編集) → `git push origin HEAD:main` → 完了。root checkout の rebase/merge は他レーン dirty と衝突するため試みない
- root main の ref 追従が必要な場合は `git reset --soft origin/main` のみ可 (working tree / index 不変)。その直後に staged の見かけ差分が発生し得るため、追従後は commit しない (次の作業者へ引き渡す)
- 一時 branch へ push した場合は main へ畳み込み後、リモート枝を削除 (patch-equivalent-main の残置禁止)

### 記号衝突チェックの経緯 (2026-07-18 S₀→D₀ 改称から確立)

- Book A で新しい記号を導入・改称するときは、**その章だけでなく本全体の既出記号と衝突しないか**を確認してから確定する。
- 実例: 初期資源 S₀ が生存 S と字面衝突 → 改称先候補を機械的に列挙し、W (Ch10 待機中作業と衝突)・A₀ (Ch7 状態遷移行列 A_k と衝突) を却下、最終的に D₀ を採用した。**候補を1つ決め打ちせず、複数候補を全章横断で衝突チェックしてから確定する**のがこの時に確立した手順。
- 記号の正本は `9-5-appendix-changelog.md` の glossary 節 (例: §1.6) に台帳化する。Book A 限定の改称はモノグラフ・BZSF 理論正本には波及させない (それぞれの体系で記号は独立)。
- 次に新規記号を導入する worker (特に節番号改番タスクで理論接続先を確定する際に記号も触るなら) は、この手順をmigration promptに明示する。

### タイムテーブルは STORY_WORLD §3 が正本

- 全15話の時間軸 (いつの季節・何ヶ月目・登場人物の年数経過等) は `BOOK_A_STORY_WORLD.md` §3 (2026-07-18新設) が正本。Ch1「五年」→「三年」統一のような時間軸の不整合が見つかったら、まずこの§3を確認してから該当章を修正する。
- 逆に、本文の時間軸表現を変更した場合は §3 も同じ commit で更新する (更新漏れは次の「五年/三年」型の不整合を再発させる)。

### fable トークン節約方針 (継続)

- fable トークンがもうなくなりそうというまさ制約は継続
- opus 以下・Codex Sol でできることを優先的に切り出す (2026-07-14 まさ指示)
- ナラティブ本文執筆 (白紙構想・場面設計・文体推敲) は fable 領域として温存
- 機械的タスク (章番号置換・migration prompt 作成・図版生成・記号一括置換) は opus/haiku/Codex Sol へ。2026-07-17〜18セッションでも記号整理・タイムテーブル整備は opus で実施し fable を温存した実績あり

### handoff 時の OS マニュアル同期ゲート

- 実装・変更した新たな仕様は `pwa/manual/*.md` (AMD OS マニュアル正本) に同期
- 詳細仕様は移行済みなら `pwa/spec/*.md`、未移行なら `pwa/design/*.md` / `FEATURE_REGISTRY.md`
- Book A 関連の handoff は `pwa/bzm/` 内で完結、OS マニュアル本体には影響しないためこのゲートは対象外扱いで OK

### branch・worktree

- なし。このリポは main 一本、ブランチ・worktree 作成は全面禁止。dirty があってもブランチを切らない。
- ただし共有 root checkout が他レーンの stale branch に占有されている等、真にやむを得ない場合は `git worktree add --detach <path> origin/main` の disposable detached worktree のみ許容 (2026-07-18 handoff作業で実施、作業後は削除)。恒久的な branch/worktree の保持ではない。

---

*最終更新: 2026-07-18 (JST)、司令塔セッション (04) から次セッション (05) へ handoff*
