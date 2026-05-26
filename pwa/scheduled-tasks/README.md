# AMD OS L2 抽出 Claude Routines (= Cloud / Mac 共通正本)

このディレクトリは、L2 ②〜⑨ の **Claude routine 8 個の SKILL 正本**。

## 運用 (= 2026-05-26 以降)

- **正本**: `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`
- **Mac 用同期先**: `~/.claude/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` (= Mac Claude Desktop で参照)
- **Cloud routine 用**: claude.ai/code/routines の「指示」フィールドで `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md を読んで実行` と指示
- **編集は repo の正本で**。Mac 側は rsync で同期 (= 双方向同期スクリプトを別途)

## Routine 一覧

| L2 | routine | cron | 詳細 |
|---|---|---|---|
| ② AMD プロトコル | `amd-os-l2-protocol-extract` | daily 08:00 JST | `protocols` |
| ③ MS 進捗 | `amd-os-l3-ms-progress-extract` | 毎時 0 分 | `milestone_monthly_progress` |
| ④ PJ ナレッジ | `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | `project_knowledge` |
| ⑤ メンバーナレッジ | `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | `member_knowledge` |
| ⑥ MTG サマリ | `amd-os-l6-meeting-extract` | 毎時 0 分 | `project_meeting_summaries` |
| ⑦ OS 台帳差分 | `amd-os-l7-registry-diff-extract` | 6h ごと | `project_registry_diffs` |
| ⑧ XRL 根拠 | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `project_xrl_evidence` |
| ⑨ 経営ハイライト | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `project_strategy_signals` |

## 関連 md

- 設計議論: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- マニュアル: [`pwa/manual/38-l2-extraction-routines-spec.md`](../manual/38-l2-extraction-routines-spec.md)
- L2 全体仕様: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
