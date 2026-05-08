# Seeds — 研究シーズリスト

> **AMD の Before 0 起点となる外部技術シーズマスタ**。VC List の研究機関版。
> AMD のコア能力 3 本柱の一つ「大学連携ネットワーク」を OS 上に可視化する。

---

## 動機

- AMD は Before 0 (技術はあるがビジネスを知らない研究者を起業家に変える) フェーズに特化している ([amd_value_model.md](/Users/masa/projects/knowledge/amd_value_model.md))
- そのため「全国の大学・国研・高専のどこに、事業化できそうなシーズがあるか」を網羅・優先順位付けする一次情報マスタが必要
- これまでは個人の頭の中・Slack の断片・スプシで分散していた
- AMD OS ビジョン ([amd_os_vision.md](/Users/masa/projects/knowledge/amd_os_vision.md)) では将来 URA/EIR が当事者として参画する基盤になる予定。Phase 1 は AMD 内部、Phase 2/3 で URA に開放

## 流れ (status 遷移)

```
candidate(候補) → investigating(調査中) → contacted(接触済) → discussing(協議中) → spun_off(PJ化) / declined(見送り)
```

シーズリストから具体的な協議が始まり、一部が AMD の PJ になっていく。`spun_off_project_id` で `projects` に紐付け。

## 設計判断 (確定)

| 論点 | 確定方針 | 理由 |
|---|---|---|
| 主な使い手 | **Phase 1 = AMD 内部**、Phase 2 で URA 公開、Phase 3 で対外ショーケース | 段階拡張。`is_public` 列で将来の公開切替が可能 |
| シーズの単位 | **案件単位 (技術 × 応用先)** | "シアノバクテリア排水処理" のように、PI が複数案件を持てる |
| データ構造 | **単一テーブル `seeds`** に機関・PI・シーズを 1 行で保持 | UI 上ひとつのリストで「機関で検索」「PI で検索」「シーズで検索」が完結。表記ゆれ正規化は将来課題 |
| サブデータ | **別テーブルに分割** (`seed_funding` / `seed_news` / `seed_contact_log`) | 検索性・cron ingest しやすさ。UI は 1 リストで完結する原則は満たす |
| 旧 `seeds` テーブル (006_venture_map.sql で作られた予兆 4 件用) | **drop して再構築** | 既存 4 行の中身は実態と合っていなかった (工学院大エコシステム = エコシステム業務、CX/SX = 既に PJ 化済)。Venture Map の予兆プロット (黄色点滅) も意味不明だったので削除 |
| 収集方法 | **Phase 1: 手動 + つくよみ chat 経由** → Phase 2: 公的採択 DB ingest (NEDO/AMED/JST GAP/A-STEP) → Phase 3: researchmap / OpenAlex 発掘 cron | 段階拡張。最初から全部やると母集団がぼけて使われない |

## スキーマ

migration: [024_seeds_overhaul.sql](../scripts/migrations/024_seeds_overhaul.sql)

| テーブル | 役割 |
|---|---|
| `seeds` | シーズ本体 (機関 + PI + シーズ情報を 1 行) |
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等) |
| `seed_news` | 関連ニュース・論文・プレス (Atlas とは別系統) |
| `seed_contact_log` | AMD メンバー × シーズ の接触履歴 |

### `seeds` の主要列

```
識別:           title, summary
機関:           org_name, org_type, org_region, org_url
研究者:         researcher_name, researcher_title, lab_name, researcher_url
分類:           domain_lane (gx_energy/gx_circular/life/materials/robo/ict/other),
                industry_target[], keywords[]
成熟度:         trl, brl, hrl (0-9)
AMD 視点:       status, amd_rating (1-5), amd_owner_member_id, next_action,
                internal_notes (非公開), public_summary, is_public
関連:           spun_off_project_id (FK projects), source, source_detail
```

### RLS

`016_vc_list.sql` / `017_vc_rls_writes.sql` と同じパターン (4 テーブル全部):
- `anon_read` (SELECT 全開)
- `authenticated_all` (auth.uid() IS NOT NULL なら ALL)
- `service_role_bypass` (cron route 用)

## ルーティング

| パス | 役割 |
|---|---|
| `/seeds` | リスト画面 (検索 / フィルタ / ソート / 行クリックで `SeedDetailModal`) |
| `/seeds/[id]` | 単独詳細ページ。直接 URL アクセス用フォールバック (リスト画面で開く Modal を full-page で表示) |

GlobalNav に **Seeds** を Venture Map と VC の間に追加 ([GlobalNav.tsx](../src/components/nav/GlobalNav.tsx))。

## UI

### `/seeds` リスト

- **テーブル列**: シーズ / 機関 / PI / 領域 / 成熟度 (TRL/BRL/HRL) / 状態 / ★ / 担当 / 次の一手 / 最終接触 / 助成計
- **フィルタ**: status (デフォルト: アクティブ = PJ化/見送り を除外) / 領域 / 担当 / フリーテキスト (シーズ・機関・PI・キーワード)
- **ソート**: 列クリックで切替 (デフォルト: 更新日 desc)
- **新規作成**: 右上「+ 新規シーズ」ボタン → `SeedDetailModal` を createMode で開く

### `SeedDetailModal` (詳細 + 編集 + 削除)

- リスト行クリックで開くオーバーレイ
- **詳細モード**: 4 セクション (シーズ概要 / 機関・研究者 / AMD 評価 / 関連・ソース) + サブセクション 3 つ (補助金 / 接触履歴 / ニュース)
- **編集モード**: 編集ボタンで全フィールド inline form に切替。保存 / キャンセル
- **サブセクション CRUD**: 補助金・接触履歴・ニュースは「+ 追加」ボタン → 軽量 form。削除は ✕ ボタン

## 実装メモ

### Phase 1 で実装済 (2026-05-08)

- migration 024 (旧 seeds drop + 新 schema 4 テーブル)
- Venture Map から旧 seeds 依存を全削除
  - `fetchSeedsForMap` 削除、`SeedRow` 型削除
  - `fetchSnapshot()` 引数から seeds 削除
  - `LaneSnapshot` の seeds 列削除、グラフ予兆プロット削除
  - View B テーブルの「シーズ在庫」列削除
  - `compositeScore` の重みを `0.4 macro + 0.2 papers + 0.2 policy + 0.1 invest + 0.1 seeds` から `0.4 + 0.2 + 0.2 + 0.2` に再正規化 (seeds 0.1 を invest に振替)
- types/seeds.ts + lib/seeds-data.ts
- /seeds リスト画面 + SeedDetailModal + /seeds/[id] フォールバックページ
- GlobalNav に Seeds 追加

### Phase 2 (TODO)

- **公的採択 DB ingest cron**: NEDO 課題解決型 / AMED 橋渡し / JST GAP / JST A-STEP / JST CREST / 内閣府 SBIR の採択リストを cron で取り込み、`seed_funding` に upsert。新規シーズなら inbox 投入
- **`/seeds/inbox`**: 自動収集された未確認シーズの受信箱 (vcs/inbox と同様)
- **既存 PJ から逆引き seed 化**: `project_ventures.origin_org` / `origin_pi` を参照して、既存 9 PJ の起源を seeds に登録 (status='spun_off')

### Phase 3 (TODO)

- **researchmap / OpenAlex 発掘 cron**: 機関 × 領域別に Claude + web_search で「注目シーズ候補」を生成 → inbox
- **つくよみ chat tool 群**: `upsert_seed` `update_seed_status` `add_seed_funding` `add_seed_contact` 等
- **URA/EIR 公開**: `is_public=true` のシーズだけを別認証で公開閲覧可能にする
- **機関別ダッシュボード**: `/research-orgs/[org_name]` で機関単位の seeds 一覧 (現状は `/seeds?org=...` フィルタで代替)

## トレードオフ・残課題

- **機関名・PI 名の表記ゆれ**: 単一テーブル方針なので「愛媛大学」「愛媛大」が混在し得る。Phase 2 で正規化マスタ追加を検討
- **Venture Map との連動**: 旧 seeds は Venture Map のグラフ予兆 / レーン別 seedScore に使われていた。新 seeds は意味が違う (AMD 視点の事業化候補) ので Venture Map からは切り離した。将来「AMD が手がけそうなレーン」を Venture Map に再投入したくなったら、新 seeds から `domain_lane` × `amd_rating>=4` を集計して再接続できる
- **`milestone_responsibility` のような複数担当**: 現状 1 シーズ = 1 AMD owner。Phase 2 で `seed_owners` 表を切るか検討
- **PJ 化済みシーズ**: status='spun_off' になった seeds はリストの「アクティブ」フィルタで除外される。それでも検索可能ではあるので情報資産として残る
