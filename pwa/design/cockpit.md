# PJ Status コックピット — 設計の正本

作成: 2026-05-06 (cool-booth-b72d09 セッション)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## ⚠️ 既存 UI を勝手に消すな (まさのルール)

**新セッションのえいみ / Claude が一番先に読むべきこと**:
- 既存ページのリンク、ボタン、セクションを「自分の判断で消す」のは絶対禁止
- 過去のセッションで追加された機能は、まさが意図して入れたもの
- 「シンプルにしたい」「不要そう」と思っても、**まさに確認してから消す**
- 既存 UI が壊れた / 消えたとまさが指摘したら、まず git log / diff で履歴を遡って復元

このルールは [`AGENTS.common.md`](../../../../AGENTS.common.md) の「回答と実装の基本姿勢」(「データ消失・既存導線の消失・未確認の機能削除を避ける」) を PWA に当てはめたもの。

---

## このページが扱う範囲

`/project/[projectId]/cockpit` 直下に追加された **PJ Status セクション** の全体構造。
SU 系 PJ (`project_ventures` 行が存在する PJ、現在 9 件) でのみ表示される。

---

## ページ構成 (全体像) — 案C レイアウト (2026-05-23 まさ確定)

旧構成は `max-w-[1060px]` で左メイン 720px + 右 sticky 220px の 2 カラムだった。コンテンツが増えてきたので、画面幅をフルに使う **案C レイアウト** に組み替えた。

### Hero の出し分け (PJ 別)

- **p00 (= AMD 会社全体)**: `CockpitManagementScoreHero` を Hero として表示。横軸 ym, 縦軸 0-100 の折れ線で AMD Management Score の `total_score` と 5 軸 (`initiative_score` / `finance_score` / `retention_score` / `pipeline_score` / `direction_score`) の時系列を見せる。右側に最新値カード。
- **SU 系 PJ (project_ventures あり)**: `CockpitVentureStatus` を Hero として表示。AMD Score 折れ線と XRL 折れ線が `xl:flex-row` で横並び。
- **ecosystem PJ**: `showAmdScore` が false なので Hero なし。
- **その他 dtsu PJ で project_ventures が無い場合**: CockpitVentureStatus が「PJ Status 未設定」表示でフォールバックする。

### p00 (= AMD 会社全体) の月次データ

p00 にも他 PJ と同じく月次カード + 月次モーダルが出る。`billing_cycles` は backfill 済 (= 202601-202612 で 12 行、`status='not_started'`)。月次モーダルでは進捗タブだけ意味があり、請求書 / 報酬は他 PJ の動作と同じ UI が出るが内容は空。`monthly_reports` は M-1 Codex automation `AMD OS M-1 月次報告抽出` の対象。手動生成 route は復旧用。


```
/project/[projectId]/cockpit (CockpitView)
container: max-w-[1600px] mx-auto px-4 py-3 flex flex-col gap-3

[A]   CockpitHeader (full width)                PJ 名 / status / 契約ID単位の現行契約条件
[A2]  CockpitVentureStatus (full width hero)    PJ Status — 内部で AMD Score chart と XRL chart を xl: 横並び
                                                ecosystem PJ は AMD Score 対象外で非表示

CockpitHeader は `projects.contract_terms_json.currentContracts[]` を優先し、現行契約を契約ID単位で分けて表示する。各契約は、期間・更新、金額・支払、業務・成果物、費用負担、知財・利用、秘密保持・制限、解除・責任、特記事項を表示する。配列未移行のPJだけ、契約ID・原本名・NDAのいずれかの根拠がある平坦な契約条件を互換表示する。PJの開始/終了やfee設定だけから契約カードを作らず、現行契約がなければ `現行契約は未登録` と表示する。契約の金額が未確認ならPJ設定値で補完せず `金額未確認` とする。値が空の立替・費用条件は `未確認` であり、`0円` や `申請可` へ変換しない。

[A3]  Cockpit tabs                              SU 系 PJ では Hero 下に「進捗管理 / スコア詳細 / 会社概要」タブ。
                                                Hero はタブ外なので AMD Score + XRL は常時表示。
                                                2タブは横幅いっぱいを 1/2 ずつ占有し、クリック領域も左右半分。
                                                進捗管理 = 従来 cockpit 本文。
                                                スコア詳細 = `Bzm2ModelObservatory` + `AmdScoreView embedded`。正規URLは `/project/[projectId]/cockpit?tab=score-detail`。
                                                BZM 2.0は全価値実現経路の総和、共通経済評価地平までの資本自立経路全体、PJ固有の計画期限内経路を三段で表示し、PJ間比較用の共通期間曲線Q(h)を到達診断側へ分ける。旧q×Pを会社全体の期待時価総額と呼ばず、現在値・欠測・共通状態・版履歴と、現行SPS / R_net / FRL / XRL evidence / XRLチェックリストを別区画で集約。
                                                旧 `/venture-map/amd-score/[projectId]` はこのタブへ redirect (`p99` デモを除く)。
                                                スコア詳細は cockpit mount 時に非表示で先読みし、同一セッションでは 5 分TTLで再利用。
                                                タブ再表示時に TTL 超過なら表示済み内容を保ったまま背景再取得する。
                                                SX (p21) だけは「事業計画」を追加して4タブにする。

                                                事業計画 = 4開発レーン×5フェーズ表 → 100%株主構成 → 資本政策表 → 年次試算表。共通の枠は直接的な表題・項目名だけで構成し、PJ固有の仮説はフェーズのセルと計画データに置く。フェーズ表の直下には、表示中の4レーン×全フェーズだけをブラウザ内で `.xlsx` 化する「Excel出力」を置く。出力は期間・フェーズ予算・調達ラウンド・資金源・到達XRL・固定費バーン上限と、各セルの費用・活動・出口条件・関連XRLを1枚の横長シートに出し、先頭2行と開発レーン列を固定する。保存API・DB更新は持たない。
                                                SXのCapitalPlanWorkspaceは会社概要から事業計画へ移す。
                                                2026-07-28: 投資判断面は白・slate・indigoの表現へ統一し、色は状態と株主識別に限定する。GRLはSIPのGovernance Readiness Level（制度・規制・標準・ガイドライン、1〜8）で、組織内の採用・役割・統制とはHRLとして分離する。CapitalPlanMatrixは横スクロールのみ、株主ごとのFD比率サマリーを初期表示し詳細4行を個別展開する。年次試算は百万円の詳細PL・設備投資・株式調達・助成金の会計/資金繰りを別行で示す。表の直下には初期閉じの「前提パラメータ」を置き、年度別の売上・原価・助成金・人員・人単価（役員/社員それぞれの報酬・旅費・消耗品費）・工場以外の設備投資・IPO以外の調達、4段階の自社工場投資、IPO年度・公募額を手動変更できる。変更はブラウザ内の年次試算にだけ反映し、保存済みの資本政策・会社情報は書き換えない。

メインボード: 通常は grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3。凍結/再開ステータスがある時だけ lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px] gap-3
├── col1: 今期MS + 設定 + 過去
│   ├── [B]   CockpitGoalsCompact     今期 MS Gantt + 担当・割合
│   ├── [B2]  CockpitNextPeriodSetup  次期 MS 設定バナー / 直接編集
│   ├── [B2a] CockpitMsChangeHistory  MS変更履歴 (初期は折りたたみ)
│   └── [B3]  過去の期間 (折りたたみ)
│
├── col2: 経営ハイライト (D-6)
│   └── [B1]  CockpitStrategySignals  「重要な動き」はinternal candidate/confirmed、「採用リサーチ」はexternal_research confirmedだけを見せる
│       └── SXのworkspace由来signalは根拠詳細から同じproject_managementレコードへ戻る
│
└── col3: ステータス補助パネル (凍結中 / 再開予定などがある時だけ、lg 以上で sticky top-12)
    └── ステータスバッジ

下段: grid lg:grid-cols-2 gap-3
├── [G]  CockpitMonthlyList                       月次カード一覧
└── 縦 stack
    ├── [G0]  CockpitFreezeBackfill ⭐          休止期間サマリ (再開予定月以降のみ表示)
    └── [E]   CockpitMeetingSummary             MTG サマリ

※ 旧最下段の `CockpitKanbanGas` と、旧 `proactive_outbox` 由来の `ProactiveQueuePanel` は主要導線から外す。MS内の細かな作業はMS詳細、先手TODOの棚卸しは `/proactive` で扱い、通常PJコックピットには混ぜない。
```

### 会社概要タブのキラー要素カタログ（2026-08-09）

`CockpitCompanyOverview` の基本情報直下に `CockpitKillerFactorCatalog` を常設する。型・事象・確認根拠は全PJ共通マスタ、状態はPJ別。共通要素は `prevention`（予防統制）と `monitoring`（常時監視）に分け、filterで片方を隠さず二群を同時表示する。予防統制はAMDの具体的な打ち手と完了時機を必須とし、`unchecked / not_started / in_progress / implemented / controlled` で `未整備 → 整備中 → 実装済 → 運用確認済` の成熟度を記録し、`breached`（統制逸脱）は成熟度と別の重大状態とする。常時監視は `unchecked / clear / watch / warning / occurred` で `兆候なし → 要観察 → 明確な悪化 → 重大事象` の悪化度を記録する。`summarizeKillerFactorRisk()` は重大 (`occurred / breached`) > 要対応 (`warning / not_started / in_progress`) > 未確認 (`unchecked`) > 要観察 (`watch / implemented`) > 安全 (`clear / controlled`) の順で全体判定を導出し、未確認を安全へ数えない。

desktopは先頭に全体判定と5区分件数、その下に予防統制・常時監視の群見出し、型 / リスク / AMDの打ち手または見るもの / PJ状態を同じ列へ揃える。初版7件を `1440×900` で同一画面に表示し、反復行は44〜64px、行操作はコンパクトな状態ボタンとする。各行へ同じ大型ボタンを置かない。mobileは型・状態を先頭、リスク・打ち手を短い縦積みにし、横スクロールへ逃がさない。詳細入力は44px以上の操作領域を持つダイアログへ分離する。根拠メモは記録・文書に基づく内容を必須とし、記録者はログイン中メンバーをサーバーで付与する。通知・成功確率再計算・LLM呼び出しはここでは行わない。全PWA共通の密度規約は `/spec/2-7-ui-design-code-current-spec` を正本とする。

★ 2026-05-11 追加:
- **凍結/再開履歴**: `project_freeze_periods` が正本。`projects.freeze_from_ym` / `restart_expected_ym` は現在状態の表示用キャッシュ。CTB のように「202412で一度終了 → 再開 → 202605で再凍結」のような複数期間は `project_freeze_periods` に複数行で保存する。
- **CockpitFreezeBackfill**: `freeze_period_backfills` テーブルから `(project_id, freeze_from_ym, restart_ym)` を fetch、再開月以降に「📦 休止期間サマリ」パネルを MTGサマリの直上に表示。データソースは `cron/freeze-period-backfill` が休止期間中の monthly_reports + project_meeting_summaries を Sonnet で 400-700 字に統合
- **PM月次ルーティン廃止**: `canEditRoutine` / `CockpitRoutineGas` は current cockpit から外す。月次確認は `CockpitMonthlyList` / `CockpitMonthlyModal`、請求運用は `/admin/invoices` / `/admin/payouts` 側で扱う。
- **旧 nudge カード廃止**: 通常PJ cockpit から `CockpitNudge` は削除済み。`tsukuyomi_nudge_queue` 由来のカードは、この画面には表示しない。
- **タブタイトル動的化**: `/project/[projectId]/layout.tsx` の generateMetadata が `projects.project_name` → `project_ventures.display_name` 順で fallback して `<PJ名> - AMD OS` を返す
- **MTG添付資料トレイ**: `CockpitMeetingDetailModal` 内の `MeetingAssetsPanel` で、選択 / drag & drop / clipboard paste / browser screen capture の4経路から一般ファイルを `meeting_assets` に保存する。新規アップロード実体は Drive の `PJフォルダ / YYMMDD_会議名` に置き、カード上に保存先を表示する。`本文へ` は添付一覧を `narrative_md` の Markdown block に挿入し、Meet/Gmail 自動議事録に落ちない画面共有情報を後から補完できるようにする。
- **MTG本文の読み分け**: 開催済み `narrative_md` は背景・経緯を段落、決まったこと・次の一手・残課題を1項目1論点の箇条書きにする。前半で流れを復元し、後半は会議後の確認と実行に使える走査性を優先する。
- **MTG PDFの添付連結**: `PDF保存` は議事録本文の後ろに `meeting_assets` の PDF / PNG / JPEG を `sort_order` 順で実ページとして連結する。会議で使った投影資料を先、参加者から共有された資料を後に並べる。

### 今期MSの表示対象

`CockpitGoalsCompact` のトップ表示は、原則として `currentYm` が `periodStartYm`〜`periodEndYm` に含まれる plan cycle を使う。

ただしMS進捗を扱うのは `projects.project_category in ('dtsu','ecosystem','new_business')` のPJだけ。advisorなど非MS管理PJではMSカード・過去MS・MS設定バナーを表示せず、月次モーダルの月次ノートに毎月の進捗を記録する。

例外として、現在月を含む cycle が存在せず、次に始まる future cycle が登録済みの場合は、その future cycle をトップ表示に使う。  
これにより、5月時点で6-9月の次期MSを先行入力したCXのようなケースでも、コックピット上で設定済みMSを確認できる。

### MSの論点追跡UI

`CockpitGoalsCompact` の各MS行は、クリックで展開し、MSを長期テーマのホーム画面として扱う。

- **ゴール**: `value_milestones.success_criteria`、MS個別期間 (`period_start_ym` / `target_ym`)、pt、担当shareを表示する。
- **設計額**: 各MS行のメタ情報に MS 単位の設計額を常時表示する。バー上のメンバー chip には担当者ごとの担当設計額も併記し、展開前の一覧でMS全体とメンバー別の金額感を見られるようにする。展開欄では単価と本契約/別財布の区分も確認できる。
- **TODO**: `milestone_sub_items` のopen/done状態と、`milestone_responsibility.task_description` を並べる。サブアイテムは展開欄からdone/openを切り替えられる。
- **現状**: `milestone_monthly_progress` の最新 `progress_pct` / `note`、`member_ms_activities` の narrative、`member_activities` の直近材料を表示する。

これにより、長期テーマを別コンテンツとして増やさず、MSそのものを「ゴール / やること / 現状 / 根拠履歴」の追跡単位にする。MTGサマリや経営ハイライトはMSの外側に残し、MS展開欄ではそれらから抽出済みの進捗材料だけを短く見る。

### 経営ハイライト

今期MSリスト直下に `CockpitStrategySignals` を表示する。

- 正本L2: `project_strategy_signals`
- 詳細仕様: [`project_strategy_signals.md`](project_strategy_signals.md)
- 目的: MS進捗だけでは拾えない、経営上の重要方針・事業進捗・戦略転換・提携・リスク・次の一手を短く残す
- 表示対象: `status in ('candidate','confirmed')` を **時間軸 (signal_date desc) で混ぜて表示**、各カードの左ボーダー色で **4 分類** を識別 (まさ #14 2026-05-24 確定。#12 の 3 分類は破棄):
  - **🏛 経営全般** = `management_decision` / `strategic_pivot` / `funding` / `next_move` (violet)
  - **🚀 事業開発** = `business_progress` / `commercial_progress` / `partnership` (emerald)
  - **🔬 技術開発** = `ip_regulatory` (= 自社特許・規制対応 = 技術側) (sky)
  - **🌐 外部環境** = `risk` その他 — cockpit には表示せず、header の「外部環境変化は Atlas →」リンクで Atlas へ誘導 (amber)
  - セクション分けは廃止。時間軸で混ぜて表示し、左ボーダー色だけで分類を一目判別する
- candidate は候補chipを付け、`/notifications` の「はい/いいえ」で confirmed/rejected にする
- 各シグナルカード右に「⚠️ つくよみに修正依頼」ボタン (まさ #11 2026-05-24)。`/api/notifications/feedback` (`l2_kind='project_strategy_signal'`) 経由で feedback を保存 + `tsukuyomi_learnings` に学習させる
- `signal_date` は **事象が起きた日** を使う (まさ #13 2026-05-24)。観測日 (= 議事録に出てきた日) ではなく、「4/27 にリアクター特許出願完了」のような事象発生日が正
- source refs は短い snippet / source id / hash のみ。全文は保存しない

### MS設計と報酬配分

MSは報酬配分の最小単位でもある。`milestone_responsibility.share` はMS設計時点の予定担当比率で、月次報酬でもこの予定担当比率だけを使う。活動ログ由来の実績配分やPM/admin overrideは報酬計算に入れない。

- 1つの成果物が複数人共同で進む場合: 1MS + shareで表現する。
- 事業計画 / 資本政策 / 知財戦略のように、進捗が別々に確定する場合: 成果物ごとに別MSへ分ける。
- SX旧MS#1はこのルールにより、`事業計画策定`、`資本政策策定`、`知財戦略策定` のように成果物単位へ分割済み。担当割合は各 `milestone_responsibility` に保存し、個人名を仕様例として固定しない。
- OkuDoor追加開発など通常固定費と別枠の受託分は、MS `tag='cap_extra'` で別財布に分ける。
- 年間MS設定では、各MSに `period_start_ym` / `target_ym` を持たせる。UI上は `MS開始` / `MS終了` として表示し、月次モーダル・HUDの期間表示もこのDB値を優先する。
- コックピットのMS行に出す `設計額` は `/admin/ms-overview` と同じ read-only の設計額目安。通常MSは `value_plan_cycles.budget_yen` をシーズン月数×10ptで按分し、`cap_extra` は同期間の `billing_cycles.extra_budget_yen` 合計を cap_extra の有効pt合計で按分する。実支払額は reward cache / season-pl / payouts 側だけが正本。
- **MS変更履歴**: `CockpitMsChangeHistory` を今期MSの直下、`今シーズン収支` の手前に折りたたみ表示する。正本は `/admin/ms-overview` の保存時に追加される `milestone_change_events`。表示は確認専用で、変更日時、記録者、追加/無効化/更新されたMS、担当share変更、保存前支払検算の状態、本人別差額サマリを出す。契約本文、メール全文、議事録全文、raw source は保存・表示しない。cockpit 側にはMS設計の保存口を置かない。
- このUIは過去に消えた回帰が複数回あるため、PWAで年間MS設定を触るときは `npm run test:next-period-ui` を必ず通す。

---

## CockpitVentureStatus の中身

```
┌────────────────────────────────────────────────────────────┐
│ Header (全要素クリックで CockpitVentureMetaEditModal)      │
│  - emoji (outcome) / PJ 名 / lane chip / outcome chip      │
│  - 設立日 / origin_org / origin_pi                         │
│  - [📜 沿革] [👥 メンバー] [🧑‍🤝‍🧑 関連メンバー] [🤝 事業会社] [📊 試算表] │
│  - AMD score chip (クリックで CockpitAmdScoreBreakdownModal)│
│                                                              │
│ short_description (クリックで CockpitDescriptionDetailModal)│
│                                                              │
│ Chart 1: AMD スコア折れ線                                   │
│  - 横軸 = データ実 min/max ± 6%                            │
│  - 縦軸 = -100 〜 +100                                      │
│  - イベントドット (kind 別色)、空白タップで新規イベント追加│
│  - ドットタップで CockpitVentureStatusEditModal             │
│                                                              │
│ Chart 2: XRL 折れ線 (TRL/BRL/HRL)                          │
│  - 各ドットは axis ごと (TRL/BRL/HRL) に独立 onClick        │
│  - ドット直径 r=12 (proposal r=15) で大きく                │
│  - 確定ドット → CockpitXrlDetailModal (axis 個別の詳細)    │
│  - LLM proposal ドット → 採用 / 却下 banner                │
│  - XRL 自動判定 schedule 停止中の文言あり (ボタン無し)    │
└────────────────────────────────────────────────────────────┘
```

`project_ventures` 行が無い PJ では何も表示しない (= 通常の cockpit のまま)。

---

## モーダル一覧

| Modal                            | 開き方                                    | 用途                                                                 |
|----------------------------------|------------------------------------------|----------------------------------------------------------------------|
| CockpitVentureMetaEditModal      | Header 各要素タップ                      | display_name / lane / founded_at / outcome / AMD 支援期間 / origin / 概要 |
| CockpitVentureStatusEditModal    | AMD スコアチャート空白 / ドットタップ    | イベント追加・編集 (自由文 + Gemini 構造化)                          |
| CockpitMembersModal              | 👥 メンバー                              | project_venture_members 編集 (member_kind: amd_internal / su_internal / support_org) |
| CockpitFoundingMembersModal      | 🧑‍🤝‍🧑 関連メンバー                         | project_founding_members 表示。**関連メンバー (HRL評価のベース)** として運用。対象は `category in ('amd','startup','university')` (= AMD伴走 / 該当SU 社員・創業候補 / 大学キーパーソン)。VC / 顧客 / 行政 / 産業パートナーは HRL根拠外として `status='invalid'` 化する。AMDメンバーは `members.code_name` で記録 (フルネーム / 姓のみ表記は重複として invalid)。つくよみ修正依頼UIから追加・修正・invalid化を依頼できる。HRL 簡易推定 (ルールベース 0-9、`amd`+`startup`+`university` で算出) を末尾表示。詳細は [`xrl_evidence.md`](xrl_evidence.md) / [`../manual/4-4-frl-related-members-score-spec.md`](../manual/4-4-frl-related-members-score-spec.md) |
| CockpitPartnersModal             | 🤝 事業会社                              | project_partners (collab / customer)                                 |
| Bzm22TimeLedger                  | スコア詳細「イベントと月次試算」         | BZM 2.2の一本の月軸にイベントとproject_pl_monthly縦横表を揃え、直接入力する |
| CockpitPlHearingModal            | イベントと月次試算内「つくよみと試算を作る」 | Sonnet が質問→回答→月次 PL 36ヶ月生成 → upsert                    |
| CockpitDescriptionDetailModal    | short_description タップ                 | long_description 編集 + 自由文追記 + Sonnet マージ                   |
| CockpitNarrativeModal            | 📜 沿革                                  | リスト形式 (年月+一行+詳細)、行 ✏ で修正依頼                          |
| CockpitNarrativeFeedbackModal    | 沿革モーダル内 ✏                         | フィードバック → 即時 Gemini 再生成 + Sonnet lesson 抽出             |
| CockpitXrlDetailModal            | XRL ドットタップ (axis 別)               | 軸個別の値・評価理由 (`source_note` の JSON) 表示 + Gemini 修正依頼  |
| CockpitAmdScoreBreakdownModal    | AMD score chip タップ                    | スコア計算式 + 各パラメータの内訳                                    |

---

## データモデル (Supabase)

```
projects (既存)
  └─ project_ventures   (project_id PK FK to projects.project_id)
       lane / founded_at / outcome_pattern / origin_org / origin_pi /
       amd_role / short_description / long_description /
       amd_support_started_at / amd_support_ended_at /
       narrative_text (JSON 配列文字列) / narrative_generated_at / narrative_invalidated_at
       └─ project_xrl_log
       └─ project_events           (kind: hire / funding / deal / tech_progress / governance / xrl_obs / amd_score_override / note)
       └─ project_venture_members  (member_kind: amd_internal / su_internal / support_org, amd_member_id FK)
       └─ project_partners         (partner_type: collab / customer)
       └─ project_pl_monthly       (UNIQUE(project_id, ym))
       └─ project_pl_hearings      (q_a jsonb + generated_pl)
       └─ narrative_feedbacks      (沿革修正依頼)
       └─ xrl_feedbacks            (XRL 修正依頼)

つくよみ学習・履歴
  - tsukuyomi_learnings_status (scope, target_project_id, lesson_text, source_feedback_id)
       admin/tsukuyomi で memory layer に統合表示
  - tsukuyomi_chat_logs (session_id, page_path, role, content, applied_actions)
       マスコットチャット履歴
```

migrations: `pwa/scripts/migrations/008_project_ventures.sql` 〜 `012_xrl_feedback_chat.sql`

---

## API ルート

### つくよみ系
| Path                                                        | 用途                                               |
|-------------------------------------------------------------|----------------------------------------------------|
| `/api/project-events/parse`                                 | event 自由文 → Gemini で kind 別 schema に構造化   |
| `/api/project-ventures/[id]/description-merge`              | Sonnet (system: つくよみ) が概要に追記をマージ。`web_search` tool 利用可 |
| `/api/project-ventures/[id]/narrative-regen`                | 沿革を 1 PJ だけ即時再生成 (cron と同じ lib)       |
| `/api/project-ventures/[id]/xrl-revise`                     | Gemini が axis 別 reason 込みで XRL を再評価       |
| `/api/project-ventures/[id]/pl-hearing/turn`                | Sonnet と試算表ヒアリング 1 ターン                 |
| `/api/tsukuyomi/chat`                                       | マスコット会話 + tool use (update_short_long_description / invalidate_narrative / record_xrl_feedback / web_search) |

### Cron
| Path | 現状 | 用途 |
|---|---|---|
| `/api/cron/venture-xrl-refresh` | schedule 停止中 (`vercel.disabled-crons.json`) | 手動検証時に全 SU 系 PJ で Gemini 判定 → llm_proposal 挿入 |
| `/api/cron/venture-narrative-refresh` | schedule 停止中 (`vercel.disabled-crons.json`) | 手動検証時に invalidated > generated の PJ で Gemini 沿革再生成 + Sonnet lesson 抽出 |

---

## つくよみマスコットチャット (右下クリック)

- 右下マスコットクリック → 吹き出し風の小ウィンドウ (右下から上に出る、マスコット本体は隠れない)
- 会話状態は **localStorage に保存** (`tsukuyomi_chat:v1:<projectId or no_project>`)
  - ブラウザを閉じても、別タップしても、再開時に履歴復元
  - 「新しい会話」ボタンで明示リセット (履歴は admin/tsukuyomi に残る)
- 各ターンで `/api/tsukuyomi/chat` に投げる:
  - URL から projectId 抽出 (cockpit / venture-map/su)
  - その PJ の全 context (venture/xrl/events/members/partners/PL/narrative) を Sonnet に渡す
  - Sonnet が tool 呼ぶ (修正適用) + assistant text を返す
  - 全会話 + applied actions を `tsukuyomi_chat_logs` に保存
  - 修正系発話は `narrative_feedbacks` にも複製 (admin で一覧できるように)

---

## AMD スコア (現状ダミー)

```
score(t) = {
  Before 0 (founded > today): 線形補間 (-100 [5年前] → 0 [設立日])
  After 0  (founded ≤ today): min(100, ((TRL+BRL+HRL)/27)*60 + Σ event_bonus(kind))
}

event_bonus: hire +3 / funding +8 / deal +5 / tech_progress +4 / governance +2 / その他 0
```

正本式は [`/Users/masa/projects/knowledge/before_zero_theory.md`](../../../../knowledge/before_zero_theory.md) で別セッション議論中。確定したら `lib/venture-status-data.ts:computeAmdScoreSeries` と `:computeAmdScoreBreakdown` を差し替える。

---

## 学習ループ (まさ → つくよみ → 全 PJ に反映)

1. **沿革モーダル**で項目右の ✏ → CockpitNarrativeFeedbackModal で修正内容 textarea
2. submit → `narrative_feedbacks` に open で保存 + 即時 `/api/.../narrative-regen` 叩く
3. lib `narrative-refresh.ts` `refreshNarrativeForProject()` が:
   a. open feedbacks + 学習ルール (general + per-PJ) を Gemini プロンプトに注入
   b. 沿革を再生成
   c. Claude Sonnet が feedback から lesson 抽出 (general / individual)
   d. `tsukuyomi_learnings_status` に保存 (scope='narrative', target_project_id NULL=全 PJ 共通)
   e. feedback を applied 化
4. 次回以降の沿革生成・つくよみ会話に general lesson が自動注入される
5. admin/tsukuyomi の `🧷 記憶` (memory) layer に `pj_status:narrative` source で表示

XRL も同パターン (`xrl_feedbacks` → `/api/.../xrl-revise` → 手動 `/venture-xrl-refresh` でも反映)。自動 schedule は停止中。

---

## 既存 UI を消したケース (反省)

- 2026-05-06 セッション後半で `CockpitHeader` に独断で `⚙️ config` リンク (→ /admin/projects) を追加。「PJ 台帳に飛ぶ」ためまさに却下された。コックピットから設定画面へ飛ぶ導線は置かない。CockpitHeader は **PJ名 + status + 現行契約条件の確認**に限定し、編集は `/admin/contracts` と `/admin/projects` で行う。
- **教訓**: 「過去にあったリンクの復活」を頼まれたとき、`git log -S` で履歴を確認せず推測で実装すると、まったく別のものを「復活」してしまう。今後は git history から確実に復元するか、まさに飛び先を確認してから追加する。

---

## 開発時の流れ

```
コード変更 → tsc --noEmit → next build → commit → push (branch + main) → Vercel deploy
                                                       ↓
                            DDL 変更があれば applyDDL.py で先に適用
```

詳細は [`SPEC_pwa.md`](SPEC_pwa.md) の「8. 運用コマンド」参照。

---

## Project Category

`projects.project_category` は status と別軸のPJ分類。契約状態ではなく、AMD OS上でどう扱うかを決める。

| value | 意味 | AMD Score | MS 進捗抽出 |
|---|---|---|---|
| `dtsu` | 学術発SU伴走PJ (通常) | 対象 | 対象 |
| `new_business` | レガシー企業DX + 研究シーズ取込で新規事業創出するPJ | 対象 | 対象 |
| `ecosystem` | 研究機関のSUエコシステム構築業務 | 対象外 | 対象 |
| `advisor` | まさが社外取締役/経営顧問として入るPJ | 対象 | 対象外 (月次ノート運用) |

- KUTE (`p25`) は `ecosystem`。工学院大学のSUエコシステム構築であり、特定SUのAMD Scoreは付けない。
- LST (`p07`) は `advisor`。AMDとしての契約が終了していても、まさ個人として関与が続くため、source/backfill系では対象に含める。
- ZMP (`p19`) は `new_business`。葛飾ロード (道路保守点検) の新規事業創出 (ドローン/水素/CBRE) 伴走。DTSU と同じく AMD Score / MS 進捗対象 (まさ判断 2026-05-25、後で見直す前提)。
- cockpit header と `/admin/projects` に分類を表示する。
- `amd-score-l2-refresh` は `ecosystem` をskipする。
- MS 進捗対象判定 (`progress-estimator.ts` `MS_PROGRESS_PROJECT_CATEGORIES` / `activities/infer` / `CockpitView` / `HudCockpitView`) は `('dtsu','ecosystem','new_business')`。

### KUTE (p25) 連携シーズ一覧 (2026-07-20)

`ecosystem` PJ である KUTE は特定SUのAMD Scoreを付けない代わりに、進捗タブに **連携シーズ一覧** セクションを持つ。`CockpitKuteAnnualRoadmap` の直後、タブ本体の前にフル幅で表示 (`CockpitView.tsx`、`activeTab === "progress" && project.projectId === "p25"` gate)。

- データソースは Seeds テーブル1本 (`org_name='工学院大学'`)。KUTE専用テーブルは作らない。
- p25 → 研究機関名のスコープ対応は `researchInstitutionSeedsOrgNameForProject()` (`pwa/src/lib/kute-seeds-scoring.ts`) が唯一の定義。他の研究機関PJへ拡張する場合もここに追記する。
- 表示コンポーネント: `CockpitKuteSeeds.tsx` (一覧で主要比較項目と3群の採点状態まで表示) → `KuteSeedDetailModal.tsx` (長文と8項目の採点内訳を表示する安全な読み取り専用詳細、`internal_notes`/`source_detail` 等の非公開項目は select すらしない `SeedPublicView` ホワイトリスト経由)。
- 研究者グルーピング (2026-07-21): DB の `seeds` は案件単位のまま変更しないが、比較テーブルの表示は同一機関かつ同じ研究者名のシーズを、研究者名1回のグループヘッダー行の下へまとめる。研究者名は NFKC 正規化・連続空白の単一化・前後空白除去を行う。`researcher_name` が null の行は互いに別グループとして扱い誤統合しない。列ソートはグループ内を並べ替えた上でグループ自体も代表値でソートし、グループを分断しない。ロジックは `groupSeedsByResearcher()` / `sortSeedGroups()` / `countDistinctResearchers()` (`pwa/src/lib/kute-seeds-scoring.ts`、特定研究者名のハードコード無し)。
- 事業化タイプ (primary 1 + secondary 複数) と 100点スコア内訳 (future 60 / current 30 / kute_support 10、全項目 nullable) の仕様詳細は [`seeds.md`](seeds.md) の「KUTE (p25) PJ cockpit 連携」セクション参照。
- テスト: `npm run test:kute-seeds-scope` (スコープ境界 / 非公開フィールド除外 / 未評価=null / 未完了群と総合点を数値化しないこと / 満点合計を検証)。

## 関連メンバー

`project_founding_members` はM-2 XRL根拠のうち、HRL評価のベースとなる **関連メンバー** 台帳。

### 表示対象

- `category='amd'`: AMD の伴走メンバー (`members.code_name` に一致した人物)
- `category='startup'`: 該当SU の社員 / 社員候補 / 創業候補
- `category='university'`: 起源PI / 共同創業者 / 技術リード / 共同研究中核として SU と一体で動く大学・研究機関人物

### 除外対象 (HRL根拠から外す = status='invalid')

- `vc`: VC / ファンド / 投資家
- `partner_company`: 産業パートナー / 顧客 / サプライヤー / 委託先
- `government`: 補助金 / 行政 / 支援機関
- `individual`: 個人 (フリーランス等で SU+AMD 外)

「協業」「窓口」「相談」「アドバイザのみ」は曖昧関与として除外。

### 表記ルール

- AMDメンバーは必ず `members.code_name` で記録 (`まさ` / `きよ` 等)。本名 / 姓のみ表記は重複扱いで invalid。
- SU社員は `affiliation=<SU名>` + `category='startup'`。AMD と SU の二重表記 (`JOYCLE / AMD`) は使わない。
- 同一人物の別表記は LLM 抽出時に集約。

### ステータス遷移

- LLM抽出は `status='tentative'` で保存。
- 通知で「はい」→ `active`、「いいえ」→ `invalid`。
- コックピットの関連メンバーモーダルでは、直接セル編集ではなく、つくよみに修正指示を出し提案プレビュー → OK確定で upsert/invalid。

詳細は [`xrl_evidence.md`](xrl_evidence.md) の「関連メンバーの扱い」セクション参照。

## Annual MS Gantt

年間MSの表示は `MilestoneGanttChart` を正本にする。旧リスト型表示を復活させない。

- month columns: plan cycleの `periodStartYm` 〜 `periodEndYm`
- each bar: MS別 `periodStartYm` 〜 `targetYm`
- bar chips: member codeName, share %, allocated pt (`ms.points * share`)
- row meta: pt / tag / sub item count / progress に加えて、MS単位の `設計額`
- member chips: codeName / share / 担当pt / 担当設計額
- expanded row: responsibility detail + sub items

## Reward Cap / Stock

月次モーダルのメンバー報酬は、PJ予算を絶対に超えない。

- 今月の本契約で払ってよい額 = 契約金額から出す通常cap (= monthly fixed fee 65% - buffer)。契約で解決できないPJだけ `billing_cycles.budget_yen` を fallback に使う。
- 月額固定PJの追加受託分は通常capに混ぜない。例: ZMP は通常 300,000 円 × 65% = 195,000 円を本契約capとし、OkuDoor追加開発分は `tag='cap_extra'` の別財布支払として分けて表示する。
- gross due = 今月発生報酬 + 前月までのmember別stock
- gross dueがcapを超える場合、支払額をcap内に比例配分し、未払い分を `stockYen` として翌月へ繰越
- UIは `要支払 / 支払 / 繰越入 / 現ストック / キャップ発動 / 別財布` を表示する

---

## p00 専用 MVV 表示セクション ⭐ NEW (2026-05-23、戦略再構築セッション)

`/project/p00/cockpit`（AMD 全社）**だけ**に表示される、AMD 全社の Mission / Impact Principles / 長期目標 / 戦略構造 / FY26 OKR を上から並べる縦構成セクション。

### 背景

2026-05-23 の戦略再構築セッションで、AMD の長期目標を「SU 創出数中心」→「研究機関提携 + AMD OS 普及 + 学術体系化」中心へ転換。それに伴い、AMD 全社のミッション・戦略構造を**コックピット上で常時可視化**しておく必要が出てきた。

まさの言葉:
> てかさ、そういう長期的目標、MVV とかをちゃんとコックピットにも書いておかないとだよね。

### 表示する情報（縦並び、上から）

1. **Mission**
   - 「眠る知財をビジネスに変え、日本をディープテックの渦にする」
   - 英文: "Spin IP into ventures, supercharge economy, reward scientists, amplify science"

2. **Impact Principles（4 要素の循環構造）**
   - 図で表現: `[1] 知財事業化 → [2] 外貨獲得 → [3] 研究者還元 → [4] 研究者数増加 →（新しい知財）→ [1]`
   - 各要素のラベルとループの矢印を SVG / Flexbox で

3. **コア能力（3 つ）× 差別化資産（2 つ）**
   - コア能力: ビジョン注入力 / 俯瞰的技術戦略 / 大学連携ネットワーク
   - 差別化資産: AMDプロトコル / AMDスコア

4. **3 レイヤー戦略構造**
   - 🏗 仕組み（AMD OS 普及 / Y→X 遷移装置）
   - 🎓 学術（Before Zero Model 体系化）
   - 💰 案件（研究機関セグメント / 事業会社セグメント）
   - 各レイヤーは折りたたみ可、クリックで詳細展開

5. **AMD OS ロードマップ**
   - タイムライン形式
   - 2026 内部運用 + 教科書 STEP 1 着手 → 2027 NIMS 試験導入 → 2027-28 連携機関展開（並走）→ 2030+ 全国共通基盤

6. **2035 長期目標（主要メトリック）**
   - AMD OS 導入機関数: 60+
   - 連携研究機関 業務提携数: 60+
   - 論文累積（査読付）: 30（うちジャーナル掲載 10）
   - 学会発表累積: 40
   - ファンド運用額: 30 億円+
   - DTSU 創出数: 60+/年（副次指標）
   - 各メトリックは現在値（自動集計）と目標値を並べて進捗バー表示

7. **AMD ファンド（ゼブラ思想）**
   - 3 レイヤー外の収益源として独立カード
   - 思想（LP 厳選 / 余剰資金運用 / ブランディング保護）
   - FY28 組成 10 億円規模

8. **FY26 OKR（KR1 〜 KR6）**
   - KR1 事業規模 / KR2 収益性 / KR3 組織基盤 / KR4 将来基盤 / KR5 プレゼンス / KR6 学術化
   - 各 KR の現在達成率（手動入力 or 自動推定）と目標を並べて表示
   - クリックで該当 MS にジャンプ

9. **今期 MS リスト**
   - 既存の `CockpitGoalsCompact` がそのまま使える
   - `value_plan_cycles.plan_cycle_id='PC-p00-202606-202612'` の 14 MS を表示

### データソース

| 項目 | ソース |
|---|---|
| Mission / Impact Principles / コア能力 / 差別化資産 / 3 レイヤー | 静的（component 内 or `knowledge/company_profile.md` を build 時に取り込み） |
| AMD OS ロードマップ | 静的（`knowledge/amd_os_vision.md`）|
| 2035 長期目標（目標値）| 静的（`knowledge/company_profile.md` + `knowledge/midterm_plan.md`）|
| 2035 長期目標（現在値）| 動的: `partner_institutions.md` 集計 / `value_milestones` 集計 / `protocols` 集計 / 論文 DB（要設計）|
| AMD ファンド | 静的（`knowledge/midterm_plan.md` §3）|
| FY26 OKR（目標）| 静的（`knowledge/company_profile.md`）|
| FY26 OKR（達成率）| 手動入力 or 自動推定（要設計、H2 開始時点では手動入力で OK） |
| 今期 MS | `value_milestones` テーブル `plan_cycle_id='PC-p00-202606-202612'` |

### UI 構成（既存ページ構成への差分）

```
/project/p00/cockpit (CockpitView)
├── [A]   CockpitHeader               PJ 名 = "AMD" / status chip
├── [V]   CockpitP00MVVSection    ⭐ NEW (p00 のみ表示)
│   ├── 1. Mission ブロック
│   ├── 2. Impact Principles 循環構造図
│   ├── 3. コア能力 × 差別化資産
│   ├── 4. 3 レイヤー戦略構造（折りたたみ可）
│   ├── 5. AMD OS ロードマップ タイムライン
│   ├── 6. 2035 長期目標 進捗バー
│   ├── 7. AMD ファンド（ゼブラ思想）カード
│   └── 8. FY26 OKR KR1-KR6 進捗バー
├── [B]   CockpitGoalsCompact         今期 MS リスト（14 個）
├── [B1]  CockpitStrategySignals      経営ハイライト
├── [B2]  CockpitNextPeriodSetup
├── [B3]  過去の期間
├── [C]   資料室 (`WorkspaceDocumentLauncher` / `WorkspaceDocumentRoom`)
├── [C1]  経営ハイライト / ガバナンス / 助成金
├── [G/E] CockpitMonthlyList + CockpitMeetingSummary
└── [Right] Status badges (必要な時だけ)
```

> ⚠️ `[A2] CockpitVentureStatus`（PJ Status セクション）は **p00 では非表示**。AMD 全社は `project_ventures` 行を持たないため。代わりに CockpitP00MVVSection が同じ位置に表示される。

### 表示条件

- `project_id === 'p00'` のときのみ `CockpitP00MVVSection` を表示
- 他の PJ（p06 / p20 / p21 等）には**出さない**
- 既存の `CockpitVentureStatus` は p00 では出さない

### 実装ファイル（新規）

- `pwa/src/components/cockpit/CockpitP00MVVSection.tsx`（NEW）
- `pwa/src/components/cockpit/CockpitView.tsx` で `projectId === 'p00'` 分岐

### 静的データの md 同期ルール

`knowledge/` 配下の v2 md と CockpitP00MVVSection の静的データは**必ず同期**させる。

- md 変更時はコードも更新する（v2 化のタイミングで作ったルール）
- 将来的には build 時に `knowledge/company_profile.md` 等を解析して動的化することも検討（FY27 以降の課題、現状は静的でも OK）
- 静的データを変更したら、`knowledge/company_profile.md` の Changelog にも追記

### 関連 md

- [`/Users/masa/projects/knowledge/company_profile.md`](../../../knowledge/company_profile.md) — Mission / Impact Principles / 3 レイヤー / FY26 OKR / 組織体制
- [`/Users/masa/projects/knowledge/amd_value_model.md`](../../../knowledge/amd_value_model.md) — 3 軸構造 / コア能力 + 差別化資産
- [`/Users/masa/projects/knowledge/midterm_plan.md`](../../../knowledge/midterm_plan.md) — FY26-FY35 数値計画 / ファンド設計（ゼブラ思想）
- [`/Users/masa/projects/knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) — AMD OS 中核戦略 / ロードマップ
- [`/Users/masa/projects/knowledge/partner_institutions.md`](../../../knowledge/partner_institutions.md) — 連携機関台帳

### Changelog

| 日付 | 変更 |
|---|---|
| 2026-05-23 | 初版。戦略再構築セッションで「コックピットにも MVV を書いておかないと」とまさ確定。CockpitP00MVVSection 仕様を新設 |
| 2026-07-20 | KUTE (p25) 連携シーズ一覧セクションを追加。`CockpitKuteSeeds.tsx` / `KuteSeedDetailModal.tsx` / `kute-seeds-scoring.ts`。詳細は [`seeds.md`](seeds.md) 参照 |
