# Atlas 政府方針シグナル収集 — 設計ログ

## 2026-04-30: 構想と設計確定

### 背景
Atlas は web_search ベースで「世界のマクロトレンド」を捕捉できるようになったが、AMD の事業判断には**日本政府の方針・政策動向**が同じくらい重要。
- 政府が方針を決めると → 補助金が増える、議員ロビイングが通りやすくなる、業界全体の追い風 / 向かい風が明確化
- 例: 水素戦略、風力発電政策、AI推進方針、工業廃水規制、リチウム回収義務化など
- マクロトレンド × 政府方針 × 技術シーズ の3情報群が揃えば「いまどんな DTSU を立ち上げるべきで、最適なシーズはこれだ」が出せる

### 方針確定（議論結果）
1. **既存 atlas_signals テーブルに同居**（PJ/topic 階層化禁止の方針徹底、tag 横串で扱う）
2. **直近3か月のみまずは抽出**（過去10年 backfill は後フェーズ）
3. **収集パイプラインはガチ案**（省庁公式ソース直接 fetcher、web_search 任せにしない）
4. **policy 識別**: `source_type='policy'` + `metadata jsonb` で省庁・文書種別・発表日を構造化保存

---

## 情報源（Tier 1 全部入れる）

### 省庁 RSS / プレスリリース
- 経済産業省（エネルギー、産業政策、補助金）
- 環境省（規制、循環経済、気候変動）
- 厚生労働省（医療、バイオ、労働）
- 国土交通省（インフラ、モビリティ、建築）
- 内閣府（戦略文書、有識者会議）
- 首相官邸（閣議決定、首相動静）
- 農林水産省（食・農・水産）
- 文部科学省（科学技術、研究開発）
- 総務省（ICT、地方創生）
- 財務省（予算、税制）
- 防衛省（安全保障、防衛装備）
- 金融庁（金融規制）

### 戦略的に重要
- e-Gov パブリックコメント（法令改正の予兆）
- NEDO / JST / AMED（補助金公募・大型R&D）

### 後回し（Phase 2 以降）
- 国会会議録 API
- ndl-search 白書類
- 都道府県発表

---

## パイプライン構造

```
[1] 省庁ソース別 fetcher
    └─ RSS取得 or HTMLスクレイプ
       → URLリスト + メタ（発表日・省庁名・文書種別）

[2] dedup 一次防御
    └─ source_url 完全一致を atlas_signals から除外

[3] Gemini filter（軽量・無料枠）
    └─ Gemini 2.5 Flash でタイトル+抜粋から「事業判断に効くか」二値判定
       → 80-90% を弾いて Tier1 のシグナルだけ残す

[4] 本文取得 + 要約（Claude Sonnet 4.6）
    └─ HTML概要を取得 → 200-400字の AMD 視点要約
       → domain 推定 + tags 推定 + importance 判定

[5] PDF 取得（重要度high & 戦略文書のみ）
    └─ Anthropic document content block で PDF 直接 input
       → 詳細な要約を再生成（ライブラリ不要）

[6] dedup 二次防御
    └─ ministry × announced_at × タイトル類似度 で省庁横断重複検出

[7] attachStory で既存ストーリー紐付け or 新規

[8] atlas_signals に投入
    source_type='policy'
    metadata = { ministry, doc_type, announced_at, raw_url, has_pdf }
```

---

## DB 変更

```sql
-- atlas_signals 拡張
ALTER TABLE atlas_signals
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- source_type は text なので新値 'policy' を入れるだけで OK（CHECK 制約なし想定）

-- 重複防御の補助インデックス
CREATE INDEX IF NOT EXISTS idx_atlas_signals_source_url
  ON atlas_signals(source_url);

CREATE INDEX IF NOT EXISTS idx_atlas_signals_metadata_ministry
  ON atlas_signals((metadata->>'ministry'));
```

`source_url` の UNIQUE 制約は付けない（同じ URL を複数 PJ で文脈別に登録する余地を残す。dedup はアプリ側でやる）。

---

## コスト試算（月額）

| パート | モデル | 件数想定 | 月額 |
|---|---|---|---|
| filter | Gemini 2.5 Flash | 200件/日 = 6000件/月 | 無料枠内 |
| 本文要約 | Claude Sonnet 4.6 | 40件/日 = 1200件/月 | 約2,700円 |
| パブコメ追加 | 同上 | 2-3件/日 = 90件/月 | 約200円 |
| PDF取得 | Sonnet（document） | 月20-50件 | 約500-1,000円 |
| **合計** | | | **約3,000-4,000円/月** |

---

## Cron 構成

| パス | スケジュール | 用途 |
|---|---|---|
| `/api/cron/atlas-collect` (既存) | 23:00 UTC = 08:00 JST | マクロニュース（web_search） |
| `/api/cron/atlas-collect-policy` (新規) | 22:00 UTC = 07:00 JST | 政府方針（直接 fetcher） |

初回手動キックで `?from=2026-02-01` を渡して直近3か月一気取り込み。以降は前日分のみ毎朝。

---

## ファイル構成

```
src/
  lib/
    atlas-policy-sources.ts    ← 省庁 fetcher 集（RSS パース、HTMLパース）
    atlas-policy-filter.ts     ← Gemini filter
    atlas-policy-extract.ts    ← Sonnet 要約 + タグ + メタ
    atlas-policy-pdf.ts        ← PDF 取得（重要度high）
  app/api/cron/
    atlas-collect-policy/
      route.ts                 ← cron entrypoint（?from= で初回キック対応）
scripts/migrations/
  003_atlas_metadata.sql       ← DDL
```

---

## 開いた論点 / 後フェーズ

### Phase 2（次セッション以降）
- [ ] **経産省 RSS** が Vercel から fetch できない（WebFetch でも timeout）
  - 別実装案: 経産省プレス HTML ページを Gemini パース、または別の経産省サブサイト RSS（e.g. 関東経済産業局）から取得
- [ ] **環境省** は HTML パースだが env のページ 200KB+ で fetch+Gemini が遅く Phase 1 では除外
  - 別 cron で daily 1回だけ fetch する形に分離
- [ ] **e-Gov パブリックコメント** 取り込み（公式 RSS 一覧ページが 403、別経路要調査）
- [ ] **過去2か月分（〜2026-02）の backfill**
  - 各省庁の press archive HTML をスクレイプして補完（RSS は 1か月分しか持たない）
- [ ] 過去10年 backfill（パイプラインが安定してから）
- [ ] 都道府県・地方自治体の重要発表
- [ ] 国会会議録・法令データベース統合
- [ ] policy シグナルの専用UI（時系列ビュー、省庁別ピボット）
- [ ] 技術シーズリスト統合 → DTSU 提案エンジン

## 2026-04-30: Phase 1 投入結果

- 対象期間: 2026-01-01 〜 2026-04-30（直近1か月分が RSS 範囲）
- 投入結果: **125 シグナル / 65 ストーリー / 重要度 high 18件**
- 稼働 Source: 厚労省・国交省・内閣府・首相官邸・文科省（5省庁）
- 経産省・環境省・パブコメは Phase 2 課題

### Vercel Function 実測タイミング（limit=30 想定）
- fetch: 1秒（RSS のみ、env 除外）
- dedup: 0.3秒
- filter: 25-30秒
- extract: 60-100秒（並列度4、Sonnet 4.6）
- attachStory + insert: 50-70秒（並列度4）
- 合計: 約 140-200秒（300秒以内）

### Phase 1 で得た教訓
- env (環境省) HTML パース → Gemini 投入は1ソースだけで100秒越えで cron 全体を死なせる
- LLM が UUID を歪めて返すケースがある → 正規表現と候補リスト照合で必ず validate
- 経産省は Vercel データセンター IP からのアクセスを timeout する可能性（要再調査）
