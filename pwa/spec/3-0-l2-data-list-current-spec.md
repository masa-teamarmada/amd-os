# L2データリスト

> **この章は何か**: AMD OS の L2 データを M / W / D / H の cadence 体系で一覧化する正本リスト。詳細仕様へ入る前に、どの L2 がどの cadence で、どの実行基盤に置かれるべきかを確認する入口。
>
> **2026-06-16 注記**: Claude routines 停止前提の実行主体棚卸しと Codex 移植優先順位は [`5-8-l1-l3-codex-migration-current-spec`](5-8-l1-l3-codex-migration-current-spec) を優先する。この章の `Claude routine target` 記述は、移植前の target 設計を含む。

L2 は、メール・議事録・Slack・外部ニュース・freee・予実表などの素材を、AMD OS が経営判断やPJ運営に使える形へ整理したデータ。

`マシン` は、その L2 を実際に発火・生成する場所。`cron名` は、運用者が履歴や設定で探す名前。PWA cron だけでなく、Claude routine / Codex automation 名もここに含める。

## 基本方針

この章では、**理想形** ではなく **今ほんとうにどの writer が動く前提か** を書く。

- `D / M / W / H` は「いつ走るか」の分類。
- `今の writer` は「実際にそのデータを作る担当」。
- `定額内` は「Codex / Claude の定額枠 or non-LLM で完結するか」。
- `例外` は、まさが明示的に許容したものだけ書く。2026-07-08 以降、D-10 の定期 writer は Codex automation 側で合成するため、内部 Anthropic route 例外では扱わない。

原則は、L1-L3 抽出を **定額枠の Codex / Claude writer か non-LLM cron** に寄せること。  
ただし current truth はまだ混在しているので、`Claude routine target` とだけ書かれた古い説明より、**下の一覧の `今の writer` を優先** する。

| 系 | 意味 | 本来あるべき置き場所 | cadence |
|---|---|---|---|
| **D** | Daily | Codex automation / MMO側 Codex Desktop automation / PWA non-LLM cron / 既存PWA route | daily |
| **M** | Month-end | Codex automation / month-end runner / outbox applier | 月末 |
| **W** | Weekly | Codex automation / review artifact | weekly |
| **H** | Hourly | MMOマシン Codex Desktop automation / Windows Task Scheduler live launcher | hourly |

Claude routine と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run` を確認できるもの。実出力の完了証跡は `last run` または初回 one-off evidence で別途確認する。`SKILL.md` や repo 上の仕様があるだけでは登録済み扱いにしない。

## 層 (tier) 軸 — L1 / L2 / L3 (まさ確定 2026-06-15)

`D / M / W / H` は **cadence (いつ走るか)** の軸。これとは別に **tier (どこまで吟味されたデータか)** の軸がある。両者は直交する。

| tier | 定義 | 例 |
|---|---|---|
| **L1** | 生データ・外部APIの値を **吟味せずそのまま吸い出し/同期** したもの (LLM判断なし) | `source_cache`、**D-12 freee取引実績** |
| **L2** | LLM が文脈を吟味して **「欲しい情報の形」に抽出/再構成** した中核データ | 大半の D / M / W |
| **L3** | L2 群の **カバレッジ自体を見張るメタレイヤー** (= 来た生データ × 既存L2 の差分 = 不在検知)。自分が何を拾うかではなく、他のL2が何を拾えていないかを監視する | **Coverage Scanner** (`l2_coverage_gaps`) |

加えて、L1/L2 のどちらでもない **非LLM派生/計算** がある (= L2 の値や observation を **機械計算** で導出。吸い出しでもLLM吟味でもない直交軸)。

### 各データの tier / writer タグ

| データ | tier | writer | 根拠 |
|---|---|---|---|
| D-1/D-3/D-4/D-5/D-6/D-7/D-8/D-10/D-11/D-13/D-14, M-1/M-2/M-3, W-1 | **L2** | LLM | 主に Codex automation と MMO 側 Codex が抽出する。D-10 は PWA route が evidence を集め、Codex automation が合成して POST 保存する。D-13/D-14 など一部は既存PWA APIを入口に使う。 |
| **D-2 MS Progress** | L2 + 非LLM派生 | 混在 | 乖離 revision 提案=LLM(L2)、デフォルト進捗%按分=`ms-schedule-progress` **非LLM**(派生) |
| **D-9 Macrotrend** | L2 + 非LLM派生 | 混在 | observation 収集=LLM/web_search 一部(L2)、`macro_index_log` 集計=`macro-aggregate-indicators` **非LLM**(派生) |
| **D-12 Finance/freee** | **L1相当** | **非LLM** | `freee-payment-sync` / `management-score-raw-data` は LLM を一切呼ばず、取引履歴をそのまま実績へ同期 (吟味なし) |
| **Coverage Scanner** (`coverage_gap`) | **L3** | LLM | 個別抽出器の上位安全網。不在検知。設計 `design/coverage_gap_scanner.md` |
| `source_cache` | **L1** | 非LLM | L2抽出のための素材キャッシュ。中核L2正本ではない |

> **なぜ tier を分けるか**: cadence 番号 (D-n) だけだと、freee 同期 (L1相当) と LLMプロトコル抽出 (L2) が同じ "D" の下に同居して見分けがつかない。tier 軸を明示すると「これは吟味済みデータか、ただの同期か、カバレッジ監視か」が一目で分かり、L3 (Coverage Scanner) を「ただの新L2」と誤って扱って同じ取りこぼしを再生産する事故を防げる。なお `l2_coverage_gaps` / `l2_kind='coverage_gap'` の命名は箱の互換性のためで、概念は L3。

## まずこの表だけ見ればOK

| ID | 何のデータか | 今の writer | 定額内 | 状態 | 次の動き |
|---|---|---|---|---|---|
| **M-1** | PJごとの月次報告書 | Codex automation **`AMD OS M-1 月次報告抽出`** (`amd-os-l2`) + outbox/applier | はい | `ACTIVE` | そのまま運転 |
| **D-1** | 経営判断の型 | MMO側 Codex Desktop automation `amd-os-l2-protocol-extract` | はい | repo上は暫定扱い | MMO側 current truth を維持 |
| **D-2** | MS進捗の revision 提案 | MMO側 Codex Desktop automation `amd-os-l3-ms-progress-extract` + non-LLM按分 | はい | 稼働系あり | 現状維持 |
| **D-3** | PJの人物・技術・市場の知識 | MMO側 Codex Desktop automation `amd-os-l4-project-knowledge-extract` | はい | repo上は暫定扱い | MMO側 current truth を維持 |
| **D-4** | メンバーの強み・働き方の知識 | MMO側 Codex Desktop automation `amd-os-l5-member-knowledge-extract` | はい | repo上は暫定扱い | MMO側 current truth を維持 |
| **H-1** | 会議サマリと会議フロー | Codex automation **`AMD OS H-1 MTGフロー`** (`amd-os-l6-meeting-flow`) / MMO launcher | はい | `ACTIVE` | そのまま運転 |
| **D-5** | OS台帳へ反映すべき差分候補 | まだ専用writerなし。`amd-os-ms` 系へ束ねる前提 | はい | 未再始動 | second wave で実装/再開 |
| **M-2** | XRL / AMD Score の根拠 | まだ専用writerなし。`amd-os-ms` 系へ束ねる前提 | はい | 未再始動 | second wave で実装/再開 |
| **D-6** | 経営ハイライト | Codex automation **`AMD OS D-6 経営ハイライト抽出`** (`amd-os`) + outbox/applier | はい | `ACTIVE` | そのまま運転 |
| **D-7** | 教科書に残す実務知見 | local worker / `amd-os-l10-textbook-insight-extract` / 承認後 applier | はい | 手動寄り | 後段で定期化 |
| **D-8** | Atlas外部シグナル | Codex automation **`AMD OS D-8 Atlas外部シグナル抽出`** (`amd-atlas-2`) + outbox/applier | はい | `ACTIVE` | そのまま運転 |
| **D-9** | Macrotrend の観測と index | observation は未整理、index は PWA non-LLM cron | 混在 | 一部のみ稼働 | observation 側を整理 |
| **D-10** | メンバー活動根拠 | Codex automation **`AMD OS D-10 メンバー活動根拠抽出 (Mac)`** (`amd-os-l2-2`)。PWA route は `mode=evidence` で証拠を返し、Codex が合成した `activities[]` を POST 保存する | はい | `ACTIVE` | そのまま運転。旧MMO launcherの route 一発実行は保存しない |
| **D-11** | メディア掲載根拠 | まだ writer なし | はい | 未実装 | runner 設計が必要 |
| **D-12** | freee実績の同期 | PWA non-LLM cron | はい | 稼働中 | 現状維持 |
| **D-13** | 契約予兆 | PWA route はあるが collector runner がない | はい | 未実装 | Codex collector を作る |
| **D-14** | 要対応 (Action Items) + Governance Email Sweep | PWA route `POST /api/action-items/extract` + D-14G route `GET /api/cron/governance-email-sweep`。前段 collector は段階実装中 | はい | 部分実装 | `/admin/projects` の総会/役会ON PJから運転開始 |
| **L3-1** | 取りこぼし検知 | PWA route はあるが collector runner がない | はい | 未実装 | Codex collector を作る |
| **W-1** | VCニュース・資金調達シグナル | Codex automation **`AMD OS W-1 VCニュース・資金調達シグナル抽出`** (`amd-os-l2-vc-news-funding-signals`) | はい | `ACTIVE` | そのまま運転 |
| **M-3** | 月末の会社評価文 | まだ writer なし | はい | 未実装 | month-end runner を作る |

## 詳しい一覧

| ID | 層 | 名前 | 何を残すか | 主な使い道 | 今の writer / 置き場所 | 探す名前 |
|---|---|---|---|---|---|---|
| **M-1** | L2 | Monthly Reports | PJごとの月次報告書 | 月次振り返り、次月方針、XRL監査の土台 | Codex automation + `amd-os-ms` outbox/applier | `AMD OS M-1 月次報告抽出` / `amd-os-l2` |
| **D-1** | L2 | AMD Protocol | 経営判断の型、判断材料、打ち手 | AMDの知財化、次の意思決定の参照 | MMO側 Codex Desktop automation | `amd-os-l2-protocol-extract` |
| **D-2** | L2 (+非LLM派生) | MS Progress | マイルストーンの進捗率・月次ノート | PJ cockpit、報酬・進捗レビュー | MMO側 Codex Desktop automation + non-LLM default writer | `amd-os-l3-ms-progress-extract` / `ms-schedule-progress` |
| **D-3** | L2 | Project Knowledge | PJに関する人物・技術・組織・市場の事実 | PJ理解、引き継ぎ、提案準備 | MMO側 Codex Desktop automation | `amd-os-l4-project-knowledge-extract` |
| **D-4** | L2 | Member Knowledge | メンバーの強み、関心、働き方、活動傾向 | 配置、評価、mypage、メンバー理解 | MMO側 Codex Desktop automation | `amd-os-l5-member-knowledge-extract` |
| **H-1** | L2 | Meeting Flow | 会議ごとの決定事項・進捗・次アクション・リスク、予定MTGカード、関連資料 | Cockpit、次MTG準備、タスク化 | Codex automation active / MMO launcher | `AMD OS H-1 MTGフロー` / `amd-os-l6-meeting-flow` |
| **D-5** | L2 | Registry Diff | PJメンバー、関係先、契約、担当、期間などのOS反映候補 | 台帳の自己修復、設定漏れ検知 | `amd-os-ms` 系へ束ねる前提。今は専用writer未再始動 | `amd-os-l7-registry-diff-extract` |
| **M-2** | L2 | XRL Evidence | TRL / BRL / GRL / SRL / HRL のチェック項目充足根拠 | AMD ScoreのXRL更新 | `amd-os-ms` 系へ束ねる前提。今は専用writer未再始動 | `amd-os-l8-xrl-evidence-extract` |
| **D-6** | L2 | Strategy Signals | 重要な方針転換、事業進捗、提携、リスク、次の一手 | PJ cockpit、司令塔判断 | Codex automation + outbox/applier | `AMD OS D-6 経営ハイライト抽出` / `amd-os` |
| **D-7** | L2 | Textbook Insights | Before Zero / BZM教科書へ追記すべき実務知見 | 教科書・論文化・知財化 | local worker / review / 承認後 applier | `amd-os-l10-textbook-insight-extract` |
| **D-8** | L2 | Atlas Signals | 外部ニュース・政策・市場・技術シグナル | Atlas、戦略判断、macro解釈 | Codex automation + outbox/applier | `AMD OS D-8 Atlas外部シグナル抽出` / `amd-atlas-2` |
| **D-9** | L2 (+非LLM派生) | Macrotrend Evidence / Index | 研究費、公募、VC投資、政策言及、外部signal countの集計 | AMD Score、Venture Map、ASPI判断 | observation は再整理中、index は PWA non-LLM cron | `macro-aggregate-indicators` |
| **D-10** | L2 | Member Activity Evidence | メンバーごとの活動根拠 | mypage、reward、MS貢献レビュー、member knowledge入力 | Mac Codex automation。PWA route は evidence 収集と POST 保存を担当し、合成本文は Codex 側で作る | `AMD OS D-10 メンバー活動根拠抽出 (Mac)` / `amd-os-l2-2` |
| **D-11** | L2 | Media Mentions | メディア掲載・公開露出の根拠 | 広報、外部シグナル、通知候補 | まだ writer なし | `amd-os-l2-consolidated-evidence` (旧target名) |
| **D-12** | **L1相当** | Finance Ops Evidence / freee Transaction Actuals | サブスク、継続費、自動振替、領収書イベント、freee取引履歴から月次試算表へ入れる実績値 | 月次PL、Management Score finance軸 | PWA non-LLM cron + admin review | `/api/cron/management-score-raw-data?includeFreee=1` / `cron/freee-payment-sync` |
| **D-13** | L2 | Contract Signals | 5生データから検知した契約締結予兆、契約予定枠、契約書version/signed版metadata | 契約管理、押印版未保存nudge候補、PJ別契約進行確認 | PWA route はある。collector はこれから Codex 化 | `POST /api/contracts/extract-l2` |
| **D-14** | L2 | 要対応 (Action Items) + Governance Email Sweep | 期日つき inbound 義務 (株主総会招集/議決権/事前承諾/契約更新/振込 等)。D-14G は `/admin/projects` の「総会」「役会」ON PJだけ `report_emails` × keyword で Gmail を検索し、総会/取締役会履歴候補を作る | /notifications・要対応面・nudge・PJ cockpit 株主/ガバナンス | PWA route + D-14G sweep route。collector はON PJから段階運用 | `POST /api/action-items/extract` / `GET /api/cron/governance-email-sweep` / `POST /api/governance/extract` |
| **L3-1** | **L3** | Coverage Scanner (不在検知) | 来た生データ × 既存L2カバレッジ の差分 = OS化されてない重要情報の候補。個別抽出器の上位安全網 | /notifications・/admin/coverage-gaps・取りこぼし防止 | PWA route はある。collector はこれから Codex 化 | `POST /api/coverage-gaps/extract` |
| **W-1** | L2 | VC News / Funding Signals | VCニュース、ファンド組成、投資活動、資金調達シグナル | VC inbox、fund情報、fundraising判断 | Codex automation | `AMD OS W-1 VCニュース・資金調達シグナル抽出` / `amd-os-l2-vc-news-funding-signals` |
| **M-3** | L2 | Management Monthly Signal | 月末時点の会社経営状態を、良い/悪い/次に見ることへ翻訳した評価文 | `/management-score` の月次試算表下、経営判断、過去ログ | month-end 専用 writer は未実装 | `amd-os-l2-monthend-evidence` (旧target名) |

## Management Monthly Signal の評価文ルール

M-3 は、予実表の数字をもう一度読み上げる場所ではない。数字は上の予実表にあるので、ここでは次の形に変換する。

| 要素 | 内容 |
|---|---|
| 状態アイコン + ラベル | `good`, `watch`, `danger`, `neutral` の tone と、UI用の状態ラベル |
| 1行評価 | 「まあ悪くないけど、もう少し新規案件があると安心できる」のような経営判断の文章 |
| 判断理由 | 2〜3個。数字の再掲ではなく、何が効いているかを書く |
| 次に見るべきこと | 翌月に確認すべき1〜3項目 |

## source of truth

M-3 の source of truth table は `company_management_signal_reviews`。修正版 `/management-score` UI の方向を正とし、数字再掲ではなく状態ラベル/アイコン、自然文評価、判断コメントを保存する。

最小payload:

```ts
type ManagementMonthlySignalEvaluation = {
  ym: string;
  version: number;
  status_label: "概ね良好" | "注意して進める" | "要介入" | "評価候補/中立";
  status_tone: "good" | "watch" | "danger" | "neutral";
  status_icon: "good" | "watch" | "danger" | "neutral";
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string; items: string[]; tone: "good" | "watch" | "danger" | "neutral" }>;
  source_refs_json: unknown[];
  source_confidence: number;
  payload_json: {
    snapshot_id?: string;
    finance_ym?: string;
    variance_summary?: unknown;
    score_axis_summary?: unknown;
    evaluation_logic_version?: string;
    omitted_numbers_policy: "do_not_repeat_budget_table_numbers";
  };
  generated_at: string;
  reviewed_at?: string | null;
  codex_thread_id?: string | null;
  automation_id?: string | null;
  is_current: boolean;
  superseded_at?: string | null;
};
```

## 更新経路

- 毎月末日17:00 JSTに Claude routine `amd-os-l2-monthend-evidence` の Phase C として M-3 候補を走らせ、保存済み L2 として生成/更新する。
- 入力は `amd_management_score_snapshots`, `amd_management_score_evidence`, `company_budget_actual_monthly`, `company_budget_variance_notes`, D-6, D-12, W-1。
- 出力は reviewable payload。新versionを保存し、旧currentを過去ログへ閉じる。
- `/management-score` では最新評価だけを展開し、古い評価は月別トグルの過去ログとして閉じる。

## 関連仕様

- 詳細仕様: [`3-1-l2-data-extraction-current-spec`](3-1-l2-data-extraction-current-spec)
- Management Score: [`4-4-management-score-company-vital-scope-plan`](4-4-management-score-company-vital-scope-plan)
- Contract Signals: [`5-6-contracts-management-current-spec`](5-6-contracts-management-current-spec)
- design側の詳説: [`../design/L2_DATA.md`](../design/L2_DATA.md), [`../design/management_score.md`](../design/management_score.md)
