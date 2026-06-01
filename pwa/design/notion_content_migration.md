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
| Profile | 会社概要、boilerplate、mission / vision、社外共有候補コピー、source status | `entry_key`, `title`, `body_md`, `visibility`, `status`, `tags`, `notion_source_id`, `notion_source_url`, `notion_last_synced_at`, `reviewed_by`, `reviewed_at` | `visibility` と `status` を header に常時表示。`admin_only` / `private` / `imported` / `needs_review` は `/company` へ出さない |
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
- 本名、居住地、出身地、MBTI、個人的趣味、Notion user relation は default `admin_only` / `private` / `internal`。public-facing 候補へ昇格するには `visibility='public_candidate'`, `status='approved_public'`, `reviewed_by`, `reviewed_at` を必須にする。

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
| Profile | `visibility in ('internal','public_candidate')` かつ `status in ('approved_internal','approved_public')` の会社概要、mission、社内共有用 boilerplate | `admin_only`, `private`, `imported`, `needs_review`, source URL、生の Notion本文、review未了コピー |
| Team | `member_profiles.visibility in ('internal','public_candidate')` かつ `status in ('approved_internal','approved_public')` の表示名、role、short bio、expertise、関与 PJ、許諾済み thumbnail | legal name、email、住所、bank、invoice、effort、内部評価、private wiki memo、consent未確認写真 |
| History | `status in ('approved_internal','approved_public')` の会社年表。PJ filter つきで、PJ event は要約のみ | `imported`, `needs_review`, `admin_only`, `private`, source excerpt、根拠未確認 event |
| Media | `usage_permission in ('internal_ok','public_ok')` かつ consent OK の thumbnail gallery。PJ / member / event tag filter | Notion file URL、private Storage path、restricted / expired / unknown assets、顔写真の同意未確認素材 |

Display rule:

- `/company` は社内閲覧用なので `visibility='internal'` まで表示可。ただし `status='approved_internal'` または `approved_public` を必須にする。
- admin でログインしていても `/company` は read-only surface として振る舞う。編集は `/admin/company` へ遷移する。
- source / Notion / review details は admin-only detail に寄せ、通常閲覧者には `last reviewed` 程度の品質表示だけ出す。

### 3. PJ cockpit 連携

PJ cockpit には「全部」を置かず、PJ に紐づく最小情報だけ差し込む。

| cockpit block | 表示候補 |
|---|---|
| 関連メンバー | `project_members` + `member_profiles` の薄い card。code_name / display_name、role、public/internal badge、`/mypage?memberId=` または `/company` profile への link |
| PJ history | `project_events` 由来の重要 event 3-5 件。`company_history_events.project_id` を作る場合も cockpit では milestone だけに絞る |
| Media | PJ tagged media から 3-6 件の thumbnail。`usage_permission in ('internal_ok','public_ok')`, consent OK, `status in ('approved_internal','approved_public')` のみ |
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
| member list | name / display fields, title, status, join date, effort, photo, user relation, bio, background, hometown / residence / MBTI, PJ relation | login / contract / payout / admin fields は既存 `members`。PJ relation は `project_members`。外部キーパーソンは `project_founding_members` | `member_profiles`, `media_assets` | `members` はアカウント台帳。公開/内部プロフィール、写真、専門タグは `member_profiles` に分離。本名・居住地・MBTI等は default `internal` / `admin_only` / `private` |
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
- visibility text -- public_candidate / internal / admin_only / private / archived
- status text -- imported / needs_review / approved_internal / approved_public / archived / rejected
- source_confidence numeric(3,2)
- source_kind text
- source_ref text
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
- visibility text -- public_candidate / internal / admin_only / private / archived
- status text -- imported / needs_review / approved_internal / approved_public / archived / rejected
- source_confidence numeric(3,2)
- source_kind text
- source_ref text
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
- visibility text -- public_candidate / internal / admin_only / private / archived
- status text -- imported / needs_review / approved_internal / approved_public / archived / rejected
- source_confidence numeric(3,2)
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
- visibility text -- public_candidate / internal / admin_only / private / archived
- status text -- imported / needs_review / approved_internal / approved_public / archived / rejected
- source_confidence numeric(3,2)
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

- admin company profile の `imported` / `needs_review`
- history event の `imported` / `needs_review`
- media asset の metadata 補完
- member profile の public/internal 分離案
- この設計案を司令塔レビュー。
- Notion member/history/photo の schema mapping 表を作る。
- DB write なしで static JSON / mock data の UI sketch だけ作るなら可。
- route 候補は `/admin/company` と `/company`。
- 2026-06-02 first placement: `/dashboard` のPJ一覧下に `CompanyContentShelf` としてメンバー / 沿革 / photo の3カラム preview を置く。メンバーと沿革は既存DB read-only、photo は usage permission / consent review 前提の preview だけにする。

ただし、公開化・写真使用許諾・個人情報の公開判断は人間レビューを必須にする。

## P1 設計レビュー: RLS / visibility / review gate

この章は P1 の設計レビュー結果。まだ migration SQL は書かない / apply しない。次 worker が DDL draft を作る場合の入力にする。

### visibility enum 案

新設する company content 系 table は、既存 `private_wiki_entries.visibility='admin_private'` とは別に、以下の `visibility` を使う。`private_wiki_entries` は既存どおり `admin_private` 固定のまま変えない。

| visibility | 意味 | `/admin/company` | `/company` | PJ cockpit | future public-facing |
|---|---|---|---|---|---|
| `public_candidate` | 外部公開候補。ただし公開承認前 | 表示・編集可。public preview は warning 付き | `status='approved_public'` になるまで非表示 | 非表示。PJ文脈では `approved_internal` 以上のみ | P4 まで非表示。P4 でも `approved_public` + permission gate 必須 |
| `internal` | AMD OS ログインユーザー向け | 表示・編集可 | `status in ('approved_internal','approved_public')` のみ表示 | PJに紐づく薄い summary のみ表示可 | 非表示 |
| `admin_only` | admin 編集・確認用。契約/権利/個人情報に近い情報 | 表示・編集可 | 非表示 | 非表示。admin cockpit でも本文は出さず deep link まで | 非表示 |
| `private` | 本文を company profile に置くべきでない機微情報。移植時の隔離/差し戻し用 | 表示・編集可。ただし `/admin/private-wiki` へ移す候補として警告 | 非表示 | 非表示 | 非表示 |
| `archived` | 表示対象外の履歴 | archive filter 時のみ表示 | 非表示 | 非表示 | 非表示 |

判定:

- P1 DDL draft では `public` を visibility に入れない。公開可否は `visibility='public_candidate'` と `status='approved_public'` の AND で表現する。これで、visibility だけを見た誤公開を防ぐ。
- `admin_only` と `private` は分ける。`admin_only` は会社コンテンツ台帳内で管理すべき非公開情報、`private` は private wiki / 別台帳へ逃がすべき情報、という扱い。
- 既存 `project_ventures.is_public=true` は PJ narrative の既存公開フラグなので、company content の `visibility` とは同一視しない。P4 で外部向け PJ view を作る時だけ bridge する。

### review gate 案

新設 table の `status` は content review の状態を表す。既存 `members.status`, `project_members.is_active`, `private_wiki_entries.status` とは意味を混ぜない。

| status | 意味 | 書き込み元 | 昇格条件 | 表示先 |
|---|---|---|---|---|
| `imported` | Notion / manual から取り込んだだけ。未レビュー | Import dry-run 後の明示 import、または admin 手入力 | source ref / relation resolution / duplicate check 完了 | `/admin/company` のみ |
| `needs_review` | 何らかの不足や権利/公開判断待ちがある | Import helper / admin | 必須 field 補完、permission / consent / source confidence 確認 | `/admin/company` のみ |
| `approved_internal` | AMD OS 内で閲覧してよい | admin reviewer | `reviewed_by`, `reviewed_at`, `source_confidence` が揃い、個人情報/権利 gate OK | `/company`, PJ cockpit summary |
| `approved_public` | 外部公開候補として承認済み | admin reviewer。P4 までは表示先なし | `approved_internal` 条件 + `visibility='public_candidate'` + usage permission / consent OK | P4 まで非表示。P4 public view のみ |
| `archived` | 現行表示から外す履歴 | admin | archive reason を残す | `/admin/company` filter のみ |
| `rejected` | 移植しない / 誤取り込み | admin / import review | rejection reason を残す | `/admin/company` filter のみ |

必須 metadata:

| field | 方針 |
|---|---|
| `reviewed_by` | admin user email。`approved_internal` / `approved_public` では NOT NULL 相当の check を入れる |
| `reviewed_at` | review timestamp。approved 系では NOT NULL 相当 |
| `source_confidence` | `numeric(3,2)` 0.00-1.00。Notion schema / relation だけなら低め、一次 source ref が明確なら高め。承認時は原則 0.70 以上 |
| `source_kind` / `source_ref` | Notion / manual / drive / meeting / other。本文全文や写真URLではなく、辿れる短い参照だけ |
| `source_excerpt` | 任意。使う場合も短い抜粋だけ。メール全文、議事録全文、Notion本文全文は保存しない |
| `usage_permission` | media 必須。`unknown`, `internal_ok`, `public_ok`, `restricted`, `expired` |
| `consent_status` | media / profile photo 必須。`unknown`, `not_needed`, `pending`, `granted`, `denied` |

review gate:

- `/company` に出す条件: `visibility in ('internal','public_candidate')` AND `status in ('approved_internal','approved_public')`。`admin_only`, `private`, `archived`, `imported`, `needs_review`, `rejected` は出さない。
- PJ cockpit に出す条件: `/company` 条件に加え、PJ relation が確定していること。表示は summary / thumbnail / chip までで、source detail と original path は出さない。
- P4 public-facing に出す条件: `visibility='public_candidate'` AND `status='approved_public'` AND media は `usage_permission='public_ok'` AND `consent_status in ('granted','not_needed')`。P1-P3 では route も API も作らない。
- LLM / import helper は `approved_*` を直接書かない。作れるのは `imported` / `needs_review` まで。

### RLS / API 境界

P1 の推奨は「admin 編集正本は API 経由、authenticated read-only は RLS で最小公開、public は P4 まで閉じる」。

| surface | read | write | 実装境界 |
|---|---|---|---|
| `/admin/company` | admin only | admin only | `admin/layout.tsx` と同じ `members.is_admin=true` gate。API は `requireAdmin()` + service_role client |
| `/api/admin/company/*` | admin only | admin only | list/create/update/archive/review/import-preview を分ける。mutation は browser direct Supabase ではなく API 経由 |
| `/company` | authenticated read-only | none | `requireAuth()` または app route auth 前提。RLS は approved internal/public だけ SELECT |
| PJ cockpit | authenticated read-only | none | server component/API で approved summary だけ取得。admin-only source/private wiki 本文は join しない |
| future public-facing | P4 まで none | none | P4 で別 route / corporate-site 連携を司令塔レビューしてから追加 |

RLS draft 方針:

- 新 table は `enable row level security`。
- `anon` には P1-P3 では grant しない。
- `authenticated` は SELECT のみ。policy は approved internal/public rows に限定する。
- `authenticated` の INSERT/UPDATE/DELETE は原則 grant しない。admin mutation は `requireAdmin()` 後の service_role API に寄せる。
- `service_role` は API / import helper 用に ALL。ただし helper 側で `approved_*` 直接 write を禁止する。
- admin browser direct write を許す policy は作らない。private wiki と同様に admin route guard + service_role API を正本にする。

RLS に関する apply 前レビュー項目:

- `admin_only` / `private` / `imported` / `needs_review` が `/company` 用 anon/authenticated query で 0 件になること。
- `reviewed_by` / `reviewed_at` 不足の row が approved として SELECT されないこと。
- media は permission / consent 不足の row が public candidate query で 0 件になること。
- `private_wiki_entries` と join して本文が漏れる path が無いこと。許すのは admin-only 件数 badge と deep link まで。

### table 別境界

| table | P1 推奨責務 | 既存 table へ寄せる境界 | 分離すべき境界 |
|---|---|---|---|
| `company_profile_entries` | 会社概要、mission / vision、boilerplate、外部共有候補文面、Notion home wiki から選別した company-ready content | PJ 固有の operational note は `project_knowledge` / `project_events` 候補 | 人物関係メモ、弱い評価、営業温度感は `private_wiki_entries`。本文全文 import はしない |
| `member_profiles` | AMD member の公開/内部プロフィール、表示名、肩書、短い bio、専門タグ、profile photo 参照 | login / admin / payout / contractor / address / bank / invoice は `members`。PJ relation は `project_members` | legal/payment fields、個人的趣味、居住地、MBTI、Notion user relation は default で `admin_only` or `private` |
| `company_history_events` | 会社全体の沿革、会社横断 milestone、public/internal-ready timeline | PJ relation が明確で cockpit / AMD Score annotation に使うものは `project_events`。public PJ story は `project_ventures` | source detail、未確認 history、private event は approved まで出さない |
| `media_assets` | 写真、logo、event image、profile photo、public/internal derivative の metadata と permission gate | meeting 添付の運用資産は既存 `meeting_assets` と重複確認。PJ/member relation は `projects` / `members` の id 参照 | Notion file URL の直接公開、original private Storage path の通常表示、consent 不明の顔写真公開 |
| `members` | アカウント、認証、admin、契約、支払、Google status | `member_profiles.member_id` から参照 | public/internal profile field を増やさない |
| `project_members` | PJ と AMD member の operational relation | Notion `PJ_all` の AMD member relation はここへ mapping 候補 | 外部キーパーソンは入れない |
| `project_founding_members` | SU / 大学 / 外部キーパーソン、HRL 文脈 | Notion relation が外部人物で PJ 文脈が明確なら候補 | AMD member profile とは混ぜない |
| `project_events` | PJ 単位 event、沿革生成、AMD Score annotation | Notion history の PJ relation が確定し、event として意味があるもの | 会社横断 history は `company_history_events` |
| `project_ventures` | public-ready PJ narrative / `is_public` | P4 public PJ view で approved company content と bridge | company/team/media の汎用 CMS にしない |
| `private_wiki_entries` | admin-only 人物メモ、関係性、センシティブ情報 | `/admin/company` からは件数 badge / deep link のみ | company profile / public profile / `/company` へ本文を出さない |

### migration draft 方針

次 worker が DDL draft を書くなら、1 migration に company content の最小 schema と RLS だけを入れる。seed、Notion sync、実データ import は入れない。

DDL draft の粒度:

1. enum は Postgres enum ではなく `text check` で始める。既存 migration と同じく idempotent な `create table if not exists` / `create index if not exists` / `drop policy if exists` + `create policy` にする。
2. `company_profile_entries`, `member_profiles`, `company_history_events`, `media_assets` を作る。cross-table FK は `members(member_id)` / `projects(project_id)` / `company_history_events(event_id)` のみ最小限にする。
3. 全 table に `visibility`, `status`, `source_kind`, `source_ref`, `notion_source_id`, `notion_source_url`, `notion_last_synced_at`, `source_confidence`, `reviewed_by`, `reviewed_at`, `created_by`, `updated_by`, `created_at`, `updated_at` を持たせる。
4. media は `usage_permission`, `consent_status`, `storage_bucket`, `storage_path`, `thumbnail_path` を持たせる。ただし public derivative path は P4 まで optional にする。
5. approved 系 status の check は DB check で完全表現しすぎず、RLS/API の validation と併用する。まずは誤公開防止を優先する。

apply 前レビュー項目:

- migration は seed 0 件。Notion本文値、写真URL、個人情報値を含まない。
- `db_schema.md` 再生成計画があること。apply 前 draft review では再生成しない。
- RLS で `anon` grant が無いこと。
- authenticated mutation grant が無いこと。
- `/company` query 条件が RLS と同じ gate になっていること。
- `project_events` / `project_members` / `project_founding_members` へ既存 row を直接 upsert しないこと。relation resolution は P3 dry-run の unresolved list まで。
- rollback は table drop ではなく、apply 前なら migration file 修正、apply 後なら `archived` / policy tighten / follow-up migration で戻す。実データが入るまでは destructive rollback を使わない。
- migration number は既存最新の次番を確認してから採番し、適用済み migration の書き換えをしない。

## 実装優先順位

### P0: UI sketch + schema mapping

- この設計案を司令塔レビューする。
- `/admin/company` と `/company` の UI sketch を確定する。
- Notion member / history / photo / home schema から既存 table / 新 table 候補への mapping を確定する。
- DB write / DDL / production migration / Notion sync / 写真取り込みはしない。
- UI mock を作る場合も static / fixture のみ。Notion本文値、写真URL、個人情報値は fixture に入れない。

### P1: migration draft / apply なしの設計レビュー

- migration SQL はまだ書かない / apply しない。
- `company_profile_entries`, `member_profiles`, `company_history_events`, `media_assets` の責務境界、RLS方針、visibility enum、review gate は上記「P1 設計レビュー」を採用候補にする。
- `members`, `project_members`, `project_events`, `project_founding_members`, `project_ventures`, `private_wiki_entries` へ寄せる範囲は table 別境界の通り。既存 table への write は P3 dry-run 後。
- photo consent / usage permission のレビュー担当は未決。P2 admin UI では reviewer を明示できる form と `reviewed_by` / `reviewed_at` の自動記録を必須にする。

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
- external URL 発行前に `visibility='public_candidate'`, `status='approved_public'`, `usage_permission='public_ok'`, `reviewed_at`, `reviewed_by` を必須 gate にする。

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
