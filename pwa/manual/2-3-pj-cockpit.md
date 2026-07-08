# PJ コックピット

AMD OS の **中心画面**。各 PJ ごとに 1 つあり、URL は `/project/{project_id}/cockpit` (例: `/project/p21/cockpit` = SX)。

## 誰がいつ使うか
- **PM / PL / 伴走メンバー** (= PJ を動かす AMD メンバー) が日常的に開く
- **月次確認**で月次報告書 draft の「これでいい？」nudgeに返す
- 経営判断のタイミングで **経営ハイライト** を確認・採否
- **まさえいMTG** で議題を出すときに、各 PJ の candidate をここで見る

## 画面構成 (上から)

```
┌─────────────────────────────────────────────────────┐
│  PJ ヘッダー (= 名前 / status / 分類 / 契約サマリー)    │
├─────────────────────────────────────────────────────┤
│  AMD スコアグラフ │ PRS / legacy M-X-F │ XRL 進捗グラフ    │
├──────────────────┬──────────────────┬──────────────┤
│  タブ: 進捗管理 / スコア詳細                         │
├──────────────────┬──────────────────┬──────────────┤
│  年間 MS リスト   │  TODO              │  月次確認       │
│  月次サマリ       │  資料              │  つくよみメモ   │
│                   │  経営ハイライト    │               │
│                   │  MTG サマリ        │               │
└──────────────────┴──────────────────┴──────────────┘
```

(= 3 カラム x 2 段、まさ #28 確定 2026-05-24)

PJ ヘッダー最上部には、PJリスト (`/admin/projects`) の正本から、PJメンバー、契約条件、業務委託料、支払い条件、提出物の有無、月次報告書の状態と詳細、立替精算可否を表示する。提出物/月次報告/立替精算は `projects.contract_terms_json` の `deliverablesRequired` / `deliverablesNote` / `monthlyReportSubmissionRule` / `monthlyReportSubmissionTiming` / `monthlyReportSubmissionDeadline` / `monthlyReportSubmissionFormat` / `monthlyReportSubmissionRequiredItems` / `monthlyReportSubmissionNote` / `expenseReimbursementAllowed` / `expenseReimbursementNote` を見る。月次報告の値は `要提出` / `不要` / `指定なし` / `要確認` / `不明` を短く出し、時期・提出期限・フォーマット・記載事項・根拠を補足に畳む。値は契約書/見積書から `contract_terms.extracted_terms_json` へ抽出され、Contract Apply 後に PJ 正本へ畳まれる。契約条項に無くても PJ 運用として提出が必要な場合は、同じJSONに根拠を残して表示する。

SU 系 PJ では、PRS primary / legacy M-X-F / XRL グラフは常時表示し、その下で **進捗管理** と **スコア詳細** をタブ切り替えする。2つのタブは横幅いっぱいを左右半分ずつ使う。進捗管理タブは従来のコックピット本文、スコア詳細タブは `/venture-map/amd-score/{projectId}` 相当の PRS Primary / PRS history / legacy M-X-F 詳細 / FRL / XRL チェックリストを cockpit 内に埋め込む。スコア詳細は画面表示直後に裏で読み込み、同じコックピットを見ている間は数分単位で再利用するため、2回目以降のタブ切り替えでは読み込み待ちが出にくい。

KUTE (`p25`) では、ヘッダー直下に **年度内ロードマップ** を表示する。2026年6月から2027年3月までの横軸で、規程整備レーン (`2027年1月目途で整備完了`) と、シーズ発掘 / after GTIE レーン (`2027年3月までに支援実務の型化`) を同時に確認する。根拠は 6/11 キックオフ資料と `PROJECT_BRIEF` の年度内スケジュール。

---

## TODO

`proactive_outbox` に積まれた、その PJ の「次に AMD から打つべき一手」を TODO として read-only で表示する。外部送付や状態更新はこのカードからはしない。

表示するもの:
- 状態: 未送信 / 司令塔送信済み / 資料作成済み / 相手へ送信済み / 完了 / ブロック
- 誰のボールか: AMD / 相手 / 双方 / 曖昧
- 期限、優先度、資料の種類、トリガー理由
- 担当司令塔 thread の短縮ID
- 推奨 first move と、遅れた場合のリスク

対象 status は、初期表示では `queued`, `sent_to_commander`, `drafted`, `blocked`。`closed` や `sent_to_counterpart` は完了・送付済みの履歴であり、通常の TODO には出さない。行を押すと画面内モーダルで、発生経緯、`source_kind/source_id`、`proactive_loop_events` の履歴、遅れた場合のリスク、司令塔/worker が作成済みの資料リンク、外部送付可否、次の期待アクションを確認できる。RLS は admin の authenticated read 前提なので、権限がないユーザーにはキューは表示されない。

既存の最下段 TODO かんばんは、PJ cockpit と HUD cockpit の主要導線から外す。MS の細かな作業項目は MS 詳細、先手力系の次アクションはこの TODO に集約する。

---

## 資料

TODO と経営ハイライトの間に、PJ全体の資料置き場を表示する。提案書、試算表、契約案、参考PDFなど、特定MTGだけに閉じない資料をここへ置く。

- ファイルを追加すると、Google Drive の当該PJ folder (`projects.drive_folder_id`) 配下に `AMD OS 資料` folder を作り、その中へ新規ファイルとして保存する
- OS 側には `project_documents` に Drive file ID / folder ID / link / file name / MIME / size / uploaded_by / created_at だけを残す。ファイル本体は DB に保存しない
- 同名ファイルは上書きしない。Drive 側で同名の新規ファイルとして残す
- 資料一覧の閲覧と追加は、そのPJの active member または admin が使える。PJ cockpit を開けるメンバーが、資料一覧だけ `Forbidden` で見えない状態にしない
- PJ folder id 未設定、Google Drive credential 未設定、Drive 書き込み権限不足の場合は、資料パネル内で warning / retry を表示し、他の cockpit 表示は止めない

MTG詳細モーダル内の「添付資料」は会議単位の `meeting_assets`。新規添付はその会議の Drive folder (`PJフォルダ / YYMMDD_会議名`) に保存する。この「資料」はPJ単位の Drive link 台帳なので用途を分ける。

---

## PJ Status (= AMD Score / XRL)

### AMD Score
- PJ / SU の価値・成熟度を見る総合スコア。p00 の `AMD Management Score` とは別物
- 現行 primary は PRS (`P x R x S`)。legacy M-X-F / 7軸 Cobb-Douglas は comparison と evidence 用に残す
  - `P` = Potential / 潜在規模
  - `R` = Reach / Readiness (= TRL/BRL/GRL/SRL/HRL の contribution product)
  - `S` = Survival (= σ_SU / FRL / R_net の contribution product)
- legacy M-X-F の構成
  - `σ_SU` = Macrotrend / Triple Helix (= 学術 μ_A × 産業 μ_I × 政府 μ_G)
  - XRL = 会社側の readiness (= TRL/BRL/GRL/SRL/HRL)
  - FRL = CEO / founder 側の leadership readiness (= ALQ / Grit / Resilience 等)
- **過去 = 実線** (黒)、**未来予測 = 破線** (5 4 dash) で表示
- 右上 pill (大数字) は **現在のスコア** (= 過去最終点)
- legacy M/X/F カード = PRS の根拠・比較用。現行 primary に戻さない

### XRL 進捗 (5 軸)
- TRL (技術) / BRL (事業化) / GRL (制度) / SRL (社会) / HRL (人材)
- 1-9 段階で内閣府 SIP 体系互換
- Gemini 2.5 Flash が毎朝 03:15 JST に判定 → `/notifications` で「はい / いいえ」承認 → 確定
- ドットクリック (= 透明 r=16 hit area) で詳細モーダル

→ **判定ロジック詳細は [3-2 章 3.3 抽出パイプライン](3-2-data-and-extraction.md#33-抽出パイプライン)** + **[9-1 章 5.4 責務分担マトリクス](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)** 参照。Atlas / Macrotrend / AMD Protocol との関係は **[4-1 章 判断エンジン](4-1-atlas-protocol-score-macrotrend.md)**。

---

## 年間マイルストーン (MS)

- 4 月期-3 月期で 年間 10-15 個の MS を持つ
- 各 MS は `pt` (= ポイント)、`effort` (= 年間 / 期 / 単発)、責任者 (= AMD メンバーごとの share %)
- Gantt 表示 (= 月 4/26-3/27)
- 各 MS をクリック → 行が展開し、そのMS単位のゴール / TODO / 現状 / 直近材料を確認
- MS 本体・期間・pt・tag・担当 share の編集は `/admin/ms-overview` に集約する。PJ cockpit / HUD cockpit では MS 設計を保存しない。

### MS の進捗
- `milestone_monthly_progress.note` + `progress_pct` で月次更新
- Codex automation `amd-os-ms` が 6h ごとに 5 生データから差分推定
- PM は月次モーダルの report / progress 確認で必要な修正要望やFIXを返す

### MS の 3 列展開
- **ゴール** = `value_milestones.success_criteria`、MS個別期間、pt、担当share
- **TODO** = `milestone_sub_items` + `milestone_responsibility.task_description`
- **現状** = `milestone_monthly_progress.note` + `progress_pct` + `member_ms_activities` + MS紐付き `member_activities`

長期テーマは別の新コンテンツにせず、そのPJのMSとして定義し、この展開欄で追う。MTGサマリは会議単位、経営ハイライトは「起きたこと」、MS展開欄は「このテーマを次にどう進めるか」の作業台として使う。

## 今シーズン収支

PJ cockpit の進捗管理タブでは、今期 MS リストの直下・月次カードの手前に **今シーズン収支** を表示する。目的は、MS 設計と報酬計算が AMD の運営費・バッファを勝手に削っていないか、シーズン頭から確認できるようにすること。

表示するもの:
- シーズン合計: `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `期末未払`
- 月次行: 各月の `クライアント支払` / `バッファ` / `PJ予算` / `メンバー支払` / `未払残` / `残`

クライアント支払は契約ベースの `contractBackedClientAmount` に別財布売上 (`billing_cycles.extra_revenue_json`) を按分加算する。契約が schedule_based の場合は `contract_terms_json.monthlySchedule.amountTaxExcl` も予定売上として読む。バッファは `value_plan_cycles.buffer_breakdown_json` にシーズン全体の内訳がある場合はそれを優先し、未設定の PJ だけ `billing_cycles.budget_buffer_amount` を読む。原資上限は `(クライアント支払 - バッファ) × 65%`。PJ予算は `billing_cycles.budget_yen + extra_budget_yen`、メンバー支払・未払残は `billing_cycles.reward_summary_json` を読む。役員向け報酬相当額は検算には含めるが、メンバー向けの PJ cockpit では表示しない。期末未払が 1 円でも残る場合、または PJ予算が原資上限を 1 円でも超える場合は、赤い停止帯と不足表示を出し、報酬計算側で最終月に自動上乗せしてゼロに見せない。MS 設計の保存は `/admin/ms-overview` で、同じ数字を使った保存前検算が不足状態を `blocked` にする。

---

## 経営ハイライト (= 旧「経営・事業シグナル」)

> **これは「進んだこと・起きたこと」だけを書く場所**。未了 / TODO / アイディア / 議論中は **書かない** (= 別の場所、たとえば TODO かんばん #26 設計予定)。
> (まさ #26 #27 2026-05-24 確定)

### 分類

| 分類 | 色 | 含まれる signal_type |
|---|---|---|
| 🏛 **経営全般** | violet | `management_decision` / `strategic_pivot` / `funding` / `next_move` |
| 🚀 **事業開発** | emerald | `business_progress` / `commercial_progress` / `partnership` |
| 🔬 **技術開発** | sky | `tech_progress` (= 自社特許 / 技術スタック進捗) |
| 🌐 **外部環境** | amber | `ip_regulatory` (= 他国規制等) / `risk` |

外部マクロ一覧の正本は **Atlas** (= header の「Atlas で全マクロ ↗」リンク)。ただし PJ にとって重要な外部シグナルも cockpit に並ぶ (= 例: 5/21 中国レアアース → SX 重金属回収追い風)。

### Polarity アイコン (= まさ #29 #26 4 種類確定 2026-05-24)
- 🎉 大進捗 (= IPO 内諾、量産開始、特許出願完了、大型受注)
- ✨ 順調な前進 (= LOI 締結、PoC 完了、調達合意)
- 🔄 戦略転換 (= 事業ピボット、戦略撤回)
- ⚠️ リスク・悪化 (= 訴訟、品質問題、契約破棄)

→ **🌐 中立アイコンは廃止** (まさ判断 #29 2026-05-24): 外部環境シグナルも中立じゃなく、PJ にとってプラスかマイナスのいずれか。中立なら書く必要がない。

### AMD Score 影響併記 (= まさ #31 2026-05-24)
各シグナルに「📊 影響: TRL 4→5、X 軸 +40pt」を 1 行で添える (= `score_impact_summary` 列、実装は別 task)。

### candidate と confirm の違い
- **candidate** = Codex automation が抽出したばかり、まさが内容を確認する前 (= 「⚠️ 未確認」注釈)
- **confirmed** = まさえいMTG でまさが「これで OK」と確定したもの (= 注釈なし)
- **rejected** = 抽出が誤りでまさが却下したもの (= 表示しない)

詳しいフローは **[2-4 章 2.2 まさえいMTG](2-4-amd-cockpit.md#22-まさえいmtg)**。

### つくよみに修正依頼
各シグナルに「⚠️ つくよみに修正依頼」ボタンあり。修正コメント (= 例「これは LOI じゃなく NDA」) を投げると `l2_feedbacks` に保存され、**次回 Codex automation の抽出 prompt に過去フィードバックとして含められる** (= 学習ループ)。

→ 詳細は **[3-2 章 3.4 つくよみ修正依頼 → 学習ループ](3-2-data-and-extraction.md#34-つくよみ修正依頼--学習ループ)**。

---

## MTG サマリ

- `project_meeting_summaries` テーブル
- 入力: Calendar (= 開催情報) + Slack / Notion / Drive (= 議事録本文) + dialogue API (= まさえいMTG)
- `source_kinds` で種別判別: `regular` (= 定例) / `dialogue` (= まさえいMTG) / `upcoming` (= 日時確定済みの予定MTG) / `upcoming_tentative` (= 日程未確定の仮置き)
- MTGサマリ先頭では、`source_kinds='upcoming'` や `upcoming+calendar+manual-prep` のように `upcoming` token を含み、かつ開始時刻が現在より後の row を「予定MTG / 準備中」に出す。`source_kinds='upcoming_tentative'` は別欄を作らず同じ「予定MTG / 準備中」欄に入れ、日付欄に `日程未確定` と表示する。`meeting_id` が `upcoming:` で始まっても、`source_kinds` が開催済みソース (`notion` / `gmail` / `drive` / `slack` / `calendar` など) なら準備カード扱いしない
- 通常の PJ コックピットでは、MTGサマリ一覧を小さな枠内でスクロールさせない。カードが増えたときは一覧全体を縦に伸ばし、コックピット全体のページスクロールで読む
- 開催済み議事録を開いた時に出す会議前準備メモは、手動で作った準備メモまたは prep worker の成果がある場合だけ表示する。カレンダー同期だけで作られた薄い予定テンプレートは、会議後に `MTG準備情報` として残さない
- H-1 routine は今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡し、前回議事録がまだ無いPJでも `source_kinds='upcoming'` の予定MTGカードを作る。recurring series はシリーズごとに次回1枚だけを表示し、同じ定例が複数カードとして並ばないようにする
- 一覧カードの短い説明は `summary_short`。詳細モーダルは `narrative_md` があればそれを主表示する
- 詳細モーダルで `narrative_md` (= H-1の MTG サマリ抽出 routine が、そのMTGに参加していなかったメンバーでも背景・議論の流れ・決定/未決・次の一手を理解できる文章 narrative に書き直したもの) を主表示
- 詳細モーダルの Markdown 本文に active AMDメンバーの `members.code_name` が standalone mention として出る場合、`/mypage?memberId=<members.member_id>` へ自動リンクする。これは admin が OS 内本文からメンバー詳細へ移動するための導線で、既存の Markdown link / code / pre は維持する。短い code_name が `しかるべき` や `こうして` のような長い語へ埋まっている場合はリンクしない
- raw 配列 (= 元データ) は折りたたみ「元データ」へ
- 今後の議事録本文は `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順で書く。絵文字・見出し文言・順序は固定で、絵文字と語の間に空白を入れない
- 今後の議事録本文は箇条書き禁止。`decided / progress / next_actions / risks` の配列は検索・通知用の補助であり、本文は段落で流れを説明する
- 手動修正する場合も、`narrative_md` はこの5見出し順を守る。`✅決まったこと` には会議で実際に合意・確認されたことだけを書き、資料だけからの推定や未決事項は `📊経緯` または `⚠️残課題` に残す
- MTG詳細モーダルの「表示内容を編集」は、表示している section を同じ位置で textarea 化する。`narrative_md` が表示されている通常MTG / dialogue は `narrative_md` を編集し、`decided / progress / next_actions / risks` の raw section が表示されている場合だけ、その raw section を編集する。予定MTGでは `risks` 列を破壊せず、UI上は「必ず確認すること」として表示・編集する
- 通常MTG / dialogue は `POST /api/meeting-summary/manual-update` で `title / summary_short / narrative_md / decided / progress / next_actions / risks` を更新できる。手動修正は `source_hash` を変えないため、同じ元ソースに対する自動抽出の再実行で上書きされにくい。MTG 詳細モーダルには「つくよみに修正依頼」を置かず、人間が直した本文を `manual-edit` として保存する
- `narrative_md` は議事録本文の正本。`summary_short` と raw 配列だけの保存は品質劣化なので、開催済みMTGの backfill / routine は narrative なしで保存しない。既存の長い narrative は migration 098 と manual-update API で、空欄や箇条書き優勢の更新から保護される
- `notion:<page_id>` 由来で narrative なしの弱い手動 duplicate が、同じ日・同じタイトルの強い row と並ぶ場合は、一覧では強い row を優先して表示する
- 詳細モーダルの「添付資料」では、md / docx / xlsx / pptx / txt / csv / zip / 画像 / PDF など一般ファイルを MTG に紐づけて保存できる。ファイル選択、drag & drop、クリップボードのファイル/画像ペースト、browser の画面キャプチャを同じ `meeting_assets` に保存する。Markdown (`.md` / `.markdown`) はOS内モーダルで本文を読める
- 新規添付の実ファイルは Google Drive の当該PJ folder (`projects.drive_folder_id`) 配下に `YYMMDD_会議名` folder を作成/再利用して保存する。カード上には `保存先: PJフォルダ / YYMMDD_会議名` を表示する。旧添付の private Storage `meeting-assets` は互換表示する
- 「本文へ」を押すと、添付画像 / ファイルリンクが `narrative_md` の添付資料 block に Markdown で挿入される。本文には `/api/meeting-assets/file/{asset_id}` だけを残す
- 各カードを開くと URL が `?meeting=<meeting_id>` に変わる。この URL を共有すると、同じ PJ コックピットを開いた時点で該当 MTG 詳細モーダルが開く
- 詳細モーダル上部の共有操作では、`PDF保存` / `議事録コピー` / `準備メモコピー` / `共有URLコピー` が使える。`PDF保存` は印刷画面ではなく、共有用に整えた本文を直接PDFとして保存する。`議事録コピー` は `narrative_md` または fallback section から会議後サマリだけを、件名候補・日時・概要・本文つきのプレーンテキストへ整える。`narrative_md` 末尾に `参考: 会議前準備メモ` がある場合は議事録から除外し、`準備メモコピー` で別にコピーする。`共有URLコピー` は OS 内で同じ MTG 詳細を開くための `?meeting=` link をコピーする

### 「まさえいMTG」とは
- まさとえいみ (= LLM) が、チームへ提案する前の論点・提案・残課題を整理する対話セッション
- 議事録では「決定」よりも「提案」「整理」「相談前提の論点」として残す
- 詳細は **[2-4 章 2.2 まさえいMTG](2-4-amd-cockpit.md#22-まさえいmtg)**。

### MTG Prep セッション自動立ち上げ (2026-06-22 まさ確定)

> **何が嬉しいか**: 「明日 MTG あるけどまだ準備してない、codex を毎回開いて『背景はこうで…』と説明するのがだるい」を OS 側で解決する。**既存 H-1 automation の Phase P** が、翌7日の MTG ごとに **codex の新規 session を事前 spawn** する。session の中で文脈ロード・会議設計スターター・着地点 draft・資料 draft・readiness 計算まで終わって待機する。まさは codex desktop で該当 session に入り、「前回こうだった、今回の着地はこうだと思う」から会議設計の相談を始められる (= 普段どおりの操作、ターミナル不要)。

#### prep の timing

- **post-MTG 即時主義**。前回 MTG の翌日から、今回 MTG の 24時間前までの間で、まさカレンダーの空き枠を探して prep を入れる
- 24時間前が土日など H-1 が動かない日に当たる場合は、同じ時刻のまま直前の稼働日に繰り上げる。例: 月曜12:00のMTGなら、金曜12:00に prep 枠を作る
- セッションは prep 枠の開始時刻までに立ち上げ完了している状態を目標にする。H-1 が毎時15分に動く都合で、金曜12:00枠なら直前の金曜11:15 run で session を起動する
- 過去同シリーズが無い MTG (= 完全初回) は、検知された瞬間から prep を始められる
- ギリギリではなく、余裕がある日に前倒しでやる (= 先手先手主義)

#### prep 枠 (= まさカレンダー上の prep 作業時間)

- prep 作業自体を **「＋ <PJコード> MTG準備: <MTGタイトル>」** という Calendar event としてまさカレンダーに作る
- prep 枠には、その PJ の Calendar 色を自動で付ける。色は `CFG_ColorPJHistory` を PJコードから逆引きして決め、既存 prep 枠が無色・別色なら次の H-1 run で色だけ補正する
- タイトル先頭 `＋` = 動かせるタスク (= 既存 H-1 `+<PJ>` 規約と統一)
- まさが「この日無理」と思って枠を別日時にドラッグしたら、次の H-1 run (毎時) で追従して spawn 時刻を再計算する
- 対象は **まさのカレンダーだけ** (= 他メンバーには prep 枠を作らない、まさ確定)

#### MTG カードの表示

- 翌7日に予定MTG (= `source_kinds='upcoming'`) がある PJ では、cockpit MTG サマリの予定MTGカードに以下が表示される:
  - **readiness pill**: 緑 80↑ (準備OK) / 黄 50-79 (もう一押し) / 赤 <50 (要相談)
  - **session 状態 chip**: 「prep セッション準備中」 / 「ready (codex で開いてね)」 / 「起動失敗」
- worker が生成した資料 draft は Drive `PJfolder/YYMMDD_MTG名_prep/` に置かれる (= 本資料フォルダではなく draft フォルダ)
- worker が会議前の AI Meeting Notes page を見つけた場合は、PJ 固有名詞・略称・拾うべき論点を `AI Meeting Notes用コンテキスト` として先に入れ、MTGカードの `notion_url` から開けるようにする。見つからない場合は、worker が作成したアジェンダ草案入り Notion 議事録ページまたは手動貼り付け用 context を表示する
- `AI Meeting Notes用コンテキスト` は「作った」だけでは完了扱いにしない。worker は当日の AI Meeting Notes page に marker 付きで入ったことを確認してから `ready` にする。見つからない、書けない、候補が曖昧、既存 `prep_notion_page_id` が過去 page を指す場合は、その状態を `prep_readiness_reasons.notion_ai_context` に残し、`prep_draft_md` に手動貼り付け用 context を残す

#### prep session の第一声

- prep session を開いた時の最初の有用出力は、`ready` や保存先の技術報告ではなく、まさと会議設計を始めるための第一声にする
- 最低限、「前回/直近の流れ」「今回の着地仮説」「冒頭で確認したいこと」「まさへの確認問い」を出す
- 会議後も同じ session で、H-1 議事録を読んだうえで「こういう結果だった、次回はどうする？」という相談に続けられる前提で残す

#### Slack DM nudge

- H-1 run は `prep_worker_status='ready'` になった MTG を自動で Slack DM しない。MTGカードに readiness / threadId を保存するのが既定動作
- まさから明示的に通知依頼がある場合だけ、まさ専用 Slack DM にまとめて送る (= 同じMTGには重複送信しない)
- 送信ルートは `/Users/masa/projects/AMD/amd-os/scripts/send-eimi-slack.mjs` 固定。Codex / ChatGPT / Slack connector から直接送らない
- 形式 (つくよみ口調):
  ```
  🌙 まさ、prep セッション立ち上げといたよー

  📌 KUTE定例 (明日10:00, p25, オンライン)
     readiness 75/100  🟡
     codex で開いてね、待機してるよ

  📌 pHydrogen KR訪問 (明後日14:00, p07)
     readiness 35/100  🔴
     codex で開いてね、資料draftは作ったけど着地点要相談
  ```
- まさは codex desktop を自分で起動 → 該当 session に入って対話開始。ターミナル操作不要。session 側は保存完了報告ではなく、会議設計スターターで待機する
- 各 PJ の facilitator (= kaz / かる / ちこ等) には同じDMを送らない (= **まさ専用 DM だけ**、まさ確定)

#### codex のみで spawn 統一

- session は codex で立ち上げる (= claude code は使わない、まさ 2026-06-22 確定)
- codex は ChatGPT サブスク認証で動くため、prep セッションで定額外トークン課金は発生しない

詳細仕様は **[3-3 章 H-1 MTG Prep セッション自動立ち上げ](../spec/3-3-meeting-flow-current-spec.md)** / **[8-3 章 L2 H-1 MTGフロー](8-3-l2-extraction-routines-spec.md)**。

---

## 月次確認 (= 月次カード / admin請求)

PM 向けの cockpit 右カラム step UI は廃止済み。コックピットでは月次カードから対象月を開き、`CockpitMonthlyModal` で進捗・報酬・月次報告書を確認する。自動生成された月次報告書 draft に対する軽い確認は Slack nudge 側で扱う。

`報告会日程調整` は完全廃止。代わりに 2 か月に 1 回、対面のナレッジ会を月次ルーティン外で行う。
`請求額確定` は cockpit の PM step としては持たない。契約 apply 済みPJでは `contract-billing-auto-confirm` が自動確定するため、PM/PL の `/mypage` 月次nudgeにも出さない。契約書由来の金額や対象月の報酬額が見えない場合は、通常のPMタスクではなく契約台帳/報酬キャッシュの整備対象として扱う。
`立替確認` はPM月次タスクから外す。`請求書発行/送付` はadminの役割として `/admin/billing` で扱う。CTB見積はCTB停止中のため一旦廃止。

| 項目 | やること | クリック先 |
|---|---|---|
| 月次カード | `monthly_reports` / MS進捗 / 報酬状態を確認し、必要なら月次モーダルで修正・FIXする | 月次モーダル |
| 請求書発行/送付 | 請求書番号・PDF・freee連携、送付済み管理 | `/admin/billing` |

月カード (`2026.05稼働分`) をクリックすると月次の集約モーダルを開く。`?step=<stepId>&ym=YYYYMM` は legacy query で、現行 cockpit は step modal を開かない。

### 月次報告書の社内保存用 / 提出用

月次モーダルの `📝 社内保存用を編集` は全 PJ 共通の `monthly_reports` 本文を生成・修正・FIXする場所。ここで確定した本文が AMD 社内保存用の正本で、提出用テンプレートの本文ソースにもなる。

CX (`p20`) / SX (`p21`) / KUTE (`p25`) は月次提出が必要なため、月次モーダルのヘッダと本文エリアに `提出用` リンクを出す。各リンクは印刷ビューへ `template` query を付けて開き、提出先ごとの構成へ分岐する。

| PJ | 提出用リンク | 出力フォーマット |
|---|---|---|
| CX (`p20`) | `NIMS提出` | NIMS Pilot CX月次レビュー |
| SX (`p21`) | `愛媛大提出` | 愛媛大学 SX月次報告 |
| KUTE (`p25`) | `工学院提出` | 工学院大学 KUTE月次報告 |

上記以外の PJ は AMD 標準の `PDF` リンクだけを表示する。PDFファイル自動生成は行わず、印刷ビューを開いて Cmd+P → PDF保存で出力する。

`billing_cycles.invoice_ym` が稼働月と違う場合 (= 複数月を後からまとめて請求) でも、PM cockpit に請求 step は出さない。請求月の繰延は `/admin/billing` / `/admin/payouts` / finance 系で扱う。

→ 詳細は **[2-6 章 admin オペ](2-6-admin-ops.md)** へ。

---

## つくよみメモ

`tsukuyomi_nudge_queue` テーブルに溜まる「LLM が見つけた要注意事項」を右下に表示。例:
- 「DG ダイワ から VC 6/12 同時突入予定の進行確認」
- 「担当メンバーの活動量が直近 7 日で減少」

各 nudge は「対応済」or「無視」で消える。

---

## メンバー / 事業会社 / 創業メンバー (= 用語の使い分け ⭐)

**ここで使われる「メンバー」関連用語は紛らわしい**。整理:

| ボタン / モーダル名 | 実態 | データソース |
|---|---|---|
| **👥 メンバー** | AMD 内部メンバーで、この PJ に伴走してる人 | `project_members.member_id` (= AMD members table への FK) |
| **🤝 事業会社** | 興味事業会社 (= 協業先 / 顧客候補)。法人レベル | `project_partners` |
| **「創業メンバー」モーダル内の表示** | ⚠️ **実態は「関連メンバー」全部** = SU 創業候補 + 事業会社担当 + VC 担当 + その他関係者まで含む | `project_founding_members` (= LLM 抽出、紛らわしい名前) |

→ **`project_founding_members` という名前は誤解を生む** (= 創業メンバーだけじゃない、関連メンバー全体)。リネーム候補。マニュアルでは「**関連メンバー (= LLM 抽出)**」と呼ぶ。

→ 詳細は **[3-2 章 3.5 用語と実装の対応](3-2-data-and-extraction.md#35-用語と実装の対応)** へ。

---

## 🏛 株主・ガバナンス + 要対応 (2026-06-15 追加)

PJ cockpit の経営ハイライト直下に「**🏛 株主・ガバナンス**」欄が出る (admin のみ表示)。**終了した PJ でも表示される** (株主総会・清算・持分は卒業後も残るため)。

- 表示: AMD/まさの保有株式と概算保有価値、**総会・取締役会履歴一覧**と決議・AMD対応 (委任状提出、書面決議への同意など)、資金調達ラウンド/バリュエーション、株主構成 (キャップテーブル)、そのPJの確定済み要対応。
- 総会レコードには総会関連資料 (招集通知・議案・契約・決算書・cap table 等) がリンクで添付される。メール抽出時に添付本文が渡された場合、実ファイルは Google Drive の当該PJ folder (`projects.drive_folder_id`) 直下に `YYMMDD_会議名` folder を作成/再利用して保存し、cockpit には Drive の `webViewLink` を押せるリンクとして出す。例: `260616_取締役会書面決議`。
- データの編集は欄右上「編集」→ **`/admin/governance`** で行う (株主/ラウンド/総会/要対応の手入力 CRUD)。
- **要対応 (期日順)**: `/dashboard` と `/notifications` の先頭に、全PJ横断 + 会社/個人スコープの「期日つき要対応」(株主総会の議決権・事前承諾、契約更新、振込期限など) が期日順 + 「あと何日/期限超過」で出る。「対応済にする」で消える。表示対象は `review_status='confirmed'` かつ未完了 (`open` / `in_progress`) のものだけ。未確認 `candidate` はレビューキューに留め、PJ cockpit の株主・ガバナンス正本欄には混ぜない。
- 5生データからの自動抽出は daily routine / Codex collector の D-14 + L3 が候補を作る。期日つき要対応は `/api/action-items/extract`、総会・取締役会・書面決議の履歴候補は `/api/governance/extract` に入り、未確認のものは review candidate、確認済み (`apply=true`) は `project_shareholder_meetings` に反映される。`attachments` に `content_base64` / `data_url` を含めると、確認済み反映時に上記 Drive folder へ保存される。手入力でも追加できる。
- `source='meeting_summary'` の会議タイトル由来候補は D-14 要対応の対象外。会議から出た次アクションは H-1 / MTGカード側で扱い、株主・ガバナンス欄には、外部から来た期日付き義務と、株主/総会/ラウンド/保有株式の正本情報だけを入れる。
- D-14G の Gmail sweep は `/admin/projects` の「総会」「役会」checkbox が ON の PJ だけを対象にする。対象PJの `report_emails` との `from/to/cc` やりとりに、株主総会・招集通知・取締役会・書面決議などの keyword が入っているメールを探し、既定は候補投入、`apply=1` で履歴反映 + Drive添付保存まで進める。`report_emails` が空の PJ はフラグONでも sweep skip。

→ 詳細仕様: [`pwa/design/governance_action_items.md`](../design/governance_action_items.md)、消してはいけない導線: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md)。

---

## 関連
- 設計議論: [`pwa/design/cockpit.md`](../design/cockpit.md), [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md), [`pwa/design/strategy_signals_redesign.md`](../design/strategy_signals_redesign.md)
- 過去判断ログ: **[9-1 章 過去判断と経緯](9-1-decisions-and-history.md)**
