# Notion Content Migration UIUX Plan

作成日: 2026-06-02
状態: P0 UI sketch + schema mapping まで。runtime 実装、DB migration、本番データ write、Notion sync はまだ行わない。

## 目的

Notion にある `member list` / `history` / `photo` 系コンテンツを AMD OS に移植するときの置き場所、UIUX、権限、データ構造、移植順を決める。

この設計案では、Notion の個人情報・写真 URL・本文値は保存しない。確認したのは database / page の構造、プロパティ名、リレーション、既存 AMD OS 画面との対応だけ。

## 確認した現状

### Notion 側

| 領域 | 確認できた構造 | 移植上の意味 |
|---|---|---|
| AMD home | wiki database。タグ、オーナー、PJ relation、作成日時、最終更新日時、verification を持つ | 社内 wiki / company profile の入口だが、OS 移植では private wiki と public profile を分ける |
| メンバーリスト | database。`名前`, `氏名`, `タイトル`, `ステータス`, `チーム加入日`, `エフォート`, `写真`, `ユーザー`, `略歴`, `参画の経緯`, `出身地`, `居住地`, `MBTI`, `PJ_all` relation など | AMD OS の `members` だけでは足りない公開プロフィール・内部プロフィール・写真・PJ relation を持つ |
| history | database。`名前`, `日付`, `PJ` relation | 会社沿革 / PJ沿革の source。説明本文、visibility、event type が不足している |
| photo | database。`名前`, `日付`, `PJ_all` relation, `メンバー` relation, `撮影場所`, `撮影者` を持つ gallery/table | OS 移植時は usage permission / visibility / source asset を必須にする必要がある |
| database index | Notion 上で PJ / メンバーリスト / history / photo / ドキュメント / 議事録 / 受賞歴などが横並び | OS では operational DB、company profile、public-ready media を分離する |

### AMD OS 側

| 領域 | 既存状態 | 移植時の扱い |
|---|---|---|
| `/admin/members` | `members` を admin-only で編集。codeName は `/mypage?memberId=<members.member_id>` にリンク | 内部アカウント台帳として継続。公開プロフィールをそのまま混ぜない |
| `/mypage` | 個人の参加 PJ / 活動 / 報酬導線。admin は他メンバー閲覧可能 | メンバー詳細の内部ビューとして使えるが、公開プロフィール画面ではない |
| `/admin/private-wiki` | `private_wiki_entries` を admin-only で管理。人物・関係性メモを PJ 別に保存。`visibility='admin_private'` 固定 | メンバーの内部メモ、関係性、センシティブ情報の受け皿。公開転用しない |
| `project_members` | PJ と AMD メンバーの紐付け。role / is_pm / is_pl / is_closer / active など | Notion の `PJ_all` relation はまずここへ寄せる候補。ただし project_id matching が必要 |
| `project_founding_members` | PJ 関連メンバー。大学 / SU / AMD 伴走など、HRL 根拠にも使う | 外部キーパーソンはここまたは private wiki に寄せる。AMD member profile とは分ける |
| `project_events` | PJ 単位の event。`occurred_on`, `kind`, `label`, `meta`, `source` | history の PJ 紐付きイベントを最初に寄せられる既存 table |
| `project_ventures` | 公開可能な PJ venture narrative と `is_public` を持つ | public-facing company/PJ history の一部に使える |
| `/company` `/about` `/profile` route | 2026-06-02 時点で専用 route は未実装。`/mypage` は内部メンバー詳細、`/admin/members` はアカウント台帳 | `/company` は P2 以降に authenticated read-only hub として追加候補。社外共有はレビュー後に別実装 |

## 推奨情報設計

### 1. Admin 正本: `/admin/company`

Notion から移した company profile / team / history / photo を編集する admin-only hub を新設する案。

タブ:

| tab | 役割 |
|---|---|
| `Profile` | 会社プロフィール、ミッション、社外向け boilerplate、Notion source 管理 |
| `Team` | メンバー公開プロフィール、内部プロフィール、写真、公開可否 |
| `History` | 会社 / PJ の年表イベント、重要度、外部公開可否 |
| `Media` | 写真・画像・ロゴ・イベント素材、利用許諾、タグ、出典 |
| `Import` | Notion one-time import / dry-run / sync status 確認 |

理由:

- `/admin/members` はアカウント・契約・支払・ログインの台帳で、顔写真や社外プロフィールを混ぜると権限と用途が濁る。
- `/admin/private-wiki` は admin-only の関係性メモで、public-ready content と混ぜない方が安全。
- company/team/history/media は、Notion 移植後も OS 上で編集したい「会社コンテンツ台帳」として独立させるのが自然。

#### P0 UI sketch

`/admin/company` は `/admin` layout の `members.is_admin=true` gate 配下に置く。sidebar には P2 実装時に `Company` を追加する。P0 では route 実装せず、以下を UI 契約として固定する。

| tab | 表示するもの | 編集する field | guard / 表示 chip |
|---|---|---|---|
| Profile | 会社概要、boilerplate、mission / vision、社外共有候補コピー、source status | `entry_key`, `title`, `body_md`, `visibility`, `status`, `tags`, `notion_source_id`, `notion_source_url`, `notion_last_synced_at`, `reviewed_by`, `reviewed_at` | `visibility` と `status` を header に常時表示。`admin_private` / `draft` / `needs_review` は `/company` へ出さない |
| Team | メンバー公開プロフィール一覧、profile photo preview、PJ relation、公開可否、review 状態 | `member_id`, `display_name`, `public_title`, `internal_title`, `bio_short`, `bio_long`, `expertise_tags`, `visibility`, `status`, `tags`, `photo_asset_id`, source / review fields | `members` の契約・支払・住所・銀行・invoice 情報は表示しない。必要なときは `/admin/members` への deep link のみ |
| History | company / PJ timeline、event table、重要度、PJ tag、公開 preview | `occurred_on`, `title`, `summary`, `event_type`, `project_id`, `member_ids`, `importance`, `visibility`, `status`, `tags`, source / review fields | `project_id` ありは `project_events` との二重管理警告を出す。未review event は `/company` と PJ cockpit へ出さない |
| Media | gallery + table、thumbnail、人物/PJ/event tag、撮影日、権利状態 | `title`, `asset_kind`, `captured_at`, `photographer`, `location_label`, `project_ids`, `member_ids`, `event_id`, `tags`, `visibility`, `status`, `usage_permission`, `consent_status`, `storage_bucket`, `storage_path`, `thumbnail_path`, source / review fields | `usage_permission` / `consent_status` を card 上に必ず表示。`unknown` / `pending` は public preview に出さない |
| Import | Notion source の dry-run結果、mapping差分、未解決 relation、写真取り込み待ち、last sync | P0 では編集なし。P3 で `import_batch_id`, source database, dry-run diff, selected action を扱う | DB write なし。Notion本文値・写真URL・個人情報値は画面外/ログ外に出さない |

Private boundary:

- `/admin/company` は public-ready / internal-ready な会社コンテンツ台帳。人物の関係性、趣味、弱い確度の評価、営業上の温度感は置かない。
- `/admin/private-wiki` は `private_wiki_entries.visibility='admin_private'` 固定の人物メモ。`/admin/company` から参照するときも件数 badge と deep link までに留め、本文を混ぜない。
- `members` は login / admin / payout / contract の正本。Team tab は `members.member_id` 参照だけ持ち、契約・支払・住所・bank fields を profile table へ複製しない。

Photo / personal-info permission display:

- Team / Media の card と detail panel には `visibility`, `status`, `usage_permission`, `consent_status`, `reviewed_by`, `reviewed_at` を必ず同じ位置に出す。
- 顔写真・集合写真は `member_ids` または people tag を必須にし、人物が特定できる asset は `consent_status='granted'` か `not_needed` 以外を public 出力禁止にする。
- 本名、居住地、出身地、MBTI、個人的趣味、Notion user relation は default `admin_private` / `internal`。public field へ昇格するには `status='approved'`, `reviewed_by`, `reviewed_at` を必須にする。

### 2. Internal read-only: `/company`

OS 内メンバーが見る company profile hub。最初は authenticated-only の read-only でよい。

構成:

| section | UI |
|---|---|
| Company Profile | 会社概要、最新 boilerplate、外部共有用 copy の確認 |
| Team | 顔写真、code name / 表示名、役割、専門、関わる PJ、公開プロフィールの preview |
| History | timeline。company / PJ filter、重要度 filter、source badge |
| Media Gallery | gallery。PJ / event / member tag、利用可否、公開OK / 内部限定 chip |

理由:

- まず社内で整える場所を作る。
- public へ出す前に、公開可否や写真利用許諾を目視レビューできる。
- NIMS / 事業会社向けの説明準備にも使えるが、外部公開 route とは分ける。

#### P0 read-only UI sketch

`/company` は authenticated users 向けの read-only hub。admin-only の編集 action、未review source、private wiki 本文は出さない。

| section | 見せるもの | 隠すもの |
|---|---|---|
| Profile | `visibility in ('internal','public')` かつ `status='active'` / `approved` の会社概要、mission、社内共有用 boilerplate | `admin_private`, `draft`, `needs_review`, source URL、生の Notion本文、review未了コピー |
| Team | `member_profiles.visibility in ('internal','public')` かつ approved の表示名、role、short bio、expertise、関与 PJ、許諾済み thumbnail | legal name、email、住所、bank、invoice、effort、内部評価、private wiki memo、consent未確認写真 |
| History | active / approved の会社年表。PJ filter つきで、PJ event は要約のみ | `draft`, `needs_review`, `admin_private`, source excerpt、根拠未確認 event |
| Media | `usage_permission in ('internal_ok','public_ok')` かつ consent OK の thumbnail gallery。PJ / member / event tag filter | Notion file URL、private Storage path、restricted / expired / unknown assets、顔写真の同意未確認素材 |

Display rule:

- `/company` は社内閲覧用なので `visibility='internal'` まで表示可。ただし `status='approved'` または `active` を必須にする。
- admin でログインしていても `/company` は read-only surface として振る舞う。編集は `/admin/company` へ遷移する。
- source / Notion / review details は admin-only detail に寄せ、通常閲覧者には `last reviewed` 程度の品質表示だけ出す。

### 3. PJ cockpit 連携

PJ cockpit には「全部」を置かず、PJ に紐づく最小情報だけ差し込む。

| cockpit block | 表示候補 |
|---|---|
| 関連メンバー | `project_members` + `member_profiles` の薄い card。code_name / display_name、role、public/internal badge、`/mypage?memberId=` または `/company` profile への link |
| PJ history | `project_events` 由来の重要 event 3-5 件。`company_history_events.project_id` を作る場合も cockpit では milestone だけに絞る |
| Media | PJ tagged media から 3-6 件の thumbnail。`usage_permission in ('internal_ok','public_ok')`, consent OK, status approved のみ |
| 外部キーパーソン | `project_founding_members` / private wiki から admin-only で表示。公開面には出さない |

表示粒度:

- cockpit は PJ 判断のための context だけを差し込む。Team tab / Media gallery の全量 browsing は `/company` または `/admin/company` へ逃がす。
- PJ関連メンバーは active role と公開可能プロフィール要約まで。内部タイトル・effort・個人情報は出さない。
- 重要historyは `importance in ('high','milestone')` を優先し、古いものは modal / timeline へ折りたたむ。
- PJ tagged media は thumbnail + title + permission chip まで。download / original path は admin-only。


### 4. Public-facing

P4 まで defer。実装するなら、AMD OS 内の login-free route より、社外向け site / shared view として切るかを先に司令塔レビューする。

公開候補:

- `/public/company` or corporate site: 会社概要、沿革、公開OKメンバー、公開OK写真。
- PJ別 external profile: `project_ventures.is_public=true` と approved media だけを使う。

公開禁止:

- `members.email`, `bank_info`, `member_address`, `contractor_name`, `invoice_registration_number`
- Notion の個人趣味、居住地、出身地、MBTI、オフ時間、内部メモ
- `private_wiki_entries`
- usage permission 未確認の写真

## UIUX 案

### メンバー一覧

Admin Team tab:

- table + gallery toggle。
- 左から `photo`, `display_name`, `code_name`, `title/role`, `status`, `projects`, `expertise tags`, `visibility`, `profile status`, `source`。
- row click で side panel を開き、以下を分けて編集する。

Side panel:

| group | fields |
|---|---|
| Public profile | display name, title, short bio, expertise, public projects, profile photo, external links |
| Internal profile | join date, effort, internal role, internal notes pointer |
| Relations | `members.member_id`, `project_members`, Notion source id |
| Safety | visibility, profile status, photo permission, reviewed_by, reviewed_at |

重要:

- 本名・居住地・趣味・MBTI などは default internal。
- 外部公開用の名前と内部 legal / payment 用の名前を分ける。
- `members` の支払・契約情報は同じ panel に出さないか、admin-only deep link に留める。

### History

UI:

- timeline + table toggle。
- filter: `company / project / people / media / funding / award / product / legal`, PJ, visibility, status, year。
- event card は `date`, `title`, `summary`, `project chips`, `importance`, `visibility`, `source`。
- `public_preview` toggle で外部公開時の見え方だけ確認できる。

扱い:

- Notion history は `date + title + PJ relation` が主なので、移植時に `event_type`, `summary`, `importance`, `visibility`, `source_ref` を補う。
- PJ に紐づくものは既存 `project_events` へ寄せる。会社全体の沿革は `company_history_events` 新設候補。

### Photo / Media

UI:

- gallery first。table view は admin 用。
- filter: PJ, member, event, date, photographer, location, visibility, usage permission, asset status。
- card: thumbnail, title, date, tags, permission chip。
- detail panel: original source, storage path, Notion source id, photographer, captured_at, people tags, project tags, usage_permission, license_note, consent_note。

権限:

- `usage_permission='unknown'` は OS 内でも public preview に出さない。
- 顔が写る写真は `people_tags` と `consent_status` を持たせる。
- Notion file URL をそのまま公開しない。import 時に private Storage へ取り込み、public derivative は reviewed asset だけ別 path にする。

## データ設計案

### Schema mapping

Notion 側の本文値・写真URL・個人情報値は docs に貼らない。mapping は schema / property / relation 単位だけを扱う。

| Notion source | Notion schema / property group | 既存 table に寄せるもの | 新 table 候補 | 分離判断 |
|---|---|---|---|---|
| AMD home wiki | title, tags, owner, PJ relation, created / updated, verification | PJ relation が明確な operational note は `project_knowledge` / `project_events` 候補。人物の関係性メモは `private_wiki_entries` | `company_profile_entries` | company boilerplate / mission / public-ready copy は `company_profile_entries`。private wiki と company profile を混ぜない |
| member list | name / display fields, title, status, join date, effort, photo, user relation, bio, background, hometown / residence / MBTI, PJ relation | login / contract / payout / admin fields は既存 `members`。PJ relation は `project_members`。外部キーパーソンは `project_founding_members` | `member_profiles`, `media_assets` | `members` はアカウント台帳。公開/内部プロフィール、写真、専門タグは `member_profiles` に分離。本名・居住地・MBTI等は default internal/admin_private |
| history | title, date, PJ relation | PJ relation があり event として使えるものは `project_events` (`occurred_on`, `kind`, `label`, `meta`, `source`) | `company_history_events` | company-wide 沿革は新 table。PJ cockpit へ出すのは milestone だけ。event_type / visibility / status / review を補う |
| photo | title, date, PJ relation, member relation, location, photographer, file / gallery metadata | PJ tag は `projects.project_id` へ、member tag は `members.member_id` へ mapping。meeting由来なら `meeting_assets` との重複確認 | `media_assets` | Notion file URL は公開しない。Storage 取り込み後の `storage_bucket`, `storage_path`, `thumbnail_path` を正にする。usage / consent を必須 gate にする |
| Notion relation index | PJ / member / history / photo / docs / meeting relation | 既存 operational tables (`project_members`, `project_meeting_summaries`, `project_knowledge`) へ寄せられる relation は寄せる | import helper 側の dry-run diff structure | relation resolution は P3 dry-run で未解決を list 化。勝手に新PJ・新memberを作らない |

Required fields for all new company-content tables:

- `notion_source_id`
- `notion_source_url`
- `notion_last_synced_at`
- `visibility`
- `status`
- `tags`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

Photo / media required fields:

- `usage_permission`
- `consent_status`
- `storage_bucket`
- `storage_path`
- `thumbnail_path`

### 既存 table に寄せる

| 目的 | 既存 table | 方針 |
|---|---|---|
| 内部アカウント / 契約 / 支払 / login | `members` | 既存正本。Notion profile 情報を安易に追加しない |
| PJ と AMD メンバーの紐付け | `project_members` | Notion `PJ_all` relation を mapping して反映候補にする |
| 外部 / SU / 大学キーパーソン | `project_founding_members` | HRL / 関連メンバー文脈に載る人だけ |
| admin-only 関係性メモ | `private_wiki_entries` | private な人物メモはここ。public profile へ出さない |
| PJ history | `project_events` | PJ relation 付き history の既存受け皿候補。P1 では設計レビューのみ、反映は P2 以降 |
| public PJ narrative | `project_ventures` | public approved な PJ story だけ |

### 新 table 候補

司令塔レビュー後の migration 候補。

```sql
company_profile_entries
- entry_id uuid pk
- entry_key text unique
- title text
- body_md text
- visibility text -- internal / public / admin_private
- status text -- draft / active / archived
- tags text[]
- notion_source_id text
- notion_source_url text
- notion_last_synced_at timestamptz
- reviewed_by text
- reviewed_at timestamptz
- created_at timestamptz
- updated_at timestamptz
```

```sql
member_profiles
- member_profile_id uuid pk
- member_id text references members(member_id)
- display_name text
- public_title text
- internal_title text
- bio_short text
- bio_long text
- expertise_tags text[]
- visibility text -- admin_private / internal / public
- status text -- draft / needs_review / approved / archived
- tags text[]
- photo_asset_id uuid
- notion_source_id text
- notion_source_url text
- notion_last_synced_at timestamptz
- reviewed_by text
- reviewed_at timestamptz
- created_at timestamptz
- updated_at timestamptz
```

```sql
company_history_events
- event_id uuid pk
- occurred_on date
- title text
- summary text
- event_type text -- company / project / award / media / funding / product / legal / people
- project_id text null
- member_ids text[]
- importance text -- low / medium / high / milestone
- visibility text -- admin_private / internal / public
- status text -- draft / active / archived
- tags text[]
- source_kind text -- notion / manual / l2 / import
- source_ref text
- notion_source_id text
- notion_source_url text
- notion_last_synced_at timestamptz
- reviewed_by text
- reviewed_at timestamptz
- created_at timestamptz
- updated_at timestamptz
```

```sql
media_assets
- asset_id uuid pk
- title text
- asset_kind text -- photo / logo / slide / document / video
- storage_bucket text
- storage_path text
- thumbnail_path text
- captured_at date
- photographer text
- location_label text
- project_ids text[]
- member_ids text[]
- event_id uuid null
- tags text[]
- visibility text -- admin_private / internal / public
- status text -- draft / needs_review / approved / archived
- usage_permission text -- unknown / internal_ok / public_ok / restricted / expired
- consent_status text -- unknown / not_needed / pending / granted / denied
- source_kind text -- notion / manual / drive
- source_ref text
- notion_source_id text
- notion_source_url text
- notion_last_synced_at timestamptz
- reviewed_by text
- reviewed_at timestamptz
- created_at timestamptz
- updated_at timestamptz
```

### 必須共通カラム

- `notion_source_id`
- `notion_source_url`
- `notion_last_synced_at`
- `visibility`
- `status`
- `tags`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

写真系は追加で以下を必須にする。

- `usage_permission`
- `consent_status`
- `source_kind`
- `storage_bucket`
- `storage_path`
- `thumbnail_path`

## 移植方針

| コンテンツ | 推奨 | 理由 |
|---|---|---|
| メンバーリスト | one-time import + OS 編集正本化 | プロフィールや公開可否は OS 側の運用に寄せた方が安全 |
| history | one-time import + P2 以降で OS 編集 | Notion 側は最小構造。OS で event_type / visibility / summary を補う |
| photo | one-time import with dry-run。sync は後回し | 写真 URL / 許諾 / storage 取り込みが絡むので自動 sync は危険 |
| AMD home wiki | 必要ページだけ選別 import | wiki 全体を丸ごと移すと private / public 境界が崩れる |
| Notion sync | P3 以降、source id と差分 preview だけ | Notion を恒久正本にすると OS 編集と競合するため |

Codex / えいみが後から追記する場所:

- admin company profile の draft
- history event の draft / needs_review
- media asset の metadata 補完
- member profile の public/internal 分離案

ただし、公開化・写真使用許諾・個人情報の公開判断は人間レビューを必須にする。

## 実装優先順位

### P0: UI sketch + schema mapping

- この設計案を司令塔レビューする。
- `/admin/company` と `/company` の UI sketch を確定する。
- Notion member / history / photo / home schema から既存 table / 新 table 候補への mapping を確定する。
- DB write / DDL / production migration / Notion sync / 写真取り込みはしない。
- UI mock を作る場合も static / fixture のみ。Notion本文値、写真URL、個人情報値は fixture に入れない。

### P1: migration draft / apply なしの設計レビュー

- migration SQL はまだ書かない / apply しない。
- `company_profile_entries`, `member_profiles`, `company_history_events`, `media_assets` の責務境界、RLS方針、visibility enum、review gate をレビューする。
- `members`, `project_members`, `project_events`, `project_founding_members`, `project_ventures`, `private_wiki_entries` へ寄せる範囲を決める。
- photo consent / usage permission のレビュー担当と運用ルールを決める。

### P2: admin 編集 UI

- 司令塔レビュー後に最小 DDL を別タスクで作成し、apply 後に `/admin/company` を実装する。
- Profile / Team / History / Media / Import の5タブを作る。
- Team / Media では `visibility`, `status`, `usage_permission`, `consent_status`, `reviewed_by`, `reviewed_at` を必須表示にする。
- `/admin/members` と `/admin/private-wiki` は deep link だけで、データ本体を混ぜない。

### P3: import / sync helper dry-run

- read-only Notion fetch -> mapping dry-run -> diff preview -> selective import plan まで。
- dry-run は unresolved relation、missing permission、duplicate asset、private/public boundary risk を出す。
- DB write は明示アクション後。auto sync は off by default。
- 写真は Notion URL を保存するだけにせず、Storage 取り込み計画と permission gate を先に出す。

### P4: public-facing approved view

- approved public profile / history / media だけで構成する。
- corporate-site に出すか AMD OS の login-free route に出すかを司令塔レビューする。
- external URL 発行前に `visibility='public'`, `status='approved'`, `usage_permission='public_ok'`, `reviewed_at`, `reviewed_by` を必須 gate にする。

## open questions

1. company/team/history/media は AMD OS 内に閉じるか、corporate-site 側の public CMS としても使うか。
2. メンバーの公開プロフィール名は `code_name`, `member_name`, 別 display name のどれを正本にするか。
3. Notion の member `写真` と photo DB の人物写真を同じ `media_assets` に統合するか、profile photo は別管理にするか。
4. history は company-wide と PJ events を同一 table にするか、`project_events` と `company_history_events` に分けるか。
5. 写真の consent / usage permission を誰がレビューするか。

## 非対象

- DB migration 実行。
- Notion への write / update。
- 写真 URL / 個人情報値の貼り付け。
- production deploy。
- public route 実装。
