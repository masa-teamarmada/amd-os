# L2D-6 経営ハイライト仕様

> **この章は何か**: `project_strategy_signals` に保存される経営ハイライト、通知採否、cockpit 表示、dialogue 接続の確定仕様。設計議論は `pwa/design/project_strategy_signals.md` にも残す。

## 定義

経営ハイライトは、MS進捗より上位の「進んだこと / 起きたこと」。

入れる:

- 経営方針や事業方針が決まった
- 顧客 / 提携 / 資金 / 規制 / 知財 / 採用で PJ の進路が変わる進捗があった
- 重要リスクが顕在化した
- 次に取るべき行動が事業上の意思決定として明確になった

入れない:

- 単なる日程調整
- 通常の TODO
- MS 進捗率だけで表せる作業
- source refs が弱い推測
- 既存 signal の言い換え
- **些細な人事の出来事と、個々のメンバーの参画可否・貢献ぶり**（2026-08-28 追加、2026-09-04 に範囲を確定。下記）

### 人・組織の線引き

経営ハイライトは**会社としての大きな動き**の棚である。人が絡んでいてもよいが、粒度が会社の動きであること。

> **2026-09-04 まさ訂正（2段階）。**
>
> 1本目——「人と組織の話は経営ハイライトに書かない」というルールは作られていない。
> 「こんなルールは作ってないよ。重要なポジションの人が抜けたとか新しく参画したとかは絶対書くべき。
> 8/28のは、何か人事に関するどうでもいい些細なことをハイライトに入れられたから、些細なことは書かないで、と伝えたんだと思う。
> それを勘違いして組織の話は書かない、と解釈したんじゃないかな。」
>
> 2本目——それを受けてえいみが、個々のメンバーの参画意向・貢献ぶり・参画拒否を4件ハイライトへ立てたのに対して。
> 「この４つは経営ハイライトに書くべきじゃないと思うので削除して。あくまで会社としての大きな動きに限定して。」

この2つを合わせると線引きはこうなる。

- **カテゴリ禁止ではない。** 「人と組織の話だから書かない」ではない。
- 入れないのは、**些細な人事の出来事**、**日付を持たない恒常的な性質**、そして
  **個々のメンバーの参画可否・貢献ぶり・処遇の相談**。設立準備中の一人ひとりの調整は、まだ会社としての大きな動きではない。
- 会社としての大きな動きになるのは、たとえば代表・CxO級の就任や離脱、技術の担い手の恒久喪失、
  設立の進め方そのものが組織へ及ぼした影響。
- **迷ったら《組織》へ置く。** 経営ハイライトへ上げるかはまさに確認する。勝手に上げない。

《組織》はPJコックピット「スコア詳細」タブ（[4-9](4-9-project-org-section-current-spec.md)）で、
そこでは経営チームの八機能の充足を判定する材料として使われる。
**片方だけに置く決まりではない。** 会社としての大きな動きであり、かつ八機能の充足の材料でもあるものは、両方に置く。

| 例 | どちらか | 理由 |
|---|---|---|
| 「起源PIが事業会社との商談で壁を作り、関係づくりを妨げている」 | 組織 | 人の恒常的な性質。日付のある事象ではない |
| 「チームに一体感があり設立前としては成熟している」 | 組織 | チームの状態。良い評価でも同じ（2026-09-04 に再確認） |
| 「事業範囲を広げない経営判断が固定されている」 | 組織 | 意思決定の構え。特定の日の決定ではない |
| 「メンバーの参画がほぼ確定した／所属を断ってきた／制度上の理由で正式参画できない」 | 組織 | 個々の参画可否。設立準備中の調整は会社としての大きな動きではない（まさ 2026-09-04） |
| 「技術の鍵を握るメンバーを外し、3名で誰も作れなくなった」 | 経営ハイライト＋組織 | 会社として作れなくなったので大きな動き。担い手の喪失は組織側にも観測として立てる |
| 「新会社設立の動きを始めた結果、母体の研究グループ内に不和が出はじめた」 | 経営ハイライト＋組織 | 設立の進め方が組織全体へ及ぼした影響なので、会社としての動き |
| 「CEO候補と初回接触し、副業・出向での参画可能性を探ることで合意した」 | 経営ハイライト | 日付のある事象 |

**まさが口頭で話した内容を、置き場所を決めずに経営ハイライトへ入れない。**
2026-08-26〜28 に各PJの「死ぬとしたらどこからか」を洗い出した内容が、
行き先が無いまま経営ハイライトへ入り、まさの指摘（「これどうみても経営ハイライトじゃなくない？」）を招いた。

## 正本テーブル

| table | 用途 |
|---|---|
| `project_strategy_signals` | 経営ハイライト本体 |
| `l2_notifications` | `l2_kind='project_strategy_signal'` の承認カード |
| `project_meeting_summaries` | dialogue 議事録 (`source_kinds='dialogue'`) |
| `l2_feedbacks` | コメント / 修正依頼 / 次回抽出への学習 |

## 現行 writer

| 項目 | 値 |
|---|---|
| writer | Codex automation `amd-os` |
| SKILL | `pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md` |
| schedule | daily 03:20 JST |
| output | `~/.codex/automations/amd-os/strategy-signals-outbox/*.json` |
| apply | LaunchAgent + `ms_progress_review_tool.mjs apply-outbox-dir --dir <strategy-signals-outbox>` |

`automation-prepare` の hard gate は Supabase / PWA API / snapshot refresh / 5 生データ。GAS health は任意診断で、デフォルト hard gate にしない。

### SXワークスペース接続

SX (`p21`) だけは、5生データとOS snapshotに加えて `GET /api/project-workspace/p21/automation-context?since=YYYY-MM-DD&until=YYYY-MM-DD` を読む。このrouteは同じ `project_management_*` 正本の変更履歴を件数上限なしで返し、保存時にLLMは呼ばない。

- `strategyEvidence.eligible=true` は「D-6がレビューすべき完了事実」の一次絞り込みであり、自動採用ではない。
- 通常の進行中TODO、未完了、単なる編集は経営ハイライト候補にしない。
- D-6のdone-only、claim gate、重複排除、candidate reviewをそのまま通す。
- source refは `kind='project_management_update'` と `update_id` を保持し、Cockpitの根拠詳細から元のSXワークスペースへ戻れるようにする。
- ワークスペースの件数・工程・判断一覧をCockpitへ別カードとして複製しない。

外部公開情報は別の Codex automation `tsukuyomi-external-research` が平日09:00 JSTに調べ、同じ outbox / applier へ候補を渡す。旧 `gas-external-research` の Slack 配信は停止し、候補の提示先は `/notifications` に一本化する。新情報ゼロは正常終了で、空 outbox や穴埋め記事は作らない。

## DB 契約

| column | 契約 |
|---|---|
| `project_id` | 対象 PJ。会社全体は `p00` |
| `ym` | 対象月。明確でなければ NULL |
| `signal_date` | 事象が起きた日。観測日ではない |
| `polarity` | `breakthrough` / `forward` / `pivot` / `risk` |
| `signal_type` | `management_decision` / `business_progress` / `strategic_pivot` / `commercial_progress` / `partnership` / `funding` / `ip_regulatory` / `risk` / `next_move` / `tech_progress` |
| `impact_level` | `low` / `medium` / `high` / `critical` |
| `decision_state` | `observed` / `proposed` / `decided` / `executing` / `revised` |
| `status` | `candidate` / `confirmed` / `rejected` / `archived` |
| `source_refs_json` | source id / date / title / short snippet / url / hash |
| `source_hash` | 重複排除 |
| `origin_kind` | `internal` = 従来の経営ハイライト、`external_research` = つくよみ外部リサーチ |
| `research_category` | 外部リサーチだけ `industry_market` / `grant` / `partner`。internal は NULL |
| `signal_scope` | `company` / `project` / `cross_project`。Management Scoreに入れる範囲分類 |
| `applies_to_company_score` | AMD会社バイタルへ入れてよいとき TRUE |
| `pipeline_status` / `pipeline_probability` | 契約前pipelineの状態と確度。高確度candidateは原則 0.75 以上 |
| `expected_amount_yen` / `expected_contract_ym` | 見込み金額と契約・請求・開始見込み月 |
| `company_score_axis` / `scope_reason` | Management Score 側の軸と、company/PJ分類の根拠 |

`signal_date` は「リアクター特許出願完了（4/27付）」なら 4/27。議事録に出た日ではなく、事象発生日を優先する。

外部リサーチの `source_hash` は、正規化した title / entity / event date / material update の SHA-256。canonical URL とこの fingerprint を、candidate / confirmed / rejected / archived の全履歴と未反映 outbox に対して照合する。status・月・種別が変わっても同じ出来事を再通知しない。締切確定、採択結果、金額変更など判断に効く新事実がある場合だけ `material_update` を変えて続報にする。

## Cockpit 表示

`/project/[projectId]/cockpit` の MS リスト直下に出す。

- 日付
- polarity chip
- signal_type chip
- impact chip
- candidate の未確認 chip
- title
- summary 1-2行
- `score_impact_summary`
- source refs 数と短い根拠

candidate も表示してよいが、未確認 chip を必ず付ける。

2026-08-11以降、経営ハイライト内は次の2棚に分ける。

- `重要な動き`: `origin_kind='internal'` の candidate / confirmed。従来表示を維持する。
- `採用リサーチ`: `origin_kind='external_research' AND status='confirmed'` だけ。業界・市場 / 助成金 / 協業候補の分類を出す。

どちらの棚も `signal_date` の新しい順に並べ、**初期表示は直近8件**。棚の末尾の「▼ 古い動きも表示」を押すと取得済みの全件が出て、「▲ 直近8件だけ表示」で畳み直せる。棚を切り替えると畳んだ状態に戻る。サーバ側の取得上限は internal 200件・external_research 20件。
件数を8件で固定していた間は、数か月前の資金調達や提携がコックピットから消えて追えなかった（2026-08-28 まさ依頼で全件表示へ）。

外部リサーチの candidate は cockpit に出さず `/notifications` だけに置く。

## 採否

- 「はい」: `project_strategy_signals.status='confirmed'`。
- 「いいえ」: `status='rejected'`。
- コメント: `l2_feedbacks` に保存して次回 automation へ入れる。

外部リサーチ通知だけは画面文言を「採用 / 見送り」にする。通知 metadata の `signal_source_hash` と完全一致する1件だけを更新し、一致しない場合に同月・同種別へ採否対象を広げない。

`risk` は純粋な外部要因に使う。自社内部のリスクは本来の分類 (`management_decision` / `business_progress` / `commercial_progress` など) に寄せる。

Management Scoreへ入れるかどうかは `status='confirmed'` とは別契約。PJ cockpit上の経営ハイライトとしては candidate/confirmed を表示してよいが、AMD会社バイタルへ入れるには `applies_to_company_score=true` かつ `signal_scope in ('company','cross_project')` が必要。個別PJの技術・実験・設立・顧客論点は `signal_scope='project'` / `applies_to_company_score=false` にする。

## Dialogue 接続

dialogue は、candidate signals をまさとえいみが 1 件ずつ確認し、チームへ提案する前の論点を整理する経路。

| API | 用途 |
|---|---|
| `POST /api/strategy-signals` | confirm / reject / update / create |
| `POST /api/dialogue-meeting` | 議論ログを `project_meeting_summaries` に保存 |
| `POST /api/dialogue-meeting/narrate` | raw 配列を narrative に変換 |

dialogue の `decided[]` は会社としての正式決定ではなく、「チームへ出す提案として固まったこと」の意味で書く。

## 禁止事項

- source refs が弱い推測で signal を作らない。
- 未了 TODO を「進んだこと」として入れない。
- Gmail / Slack / Notion / Drive 本文全文を保存しない。
- GAS health failure だけで L2D-6 review 全体を止めない。
