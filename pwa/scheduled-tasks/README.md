# AMD OS L2 抽出 Routine SKILL 正本

このディレクトリは、L2 ②〜⑨ の **routine / automation が読む SKILL 正本**。L2 ⑥は Windows MMO PC の Codex Desktop automation で動くが、実行手順の正本はこの repo 配下の SKILL.md に置く。

## 運用 (= 2026-05-26 以降)

- **正本**: `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`
- **Mac 用同期先**: `~/.claude/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` (= Mac Claude Desktop で参照)
- **Cloud routine 用**: claude.ai/code/routines の「指示」フィールドで `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md を読んで実行` と指示
- **Windows MMO Codex 用**: Codex Desktop automation の prompt でこの repo 内 SKILL を読む。repo は MMO 側で auto-pull されるが、即時反映したい場合は MMO 側で `git pull origin main` を確認する。
- **編集は repo の正本で**。Mac 側は rsync で同期 (= 双方向同期スクリプトを別途)

## Routine 一覧

| L2 | routine | cron | 詳細 |
|---|---|---|---|
| ② AMD プロトコル | `amd-os-l2-protocol-extract` | daily 08:00 JST | `protocols` |
| ③ MS 進捗 | `amd-os-l3-ms-progress-extract` | 毎時 0 分 | `milestone_monthly_progress` |
| ④ PJ ナレッジ | `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | `project_knowledge` |
| ⑤ メンバーナレッジ | `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | `member_knowledge` |
| ⑥ MTG サマリ | `amd-os-l6-meeting-extract` | Windows MMO: 毎日 09:00-21:00 毎時 + Phase A 早期 exit | `project_meeting_summaries` / 予定MTGカード / Drive関連資料 |
| ⑦ OS 台帳差分 | `amd-os-l7-registry-diff-extract` | 6h ごと | `project_registry_diffs` |
| ⑧ XRL 根拠 | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `project_xrl_evidence` |
| ⑨ 経営ハイライト | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `project_strategy_signals` |

## 関連 md

- 設計議論: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- マニュアル: [`pwa/manual/8-3-l2-extraction-routines-spec.md`](../manual/8-3-l2-extraction-routines-spec.md)
- L2 全体仕様: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
