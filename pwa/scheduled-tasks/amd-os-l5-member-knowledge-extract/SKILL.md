---
name: amd-os-l5-member-knowledge-extract
description: AMD OS D-4 メンバーナレッジ抽出の repo 正本。現行 writer は Windows MMO PC の Codex Desktop automation `amd-os-l5-member-knowledge-extract` (= daily 08:30 JST)。各 active member の member_activities + 関連 PJ の project_meeting_summaries + milestone_responsibility から本人の skills / personality / communication_style / growth_areas / work_style / interests / episodes を subscription 内 Codex で抽出し、Supabase `member_knowledge` に candidate で保存 + 通知する。GAS 155 は kill switch のまま復活させない。
---

# AMD OS D-4 メンバーナレッジ抽出 (GAS 155 移植版)

## 設計の要点
- GAS 155 `nav_member_knowledge_pollAll` / `nav_member_knowledge_extractOne_` の業務ロジックを Windows MMO Codex Desktop automation に移植 (= GAS 完全 bypass)
- 現行復旧先は MMO マシン側の Codex Desktop automation 履歴・ログ。Mac local routine / Claude Cloud routine は履歴扱い
- 入力 3 セクション:
  - C) **公式の役割分担** = milestone_responsibility (share>0) → skills / work_style のグラウンドトゥルース
  - A) **本人活動ログ** = member_activities (直近 90 日)
  - B) **PJ 全体会議サマリ** = project_meeting_summaries (直近 60 日) ※本人主体とは限らない、本人名明示 + C 整合のみ
- LLM 呼びは subscription 内 Codex automation
- Supabase REST 直叩き (= service_role)
- source_hash 差分検知で冪等性 (= l2_extract_state、PK l2_kind+target_id+scope_key)
- `l2_feedbacks` 修正依頼を prompt に注入

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.1-3.4
2. `pwa/design/member_knowledge.md` (= D-4 仕様正本)
3. `pwa/design/db_schema.md` (= 列名 grep)
4. `gas/155_L2KnowledgeExtractor.js` 行 56-381 (= 元 D-4 実装)
5. `gas/079_NameAliasMap.js` (= 名前正規化)

═══════════════════════════════════════════════════
Phase 0: env + active members 取得
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

`members?select=member_id,code_name,email,status&status=eq.active&order=member_id`

═══════════════════════════════════════════════════
Phase A: 各 active member について入力 3 セクション収集
═══════════════════════════════════════════════════

各 member について順に (= maxItems=5 / run、l2_extract_state.last_processed_at 古い順):

### A-1: l2_extract_state 読込 (差分検知用)
`l2_extract_state?l2_kind=eq.member_knowledge&target_id=eq.<code_name>&scope_key=eq.global&select=source_hash,last_processed_at`

### A-2: セクション C = milestone_responsibility (公式役割分担)
`milestone_responsibility?member_id=eq.<member_id>&share=gt.0&select=milestone_id,share,role,task_description` → 該当 MS の `value_milestones?milestone_id=in.(...)&is_active=eq.true&select=milestone_id,plan_cycle_id,title,points,goal_level,success_criteria` → plan_cycle_id から `value_plan_cycles?plan_cycle_id=in.(...)&select=plan_cycle_id,project_id,period_start_ym,period_end_ym` で project_id 解決。

### A-3: セクション A = member_activities (本人活動、直近 90 日)
`member_activities?member_id=eq.<member_id>&extracted_at=gte.<90日前 ISO>&order=extracted_at.desc&limit=200&select=member_id,project_id,ym,title,content_preview,source,extracted_at,milestone_id`

### A-4: セクション B = project_meeting_summaries (関連 PJ、直近 60 日)
`project_members?member_id=eq.<member_id>&is_active=is.true&select=project_id` で関連 PJ 一覧 → `project_meeting_summaries?project_id=in.(...)&meeting_date=gte.<60日前 YYYY-MM-DD>&source_kinds=neq.none&order=meeting_date.desc&limit=80&select=project_id,meeting_date,title,summary_short,decided,progress,next_actions`

### A-5: source_hash 計算
`hashInput = JSON.stringify({ cn: codeName, mid: memberId, pv: "v3_with_aliases", acts: [...], roles: [...], sums: [...] })` → sha256
- 既存 source_hash と一致なら **skipped_unchanged** (= LLM 呼ばない、`l2_extract_state.last_processed_at` だけ touch)

### A-6: 入力薄すぎチェック
セクション A 0 件 + セクション B 0 件 → `no_input` で state upsert (saved=0)、続く member へ

═══════════════════════════════════════════════════
Phase B: alias map + feedback block 構築
═══════════════════════════════════════════════════

### B-1: alias map (= GAS 079 `nameAlias_buildBlock` 移植)
`members?select=member_id,code_name,email,status&order=member_id` 全件 → 各 row で aliasSet = { code_name, email local part (= @手前、ただし `^id\d+$` 除外) }
- フォーマット: `- <codeName> = <alias1>, <alias2>, ... (= 同一人物、code_name は '<codeName>')` (= inactive は ` [非アクティブ・歴史的記録に登場可]` 末尾)
- ブロック頭は GAS 079 と同じ
- (= members に member_name 列が無いので姓 / 名 / 本名は member_name 追加後に充実)

### B-2: feedback block (= GAS 155 `_l2_loadFeedbackBlock_` 移植)
`l2_feedbacks?l2_kind=eq.member_knowledge&target_id=eq.<code_name>&status=eq.active&order=created_at.desc&limit=20&select=feedback_id,scope_key,feedback_text,created_at,created_by` → scope_key == 'global' のもの。

フォーマット:
```
=== 過去のユーザーフィードバック (重要・必ず反映すること) ===
  1. [YYYY-MM-DD masa] <feedback_text>
  ...
```

feedbackIds = それらの feedback_id list。

═══════════════════════════════════════════════════
Phase C: LLM 抽出 (= 私自身が JSON 出力)
═══════════════════════════════════════════════════

入力テキスト (= 20000 chars 上限):
```
=== C) <codeName> の公式の役割分担 (milestone_responsibility, share>0) ===
[本人が公式に担当している業務範囲のグラウンドトゥルース。
 skills / work_style 等を抽出するときに最も信頼できる根拠。
 ここに書かれていない領域は本人の業務外の可能性が高い。]
[<project_id> <period>] [share=<share>] [role=<role>] MS: <msTitle> (<points>pt, <goalLevel>)
  task_description: ...
  success_criteria: ... (600 chars 上限)
...

=== A) <codeName> 本人の活動ログ (member_activities, 直近 90 日, max 200) ===
[本人主体活動、自由抽出 OK]
[YYYY-MM-DD <projectId>/<ym>/<source>] <title>: <content_preview (400 chars)>
...

=== B) <codeName> が PJ メンバーである PJ の会議サマリ (project_meeting_summaries, 直近 60 日) ===
[⚠️ PJ 全体サマリ。本人主体とは限らない。
 本人名明示 + セクション C の役割範囲と整合のみ抽出。
 役割範囲外の議論を本人スキルにしてはいけない。]
[YYYY-MM-DD <projectId>] <title> :: <summary_short> | decided: ...
...
```

**抽出ルール**:
- セクション C = 業務範囲のグラウンドトゥルース
- セクション A = 自由抽出 OK
- セクション B = 本人名明示 + C 整合のみ
- category は 7 種から複数選択可: `skills` / `personality` / `communication_style` / `growth_areas` / `work_style` / `interests` / `episodes`
- summary は 100 字以内、自然文 (箇条書き禁止)
- 入力に書かれてない推測は禁止
- 名前 (code_name) を summary に含めない (= 別カラム管理のため)
- C 空 + A 空 + B のみなら categories: []

**出力 JSON のみ**:
```json
{
  "categories": [
    { "category": "skills|personality|communication_style|growth_areas|work_style|interests|episodes", "summary": "<100 字以内日本語>" },
    ...
  ]
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知 + feedback applied
═══════════════════════════════════════════════════

### D-1: member_knowledge upsert (UNIQUE code_name+category)
各 category について (= migration 091 で status / source_hash / last_processed_at 列追加済):
```
POST $SUPABASE_URL/rest/v1/member_knowledge?on_conflict=code_name,category
body: {
  "code_name": "<codeName>",
  "category": "<cat>",
  "summary": "<sum.slice(0,500)>",
  "source": "l2_hourly_extract",
  "status": "candidate",
  "source_hash": "<newHash>",
  "last_processed_at": "<ISO now>",
  "updated_at": "<ISO now>"
}
Prefer: resolution=merge-duplicates,return=minimal
```

通知 → まさが /notifications で「はい」で status='active' に昇格、「いいえ」で 'rejected'。

### D-2: l2_extract_state upsert
```
POST $SUPABASE_URL/rest/v1/l2_extract_state?on_conflict=l2_kind,target_id,scope_key
body: {
  "l2_kind": "member_knowledge",
  "target_id": "<codeName>",
  "scope_key": "global",
  "source_hash": "<newHash>",
  "saved_count": <savedN>,
  "total_count": <parsed.categories.length>,
  "llm_model": "anthropic:claude-sonnet-4-7@claude-routine",
  "last_processed_at": "<ISO now>",
  "message": null
}
```

### D-3: feedback applied_count++ (= feedbackIds 空でないとき + saved>0)
各 feedback_id について GET applied_count → PATCH `applied_count: +1, last_applied_at: <ISO now>`

### D-4: l2_notifications upsert (= saved>0 のみ)
```
POST $SUPABASE_URL/rest/v1/l2_notifications?on_conflict=l2_kind,target_id,scope_key
body: {
  "l2_kind": "member_knowledge",
  "target_id": "<codeName>",
  "scope_key": "global",
  "title": "👤 <codeName> のメンバーナレッジ更新 (<savedN>件)",
  "summary": "<categories joined / >",
  "saved_count": <savedN>,
  "total_count": <parsed.categories.length>,
  "importance": 1
}
```

═══════════════════════════════════════════════════
Phase E: run summary
═══════════════════════════════════════════════════

- members 数 / processed / llmCalls / unchanged / errors / hasMore
- まさへの 1 行サマリ:
  `👤 メンバーナレッジ routine 08:30 完了: N 人チェック、M 人 saved (合計 K件)、L 人 unchanged`

【禁止】
- GAS WebApp 経由で呼ぶ
- 列名想像
- 本人名 (code_name) を summary に含める
- セクション C 役割範囲外の議論を本人スキルにする
- セクション B だけある + 本人名明示なしで抽出する
- l2_feedbacks 無視
