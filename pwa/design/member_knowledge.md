# メンバーナレッジ (⑤ L2) — 設計の正本

最終更新: 2026-05-09 (Phase 4 = 毎時 polling 化、初版稼働)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

L2 ⑤ メンバーナレッジ (`member_knowledge`) の自動更新 cron。

- アクティブメンバー単位で「強み / 性格 / コミュニケーション / 関心」等を Supabase に upsert
- 毎時 polling + `l2_extract_state.source_hash` 差分検知

---

## Phase の流れ

| 時期 | 内容 |
|---|---|
| Phase 1〜3 | ❌ 未稼働 (テーブル空) |
| **Phase 4** ⭐ (本仕様) | 本体GAS の毎時 trigger (`gas/155_L2KnowledgeExtractor.js` `nav_member_knowledge_pollAll`) で稼働。**入力は二次集約** (= 既存 `member_activities` + `project_meeting_summaries`)。5 生データへの直接アクセスは Phase 4.x 改善案 |

---

## データフロー

```
[毎時 0 分 GAS time-trigger]
   │
   ├─ nav_member_knowledge_pollAll(opts?) (gas/155)
   │     1) members where status='active' を取得
   │     2) l2_extract_state (l2_kind='member_knowledge', scope='global') の last_processed_at 古い順 sort
   │     3) maxItems (default 5) で打ち切り、各 code_name について extract
   │
   └─ nav_member_knowledge_extractOne_(codeName, memberId, opts?)
         a) 入力ソース取得:
              - member_activities WHERE code_name=? AND created_at>=NOW-90日 (max 200 件)
              - project_meeting_summaries WHERE project_id IN (member の active PJ) AND meeting_date>=NOW-60日 AND source_kinds!='none' (max 80 件)
         b) source_hash = sha256(JSON({cn, acts, sums}))
         c) l2_extract_state で既存比較 → unchanged なら touch + return
         d) 入力薄ければ no_input で state 更新だけして return
         e) Gemini Flash に投げ、7 category (skills/personality/communication_style/growth_areas/work_style/interests/episodes) を JSON で抽出
         f) 各 category について member_knowledge に upsert (UNIQUE(code_name, category))
         g) l2_extract_state を upsert (source_hash + counts + last_processed_at)
```

---

## 7 カテゴリ (member_knowledge.category)

| category | 意味 |
|---|---|
| skills | 技術スキル / 業務スキル |
| personality | 性格・人柄 |
| communication_style | コミュニケーションスタイル |
| growth_areas | 成長領域・挑戦中の課題 |
| work_style | 働き方の特徴 |
| interests | 興味・関心 |
| episodes | 印象的なエピソード |

LLM は確証のあるカテゴリだけ出す (= 全 7 カテゴリ揃わなくて OK)。各カテゴリ summary 100 字以内。

---

## Supabase スキーマ

### `member_knowledge` (既存、変更なし)

```sql
CREATE TABLE member_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_name TEXT NOT NULL,
  category  TEXT NOT NULL,        -- 上記 7 種のいずれか
  summary   TEXT,                 -- 100 字以内の自然文
  source    TEXT DEFAULT 'slack_conversation',  -- Phase 4 cron は 'l2_hourly_extract'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code_name, category)
);
```

### `l2_extract_state` (新規, migration 030, 共通テーブル)

```sql
CREATE TABLE l2_extract_state (
  l2_kind           TEXT NOT NULL,    -- 'member_knowledge' / 'project_knowledge' / 'protocols'
  target_id         TEXT NOT NULL,    -- code_name (member系) or project_id (PJ系)
  scope_key         TEXT NOT NULL,    -- 'global' (member系) or ym (PJ系)
  source_hash       TEXT NOT NULL,
  saved_count       INT  NOT NULL DEFAULT 0,
  total_count       INT  NOT NULL DEFAULT 0,
  llm_model         TEXT,
  message           TEXT,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (l2_kind, target_id, scope_key)
);
```

---

## 主要ファイル

| ファイル | 役割 |
|---|---|
| [gas/155_L2KnowledgeExtractor.js](../../gas/155_L2KnowledgeExtractor.js) | **本ロジック正本**。`nav_member_knowledge_pollAll` / `nav_member_knowledge_extractOne_` |
| [pwa/scripts/migrations/030_l2_extract_state.sql](../scripts/migrations/030_l2_extract_state.sql) | state テーブル DDL |

---

## 認証 / 呼び出し方

### 本番 (毎時)
GAS time-trigger `nav_member_knowledge_pollAll` が毎時 1 回発火。

### 手動実行 (curl)
```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
curl -sL --max-time 300 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_member_knowledge_pollAll"
# 強制再抽出
ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify([{force:true,maxItems:10}])))')
curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_member_knowledge_pollAll&args=$ARGS"
```

---

## 既知の制約・運用上の注意

- **本 Phase は二次集約**: 「5 生データから直接抽出」というまさのルールに対し、Phase 4 初版では既存 L2 (member_activities / project_meeting_summaries) を入力としている。Phase 4.x で 5 生データ (= Slack の本人発話 等) 直結に改善予定
- **maxItems 5**: 1 cron あたり LLM call 5 件まで (= 5 メンバー)。差分検知でほとんど skip されるので実走は 0-2 件想定
- **GAS UrlFetchApp タイムアウト**: 60 秒程度。1 メンバー × Gemini Flash で ~15 秒 → 5 件で 75 秒なので余裕は薄い。長引きそうなら maxItems を下げる
- **重複防止**: UNIQUE(code_name, category) で同人物 × 同 category は最新のみ残る
- **source 列 = 'l2_hourly_extract'**: 既存値 'slack_conversation' とは区別 (= Phase 4 cron 由来か手動 insert か区別可能)

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | Phase 4 初版稼働。GAS 155 で毎時 polling + source_hash 差分検知 + 二次集約 (member_activities + meeting_summaries → Gemini → upsert) |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体の設計、Phase 4 全 L2 毎時化方針の入口
- [`ms_progress.md`](ms_progress.md) — Phase 4 ③ MS進捗 (差分検知パターンの先行実装)
- [`project_knowledge.md`](project_knowledge.md) — Phase 4 ④ PJナレッジ (本ファイルと姉妹)
- [`amd_protocol.md`](amd_protocol.md) — Phase 4 ② AMDプロトコル
