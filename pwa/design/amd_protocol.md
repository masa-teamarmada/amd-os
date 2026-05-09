# AMDプロトコル (② L2) — 設計の正本

最終更新: 2026-05-09 (Phase 4 = 毎時 polling 化、初版稼働)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

L2 ② AMDプロトコル (`protocols`) の自動抽出 cron。

- アクティブ PJ × 当月/前月 の `project_meeting_summaries` から「経営判断 (= AMDプロトコルの 4 要素)」を抽出して `protocols` テーブルに upsert
- 毎時 polling + `l2_extract_state.source_hash` 差分検知

---

## AMDプロトコルとは (まさの正本)

> **AMD の最重要知財** ([knowledge/amd_os_vision.md](../../../knowledge/amd_os_vision.md))。経営判断の構造化記録。

4 要素:
1. **分岐点** — どんな選択肢があったか
2. **判断材料** — どんな情報で判断したか
3. **アクション** — 何をやることに決めたか
4. **結果・学習** — やってみてどうだったか

LLM は 4 要素を 1 本の `content` (markdown 200-400 字) に統合して出力する。

---

## Phase の流れ

| 時期 | 内容 |
|---|---|
| ~ Phase 3 | ❌ 未稼働 (テーブル空)。UI ([pwa/src/app/(app)/admin/protocols/page.tsx](../src/app/(app)/admin/protocols/page.tsx) + AdminProtocolsClient.tsx) は残っているが手動 insert のみ |
| **Phase 4** ⭐ (本仕様) | 本体GAS の毎時 trigger (`gas/155_L2KnowledgeExtractor.js` `nav_protocol_pollAll`) で稼働。**入力は project_meeting_summaries の二次集約** (decided / risks / next_actions が中心)。5 生データ直結は Phase 4.x 改善案。抽出結果は `status='candidate'` で保存され、PWA UI で `status='confirmed'` に昇格する運用 |

---

## データフロー

```
[毎時 30 分 GAS time-trigger (時間分散)]
   │
   ├─ nav_protocol_pollAll(opts?) (gas/155)
   │     1) projects where status='active' を取得
   │     2) target list = アクティブ PJ × {当月, 前月}
   │     3) l2_extract_state (l2_kind='protocols') 古い順 sort
   │     4) maxItems (default 4) 打ち切り
   │
   └─ nav_protocol_extractOneForYm_(projectId, ym, opts?)
         a) project_meeting_summaries WHERE project_id=? AND ym=? AND source_kinds!='none' (max 50)
         b) source_hash = sha256(JSON({p, ym, sums}))
         c) l2_extract_state 既存比較 → unchanged なら touch + return
         d) summaries 0 件 → no_input で state 更新だけ
         e) Gemini Flash に投げ、月次の最重要 1-3 件のプロトコルを JSON で抽出
         f) 各 protocol について protocols に upsert
              - protocol_id = "p4-" + projectId + "-" + ym + "-" + sha8(title)  (= 同月同タイトルの再抽出は同 ID で update)
              - status='candidate' (PM が UI で confirmed に昇格)
              - source='l2_hourly_extract'
         g) l2_extract_state を upsert
```

---

## Supabase スキーマ

### `protocols` (既存、変更なし)

```sql
CREATE TABLE protocols (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id TEXT UNIQUE NOT NULL,           -- Phase 4 では "p4-{projectId}-{ym}-{sha8(title)}"
  project_id  TEXT,
  title       TEXT NOT NULL,                  -- 20-40 字
  content     TEXT,                           -- 4 要素を含む 200-400 字 markdown
  status      TEXT DEFAULT 'candidate',       -- 'candidate' | 'confirmed' | 'archived'
  importance  INTEGER DEFAULT 1,              -- 1=軽微, 2=中, 3=重大
  source      TEXT DEFAULT 'manual',          -- Phase 4 cron は 'l2_hourly_extract'
  tags        TEXT,                           -- カンマ区切り (例: 'pricing,partnership')
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `l2_extract_state` (共通)
[member_knowledge.md](member_knowledge.md) 参照。

---

## UI (既存)

| ファイル | 役割 |
|---|---|
| [pwa/src/app/(app)/admin/protocols/page.tsx](../src/app/(app)/admin/protocols/page.tsx) | サーバ側 page (protocols / projects fetch) |
| [pwa/src/components/admin/AdminProtocolsClient.tsx](../src/components/admin/AdminProtocolsClient.tsx) | クライアント側 UI (一覧 + 手動 insert) |
| [pwa/src/components/admin/AdminSidebar.tsx](../src/components/admin/AdminSidebar.tsx) | サイドバーに `/admin/protocols` あり |

Phase 4 cron が `status='candidate'` で保存 → PM が UI で `status='confirmed'` に昇格する運用が想定 (UI の confirm ボタンは将来追加)。

---

## 主要ファイル

| ファイル | 役割 |
|---|---|
| [gas/155_L2KnowledgeExtractor.js](../../gas/155_L2KnowledgeExtractor.js) | **本ロジック正本**。`nav_protocol_pollAll` / `nav_protocol_extractOneForYm_` |
| [pwa/scripts/migrations/030_l2_extract_state.sql](../scripts/migrations/030_l2_extract_state.sql) | state テーブル DDL |

---

## 認証 / 呼び出し方

### 本番 (毎時)
GAS time-trigger `nav_protocol_pollAll` が毎時 1 回発火。

### 手動実行 (curl)
```sh
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
curl -sL --max-time 300 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll"
```

---

## 既知の制約・運用上の注意

- **入力源は MTGサマリ二次集約**: AMDプロトコルの本来の理想は「全 5 生データから経営判断を抽出」だが、Phase 4 初版では `project_meeting_summaries.decided` を主入力にしている。これは MTG サマリ自体が既に Notion + Gmail を結合した上澄みなので、まずは妥当な近似
- **Phase 4.x 改善候補**:
  - Slack の経営者間 DM / 経営戦略 channel のスレッドからも抽出
  - Notion の経営戦略 page からも抽出
- **重複防止**: `protocol_id = "p4-{projectId}-{ym}-{sha8(title)}"` で同月同タイトルは同 ID で update
- **source='l2_hourly_extract' / status='candidate'**: Phase 4 cron 由来は candidate で入る → PM 確認後 confirmed 昇格 (UI 実装は将来)
- **maxItems 4**: 1 cron あたり LLM call 4 件
- **重要度フィルタ**: LLM プロンプトで「月次の最重要 1-3 件」と制限。瑣末な決定は含めない方針

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | Phase 4 初版稼働。GAS 155 で毎時 polling + source_hash 差分検知 + 二次集約 (project_meeting_summaries → Gemini → upsert)。UI は既存活用 |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`meeting_summaries.md`](meeting_summaries.md) — ⑥ MTGサマリ (本 cron の主入力源)
- [`member_knowledge.md`](member_knowledge.md) / [`project_knowledge.md`](project_knowledge.md) — Phase 4 姉妹
- [`../../../knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) — AMDプロトコルの経営思想
