# SESSION_MIGRATION_PROMPT — Ch7 追加改修ワーカー (angry-babbage-b5c10a) の close 引き継ぎ

*作成: 2026-07-14 / このワーカーは Ch7 v1 §7 理論側改修パッケージ + 追加改修 (MASTER_PLAN §9 差し替え + Box 7-3 追加) を完結させて close する。**次セッションは基本的に不要** (司令塔検証で承認済み、追加司令塔マター無し)。ただし司令塔側で worktree/branch 一括後片付け (task #7) が走るときに参照される可能性があるため、この migration prompt を残す。*

---

## このプロンプトを見るセッションが最初にやること

以下を上から読む (共通ルール正本を最初):

1. `/Users/masa/projects/AGENTS.common.md` (えいみ共通ルール正本 = 人格・共通ルール・実行姿勢の正本)
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` (AMD level のえいみ memory 索引)
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` (モノレポルール、ブランチ作成全面禁止・push運用)
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md` (PWA固有ルール — deploy運用、bzm 附則の位置)
5. `pwa/bzm/2026-07-14_ch7_worker_closeout.md` (**このワーカーの正本 closeout ノート** — 担当と結末・成果2 commit・記帳先 md・意思決定ログ・現在の worktree/branch 状態)
6. `pwa/bzm/BOOK_A_NARRATIVE_DESIGN.md` §1 設計表 Ch7 行 (現況セル = 「完全完了」を確認)
7. `pwa/bzm/BOOK_A_STORY_WORLD.md` §8 未確定事項 Ch7 行 (現況 = 「完全完了」を確認)
8. `pwa/bzm/9-5-appendix-changelog.md` 末尾 (2026-07-14 付エントリ 2 件を確認)

## 現在の状態スナップショット

- **リポ**: `github.com/masa-teamarmada/amd-os` の main = `5fbfcba6` (2026-07-14 時点、この closeout note commit 済み。他 worker Ch6 追加分 `88b6c619` `e09b4f7a` を統合済み)
- **worktree**: `.claude/worktrees/angry-babbage-b5c10a` (spawn_task 自動生成)
- **branch**: `claude/angry-babbage-b5c10a` (spawn_task 由来、リモート追跡ブランチ無し、HEAD = origin/main)
- **未 push**: 無し
- **dirty**: 無し
- **成果 commit**: `08306f17` (Ch7 v1 §7 理論側改修パッケージ) / `2de40d73` (Ch7 追加改修パッケージ = MASTER_PLAN §9 差し替え + Box 7-3 追加) / `5fbfcba6` (この closeout note)
- **司令塔検証**: `local_aab6267e...` (Book A 司令塔 — 次期セッション引き継ぎ) が両パッケージを検証・承認済み、閉じてよいとの返信を受領済み (cross-session-message 2026-07-14)

## このワーカーの残タスク

**無し**。閉じてよい。

## 司令塔管理下で継続中の隣接タスク (このワーカーの管轄外、参考情報)

- `pwa/bzm/COMMANDER_TASKS.md` の記帳更新 (全体サマリ表・Ch7 詳細行・Changelog) — 司令塔側で進行中
- 他 worker との後片付け:
  - task #2: `objective-banach-aaad1b` (Ch4/5 白紙再構築)
  - task #3: `sad-wescoff-84d6f9` (Ch6 白紙再構築 — 既に 88b6c619/e09b4f7a で main へ反映済みなので実質完結)
  - task #4: `wizardly-cerf-6141a3` (自費出版準備)
  - task #5: `xenodochial-shaw-f9e8b9` (旧・出版司令塔再起動世代)
  - task #7: 全 worktree/branch 一括後片付け (blockedBy: #2,#3,#4,#5,#8,#9,#10)

司令塔管理下の `pwa/bzm/HANDOFF_BOOK_A_2026-07-13.md` (Ch9 セッション handoff)・`pwa/bzm/SESSION_MIGRATION_PROMPT.md` (司令塔管理下の migration prompt) は本ワーカーでは触っていない — 司令塔側で更新される。

## Ch7 パッケージで確立した運用ルール (次回類似作業時の参考)

- **白紙構想の骨抜き防止**: `BOOK_A_NARRATIVE_DESIGN.md` §6 の 3+1 条項 (①理論側の釘固定→帰着論法の禁止 ②Ch1 v5 水準の合格基準 ③理論側の釘は可動物 = 改修パッケージで動かす)。Ch7 v1 は先に §8 中心命題 v2「乖離こそチャンス」を確定 → 白紙構想 → まさ承認 → 場面反映 → §7 改修パッケージで理論側を新場面と噛み合わせる、の順で運用。
- **司令塔ゲート**: 理論側の釘 (回収節・演習・討議課題・数式・表・図注) は白紙構想時点では動かさず、司令塔が「改修パッケージ実行を許可」した段階でワーカーが実装する。ワーカーが独断で理論側を動かすと、他章との整合検算が漏れる。
- **器 A (実話エピソードの重り) の作法**: (a) 理論の釘の列に並べず転調で区切る、(b) 討議課題で触れない、(c) 理論パートの回収節でも触れない、(d) 一章に重りは一つまで。Box 7-3 は (b)(c) を厳格に守り、(d) は Box 7-2 との対として並置したが「一章に重りは一つまで」の趣旨 = 「重ね過ぎない」の範囲内。
- **cross-worker コンフリクト解消**: `BOOK_A_NARRATIVE_DESIGN.md` の Changelog 末尾追記位置は複数 worker が同時に狙う位置なので、rebase 時に位置的コンフリクトが起きやすい。両方のエントリを保持する形で手動マージすればよい (内容的矛盾は無く、単に挿入位置の衝突)。

## 参考: このワーカーで触れなかった外部素材

- `2026-07-13_narrative_rebuild_ch7_v1.md` §7 (改修パッケージの詳細指示書、司令塔管理下)
- `EPISODE_BANK.md` (`/Users/masa/projects/knowledge/EPISODE_BANK.md`) の EP-031 完全版
- `2026-07-11_episode_placement_map_v1.md` (配置台帳、EP-031 の移管先が Box 7-3 と一致)
