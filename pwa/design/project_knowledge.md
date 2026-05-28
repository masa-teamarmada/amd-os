# PJナレッジ (④ L2) — 設計の正本

最終更新: 2026-05-25 (#68 current truth 反映)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

L2 ④ PJナレッジ (`project_knowledge`) の自動更新 cron。

- アクティブ PJ × 当月/前月 単位で「人物/技術/IP/組織/資金/市場/競合/戦略/用語」を Supabase に upsert
- 毎時 polling + `l2_extract_state.source_hash` 差分検知

---

## Phase の流れ

| 時期 | 内容 |
|---|---|
| ~ Phase 3 | ⚠️ 流入元不明だが既に 2024 行存在 (= 過去のスプシ手入力 or 別経路で蓄積) |
| Phase 4 | 2026-05-09 に本体GAS の毎時 trigger (`gas/155_L2KnowledgeExtractor.js` `nav_project_knowledge_pollAll`) で稼働開始。**入力は二次集約** (monthly_reports + project_meeting_summaries)。**既存 2024 行は破壊しない設計** (entity_name 単位で SELECT → 既存有り UPDATE / 無し INSERT) |
| **2026-05-22 以降** ⭐ (current truth) | LLM 課金抑制のため GAS 155 が kill switch 停止。`project_knowledge` は ghost 状態。復旧方針は Claude routine `amd-os-project-knowledge-extract` (= daily 08:15 JST 予定)。詳細は [../manual/8-3-l2-extraction-routines-spec.md](../manual/8-3-l2-extraction-routines-spec.md) |

---

## データフロー

```
[毎時 15 分 GAS time-trigger (時間分散)]
   │
   ├─ nav_project_knowledge_pollAll(opts?) (gas/155)
   │     1) projects where status='active' を取得
   │     2) target list = アクティブ PJ × {当月, 前月}
   │     3) l2_extract_state (l2_kind='project_knowledge') 古い順 sort
   │     4) maxItems (default 4) 打ち切り
   │
   └─ nav_project_knowledge_extractOneForYm_(projectId, ym, opts?)
         a) monthly_reports WHERE project_id=? AND ym=? の final_content || draft_content
         b) project_meeting_summaries WHERE project_id=? AND ym=? AND source_kinds!='none' (max 30)
         c) source_hash = sha256(JSON({p, ym, rb, sums}))
         d) l2_extract_state 既存比較 → unchanged なら touch + return
         e) 入力 (本文 + summaries 0 件) なら no_input で state 更新だけ
         f) Gemini Flash に投げ、9 category (people/tech/ip/org/funding/market/competitor/strategy/term) を JSON で抽出
         g) 各 item について SELECT (project_id, category, entity_name) → 既存有り PATCH / 無し INSERT
         h) l2_extract_state を upsert
```

---

## 9 カテゴリ (project_knowledge.category)

| category | 意味 |
|---|---|
| people | 人物・役職 |
| tech | 技術・手法 |
| ip | 知財・特許・論文 |
| org | 組織・体制 |
| funding | 資金・予算・調達 |
| market | 市場・顧客 |
| competitor | 競合 |
| strategy | 戦略・方針 |
| term | 用語・専門ワード |

各 item は `(category, entity_name, fact_text, confidence)` を出力。`entity_name` は固有名詞・組織名・技術名など。

---

## Supabase スキーマ

### `project_knowledge` (既存、変更なし)

```sql
CREATE TABLE project_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   TEXT NOT NULL REFERENCES projects(project_id),
  category     TEXT NOT NULL,                  -- 上記 9 種
  entity_name  TEXT NOT NULL,                  -- 固有名詞 / 組織 / 技術 等
  fact_text    TEXT,                           -- 200 字以内の事実説明
  confidence   TEXT DEFAULT 'medium',          -- 'high' | 'medium' | 'low'
  source       TEXT,                           -- Phase 4 cron は 'l2_hourly_extract'
  status       TEXT DEFAULT 'active',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ⚠️ UNIQUE 制約は無い (= 既存 2024 行を破壊しないため Phase 4 では追加していない)
-- 重複回避は cron 内で SELECT (project_id, category, entity_name) → 既存有り PATCH で対応
```

### `l2_extract_state` (共通)
[member_knowledge.md](member_knowledge.md) 参照。

---

## 主要ファイル

| ファイル | 役割 |
|---|---|
| [gas/155_L2KnowledgeExtractor.js](../../gas/155_L2KnowledgeExtractor.js) | **本ロジック正本**。`nav_project_knowledge_pollAll` / `nav_project_knowledge_extractOneForYm_` |
| [pwa/scripts/migrations/030_l2_extract_state.sql](../scripts/migrations/030_l2_extract_state.sql) | state テーブル DDL |

---

## 認証 / 呼び出し方

### 本番
2026-05-25 #68 時点では、GAS time-trigger は停止中。GAS 155 は `L2_KNOWLEDGE_CRON_DISABLED_20260522` で disabled return するため、毎時発火を復活させない。

復旧後は Claude routine `amd-os-project-knowledge-extract` が daily 08:15 JST に実行し、Supabase REST へ直接 upsert する設計。

### 手動実行 (curl)
```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
curl -sL --max-time 300 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_project_knowledge_pollAll"
```

---

## 既知の制約・運用上の注意

- **本 Phase は二次集約**: monthly_reports + project_meeting_summaries が入力。Phase 4.x で 5 生データ (= Notion / Slack / Gmail / Drive / Calendar) 直結に改善予定
- **maxItems 4**: 1 cron あたり LLM call 4 件 (PJ × ym = 14 target を 4 で割ると複数 cron に分散)
- **既存 2024 行は破壊しない**: UNIQUE 制約を追加せず、SELECT → 既存有り PATCH / 無し INSERT で重複回避
- **`source='l2_hourly_extract'` で識別可能**: Phase 4 cron 由来かどうかは source 列で区別

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | Phase 4 初版稼働。GAS 155 で毎時 polling + source_hash 差分検知 + 二次集約 (monthly_reports + meeting_summaries → Gemini → SELECT/INSERT/PATCH) |
| 2026-05-09 | **alias map 統合**: `gas/079 nameAlias_buildBlock` でメンバー名の表記揺れマップを LLM プロンプトに渡す。`pv: "v3_with_aliases"` で全行再抽出 |
| 2026-05-09 | **v4_meta_strict 防御強化** (BUGS.md 「PJナレッジ抽出で SE に CryoX/神谷 が紛れ込む」事故対応): userPrompt 冒頭に `=== project_meta ===` セクション (projectId / projectName / ym) 追加 + systemPrompt に「monthly_report が他 PJ 内容で汚染されているケース (例: projectName='SE' なのに CryoX/NIMS神谷 が書かれている) は items: [] を返せ」明示。`monthly_reports.status=neq.invalid` フィルタで汚染レポートは入力対象外に。汚染レポートは手動で `status='invalid'` にマーク運用 |
| 2026-05-25 | #68 current truth 反映。GAS 155 は 5/22 kill switch で停止中、復旧は Claude routine `amd-os-project-knowledge-extract`。 |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`member_knowledge.md`](member_knowledge.md) — Phase 4 ⑤
- [`amd_protocol.md`](amd_protocol.md) — Phase 4 ②
- [`ms_progress.md`](ms_progress.md) — Phase 4 ③ (差分検知の先行実装)
