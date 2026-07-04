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

## Dashboard の先手レーダー

`/dashboard` の上部に、PJ横断の `ProactiveTodoBadge` と `PJ先手レーダー` を表示する。先手TODOバッジは `proactive_todos.status='open'` の件数、期限超過、red件数を1行で出し、詳細は `/proactive` へ送る。

PJ先手レーダーは、未対応TODOだけでなく、まだTODO化されていない「空白提案」もPJごとに出す。5センサーは以下。

- MTG準備: 次回MTGの近さ、`prep_readiness_score`、`prep_worker_status`
- 先手TODO: `proactive_todos` の open / blocked / red / 期限超過
- 経営ハイライト: high / critical の未確認 `project_strategy_signals`、または `next_move` / proposed signal
- 不在検知: 未処理の `l2_coverage_gaps`
- 月次・契約: 当月の報告 / 請求 / 入金などの詰まり

行ごとに `先行中` / `見張り` / `要押し` / `危険` を出し、`空白提案` では「次回MTG前に論点表を置く」「経営ハイライトを次の提案へ変換する」「不在検知のOS化先を決める」など、今やると効く一手を1行で示す。レーダー上では状態更新せず、詳細は `/proactive` / `/notifications` / 各 PJ cockpit で確認する。

自動レーダー対象は current PJ (`active` / `sales` / `draft`) に限る。`frozen` / `ended` / 旧PJは、明示的な未対応先手TODOがある場合だけ表示に戻す。材料ゼロの平常監視行は dashboard には出さない。

## Dashboard の累計実績

`/dashboard` の上部に、AMD全体の資金調達・助成金の累計実績カードを表示する。ここで大きく出す累計値は、会社の登録済み総額ではなく、`amd_contribution_status` で AMD貢献として明示された金額だけを合計する。

- `full`: その行の全額を AMD貢献として累計に入れる。`amd_contributed_yen` が入っていればその額を優先する。
- `partial`: `amd_contributed_yen` だけを累計に入れる。
- `none` / `unreviewed`: 会社別・行別リストには表示するが、累計には入れない。

行別表示では、各会社のラウンド/助成金を残したまま、AMD貢献部分だけ色つきで強調する。投資家別内訳・持株比率・cap table snapshot は `/dashboard` には出さず、admin の governance 画面側で扱う。

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
