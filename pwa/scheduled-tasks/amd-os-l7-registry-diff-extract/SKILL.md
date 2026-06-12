---
name: amd-os-l7-registry-diff-extract
description: AMD OS D-5 OS台帳差分抽出の repo 正本。現行 writer は Codex automation `amd-os-ms` + non-LLM LaunchAgent applier。active PJ × 当月/前月の 5 生データと OS 台帳を突合し、`registryDiffs` outbox JSON を `/Users/masa/.codex/automations/amd-os-ms/outbox/` に作る。Supabase `project_registry_diffs` への upsert は `ms_progress_review_tool.mjs apply-outbox-dir` が行う。DB/APIへ直接書き込まない。
---

# AMD OS D-5 OS 台帳差分抽出 automation

## 設計の要点
- Codex automation `amd-os-ms` (= 6h ごと) が `outbox.registryDiffs` を吐く → LaunchAgent applier が Supabase に反映
- この SKILL は outbox payload の生成仕様。DB/API へ直接書き込まない
- 古い Claude routine / direct Supabase REST 移植案は履歴扱い。復活させない
- **diff_kind** 例: `member_candidate` / `partner_candidate` / `partner_email_candidate` / `report_email_candidate` / `contact_candidate`
- target_table 例: `project_members` / `projects` / `project_partners`
- proposed_patch_json は最小限の patch payload
- status='pending' で upsert → 通知 → まさが /notifications で「はい」で apply

## 反映経路

outbox は `/Users/masa/.codex/automations/amd-os-ms/outbox/*.json` に保存する。LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が 5 分ごとに `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` を実行し、成功ファイルを `applied/`、失敗ファイルを `failed/` へ移動する。

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.2-3.4
2. `pwa/design/project_registry_diffs.md` (= D-5 仕様正本)
3. `pwa/design/db_schema.md` (= project_registry_diffs / project_members / projects / project_partners / members 列名)
4. `/Users/masa/.codex/automations/amd-os-ms/automation.toml` (= 元実装 prompt、特に「OS 台帳差分の作り方」)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name,slack_channel_id,drive_folder_id,report_emails`
- ymList = [当月 (JST), 前月]
- 1 回の実行で max 5 PJ × 1 ym = 5 targets まで

═══════════════════════════════════════════════════
Phase A: 5 生データ収集 (= 各 PJ ごと)
═══════════════════════════════════════════════════

各 (projectId, ym) について:

### A-1: OS snapshot (= 既存 OS データ)
- `project_members?project_id=eq.<projectId>&is_active=is.true&select=member_id` → 既存 PJ メンバー (members JOIN で code_name)
- `projects.report_emails` (= projects テーブルから既取得) → 既存関係先メール
- `project_partners?project_id=eq.<projectId>&select=partner_name,partner_email,role` → 既存事業会社

### A-2: 5 生データから候補抽出 (= MCP 直叩き)
- **Gmail** `mcp__6177d349-3dda-4619-a696-29643fc4587d__search_threads`:
  - query = `(from:<report_email1> OR to:<report_email1> OR ...) after:<ym 開始 YYYY/MM/DD> before:<ym 終了+1日>`
  - メール送受信から外部関係先メール抽出 (= 内部 `@team-armada.jp` 除外)
- **Notion** `mcp__e4a96d32-6a4a-482d-80ba-4e7792f0cd29__notion-search`:
  - query = `<projectName> <ym>` で議事録 attendees / メンション抽出
- **Calendar** `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_events`:
  - 当月内 PJ 関連 events の attendees から関係者抽出
- **Slack** `mcp__833b660c-3bc6-43e7-923e-68e2bd3b6695__slack_read_channel` (= projects.slack_channel_id):
  - 当月内メッセージから PJ メンバー候補 (= AMD members で project_members 未登録のもの)
- **Drive** `mcp__66e633f8-4f3e-495d-aa3c-4733ce09335f__search_files`:
  - drive_folder_id 配下の更新ファイルから関係先 / 担当者抽出

### A-3: alias map + members 全件取得
- L5 と同様、`members?select=member_id,code_name,email,status` で alias map 構築

═══════════════════════════════════════════════════
Phase B: LLM 抽出 (= 私自身)
═══════════════════════════════════════════════════

入力:
- OS snapshot (= 既存 PJ メンバー / 関係先メール / 事業会社)
- 5 生データから抽出した候補リスト
- alias map
- past l2_feedbacks (= `l2_feedbacks?l2_kind=eq.project_registry_diff&target_id=eq.<projectId>&status=eq.active`)

**抽出ルール**:
- AMD 内部メンバー (= members に存在) で繰り返し PJ 生データに登場するが `project_members` に居なければ → registryDiffs (target_table='project_members')
- Gmail から外部関係先メール抽出、`projects.report_emails` 未登録なら → registryDiffs (target_table='projects' / proposed_patch_json.email)
- 内部アドレス `@team-armada.jp` は除外
- 協業先 / 顧客候補 → target_table='project_partners'
- 既存 OS snapshot に存在する候補は出さない (= 重複防止)
- 既存 `project_registry_diffs` で status='pending' or 'applied' に同じ target_key があれば出さない
- past_feedbacks の指示を必ず反映

**出力 JSON のみ**:
```json
{
  "diffs": [
    {
      "project_id": "<projectId>",
      "ym": "<ym>",
      "scope_key": "<scope_key>",
      "diff_kind": "member_candidate|partner_candidate|partner_email_candidate|report_email_candidate|contact_candidate",
      "target_table": "project_members|projects|project_partners",
      "target_key": "<entity name or email>",
      "target_key_norm": "<lowercase + trim>",
      "current_snapshot_json": { ... },
      "proposed_patch_json": { ... },
      "proposed_patch_hash": "<sha256 of patch>",
      "evidence_refs_json": [ { "source": "gmail|notion|calendar|slack|drive", "ref_id": "...", "snippet": "<200 chars>", "source_url": "...", "hash": "..." } ],
      "confidence": 0.0-1.0
    },
    ...
  ]
}
```

═══════════════════════════════════════════════════
Phase C: Supabase upsert
═══════════════════════════════════════════════════

各 diff について:
```
POST $SUPABASE_URL/rest/v1/project_registry_diffs
body: {
  ...diff 全部
  "status": "pending",
  "created_by": "claude_routine_l7"
}
Prefer: return=minimal
```

### l2_notifications upsert (= diffs.length > 0)
```
body: {
  "l2_kind": "project_registry_diff",
  "target_id": "<projectId>",
  "scope_key": "<ym>",
  "title": "📋 <projectName> (<ym>) OS 台帳差分候補 (<diffsN>件)",
  "summary": "<top 3 diff_kind:target_key joined / >",
  "saved_count": <diffsN>,
  "total_count": <diffsN>,
  "importance": 2
}
```

### feedback applied_count++

═══════════════════════════════════════════════════
Phase D: run summary
═══════════════════════════════════════════════════

- まさへの 1 行サマリ:
  `📋 OS 台帳差分 routine HH:MM 完了: N PJ チェック、M diffs (= member_candidate=X, partner=Y, email=Z)`

【禁止】
- 内部アドレス `@team-armada.jp` を関係先メールとして登録
- 既存 OS snapshot に存在する候補を再提出 (= 重複防止)
- 既存 pending diff に同じ target_key を再提出
- past_feedbacks 無視
- 5 ソース全部見ない (= まさ絶対ルール 2026-05-11)
