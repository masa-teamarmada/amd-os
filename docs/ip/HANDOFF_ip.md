# HANDOFF — AMD OS / AMDプロトコル 特許出願

- Last updated: 2026-06-04
- Topic: 完全セルフ出願パックのClaude移行
- Scope: AMD OS / AMDプロトコル / AMD Score周辺の特許出願準備。OS実装・PWA deploy・Textbookとは別トピック。

## 最新セッション要約

- 弁理士依頼前提から、まさ判断で「完全セルフ出願 + 必要なら直前地雷チェック」方針へ移行。
- `codex/ip-patent-consult-pack` 上で self filing package、正式図面候補、最終整合レビュー、Blocker cleanup、decision sheet/checklist まで作成済み。
- 2026-06-04に worker quiet mode を特許専用台帳へ反映済み。workerは原則、親司令塔へ中間/自己判断完了報告を送らない。
- 現在は `Blocked by Masa`。workerで勝手に決められない出願方針3問へのまさ回答待ち。
- 詳細ログ: `design_log/sessions_2026-06.md`

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Working branch for patent pack: `codex/ip-patent-consult-pack`
- Latest known commit on patent branch: `8f02db7 docs: update patent worker quiet mode history`
- Root working checkout `/Users/masa/projects/AMD/amd-os` may have unrelated dirty changes from other commanders. Do not clean/revert them.
- Recommended for continuation: use a clean worktree from `origin/codex/ip-patent-consult-pack`.

## Current Truth

- 出願準備は「提出直前レビューに使える水準」。
- ただしこのままJPO提出はまだしない。
- 発明内容の内部整合は概ね通る。残りはまさ判断、出願ソフト実入力、AMD名義電子出願環境、正式提出画像形式、承継メモ正式化。
- 外部送付、JPO提出、弁理士問い合わせ、DB write、production DB接続、Web公開変更は未実施。

## First Read

1. `docs/ip/HANDOFF_ip.md`
2. `commander_tasks/ip_patent_COMMANDER_TASKS.md`
3. `docs/ip/self_filing_package/2026-06-02_self_filing_masa_decision_sheet_internal.md`
4. `docs/ip/self_filing_package/2026-06-02_filing_day_checklist_internal.md`
5. `docs/ip/self_filing_package/2026-06-02_final_consistency_review_internal.md`
6. `docs/ip/self_filing_package/2026-06-02_formal_figure_readiness_internal.md`
7. `docs/ip/self_filing_package/README.md`

## Unresolved Tasks

### Blocked by Masa: 出願方針3問

1. 出願範囲: 請求項A/B、WS-5、WS-6を今回どこまで入れるか。
2. 手続タイミング: 出願日先取り、審査請求、30条例外をどう扱うか。
3. 出願当日の実行経路: AMD名義の電子出願で行くか、緊急退避を許すか。

## First Next Action

まさから上記3問への回答を受けたら、静かに `final filing decision application` workerを切る。worker promptにはquiet modeを入れ、親司令塔への中間/自己判断完了報告を禁止する。

workerの対象:
- 請求項/明細書/願書/図面候補/チェックリストへの最終反映
- 30条例外・審査請求・電子出願経路の扱い反映
- 営業秘密scan
- 出願当日TODOの確定

## Pointers

- Patent task ledger: `commander_tasks/ip_patent_COMMANDER_TASKS.md`
- Session log: `design_log/sessions_2026-06.md`
- Claude migration prompt: `docs/ip/SESSION_MIGRATION_PROMPT_CLAUDE_20260604.md`
- Existing IP docs: `docs/ip/`
- Self filing package: `docs/ip/self_filing_package/`

## Verification This Handoff

- No build/deploy/JPO filing/external send was run.
- Documentation-only handoff.
