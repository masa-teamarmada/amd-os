---
name: amd-os-l8-xrl-evidence-extract
description: AMD OS M-2 XRL根拠抽出の repo 正本。現行 writer は Codex automation `amd-os-ms` + non-LLM LaunchAgent applier。active PJ × 当月/前月の 5 生データ + 既存 L2 から各 axis の evidence を抽出し、`xrlEvidence` outbox JSON を `/Users/masa/.codex/automations/amd-os-ms/outbox/` に作る。Supabase `project_xrl_evidence` への upsert は `ms_progress_review_tool.mjs apply-outbox-dir` が行う。DB/APIへ直接書き込まない。
---

# AMD OS M-2 XRL 根拠抽出 automation

## 設計の要点
- Codex automation `amd-os-ms` の `outbox.xrlEvidence` → LaunchAgent applier → Supabase 反映
- この SKILL は outbox payload の生成仕様。DB/API へ直接書き込まない
- 古い Claude routine / direct Supabase REST 移植案は履歴扱い。復活させない
- **axis**: `trl` (技術成熟度) / `brl` (事業成熟度) / `grl` (政府/補助金) / `srl` (社会受容) / `hrl` (人材/組織)
- **evidence_kind** 例: `founding_member` / `technical_validation` / `customer_signal` / `grant_signal` / `governance_signal` / `stakeholder_signal` / `team_signal` / `other`
- score は直接確定しない → candidate で INSERT → 通知 → まさが「はい」で `confirmed` 昇格
- HRL = `project_founding_members` (= 関連メンバー、category in ('amd','startup','university') が算入対象、VC/顧客/行政/産業パートナーは HRL 根拠外 = invalid)

## 反映経路

outbox は `/Users/masa/.codex/automations/amd-os-ms/outbox/*.json` に保存する。LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が 5 分ごとに `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` を実行し、成功ファイルを `applied/`、失敗ファイルを `failed/` へ移動する。

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.2-3.4
2. `pwa/design/xrl_evidence.md` (= M-2 仕様正本)
3. `pwa/design/amd_score.md` (= AMD Score 算定式)
4. `pwa/design/db_schema.md` (= project_xrl_evidence / project_founding_members / project_xrl_log / amd_score_inputs 列名)
5. `/Users/masa/.codex/automations/amd-os-ms/automation.toml` (= 元実装 prompt、特に「XRL 根拠の作り方」)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name,project_category`
- `project_category != 'ecosystem'` (= AMD Score 対象外) を skip
- ymList = [当月, 前月]
- 1 回 max 5 PJ

═══════════════════════════════════════════════════
Phase A: 入力収集
═══════════════════════════════════════════════════

各 (projectId, ym) について:

### A-1: 既存 L2 から evidence 候補
- `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&status=neq.invalid&select=final_content,draft_content`
- `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=30`
- `project_knowledge?project_id=eq.<projectId>&status=eq.active&order=updated_at.desc&limit=50` (= 既存 PJ ナレッジ)
- `project_founding_members?project_id=eq.<projectId>&status=eq.active&select=person_name,category,role_label_jp` (= 関連メンバー、HRL 用)

### A-2: 5 生データから補強 (= 必要に応じて、MCP 直叩き)
- Notion / Gmail / Drive / Slack / Calendar で当月の関連情報

### A-3: 既存 evidence (= 重複防止)
- `project_xrl_evidence?project_id=eq.<projectId>&ym=eq.<ym>&select=axis,evidence_kind,summary,source_hash,status&limit=100`

### A-4: past l2_feedbacks
- `l2_feedbacks?l2_kind=eq.xrl_evidence&target_id=eq.<projectId>&status=eq.active`

═══════════════════════════════════════════════════
Phase B: LLM 抽出 (= 私自身、axis × evidence_kind)
═══════════════════════════════════════════════════

**抽出ルール**:
- 各 axis について該当 evidence があれば抽出 (= 全 5 axis 必須ではない)
- evidence_kind は axis に応じた選択肢から
  - trl: `technical_validation` / `other`
  - brl: `customer_signal` / `commercial_validation` / `other`
  - grl: `grant_signal` / `governance_signal` / `other`
  - srl: `stakeholder_signal` / `other`
  - hrl: `founding_member` / `team_signal` / `other`
- summary は短く (200 chars 上限)
- structured_value_json は必要最小限 (= 例: `{ "trl_level": 5, "evidence": "MoU 締結" }`)
- source_refs_json は source id / date / sender / snippet (= 200 chars) / hash のみ (= 全文禁止)
- source_hash = sha256(JSON.stringify(structured_value + source_refs))
- 既存 evidence (= 同 source_hash) は出さない (= 重複防止)
- score を直接確定しない → candidate で INSERT
- past_feedbacks 必ず反映
- HRL の `founding_member` 候補は category in ('amd','startup','university') のみ (= VC / 顧客 / 行政 / 産業パートナーは HRL 根拠外)

**出力 JSON のみ**:
```json
{
  "evidences": [
    {
      "project_id": "<projectId>",
      "ym": "<ym>",
      "scope_key": "<ym>",
      "axis": "trl|brl|grl|srl|hrl",
      "evidence_kind": "<上記から>",
      "summary": "<200 chars 以内>",
      "structured_value_json": { ... },
      "source_refs_json": [ { "source": "...", "ref_id": "...", "snippet": "...", "source_url": "...", "hash": "..." } ],
      "source_hash": "<sha256>",
      "confidence": 0.0-1.0
    },
    ...
  ]
}
```

═══════════════════════════════════════════════════
Phase C: Supabase upsert + 通知
═══════════════════════════════════════════════════

### C-1: project_xrl_evidence upsert
```
POST $SUPABASE_URL/rest/v1/project_xrl_evidence
body: {
  ...evidence 全部
  "status": "candidate",
  "created_by": "claude_routine_l8"
}
Prefer: return=minimal
```

### C-2: l2_notifications upsert (= evidences.length > 0)
```
body: {
  "l2_kind": "xrl_evidence",
  "target_id": "<projectId>",
  "scope_key": "<ym>",
  "title": "🧪 <projectName> (<ym>) XRL 根拠候補 (<N>件)",
  "summary": "<top 3 'axis:evidence_kind' joined / >",
  "saved_count": <N>,
  "total_count": <N>,
  "importance": 2
}
```

### C-3: feedback applied_count++

═══════════════════════════════════════════════════
Phase D: run summary
═══════════════════════════════════════════════════

- axis 別件数 (= trl=X, brl=Y, ...)
- まさへの 1 行サマリ:
  `🧪 XRL 根拠 routine HH:MM 完了: N PJ チェック、M evidences (= TRL=X, BRL=Y, HRL=Z)`

【禁止】
- score を直接確定 (= candidate で INSERT、まさ「はい」で confirmed)
- HRL に VC / 顧客 / 行政 / 産業パートナーを founding_member 候補として出す
- 全文を source_refs_json に含める (= snippet 200 chars + hash のみ)
- 既存 source_hash と同じ evidence を再提出
- past_feedbacks 無視
- ecosystem PJ を対象に含める (= AMD Score 対象外)
