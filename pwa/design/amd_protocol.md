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

★ 2026-05-11 設計改修 (= 普遍化 + 1:N 事例):

- **protocols テーブル = 普遍的な意思決定パターン**
  - 例: 「GAP ファンド系活用で設立タイミングを延ばすか、即時設立で進めるか」
  - title / content に **固有 PJ 名・人名・固有商品名を出さない**
  - 同じパターンが複数 PJ で起きたら同 protocol に集約 (= 知財として価値が高まる)
- **protocol_examples テーブル = 具体事例 (1 プロトコル : N 事例)**
  - 各 example に `project_id` / `occurred_on` / `summary` / 4 要素 / `source_meeting_id`
  - プロトコル本文 (普遍) + examples (具体) で監査可能
- **「単純な事実」(設立日 / 終了日 / 氏名 / 資金調達額) はプロトコルにしない** → `project_knowledge.basic_fact` に分類
  - `project_ventures` の構造化フィールドは `sync-pj-facts` cron で project_knowledge に同期される

4 要素 (普遍版、protocols.content に書く):
1. **① 分岐点 🔀** — どの選択肢があるか、抽象的に
2. **② 判断材料 📊** — どの情報で判断するか、抽象的に
3. **③ アクション 🎯** — どの方針を採るか、抽象的に
4. **④ 結果・学習 💡** — このパターンが過去どう機能したか、抽象的に

LLM (Gemini Flash) は 4 要素を 1 本の `content` (markdown 200-400 字) + `examples` 配列 (各事例の固有 4 要素) で出力する。

---

## Phase の流れ

| 時期 | 内容 |
|---|---|
| ~ Phase 3 | ❌ 未稼働 (テーブル空)。UI 既存だが手動 insert のみ |
| Phase 4 (初版) | 本体GAS 155 で稼働、ただし PJ 固有事例ベースで抽出 (= 普遍性なし) |
| **Phase 4.5** ⭐ (本仕様、2026-05-11) | 普遍プロトコル + 1:N 事例構造に移行。protocol_id は `p4u-{sha12(title)}` (= PJ 横断で同タイトル = 同 ID)、project_id=null。examples を protocol_examples に upsert。**LLM プロンプト本文は `llm_prompts.protocol.extract` 必須** (= コード hardcoded fallback 廃止、AGENTS ルール完遵)、まさが /admin/prompts で全文編集可能 |

---

## データフロー (Phase 4.5)

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
         e) llm_prompts (key='protocol.extract', is_active=TRUE) の body を取得 (= 無ければ missing_prompt で skip)
         f) Gemini Flash に投げ、月次の最重要 1-3 件のプロトコル + 各事例の examples を JSON で抽出
         g) 各 protocol について:
              - protocol_id = "p4u-" + sha12(title)  (= 普遍化、PJ 横断で同タイトル = 同 ID)
              - project_id=null (= 普遍プロトコル、紐付けは examples 側で)
              - status='candidate' + kind='pattern' + is_universal=true
              - 各 example を protocol_examples に upsert (UNIQUE: protocol_id, project_id, occurred_on)
         h) l2_extract_state を upsert
```

---

## Supabase スキーマ

### `protocols` (既存、変更なし)

```sql
-- 既存 (migration 049 で kind / is_universal 追加)
CREATE TABLE protocols (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id   TEXT UNIQUE NOT NULL,           -- Phase 4.5: "p4u-{sha12(title)}"
  project_id    TEXT,                           -- 普遍プロトコルは null (= 紐付けは examples 側)
  title         TEXT NOT NULL,                  -- 20-40 字、普遍的な見出し
  content       TEXT,                           -- 4 要素 markdown 200-400 字、固有 PJ 名禁止
  status        TEXT DEFAULT 'candidate',       -- 'candidate' | 'confirmed' | 'archived' | 'rejected'
  importance    INTEGER DEFAULT 1,              -- 1=軽微, 2=中, 3=重大
  source        TEXT DEFAULT 'manual',          -- Phase 4 cron は 'l2_hourly_extract'
  tags          TEXT,                           -- カンマ区切り
  kind          TEXT DEFAULT 'pattern',         -- 'pattern' (= 普遍) | 'legacy_specific' (= 旧形式)
  is_universal  BOOLEAN DEFAULT TRUE,           -- pattern なら TRUE
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- migration 049 / 050 で新規
CREATE TABLE protocol_examples (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id       TEXT NOT NULL REFERENCES protocols(protocol_id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  occurred_on       DATE,
  summary           TEXT NOT NULL,                -- 50-150 字
  branch_point      TEXT,                         -- 事例での ① 分岐点
  criteria          TEXT,                         -- 事例での ② 判断材料
  action_taken      TEXT,                         -- 事例での ③ アクション
  result            TEXT,                         -- 事例での ④ 結果・学習
  source_meeting_id TEXT,                         -- 出典 project_meeting_summaries.meeting_id
  source_url        TEXT,
  llm_model         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (protocol_id, project_id, occurred_on)
);
```

### `l2_extract_state` (共通)
[member_knowledge.md](member_knowledge.md) 参照。

---

## UI (Phase 4.5)

| ファイル | 役割 |
|---|---|
| [pwa/src/app/(app)/admin/protocols/page.tsx](../src/app/(app)/admin/protocols/page.tsx) | server page。protocols + projects + protocol_examples を fetch、examples を protocol_id 単位で集約して Client に渡す |
| [pwa/src/components/admin/AdminProtocolsClient.tsx](../src/components/admin/AdminProtocolsClient.tsx) | クライアント側 UI: 4 要素ステップカード + 関連事例リスト + 4 アクション |
| [pwa/src/components/notifications/NotificationsClient.tsx](../src/components/notifications/NotificationsClient.tsx) | l2_kind='protocols' 通知の詳細を展開。**逆引きは protocol_examples 経由** (`project_id=target_id AND occurred_on ∈ ym 範囲` で protocol_id 集合 → protocols + 関連 examples を表示)。2026-05-20 以降の通知は `scope_key=YYYYMM:protocol:<protocol_id>` なので、個別 protocol_id まで絞り込む。旧 schema (`p4-{pj}-{ym}-*`) の LIKE 検索は Phase 4.5 で機能しなくなり 0 件返してたバグを修正 (2026-05-13) |

**通知粒度 (2026-05-20)**:
- 以前: `project_id + ym` で複数 candidate を1通知に集約
- 現在: `project_id + YYYYMM:protocol:<protocol_id>` で 1 candidate = 1 通知
- 目的: まさが「はい・反映」「いいえ・不採用」「コメント」を候補ごとに返せるようにする
- feedback 取り込み: 月次抽出時は `scope_key=YYYYMM` に加えて `YYYYMM:protocol:*` の個別 feedback も LLM プロンプトへ入れる

**展開時 UI 仕様**:
- 4 要素ステップカード (色分け + アイコン):
  - 🔀 ① 分岐点 (青 `bg-blue-50`)
  - 📊 ② 判断材料 (橙 `bg-amber-50`)
  - 🎯 ③ アクション (緑 `bg-emerald-50`)
  - 💡 ④ 結果・学習 (紫 `bg-violet-50`)
  - `parseFourElements(content)` で `**① 分岐点**:` 等の見出しから自動分解
- 📂 関連事例リスト (= protocol_examples):
  - 各事例: `日付` + `project_id` + `summary` + 折りたたみで「事例の 4 要素」詳細
- 4 アクション:
  - ✅ **確定** (status='confirmed') — まさが正式プロトコルに昇格
  - 🔄 **修正依頼** — つくよみ chat drawer を起動して該当 protocol を prefill (= window.dispatchEvent)
  - ❌ **却下** (status='rejected') — プロトコルとして不適格
  - 📥 **archive** (status='archived')

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
- **重複防止 (Phase 4.5)**: `protocol_id = "p4u-{sha12(title)}"` で **PJ 横断で同タイトル = 同 ID** (= 普遍プロトコル化)
  - 旧形式 (`p4-{projectId}-{ym}-{sha8(title)}`) は kind='legacy_specific' で残存、UI で別セクション表示すべき (Phase 4.5 残タスク)
- **source='l2_hourly_extract' / status='candidate'**: Phase 4 cron 由来は candidate で入る → まさが UI で confirmed 昇格 (✅ 確定ボタン実装済) / rejected (❌ 却下) / archived (📥)
- **maxItems 4**: 1 cron あたり LLM call 4 件
- **重要度フィルタ**: LLM プロンプトで「月次の最重要 1-3 件」と制限。瑣末な決定は含めない方針
- **★ AGENTS ルール完遵**: LLM プロンプト本文は `llm_prompts.protocol.extract` (is_active=TRUE) 必須。gas/155 の hardcoded fallback は廃止 (2026-05-11)。まさが /admin/prompts で UI 編集可能
- **★ 「単純な事実」(設立日 / 終了日 / 氏名 / 資金調達額) はプロトコルにしない**: 抽出プロンプトで明示。これらは `project_knowledge.basic_fact` に分類 (= `sync-pj-facts` cron で project_ventures から同期)

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | Phase 4 初版稼働。GAS 155 で毎時 polling + source_hash 差分検知 + 二次集約 (project_meeting_summaries → Gemini → upsert)。UI は既存活用 |
| 2026-05-11 | **Phase 4.5: 普遍プロトコル + 1:N 事例構造に移行**。protocol_id を `p4u-{sha12(title)}` に変更、project_id=null、examples を protocol_examples に分離。LLM プロンプトをコード排除 + DB 必須化 (AGENTS ルール完遵)。UI 大改修: 4 要素ステップカード + 関連事例リスト + 4 アクション (✅確定 / 🔄修正依頼 / ❌却下 / 📥archive)。migration 049 (protocol_examples) + 050 (UNIQUE 制約)。**事故**: 既存 13 件を一括 archive にしたら UI 「確定ボタンだけ」表示になった → candidate に戻して復旧 ([BUGS.md](../BUGS.md) 参照) |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`meeting_summaries.md`](meeting_summaries.md) — ⑥ MTGサマリ (本 cron の主入力源)
- [`member_knowledge.md`](member_knowledge.md) / [`project_knowledge.md`](project_knowledge.md) — Phase 4 姉妹
- [`../../../knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) — AMDプロトコルの経営思想
