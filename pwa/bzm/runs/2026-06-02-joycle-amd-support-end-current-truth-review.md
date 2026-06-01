# JOYCLE AMD support end current truth review

作成日: 2026-06-02
作成者: BZM/OS current truth検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このbriefは、PRS damage/reinvestment source packで見つかった p09 JOYCLE の AMD関与終結差分を、read-onlyで確認したもの。

- DB write、DDL、migration、deploy、extractor実装、コード実装は行っていない。
- `negative R_net` の正式採用、R_net値付け、0-9 score表、正式rubric確定は行っていない。
- Supabaseは `project_ventures` / `projects` / `project_knowledge` / `monthly_reports` / `source_cache` / `billing_cycles` / `protocols` / `project_strategy_signals` を read-only SELECT した。
- knowledge `/Users/masa/projects/knowledge/jc.md` は read-only で確認した。

## 1. 結論

分類: `db_stale_knowledge_current`

ただし「DB全体が古い」ではなく、より正確には **`project_ventures.amd_support_ended_at` という正規化カラムだけが stale**。同じDB内でも `projects.status/end_ym`、`project_ventures.narrative_text`、`project_ventures.master_md_text` は AMD関与終結側を指している。

OS/BZMで正本として扱う優先度は以下が妥当。

| 優先 | source | current truth扱い |
|---|---|---|
| 1 | `projects.status='ended'`, `projects.end_ym='202603'` | p09のAMD/ARMADA業務PJとしては終了済みの正規化DB current truth |
| 2 | `project_ventures.narrative_text` の 2026-03-01「AMDによるJOYCLE支援が終了」 | venture narrative上も終結側。正規化カラム補正のDB内根拠 |
| 3 | `/Users/masa/projects/knowledge/jc.md` と `project_ventures.master_md_text` | 終結理由・damage guard文脈の正本候補。ただし一部はまさ口述 |
| 4 | `project_ventures.amd_support_ended_at=NULL` | stale扱い候補。継続根拠としては使わない |

## 2. evidence summary

### 2.1 knowledge `jc.md`

`/Users/masa/projects/knowledge/jc.md` は、先頭テーブルで `終了 = 2026-03 (AMD 関与終結、会社自体は存続)` と整理している。

同ファイルは、2026-03時点を `AMD 関与終結 (研究開発予算が削減された) / 野田先生の研究成果の実装には至らず` とし、2026-05-06のまさ言語化として「研究開発に予算を割り当てる意味が理解されなくなった」ことを終結理由としている。2026-05-30口述では、株主・bizdevがR&D投資を理解せず、まさが消耗して退任した、という damage guard 文脈が追加されている。

### 2.2 `project_ventures`

read-only SELECT結果:

| column | value |
|---|---|
| `project_id` | `p09` |
| `display_name` | `JOYCLE` |
| `lane` | `gx_circular` |
| `outcome_pattern` | `deep_pivot` |
| `amd_role` | `support` |
| `short_description` | `IRSプリミティブ熱分解で立上 → 群大野田先生の流動層熱分解で後付けdeep化` |
| `amd_support_started_at` | `2025-11-01` |
| `amd_support_ended_at` | `NULL` |
| `master_md_slug` | `jc` |
| `master_md_updated_at` | `2026-05-21T23:12:10.233+00:00` |

差分の要点:

- `amd_support_ended_at` は `NULL`。
- しかし同じ行の `narrative_text` には `2026-03-01` のイベントとして「AMDによるディープテックPJ『JOYCLE』支援が終了」と入っている。
- 同じ行の `master_md_text` は `jc.md` 由来で、`終了 | 2026-03 (AMD 関与終結、会社自体は存続)` を含む。

したがって、`amd_support_ended_at=NULL` は「AMD関与継続」ではなく、`narrative_text/master_md_text` との非正規化差分として扱うべき。

### 2.3 `projects`

read-only SELECT結果:

| column | value |
|---|---|
| `project_id` | `p09` |
| `project_name` | `JC` |
| `client_name` | `株式会社JOYCLE` |
| `status` | `ended` |
| `start_ym` | `202312` |
| `end_ym` | `202603` |
| `project_category` | `dtsu` |
| `updated_at` | `2026-05-08T13:19:54.618634+00:00` |

これは、AMD OS上の業務PJとしては 2026-03 終了済みであることを正規化DB側でも示している。

### 2.4 `monthly_reports`

確認結果:

- `MR_p09_202602` は `status='fixed'`、2026-02中に技術開発PM MTG・研究開発MTGが継続していたこと、2月25日のオフライン定例、1月分請求書発行プロセス調整を記録している。
- `MR_p09_202603` は `status='draft'` で、月初データが限定的、3月の具体的活動記録は確認できない、という内容。
- `p09_202604` 以降にもdraft月次があるが、`projects.status='ended'` かつ `billing_cycles` も not_started 中心なので、継続支援の正本とは扱わない。マイルストーン/テンプレート由来の未確定draftとして見るのが安全。

### 2.5 `source_cache`

直接の `退任` / `関与終結` / `支援終了` / `AMD 関与` ヒットは、`project_knowledge` / `source_cache` では 0件だった。

ただし、damage/reinvestment sourceとしては以下を確認した。

| source | 内容 | 扱い |
|---|---|---|
| `p09_gmeet_minutes_19ade6ecf49c7903` | 2025-12-02月次報告会。まさの役割が11月からR&Dと開発のみへ変更、稼働時間減、リソース逼迫、資金調達上「ディープテックではない」と見なされる問題 | 役割変更・R&D重視のsource。終結そのものではない |
| 2025-11-11 R&D MTG系 | 野田先生の特許を利用した装置小型化、研究開発主要課題、マンパワー確保 | 本命R&D投資/人員source |
| 2026-02〜03周辺のgmail/slack | JOYCLE BOX、投資、契約、請求、実証、装置開発、見学会/量産準備の多数ログ | 事業・装置販売前夜source。AMD関与終結そのものではない |
| 2025-05〜07以降の見学会/量産/請求ログ | BOX見学会、保管費用、量産体制、タスクベース請求、PM引き継ぎ | 正のR_netではなくdamage guard確認対象 |

### 2.6 `billing_cycles`

p09の `billing_cycles` は 202512〜202702 に存在するが、PRSではSU本体売上・damage/reinvestmentの根拠にしない。

重要な状態:

| ym | status | invoice/payment |
|---|---|---|
| `202512` | `not_started` | `invoice_sent_at`あり、`payment_confirmed_at=2026-02-19T20:51:05+00:00` |
| `202601` | `budget_confirmed` | `invoice_sent_at`あり、`payment_confirmed_at=2026-04-24T15:40:02+00:00` |
| `202602` | `budget_confirmed` | `invoice_sent_at=2026-03-10T02:54:00+00:00`、payment未確認 |
| `202603`以降 | `not_started`中心 | invoice/paymentなし |

これは「2月分まで請求処理が残り、3月以降は実質停止」という補助情報にはなるが、JOYCLE本体の粗利・R_netではない。

### 2.7 `protocols` / `project_strategy_signals`

read-only SELECT結果:

- `protocols`: p09/JOYCLE/JC関連ヒットなし
- `project_strategy_signals`: p09関連ヒットなし

したがって、この2テーブルは今回の current truth 正本にはしない。

## 3. 差分分類

最終分類は `db_stale_knowledge_current`。

理由:

1. knowledge `jc.md` は 2026-03 AMD関与終結を明示している。
2. `projects` は `status='ended'` / `end_ym='202603'` で、正規化DB側にも終了状態がある。
3. `project_ventures` は `amd_support_ended_at=NULL` だが、同じ行の `narrative_text` と `master_md_text` は 2026-03終結を示している。
4. `monthly_reports` / `source_cache` は、2月までのR&D/PM/請求継続と、その後の販売・装置・見学会ログを示すが、AMD関与継続を確定する強い根拠にはならない。

ただし、DB反映workerを切る場合は `knowledge_oral_needs_db_evidence` の注意も残すべき。終結理由のうち「株主/bizdevがR&D投資を理解しなかった」「まさ退任理由」は口述由来なので、`amd_support_ended_at` 反映と、damage理由の正式evidence化は分ける。

## 4. 正本候補

OS司令塔/BZM司令塔向けの扱い:

- **終了時点の正本**: `projects.end_ym='202603'` + `project_ventures.narrative_text` + `jc.md`
- **終了理由の正本候補**: `jc.md`。ただし口述由来として `source_status=oral_history/confirmed_by_masa` 相当の注記が必要。
- **stale修正候補**: `project_ventures.amd_support_ended_at` を `2026-03-01` または month precisionを許す別設計で `2026-03` に揃える。現行columnは `date` なので `2026-03-01` が実装上の自然候補。
- **継続根拠として使わないもの**: `project_ventures.amd_support_ended_at=NULL`、future-like draft月次、future not_started billing rows。

## 5. PRSへの影響

PRS / evidence cards v3への戻し方:

- p09 JOYCLEは引き続き `damage_guard_candidate` / `review-only`。
- `project_ventures.amd_support_ended_at=NULL` は「AMD関与継続」ではなく、source hygiene issueとして注記する。
- evidence cards v3では、p09の support end evidence を次のように分ける。

| card field | 推奨 |
|---|---|
| `support_end_status` | `ended_current_truth_candidate` |
| `support_end_date` | `2026-03` |
| `support_end_source` | `projects.status/end_ym`, `project_ventures.narrative_text`, `jc.md` |
| `support_end_db_gap` | `project_ventures.amd_support_ended_at_null` |
| `damage_guard_use` | `review-only` |
| `do_not_use_as` | 正のR_net、販売実績、正式negative R_net |

重要: JOYCLEのJB-02/JB-02A、装置見学会、有償テスト、量産計画は、契約・請求・入金・原価・導入/保守・本命R&D影響が揃うまで、正のR_netにしない。

## 6. 司令塔判断事項

1. `project_ventures.amd_support_ended_at` を `2026-03-01` へ補正するDB workerをOS司令塔側で切るか。
2. `project_ventures.narrative_text` と `master_md_text` は終結側なのに、正規化カラムだけNULLの状態を source hygiene issue として台帳化するか。
3. damage guard理由のうち、口述由来部分を `confirmed_by_masa` として採用するか、追加DB/source evidenceを要求するか。
4. future-like draft月次と future billing rows を、ended PJのcurrent truth判定から除外する運用を明文化するか。

## 7. 次アクション

1. OS司令塔で DB補正workerを切る場合、read-only確認後に `project_ventures.amd_support_ended_at='2026-03-01'` を更新するmigration/patchを別workerで作る。
2. BZM司令塔は evidence cards v3 に `support_end_db_gap` として戻す。
3. p09のdamage guard source packでは、終結日と終結理由を分ける。終結日は current truth候補、理由は oral/source mixed。
4. `billing_cycles` は引き続き PRS本体から除外し、AMD業務請求/cash timing補助に限定する。

## 8. 検証

- 必読ドキュメントを確認: `/Users/masa/projects/AGENTS.common.md`, root `AGENTS.md` / `CLAUDE.md` / `HANDOFF.md`, `pwa/AGENTS.md` / `pwa/CLAUDE.md` / `pwa/HANDOFF_pwa_rebuild.md`, `pwa/bzm/COMMANDER_TASKS.md`, 指定BZM run 4件, `/Users/masa/projects/knowledge/jc.md`, `pwa/design/db_schema.md`。
- `git fetch --all --prune`、`git log --branches --not --remotes --oneline`、`git branch -a`、`git status -s` を実行した。
- Supabase read-only SELECTのみ実行した。
- DB write、DDL、migration、deploy、実装、`git add .` は行っていない。

