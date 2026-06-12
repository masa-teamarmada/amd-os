---
name: amd-os-l2-protocol-extract
description: AMD OS D-1 AMDプロトコル抽出の repo 正本。現行 writer は Windows MMO PC の Codex Desktop automation `amd-os-l2-protocol-extract` (= daily 08:00 JST)。各 active PJ × {当月, 前月} の project_meeting_summaries + monthly_reports から「分岐点 / 判断材料 / アクション / 結果 (= 後追い欄、自動抽出時は空)」を subscription 内 Codex で構造化抽出し、Supabase `protocols` に candidate で保存 + 通知する。GAS 155 は kill switch のまま復活させない。
---

# AMD OS D-1 AMD プロトコル抽出 (GAS 155 移植版)

## 設計の要点
- AMD プロトコル = AMD の最重要知財 (= 経営判断の構造化記録、分岐点 / 判断材料 / アクション / 結果)
- 「結果」欄はアクション後に実際に起きたことを後追いで入れる欄 → **自動抽出では空**
- GAS 155 `nav_protocol_pollAll` / `nav_protocol_extractOneForYm_` の業務ロジックを Windows MMO Codex Desktop automation に移植
- 現行復旧先は MMO マシン側の Codex Desktop automation 履歴・ログ。Mac local routine / Claude Cloud routine は履歴扱い
- 入力 = active PJ × {当月, 前月} の `project_meeting_summaries` (decided / risks / next_actions 中心)
- 出力 = `protocols` (= 既存 row は protocol_id で SELECT → INSERT/PATCH、status='candidate' で通知採否 → yes で `confirmed` 昇格)
- LLM prompt = Supabase `llm_prompts.protocol.extract` (= AGENTS.common.md ルール、コード hardcode 禁止)

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.2-3.4
2. `pwa/design/amd_protocol.md` (= D-1 仕様正本)
3. `knowledge/amd_os_vision.md` 「AMDプロトコルの 4 要素」section
4. `pwa/design/db_schema.md` (= 列名 grep)
5. `gas/155_L2KnowledgeExtractor.js` 行 608-820 (= 元 D-1 実装)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name`
- ymList = [当月, 前月]
- l2_extract_state.last_processed_at 古い順 sort (maxItems=4 / run)

═══════════════════════════════════════════════════
Phase A: 各 (projectId, ym) について入力収集
═══════════════════════════════════════════════════

### A-1: project_meeting_summaries (= decided 中心、source_kinds≠none)
`project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=50&select=meeting_id,meeting_date,title,summary_short,decided,risks,next_actions`

### A-2: source_hash
`hashInput = JSON.stringify({ p: projectId, ym, pv: "v4_protocol_result_blank", sums: [...] })` → sha256
- 既存 source_hash 一致なら **skipped_unchanged**
- summaries 0 件なら `no_input` で state upsert + continue

═══════════════════════════════════════════════════
Phase B: prompt + alias map + feedback block
═══════════════════════════════════════════════════

### B-1: protocol.extract prompt 取得 (= AGENTS.common.md ルール)
`llm_prompts?prompt_key=eq.protocol.extract&is_active=eq.true&select=body&limit=1`
- 取得失敗 / 空なら **抽出 skip** + state.message に「missing llm_prompts.protocol.extract」を記録 (= ハードコード禁止)

### B-2: alias map (= L5 と同様)

### B-3: feedback block (= L5 と同様、l2_kind='protocols')
`l2_feedbacks?l2_kind=eq.protocols&target_id=eq.<projectId>&status=eq.active&order=created_at.desc&limit=20`
- scope_key == ym または `<ym>:protocol:<protocol_id>` 前方一致 (= GAS の特殊扱い、月次抽出時は個別 protocol feedback も拾う)

═══════════════════════════════════════════════════
Phase C: LLM 抽出
═══════════════════════════════════════════════════

### C-1: 入力テキスト
```
[YYYY-MM-DD] <title>
  summary: <summary_short>
  decided: <decided joined / >
  risks: <risks joined / >
  next_actions: <next_actions joined / >
...
```
(= 16000 chars 上限)

### C-2: user prompt
```
project_id: <projectId> / ym: <ym>

<alias block>

<input text>

<feedback block (= 該当ありなら)>
```

### C-3: 出力 = `llm_prompts.protocol.extract` の指定 schema に従う
通常は items[] = { protocol_id (= 新規生成: <ym>:<projectId>:<short slug>), title, branch_point, judgment_basis, action, source_meeting_ids }
- result 欄は空 (= 後追い人手記入)

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知 + feedback applied
═══════════════════════════════════════════════════

### D-1: protocols upsert (= UNIQUE protocol_id)
各 item について:
```
POST $SUPABASE_URL/rest/v1/protocols?on_conflict=protocol_id
body: {
  "protocol_id": "<生成 ID>",
  "project_id": "<projectId>",
  "title": "<title>",
  "branch_point": "<branch_point>",
  "judgment_basis": "<judgment_basis>",
  "action": "<action>",
  "result": null,
  "status": "candidate",
  "source_meeting_ids": [...],
  "updated_at": "<ISO now>"
}
Prefer: resolution=merge-duplicates,return=minimal
```
(NB: protocols テーブルの実列は db_schema.md で grep 確認、必要に応じて payload 調整)

### D-2: l2_extract_state upsert (= l2_kind='protocols')

### D-3: feedback applied_count++

### D-4: l2_notifications upsert (= saved>0)
```
body: {
  "l2_kind": "protocols",
  "target_id": "<projectId>",
  "scope_key": "<ym>",
  "title": "📜 <projectName> (<ym>) プロトコル更新 (<savedN>件)",
  "summary": "<top 3 title joined / >",
  "saved_count": <savedN>,
  "total_count": <parsed.items.length>,
  "importance": 2
}
```

═══════════════════════════════════════════════════
Phase E: run summary
═══════════════════════════════════════════════════

- まさへの 1 行サマリ:
  `📜 プロトコル routine 08:00 完了: N (PJ × ym) チェック、M saved (合計 K件)、L unchanged`

【禁止】
- llm_prompts.protocol.extract が空のときハードコード prompt で fallback (= AGENTS.common.md ルール違反)
- result 欄を自動抽出 (= 後追い人手記入欄)
- 列名想像
- l2_feedbacks 無視
