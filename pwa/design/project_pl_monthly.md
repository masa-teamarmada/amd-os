# 月次試算表 (project_pl_monthly) — 抽出設計

最終更新: 2026-05-13 (dazzling-wing-23c8e9 #9 続き、まさ確認)
優先度: 🟡 低 (= 後回し OK、設計のみ記録)

---

## まさの意図 (= 2026-05-13 確認)

### 1. freee 連携は **できない前提**
- できる案件もあるが稀
- freee API で月次仕訳を取って自動 PL 構築する path は **採用しない**

### 2. 生データから抽出する情報は **未来予測中心**
試算表 = 実績ベースの厳密な PL ではなく、**経営判断に使う未来時点のキャッシュ予測**。生データから拾うのは以下のような会話的情報:

- 「**毎月のバーンレート 300 万**」 (= 月次支出ペース)
- 「**何月に資金が底を尽きる**」 (= 資金枯渇予想月)
- 「**何月にいくら資金調達予定**」 (= 増資 / 借入 / 補助金等)
- 「**500 万円の装置を何月に買いたい**」 (= 大型支出予定)
- 売上見込み (= 「来月から月 X 円入る」等)
- 外部投資見込み

これらを拾って「試算表として成り立つレベル」に組み立てる。

### 3. Drive 手動試算表 fallback
- たまに誰かが **手動で作った試算表** が Drive にアップされることがある
- それがあったらそれを使う (= 機械抽出より人手のが正本)
- 試算表専用の Drive 探索 cron は不要、074c (= Drive backfill) が拾ってくる範囲で OK

### 4. **試算表専用 cron は作らない**
- 試算表のためだけに生データ scan する cron は **作らない**
- **他 cron (= 議事録抽出 / Slack 抽出 / amd-score-l2-extract / member-activities) が source_cache に詰めたデータ** を二次加工する
- 余計な LLM コストを払わない設計

### 5. 手動入力は想定しない
[feedback_tsukuyomi_builds_from_raw_data.md] の通り、AMD OS は原則「つくよみが生データから自動構築」。CockpitPlMonthlyModal の編集モードは補正用 (= LLM 抽出失敗時のみ)、主役じゃない。

---

## 既存資産 (= 触らないもの)

| 資産 | 用途 |
|---|---|
| `project_pl_monthly` table | (project_id, ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen, notes) |
| `CockpitPlMonthlyModal.tsx` | 月別の P&L 表示 + 補正入力 (= 縦横ピボット) |
| `CockpitPlHearingModal.tsx` | つくよみとのヒアリング UI (= 数値を会話で固める) |
| `pl-hearing/turn` route | ヒアリング 1 turn = Sonnet 応答 + tool call |
| つくよみ tool `add_pl_monthly` | chat route から DB upsert |
| `venture-status-data.ts` | upsertPlMonthly / fetchPlMonthly |

これらは既存。**新規実装は「抽出 path」だけ**。

---

## 抽出 path 設計 (= 後日実装)

### A. source_cache → PL 関連数値抽出

`source_cache` には既に 5 生データ (Slack 1681 / Notion 373 / Gmail 342 / gmeet_minutes 176 / Drive 82 / Calendar 7) が入っている。この中の **会話的情報から PL 数値を拾う**。

#### 実装案 (A-1): 既存 cron に hook
- `cron/member-activities` (= 月次レポート + 議事録から進捗イベント抽出) を拡張
- 同じ Sonnet call の **出力スキーマに `pl_extract` フィールドを追加**:

```json
{
  "events": [...],
  "pl_extract": [
    {
      "ym": "202609",
      "kind": "burn_rate" | "fundraise_plan" | "large_expense" | "revenue_forecast" | "runway_alert",
      "amount_yen": 3000000,
      "note": "毎月のバーンレート",
      "source_quote": "毎月 300 万くらい焼いてる"
    }
  ]
}
```

- 抽出された `pl_extract` を `project_pl_forecast` (= 新テーブル、下記) に upsert
- 既存 cron 内でやるので **追加 LLM コストゼロ** (= prompt が少し長くなるだけ)

#### 実装案 (A-2): cron/monthly-reports-backfill に hook
- 月次レポート生成時 (= 既に source_cache 全部 prompt に渡してる) に副産物として PL 数値抽出
- 同じく既存 LLM call の出力に `pl_extract` フィールド追加

→ **A-2 推奨**: 月次レポート cron が PJ × 月 × 全 source_cache を見るので最も網羅的。

### B. 手動試算表 Drive fallback

- 074c (= Drive backfill cron) が `vc-discover` 同様に「直近 N 日に新規追加された xlsx / Google Sheets」を listing する
- ファイル名 / シート名に「試算表」「PL」「決算」「キャッシュ」等のキーワード含むものを **別フラグ** (= source_cache.source = `'pl_sheet'`) で source_cache に入れる
- B 自体は新 cron 不要、074c 拡張で対応

### C. 新テーブル `project_pl_forecast` (= 検討)

現状 `project_pl_monthly` は実績想定の列 (revenue_yen / cogs_yen / 各 opex)。一方まさが拾いたい情報は **予測 / 計画 / 単発予定**。これは別テーブルにする方が筋いい。

```sql
CREATE TABLE project_pl_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES projects(project_id),
  ym TEXT,  -- 関連月 (= burn_rate なら起算月、large_expense なら購入月)
  kind TEXT,  -- burn_rate / fundraise_plan / large_expense / revenue_forecast / runway_alert
  amount_yen BIGINT,
  note TEXT,
  source_quote TEXT,  -- 抽出元の発言抜粋
  source_type TEXT,   -- slack / notion / gmeet / pl_sheet / manual
  confidence SMALLINT,  -- 1-5
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  extracted_by TEXT,  -- cron name
  superseded_by UUID REFERENCES project_pl_forecast(id),  -- 新版で上書きされた古い予測
  UNIQUE (project_id, ym, kind)
);
```

`project_pl_monthly` (= 実績相当) と分離することで:
- 実績と予測の区別が明確
- 予測の上書き履歴を保てる
- CockpitPlMonthlyModal の縦横ピボット表示で「予測値オーバーレイ」が後から実装可能

### D. 試算表モーダルへの反映

CockpitPlMonthlyModal を拡張:
- 月行ごとに `project_pl_monthly` (実績) + `project_pl_forecast` (予測) を merge 表示
- 予測値は **薄字 + 「予測」バッジ**
- 補正クリック編集で `project_pl_monthly` を上書きすれば確定値として表示

---

## 着手順 (= 後日)

1. migration: `project_pl_forecast` 新規テーブル + index
2. llm_prompts: `monthly_report.r313_extract` を改修 (= 出力に `pl_extract` フィールド追加)
3. PWA `cron/monthly-reports-backfill` 内で `pl_extract` を parse → `project_pl_forecast` upsert
4. 074c (Drive backfill) に「試算表っぽいファイル」検出 + 別 source 値で source_cache 投入
5. CockpitPlMonthlyModal に予測値オーバーレイ実装

---

## 着手前にまさへ確認

- `project_pl_forecast` という別テーブル化で OK? それとも `project_pl_monthly` に予測列追加で十分?
- 着手のタイミング (= AMD-Report GAS 修復 / 5 生データ精度改善 / VC RSS のどれの後?)

---

## 関連

- [`L2_DATA.md`](L2_DATA.md) — 5 生データ集約の正本
- [`cockpit.md`](cockpit.md) — Cockpit UI 全体仕様
- [feedback_tsukuyomi_builds_from_raw_data.md](/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/feedback_tsukuyomi_builds_from_raw_data.md) — 手動入力前提を禁ずる設計哲学
