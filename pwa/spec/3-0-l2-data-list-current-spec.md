# L2データリスト

> **この章は何か**: AMD OS の L2 データを M / W / D / H の cadence 体系で一覧化する正本リスト。詳細仕様へ入る前に、どの L2 がどの cadence で、どの実行基盤に置かれるべきかを確認する入口。

L2 は、メール・議事録・Slack・外部ニュース・freee・予実表などの素材を、AMD OS が経営判断やPJ運営に使える形へ整理したデータ。

`マシン` は、その L2 を実際に発火・生成する場所。`cron名` は、運用者が履歴や設定で探す名前。PWA cron だけでなく、Claude routine / Codex automation 名もここに含める。

## 基本方針

L2 は cadence ごとに束ねる。D / M / W のうち LLM 抽出が必要なものは Claude routine に置く。LLM 不要の daily 同期は PWA non-LLM cron に置く。H 系は MMO マシンの Codex 実行系を正とする。

| 系 | 意味 | 本来あるべき置き場所 | cadence |
|---|---|---|---|
| **D** | Daily | Claude routine `amd-os-l2-consolidated-evidence` / PWA non-LLM cron | daily |
| **M** | Month-end | Claude routine `amd-os-l2-monthend-evidence` | 月末 |
| **W** | Weekly | Claude routine `amd-os-l2-weekly-vc-funding-signals` | weekly |
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
| D-1/D-3/D-4/D-5/D-6/D-7/D-8/D-10/D-11/D-13/D-14, M-1/M-2/M-3, W-1 | **L2** | LLM | Claude routine / route が LLM 抽出 |
| **D-2 MS Progress** | L2 + 非LLM派生 | 混在 | 乖離 revision 提案=LLM(L2)、デフォルト進捗%按分=`ms-schedule-progress` **非LLM**(派生) |
| **D-9 Macrotrend** | L2 + 非LLM派生 | 混在 | observation 収集=LLM/web_search 一部(L2)、`macro_index_log` 集計=`macro-aggregate-indicators` **非LLM**(派生) |
| **D-12 Finance/freee** | **L1相当** | **非LLM** | `freee-payment-sync` / `management-score-raw-data` は LLM を一切呼ばず、取引履歴をそのまま実績へ同期 (吟味なし) |
| **Coverage Scanner** (`coverage_gap`) | **L3** | LLM | 個別抽出器の上位安全網。不在検知。設計 `design/coverage_gap_scanner.md` |
| `source_cache` | **L1** | 非LLM | L2抽出のための素材キャッシュ。中核L2正本ではない |

> **なぜ tier を分けるか**: cadence 番号 (D-n) だけだと、freee 同期 (L1相当) と LLMプロトコル抽出 (L2) が同じ "D" の下に同居して見分けがつかない。tier 軸を明示すると「これは吟味済みデータか、ただの同期か、カバレッジ監視か」が一目で分かり、L3 (Coverage Scanner) を「ただの新L2」と誤って扱って同じ取りこぼしを再生産する事故を防げる。なお `l2_coverage_gaps` / `l2_kind='coverage_gap'` の命名は箱の互換性のためで、概念は L3。

## L2データ正本リスト

| L2 | 名前 | 何を残すか | 主な使い道 | マシン | cron名 | タイミング |
|---|---|---|---|---|---|---|
| **M-1** | Monthly Reports | PJごとの月次報告書 | 月次振り返り、次月方針、XRL監査の土台 | Claude routine target + Codex automation / local applier暫定 | `amd-os-l2-monthend-evidence` / `AMD OS monthly report extract` / `amd-os-l1-monthly-report-extract` | 月末最終日 |
| **D-1** | AMD Protocol | 経営判断の型、判断材料、打ち手 | AMDの知財化、次の意思決定の参照 | Claude routine target + MMO暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l2-protocol-extract` | daily 08:00 JST |
| **D-2** | MS Progress | マイルストーンの進捗率・月次ノート | PJ cockpit、報酬・進捗レビュー | Claude routine target + MMO暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l3-ms-progress-extract` | daily target / MMO暫定は毎時0分 |
| **D-3** | Project Knowledge | PJに関する人物・技術・組織・市場の事実 | PJ理解、引き継ぎ、提案準備 | Claude routine target + MMO暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l4-project-knowledge-extract` | daily 08:00 JST |
| **D-4** | Member Knowledge | メンバーの強み、関心、働き方、活動傾向 | 配置、評価、mypage、メンバー理解 | Claude routine target + MMO暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l5-member-knowledge-extract` | daily 08:00 JST |
| **H-1** | Meeting Flow | 会議ごとの決定事項・進捗・次アクション・リスク、予定MTGカード、関連資料 | Cockpit、次MTG準備、タスク化 | MMOマシン Codex実行系 | `amd-os-l6-meeting-flow` / Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` | 毎日09:00-21:00 毎時 |
| **D-5** | Registry Diff | PJメンバー、関係先、契約、担当、期間などのOS反映候補 | 台帳の自己修復、設定漏れ検知 | Claude routine target + Codex automation / local applier暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l7-registry-diff-extract` | daily 08:00 JST |
| **M-2** | XRL Evidence | TRL / BRL / GRL / SRL / HRL のチェック項目充足根拠 | AMD ScoreのXRL更新 | Claude routine target + Codex automation / review暫定 | `amd-os-l2-monthend-evidence` / `amd-os-l8-xrl-evidence-extract` | M-1後、月末 |
| **D-6** | Strategy Signals | 重要な方針転換、事業進捗、提携、リスク、次の一手 | PJ cockpit、司令塔判断 | Claude routine target + Codex automation / local applier暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l9-strategy-signal-extract` | daily 08:00 JST |
| **D-7** | Textbook Insights | Before Zero / BZM教科書へ追記すべき実務知見 | 教科書・論文化・知財化 | Claude routine target + local BZM applier暫定 | `amd-os-l2-consolidated-evidence` / `amd-os-l10-textbook-insight-extract` | daily 08:00 JST、承認後は手動applier |
| **D-8** | Atlas Signals | 外部ニュース・政策・市場・技術シグナル | Atlas、戦略判断、macro解釈 | Claude routine target + Atlas outbox/applier | `amd-os-l2-consolidated-evidence` / `POST /api/atlas/signals-ingest` | daily 08:00-08:10 JST |
| **D-9** | Macrotrend Evidence / Index | 研究費、公募、VC投資、政策言及、外部signal countの集計 | AMD Score、Venture Map、ASPI判断 | Claude routine target + PWA non-LLM cron | `amd-os-l2-consolidated-evidence` / `cron/macro-aggregate-indicators` | daily review + 月初04:00 JST |
| **D-10** | Member Activity Evidence | メンバーごとの活動根拠 | mypage、reward、MS貢献レビュー、member knowledge入力 | Claude routine target | `amd-os-l2-consolidated-evidence` | daily 08:00 JST |
| **D-11** | Media Mentions | メディア掲載・公開露出の根拠 | 広報、外部シグナル、通知候補 | Claude routine target | `amd-os-l2-consolidated-evidence` | daily 08:00 JST |
| **D-12** | Finance Ops Evidence / freee Transaction Actuals | サブスク、継続費、自動振替、領収書イベント、freee取引履歴から月次試算表へ入れる実績値 | 月次PL、Management Score finance軸 | PWA non-LLM cron + admin review | `/api/cron/management-score-raw-data?includeFreee=1` / `cron/freee-payment-sync` / `cron/payment-confirm-nudges` | daily |
| **W-1** | VC News / Funding Signals | VCニュース、ファンド組成、投資活動、資金調達シグナル | VC inbox、fund情報、fundraising判断 | Claude routine target | `amd-os-l2-weekly-vc-funding-signals` | 土曜09:00 JST |
| **M-3** | Management Monthly Signal | 月末時点の会社経営状態を、良い/悪い/次に見ることへ翻訳した評価文 | `/management-score` の月次試算表下、経営判断、過去ログ | Claude routine target + management review | `amd-os-l2-monthend-evidence` | 月末最終日17:00 JST |
| **D-13** | Contract Signals | 5生データから検知した契約締結予兆、契約予定枠、契約書version/signed版metadata | 契約管理、押印版未保存nudge候補、PJ別契約進行確認 | Claude routine daily consolidated + PWA route | `amd-os-l2-consolidated-evidence` Phase K-B / `POST /api/contracts/extract-l2` | daily 08:00 JST |

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
