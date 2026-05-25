# 修正依頼 対話型ループ (= まさ #34 2026-05-25 お昼確定)

> **状態**: まさ「対話型に変えよう」発言 (= 2026-05-25 お昼) で方針確定。**次セッションで設計確定 + 実装**。
>
> 関連: [`notifications.md`](notifications.md), [`project_strategy_signals.md`](project_strategy_signals.md)
> 前段の一方通行 update 実装: `pwa/src/app/api/notifications/feedback/route.ts` の `reextractStrategySignalImmediate` (= 次セッションで削除予定)

---

## 背景

経営ハイライト (= L2 ⑨ project_strategy_signal) のカード下にある「⚠️ つくよみに修正依頼」ボタンで投げた修正依頼が「次回 cron まで反映されない」問題に対し、まさは「**直ちに修正してほしい**」と要求。

当初えいみは「Anthropic Sonnet 直叩きで即時 update する一方通行版」を実装したが、まさは「**つくよみが提案 → まさ判断 → 確定**の対話型ループ」を想定していたことが判明。一方通行版は「内容変わらない」「思ったけどさ、修正依頼送信したら、『じゃあこう変えたらいい?』ってつくよみがレスくれて、そこでやりとりしながら固める形がいいと思う」というまさのコメントで設計再検討。

## 確定方針

1. **一方通行 update は廃止** (= `reextractStrategySignalImmediate` の自動 Supabase update を削除)
2. **対話型ループ** に置換: つくよみ (Sonnet) が提案 → まさ確認 → 「適用 / やり直し / 追加コメント」 → ループ → 最終確定で DB 反映
3. やりとりは **`l2_feedbacks` の `feedback_text` に conversation 全体として残す** (= 単発じゃなく履歴付き)、次回抽出 routine への学習材料豊かに

## フロー

```
[まさ: 修正依頼 textarea + 「送信」ボタン]
     ↓
[POST /api/notifications/feedback/dialog/start]
   { l2_kind, target_id, scope_key, initial_feedback }
     ↓
[サーバ: Sonnet 呼んで「修正案」生成 + dialog_id 発行 (= UUID、揮発、in-memory or short TTL DB)]
   - 現在の signal (= title/summary/impact_level/signal_type/polarity/score_impact_summary) を fetch
   - 過去 l2_feedbacks (= 同 scope_key) を context として渡す
   - Sonnet が「こう変えたい?」JSON を返す:
     {
       proposed: { title, summary, impact_level, signal_type, polarity, score_impact_summary, applied_feedback_summary },
       reasoning: "まさの修正依頼を受けて、〜〜のように改訂しました。これでいい?"
     }
     ↓
[UI modal: つくよみ提案を表示 + 3 ボタン]
     ↓
  ├ まさ「適用」→ POST /api/notifications/feedback/dialog/confirm
  │    { dialog_id, proposed }
  │    → Supabase update (= signal) + l2_feedbacks INSERT (= conversation 履歴) + applied_count++
  │
  ├ まさ「やり直し」 (= 別案見たい) → POST /api/notifications/feedback/dialog/refine
  │    { dialog_id, additional_hint?: string }
  │    → 過去提案 + 追加 hint を context にやり直し → 新 proposed 返却
  │
  └ まさ「追加コメント」(= 修正依頼を加筆) → POST /api/notifications/feedback/dialog/refine
       { dialog_id, additional_feedback: "ここも修正してほしい" }
       → 過去提案 + 追加 feedback で再生成 → 新 proposed 返却
```

## データモデル

### 案 A: dialog 永続化なし (= 推奨)

- dialog_id は client 側で UUID 発行、サーバは state 持たない
- 「やり直し」「追加コメント」時は、過去 proposed + 過去 hints を client が body で渡す
- 「適用」時のみ Supabase 永続化 (= conversation 全体を `l2_feedbacks.feedback_text` に )

メリット: シンプル、新規テーブル不要
デメリット: 1 dialog セッションが長くなると body 肥大化

### 案 B: dialog_sessions テーブル新規

```sql
CREATE TABLE l2_feedback_dialogs (
  dialog_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  l2_kind      TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  scope_key    TEXT NOT NULL,
  signal_id    UUID,                    -- 該当 signal (= 経営ハイライト等)
  conversation JSONB NOT NULL,          -- [{ role: 'user'|'assistant', content, proposed? }]
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','confirmed','abandoned')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);
```

メリット: dialog セッション中の途中状態が永続化、ブラウザ閉じても続けられる
デメリット: テーブル追加 + RLS + migration

→ **推奨: 案 A から始める**、頻度高ければ案 B に移行

## LLM プロンプト概要

```
あなたは AMD OS の経営ハイライトを、まさからの修正依頼に基づいて対話的に改訂するつくよみ (LLM)。

入力:
- 現在の signal: { title, summary, ... }
- 過去の修正依頼 (= 時系列)
- 今回のまさの修正依頼 (= 初回または追加)
- 過去の proposed (= やり直しの場合)

ルール:
- まさの修正依頼を必ず反映、推測で書かない
- 「こう変えたいですか?」の対話的トーン
- 出力 JSON:
  {
    "proposed": { title, summary, impact_level, signal_type, polarity, score_impact_summary },
    "reasoning": "まさの修正依頼を受けて、〜〜のように改訂しました。これでいいですか?何か追加で変更したいことがあれば教えてください。",
    "applied_feedback_summary": "<反映した修正依頼の 1 文要約>"
  }
- JSON 以外の文字一切出力禁止
```

## UI イメージ

```
[CockpitStrategySignals の各カード]
     ↓
[まさ: 「⚠️ つくよみに修正依頼」ボタンクリック]
     ↓
[modal: 修正依頼 textarea + 「送信」]
     ↓
[送信後 modal 内に: つくよみ提案を表示]
     つくよみ: 「まさの修正依頼を受けて、こう変えました。これでいい?」
     提案:
       title (修正前) → title (修正後)
       summary (修正前) → summary (修正後)
       impact_level: high → critical
     [適用] [やり直し] [追加コメントを書く]
     ↓
[まさ: 適用] → modal 閉じる + カード更新 + 学習履歴に conversation 保存
[まさ: やり直し] → 同じ modal で「もう一回提案して」→ Sonnet 再呼び
[まさ: 追加コメント] → 同じ modal で textarea が出てくる → 追加 feedback 送信 → 再生成
```

## 実装ステップ

1. **API 3 つ新規** (= start / confirm / refine):
   - `/api/notifications/feedback/dialog/start`
   - `/api/notifications/feedback/dialog/confirm`
   - `/api/notifications/feedback/dialog/refine`
2. **CockpitStrategySignals の修正依頼 modal を対話型 UI に拡張**:
   - 既存 textarea + 送信ボタンは「初回 start」用
   - 提案表示エリア + 適用/やり直し/追加コメント 3 ボタン
   - 過去 dialog 履歴は client state で持つ (= 案 A)
3. **既存 `reextractStrategySignalImmediate` 削除** (= 一方通行 update は廃止)
4. **既存 `automation.toml` の prompt 修正は保険として残置** (= 次回 cron で過去 feedback も反映、対話型と二重保険)

## 適用範囲 (= 段階的)

- まず **経営ハイライト (= L2 ⑨)** で実装 + 動作確認
- 動けば他 L2 (= MTG サマリ / プロトコル / PJ ナレッジ / メンバーナレッジ) にも横展開
- 各 L2 の修正依頼ボタンが同じ対話 UI を使う形に統一

## 残設計事項 (= 次セッション まさ確定)

1. **案 A vs 案 B** どちらで実装するか
2. **やりとり履歴の保存形式** (= feedback_text に conversation JSON or 別テーブル)
3. **やり直しの上限回数** (= subscription 帯域考慮、10 回上限 etc)
4. **「提案そのまま適用」を Slack でも通知するか** (= まさえいMTG にも経営判断履歴として残す)
