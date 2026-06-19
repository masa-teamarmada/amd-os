# AMD 会社全体 (p00)

URL: `/project/p00/cockpit`。**会社全体 (= AMD 株式会社) を 1 つの PJ として扱う特殊ケース**。`project_id='p00'` で他の PJ と同じテーブル構造に乗る。

## 誰がいつ使うか
- **まさ**が会社全体の経営状況を見る
- **まさえいMTG** で会社全体の議題を扱うとき
- 月次の経営状況レビュー + 全 PJ 横断の戦略議論

## Management Score

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

## Dashboard の TODO

`/dashboard` の上部に、PJ横断の `proactive_outbox` を read-only で表示する。まさや司令塔が最初に見る入口として、まだ司令塔通知前 / 司令塔対応中 / ブロック中の TODO を最大 3 件に絞って出す。資料作成済みのものは Dashboard 上部には混ぜず、各 PJ cockpit 側で確認する。

表示順は、期限超過、ブロック、未送信、司令塔送信済み、優先度、期限の順で決める。DBからは少し多めに読み、画面上で `outbox_id` を重複排除してから最大3件に絞る。先頭の優先TODOと下の一覧には同じ `outbox_id` を二重表示しない。

表示するもの:
- PJ名、優先度、期限、状態
- 推奨 first move
- 誰のボールか、資料の種類、トリガー理由、担当司令塔
- 期限超過件数と停止件数

対象 status は `queued`, `sent_to_commander`, `blocked`。状態更新や外部送付は Dashboard では行わない。TODO 行を押すと画面内モーダルが開き、その TODO が発生した経緯、`proactive_loop_events` の履歴、遅れた場合のリスク、司令塔/worker が作った資料リンク、外部送付可否、次の期待アクションを確認できる。PJ cockpit へ移動する導線はモーダル内の補助リンクとして置く。

`drafted` は「司令塔/worker が内部資料を作成済み」の状態。ここからは、まさまたは担当司令塔が内容を確認し、外部送付する / 追加修正する / 完了扱いにする、のどれかへ進める。

## Dashboard の Company Content shelf

`/dashboard` の本文は、左/mainカラム内で PJ一覧 → 研究機関ERSリスト の順に並べる。研究機関リストはPJ一覧の続きとして見せ、右カラムのMyPageより下へ落とさない。Company Content shelf はその下の全幅下段に置く。

Company Content shelf には、メンバー / 沿革 / メディア掲載 / photo の4カラム棚を置く。

- メンバー: `members` と `project_members` から active メンバーと参画PJ数を read-only 表示する。各行は admin閲覧用の `/mypage?memberId=<members.member_id>` へリンクする。
- 沿革: `project_events` を優先し、無ければ `project_ventures` の日付情報を fallback として表示する。
- メディア掲載: `project_events.kind` が `coverage`, `press_release`, `funding`, `award`, `pitch`, `own_news` のものを preview 表示する。
- photo: Notion photo DB の本移植前なので、写真本体やNotion file URLは出さない。usage permission / consent review が必要な preview として出す。

右カラムのMyPage埋め込みでは、当月報酬、いまやること、今週やったことまでを表示し、その下の月別PJカードは出さない。`/mypage` 単体画面では月別PJカードを従来通り残す。

---

## まさえいMTG

まさえいMTGは、まさとえいみが OS 上の candidate を 1 件ずつ読み、チームへ提案する前の論点・提案・残課題を整理する対話セッション。

議事録 / MTG サマリでは、正式決定ではなく **提案**・**整理**・**相談前提の論点**として残す。

### トリガー
まさが claude / codex セッションで以下を言ったら **即着手**:
- 「まさえいMTGやろう」
- 「経営ハイライト見よう」
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
   - Sonnet 4.6 が raw 配列を `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の Markdown に
   - まさえいMTGの `✅決まったこと` は「チームへ出す提案として固まったこと」の意味で書き、会社として正式決定済みと誤読される表現は避ける
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

## 会社全体の経営ハイライト (p00)

- 各 PJ で並んでる経営ハイライトと同じ仕組みで、`project_id='p00'` のものが並ぶ
- 例: 「AMD Management Score で direction_score 84→64 急減」「VC 投資委員会フェーズに 3 PJ 同時突入」
- 4 分類 (経営全般 / 事業開発 / 技術開発 / 外部環境) + polarity アイコンは同じ

---

## 月次運営

p00 でも他 PJ と同じく月次カードと月次モーダルで会社全体の月次状態を見る:
- 報告書 FIX (= 会社全体)
- 請求書発行 (= SU から AMD への業務委託費)
- 入金確認

→ 詳細は **[2-6 章 admin オペ](2-6-admin-ops.md)** へ。

---

## 関連
- 設計議論: [`pwa/design/cockpit.md`](../design/cockpit.md) (= p00 月次データ仕様), [`pwa/CLAUDE.md`](../CLAUDE.md) (= まさえいMTG 運用詳細)
- まさえいMTG プリペア cron: [`9-1 章 5.4 責務分担マトリクス](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)
