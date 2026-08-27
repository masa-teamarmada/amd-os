# 3-19 PJ知財ポートフォリオ (知財タブ) — current spec

> 正本。PJコックピットの「知財」タブと `project_ip_*` 4テーブルの現行仕様。
> 使い方は [`manual/2-3-pj-cockpit.md`](/manual/2-3-pj-cockpit) の「知財タブ」節。
> 追加: 2026-08-21 (build v3.85.0) / migration `scripts/migrations/308_project_ip_ledger.sql`
> 更新: 2026-08-27 — p10 の台帳を J-PlatPat 照会で全面的に置き換えた (§6)

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

`project_ip_assets` は migration 311 で権利の現況列を追加した (まさ確定 2026-08-21)。
`priority_date` / `examination_requested_on` / `annuity_status` / `annuity_paid_through_on` /
`pct_status` / `pct_number` / `current_assignee` (text[]) / `practice_status` / `annual_cost_yen` /
`owner_member_id` / `attorney_firm` / `last_verified_on` / `family_size` / `citation_count`。
`annuity_status` / `pct_status` / `practice_status` は CHECK 制約つきで既定 `unknown`。
`(project_id, annuity_status)` の部分 index を `grace` / `lapsed` に張って、消滅しかけの権利を横断で拾えるようにしてある。
**「次にいつ払うか」のような期日は資産テーブルに持たせず `project_ip_deadlines` に置く** (二重の正本を作らないため)。

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
- **表示面は2つ。同じ `CockpitIpPortfolio` を共有し、知財タブの実装を面ごとに分岐させない**。
  - PJコックピット: `CockpitView.tsx` の `CockpitTab` union と `tabs` 配列 (= タブ配線の正本)、URLは `?tab=ip`
  - PJワークスペース (`/project/[projectId]/workspace`): `SxWeeklyControlDashboard.tsx` の `PROJECT_WORKSPACE_TABS` に `{ key: "ip", label: "知財" }`、URL hashは `#project-ip`。ワークスペース面は `.sx-management-workspace button { min-height/min-width: 44px }` でタッチターゲットを強制するため、パネル外箱に `sx-ip-portfolio` クラスを付け、`globals.css` の `.sx-management-workspace .sx-ip-portfolio button` でこの部分木だけ除外してコックピットと同じ密度を保つ
  - 外部ワークスペースアカウント (`principal: "workspace_account"`) は `SxWeeklyControlDashboard` 自体をレンダリングせず資料室ページへ分岐するので、この追加で社外へ知財が露出することはない。`GET /api/project-ip` も `requireAuth` (ログイン済みメンバー) のまま
- 構成: サマリ帯 (立場別件数 + admin の「＋追加」) → ⏰期限 → 🗺️特許マップ → 立場別テーブル (自社・共同 / 大学 / 障害・ウォッチ) → 詳細モーダル
- 立場別テーブルの列は左から `名称 (固定列) / 状態 / 年金 / 年金納付済 / 審査請求 / 外国 / PCT番号 / 鮮度 / 技術区分 / 出願番号 / 公開番号 / 登録番号 / 優先日 / 出願日 / 登録日 / 満了日 / 出願人 / 現権利者 / 実施 / 年間費用 / 担当 / 代理人 / ファミリー / ファミリー数 / 被引用 / 範囲 (claim_breadth) / 重要 (importance) / 注意 (脅威・期限)` の28列 (まさ確定 2026-08-21「全部足すで全然問題ないよ。先頭列先頭行固定で横スクロールさせればいいし」)。並びは 立場 → 重要度降順 → 出願番号降順。行クリックで詳細モーダル
- **列数が多いので、先頭列 (名称) と見出し行を固定して両軸スクロールさせる**。実装上の制約が2つある:
  - `overflow-x-auto` だけの箱では `overflow-y` が `auto` に計算され、`sticky top-0` が効かない。したがって外箱は `max-h-[70vh] overflow-auto` (両軸スクロール) にする。見出しは `sticky top-0 z-20 bg-muted`、先頭列は `sticky left-0 z-10 bg-background`、左上の角セルは `sticky left-0 top-0 z-30`
  - 固定セルの背景は**不透明**でないと、スクロールした行が透けて重なる。行 hover は `hover:bg-muted` (半透明の `bg-muted/40` は不可) とし、先頭列セルへ `group-hover:bg-muted` を張って hover 色を合わせる
- **列見出しの配列 `HEAD` と `<tbody>` の `<Cell>` の並びは 1:1**。片方だけに列を足すと全行がずれるので、追加時は必ず両方を同じ位置に入れる (コード内にも同趣旨のコメントを置いた)
- 状態を表す3列は `project-ip.ts` のラベル表を通す: 年金 = `ANNUITY_LABEL` (`na` 対象外 / `paid` 納付済 / `grace` 追納中 / `lapsed` 不納・消滅 / `unknown` 未確認)、外国 = `PCT_LABEL` (`none` JPのみ / `pct_filed` PCT出願済 / `national_phase` 各国移行済 / `lapsed` 期限徒過 / `unknown` 未確認)、実施 = `PRACTICE_LABEL` (`practicing` / `planned` / `not_practicing` / `defensive` / `unknown`)
- 鮮度列は `verifyFreshness(last_verified_on)`。未入力は「未調査」、1年超は「要再調査 (N年前)」、それ以外は確認日をそのまま出す。台帳が古いまま放置されている状態を一覧で見つけるための列
- **実際の期日は `project_ip_deadlines` が正本**。資産テーブルが持つのは状態 (年金の納付状況・PCTの段階) と、その状態の根拠になる確定日 (`annuity_paid_through_on` / `examination_requested_on`) だけ。次に来る期限を二重に持たない
- 期限の色: 超過と30日以内は赤、90日以内は琥珀、それ以外は灰
- 詳細モーダルは表の全列に加えて、優先日 / 審査請求日 (未入力は「未請求」) / 年金 (状態 + 「YYYY-MM-DD まで納付済」) / 外国 (PCT) / 現権利者 / 実施状況 / 年間維持費 (`¥` + 3桁区切り) / 担当 / 代理人 / ファミリー数 / 被引用 / 最終確認日 を出す
- 編集フォームは文字列 (`pct_number` / `owner_member_id` / `attorney_firm`)、日付 (`priority_date` / `examination_requested_on` / `annuity_paid_through_on` / `last_verified_on`)、数値 (`annual_cost_yen` / `family_size` / `citation_count`、空文字は `null` に落として 0 と未入力を区別)、3つの状態 select、現権利者 (カンマ区切り) を持つ
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

## 6. 投入済みデータ (2026-08-27 時点)

| PJ | 件数 | 出典 | 投入経路 |
|---|---|---|---|
| p10 (SE) | 資産17件 / 権利者15件 | **J-PlatPat 照会 (2026-08-27)**。実施許諾契約の有無だけ Google Drive「SE_240521」特許棚卸しシート (2024年5月時点) | `scripts/seed_project_ip_p10_se.py` |

SE の17件の内訳:

| relation | 件数 | 中身 |
|---|---|---|
| own | 1 | 特許7544374「受電回路、起動回路、及び無線システム」。**翔エンジニアリングが単独で保有する唯一の登録特許** |
| joint | 7 | 登録5件 (7289437 東京科学大 / 7144801 京大 / 7754416 佐賀大・JAXA / 7545140 シーディエヌ / 7817697 拓和) と、審査請求前の2件 (2025-012236 / 2025-012229、ディエステクノロジー・シーディエヌと3者共同) |
| university | 1 | 京都大学「無線電力受電アダプタ」(特許5455174、年金不納で消滅) |
| blocking | 5 | **エイターリンク株式会社が2026年7月に取得した2件** (特許7041859 レクテナ装置 / 特許6666663 無線電力供給システム。どちらも出願人にSEが入っていた) と、IHIエアロスペースの有効な3件 (5686540 / 6389114 / 6414978) |
| watch | 3 | 権利化されなかった出願 (IHI「レクテナ」1件、日本電業工作とSEの共同出願2件) |

**2026-08-27 の J-PlatPat 照会で、2024年5月のシートから起こした初版の誤りを全面的に置き換えた**:

1. **出願人の社名**。8件を「Space Power Technologies」としていたが、出願人記事は7件が **株式会社翔エンジニアリング (識別番号 518195771)**。SPT が出願人なのは 2018-105943 の1件だけで、これも2018年の出願時は翔エンジニアリング、2020/07/02 の出願人名義変更届で SPT へ移っている。
2. **出願番号の欄に公開番号が入っていた2件**。2012-023857 と 2015-192484 は公開番号で、出願番号として引くと別分野の他社特許 (凸版印刷「紙カップフランジ段差測定器」/ 三共「仮設足場用足場板」) に当たる。正しい出願番号は 2010-159720 と 2014-066404 で、`ip_asset_id` も振り直した (旧IDはシードスクリプトが DELETE する)。
3. **IHIエアロスペースのレクテナ特許は消滅していない**。5686540 / 6389114 / 6414978 の3件が有効で年金も納付されている。特に 5686540 は SE が実施許諾契約を締結済なので、**契約の現況確認が要る**。
4. **翔エンジニアリング名義の案件が4件漏れていた** (2025-012236 / 2025-012229 / 2013-225976 / 2012-098183)。出願人検索 `翔エンジニアリング/AP` で国内12件がヒットする。
5. **2026年7月に特許7041859 と 特許6666663 がエイターリンク株式会社へ移転していた**。どちらも `project_knowledge` の競合マップでマイクロ波方式の直接競合として記録されている先。

投入時の判断:

- **日付列は J-PlatPat の書誌から入れた**。`application_date` / `publication_date` は全件、`registration_date` は経過情報の登録記事で確認できた4件 (7144801 / 7041859 / 7289437 / 7544374)、`expiry_date` は登録情報の存続期間満了日が読めた8件。読めなかったものは NULL のままにして、年から逆算しない。
- **`project_ip_deadlines` は0件のまま**。審査請求前の 2025-012236 / 2025-012229 は期限が 2028/01/28 と確定するので、期限テーブルへ載せるかは §5 の期限通知の配線とあわせて決める。`note_md` には明記した。
- **`last_verified_on` は全件 `2026-08-27`**。知財タブの「要再調査」表示は出なくなる。
- **`annuity_status` は J-PlatPat のステータスから入れた**。「年金の支払い」「登録公報の発行」で最終納付年分が読めたものは `paid`、「年金不納による特許権の消滅」は `lapsed`、未登録は `na`。
- **`pct_status` / `practice_status` は全件 `unknown`**。外国出願と自社実施の有無は今回の照会範囲外。`annual_cost_yen` / `family_size` / `citation_count` / `owner_member_id` / `attorney_firm` も全件 NULL。
- `current_assignee` は**出願人と現在の権利者が違う2件だけ**に入れた (どちらも `['エイターリンク株式会社']`)。他は空配列 = 出願人と同じ。
- `external_url` は全件に入れた。登録済みは `c1801/PU/JP-<登録番号>/15/ja`、未登録は `c1801/PU/JP-<公開番号>/11/ja`。
- `inventors` を全件に入れた。SEの案件はすべて藤原暉雄 (代表取締役) が発明者に入っている。
- `ip_asset_id` は `ipa_se_<出願番号の数字>`、`ip_right_id` は `ipr_se_<出願番号の数字>_<権利者略号>` の固定キー。シード再実行は upsert なので行が増えない。原本が更新されたらスクリプトを直して再実行する。

```bash
cd pwa && python3 -X utf8 scripts/seed_project_ip_p10_se.py
```

同じ棚卸しシートにある**周波数×電力の星取表 (24GHz/5.75GHz/2.45GHz/920MHz × 微小〜大電力)** と**競合28社リスト**は、この台帳のスキーマに乗らないため未投入。技術ポジションの正本をどこに置くかは別途決める。
