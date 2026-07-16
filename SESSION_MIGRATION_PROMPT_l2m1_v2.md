# SESSION MIGRATION PROMPT — L2M-1 v2 (monthly report v2 移植 closeout)

> **並列 migration prompt について**: 本 prompt は L2M-1 v2 実装セッションの引き継ぎ。同時期に別 worker (KENQ AMD Score cockpit 統合) の `SESSION_MIGRATION_PROMPT.md` が active。KENQ 系タスクを継続する場合はそちら、L2M-1 v2 を検証・拡張する場合はこちらを使う。

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順 (必ずこの順):
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF_l2m1_v2.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/pwa/spec/3-2-monthly-reports-current-spec.md (L2M-1 v2 正本)
8. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md
9. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の 2026-07-01 冒頭 2 エントリ
10. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の 2026-07-01 セクション

# 状態スナップショット (2026-07-01 終了時点)

## Git 状態
- Canonical branch: main
- L2M-1 関連 accepted commits (すべて origin/main 反映済):
  - 8b877306 L2M-1 monthly report v2 skeleton + migration 159
  - 4a4ff80f Slack を send-eimi-slack.mjs 経由 + まさ DM 集約
  - bae00be4 monthly_report_scope enum (migration 160) + SKILL 更新
  - afeeee3b admin/projects row mapper + ProjectRow 型 4 列
  - 83f50bbe admin/projects UI 完全実装 + BUILD_VERSION v0.36.37
  - d5dc34c3 spec/manual 同期 (spec/3-2 v2 + 両 changelog)
  - 69d01a02 CX (p20 NIMS) を internal_and_external に変更
  - 9b6e6021 SKILL.md 実行環境記述訂正 (cloud sandbox 誤り→mac local 前提)
  - 5f7f15bd CockpitMonthlyModal から extractReportSnippets 削除 + BUILD_VERSION v0.36.42
- Production live: https://amd-os-pwa.vercel.app (BUILD_VERSION v0.36.42、次セッションで /api/build-info を必ず再確認)
- 別 worker WIP (触らない): pwa/design/atlas_routine.md / pwa/manual/6-7-contracts-management-spec.md /
  pwa/spec/5-6-contracts-management-current-spec.md / pwa/scheduled-tasks/amd-os-l6-* /
  pwa/scripts/check_h1_meeting_summary_reviewer.mjs / pwa/scripts/review_h1_meeting_summary.mjs /
  pwa/src/components/contracts/ContractsClient.tsx / pwa/src/lib/supabase/middleware.ts /
  pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md / pwa/bzm/2026-07-16_mprs_theory_revision_proposal_v1.md /
  pwa/src/app/mock/contracts-preview/ / HANDOFF.md / SESSION_MIGRATION_PROMPT.md / (私も追記した) pwa/BUGS.md /
  pwa/manual/9-3-appendix-changelog.md / pwa/spec/6-1-appendix-changelog.md / pwa/design_log/sessions_2026-07.md

## DB 状態 (Supabase production 反映済)
- migration 159 適用済 (projects/contracts/project_documents 列追加 + monthly_reports_external + llm_prompt_revisions)
- migration 160 適用済 (projects.monthly_report_scope enum)
- 全 active PJ の scope backfill 完了:
  - internal_and_external: p25 KUTE / p21 SX / p20 CX (NIMS)
  - internal_only: p00 AMD / p07 LST / p10 SE / p19 ZMP / p24 CLG / p26 VasculaX
  - none: p06 CTB
- llm_prompts: l2m1.monthly_report.internal.v2 (body 8,569 chars) と l2m1.monthly_report.external.v2 (body 3,990 chars) は is_active=true
- 旧 monthly_reports.final_content (gpt-5.5 版) は p00 2026-06 のみ新版 (opus-4-8 版) に上書き済み。他 PJ は旧版のまま (2026-07-31 本番 routine 発火で順次上書き想定)

## Claude routine 登録状態
- taskId: amd-os-l2m1-monthly-report
- cronExpression: 0 3 28-31 * * (LOCAL time = JST) + Phase 0 で当月最終日判定
- Next run: Tue Jul 28 03:04 JST (jitterSeconds=299 で 03:00 の +5 分程度)
- 実行環境: まさの mac local Claude Code アプリ (Anthropic クラウド sandbox で自動発火する仕組みではない、これは 2026-07-01 のテスト実走で判明)
- 前提: まさの mac は 24 時間常時起動 + Claude Code アプリ常時 open

## 旧 Codex disable 状態
- ~/.codex/automations/amd-os-l2/automation.toml が status = "PAUSED"
- バックアップ: ~/.codex/automations/amd-os-l2/automation.toml.bak_20260701_disable_by_eimi
- 復活禁止 (spec 3-2 v2 に v1 廃止済 writer として記録)

# 次タスク: KUTE (p25) 2026-06 で本番 routine 実走検証

## タスク詳細
- **目的**: scope=internal_and_external の PJ で routine が全 4 完了条件 (LLM 生成 → DB upsert → GET verify → Slack 通知) を満たし、対外版 markdown + 禁止語チェック + PDF 生成 + Drive 配置まで完遂できるか実走確認
- **なぜ p25 KUTE か**: (1) 参考成果物 KUTE_月次業務報告書_202605-202606.md/pdf があるため成果比較しやすい (2) work_content が 3 領域で確定してるので章生成の quality 検証がしやすい (3) 対外納品先が確定 (工学院大学) で allow_list 動作確認できる
- **ymは 202606** (2026-06 の 5 生データ + L2 snapshot は既に大量あるはず)

## 実行方法 3 択
### A: 本番 routine を「今すぐ実行」で全 PJ 一斉 kick (時間長い)
- Claude Code アプリの Scheduled → amd-os-l2m1-monthly-report を選択 → 「今すぐ実行」
- 対象は monthly_report_scope IN ('internal_only','internal_and_external') AND status IN ('active','sales') = 9 PJ を順次処理
- 検証時間は長いが本番と完全同一動作

### B: fireAt one-shot task で p25 のみ + 202606 に絞る (推奨、時間短い)
- 前回 test task の設計を継承。SKILL.md prompt で「対象を p25/202606 に固定、Phase 0 最終日判定 skip、scope=internal_and_external 相当で 2 段生成」と明記
- 本番 SKILL.md の「1 PJ 完了条件 4 つ」を継承させる (LLM 生成 + DB upsert + verify + Slack 通知)
- fireAt で 3-5 分後起動、実行後 auto-disable

### C: p25 の l2m1 module を切り出して手動 kick (最短、検証重ね技)
- llm_prompts fetch + Phase 2.2 fetch を Supabase MCP で手動実行し、markdown 生成 → DB upsert を 1 セット手動でやる
- 本番 routine と別経路になるので本番挙動の再現度は落ちる、けど動く保証確認と反映確認はできる

**推奨は B**。前回 test task の実装 (`l2m1-test-p00-june-internal-only`) の SKILL.md を base にして、p25 対象・scope=internal_and_external・Phase 2.4-2.6 全部実行版に書き換えて fireAt する。

## 確認ポイント (task 実行後)
1. Slack DM (まさ) に「できたー！レビューよろしくー！」の成功通知が届く
2. 月次モーダル https://amd-os-pwa.vercel.app/project/p25/cockpit?ym=202606 で新版 markdown が主表示 (旧版が消える)
3. monthly_reports_external.body_md に対外版 markdown が入っている (execute_sql で確認)
4. monthly_reports_external.pdf_local_path または pdf_drive_url に PDF path/URL が入っている
5. monthly_reports_external.jargon_check_status = 'clean' (禁止語 hard_fail なし)
6. ローカル /Users/masa/projects/AMD/kute/output/monthly_reports/ (or projects.report_local_alias 配下) に PDF ファイル存在
7. Google Drive の projects.drive_folder_id 配下「月次業務報告書 / 2026-06/」に PDF 配置されている

## 残タスク (優先度順)
1. KUTE p25 実走 (上記)
2. scripts/strip_internal_jargon.py と scripts/generate_monthly_report.py の実装
   - 現状 SKILL.md に references として登場するが未実装
   - strip_internal_jargon: allow_list に含まれない禁止語 (AMD OS / Codex / Claude / Vercel / Notion / Slack / Gmail / Drive / worker / 司令塔 / えいみ / つくよみ / cockpit / hook / 山地 / 藤崎 / りり / きよ / 内部 PJ / SU / MTG / ARMADA / signal / pt / Δ / RAG / XRL 等) を markdown から検出、hard_fail なら PDF 生成 skip
   - generate_monthly_report: pandoc → HTML → colgroup 注入 → Chrome headless → PDF、KUTE 実納品の CSS を踏襲
3. SX p21 実走 (task #6 pending)
4. CX p20 実走
5. 2026-07-31 本番発火時の 3 対象 PJ (p25/p21/p20) 実走観察 + internal_only 6 PJ (p00/p07/p10/p19/p24/p26) の実走観察

# 運用ルール (このセッションで確立済み)

## L2M-1 実行環境 (2026-07-01 まさ確定で書き直し)
- 登録先 = まさの mac local Claude Code アプリ Scheduled Tasks (~/.claude/scheduled-tasks/<taskId>/SKILL.md)
- 実行環境 = まさの mac local。Anthropic クラウド sandbox で自動発火する仕組みではない
- 前提: mac 24 時間常時起動 + Claude Code アプリ常時 open
- env: /Users/masa/projects/AMD/amd-os/pwa/.env.local を参照
- repo: /Users/masa/projects/AMD/amd-os は local に存在前提 (auto-clone は不要)

## 1 PJ ごとの完了条件 (絶対、SKILL.md line 45-54 正本)
以下 4 つが全部達成された時点で 1 PJ 完了。1 つでも欠けたら Slack 完了通知は失敗版で送る (成功版禁止):
1. 内部版 markdown を LLM で生成した
2. monthly_reports.final_content に markdown を DB write した (node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports で writtenCount>=1 かつ action∈{inserted,updated} 受領)
3. 書き込み後 GET で verify した (final_content length・status='final'・generated_at が今 run 時刻)
4. Slack で完了通知した (scope 別テンプレ、まさ DM 宛)

## Slack 通知規約
- 送信先: まさとの DM channel (members where code_name='まさ' AND is_admin=true の slack_id)
- 送信手段: scripts/send-eimi-slack.mjs (GAS webapp 経由 えいみ persona bot)
- MCP slack_send_message 直叩き禁止 (えいみ人格維持のため)
- PJ チャンネル通知は行わない (全通知まさ DM 集約)

## admin/projects 4 列 (2026-07-01 追加、AdminProjectsTable.tsx で表示・編集)
- 「月報 scope」: select (none / internal_only / internal_and_external)
- 「エイリアス」: text (KUTE / SX / AMD 等、ローカル output ディレクトリ命名用)
- 「禁止語 allow」: textarea (カンマ区切り→string[] 変換、PJ 固有 allow_list)
- 「業務内容 JSON」: textarea (jsonb 配列 [{name, description?}])

## L2M-1 プロンプト設計方針 (llm_prompts DB 管理)
- LLM が主役、章構成 (何を第N領域として立てるか) も含めて全 DB データから判断して書く
- 表・数値・日付は決定論的に入力 JSON に含めて渡すが LLM が組み込む
- KUTE 実納品 markdown を few-shot として user 側に含める
- 内部版は §A-§F 内部評価節必須 (RAG / KPI / XRL / MS 進捗 / 会議由来決定事項 / リスク / 対外発信 / 添付資料)
- 対外版は allow_list 動的注入 + 禁止語厳格削除 + 「である」体 + 「以上のとおり報告する。」で締め

# 事故防止 (BUGS.md 該当エントリ参照)

## 2026-07-01 事故 1: MS カード「この月の仕事」欄に markdown table 重複表示
- 症状: 月次モーダル右カラム「この月の仕事」に「月次レポート: | 項目 | 内容 |」等の table 行が MS カード毎に重複挿入
- 原因: CockpitMonthlyModal.tsx の extractReportSnippets が正本仕様外の実装。design/cockpit.md L105 の 3 ソース (progressNote + ms_activities + member_activities) のみが正本
- 対応: extractReportSnippets 削除 (5f7f15bd)
- 再発防止: MS カード「現状」欄に新ソース追加する場合、design/cockpit.md と manual/2-3-pj-cockpit.md の 3 ソース記述を先に更新してから実装

## 2026-07-01 事故 2: one-shot テストで DB write skip → 月次モーダル未反映
- 症状: LLM 生成成功、ローカルファイル出力成功、しかし monthly_reports.final_content は旧版のまま
- 原因: test task SKILL.md に「絶対条件: DB に一切書かない」記述、LLM 忠実に skip。本番 SKILL.md も「LLM 生成成功 = 完了」で DB reflect verify 抜けの構造欠陥
- 対応: SKILL.md に「1 PJ 完了条件 4 つ」節を追加、DB upsert + verify を完了条件に組み込み
- 再発防止: routine の完了判定は「LLM 生成成功」ではなく「DB reflect verify 成功」を基準にする。ローカルファイル出力は verify 副本、完了条件に使わない

# デプロイ手順 (AMD OS PWA 標準)

## 通常デプロイ
```bash
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```
- main clean tree + origin/main 整合検査 → rollback guard → git push origin main → Vercel 自動 build 発火 → 15分以内に本番 Ready 監視 → macOS 通知
- 別 worker WIP 残存で hard-stop する場合は git stash push -u -m "before-deploy" で退避 → deploy → git stash pop で復元

## DDL 適用 (Supabase Management API 経由)
```bash
python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql
```
- または Supabase MCP apply_migration / execute_sql (このセッションで使用、両方 OK)
- migrations は必ず pwa/scripts/migrations/NNN_name.sql に残す

## BUILD_VERSION bump up (deploy 前必須)
- pwa/src/lib/build-info.ts の BUILD_VERSION を patch bump (v0.36.X → v0.36.X+1)
- 迷ったら patch。minor は本物の新機能追加時のみ
```

## 次セッションが読むべき正本 md (優先度順)

1. `pwa/spec/3-2-monthly-reports-current-spec.md` (L2M-1 v2 仕様正本)
2. `pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md` (routine 実装正本、1 PJ 完了条件 4 つ)
3. `pwa/design/cockpit.md` L105 (「現状」欄 3 ソース正本)
4. `pwa/manual/2-3-pj-cockpit.md` L111 (同上)
5. `pwa/design/db_schema.md` (列名は想像で書かない、DDL 変更後は python3 -X utf8 scripts/dump_schema.py で再生成)
6. `pwa/BUGS.md` の 2026-07-01 冒頭 2 エントリ (事故再発防止)
7. `pwa/design_log/sessions_2026-07.md` の 2026-07-01 セクション (詳細ログ)
8. `pwa/spec/6-1-appendix-changelog.md` と `pwa/manual/9-3-appendix-changelog.md` の 2026-07-01 行

## Quick verify (次セッション開始時)

```bash
# 1. Production live 確認
curl -s https://amd-os-pwa.vercel.app/api/build-info | python3 -m json.tool

# 2. Claude routine 登録状態
# → mcp__scheduled-tasks__list_scheduled_tasks で amd-os-l2m1-monthly-report の nextRunAt 確認

# 3. DB 状態
# → mcp__fb135fea..__execute_sql で以下:
SELECT project_id, monthly_report_scope, report_local_alias
FROM public.projects
WHERE status IN ('active','sales')
ORDER BY project_id;

# 4. llm_prompts 状態
SELECT prompt_key, is_active, length(body) AS len, updated_at
FROM public.llm_prompts
WHERE prompt_key LIKE 'l2m1.%'
ORDER BY prompt_key;

# 5. 旧 Codex disable 状態
grep -E "^(id|name|status)" ~/.codex/automations/amd-os-l2/automation.toml | head -3
# → status = "PAUSED" になっているか
```
</content>
</invoke>