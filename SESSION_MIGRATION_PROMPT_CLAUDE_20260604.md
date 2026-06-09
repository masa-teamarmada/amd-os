# Claude Migration Prompt - AMD OS L2 Routine Incident

```text
あなたはClaude側でAMD OSの是正作業を引き継ぐ。

まず次を読む:
1. /Users/masa/projects/AMD/amd-os/HANDOFF_CLAUDE_MIGRATION_20260604.md
2. /Users/masa/projects/AMD/amd-os/AGENTS.md
3. /Users/masa/projects/AMD/amd-os/CLAUDE.md
4. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
5. /Users/masa/projects/AMD/amd-os/pwa/spec/3-1-l2-data-extraction-current-spec.md
6. /Users/masa/projects/AMD/amd-os/pwa/spec/5-3-automation-responsibility-current-spec.md
7. /Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md
8. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状況:
- L2抽出はClaude定額token/routine上限内で回す方針だった。
- しかしまさ確認で、Claude Routines UIにはroutineが1本も無い事故が判明した。
- ~/.claude/scheduled-tasks/.../SKILL.md があるだけでは、Claude routineがACTIVE登録されている証拠ではない。
- amd-os-l2-consolidated-evidence も実体未確認。
- この事故で実害が出ている。方針検討ではなく、実登録・証跡確認・docs current truth反映として扱う。

絶対ルール:
- Vercel quota hard gate中。git push / vercel deploy 禁止。
- 作業はlocal確認・local commitまで。push/deployは "withheld due to Vercel quota gate" としてhandoff。
- PWA/Vercel background LLM cronは復活させない。
- worker quiet mode。親司令塔へ中間ログを流さない。
- SKILL.md作成やdocs-onlyで完了扱いにしない。

最優先タスク:
1. Claude Routines UIで実際にroutineを作成/確認する。
2. 本命routine:
   - name: amd-os-l2-consolidated-evidence
   - cadence: daily 08:00 JST
   - target L2: L2②④⑤⑦⑨⑩⑪⑫
   - purpose: L2 evidence extractionをClaude定額tokenに載せる
3. 別枠routine候補:
   - L2① month-end, Supabase internal OS/L2 evidence origin
   - L2⑧ month-end after L2①, XRL checklist audit
   - L2⑬ weekly candidate, or daily pickup + weekly aggregation ifまさ判断
   - L2⑯ month-end final day 17:00 JST, Management Monthly Signal Evaluation
4. L2③ MS進捗とL2⑥ MTGフローはClaude routineではなく、MMOマシン Codex Desktop automation維持。
5. L2①〜⑯のwriter matrixを、Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron / admin reviewに分類する。
6. docsの曖昧語 "Codex / subscription automation" をやめ、実体名に揃える。
7. 課金経路を棚卸しし、どの処理がClaude定額に乗っていなかったかを明確化する。

完了ゲート:
- Claude Routines UI上でroutineが見える。
- ACTIVEである。
- next runが確認できる。
- last run、または初回manual/dry run evidenceがある。
- DB row / outbox / applied / UI read evidenceのどれかで実出力を確認できる。
- docs current truthを反映済み。
- git diff --check通過。
- local commitまで。push/deployなし。
- finalには "push/deployなし。理由: Vercel quota hard gate" を明記する。

最初に実行:
cd /Users/masa/projects/AMD/amd-os
git status -sb
git diff --stat
git log --branches --not --remotes --oneline

注意:
このCodexスレッドで、まさが「ここで始めないで」と言ったあとに一部docs差分が作られている。
それらは未承認draftとして扱い、必要な部分だけ採用して整える。pushしない。
```
