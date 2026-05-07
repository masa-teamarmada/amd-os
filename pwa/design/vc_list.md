# 2026-05 VC List 設計ログ

国内ディープテック VC を「AMD が把握する VC マスタ」として PWA に統合した。

## 動機

- AMD は複数 PJ で VC とやりとりするが、誰が・どの VC と・どの号ファンドの・どんな段階でやりとりしてるかが分散していた
- VC ごとの最新ファンド状況 (募集中? クローズ済? DPE残?) を把握すると PJ 側のラウンド設計判断が早くなる
- VC 担当から直接聞いた DPE 情報など、口頭で消えていく情報を残したい

## 確定方針

- **データソース**: 自動収集が骨格 (cron + web_search)、つくよみ chat / 手入力は補完
- **Atlas との分離**: VC のファンドレイズは「世界マクロ」ではない。Atlas に混ぜると雑音になるので完全別系統 (`vc_news` テーブル)
- **関係モデル**: `support_org_members` (PJ 立ち上げ前メンバー、GAP 事業化推進機関等) は VC を投資家として扱う関係には流用しない。`vc_contacts` + `project_vc_relations` を新設
- **DPE 出所**: `dry_powder_source` 列で `estimated` / `heard_from_contact` / `public_disclosure` を区別。担当から聞いたら `heard_from_contact` + `dry_powder_heard_from` (vc_contacts.id) で誰から聞いたかも残す
- **可視性**: AMD メンバー全員が全フィールド閲覧可。role gate なし
- **AMD 内部評価**: `vcs.amd_rating` (★1-5) + `amd_rating_note` で「うちにとっての相性」を手動付与。ソートに使える
- **CRUD**: つくよみ chat 経由がベース、`/vcs/[id]/edit` 手入力は補完
- **初期投入**: `POST /api/admin/seed-vcs` で Claude + web_search に国内ディープテック VC を一括生成させて upsert。再実行可
- **海外 VC**: 当面スコープ外 (国内のみ)

## スキーマ概要

`scripts/migrations/016_vc_list.sql` 適用済。

| テーブル | キー | 役割 |
|---|---|---|
| `vcs` | id, name (UNIQUE) | VC 本体 + amd_rating |
| `vc_funds` | (vc_id, fund_no) UNIQUE | ファンド単位 + DPE残 |
| `vc_investments` | id | 出資イベント。`our_project_id` で自社 PJ にリンク可 |
| `vc_contacts` | id | VC 担当者 |
| `project_vc_relations` | (project_id, vc_id) UNIQUE | PJ × VC のステータス管理 |
| `vc_news` | (vc_id, source_url) UNIQUE | VC ニュース。verified=採用 / dismissed=ノイズ |

詳細は migration ファイル参照。

## ルーティング

- `/vcs` リスト (ソート: 接点数降順 default、最終接触 / DPE残 / ★ / vintage / 名前)
- `/vcs/[id]` 4 ペイン詳細
- `/vcs/[id]/edit` 手入力 CRUD
- `/vcs/inbox` 未確認ニュース受信箱

GlobalNav に「VC」を Venture Map と Admin の間に追加。inbox 未確認件数バッジ付き。

## 自動収集 cron

`/api/cron/vc-news-ingest` 毎朝 09:00 JST (UTC 00:00)。

flow:
1. `vcs` を `amd_rating` 降順 + `updated_at` 古い順で 25 社取得 (round-robin)
2. 各 VC ごとに Claude Sonnet 4.6 + `web_search_20250305` で直近 7 日のニュースを 0-5 件取得
3. `vc_news` に `verified=false` / `ingested_by='web_search_cron'` で投入
4. `kind` ∈ {fundraise, fund_close} の場合は `suggested_fund_patch` JSONB に「このファンドをこう更新したらどうか」を埋める
5. `/vcs/inbox` で人が verify / dismiss / 「ファンド反映」ボタン 1 クリックで `vc_funds` に反映

## つくよみ統合

`/api/tsukuyomi/chat` route に VC tool 群を追加 (PJ コックピット外でも使える):

- `upsert_vc` `upsert_vc_fund` `update_vc_dry_powder`
- `add_vc_investment` `add_vc_contact` `add_vc_news` `link_project_vc`

ページ context: `page_path` が `/vcs/[uuid]` で始まれば `loadVcContext()` で当該 VC の vc/funds/investments/contacts/relations/recent_news を system prompt に同梱。

例: 「Abies Ventures 2号ファンド80億で2026/5月にクロージング」と雑談に書くだけで:
- `upsert_vc_fund(vc_name='Abies Ventures', fund_no=2, size_jpy=8000000000, status='raising', target_close_at='2026-05-31', ...)`
- `add_vc_news(kind='fundraise', title='Abies Ventures 2号ファンド募集...', occurred_on='2026-04-XX', source_url='...')`

の 2 ステップで反映される。

「Abies の 2 号担当の田中さんから残り30億って聞いた」と書けば:
- `add_vc_contact(vc_name='Abies Ventures', name='田中')` (なければ)
- `update_vc_dry_powder(vc_name='Abies Ventures', fund_no=2, dry_powder_jpy_low=3000000000, dry_powder_jpy_high=3000000000, source='heard_from_contact', contact_name='田中')`

## 初期投入手順

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://amd-os-pwa.vercel.app/api/admin/seed-vcs
```

Claude + web_search に「国内ディープテック VC 25-40 社」を JSON で生成させて `vcs` / `vc_funds` / `vc_investments` を upsert。重複 (name 一意) は更新、新規は insert。`amd_rating` は人が付与する想定なので seed では触らない。

再実行で各 VC の最新ファンド情報・portco を更新可能。

## 主な設計トレードオフ

- **ファンドサイズ vs DPE 残**: 公表値 (size_jpy) と推定値 (dry_powder_jpy_low/high) を別列で持つことで「ファンドサイズは公表 / DPE残は推定 or 直聞き」を明確に分離
- **`our_project_id` 二重管理**: 投資成立時は `project_vc_relations.status='invested'` と `vc_investments.our_project_id` の両方が立つ。前者は関係履歴、後者は実出資イベント。コンセプトが違うので冗長を許容
- **vc_news と Atlas の独立**: 同じ仕組みを使い回す案もあったが、Atlas は世界マクロを俯瞰する視点で VC 個別動向は雑音になるので分離
- **★相性評価の更新者記録**: `amd_rating_updated_by` (members.member_id) と `amd_rating_updated_at` で「誰がいつ付けたか」を残し、合議的な変更も追跡可能

## 残作業 / Future

- 海外 VC への拡張 (US ディープテック / 欧州気候系) — 必要になったら `type='overseas'` で枠は既にある
- VC × seeds ラインのマッピング (どの VC がどのレーンに張ってるか) — `stage_focus` だけでは粗い、`lane_focus` 列を追加検討
- 受信箱の一括 verify / dismiss (Atlas inbox 風) — 件数が増えてきたら
- vc-news-ingest を amd_rating 高い VC は毎日、低い VC は週次のハイブリッドに (現状は全て daily round-robin)
