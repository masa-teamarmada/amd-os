# MTG サマリ — 設計の正本

作成: 2026-05-08
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

PJ コックピット (`/project/[projectId]/cockpit`) の **MTGサマリ枠** に「定例MTG各回のサマリを時系列で並べる」機能の仕様。

- データソース: Notion 議事録 DB (1ページ = 1回の MTG)
- 抽出: GAS の daily cron が各議事録ページごとに Gemini で `summary_short` + `decided / progress / nextActions / risks` を生成
- 保存: Supabase の新テーブル `project_meeting_summaries`
- 表示: PWA の `CockpitMeetingSummary` が Supabase を直読み

このドキュメントは **PWA / GAS / Supabase 横断の正本**。GAS 別セッションもここを正本として実装する。

---

## 大方針 (重要 — 設計判断)

**現状**: GAS の `nav_repo_makeMonthlyExtractDraft_` ([gas/073_NavigatorRepo.js:505](../../gas/073_NavigatorRepo.js)) が daily cron (毎日 03:00 JST、[gas/152_NavigatorCron.js:22](../../gas/152_NavigatorCron.js)) で:
- PJ の Notion 議事録を当月分まとめてテキスト連結
- LLM 1発で月単位のフラットな items を抽出 (`itemType: decided / progress / nextAction / risk` × 月内全部混在)
- 保存先は GAS スプシの `DB_NavigatorMonthlyItems` のみ (Supabase 未到達)

**問題**: 月単位フラット抽出のため「**どの items がどの回で出たか**」が紐付かない。MTG サマリの要件 (各回ごとに `decided/progress/nextActions/risks` を表示) と構造が合わない。

**新方針**: **抽出を「会議単位」に作り変える**。Monthly Report は会議サマリの集約結果として組み立てる。

```
新パイプ (daily cron):
  Notion 議事録ページ 1個
    ↓ source_hash で差分検知 (本文ハッシュが変わってなければスキップ)
    ↓ Gemini Flash 1発 (会議単位)
  { summary_short, decided[], progress[], nextActions[], risks[] }
    ↓
  Supabase: project_meeting_summaries に upsert
    ↓
  集約 → monthly_reports に書き込み (R313 系の生成ロジックは「会議サマリの集約」に書き換え)
```

**メリット**:
- 会議とのひも付けが構造的に正しい
- `source_hash` で差分検知できるので、daily 実行でも実 LLM コール数は最小 (議事録未更新なら呼ばない)
- monthly_report は集約結果になり、議事録から直接生成しなくて良い (整合性が保たれる)
- PWA は `project_meeting_summaries` を直読みするだけ

**デメリット (受容)**:
- LLM コール回数は会議数ぶんに増えるが、差分検知で最小化
- GAS 側の大改修 (本体GAS の `nav_repo_makeMonthlyExtractDraft_` 系 + AMD-Report GAS の R313 系)
- 過去議事録ぶんは初回バックフィル必要 (one-time 関数)

---

## データフロー

```
[Notion 議事録 DB]
    │  PJ プロパティ (relation) で PJ resolve
    │  日付プロパティで yyyymm フィルタ
    ↓
[GAS 本体 daily cron 03:00 JST]
    nav_cronMonthlyExtractAt3 (152_NavigatorCron.js)
    対象: DB_Projects の status=active/frozen
    │
    │ for each PJ:
    │   for each 議事録ページ in 当月内:
    │     1. 本文取得 (Notion blocks API)
    │     2. source_hash = sha256(本文)
    │     3. project_meeting_summaries に同 meeting_id があり source_hash 同じならスキップ
    │     4. Gemini Flash に渡して { summary_short, decided[], progress[], nextActions[], risks[] } 取得
    │     5. project_meeting_summaries に upsert
    │
    ↓
[Supabase: project_meeting_summaries]
    │
    ↓
[GAS AMD-Report daily cron 05:00 JST]
    R313_MonthlyReport_Cron
    │ for each PJ:
    │   project_meeting_summaries から当月分を会議日付順に取得
    │   集約して monthly_reports.draft_content / final_content を組み立て
    ↓
[Supabase: monthly_reports]  (PWA の月次レポート画面はそのまま)

[PWA]
  CockpitMeetingSummary が Supabase project_meeting_summaries を直読み
```

---

## Supabase スキーマ

```sql
-- pwa/scripts/migrations/024_project_meeting_summaries.sql

CREATE TABLE IF NOT EXISTS project_meeting_summaries (
  meeting_id          TEXT PRIMARY KEY,           -- Notion page id (UUID 形式、hyphen 含)
  project_id          TEXT NOT NULL,              -- AMD projectId (例: "tiem", "bwe")
  ym                  TEXT NOT NULL,              -- yyyymm (例: "202604")
  meeting_date        DATE NOT NULL,              -- Notion 日付プロパティ
  meeting_start_at    TIMESTAMPTZ,                -- カレンダーから取れれば (任意)
  title               TEXT NOT NULL,              -- Notion ページタイトル
  notion_url          TEXT,                       -- Notion ページ URL
  calendar_event_id   TEXT,                       -- BillingLite meetingEventId 経由で逆引き (任意)

  summary_short       TEXT NOT NULL DEFAULT '',   -- 1〜2 行の要約 (Gemini)
  decided             JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]: 決定事項
  progress            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]: 進捗
  next_actions        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]: 次アクション
  risks               JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]: リスク

  source_hash         TEXT,                       -- Notion 本文の sha256 (差分検知)
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_model  TEXT,                       -- 例: "gemini-2.0-flash"

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_project_date
  ON project_meeting_summaries(project_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_pms_project_ym
  ON project_meeting_summaries(project_id, ym);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION trg_pms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pms_updated_at ON project_meeting_summaries;
CREATE TRIGGER pms_updated_at
  BEFORE UPDATE ON project_meeting_summaries
  FOR EACH ROW EXECUTE FUNCTION trg_pms_updated_at();

-- RLS: 認証済みユーザーは read 可、書き込みは service_role のみ
ALTER TABLE project_meeting_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY pms_read_authenticated
  ON project_meeting_summaries
  FOR SELECT
  TO authenticated
  USING (true);

-- service_role は RLS をバイパスするので明示 policy 不要
```

### カラム設計の意図

- **meeting_id = Notion page id**: 1議事録 = 1MTG。meeting_id をそのまま PK にすることで upsert がシンプル
- **decided / progress / next_actions / risks は JSONB の string[]**: items の数は会議によって 0〜10 程度、配列のまま入れる方がクエリも UI もシンプル。テーブル分割するほどの構造化は不要
- **source_hash**: 差分検知の正本。Notion 本文の sha256。GAS cron がこれをチェックして同値ならスキップ
- **calendar_event_id (任意)**: 将来「Calendar の MTG とこのサマリを紐付けたい」要件が出たとき用の予約席

---

## GAS 側仕様 (別セッションで実装)

### 改修ファイル

| ファイル | 改修内容 |
|---|---|
| [gas/073_NavigatorRepo.js](../../gas/073_NavigatorRepo.js) | `nav_repo_makeMonthlyExtractDraft_` を会議単位抽出に書き換え。月単位フラット items 生成は廃止 |
| [gas/092_AdminLLMExtractors.js](../../gas/092_AdminLLMExtractors.js) | Protocol Store の prompt を新規 `meeting_extract` として登録 (既存 `navigator_extract` は当面残しつつ非推奨マーク) |
| AMD-Report GAS の R313_MonthlyReport_Cron | `monthly_reports` の組み立てを `project_meeting_summaries` 集約に書き換え |
| 新規: `gas/801_OneTimeFunctions.js` または別 800 番台 | 過去議事録の初回バックフィル one-time 関数 |
| 新規: Supabase 書き込み helper | service_role キーで `project_meeting_summaries` に upsert する関数 |

### Gemini プロンプト仕様 (Protocol Store: `meeting_extract`)

入力: 1回の MTG 議事録ページ本文 (Notion 「内容」プロパティ + blocks API 補完)
出力: 厳密 JSON。前後の文章禁止。

```json
{
  "summary_short": "2 行以内、80 字以内。会議の要点を一言で。",
  "decided":      ["決まったこと 1〜3 行で1件、最大5件"],
  "progress":     ["進んだこと 1〜3 行で1件、最大5件"],
  "next_actions": ["次やること (担当者/期限が読み取れるなら含める) 最大5件"],
  "risks":        ["リスク・詰まり・未解決事項 最大5件"]
}
```

ルール:
- 入力に書かれてない推測は禁止
- 感想・雑談・抽象論・願望は捨てる
- 重複する内容はまとめる
- どのフィールドも items が無ければ空配列 `[]` を返す
- LLM 失敗時 (JSON パース不可) は前回の値を維持し、`generated_at` は更新しない

プロンプト本文は Protocol Store の `DB_LLMExtractorConfig` の name=`meeting_extract` レコードに格納する (gas/CLAUDE.md ルール「LLM プロンプトはコードに書かない」遵守)。

### 差分検知ロジック

```
for each Notion 議事録ページ:
  notionContent = fetch_notion_content(pageId)        // 「内容」+blocks
  newHash = sha256(notionContent)

  existing = supabase.select('source_hash, generated_at')
                     .from('project_meeting_summaries')
                     .where(meeting_id = pageId)

  if existing && existing.source_hash === newHash:
    continue  // 何も呼ばない

  result = gemini_extract(notionContent)              // 失敗時は continue
  supabase.upsert('project_meeting_summaries', {
    meeting_id: pageId,
    project_id, ym, meeting_date, title, notion_url,
    summary_short: result.summary_short,
    decided: result.decided,
    progress: result.progress,
    next_actions: result.next_actions,
    risks: result.risks,
    source_hash: newHash,
    generated_at: now(),
    generated_by_model: 'gemini-2.0-flash'
  })
```

### 対象 PJ

`nav_cron_listTargetProjectIds_` ([gas/152_NavigatorCron.js](../../gas/152_NavigatorCron.js)) と同じ — `DB_Projects.status` が `active` または `frozen`。

### 対象期間

cron 実行時点の **当月** + **前月** (前月の議事録が後から修正されることがあるため)。
バックフィルは one-time 関数で過去全期間を埋める。

### Supabase 書き込みの認証

- `service_role` キーを ScriptProperties に追加: `SUPABASE_SERVICE_ROLE_KEY`
- 既存の Supabase 連携 helper を流用 (無ければ新規作成)
- Supabase URL は ScriptProperties: `SUPABASE_URL` (既存)

---

## PWA 側仕様

### 改修ファイル

| ファイル | 改修内容 |
|---|---|
| [pwa/scripts/migrations/024_project_meeting_summaries.sql](../scripts/migrations/) | 新規 (上記スキーマ) |
| [pwa/src/lib/supabase-data.ts](../src/lib/supabase-data.ts) | `fetchProjectMeetingSummaries(projectId, opts)` 追加 |
| [pwa/src/components/cockpit/CockpitMeetingSummary.tsx](../src/components/cockpit/CockpitMeetingSummary.tsx) | 全面書き換え (`source_cache` から `project_meeting_summaries` へ、UI 仕様も更新) |

### `fetchProjectMeetingSummaries` シグネチャ

```ts
export interface ProjectMeetingSummary {
  meetingId: string;
  projectId: string;
  ym: string;
  meetingDate: string;        // ISO date "YYYY-MM-DD"
  meetingStartAt: string | null;
  title: string;
  notionUrl: string | null;
  calendarEventId: string | null;
  summaryShort: string;
  decided: string[];
  progress: string[];
  nextActions: string[];
  risks: string[];
  generatedAt: string;
  generatedByModel: string | null;
}

export async function fetchProjectMeetingSummaries(
  projectId: string,
  opts?: { sinceDate?: string; limit?: number }
): Promise<ProjectMeetingSummary[]>;
```

### `CockpitMeetingSummary` UI 仕様

**配置**: `CockpitView` の現状の `[G/E]` 枠 (cockpit.md の構造図参照)。場所は変えない。

**初期表示 (直近1年)**:
- 今日から 365 日前まで `meeting_date >= today - 365d` のサマリを取得
- `meeting_date DESC` で降順ソート
- 月でグルーピング (例: `2026年4月` のヘッダ → 4月の MTG が縦に並ぶ)

**過去ぶん表示**:
- セクション末尾に `▼ それより前を表示` トグル
- 押下で 1 年より前の全件を追加ロード

**1行レイアウト (折りたたみ時)**:
```
4/22 (火) 14:00  ティエム定例
  └ summary_short (1〜2 行、line-clamp-2)
```

**展開時 (行クリックで開閉)**:
```
4/22 (火) 14:00  ティエム定例                                        [Notion で開く ↗]
  📝 summary_short

  ✅ 決まったこと
    • 量産ライン X 工程の歩留まり改善案を Y で進める方針確定
    • ...
  📈 進んだこと
    • ...
  🎯 次やること
    • ...
  ⚠️ リスク
    • ...
```

各セクションは items が空なら非表示。Notion リンクがあれば右上にボタン。

**空状態**:
- 議事録が 1 件もない PJ: 「議事録データなし」表示 (現状と同じ)
- ロード中: スピナー or 「読み込み中…」テキスト

**スタイル**:
- 既存 Apple-ish デザイン踏襲 (`bg-white`, `rounded-xl`, `border-[#e5e5e7]`, 13px/12px/11px の階層)
- 月ヘッダは `text-[12px] font-medium text-[#86868b]` でセクション区切り

---

## 実装順序

1. **本セッション** (PWA worktree):
   - 本仕様 md 作成 (このファイル)
   - `pwa/design/README.md` の「テーマ別」表に追加
   - `gas/CLAUDE.md` に「MTG サマリ cron 仕様: pwa/design/meeting_summaries.md 参照」を追加
   - migration `024_project_meeting_summaries.sql` 作成 + apply_ddl.py で本番適用
   - `fetchProjectMeetingSummaries` を supabase-data.ts に追加
   - `CockpitMeetingSummary.tsx` を新方針で書き換え (空テーブルでも UI が壊れない実装)
   - tsc → commit → push → Vercel deploy
   - **この時点の挙動**: テーブルは空なので「議事録データなし」表示。GAS が書き込み始めたら自動で出る

2. **GAS 別セッション** (本仕様 md を見ながら実装):
   - Protocol Store に `meeting_extract` プロンプト登録
   - Supabase 書き込み helper 用意 (`SUPABASE_SERVICE_ROLE_KEY` 設定)
   - `nav_repo_makeMonthlyExtractDraft_` を会議単位抽出に書き換え
   - 当月+前月だけ daily 抽出 (差分検知あり)
   - one-time 関数で過去議事録バックフィル
   - R313 を集約に書き換え

3. **GAS 完了後**:
   - PWA で表示確認
   - 不具合あればこの仕様 md を更新

---

## 既知の制約・運用上の注意

- **議事録未作成回**: Notion議事録が無い MTG はこの機能では出てこない。Notion議事録を書く運用は別途まさが管理
- **PJ resolve 失敗**: 議事録の「PJ」relation が空 / 不明なページは抽出スキップ ([gas/073_NavigatorRepo.js:1909 nav_repo_notion_collectMinutesTextForProject_](../../gas/073_NavigatorRepo.js) の resolveProjectIdFromPjRelation_ ロジックを流用)
- **古い議事録の再抽出**: source_hash が変われば再抽出される。LLM 出力が前より悪い結果になる可能性は受容 (前回値を保持しない方針 — 「最新が真実」)
- **Gemini レート / クォータ**: daily で会議数ぶんコールするが、まさのアカウントは余裕あり (本人言)。差分検知で更にコール数は最小化される

---

## 反映状況 (append-only)

| 日付 | 範囲 | commit / 状態 |
|---|---|---|
| 2026-05-08 | 仕様 md 初版作成 (PWA 担当セッション) | (TBD: 本セッションの commit hash) |
| TBD | PWA UI 実装 + migration 適用 | (TBD) |
| TBD | GAS 側実装 | (GAS 別セッション) |
