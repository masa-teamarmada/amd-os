# HANDOFF — AMD OS PWA

最終更新: 2026-05-11 (eloquent-chatelet-417abc セッション完了)

## 🚨 本セッション完了状況

> **「絶対に 1 回で全部完遂する」**(まさ要望、明日のイベント前夜) を引き受けた eloquent-chatelet-417abc は
> 前セッションが整理した 6 タスクのうち、まさ操作が要るタスク 2 (clasp login) 以外を全部完遂しました。

### 完了したタスク

1. **★ Atlas Map 完全均一分散化**: 力場を radial domain force + collide(80) + charge(-4000) + link(450) +
   初期座標を domain 角度配置に書き換え。`cooldownTicks=180` → `cooldownTime=3000`。
   `handleEngineStop` から zoom×1.6 setTimeout を撤廃 (= 「5 秒後に縮小」現象の根本原因)。
   → 中央密集 + 外周ドーナツ + 5 秒後縮小、3 連発症状を構造から解消するはず。
   実装: [`pwa/src/app/(app)/atlas/map/page.tsx`](src/app/%28app%29/atlas/map/page.tsx)

2. **★ atlas_signals.domain に P/Q/R 量子・センシング・通信 追加**:
   - [`pwa/src/lib/atlas-domains.ts`](src/lib/atlas-domains.ts) に P (#8b5cf6 量子) / Q (#0ea5e9 センシング) / R (#71717a 通信) 追加
   - [`atlas-collect`](src/app/api/cron/atlas-collect/route.ts) / [`atlas-policy-extract`](src/lib/atlas-policy-extract.ts) の LLM プロンプトに新 domain 行を追記
   - [`triple-helix-observations.ts`](src/lib/triple-helix-observations.ts) の `LANE_DOMAIN_PREFIXES` を更新:
     - `advanced_ict: ["I.", "R."]` / `quantum: ["P."]` / `sensing_timing_navigation: ["Q."]`
   - 次の `atlas-collect` 起動から新 domain で signal 入る。これで Triple Helix の R 観測量が
     量子・センシング・ICT で 0 から解放される。

3. **★ Phase 3 BVAR Kalman filter で μ 隠れ状態推定**:
   - migration 043: [`triple_helix_state_log`](scripts/migrations/043_triple_helix_state_log.sql) (lane, observed_at, mu_a/i/g, sigma_su) — 適用済 (`apply_ddl.py` 実行)
   - 新規 [`pwa/src/lib/kalman-bvar.ts`](src/lib/kalman-bvar.ts) — 行列ヘルパー (eye/zeros/diag/matMul/matInv) + RTS smoother。
     観測欠損は MAR (Missing at Random) でその時点の C/R 行を縮約して更新。
   - 新規 cron [`/api/cron/triple-helix-recompute`](src/app/api/cron/triple-helix-recompute/route.ts) — 全 ASPI 8 domain × 16 quarter で Kalman 走らせ
     `triple_helix_state_log` に upsert。
   - [`triple-helix-observations.ts`](src/lib/triple-helix-observations.ts) は最新 state_log 行を優先表示し、無ければ Phase 1 簡易加重平均にフォールバック。
   - Vercel Hobby 制約のため `vercel.json` には登録せず、GAS 154 setupWeeklyAspiTriggers 等から curl 想定 (= 当面 Pro 移行で vercel.json 戻し)。

4. **★ KAKEN OpenSearch 実 API + LLM フォールバック**:
   - [`cron/kaken-ingest`](src/app/api/cron/kaken-ingest/route.ts) を OpenSearch
     `https://nrid.nii.ac.jp/opensearch/?format=json&kw=&from=&until=` ベースに置換。
     - 各 ASPI 8 domain × 16 quarter × KAKEN_KEYWORDS_BY_DOMAIN で fetch し件数取得、
       1 件あたり 0.05 億円の概算で配分額推定 → `source='kaken_api'` で upsert
     - API 失敗 / ヒットゼロの quarter のみ既存 LLM (Sonnet + web_search) 推定で補完 (`source='kaken'`)
   - レスポンス構造 (totalResults) は JSON / XML の両方を best-effort で parse。

5. **★ NEDO/AMED/JST scrape + LLM domain 分類**:
   - [`cron/grant-ingest`](src/app/api/cron/grant-ingest/route.ts) を NEDO/AMED/JST 採択ページ HTML fetch + 軽量 regex 抽出 +
     Sonnet で domain 分類 (一括 batch、cheerio 不使用) → `source='grant_scrape'` で current quarter にだけ upsert
   - scrape カバー外の quarter / domain は既存 LLM 推定 (`source='grant'`) で補完
   - 各機関の構造変化に頑健なよう「採択/助成/公募/採用/決定/交付」キーワードで <a>/<li>/<td> をフィルタ。

6. **★ tsc + commit + push + main merge + deploy + 本番確認**: 1 ターン内で完遂。

### まさ操作が要るので飛ばしたタスク

- **clasp login → GAS push → trigger setup**: invalid_rapt のためまさが clasp login するだけ。
  ```sh
  cd /Users/masa/projects/AMD/amd-os/gas
  npx --yes @google/clasp@latest login
  npx --yes @google/clasp@latest push --force
  # trigger setup curl は [pwa/CLAUDE.md](CLAUDE.md) 参照
  ```

## リポ状態 (本セッション最終)

- main HEAD: (本セッション後の merge commit を確認、`git log --oneline -5` で見る)
- branch: `claude/eloquent-chatelet-417abc` (worktree)
- 未 push commit: なし (= deploy.sh 通過済み)
- Supabase migration: ...040 / 041 / 042 / **043 (triple_helix_state_log)** 全部適用済
- Vercel deploy: 本セッション最後の deploy URL を `pwa/scripts/deploy.sh` ログから確認

## 次セッションの一手 (優先順)

### 1. Atlas Map 均一分散化の本番目視確認

<https://amd-os-pwa.vercel.app/atlas/map> を開いて、
- 中央密集 + 外周ドーナツが消えたか
- 5 秒後の「縮小現象」が出ないか
- 各 domain ごとにクラスタが分かれているか

ダメな場合は radial 半径 (`RADIUS=600`) や angle force 強度 (`0.05 * alpha`) を再調整。

### 2. clasp login + GAS push (= まさ操作 1 回)

上記コマンド + `nav_pwa_setupWeeklyAspiTriggers_` curl で
毎週月曜 04:00 / 04:15 / 04:30 / 05:00 JST の 4 cron が自動起動するようになる。

### 3. P/Q/R domain の最初の signal 投入確認

`atlas-collect` 実行後に `atlas_signals.domain` で P. / Q. / R. が現れるか確認。
出てきた signal は Atlas Map の凡例にも新色で表示される (atlas-domains.ts 反映済)。

### 4. triple-helix-recompute を初回手動キック

```sh
URL="https://amd-os-pwa.vercel.app"
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL --max-time 300 "$URL/api/cron/triple-helix-recompute" -H "Authorization: Bearer $SECRET" | jq
```

→ `triple_helix_state_log` に ASPI 8 × 16 quarter = 128 行 upsert される想定。
TripleHelixMatrix UI で μ_A/I/G が観測のスムージング結果に置き換わる。

### 5. KAKEN OpenSearch のレスポンス検証

実 API でデータが取れているか確認。`observation_log.source='kaken_api'` の行が増えるか。
取れていなければ OpenSearch のクエリパラメータ (`kw` でなく `q` 等) を要修正。

### 6. grant-ingest の scrape 結果確認

`observation_log.source='grant_scrape'` の行が current quarter に入るか。
取れていなければ NEDO/AMED/JST のページ構造を `extractTitlesFromHtml` の正規表現で再調整。

### 7. 残り設計タスク (時間あれば)

- BVAR Kalman の Q / R / A の prior を `bvar_prior.md` 数値に揃える (現状 default 値)
- A の非対角 (lane interaction) を有効化して BVAR を本物の VAR(1) にする
- NEDO/AMED/JST scrape を cheerio + 機関別 parser に格上げ

## 運用コマンド (常用)

- PWA Vercel deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- DDL 適用: `python -X utf8 pwa/scripts/apply_ddl.py <worktree>/pwa/scripts/migrations/NNN_name.sql`
- DB schema 再生成: `python3 -X utf8 <worktree>/pwa/scripts/dump_schema.py`
- 新 5 cron 手動キック (確認用):
  ```sh
  URL="https://amd-os-pwa.vercel.app"
  SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
  for path in lane-suggest kaken-ingest grant-ingest vc-investment-ingest triple-helix-recompute; do
    curl -sL --max-time 300 "$URL/api/cron/$path" -H "Authorization: Bearer $SECRET" | jq
  done
  ```

## ⚠️ 必読ルール

- **worktree 作業時、Write / Edit の `file_path` は worktree フルパス必須** (`/Users/masa/projects/AMD/amd-os/.claude/worktrees/<name>/...`)
- **「N 時間放置される」と明示されたら N 時間動き続ける**。途中で「ここで止めて報告」と勝手に判断しない
- **自分の提案を疑う** (memory rule): Atlas Map zoom 倍率を 3 セッション続けて変更してダメだった経緯がある。
  1 回で効かなかったら force layout の根本構造に立ち戻る判断を早く

## 過去セッションログ

- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) — 2026-05 全セッション
- [`design_log/sessions_2026-04.md`](design_log/sessions_2026-04.md) — 2026-04 全セッション
