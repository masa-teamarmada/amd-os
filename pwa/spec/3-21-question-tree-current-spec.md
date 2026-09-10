# 問いの木

> **目的**: PJの計画を「やることの階層」ではなく「分からないことをつぶす順序」として持つ。問いを分解し、答えを出す行為をぶら下げ、答えが出たときに何が決まって何が新しく生まれたかまで一続きでたどれるようにする。

正本ステータス: 確定（まさ 2026-09-10）。実装中。仕様変更はこのファイルと同じcommitで反映する。

## なぜ作り直したか

2026-09-10時点の実データ。

| 事実 | 数 |
|---|---|
| 目的・成立条件・工程を持つPJ | 4件（p19 / p25 / p30 / p00）のみ |
| SX（p21）の目的 / 成立条件 / 工程 | 0 / 0 / 0 |
| SXが実際に使っているもの | 論点17件・やること17件・技術試験22件 |
| どの工程にも成立条件にも接続されていない論点 | 62件中32件 |
| 「決着した」と記録された論点 | 0件 |

`目的 → 成立条件 → 工程` という階層は、最も進んでいるPJが使わずに済ませていた。論点はその階層の外に置かれ、決着の記録が一度も発生していない。閉じるのに仮説・根拠・検証・判断をすべて埋める必要があり、実務の速度に合わなかった。

まさ確定（2026-09-10）でこの階層を廃止し、問いの木を計画の背骨に置く。ZMP（p19）を含む既存の全PJデータを新構造へ移す。

## 型は3つ

11種類あった管理項目を3つへ畳む。

| 新 | 旧 |
|---|---|
| 問い | 目的 / 成立条件 / 論点 / 仮説 / 決めること |
| やること | 工程 / 予定日MS / やること / 検証 / 技術試験 / 決定後の行動 |
| 分かったこと | 根拠 / 反証 |

仮説を独立の型にしない。「より多くの油分を産出できる強化株は実現可能か」は答えの候補であると同時にそれ自体が問いであり、分ける理由がない。答えの候補は、親の問いにぶら下がる `alternative` の子として表す。

### 問い（`project_questions`）

答えが出れば閉じるもの。

| 列 | 内容 |
|---|---|
| `id` / `project_id` | |
| `parent_id` | 親の問い。NULLなら根。木であり、多重の親は持たない |
| `contribution` | 親から見たこの子の役割。`required`（これが解けないと親は解けない）/ `alternative`（これが解ければ親に答えが出る。他の代替は不要）。根はNULL |
| `title` | 問いの文 |
| `background` | 経緯・前提・成立条件の式など。結論で上書きせず積む |
| `question_kind` | `open`（分からないこと）/ `decision`（意思で決まること） |
| `status` | `open` / `answered` / `dropped`（追わないと決めた） |
| `answer` | 答え。1行で足りる |
| `answered_on` / `answered_by` | |
| `confidence` | `unknown` / `low` / `medium` / `high`。答えの確からしさ |
| `owner_label` / `due_date` | 誰が、いつまでに答えを出すか |
| `origin_kind` | `manual` / `meeting` / `automation` |
| `origin_ref` | 生まれた元（議事録ID等） |
| `origin_question_id` | どの問いを議論していて生まれたか。派生の記録 |
| `sort_order` | 同じ親の中での並び。手動並び替えの正本 |
| `last_verified_at` / `created_at` / `updated_at` / `deleted_at` / `version` / `client_token` | |

`origin_question_id` が「論点を整理すると新しい論点が出てくる」を保持する。答えを出す過程で生まれた枝が、どの議論から生えたかを失わない。

### やること（`project_actions`）

実行すれば終わるもの。答えは出さない。

| 列 | 内容 |
|---|---|
| `id` / `project_id` | |
| `parent_id` | 親のやること。工程はこの入れ子で表す。深さの制限は設けない |
| `title` / `detail` | 何を、どうやって |
| `action_kind` | `work`（作業）/ `measure`（確かめる行為。測る・調べる・見積もる・相手に聞く） |
| `status` | `unassessed`（進捗未登録）/ `not_started`（着手していないと人が宣言した）/ `running` / `blocked` / `done` / `dropped`。既定は `unassessed` で、進捗率を実績として表示せず0%と偽らない |
| `owner_label` | |
| `planned_start` / `planned_end` / `actual_end` | 開始日と完了日が同じか両方NULLなら一点の予定日 |
| `date_certainty` | `confirmed` / `provisional` |
| `progress_pct` | |
| `blocker` | 詰まり |
| `done_criteria` / `done_evidence` | 完了条件と完了証跡 |
| `target` / `actual` / `unit` | 測定系のときだけ埋まる。目標値・実測値・単位 |
| `origin_kind` / `origin_ref` / `origin_question_id` | |
| `sort_order` / `last_verified_at` / 監査列 | |

`measure` は問いに答えを出すための行為で、`work` は答えが出た後に実行する作業。この区別が「枝が宙に浮いている」判定に効く。

### 分かったこと（`project_findings`）

事実と出どころ。

| 列 | 内容 |
|---|---|
| `id` / `project_id` | |
| `summary` | 何が分かったか |
| `finding_kind` | `supports` / `contradicts` / `neutral` / `missing`（分かっていないことが分かった） |
| `observed_on` | |
| `source_label` / `source_url` | 出どころ。外部情報は必ず出典を持つ |
| `confidence` | |
| `from_action_id` | どのやることの結果か。外部由来ならNULL |
| 監査列 | |

### つなぎ

| テーブル | 内容 |
|---|---|
| `project_question_actions` | 問い ↔ やること。多対多。ひとつの測定が複数の問いに答えることを表す |
| `project_question_findings` | 問い ↔ 分かったこと。多対多 |
| `project_action_dependencies` | やること間の前後関係。`finish_to_start` のみ |

問いの親子は単一親の木、やることと問いの結び付きは網。SXの「総脂肪酸量と炭素数の分布を1回測ると、油の量と炭化水素株の両方に答えが出る」がこの形で入る。

## 判定

画面が出す状態はすべて導出値で、人が直接編集しない。

### 問いの状態

| 状態 | 条件 |
|---|---|
| 判断できる | `required` の子がすべて `answered` か `dropped`、`alternative` の子がある場合は1件以上 `answered`、紐づく `measure` がすべて `done` |
| 手が止まっている | 未閉じで、子もやることも1件も無い |
| 枝が死んだ | `alternative` の子がすべて `dropped`、または `required` の子が1件でも `dropped` |
| 期限超過 | 未閉じで、自分または子孫の最も近い期限が基準日より前 |
| 更新切れ | 自分と子孫の `last_verified_at` の最新が7日以上前。日付欠損も更新切れ |

**子がすべて片付いても親を自動で閉じない。** 「判断できる」として判断キューへ出すところまでで止め、答えを書くのは人。

**枝が死んだ問いも自動で `dropped` にしない。** 警告を出し、親の判断材料として見せる。

**親を消しても子は消さない。** 子は根へ上がり、`contribution` は外れる。根に「必須」の印だけが残ると、何に対して必須なのか読めなくなるため。読み込み側も、親が見つからない子を同じ扱いにする。

**閉じた問いは同じ並びの末尾へ落とす。** 未閉じが上に来ないと、いま何が残っているのかを目で拾えない。

### 次につぶすべき問い

未閉じの問いのうち、次の順で並べる。

1. 判断できる（人が答えを書けば閉じる）
2. `measure` が1件もぶら下がっていない未閉じの葉（前に進む手が無い）
3. 期限超過
4. 子孫の未完了 `measure` が最も少ないもの（あと少しで閉じる）

## 画面

問いの木は**PJワークスペースの`論点・仮説`タブの中身そのもの**である（`QuestionTreeView` を `embedded` で描画）。専用ページは作らない（まさ確定 2026-09-10「新たなコンテンツにしないで、論点仮説タブの中身をそれにして」）。旧・6層リスト（論点カード／絞り込み／手動並び替え）は同じcommitで撤去した。

| 面 | 内容 |
|---|---|
| 上段 | 次につぶすべき問い。判断できる → 手が止まっている → 期限超過 → あと少しで閉じる、の順 |
| 中段 | 問いの木。状態・担当・次の期限・残っている確認の件数つき。行を開くと背景・答え・ぶら下がるやること・分かったことを同じ場所で読み書きする |
| 下段 | どの問いにもつながっていないやること |
| ガント | 左列が問いの木、バーがやること。工程レーンは持たない（未実装） |

`目的構造`タブは廃止する。

## 移行

既存データは削除せず、新テーブルへ変換して入れる。旧テーブルは新画面が本番で動いたあと、まさの確認を経て落とす。

| 旧 | 新 | 変換 |
|---|---|---|
| `project_management_objectives`（9） | 問い（根） | タイトルを問いの形へ機械変換しない。原文のまま入れ、`question_kind='open'` |
| `project_management_outcomes`（29） | 問い | 対応する目的の子。`contribution='required'` |
| `project_management_milestones` phase（28） | やること | `outcome_id` の問いへ紐づけ、子タスクの親になる |
| `project_management_milestones` milestone（2） | やること | 開始日=完了日の一点 |
| `project_management_tasks`（276） | やること | `milestone_id` を親のやることへ |
| `project_management_issues`（62） | 問い | `milestone_id` / `outcome_id` があればその問いの子、無ければ根 |
| `project_management_hypotheses`（5） | 問い | 親issueの子、`contribution='alternative'` |
| `project_management_decisions`（15） | 問い | `question_kind='decision'`。`decision_text` は `answer` |
| `project_management_action_items`（8） | やること | 対応する決定の問いへ紐づけ |
| `project_management_validation_runs`（5） | やること | `action_kind='measure'`、親仮説の問いへ紐づけ |
| `project_management_technical_tests`（32） | やること | `action_kind='measure'`。`target` / `actual` / `unit` をそのまま持つ |
| `project_management_evidence`（11） | 分かったこと | `evidence_kind` を `finding_kind` へ写像 |
| `project_management_tracks`（40） | 廃止 | 柱は根の問いが担う |

関係先（`project_management_partners` 系）、KPI、人員配分、組織役割、監査ログは今回の対象外でそのまま残す。KPIの `milestone_id` 参照は移行後のやることIDへ張り替える。

## 廃止するもの

- `目的 → 成立条件 → 工程` の3階層と、それを前提にした目的構造タブ・成立条件ナビゲーション
- 柱（track）による分類とレーン
- 論点を閉じるために仮説・根拠・検証・判断をすべて埋める要求
- 仮説・検証・技術試験・決定後の行動を別々の入力導線として持つこと
