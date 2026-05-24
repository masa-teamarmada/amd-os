# 02. AMD 会社全体 (p00)

URL: `/project/p00/cockpit`。**会社全体 (= AMD 株式会社) を 1 つの PJ として扱う特殊ケース**。`project_id='p00'` で他の PJ と同じテーブル構造に乗る。

## 誰がいつ使うか
- **まさ**が会社全体の経営状況を見る
- **まさえいMTG** で会社全体の議題を扱うとき
- 月次経営会議の準備 + 全 PJ 横断の戦略議論

## 2.1 Management Score

- 5 つの軸で会社全体を評価:
  - **先手力** (= 新規開拓スピード)
  - **財務耐久** (= キャッシュランウェイ)
  - **既存 PJ 継続** (= 動いてる PJ の健全性)
  - **新規獲得** (= 新 PJ パイプライン)
  - **戦略接近** (= 投資家/パートナー戦略実行度)
- Total スコア (= 5 軸の合成) と各軸スコアを月次推移グラフで表示
- スコア source: `amd_management_score_snapshots` テーブル
- 月次更新 cron で計算 + 各 evidence (= `amd_management_score_evidence`) と紐付け

### 詳細ビュー
- `/management-score` で 5 軸ごとの evidence・推移・PJ ごとの寄与を確認
- evidence の追加は LLM 抽出 (= Codex automation) + 手動入力

---

## 2.2 まさえいMTG (= 旧「経営会議」)

> **2026-05-24 まさ確定**: 「**まさえいMTG**」と呼ぶ。「経営会議」「まさ × えいみ経営会議」とは書かない。理由: かる/ちこ等チームメンバーへの疎外感回避 + チーム外の人が読んだとき「2 人で議論したセッション」だと分かり、かつチームへの提案前提だと伝わる表現にする。

### トリガー
まさが claude / codex セッションで以下を言ったら **即着手**:
- 「まさえいMTGやろう」
- 「経営シグナル見よう」
- 「signals レビュー」

(= 再起動不要、新セッション初回でも OK)

### えいみがやる手順

1. **candidate を全 PJ 横断 read** (= service_role REST):
   ```
   GET /rest/v1/project_strategy_signals
       ?status=eq.candidate
       &order=impact_level.desc,signal_date.desc
   ```
   - impact: `critical` > `high` > `medium` > `low`
   - 同 impact 内は signal_date desc

2. **最初の 1 件を提示** (= 全部一気に出さない、1 議題ずつ):
   - PJ コードネーム + signal_type chip + impact chip + title + summary 2-3 行
   - 「これどう?」と短く問う

3. **まさの反応に応じて API を叩く** (= その場で、後でやらない):
   - `進める` / `これで確定` / `decided` → `POST /api/strategy-signals { action:'confirm', signal_id, decision_state:'decided' or 'executing' }`
   - `違う` / `不採用` / `保留` → `action:'reject'`
   - `こう修正` → `action:'update'` で title/summary/impact 等を差し替え
   - `これ別 signal で残したい` → `action:'create', status:'confirmed', decision_state:'decided'`

4. **次の議題へ。1 セッションで 5-10 件目安**、まさが「これで終わり」と言うまで

5. **セッション終了時に議論ログを保存**:
   ```
   POST /api/dialogue-meeting
   { project_id, summary_short, decided[], progress[], next_actions[], risks[],
     related_signal_ids: [...] }
   ```
   - PJ 単位、会社全体は `project_id='p00'`
   - cockpit の MTG サマリ欄に `source_kinds='dialogue'` で並ぶ
   - `decided[]` は「**提案**」のニュアンスで書く (= チームへの相談前提)

6. **narrative 化** (= 直後):
   ```
   POST /api/dialogue-meeting/narrate { meeting_id }
   ```
   - Sonnet 4.6 が raw 配列を「背景 → 議論の流れ → 2 人で出した提案 → 残課題」の Markdown に
   - cockpit の MTG サマリ詳細で主表示

### 認証
- まさ session でログイン済みなら admin auth で通る
- セッション外から叩くなら `Authorization: Bearer ${CRON_SECRET}`

### よくある間違い (= えいみへの注意)
- ❌ 議題を 10 件一気に箇条書きで出す → 1 件ずつ会話形式で
- ❌ まさが返事する前に勝手に confirm する → まさの明示判断後
- ❌ 議論ログ保存を後回しにする → セッション終了時に必ず叩く
- ❌ p00 を忘れる → AMD 全体の議題 (Management Score / freee / 月次運用) は p00

### candidate が空 / 古いとき
- `status='candidate'` 行が無い、または signal_date が 1 週間以上前 → えいみが OS を横断 read して新規 candidate を `proposed` で積んでから議論開始 (= daily routine と同じ動作を手動)

---

## 2.3 会社全体の経営ハイライト (p00)

- 各 PJ で並んでる経営ハイライトと同じ仕組みで、`project_id='p00'` のものが並ぶ
- 例: 「AMD Management Score で direction_score 84→64 急減」「VC 投資委員会フェーズに 3 PJ 同時突入」
- 4 分類 (経営全般 / 事業開発 / 技術開発 / 外部環境) + polarity アイコンは同じ

---

## 2.4 月次運営

p00 でも他 PJ と同じ月次ルーティンが回る:
- 報告書 FIX (= 会社全体)
- 請求書発行 (= SU から AMD への業務委託費)
- 入金確認

→ 詳細は **[04 章 admin オペ](04-admin-ops.md)** へ。

---

## 関連
- 設計議論: [`pwa/design/cockpit.md`](../design/cockpit.md) (= p00 月次データ仕様), [`pwa/CLAUDE.md`](../CLAUDE.md) (= まさえいMTG 運用詳細)
- まさえいMTG プリペア cron: [`05 章 5.4 責務分担マトリクス](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)
