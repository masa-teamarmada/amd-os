# 要対応案件 + 株主・ガバナンス・保有株式 (Action Items & Governance/Cap-table) 設計

**ステータス**: 実装中 (2026-06-15 起票・まさ承認)。DDL は migration `137_governance_and_action_items.sql` (136 は別セッションの tasks 拡張が先取りしたため 137 に採番)。

### 既存 `tasks` 機能との境界 (重要)

`tasks` テーブル拡張と `/tasks` (mindmap/gantt/kanban) は過去に実装されたが、`/tasks` 画面は 2026-06-21 に廃止済み。**`action_items` はこれと別物**として持つ:

| | `tasks` | `action_items` (本設計) |
|---|---|---|
| 性質 | 人が手で作る PJ プランニング (mindmap/gantt) | 5生データから**自動抽出**する inbound 義務 |
| project_id | 必須 | NULL 可 (personal / company scope) |
| 重複排除 | なし | `source_hash` |
| 採否ループ | なし | `review_status` candidate→confirm/reject |
| 固有列 | mindmap 座標 / parent | `action_url` / `due_at`(精密) / `responded_at` / nudge |

→ `tasks` を壊さず、廃止済み `/tasks` の手動プランニングとは別レーン。将来 action_item を task に「昇格」する導線は後続検討。

---

## 1. 背景 — なぜ作るか

起点は、2026-05-28 着の Gmail「[要対応] 株式会社JOYCLE から山地正洋様に臨時株主総会の招集通知」が **OS に一切抽出されていなかった** こと。実物を追うと:

- 5/21 [要対応] 事前承諾依頼 (株主間契約に基づく重要事項、提出期限 6/4)
- 5/28 [要対応] 臨時株主総会 招集通知 (開催 6/5 13:00、委任状期限 6/5)。議案は **JOYCLE の優先株2ndラウンド調達**(募集株式総数引受契約・優先投資契約2nd・株主間契約参加契約2nd・分配合意2nd・AAA種/AA種合意・決算書)
- 6/3 まさが委任状提出 (控え着) → 期日は手動でクリア済

まさは退任済だが **JOYCLE の株主として残っている**。そして JOYCLE は AMD 離脱後に Toyota Woven City Challenge 採択 + 2ndラウンド調達と伸びている (現 `knowledge/jc.md` の「リバウンド失敗」記述は要更新)。

### 取りこぼした 3 つの構造的穴

1. **取り込み**: Gmail 抽出は `projects.report_emails` マッチ + active/進捗PJ中心。送信元 `noreply@smartround.com` は JC の report_emails に居らず、JC は終了PJ(p09)。全フィルタをすり抜け `source_cache` の痕跡すら残らない。
2. **分類**: 「期日付き要対応」「株主総会/議決権/事前承諾」を入れる L2 種別が無い。`l2_notifications` に `due_at` 列も無い。MTG限定の `meeting_action_items` のみ。
3. **受け皿**: cockpit に株主・ガバナンス・保有株式の欄が無い。**「終了PJ × まさ個人の equity × 期日」象限が OS に存在しない**。`L2_DATA.md:170` は既に「ended でも清算・株主総会等は残す」と明言済 = これは新思想ではなく**未実装の設計意図**。

### まさの確定スコープ (2026-06-15)

> フル実装してほしいし、そもそも「ガバナンス／法務」に限定せずに要対応案件の抽出はしてほしい。それと各案件の株主情報、総会開催履歴、決議内容なども記録しておく場所が必要。あと現在保有している各案件の株式の情報やバリュエーション情報も必要。

→ 4 本柱: (A) 汎用 要対応抽出 (B) 株主情報 (C) 総会開催履歴・決議 (D) AMD/まさ保有株式・バリュエーション。フル実装。

---

## 2. データモデル (新規 4 テーブル)

OS に equity / cap table / valuation / 汎用 action item テーブルは **存在しない** (調査 2026-06-15: `seed_funding.amount_jpy` と `vc_investments` のみ)。よって全て新規。

### 2.1 `action_items` — 汎用「要対応」(期日つき)

`meeting_action_items` (MTG内限定) とは別の、**5生データ + 手動由来の inbound 義務**を期日管理する第一級テーブル。

| 列 | 型 | 用途 |
|---|---|---|
| `action_id` | text PK | `ai:<source_hash 先頭>` |
| `project_id` | text NULL (FK projects) | 紐づくPJ。NULL = 会社/個人案件 |
| `scope` | text NOT NULL default `'project'` | `project` / `company` / `personal` |
| `category` | text | `governance` / `legal` / `finance` / `contract` / `hr` / `tax` / `admin` / `other` |
| `title` | text NOT NULL | 件名 |
| `summary` | text | 要約 (全文保存しない) |
| `due_at` | timestamptz NULL | 対応期限 |
| `status` | text NOT NULL default `'open'` | `open` / `in_progress` / `responded` / `done` / `expired` / `dismissed` |
| `priority` | text | `critical` / `high` / `medium` / `low` |
| `action_url` | text | 対応リンク (smartround 等) |
| `assignee_member_id` | text NULL | 既定 まさ |
| `source` | text | `gmail` / `drive` / `calendar` / `slack` / `notion` / `manual` |
| `source_ref` | text | gmail thread id / URL |
| `source_hash` | text UNIQUE | 重複排除キー |
| `detected_at` | timestamptz | 抽出時刻 |
| `responded_at` | timestamptz NULL | 対応完了時刻 |
| `response_note` | text | 何をしたか (例: 委任状提出) |
| `scheduled_nudge_at` | timestamptz NULL | 次リマインド時刻 |
| `last_nudged_at` | timestamptz NULL | 最終リマインド |
| `review_status` | text default `'candidate'` | 採否ループ: `candidate` / `confirmed` / `rejected` |
| `metadata_json` | jsonb | 添付・原文 snippet 等 |
| `created_by` / `updated_by` / `created_at` / `updated_at` | | |

### 2.2 `project_shareholders` — 株主 / キャップテーブル

各PJの株主構成。AMD/まさの保有株式もここに 1 行として持つ (holder_type で区別)。

| 列 | 型 | 用途 |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | text NOT NULL (FK) | |
| `holder_type` | text | `amd` / `masa` / `founder` / `vc` / `angel` / `employee` / `other` |
| `holder_name` | text NOT NULL | 株主名 |
| `holder_member_id` | text NULL | AMD member の場合 `members.member_id` |
| `share_class` | text | `普通株` / `優先株AAA種` / `優先株AA種` / `優先株2nd` 等 |
| `shares` | bigint NULL | 株数 |
| `ownership_pct` | numeric(6,3) NULL | 持株比率% |
| `invested_yen` | bigint NULL | 出資額 |
| `as_of_ym` | text | 時点 (YYYYMM) |
| `is_current` | boolean default true | 現在有効な行か |
| `source_ref` | text | 根拠 |
| `notes` | text | |
| `created_at` / `updated_at` | | |

### 2.3 `project_valuation_rounds` — 資金調達ラウンド / バリュエーション

| 列 | 型 | 用途 |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | text NOT NULL (FK) | |
| `round_name` | text | `Seed` / `優先株2nd` / `AAA種` 等 |
| `round_date` | date NULL | |
| `round_ym` | text | |
| `pre_money_yen` | bigint NULL | |
| `post_money_yen` | bigint NULL | |
| `raised_yen` | bigint NULL | 調達額 |
| `price_per_share_yen` | numeric NULL | 1株単価 |
| `lead_investor` | text | |
| `source_ref` | text | |
| `notes` | text | |
| `created_at` / `updated_at` | | |

→ **保有株式の現在価値** = `project_shareholders`(holder_type in amd/masa) の `shares` × 最新 `price_per_share_yen`、または `ownership_pct` × 最新 `post_money_yen`。UI 側で算出 (テーブルに冗長保存しない)。

### 2.4 `project_shareholder_meetings` — 総会/取締役会 開催履歴 + 決議

| 列 | 型 | 用途 |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | text NOT NULL (FK) | |
| `meeting_type` | text | `agm` 定時株主総会 / `egm` 臨時株主総会 / `board` 取締役会 |
| `meeting_date` | date | |
| `meeting_ym` | text | |
| `location` | text | |
| `agenda_summary` | text | 議案要約 |
| `resolutions_json` | jsonb | `[{title, type, result}]` 決議内容 |
| `amd_response` | text | `proxy` 委任状提出 / `attended` / `consented` 事前承諾 / `abstained` / `none` |
| `amd_response_at` | timestamptz NULL | |
| `related_action_id` | text NULL | `action_items.action_id` への論理リンク |
| `attachments_json` | jsonb | 添付資料リスト。Drive保存済みは `{name,url/webViewLink,drive_file_id,drive_folder_id,drive_folder_name,folder_display_path}`、候補段階は本文base64を残さず metadata のみ |
| `source_ref` | text | |
| `notes` | text | |
| `created_at` / `updated_at` | | |

### RLS 方針 (機密度が高いので標準形より厳しく)

cap table / valuation は最機密。標準 OS 形 (anon SELECT true) は**採らない**。

- `service_role` ALL (cron / API 書き込み経路)
- `is_admin()` ALL (管理 UI からの read/write)
- **anon / authenticated への付与なし** (= 一般メンバー・公開読み取り禁止)

cockpit のガバナンス欄・要対応面はサーバ側 admin クライアントで取得し、admin gate 配下でのみ表示する。

---

## 3. 取り込み (抽出) 設計

### 3.1 要対応スイープ

- **report_emails ゲートを外す**。件名/本文の語 + 既知ベンダー送信元で拾う。
  - 語: 招集通知 / 株主総会 / 臨時 / 定時 / みなし決議 / 書面決議 / 議決権 / 委任状 / 同意書 / 事前承諾 / 清算 / 解散 / 登記 / 締切 / 期限 / 要対応 / 振込 / 請求 / 更新期限 / 提出期限 など
  - ベンダー送信元: `smartround.com` / `everidays.com` / `cloudsign.jp` / `docusign.net` / `freee.co.jp` / `shareholder.jp` / `kabushiki-meibo.jp` / `stockmate.jp` 等 (= 2026-06-22 時点で `/api/cron/governance-email-sweep` 内 `VENDOR_SENDERS` に hardcode、次フェーズで `vendor_senders` 専用テーブルへ DB 化)
- **会社名 → PJ 紐付け (status フィルタなし)**: 本文/件名の会社名で `projects` を引く (JOYCLE→p09, BWE→p11)。**ended PJ も対象** (= まさは退任後も株主として残る、AMD は卒業 PJ の cap table 持分が残る)。**Codex automation `amd-os-l2-consolidated-evidence` の Phase 0 で取得した `allProjects` (status フィルタなしの全 PJ list) を使い、`activeProjects` を使わない**。紐づかない個人宛は `scope='personal'` / `project_id=NULL`。
- **期日抽出**: 「〜までに」「提出期限」「開催日時」から `due_at` を作る。
- 既存 5 生データ全部を対象にできる設計だが、**初手は Gmail** (この案件が Gmail 由来)。Drive/Calendar/Slack/Notion は同じ `action_items` に source を変えて流せる。
- 実行系: D 群 Claude routine (`amd-os-l2-consolidated-evidence`) に Phase として同居させるのが既定。LLM 従量を PWA cron で背景実行しない (L2_DATA 原則)。重複排除は `source_hash`。
- 採否ループ: 抽出は `review_status='candidate'` で作り、`/notifications` で confirm/reject。governance 系で期日が近いものは importance 高で通知。

### 3.2 株主/総会/バリュエーション

- **正本は admin 手動キュレーション** (まさ「記録しておく場所が必要」)。/admin に編集 UI。
- 抽出は**候補生成の補助**に留める: 招集通知メールから `project_shareholder_meetings` 候補 (種別/日付/議案/添付) と、ラウンド系議案から `project_valuation_rounds` 候補を作り、`/notifications` で承認 → 反映。cap table の株数/比率の自動確定はしない (PDF 依存・誤抽出リスク)。
- **2026-06-16 追加: `/admin/projects` の監視フラグ**。`projects.governance_watch_shareholder_meetings` (=「総会」) / `projects.governance_watch_board_meetings` (=「役会」) を持ち、ON の PJ だけ D-14G の Gmail sweep 対象にする。検索対象は当該 `projects.report_emails` との `from/to/cc` やりとり + ガバナンス keyword に限定する。`report_emails` が空の PJ はフラグONでも sweep skip。初期 ON は AMD 全体 (`p00`)、LST (`p07`)、CLG (`p24`)。**2026-06-22 追加 ON: BWE (`p11`、ended) — 第1回定時株主総会の同意書 (書面決議) 取りこぼし事故対応。ended でもガバナンス対象から外さない方針を明示**。今後、ended PJ に株主案件が残る場合は同様にフラグ ON にする (= 初期 ON list の `active のみ` 制約は無い)。
- **D-14G Governance Email Sweep**: `GET /api/cron/governance-email-sweep`。既定は `apply=false` で `/api/governance/extract` に候補投入し、`source_cache(source='gmail_governance')` に source ref / snippet / hash を残す。`apply=1` のときだけ canonical `project_shareholder_meetings` 反映 + 添付Drive保存まで進める。通常運用は候補優先、LST のように高確度で日付・種別・PJ が揃う場合だけ apply 実行する。
- **2026-06-16 追加: `/api/governance/extract`** が `project_shareholder_meetings` 候補の受け口。D-14/L3 collector が Gmail/Drive/Calendar 等から LST の取締役書面決議・株主総会招集通知・議案資料を見つけたら、この route に `items[]` を POST する。
  - 既定 (`mode` 未指定 / `apply=false`): `l2_coverage_gaps` に `proposed_target_l2='shareholder_meeting'` の review candidate として保存し、`l2_notifications` に「ガバナンス履歴候補」を出す。canonical row は汚さない。
  - 確認済み (`mode='apply'` or `apply=true`): `project_shareholder_meetings` に insert する。dedupe は `source_ref` 優先、無い場合は project/type/date/agenda の組み合わせ。
  - `meeting_type` は `agm` / `egm` / `board` に加えて、`board_written_resolution` / `shareholder_written_resolution` を受け付ける。DB列は text のままなので DDL 追加は不要。UI では「取締役会(書面決議)」等に表示する。
  - 添付資料は `attachments` / `attachments_json` に `{name,mime_type,content_base64}` または `{name,mime_type,data_url}` を入れて POST できる。`apply=true` では OS が Google Drive の当該 PJ folder (`projects.drive_folder_id`) 直下に `YYMMDD_会議名` folder を作成/再利用し、その中へ実ファイルを保存する。`meeting_name` があれば folder 名に使い、無ければ `meeting_type` から「取締役会書面決議」「定時株主総会」等を使う。
  - Drive保存後の `attachments_json` は clickable link (`url` / `webViewLink`) と Drive metadata (`drive_file_id`, `drive_folder_id`, `drive_folder_name`, `folder_display_path`) のみを保持する。本文base64や data URL はDBへ残さない。候補モードでは Drive write をしないのが既定で、必要時だけ `store_attachments=true` を明示する。
  - 既存の canonical row に資料だけ後付けしたい場合は、同じ `source_ref` で `apply=true` + `update_existing=true` + `attachments` を POST する。Drive 側は同じ会議folder内の同名ファイルを再利用し、OS row の `attachments_json` を更新する。

---

## 4. 表示 (fan-out)

1 通の価値を 1 箇所に押し込まず展開する。

| 出力先 | 内容 | 実装 |
|---|---|---|
| **PJ cockpit「株主・ガバナンス」欄** | 株主構成サマリ / **総会・取締役会履歴一覧** + 決議 / 最新バリュエーション / AMD保有株の現在価値。終了PJでも表示 | `CockpitGovernance.tsx` を Col2 (経営ハイライト下) に。admin gate |
| **cockpit「要対応」** | そのPJに紐づく `action_items` open を期日順 | cockpit 内の小欄 or Col3 |
| **/dashboard・/notifications「要対応(期日順)」面** | 全 `action_items` open を期日順 + あと何日。`scope=personal/company` 含む | `ActionItemsPanel` (dashboard) / 先頭 section (notifications) |
| **D-6 strategy signal** | 「JC 2ndラウンド + Woven City採択」等の軌跡シグナル候補 | 既存 `project_strategy_signals` candidate |
| **knowledge/jc.md** | 離脱後の JC 実態を反映 (別途) | md 更新 |
| **保有株式ダッシュボード (任意・後続)** | AMD/まさの全PJ保有を一覧 + 合計評価額 | `/admin/holdings` |

### リマインド

`action_items.due_at` を持つので、`tsukuyomi_nudge_queue` か専用 nudge で「あと N 日」を通知できる。これが「埋もれさせない」の機械的担保。

---

## 5. 実装フェーズ

1. **DB**: migration 136 適用 (非破壊migrationとして実装し、破壊的DDLは扱わない) → `dump_schema.py` で `db_schema.md` 再生成。
2. **手動投入**: JC の今回の総会 (egm 6/5)・委任状提出済 action item を実データで 1 件投入し cockpit に出す = 動く証拠。
3. **cockpit ガバナンス欄** + admin 編集 UI (`/admin/shareholders` 系) + API route。
4. **要対応面** (dashboard / notifications) + 期日リマインド。
5. **抽出スイープ** (Gmail → action_items candidate / governance meeting candidate、Claude routine or Codex collector 同居)。
6. **FEATURE_REGISTRY / cockpit.md / manual / db_schema.md / changelog 同期**。

## 6. 壊さないライン

- cockpit 3-column grid・経営ハイライト・MTGサマリ・月次カードの既存導線を削除しない (FEATURE_REGISTRY)。PM向け月次 step modal は再導入しない。
- `/notifications` の admin gate を外さない。
- cap table / valuation を anon 読み取りに晒さない (RLS)。

---

## 7. ラウンド明細 + 助成金 + 累計アピール数字 (2026-06-17 まさ依頼で追補)

起点: LST(p07) 今回ラウンド確定 (DG Daiwa 100M / Adlib Tech 20M / ごうぎん 30M, J-KISS)。「各ラウンドで発行した証券(プロダクト)種別」「投資家別内訳」「創業者シェアのラウンド推移」「各PJの受給中助成金」「AMD全体の累計調達額/助成金額 (営業アピール)」を OS に持たせる。

### 7.1 DDL (migration 143 / 144)

- **143**: `project_valuation_rounds` に `security_type`(発行証券種別 J-KISS/普通株/A種優先株 等)・`investors_json`(投資家別内訳 `[{name,amount_yen,security_type,units,tranche,lead,note}]`)・`status`(planned/committed/closed) を追加。`project_shareholders` に `round_id`(どのラウンド直後の cap table 断面か, nullable) を追加。
- **144**: `project_grants` 新規 (助成金/補助金/委託費)。`grant_name` / `agency`(交付元) / `grant_type` / `amount_yen`(採択額=アピール数字) / `disbursed_yen` / `status`(applied/adopted/active/completed/rejected/withdrawn) / `is_current` / `period_*_ym`。RLS は cap table と違い **authenticated SELECT 可** (メンバーが自PJの受給状況を見る)、write は admin/service。

### 7.2 表示・入力

| 出力先 | 内容 | 実装 |
|---|---|---|
| **PJ cockpit「株主・ガバナンス」欄** | ラウンドごとに 発行証券種別 chip + 投資家別内訳 (金額/トランシェ/Lead) + 状態。株主構成は is_current 断面。`as_of_ym` 断面が 2 つ以上なら **創業者シェア推移マトリクス** | `CockpitGovernance.tsx` (admin gate) |
| **PJ cockpit「助成金・補助金」欄** | 各PJの助成金一覧 (状態/名称/交付元/採択額/期間) + このPJの獲得累計。**メンバーにも表示** | `CockpitGrants.tsx` (`/api/grants` read=requireAuth) |
| **/admin/governance** | ラウンド add-form に 発行証券/状態/投資家内訳(`名前:金額:トランシェ:lead` を `/` 区切り) を追加。助成金 CRUD セクションを追加 | `AdminGovernanceClient.tsx` |
| **/dashboard 先頭カード** | AMD全体 **累計資金調達額** + **累計獲得助成金額** (営業アピール)。合計のみ (per-PJ cap table 内訳は出さない) | `FundingStatsCard.tsx` (`/api/funding-stats` service_role集計, read=requireAuth) |

### 7.3 J-KISS / 累計数字の注意

- **J-KISS は新株予約権** = 次の優先株ラウンドでの転換まで普通株 cap table の持株比率は未変動。LST の今回ラウンドでは founder/AMD/まさ の `ownership_pct` を勝手に動かさない (転換時に推移として記録)。pre/post-money・転換条件(評価上限/ディスカウント) は要記録欄。
- LST 今回ラウンド = 第1回J-KISS 120個 1.2億 (DG Daiwa 100M + Adlib 20M, 2026-06-16 取締役会書面決議で承認・まさ consented、定時株主総会 最終7/10 で発行決議) + 第2回 ごうぎん 30M (後続承認予定)。計 150M。
- 累計アピール数字は **OS に登録済みのラウンド/助成金の合計** = 過去案件の backfill が進むほど正確。未登録分は含まれない (カード下に明記、silent cap にしない)。

### 7.4 全案件 backfill (2026-06-17 並列リサーチ実施)

Drive + Web + AMD OS DB を全PJ横断で調査(subagent並列)し、出典の取れた助成金/調達を一括登録。捏造防止のため **出典が取れた金額のみ数値化、不確実は amount=null + notes**。融資(借入)・株式譲渡(exit)・設立資本金は除外。

- 登録時点の概算: **累計資金調達額 ≈ 74億円** (OQC 21.5 / CLG 19.8 / tiem 12.2 / MC 11.5 / LST 3.0 / CTB 2.5 / JC 1.53 / KT 1.5 / CCC 0.6)、**累計獲得助成金 ≈ 24.5億円** (LST 17 / CTB 3.3 / MC 1.65 / BWE 1.0 / SX 0.78 / ZMP 0.6 / VasculaX 0.17)。
- ダッシュボード `FundingStatsCard` は **累計 ⇄ PJ別内訳トグル**。`/api/funding-stats` は PJ別合計までを返し、cap table 内訳は返さない。
- backfill 投入は一回限り script `pwa/tmp/seed_grants_rounds.mjs` (tmp、commit対象外)。
- 注意/要確認: tiem 2018年4億は二次情報のみ(low)。CTB AMED 3億は社内認識値(公式per-company非開示)。BWE SIP7.5億はNIMS委託課題予算でBWE単独交付でないため amount=null。JC グローバルサウス補助金55.8MとZMP水素補助は applied(採択未確定)のため累計には非計上。VasculaX/CXは法人未設立でPI科研費・将来枠。p14 aerota は会社実体が中確度のため未登録。

## 8. 壊さないライン (追補分)

- `project_valuation_rounds` / `project_shareholders` の既存列・既存 admin-RLS を変えない (列追加のみ)。
- `CockpitGovernance` の admin gate を維持。`CockpitGrants` は read 開放だが write は admin。
- 累計数字 API (`/api/funding-stats`) は合計のみ返し、per-PJ の調達額・cap table 内訳を member に晒さない。
