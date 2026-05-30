---
name: amd-os-l4-project-knowledge-extract
description: AMD OS L2 ④ PJナレッジ抽出の repo 正本。現行 writer は Windows MMO PC の Codex Desktop automation `amd-os-l4-project-knowledge-extract` (= daily 08:15 JST)。各 active PJ × {当月, 前月} の monthly_reports + project_meeting_summaries から PJ にまつわる事実を subscription 内 Codex で抽出し、Supabase `project_knowledge` に candidate で保存 + 通知する。GAS 155 は kill switch のまま復活させない。
---

# AMD OS L2 ④ PJ ナレッジ抽出 (GAS 155 移植版)

## 設計の要点
- GAS 155 `nav_project_knowledge_pollAll` / `nav_project_knowledge_extractOneForYm_` の業務ロジックを Windows MMO Codex Desktop automation に移植
- 現行復旧先は MMO マシン側の Codex Desktop automation 履歴・ログ。Mac local routine / Claude Cloud routine は履歴扱い
- **汚染防御 v4_meta_strict 継承** = project_meta セクションを prompt 冒頭、無関係内容は items: [] で抽出 0 件 (= 2026-05-09 SE PJ 汚染事故対応)
- 入力 = active PJ × {当月, 前月} の `monthly_reports` (status≠invalid) + `project_meeting_summaries` (source_kinds≠none)
- 出力 = `project_knowledge` (= 既存 row は entity_name+category で SELECT → INSERT/PATCH、status='candidate' で通知採否)
- 9 category: `people` / `tech` / `ip` / `org` / `funding` / `market` / `competitor` / `strategy` / `term`

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.2-3.4
2. `pwa/design/project_knowledge.md` (= L2 ④ 仕様正本)
3. `pwa/design/db_schema.md` (= 列名 grep)
4. `gas/155_L2KnowledgeExtractor.js` 行 387-606 (= 元 ④ 実装)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name`
- ymList = [当月 (= YYYYMM JST), 前月]
- l2_extract_state.last_processed_at 古い順 sort (maxItems=4 / run)

═══════════════════════════════════════════════════
Phase A: 各 (projectId, ym) について入力収集
═══════════════════════════════════════════════════

### A-1: monthly_reports (status≠invalid)
`monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&status=neq.invalid&select=project_id,ym,final_content,draft_content,status&limit=1`
- reportBody = final_content || draft_content (= 12000 chars 上限)

### A-2: project_meeting_summaries (source_kinds≠none)
`project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=30&select=meeting_date,title,summary_short,decided,progress,next_actions,risks`

### A-3: source_hash
`hashInput = JSON.stringify({ p: projectId, ym, pv: "v4_meta_strict", rb: reportBody.slice(0,12000), sums: [...] })` → sha256
- 既存 source_hash 一致なら **skipped_unchanged**
- reportBody empty + summaries 0 件なら `no_input` で state upsert + continue

═══════════════════════════════════════════════════
Phase B: alias map + feedback block 構築
═══════════════════════════════════════════════════

(= L5 / L6 と同様。`l2_feedbacks?l2_kind=eq.project_knowledge&target_id=eq.<projectId>&status=eq.active` で scope_key == ym のものに絞る)

═══════════════════════════════════════════════════
Phase C: LLM 抽出 (= 私自身、汚染防御 v4_meta_strict)
═══════════════════════════════════════════════════

### C-1: 入力テキスト
```
=== project_meta (これが対象 PJ の唯一の正解。これと無関係な内容は完全に無視) ===
projectId: <projectId>
projectName: <projects.project_name>
ym: <ym>

=== monthly_report (status=<status>) ===
<reportBody (12000 chars 上限)>

=== meeting_summaries ===
[YYYY-MM-DD] <title> :: <summary_short> | decided: ...
...
```

### C-2: 抽出ルール
- **🚨 汚染防御**: 入力に projectName と無関係な固有名詞 / 組織 / 技術が書かれていたら、汚染データの可能性が高い → 抽出しない (items: []) (= 2026-05-09 SE PJ 汚染事故対応)
- category は 9 種: `people` / `tech` / `ip` / `org` / `funding` / `market` / `competitor` / `strategy` / `term`
- entity_name は固有名詞・組織名・技術名 (200 chars 上限)
- fact_text は入力に書かれていることだけ (1500 chars 上限、推測禁止)
- 同じ entity_name は category 別なら別行 OK
- confidence: high / medium / low

### C-3: 出力 JSON のみ
```json
{
  "items": [
    { "category": "people|tech|ip|org|funding|market|competitor|strategy|term", "entity_name": "対象名", "fact_text": "事実の説明 (200字以内)", "confidence": "high|medium|low" },
    ...
  ]
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知 + feedback applied
═══════════════════════════════════════════════════

### D-1: project_knowledge INSERT or PATCH
各 item について (= UNIQUE 制約なし、既存 SELECT → INSERT or PATCH):

GET `project_knowledge?project_id=eq.<projectId>&category=eq.<cat>&entity_name=eq.<entity_name>&select=id,fact_text&limit=1`

- 既存あり: PATCH `project_knowledge?id=eq.<id>` body: `{ fact_text, confidence, source: "l2_hourly_extract", status: "candidate", updated_at: <ISO now> }`
- 既存なし: POST `project_knowledge` body: `{ project_id, category, entity_name, fact_text, confidence, source, status: "candidate", updated_at }`

### D-2: l2_extract_state upsert (= l2_kind='project_knowledge')

### D-3: feedback applied_count++

### D-4: l2_notifications upsert (= saved>0)
```
body: {
  "l2_kind": "project_knowledge",
  "target_id": "<projectId>",
  "scope_key": "<ym>",
  "title": "🗂️ <projectName> (<ym>) PJナレッジ更新 (<savedN>件)",
  "summary": "<top 3 'category:entity_name' joined / >",
  "saved_count": <savedN>,
  "total_count": <parsed.items.length>,
  "importance": 1
}
```

═══════════════════════════════════════════════════
Phase E: run summary
═══════════════════════════════════════════════════

- targets (= projects × ymList) 数 / processed / llmCalls / unchanged / errors / hasMore
- まさへの 1 行サマリ:
  `🗂️ PJ ナレッジ routine 08:15 完了: N (PJ × ym) チェック、M saved (合計 K件)、L unchanged`

【禁止】
- GAS WebApp 経由で呼ぶ
- 列名想像 (= db_schema.md grep)
- projectName と無関係な内容を抽出 (= 汚染防御、items: [] を返す)
- 推測で fact_text を書く
- l2_feedbacks 無視
