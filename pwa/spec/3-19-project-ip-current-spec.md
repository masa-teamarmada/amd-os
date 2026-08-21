# 3-19 PJ知財ポートフォリオ (知財タブ) — current spec

> 正本。PJコックピットの「知財」タブと `project_ip_*` 4テーブルの現行仕様。
> 使い方は [`manual/2-3-pj-cockpit.md`](/manual/2-3-pj-cockpit) の「知財タブ」節。
> 追加: 2026-08-21 (build v3.85.0) / migration `scripts/migrations/308_project_ip_ledger.sql`

## 1. 目的とスコープ

AMDはbefore zeroから入るので、知財の見方は「自社が何を出願したか」では足りない。
**その技術領域の権利地図全体** — 大学の基本特許、共同出願、他社の障害特許、監視対象 — を
同じ台帳に載せ、参入可否・ライセンス交渉・回避設計の判断材料にする (まさ確定 2026-08-21、スコープB)。

`project_ip_assets.relation` がその立場を表す唯一の軸:

| relation | 意味 | 色 |
|---|---|---|
| `own` | AMD / PJ法人が保有・出願中 | 緑 |
| `university` | 大学の基本特許 (実施許諾・不実施補償の交渉対象) | 青 |
| `joint` | 共同出願 | 紫 |
| `blocking` | 他社が押さえていて回避 or ライセンスが要る障害特許 | 赤 |
| `watch` | 競合動向として監視するだけ | 灰 |

## 2. データモデル

列の正本は [`design/db_schema.md`](../design/db_schema.md)。ここは役割だけ書く。

| table | PK | 役割 |
|---|---|---|
| `project_ip_assets` | `ip_asset_id` (`ipa_*`) | 権利1件。番号・日付・出願人・IPC/CPC・立場・技術区分・権利範囲・重要度・脅威度 |
| `project_ip_deadlines` | `ip_deadline_id` (`ipd_*`) | 審査請求・PCT国内移行・優先権・拒絶理由応答・年金などの期限 |
| `project_ip_rights` | `ip_right_id` (`ipr_*`) | 権利者・持分・実施許諾状態・契約状態・不実施補償。`contract_id` で `contracts` に接続 |
| `project_ip_events` | `ip_event_id` (`ipe_*`) | 出願/公開/拒絶理由/応答/登録/譲渡/年金納付などの経緯 |

特許マップ用の軸に使う列 (別データモデルを作らず assets から描く):

| 用途 | 列 |
|---|---|
| X軸 (技術区分) | `tech_domain` (未入力は「未分類」) |
| Y軸 (権利の広さ) | `claim_breadth` 1〜5 |
| 色 | `relation` |
| 大きさ | `importance` 1〜5 |
| 出願人マトリクスの行 | `applicants[0]` |
| 時系列マップのX軸 | `application_date` (無ければ `publication_date`) の年 |

`source_kind` は `manual` / `l2_extraction` / `jpo_api` / `epo_api`。外部同期分は `external_raw` に
生レスポンスを保持し、`external_sync_at` に同期時刻を残す (外部API連携は未接続、下記5)。

RLS は3ポリシー規約どおり (`_member_read` = `amd_os_is_member()` / `_admin_all` = `is_admin()` / `_service_role`)。
`(project_id, jurisdiction, application_number)` に部分unique indexを張り、同一出願の二重登録を防ぐ。

## 3. API — `/api/project-ip`

`runtime = "nodejs"`。

| method | 認可 | 動作 |
|---|---|---|
| `GET ?projectId=` | `requireAuth()` | `{ ok, canEdit, assets, deadlines, rights, events }`。`canEdit` は `members.is_admin` を email (小文字) 一致で引いた結果。rights は該当assetがある時だけ `in(ip_asset_id, …)` で取る |
| `POST { entity, row }` | `requireAdmin()` + `createAdminClient()` | PKを `<prefix>_<uuid12>` で自動採番。asset/deadline/event は `project_id` 必須、asset は `title` 必須。`created_by`/`updated_by` にログインemailを刻む |
| `PATCH { entity, id, patch }` | 同上 | PKはpatchから除去。`updated_at` を更新 (eventは除く) |
| `DELETE ?entity=&id=` | 同上 | 物理削除 |

`entity` は `asset` / `deadline` / `right` / `event`。

## 4. UI

- 実体: [`src/components/cockpit/CockpitIpPortfolio.tsx`](../src/components/cockpit/CockpitIpPortfolio.tsx) / 特許マップは [`PatentMap.tsx`](../src/components/cockpit/PatentMap.tsx) / 型とラベルは [`src/lib/project-ip.ts`](../src/lib/project-ip.ts)
- タブ配線: `CockpitView.tsx` の `CockpitTab` union と `tabs` 配列 (= 正本)、URL同期は `cockpit/page.tsx` の `NON_DEFAULT_TABS`。URLは `?tab=ip`
- 構成: サマリ帯 (立場別件数 + admin の「＋追加」) → ⏰期限 → 🗺️特許マップ → 立場別リスト (自社・共同 / 大学 / 障害・ウォッチ) → 詳細モーダル
- 期限の色: 超過と30日以内は赤、90日以内は琥珀、それ以外は灰
- 詳細モーダル: 全項目 + 期限 (adminは「完了にする」) + 権利者・ライセンス + 経緯 + 外部リンク。JPは J-PlatPat、他国は Espacenet を番号で検索 (`externalSearchUrl()`)
- 編集フォームは `canEdit` の時だけ出る。一般メンバーは読み取りのみ

### 特許マップの3ビュー

| view | X | Y | 読み方 |
|---|---|---|---|
| 権利範囲マップ (既定) | 技術区分 | `claim_breadth` 5→1 | 上側に赤 (障害特許) がある技術区分は before zero の要注意ゾーン |
| 時系列マップ | 出願年 | 技術区分 | どの技術区分がいつ混み始めたか |
| 出願人マトリクス | 技術区分 | 出願人 | 誰がどの領域を押さえているかの件数ヒートマップ |

凡例チップで relation ごとの表示/非表示を切り替える。バブルのクリックで詳細モーダルを開く。
このマップは OS 内の対話ビューなので matplotlib ではなく SVG/React で描く (静的プロット図とは別)。

## 5. 未接続 (次の一手)

| 項目 | 状態 |
|---|---|
| 特許庁 特許情報取得API (ip-data.jpo.go.jp) 同期 | 未接続。利用者登録が必要 (無料・試行提供、~400件/日、法人800件/日)。申請内容はまさへ提示してから出す |
| EPO OPS v3.2 同期 | 未接続。OAuth2 Consumer Key/Secret の登録が必要 (無料枠 ~4M req/月、書誌 + worldwide legal status + INPADOCファミリ) |
| 期限通知 | 未接続。`project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線する |
| `/admin/ip` の AMD 自社知財統合 | 未着手。`src/app/(app)/admin/ip/ip-report.ts` の静的レポートを p00 の資産として台帳へ載せる (まさ確定「載せる」) |
