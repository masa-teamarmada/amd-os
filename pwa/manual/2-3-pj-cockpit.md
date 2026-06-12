# PJ コックピット

AMD OS の **中心画面**。各 PJ ごとに 1 つあり、URL は `/project/{project_id}/cockpit` (例: `/project/p21/cockpit` = SX)。

## 誰がいつ使うか
- **PM / PL / 伴走メンバー** (= PJ を動かす AMD メンバー) が日常的に開く
- **月次ルーティン**で月初・月末に各 step を触る
- 経営判断のタイミングで **経営ハイライト** を確認・採否
- **まさえいMTG** で議題を出すときに、各 PJ の candidate をここで見る

## 画面構成 (上から)

```
┌─────────────────────────────────────────────────────┐
│  PJ ヘッダー (= 名前 / レーン / アウトカム / 設立日)   │
├─────────────────────────────────────────────────────┤
│  AMD スコアグラフ │ PRS / legacy M-X-F │ XRL 進捗グラフ    │
├──────────────────┬──────────────────┬──────────────┤
│  タブ: 進捗管理 / スコア詳細                         │
├──────────────────┬──────────────────┬──────────────┤
│  年間 MS リスト   │  TODO              │  月次ルーティン │
│  月次サマリ       │  資料              │  つくよみメモ   │
│                   │  経営ハイライト    │               │
│                   │  MTG サマリ        │               │
└──────────────────┴──────────────────┴──────────────┘
```

(= 3 カラム x 2 段、まさ #28 確定 2026-05-24)

SU 系 PJ では、PRS primary / legacy M-X-F / XRL グラフは常時表示し、その下で **進捗管理** と **スコア詳細** をタブ切り替えする。2つのタブは横幅いっぱいを左右半分ずつ使う。進捗管理タブは従来のコックピット本文、スコア詳細タブは `/venture-map/amd-score/{projectId}` 相当の PRS Primary / PRS history / legacy M-X-F 詳細 / FRL / XRL チェックリストを cockpit 内に埋め込む。スコア詳細は画面表示直後に裏で読み込み、同じコックピットを見ている間は数分単位で再利用するため、2回目以降のタブ切り替えでは読み込み待ちが出にくい。

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

### MS の進捗
- `milestone_monthly_progress.note` + `progress_pct` で月次更新
- Codex automation `amd-os-ms` が 6h ごとに 5 生データから差分推定
- 月次ルーティン step「2. 報告会日程調整」あたりで PM が確認・確定

### MS の 3 列展開
- **ゴール** = `value_milestones.success_criteria`、MS個別期間、pt、担当share
- **TODO** = `milestone_sub_items` + `milestone_responsibility.task_description`
- **現状** = `milestone_monthly_progress.note` + `progress_pct` + `member_ms_activities` + MS紐付き `member_activities`

長期テーマは別の新コンテンツにせず、そのPJのMSとして定義し、この展開欄で追う。MTGサマリは会議単位、経営ハイライトは「起きたこと」、MS展開欄は「このテーマを次にどう進めるか」の作業台として使う。

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
- MTGサマリ先頭では、`source_kinds='upcoming'` や `upcoming+calendar+manual-prep` のように `upcoming` token を含む row は「予定MTG / 準備中」、`source_kinds='upcoming_tentative'` や `meeting_id` が `upcoming:` で始まるだけの仮置き row は「日程調整中MTG」に出す。未確定分は確定予定 count には含めず、一覧の日付は未定として表示する
- L2⑥ routine は今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡し、前回議事録がまだ無いPJでも `source_kinds='upcoming'` の予定MTGカードを作る
- 一覧カードの短い説明は `summary_short`。詳細モーダルは `narrative_md` があればそれを主表示する
- 詳細モーダルで `narrative_md` (= L2⑥の MTG サマリ抽出 routine が、そのMTGに参加していなかったメンバーでも背景・議論の流れ・決定/未決・次の一手を理解できる文章 narrative に書き直したもの) を主表示
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

### 「まさえいMTG」とは
- まさとえいみ (= LLM) が、チームへ提案する前の論点・提案・残課題を整理する対話セッション
- 議事録では「決定」よりも「提案」「整理」「相談前提の論点」として残す
- 詳細は **[2-4 章 2.2 まさえいMTG](2-4-amd-cockpit.md#22-まさえいmtg)**。

---

## 月次ルーティン (= 報告書 / 請求 / 会計)

各月の運用 step (= 例: 2026-04 稼働分) を、コックピット右カラムで前月から翌月まで追う。

```text
標準PJ
前月25日  請求額確定
   ↓
当月20日  報告会日程調整
   ↓
翌月03日  月次報告書FIX
   ↓
翌月04日  立替精算確認
   ↓
翌月08日  請求書発行
   ↓
翌月09日  請求書送付

CTB
前月28日  見積書送付 + 請求額確定
   ↓
当月20日  報告会日程調整
   ↓
当月28日  請求書発行 + 請求書送付
   ↓
翌月03日  月次報告書FIX
   ↓
翌月04日  立替精算確認
```

すべて **営業日調整あり** (= 土日なら前営業日へ繰り上げ)。

| step | 締切 | やること | クリック先 |
|---|---|---|---|
| 見積書送付 (CTBのみ) | 前月28日 | 見積書を発行・送付する | 請求書モーダル (`quotation`) |
| 請求額確定 | 前月25日 (CTB は28日) | 請求額・バッファ・PJ予算を入力し、PL承認に回す | 請求額確定モーダル |
| 報告会日程調整 | 当月20日 | 月次報告会の候補日を取り、日程を確定する | 日程調整モーダル |
| 月次報告書FIX | 翌月3日 | `monthly_reports` を確認し、送付できる状態に固定する | 報告書FIXモーダル |
| 立替精算確認 | 翌月4日 | 未処理の立替申請がないか確認する | `/reimburse` |
| 請求書発行 | 翌月8日 (CTB は当月28日) | 請求書番号・PDF・freee連携を作る | 請求書モーダル (`invoice`) |
| 請求書送付 | 翌月9日 (CTB は当月28日) | 送付済みにして `invoice_sent_at` を保存する | 確認ダイアログ |

月見出し (`2026.05稼働分`) をクリックすると月次の集約モーダルを開く。各 step 行は、それぞれ専用のモーダル / ページを開く。

`billing_cycles.invoice_ym` が稼働月と違う場合 (= 複数月を後からまとめて請求) は、当月側には **月次報告書FIXだけ**残し、請求額確定 / 立替確認 / 請求書発行・送付は請求月側でまとめて回す。

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

## 関連
- 設計議論: [`pwa/design/cockpit.md`](../design/cockpit.md), [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md), [`pwa/design/strategy_signals_redesign.md`](../design/strategy_signals_redesign.md)
- 過去判断ログ: **[9-1 章 過去判断と経緯](9-1-decisions-and-history.md)**
