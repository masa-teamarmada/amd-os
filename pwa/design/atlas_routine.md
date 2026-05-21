# Atlas-collect Routine / Codex automation 化 — Anthropic API 課金を subscription 枠に移す

最終更新: 2026-05-16

## 背景

- 既存 `/api/cron/atlas-collect` は Anthropic API 直叩き (Sonnet 4.6 + web_search + Haiku auto-tag) で月 ~¥3,000-5,000
- 同じ処理を Claude subscription (Pro/Max) の Routine で動かせば、web_search 部分の API 課金が消える (auto-tag / attachStory の Anthropic 課金は受け口 API で継続)
- 削減率: 推定 **70%**
- 2026-05-16 時点では、まさの方針で **Codex automation** に寄せる。内製 5 生データの L2 差分レビューとは別 automation とし、Atlas は外部マクロシグナル専用にする。
- 2026-05-17 時点で、課金回避のため Vercel cron `/api/cron/atlas-collect` は停止済み。`atlas-collect-policy` は継続。

## アーキテクチャ

```
[Claude Routine or Codex automation] (daily 08:10 JST, subscription / Codex 枠)
   │
   │ 1. web_search で過去 24h (= 厳密に前回 run 以降) のニュース 8-14 件抽出
   │ 2. JSON で signals 配列を組み立て
   │ 3. outbox JSON を作成、または HTTP POST → 受け口 API
   ▼
[/api/atlas/signals-ingest] (Vercel, Anthropic API)
   │
   │ 4. 各 signal を Haiku で auto-tag
   │ 5. attachStory (= LLM でストーリー連結 / 新規)
   │ 6. atlas_signals に bulk insert
   │    (= 48h 重複 skip は「境界 23:50 / 00:10 で被った」場合の保険)
```

### 2026-05-13 まさ指摘 (= 構造修正)

初回 Routine 実行で 8-14 件中 inserted=1 となった。原因は **prompt が
「24-72h」を許していた** こと → daily 実行なのに過去 3 日前のニュース
まで候補に入る = 構造的に重複を作りに行く。`/api/atlas/recent-titles`
で事前除外する案は対症療法。daily run は「**直前 24h だけ**」を厳守
させるのが本道。重複 skip は境界事故のための最終保険として残す。

## 受け口 API

### POST `/api/atlas/signals-ingest`

[pwa/src/app/api/atlas/signals-ingest/route.ts](../src/app/api/atlas/signals-ingest/route.ts) — POST

- 認証: `Authorization: Bearer ${ATLAS_INGEST_SECRET}` (未設定なら `CRON_SECRET` にフォールバック)
- Body:
  ```json
  {
    "signals": [
      {
        "title": "string (60字以内)",
        "content": "string (200-400字)",
        "source_url": "https://...",
        "source_type": "news|report|data|manual",
        "domain": "A.地政学・マクロ経済 | B.規制・政策 | ... | R.先端通信",
        "importance": "high|medium|low"
      }
    ]
  }
  ```
- 直近 48h の重複 (title / source_url 一致) は skip
- 各 signal に対し Haiku auto-tag + attachStory + insert

## Routine 用 prompt (= claude.ai / Claude Code Routine に貼る、v2 = 2026-05-13)

```
あなたは AMD Atlas のマクロトレンド収集エディタ。

毎日 08:00 JST 起動。**直前 24 時間 (= 前日 08:00 〜 今日 08:00 JST)** に
新たに報じられたニュースだけを対象に、AMD (armada — 新規事業開発・
インキュベーション・パートナー伴走) の事業判断 (新規シーズ開拓 /
既存PJの前提揺らぎ) に関わる重要マクロシグナルを 8〜14 件選び、JSON で
組み立てて HTTP POST してください。

★ 重要: 24 時間より前のニュースは **絶対に拾わない**。前回の run で
既に拾われている可能性が高く、無駄な作業になる。「ここ数日のトレンド」
「今週の動き」のような継続的話題ではなく、**昨日初めて出た一次イベント
だけ** を選ぶこと。

# ドメイン (各 signal で必ず1つ)
A.地政学・マクロ経済 / B.規制・政策 / C.素材・原料 / D.エネルギー /
E.製造・プロセス技術 / F.バイオ・医療 / G.モビリティ・ロボティクス /
H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 / K.食・農・水産 /
L.金融・資本市場 / M.社会構造・社会課題 / N.海洋・水資源 /
O.サーキュラーエコノミー / P.量子・量子計算 / Q.センシング・計測 /
R.先端通信

# 拾うべきイベント (= 個別の日付を持つ一次イベント)
- 個別企業の発表 / 資金調達 / 提携
- 政策・規制の施行日 / 改正案公表
- 臨床試験の結果発表
- 大学・国研の新発表 (論文 / プレス)
- 災害・事故・地政学的事件

# 拾わないネタ
- 継続トレンド (米中関税 / AI 規制 / SMR / ロボット等の包括的話題)
- 数日前以前に既に出ているニュースの蒸し返し
- まとめ記事 / 週次レポート / 解説記事

# ルール
- web_search で最新情報を必ず確認 (ソースURL必須)
- 各 signal:
  - title: 60字以内、特定企業名・PJ名を使わない一般化された見出し
  - content: 200-400字、何が起きたか / 一次データ / AMDへの示唆
  - source_url: 一次情報源 (FT, Reuters, Bloomberg, 公式機関など優先)
  - domain: 上記から1つ
  - importance: 即時の事業判断影響=high / 中期注視=medium / 参考=low
    (high は 1〜3 件まで)
- 分野が偏らないよう分散 (同じ domain 3 件超は避ける)

# 最後にやること
JSON を組み立てて、以下に POST:
  URL: https://amd-os-pwa.vercel.app/api/atlas/signals-ingest
  Method: POST
  Headers:
    Authorization: Bearer ${CRON_SECRET}  ← (環境変数か実値を保存しておく)
    Content-Type: application/json
  Body: {"signals": [{...}, {...}, ...]}

レスポンスの `inserted` 件数を結果報告してください。
```

## Codex automation 運用 (2026-05-16 正本)

### automation

- name: `AMD Atlas外部シグナルレビュー`
- scope: Atlas / macro signal only。L2 5生データ差分レビューとは混ぜない。
- schedule: daily 08:10 JST 目安。既存 `/api/cron/atlas-collect` (08:00 JST) は課金回避のため停止し、この automation を主系にする。
- output:
  - outbox: `/Users/masa/.codex/automations/amd-atlas/outbox/*.json`
  - applied: `/Users/masa/.codex/automations/amd-atlas/applied/*.json`
  - failed: `/Users/masa/.codex/automations/amd-atlas/failed/*.json`
  - recent snapshot: `/Users/masa/.codex/automations/amd-atlas/snapshots/recent-titles.json`

### helper

```sh
# 認証・本番API到達・受け口 env の確認。DB書き込みなし。
node pwa/scripts/atlas_signal_review_tool.mjs health

# 直近投入済み title を取得して snapshot 保存。
node pwa/scripts/atlas_signal_review_tool.mjs recent --hours 48 --limit 80

# outbox を 1 ファイル投入。
node pwa/scripts/atlas_signal_review_tool.mjs apply-outbox --file /path/to/outbox.json

# outbox dir をまとめて投入し、成功なら applied、失敗なら failed へ移動。
node pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir
```

automation は原則:

1. `health` を実行。失敗したら DB 書き込みせず停止し、原因を run 結果に書く。
2. `recent --hours 48 --limit 80` で既存 title を確認。
3. 直前 24h の一次イベントだけを web / source search で 8-14 件抽出。
4. outbox JSON を作る。
5. 投入はローカルの非LLM LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が行う。automation 側は outbox 作成までで止め、ネットワーク制限で failed に退避しない。

## Claude Routine 登録手順 (旧案)

[claude.ai](https://claude.ai) > Settings > Routines or Schedule で新規作成。
schedule: daily 08:00 JST (= UTC 23:00、cron `0 23 * * *`)。

## 並走計画 (2026-05-16 ~)

1. **受け口 API デプロイ** ✓
2. **Codex automation 登録** (まさ Codex / subscription 枠)
3. **Codex automation 主系化**:
   - 既存 `/api/cron/atlas-collect` (daily 08:00 JST) は停止
   - Codex automation が signals を outbox 化し、ローカル非LLM applier が `/api/atlas/signals-ingest` に投入
4. **品質確認 (まさ)**:
   - Codex automation 経由の signals が API 直叩きと同等以上か
   - title 重複・spam・irrelevant がないか
5. **OK 判定後**:
   - `pwa/vercel.json` から `atlas-collect` エントリ削除済み
   - `pwa/vercel.disabled-crons.json` に保管済み (= 復活可能)
   - Anthropic API 課金が ~70% 削減される想定

## 復活したいとき

- `pwa/vercel.disabled-crons.json` の `atlas-collect` を `pwa/vercel.json` に戻して再 deploy

## atlas-collect-policy は別マター

`atlas-collect-policy` は構造が違う (= 省庁 scrape ベース、LLM は filter=Gemini / extract=Anthropic)。
Routine 化のメリット小 (= web_search 主役じゃない)。atlas-collect の検証結果見てから判断。
