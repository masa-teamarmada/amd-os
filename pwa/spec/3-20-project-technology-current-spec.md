# 3-20 PJ技術台帳 (技術タブ) — current spec

> 正本。PJコックピットの「技術」タブと `project_tech_*` 2テーブルの現行仕様。
> 使い方は [`manual/2-3-pj-cockpit.md`](/manual/2-3-pj-cockpit) の「技術タブ」節。
> 追加: 2026-08-29 / migration `scripts/migrations/339_project_tech_ledger.sql`、初期データ `340_seed_project_tech_sx_cx.sql`

## 1. 目的とスコープ

技術に関する事実の置き場所。まさの依頼 (2026-08-29):

> SXだったら、シアノが何度から何度の温度帯で使えるのか、どの元素は取り込めるのか、pHはいくつからいくつまで使えるのか。
> CXだったら、磁気冷凍と気体冷凍の違いの説明とか、現状何度まで冷やせるのかとか、kiutraとかの競合との差が分かるような星取り表。

作る前の状態はこうだった。技術の事実は `project_knowledge` (category = `tech` / `term` / `competitor`) に
自由文の断片として毎朝貯まっていたが、**PJコックピットからは1件も読めず**、
ナレッジマップと通知にしか出ていなかった。数値の比較にも使えない。ここを構造化して置き場所にする。

`project_management_technical_tests` (週次管制のマイルストーン判定に使う試験) とは目的が違う。
あちらは「この試験をやって目標を満たしたか」、こちらは「この技術は今どういう性質を持つか」。
同じ実測値を二重の正本にしないため、試験の結果を技術タブへ載せるときは
`source_kind='measurement'` + `source_ref` に試験名を書き、値の正本は試験側に残す。

## 2. PJごとの違いをテーブルではなくデータで吸収する

**PJごとに必要なフォーマットは違うが、形は4種類しかない。** これが設計の中心。

| block_kind | 表示 | 何を置くか | SXの例 | CXの例 |
|---|---|---|---|---|
| `condition` | 成立条件の表 | 使える範囲。項目 × 下限/上限/単位/条件/確度/出典 | 水温・pH・光量・滞留時間 | REBCO細線の磁場性能・臨界温度 |
| `article` | 解説 (Markdown) | 原理・用語の説明。`topics.body_md` が本体 | 高熱性シアノで排水を処理するとは | 磁気冷凍と希釈冷凍機の違い |
| `matrix` | 星取り表 | 比較軸 × 相手。◎○△× + 実数値 + 根拠 | 既存の物理化学処理・生物処理との比較 | kiutra / LEMON / Bluefors との比較 |
| `record` | 到達実績の表 | 今どこまで行っているか。同じ項目を並べると推移 | 47L培養装置・TRL・排水サンプル | TESエッチング内製化・TRL |

PJごとに変わるのは「並べるトピックと項目名」だけで、テーブルもコンポーネントも共通。
**PJ専用のコンポーネントを作らないこと。** p25 専用の規程・内規タブと同じ形にすると、PJが増えるたびに実装が増える。

## 3. データモデル

列の正本は [`design/db_schema.md`](../design/db_schema.md)。ここは役割だけ書く。

| table | PK | 役割 |
|---|---|---|
| `project_tech_topics` | `tech_topic_id` (`ptt_*`) | トピック1件。形式・タイトル・1行説明・本文・技術区分・並び順・社外開示可否・出典 |
| `project_tech_entries` | `tech_entry_id` (`pte_*`) | トピックの中身1行。成立条件の1項目、星取り表の1マス、到達実績の1測定を同じ形で持つ |

`project_tech_entries` の使い分け:

| block_kind | row_label | col_label | 値 |
|---|---|---|---|
| `condition` | 項目名 (水温) | null | `value_min` / `value_max` / `unit`、列挙は `value_text` |
| `matrix` | 比較軸 (到達温度) | 比較相手 (kiutra) | `rating` (◎○△×) + `value_text` / 数値 |
| `record` | 測る対象 | null | 値 + `observed_on` |

- `tech_domain` はトピックを束ねる見出し。PJごとに自由な語彙を使う (培養 / 排水処理 / 磁気冷凍)。
  **区分の並びは五十音ではなく、その区分に入るトピックの `sort_order` の最小値順**。読ませたい順をデータで決めるため。
- `confidentiality` は `public` / `internal` / `confidential`。SXは株・培養条件・リアクター内部条件・光・二酸化炭素・pH・温度・滞留時間を
  初回面談では出さない方針 (2026-06-26 三浦工業MTG) なので、培養条件のトピックは `confidential`。
- **出典 (`source_kind` + `source_ref` + `source_url`) は全行に持たせる**。根拠のない数値は後から見た本人に消される。
  `source_kind` は `manual` / `l2_extraction` / `meeting` / `literature` / `vendor_spec` / `measurement` / `estimate`。
- `confidence` は `high` / `medium` / `low` / `unverified`。**空欄で放置せず「未測定」+ `unverified` を入れる**。
  何を調べていないかが表に出ることが目的で、空白のままだと調べたのか調べていないのかが読めない。
- 星取り表の列順は `entries` の登場順 (`sort_order` → `row_label`)。自社を左に置きたいので並べ替えない。
  **`sort_order` は行×列で一意に振る** (行10番台・20番台…、列は下1桁)。同値だと列順が不定になる。

RLS は3ポリシー規約どおり (`_member_read` = `amd_os_is_member()` / `_admin_all` = `is_admin()` / `_service_role`)。

## 3.4 食い違いは消さず、両方残して要確認にする

まさ確定 (2026-08-29):「そういう食い違いも、両方の情報とも記しておいたうえで、要確認って書いておいてほしい」

資料によって値が違うとき、**新しいほうを採って古いほうを消さない**。両方を出典つきで別の行として残し、
`needs_check` を立てて `check_reason` に「何を、誰に、いつ確かめるか」を書く。

`project_tech_entries.needs_check` / `check_reason` (migration 343) と、
`project_tech_topics` の同名の列。要確認にするのは次の3つ。

| 立てる場面 | check_reason に書くこと |
|---|---|
| 資料間で値が食い違う | 両方の値と出典、どちらを採るかで何が変わるか、いつ決めるか |
| 実測が無い (置き値・見込み) | 何を測れば確定するか |
| 訴求と外部の見方がずれている | 誰がどう見ているか (例: 自社は無振動を優位性に置くが、産総研G-QuATは振動を課題と見ていない) |

画面では、要確認の行は薄い琥珀の背景と行頭の `⚠`、値の下に赤字で理由が出る。
トピック見出しと画面上部に件数バッジが出るので、本文を読まずに「何件が未確定か」が分かる。
`confidence = 'unverified'` の行は migration 344 で機械的に `needs_check` を立てた。

## 3.5 値をどこから取るか (これを間違えた)

**`project_knowledge` だけを見て埋めない。** 初版 (migration 340) はこれをやって、
SXの培養条件を9項目すべて「未測定」、処理単価を2,500〜3,000円/m³ (2026-03-30の古い事業計画値) として入れた。
まさの指摘 (2026-08-29) —「これまでのMTGで何度も杉浦先生言ってるよ。だからnotionの文字起こしを見てと言ったの」
「SXの処理単価、めちゃくちゃ高くない? こないだちこちゃんが作ったコスト試算表見てないの?」

実測値は生データ側にある。技術タブを埋めるときは次の順で当たる。

| 見る順 | 場所 | 何が取れるか |
|---|---|---|
| 1 | `source_cache` の `gmeet_minutes` | MTGの文字起こし全文。研究者本人が数値を言っている一次情報。最長で3万字を超える |
| 2 | `source_cache` の `drive` | 試算表・報告書・提案書のテキスト。数値の一覧が表で入っている |
| 3 | `project_cost_*` (コスト試算タブ) | 単価・原価・前提。**金額は必ずここを正本にする** |
| 4 | `project_meeting_summaries.narrative_md` | 要約。数値は落ちていることが多い |
| 5 | `project_knowledge` | 断片。入口としては使えるが、これだけで表を埋めない |

`source_cache` は本文検索が効く。例:

```sql
select s.item_date::date, left(s.title,40), m[1]
from source_cache s, lateral regexp_matches(s.content_text, '(.{0,200}℃.{0,200})', 'g') m
where s.project_id = 'p21' and s.source in ('gmeet_minutes','drive');
```

**金額と単価はコスト試算タブの前提 (`project_cost_assumptions`) と食い違わせない。**
古いMTGの数字を技術タブへ書くと、同じPJの2つのタブが違う単価を主張することになる。
時系列で単価が動いた経緯を残したい場合は、`record` のトピックで「いつ何を根拠に動いたか」として並べる (SXの実例)。

## 3.6 単位の書き方

単位は記号で書く。**「立方メートル」と綴らない** (まさ確定 2026-08-29)。

| 使う | 使わない |
|---|---|
| `m³` `円/m³` `m³/h` | 立方メートル、立方m、m3 |
| `℃` `K` `mK` | 摂氏、度C |
| `mg/g-DCW` `g-DCW/L` | ミリグラム毎グラム |

上付きの3は `³` (U+00B3) をそのまま入れる。

## 4. API — `/api/project-tech`

`runtime = "nodejs"`。

| method | 認可 | 動作 |
|---|---|---|
| `GET ?projectId=` | `requireAuth()` | `{ ok, canEdit, topics, entries, fragments }`。3クエリを並列で1往復。`Cache-Control: private, max-age=60, stale-while-revalidate=300` |
| `POST { entity, row }` | `requireAdmin()` + `createAdminClient()` | PKを `<prefix>_<uuid12>` で自動採番。`project_id` 必須、topic は `title`、entry は `tech_topic_id` と `row_label` が必須 |
| `PATCH { entity, id, patch }` | 同上 | PKはpatchから除去。`updated_at` / `updated_by` を更新 |
| `DELETE ?entity=&id=` | 同上 | 物理削除。トピックを消すと中身も cascade で消える |

`entity` は `topic` / `entry`。

`fragments` は `project_knowledge` の `tech` / `term` / `competitor` を更新順に最大300件。
技術タブ下段の「まだ整理していない技術の断片」に出し、そこから上のトピックへ写して構造化する導線にする。

## 5. UI

- 実体: [`src/components/cockpit/CockpitTechnology.tsx`](../src/components/cockpit/CockpitTechnology.tsx) / 型とラベルは [`src/lib/project-tech.ts`](../src/lib/project-tech.ts)
- タブ配線: `CockpitView.tsx` の `CockpitTab` union と `tabs` 配列 (= 正本)、URL同期は `cockpit/page.tsx` の `NON_DEFAULT_TABS`。URLは `?tab=technology`
- 構成: 説明帯 (形式別の件数 + 区分フィルタ + adminの「＋トピック追加」) → 技術区分ごとのトピック → まだ整理していない技術の断片
- **参照系**。クライアントは [`src/lib/project-tech-client.ts`](../src/lib/project-tech-client.ts) のキャッシュ層だけを通し、画面から素の fetch をしない
  (guard: `scripts/check_reference_data_cache_contract.mjs` の `REFERENCE_DATA_ENDPOINTS` に登録済み)。
  タブ見出しの hover で `prefetchProjectTech()` を呼び、押した瞬間に表が出ている状態にする
- 値の表示は `formatTechValue()` が唯一の実装。`min` と `max` が両方あれば範囲、片方だけなら「以上」「以下」、
  **単一値は `min` = `max` を入れる** (片側だけだと「10T 以上」と誤って読める)
- 編集は `canEdit` (= `members.is_admin`) のときだけ。行の編集ボタンは既定で畳み、「行を編集 (N)」を押したときだけ出す
  (星取り表は24マスになるので、常時出すと表より場所を取る)
- 2026-09-01以降、技術は上段の`事業計画`グループに属する子タブ。子タブ列は`overflow-x-auto`と`whitespace-nowrap`で、狭幅でもラベルを途中で折らない。
  旧フラット列で技術を足して15枚になった時点の折返し問題は、二階層化により解消した

## 6. 投入済みデータ (2026-09-02 時点)

| PJ | トピック | 行数 | 主な出所 |
|---|---|---|---|
| p21 (SX) | 解説 / 培養の成立条件 / リアクターの運転条件 / 対象にできる物質 / 星取り表 / 単価と原価の推移 / 到達実績 | 62 | 2025-11-05 杉浦先生の文字起こし、★SolvioraX_m³換算版、SX_コスト試算 各版 |
| p20 (CX) | 解説 / 業界の実用化状況 / 到達温度の目標と限界 / 材料の成立条件 / 冷却パワーの打ち手 / 星取り表 / 競合製品の冷却パワー / 到達実績 | 77 | 面着打合せメモ、キックオフ会議メモ、Slack (LEMON調査・G-QuAT面会報告)、kiutra MTGアップデート、OIST審査用ピッチ資料 (2026-08-27) |
| p07 (LST) | 電解膜の運転条件と限界 / 原料ごとの前処理の成立条件 / 装置の到達実績 | 15 | 2026-09-02 LiSTie経営会議 (Notionローカル取り込み)、2026-08-26 LiSTie取締役会、2026-07-15 経営会議 |

初版 (340) との違いは §3.5 のとおり。SXの培養条件は「9項目すべて未測定」ではなく、
**培養温度 45〜70℃ / pH 7.5程度 / 二酸化炭素 0.03〜10% / 赤650nm・青440〜457nm** が
杉浦先生の指定値として 2025-11-05 の文字起こしに残っていた。

CXの到達温度も「未確認」ではなく、**NMR/MRI向け 100mK を FY2025 内に達成見込み、
量子コンピュータ向け 20mK はその次、方式の原理的限界はおおよそ 10mK** が一次情報にあった。

星取り表には自社に不利な事実も入れる。CXでは「産総研G-QuATでは希釈冷凍機の振動・熱の染み出しは
大きな課題として認識されていない」「大規模化の主流は1台への量子ビット集約」を注記として置いた。
訴求軸への反証を消すと、星取り表が営業資料になって判断に使えなくなる。

### CX 追記 (migration 352 / 2026-08-29)

OIST審査用ピッチ資料 (2026-08-27・全31枚、資料室 > ピッチ資料) の技術情報を入れた。
トピックを3つ足し (`ptt_cx_industry` / `ptt_cx_power` / `ptt_cx_rivalspec`)、星取り表へ **冷却パワー** の軸を加えた。

冷却パワーは資料の技術ストーリーの中心なので軸として独立させた。入れてみて分かるのは、
100mK での冷却パワーが **kiutra ≦1µW に対し Bluefors は 450〜3,000µW** と桁で違うこと、
そして **自社の冷却パワーには実測値がない** こと。磁気冷凍がどこで負けているかが表に出る。

§3.4 のとおり食い違いは両方残した。CXで立てたのは次の2つ。

| 食い違い | 残し方 |
|---|---|
| 連続運転の到達温度が **126mK** (2026-06-16 NIMS桜MTG) と **120mK** (資料 p14) | 別の行として両方置き、双方 `needs_check`。資料 p14 の出典が2021年 MT27 の概念設計発表で実証時期と結びついていない点も `check_reason` に書いた |
| ヘリウム3が **完全に不要** (既存の星取り表) と **使用量 1/1000以下** (資料 p12、＝ゼロではない) | 星取り表のセルは値を残したまま `needs_check` を立て、資料側の数値は `ptt_cx_power` の行として別に置いた |

金額は §3.5 のとおりコスト試算タブが正本なので、資料 p30 の機種別価格はここへ持ち込んでいない
(資料内の kiutra 価格は社内ヒアリング由来の非公開情報でもある)。

### LST 追記 (2026-09-02)

まさの依頼「どういうハードルがあって、どれを超えると事業が成立するのかを格納できるようにしてほしい」に対して、
**技術タブと `project_management_technical_tests` の両方へ入れた**。§1 の使い分けどおり、
性質は技術タブ、判定は試験側、値の正本は試験側に置いて技術タブから `source_ref` で指している。

中心は**電解膜の通電電流**である。連続通電では 10A で抵抗増加が不可避で、間欠運転 (4秒印加・2秒休止) にすると
5A (実効 3.3A) まで通り、抵抗値の上昇が観察されない。**実効 3.3A で事業が成立するかを次の技術検討会 (約2か月後) までに
精査する**ことが決まっており、これが分岐点になる。判定が出た時点で BZM 3.0 の証拠水準と変換能力を測り直す
(`model/cases/p07_lst.md` §6.3)。

出所は Notion の議事録で、まだ OS へ取り込まれる前の書き起こしを `scripts/h1_local_notion_fallback.mjs` で
ローカルの Notion データベースから読んだ。**Notion アプリが開いていると SQLite がロックされる**ので、
`--db` にコピーを渡して読む。

## 7. 未接続 (次の一手)

| 項目 | 状態 |
|---|---|
| 議事録からの自動抽出 | 未接続。いまは `project_knowledge` の断片を人が写す。抽出器が `condition` の項目と数値を候補として直接積むところまで進める |
| 到達実績と `project_management_technical_tests` の接続 | 未接続。試験結果を `source_ref` で参照し、値の二重管理を避ける配線を入れる |
| PJワークスペース (社外向け) への露出 | 出さない。`confidentiality` を持たせてはあるが、外部ワークスペースアカウントへ見せる導線は作っていない |
