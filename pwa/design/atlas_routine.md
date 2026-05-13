# Atlas-collect Routine 化 — Anthropic API 課金を subscription 枠に移す

最終更新: 2026-05-13

## 背景

- 既存 `/api/cron/atlas-collect` は Anthropic API 直叩き (Sonnet 4.6 + web_search + Haiku auto-tag) で月 ~¥3,000-5,000
- 同じ処理を Claude subscription (Pro/Max) の Routine で動かせば、web_search 部分の API 課金が消える (auto-tag / attachStory の Anthropic 課金は受け口 API で継続)
- 削減率: 推定 **70%**

## アーキテクチャ

```
[Claude Routine] (daily 08:00 JST, claude.ai subscription)
   │
   │ 1. web_search で過去 24-72h のディープテックニュース 8-14 件抽出
   │ 2. JSON で signals 配列を組み立て
   │ 3. HTTP POST → 受け口 API
   ▼
[/api/atlas/signals-ingest] (Vercel, Anthropic API)
   │
   │ 4. 各 signal を Haiku で auto-tag (= 既存ロジック流用)
   │ 5. attachStory (= LLM でストーリー連結 / 新規)
   │ 6. atlas_signals に bulk insert
```

## 受け口 API

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

## Routine 用 prompt (= claude.ai / Claude Code Routine に貼る)

```
あなたは AMD Atlas のマクロトレンド収集エディタ。

毎日 08:00 JST に web_search で過去 24-72 時間のニュースから、
AMD (armada — 新規事業開発・インキュベーション・パートナー伴走) の
事業判断 (新規シーズ開拓 / 既存PJの前提揺らぎ) に関わる
重要マクロシグナルを 8〜14 件選び、JSON で組み立てて
HTTP POST してください。

# ドメイン (各 signal で必ず1つ)
A.地政学・マクロ経済 / B.規制・政策 / C.素材・原料 / D.エネルギー /
E.製造・プロセス技術 / F.バイオ・医療 / G.モビリティ・ロボティクス /
H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 / K.食・農・水産 /
L.金融・資本市場 / M.社会構造・社会課題 / N.海洋・水資源 /
O.サーキュラーエコノミー / P.量子・量子計算 / Q.センシング・計測 /
R.先端通信

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

## Routine 登録手順

[claude.ai](https://claude.ai) > Settings > Routines or Schedule で新規作成。
schedule: daily 08:00 JST (= UTC 23:00、cron `0 23 * * *`)。

## 並走計画 (2026-05-13 ~)

1. **受け口 API デプロイ** ✓
2. **Routine 登録** (まさ subscription)
3. **1 週間並走**:
   - 既存 `/api/cron/atlas-collect` (daily 08:00 JST) は **そのまま稼働** (= 重複 dedup で害なし)
   - Routine が動けば signals が同タイミングで届く → atlas_signals に 1 日 16-28 件入る想定 (= 重複は受け口側で skip)
4. **品質確認 (まさ)**:
   - Routine 経由の signals が API 直叩きと同等以上か
   - title 重複・spam・irrelevant がないか
5. **OK 判定後**:
   - `pwa/vercel.json` から `atlas-collect` エントリ削除
   - `pwa/vercel.disabled-crons.json` に保管 (= 復活可能)
   - Anthropic API 課金が ~70% 削減される想定

## 並走中 OFF にしたいとき

- `vercel.json` の `atlas-collect` を `vercel.disabled-crons.json` に移して再 deploy
- すぐ復活させたいときは逆方向に戻して再 deploy

## atlas-collect-policy は別マター

`atlas-collect-policy` は構造が違う (= 省庁 scrape ベース、LLM は filter=Gemini / extract=Anthropic)。
Routine 化のメリット小 (= web_search 主役じゃない)。atlas-collect の検証結果見てから判断。
