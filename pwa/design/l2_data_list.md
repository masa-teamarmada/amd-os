# L2データリスト — AMD OSの中核データ正本

Status: current truth
Updated: 2026-06-03

このページは、AMD OS が「あとで経営判断・PJ運営・スコア計算に使うために、意味のある形へ整理して保存するデータ」の一覧。

開発に関わっていないメンバー向けには、L2 は「メールや議事録などの素材を、OSで使える業務データへ変換したもの」と考えると分かりやすい。

## L2データ16種（正本リスト）

| L2 | 名前 | 何を残すか | 主な使い道 | 通常の更新ルート |
|---|---|---|---|---|
| ① | Monthly Reports | PJごとの月次報告書 | 月次振り返り、次月方針、XRL監査の土台 | 月末のみ。Supabase内のL2断面から作成 |
| ② | AMD Protocol | 経営判断の型、判断材料、打ち手 | AMDの知財化、次の意思決定の参照 | daily consolidated evidence |
| ③ | MS進捗 | マイルストーンの進捗率・月次ノート | PJ cockpit、報酬・進捗レビュー | MMO Codex Desktop automation |
| ④ | PJナレッジ | PJに関する人物・技術・組織・市場の事実 | PJ理解、引き継ぎ、提案準備 | daily consolidated evidence |
| ⑤ | メンバーナレッジ | メンバーの強み、関心、働き方、活動傾向 | 配置、評価、mypage、メンバー理解 | daily consolidated evidence |
| ⑥ | MTGサマリ + MTGフロー | 会議ごとの決定事項・進捗・次アクション・リスク | Cockpit、次MTG準備、タスク化 | MMO Codex Desktop automation |
| ⑦ | OS台帳差分 | PJメンバー、関係先、契約、担当、期間などのOS反映候補 | 台帳の自己修復、設定漏れ検知 | daily consolidated evidence + outbox |
| ⑧ | XRLチェックリスト監査 | TRL / BRL / GRL / SRL / HRLのチェック項目充足 | AMD ScoreのXRL更新 | 月末L2①後。dailyでは回さない |
| ⑨ | 経営ハイライト | 重要な方針転換、事業進捗、提携、リスク、次の一手 | PJ cockpit、司令塔判断 | daily consolidated evidence |
| ⑩ | Textbook Insights | Before Zero / BZM教科書へ追記すべき実務知見 | 教科書・論文化・知財化 | daily consolidated evidence + 承認後local applier |
| ⑪ | Atlas Signals | 外部ニュース・政策・市場・技術シグナル | Atlas、戦略判断、macro解釈 | daily consolidated evidence / Atlas automation |
| ⑫ | Macrotrend Evidence / Index | 研究費、公募、VC投資、政策言及、外部signal countの集計 | AMD Score、Venture Map、ASPI判断 | 月次PWA non-LLM aggregate + daily evidence review |
| ⑬ | Member Weekly Activities | メンバーごとの週次活動 | mypage、reward、L2⑤、MS貢献レビュー | 別weekly automation候補 |
| ⑭ | Finance Ops Evidence | サブスク、継続費、自動振替、領収書イベント | 月次PL、Management Score finance軸 | PWA non-LLM finance cron + admin review |
| ⑮ | VC News / Funding Signals | VCニュース、ファンド組成、投資活動、資金調達シグナル | VC inbox、fund情報、fundraising判断 | weekly Codex automation |
| ⑯ | Management Monthly Signal Evaluation | 月末時点の会社経営状態を、良い/悪い/次に見ることへ翻訳した評価文 | `/management-score` の月次試算表下、経営判断、過去ログ | 毎月末17:00 Codex automation候補。修正版UIの形をL2保存schemaへ正本化 |

## provenance の見方

| 区分 | 対象 | 意味 |
|---|---|---|
| internal | L2①〜⑩ | Gmail / Drive / Calendar / Slack / Notion など社内の5生データとOS内データから作る |
| external | L2⑪ / L2⑫ / L2⑮ | Web、政策、公開ニュース、VC情報など外部観測から作る |
| internal hybrid | L2⑬ | メンバー別の活動ソースを週単位でまとめる |
| finance operations | L2⑭ | freee、支払い、領収書、手動確認をもとに会社財務オペを管理する |
| management judgment | L2⑯ | 数字やraw signalを、経営判断として読める月末評価に変換する |

## 現在の稼働状態

- daily consolidated evidence: L2②④⑤⑦⑨⑩⑪⑫をまとめて確認する。
- L2① monthly reports: 毎月末だけ作る。日々少しずつ月次報告書を更新する運用には戻さない。
- L2⑧ XRL: L2①月次報告書の後にチェックリスト監査として見る。daily evidence collectorではない。
- L2⑬ Member Weekly Activities: weekly候補。PWA/VercelのAnthropic cronには戻さない。
- L2⑭ Finance Ops Evidence: freee/paymentなどのnon-LLM cronとadmin reviewが主導線。
- L2⑮ VC News / Funding Signals: PWA `vc-discover` cronは停止維持。週次Codex automationで復活させる。
- L2⑯ Management Monthly Signal Evaluation: 毎月末17:00に生成/更新する設計候補。数字を再掲せず、「今の経営状態はどう見えるか」を状態ラベル/アイコン + 自然文評価 + 判断コメントへ変換する。修正版 `/management-score` UI の方向を正とし、`status_label` / `status_tone` / `status_icon` / `headline` / `summary` / `sections[]` / `source_refs_json` / `generated_at` / `reviewed_at` / `codex_thread_id` / `automation_id` をL2 schemaの中心にする。

## Macrotrend と AMD Score

AMD Score が使うmacrotrend情報のうち、`macro_index_log` の集計は PWA non-LLM cron `cron/macro-aggregate-indicators` が月初に更新する。これは `observation_log` と `atlas_signals` を集計するだけなので、LLM課金cronではない。

一方で、`relearn-lane-weights`、`macro-backfill-historical`、`amd-score-l2-refresh` はLLM利用や広範囲更新を含むため、active PWA/Vercel cronには戻さない。必要な場合はsubscription automationまたは手動reviewで扱う。

## 詳細への入口

- 詳細仕様: [`L2_DATA.md`](L2_DATA.md)
- 実装仕様: [`../spec/3-1-l2-data-extraction-current-spec.md`](../spec/3-1-l2-data-extraction-current-spec.md)
- 運用手順: [`../manual/8-3-l2-extraction-routines-spec.md`](../manual/8-3-l2-extraction-routines-spec.md)
