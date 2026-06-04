# AMD OS 司令塔タスク台帳

最終更新: 2026-06-04

この台帳は、AMD OS全体司令塔が受けている依頼を「コードを読んでいない人でも分かる」粒度で整理するためのもの。worker報告をそのまま貼らず、司令塔がまさ向けに要約して更新する。

担当範囲:
- このroot台帳は、AMD OS全体司令塔のタスクだけを載せる。
- BZM司令塔の詳細タスクは `pwa/bzm/COMMANDER_TASKS.md` に分ける。
- Textbook司令塔の詳細タスクは、Textbook正本ディレクトリ配下の `COMMANDER_TASKS.md` に分ける。
- root台帳では、BZM/Textbook配下の個別タスクを細かく持たず、OS全体から見た連携・判断待ちだけを書く。

更新するタイミング:
- まさから新しい依頼が来たとき
- 方針が変わったとき
- workerを切ったとき
- workerから完了報告・要判断報告・差し戻し報告が来たとき
- タスクを完了扱い、保留扱い、またはarchive扱いにするとき

未完タスク監視ルール:
- 未完タスクがあるのに、司令塔が作成したworkerが全員停止・完了・待機で、次のアクションも切られていない状態を作らない。
- worker quiet modeを採用する。workerは原則としてAMD OS司令塔チャットへ進捗・中間報告・自己判断の完了報告を送らない。
- workerスレッド内でまさが「完全に完了」「OK」「これでよし」等と明示した後、1回だけAMD OS司令塔へ最終closeoutを送る。
- 例外は、UU conflict、未分類dirty、権限/破壊的操作/外部判断、同じblocking conditionで進行不能など、司令塔側の介入が必要な場合のみ。その場合も短いblocker/handoffを1回だけ送る。
- quiet modeを前提に、司令塔側のheartbeat/read_threadや定期確認で、worker終了・停止・報告未確認を静かに検知する。
- heartbeat時はこの台帳の未完タスク上位を確認し、進められるものがあればworkerを切る、既存workerを再起動する、または差し戻す。
- 進められる未完タスクがない場合は、まさ確認・まさ判断・外部作業が必要なはずなので、具体的な質問またはアクションとしてまさを動かす。
- 以後のworker promptには、旧「完了・停止・要判断時は必ず親司令塔へ能動報告」ではなく、このworker quiet modeと未完タスク監視の前提を含める。
- `COMMANDER_TASKS.md` にはworker詳細ログを貼らず、Active workerあり、worker id、状態、次回確認条件、まさ要判断だけを短く残す。

Vercel deploy approval gate:
- 2026-06-04 まさ判断で、Vercel deploy上限は緩和。deploy自体は再開OK。
- ただし少しの間、Vercel production deploy / preview deploy / Vercel自動deployを起こす可能性がある `git push` の直前には、必ず `askuserquestion` でまさの許可を取る。
- 許可質問には `deploy bundle` を含める。内容は「含める変更」「除外する変更」「local build/test/browser確認結果」「deploy予定回数」「push/deploy先」「rollback/本番確認方法」。
- てにをは、微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployする運用は禁止のまま。複数worker成果を束ねて1回でdeployする。
- 承認待ちで止まる場合は `approval pending` として台帳に残す。未分類blocker扱いにしない。
- 現在状態: `Vercel deploy approval gate active`。deploy bundle承認まではpush/deployしない。
- deploy bundle候補: BZM approval gate台帳更新 (`e34be20`)、Textbook approval gate台帳更新 (`43165dd`)、Textbook main integration未反映分、BZM/PRS系、OS UI系、KUTE MTGカード/自動生成修正、company content Notion移植など、local検証済み変更をbundle化して提示する。
- askuserquestion承認状況: 未承認。次のpush/deploy直前にdeploy bundle付きで確認する。
- deploy実施回数: 2026-06-04 gate更新後 0回。
- push保留: あり。BZM approval gate更新commit `e34be20`、Textbook approval gate更新commit `43165dd`、2026-06-03 hard gate反映のローカル台帳/AGENTS更新、Claude migration handoff系、現在の司令塔台帳更新は未push。
- `/Users/masa/projects/AGENTS.common.md` は個人司令塔側で更新済み。

## 未完タスク（優先順位順）

### 0A. 2026-06-01 KUTE internal MTGをMTGツリーに出し、自動生成漏れを直す

- お願いしたタスク内容
  - 2026-06-01 の KUTE internal MTG がMTGツリーに出ていない原因を特定する。
  - 必要なMTGカードを作成し、KUTE側のMTGツリー/コックピットで読める状態にする。
  - 今後同種のKUTE internal MTGが自動生成されるよう、L6/MTGカード生成経路の再発防止を入れる。
- お願いした背景
  - KUTE internal MTGがMTGツリーに出ておらず、KUTEの会議履歴・準備導線・後続アクションがOS上で追えない。
  - 以前もKUTE予定名に `KUTE` と `AMD` が混在し、PJ判定が曖昧でカード生成がskipされた事故があったため、今回も原因を推測で埋めず現物確認が必要。
- 現状どうなってるか
  - 動作状態: urgent worker切り出し。worker pending worktree: `local:4ec86827-2b82-4dc6-9f9f-f494ca1032f9`。
  - 司令塔側では個別調査・DB write・実装修正を直接行わない。
  - worker quiet modeのため、詳細ログは親司令塔へ流さない。
- 残課題は何か
  - Calendar event / existing `project_meeting_summaries` / MTGツリー表示条件 / L6 run履歴を確認し、欠落原因を分類する。
  - 最小安全経路でMTGカードを作る。既存開催済み議事録や手動編集済みrowがある場合は上書きしない。
  - 自動生成の再発防止を入れる。必要ならKUTE alias/project判定、internal MTG title handling、L6 guard/test/docsを更新する。
  - local test/buildまで確認し、push/deploy直前はdeploy bundle付きでまさ承認を取る。承認待ちは `approval pending` とする。

### 0. Management予実表の下に、月末経営シグナル評価欄を作る

- お願いしたタスク内容
  - `/management-score` の月次試算表の下に、予実表から分かる経営シグナルと評価を表示する欄を作る。
  - 先3か月の見込み、この費用を抑えるべき、いつまでにどのくらい追加案件を獲得すべき、予実乖離の原因解明、意思決定アラートを同じ欄で読めるようにする。
  - 最新月は展開し、古い月の評価はトグルで折りたたむ。
  - 評価は毎月末日に専用Codexチャットで作成する運用へつなぐ。
- お願いした背景
  - 月次試算表が予算/実績/差分の3列になり、数字は見やすくなった。
  - まさは表を読むだけでなく、その表から「経営として何を判断すべきか」を見たい。
  - 単なるキャッシュ判断ではなく、資金の谷、費用抑制、追加獲得目標、乖離原因まで含めた月末評価が必要。
- 現状どうなってるか
  - worker thread `019e78e8-7ec1-70d1-9a7d-831f43c85c3d` へ追加タスク認識を共有済み。
  - 実装workerが、月次試算表直下の経営シグナル評価欄、月末評価保存用DB、専用Codexチャット/heartbeat運用の追加を進めている。
- 残課題は何か
  - UI実装、migration、typecheck/build、ローカル確認を完了する。
  - push/deploy直前はdeploy bundle付きでまさ承認を取る。承認待ちは `approval pending` としてdeploy bundle候補へ回す。
  - 月末Codex専用チャットと定期実行が、実際のCodex automation/heartbeatで成立するか確認する。
  - 完了または要判断になったら、司令塔へ `【司令塔へ報告】Management経営シグナル評価欄 追加 完了` または `要判断` で報告する。

### 1. 特許案と現OSの乖離箇所をretrofit実装する

- お願いしたタスク内容
  - 特許案に書かれているが現OSでは薄い機能を、出願用の飾りではなくOS実態としても強くする。
  - 優先候補は、`protocol_result_observations` のadmin UI化、outcome evidence refsの強化、WS-5 generic system parameter governance、WS-6 Before-Zero設立時期推奨、`/notifications`・`/admin/protocols`・`/admin/ip` の関連導線整理。
  - DB writeやmigrationは、設計レビューで安全性と秘密保持境界を確認してから実装workerへ分ける。
- お願いした背景
  - まさ判断として、「未実装でも出願は可能そうだが、OSとして本来的に実装されていた方が優れているなら実装しておきたい」。
  - 参照成果物は `docs/ip/2026-06-01_patent_os_gap_audit_internal.md`、`docs/ip/2026-06-01_patent_application_draft_internal.md`、`docs/ip/2026-06-01_claim_revision_internal.md`。
  - 特許を弱めるためではなく、特許案に書く価値がある機能をAMD OSの実運用としても厚くするためのretrofit。
- 現状どうなってるか
  - 動作状態: P0実装worker切り出し。設計レビューworker `019e8397-e254-7692-bb80-839b4309bf95` が完了報告済み。
  - 設計レビュー成果は branch `origin/codex/ip-retrofit-design-review`、commit `c71008a docs: add IP retrofit implementation plan`。
  - 設計成果物として `pwa/spec/5-6-ip-retrofit-implementation-plan.md` を追加し、spec章登録と附則更新まで完了した。
  - 指定IP docsは設計workerのworktree HEADには無かったため、`codex/ip-patent-consult-pack` 系branch上の文書を `git show` でread-only参照した。
  - レビュー結論として、初手はDB/DDLなしで `/admin/protocols` に `protocol_result_observations` のread-only outcome ledger UIを追加するのが最小。
  - `/admin/ip` には別workerが「現状の出願案」ビューを実装済み。出願書類たたき台、請求項見直し案、請求項サポート対応表、現OS乖離監査をOS内で確認できるようにした。
  - admin/IP表示workerの成果は branch `codex/ip-patent-consult-pack-os-gap-audit`、commit `36f0257`。正本は引き続き `docs/ip/*.md`。
  - P0 UIでは、horizon / valence / confidence / summaryを表示し、同一horizonで異なるvalenceがある場合だけ矛盾観測chipを出す。既存観測は上書きしない。
  - 秘密保持境界として、実DB行、source permalink、実本文、prompt全文、few-shot、score weight/threshold/calibration、実PJ本文は保存・表示しない。
- 残課題は何か
  - P0として、`/admin/protocols` に `protocol_result_observations` のread-only outcome ledger UIを実装し、admin-only境界と秘密情報非表示を確認する。
  - P1のwrite UIへ進む前に、`protocol_result_observations` のRLS/admin-only write境界を確認する。
  - evidence refsをJSONで持つか中間tableにするかを、既存RLS/API/admin UIとの相性で比較する。
  - generic parameter governanceは、prompt/rule/config/model/workflowを横断しつつ、営業秘密をUIやDBに出さない抽象schemaにする。
  - Before-Zero設立時期推奨は、入力を抽象カテゴリ、missing/conflicting categories、recommendation status程度から始める。
  - P2以降はDDL適用せず、migration draftから司令塔reviewへ進める。

### 2. Notion側company contentをAMD OSへ正しく移植する

- お願いしたタスク内容
  - Notion側にあるメンバーリスト、history（沿革）、photoをsource of truthとして確認し、AMD OSのcompany contentへ正しく移植する。
  - 現在のAMD OS側メンバーリスト、沿革、photoがNotionデータと全く違うため、差分原因を特定して修正する。
  - UIUX設計だけで止めず、OS内の表示データがNotion現物に合うところまで進める。
- お願いした背景
  - Team ARMADA/AMDの会社情報、メンバー情報、沿革、写真素材がNotion側に残っており、OS内で扱える状態にしたい。
  - ただしメンバー情報や写真は公開可否・利用許諾・内部メモの境界が重要なので、単純移植ではなく情報設計が必要。
  - まさ確認で、現状のcompany contentがNotion現物と一致していないことが分かったため、docs-only設計タスクでは不足。
- 現状どうなってるか
  - 動作状態: urgent data migration worker切り出し。worker pending worktree: `local:d2c81185-1700-4a8a-ba7f-21615d6ebe92`。UIUX設計案worker `019e842b-214c-75c3-92c3-b97ab3e11d5b` とP0 UI/schema mapping worker `019e8433-2854-7bd1-927a-ae46b367a618` は完了報告済み。
  - UIUX設計成果物: `pwa/design/notion_content_migration.md`。
  - UIUX設計commit: `d9216e8 docs: plan notion content migration uiux`。P0 mapping commit: `46e3eb4 docs: add notion content migration p0 mapping`。
  - `/admin/company` は Profile / Team / History / Media / Import の5タブ構成案。`/company` はauthenticated read-only hub案。
  - PJ cockpit差し込みは、関連メンバー・重要history・PJ tagged mediaを薄く出す粒度に限定する案。
  - Notion home/member/history/photo schemaから、既存tableと新table候補へのmapping表を作成済み。
  - 次worker pending worktree: `local:f5e4bcd6-ede0-4c5e-8b7e-10813c0754b5`。
  - 次workerには、P1としてRLS/visibility enum/review gateの設計レビューを依頼済み。DB write/DDL/applyはまだしない。
- 残課題は何か
  - Notion connectorでメンバーリスト、沿革、photoの現物を確認し、OS側DB/UIの現在値との差分を出す。
  - Notion raw bodyやphoto URLsを司令塔報告・公開本文へ貼らず、admin/internal境界を守って移植する。
  - 既存tableで足りる場合はDDLなしで移植し、足りない場合はmigration draftと司令塔判断に分ける。
  - 写真は `usage_permission`、`consent_status`、`storage_bucket`、`storage_path`、`thumbnail_path` を必須候補として扱い、公開可否が曖昧なものは `needs_review` にする。
  - local確認まで行う。push/deploy直前はdeploy bundle付きでまさ承認を取る。承認待ちは `approval pending` とする。

### 3. PJロゴをOS内で活用する

- お願いしたタスク内容
  - 共有ドライブの各PJフォルダに入っているPJロゴをAMD OS内でも活用する。
  - PJリストにロゴを表示する。
  - Notionでやっていたように、文章中にPJ名を書くときもロゴを添えられるようにする。
- お願いした背景
  - PJ名だけだと一覧や文章中で視認性が弱い。
  - ロゴ付きのPJ mentionがあると、Notionのように文脈内でPJを素早く認識できる。
  - Drive上のロゴを使うには、参照権限、保存先、公開範囲、キャッシュ、利用許諾を整理する必要がある。
- 現状どうなってるか
  - 動作状態: 設計/実装worker切り出し。
  - worker pending worktree: `local:25d43997-a1e9-4e66-bb83-63a3ea1aab3a`。
  - workerには、共有ドライブのPJフォルダのロゴ配置をread-only確認し、既存PJリスト・project picker・cockpit headerなどのPJ名表示箇所を調査するよう依頼済み。
  - 可能なら `ProjectLogo` / `ProjectMention` のような小さなUI componentと、既存PJリスト1箇所への導入まで進める。
  - Drive画像の大量取り込み、本番DB write、DDL、保存先確定はまだしない。
- 残課題は何か
  - Driveロゴを直接参照するか、Supabase Storage/Vercel static/publicへ取り込むかを比較する。
  - `project_id` / `pj_code` / `logo_asset_url` / `logo_storage_path` / `source_drive_file_id` / `source_updated_at` / `usage_status` / `visibility` の持ち方を決める。
  - PJ list logo、inline project mention chip、logo fallback、dark/light背景対応を設計・実装する。
  - 著作権・利用許諾が曖昧なロゴは `needs_review` として扱う。

### 4. Dashboard「今週やったこと」の抽出設計を確認する

- お願いしたタスク内容
  - ダッシュボードの「今週やったこと」が、どのデータソースから、どのタイミングで、どのロジックで抽出・表示されているか確認する。
  - UI、API、DB、automation、manual/specのcurrent truthを整理する。
  - 設計と実装がズレている場合や、鮮度が落ちるリスクがある場合は、最小の修正案・次worker案を出す。
- お願いした背景
  - 「今週やったこと」のデータ抽出設計が分からなくなった。
  - Dashboardは毎日見る入口なので、表示されている実績が何を根拠にしているかを司令塔が説明できる必要がある。
- 現状どうなってるか
  - 動作状態: 調査worker切り出し。
  - worker pending worktree: `local:3d6115d0-0c6a-43c4-be9f-3a63440087cc`。
  - workerには、`/dashboard` 実装、関連component/API/lib、DB table、L2/monthly/meeting/proactive/notification/activity系manual/specを確認するよう依頼済み。
  - 確認観点は、UI表示、データソース、「今週」の定義、生成・更新タイミング、欠落リスク、改善案。
  - 原則read-only調査で、DB write/DDL/外部送付はしない。
- 残課題は何か
  - Dashboardの「今週やったこと」が、L2抽出、DB summary、通知、meeting summary、UI側集計のどれに依存しているか確認する。
  - 「今週」の定義がJST週なのか直近7日なのか確認する。
  - Claude routines停止、L2 automation、outbox/applier、timezone境界で欠落しないか確認する。
  - 問題があれば、P0修正案を1つに絞って提示する。

### 5. L2 Claude routine未登録事故を是正する

- お願いしたタスク内容
  - L2抽出をClaude定額token/routine上限内で回す決定済み方針について、実際のClaude Routines UI登録が無かった事故として是正する。
  - `~/.claude/scheduled-tasks/.../SKILL.md` の存在を、Claude routineがACTIVE登録されている証拠として扱わない。
  - docs上の `Codex / subscription automation` など曖昧な表現をやめ、Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron / PWA/Vercel LLM cron禁止を明記する。
  - 完了ゲートに、Claude Routines UI上の存在、`ACTIVE`、`next run`、`last run`、初回dry runまたは手動run evidenceを必須化する。
- お願いした背景
  - L2抽出はClaude定額tokenへ載せる方針だったが、Claude側Routines UIにはroutineが1本も無い状態だった。
  - `amd-os-l2-consolidated-evidence` も実体として確認できず、Claude定額tokenではなく別経路/PWA/API/他automation側に課金・運用負荷が残った可能性がある。
  - まさ確認で「実害が何万円も出てる。洒落にならない」と明示されたため、方針再検討ではなく実装・登録漏れ事故として扱う。
- 現状どうなってるか
  - 動作状態: accident / urgent corrective action。Claude routine実登録は未確認で、docs-onlyやSKILL作成だけでは完了扱いにしない。
  - current truth: Claude Routines UIにroutineが見えない限り、Claude定額routineへ移管済みとは扱わない。
  - `~/.claude/scheduled-tasks/amd-os-l2...l9` などのSKILLは、ローカル手順・素材であり、Claude側ACTIVE登録の証拠ではない。
  - `amd-os-l2-consolidated-evidence` は実体未確認。登録済み/稼働中として扱わない。
  - L2③ MS進捗とL2⑥ MTGフローは、Claude routineではなくMMOマシン Codex Desktop automation維持。
  - push/deploy直前はdeploy bundle付きでまさ承認を取る。この台帳/docs是正の承認待ちは `approval pending` として扱う。
- 残課題は何か
  - Claude側で `amd-os-l2-consolidated-evidence` を実routine登録し、UI上で `ACTIVE / next run / last run` を確認する。対象は L2②④⑤⑦⑨⑩⑪⑫、cadenceは daily 08:00 JST。
  - 別枠routineとして、L2① 月末最終日、L2⑧ 月末L2①後のXRL checklist audit、L2⑬ weekly candidate、L2⑯ 月末最終日17:00 JST Management Monthly Signal Evaluationを登録候補にする。
  - L2①〜⑯のwriter matrixを、Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron / admin reviewのどれかに必ず分類する。
  - PWA/Vercel background LLM cronは復活させない。
  - 課金経路の棚卸しを行い、どの処理がClaude定額に乗っておらず、別課金・別負荷になっていたか確認する。
  - 実登録完了までは、L2 Claude routine移管を完了扱いにしない。

### 6. L2会議サマリ抽出を、MMOマシンで確実に毎時起動させる

- お願いしたタスク内容
  - ZMPの前回会議サマリが自動生成されなかった原因を特定し、同じ事故が起きないようにする。
  - 会議サマリ抽出が、MMOマシン上で毎日09:00-21:00の間に毎時起動する状態へ直す。
- お願いした背景
  - ZMPの会議サマリが抜けていた。
  - 調査すると、会議後にサマリ抽出が走るべき時間帯に、MMOマシン側の抽出処理が起動していなかった可能性が高かった。
  - 会議サマリはBefore Zeroの現場知やTextbook候補の元にもなるため、ここが抜けるとOS全体の地盤が弱くなる。
- 現状どうなってるか
  - 動作状態: active worker。worker thread `019e809e-ce94-7db2-bf55-7da44ff1023d` がCalendar色取得の代替経路とCFG_Alias判定の再評価を担当している。
  - 監視状態: AMD OS未完タスク監視heartbeatで継続監視中。
  - ZMPの対象会議サマリ自体は復旧済み。
  - MMOマシン側の抽出ルールには、会議IDが入っていなくても、タイトル・日時・参加者・関連資料から拾う方針を反映済み。
  - 予約起動の設定ファイルは毎時起動の形に直したが、Codex Desktop本体を再起動しても13:00・14:00に起動しなかった。
  - そのため、Codex Desktop内蔵の予約機能ではなく、Windows側の予約実行機能で確実に起動する方式へ切り替える検討に入っている。
  - Windows側の予約実行の最小部品はMMOマシンに配置済み。まだ毎時の本番稼働は有効化していない。
  - 試験実行では、予約実行から会議サマリ抽出の設計書を読めるところまで通った。
  - 16:00の1回Liveテストでは予約実行から会議サマリ抽出が起動し、対象会議0件で安全に早期終了した。
  - そのテストでは、DBや外部サービスへの書き込み、outbox作成、既存サマリ上書きは発生していない。
  - 実会議がある時のプロジェクト判定に必要な色→PJ設定がMMOマシン側で欠けていることが分かった。
  - main Mac側にある既存設定から、必要な1行だけをMMOマシン側へ値を表示せずに反映済み。
  - 反映時はMMOマシン側の設定ファイルをバックアップし、他の設定はコピーしていない。
  - 書き込みなしの診断で、MMOマシンから色→PJ設定を読み取れることを確認済み。
  - 設定シート側の履歴表と別名表も読めており、代表的な色や別名からPJ候補を解決できることを確認済み。
  - 再認証後も、Google Calendar connector経由では予定一覧・個別予定は読めるが、予定色/default colorは取得できていない。
  - workerは、Connector待ちではなく、GAS Advanced Calendar ServiceまたはPWAのGoogle Calendar API直読みで、event colorを読む診断helperを実装した。
  - まさから「これまでCFG_Aliasで判定できていたはず」という指摘があり、色だけに依存せず、CFG_PJAlias high-confidenceで安全に候補化できる条件へ戻した。
  - `CFG_ColorPJHistory` で色が解ける場合、または `CFG_PJAlias` のexact/regex/bracketed title alias/ASCII whole-token title aliasなら候補化できる。
  - 単なるcontains、project_name substring、client_name substringだけでLive書き込み候補に昇格することは禁止のまま。
  - L6 alias/color helper変更は `2cfccc4 Add L6 calendar color and alias diagnostics` として `origin/main` に反映済み。
  - `【ZeMA】定例MTG` はCFG_PJAlias high-confidenceでZMP/p19 activeへ解ける候補として確認済み。
  - `clasp` のGoogle再認証は司令塔側で実施済み。
  - 再認証後、worker側で `clasp push --force` が通った。
  - MSI側の `NEXT_PUBLIC_GAS_API_KEY` 経路を復旧し、既存PWA WebApp deploymentを更新済み。
  - GAS read-only diagnosticで `【ZeMA】定例MTG` が、明示 `event.colorId` と `CFG_PJAlias high-confidence` の両方でZMP/p19 activeへ解けることを確認済み。
  - exact meeting_id / upcoming rowはなく、EXCLUDE/AMDでもなく、既存良質サマリ上書き対象も見当たらない。
  - 2026-06-03 12:00 JST の監視付き1回Live task `amd-os-l6-meeting-flow-zema-once-live-20260603-1200` を登録済み。StateはReady。
  - 毎時稼働はまだ有効化していない。
- 残課題は何か
  - 2026-06-03 12:00 JST 実行後に、launcher log / last message / exact DB row / outbox / 既存summary上書き有無を確認する。
  - 問題なければ、毎時稼働用の予約をLive化するか判断する。
  - 毎時稼働へ進める場合も、最初の1〜2回は監視してから常時稼働扱いにする。

### 7. L2データ抽出全体を、MMOマシンと現行仕様に合わせて安定稼働させる

- お願いしたタスク内容
  - 香川出張の前後で変更したL2抽出仕様を確認し、MMOマシンへ反映する。
  - 月次報告、プロトコル、進捗、プロジェクト知識、メンバー知識、会議サマリ、スコア根拠、戦略シグナルなどの抽出経路を整理する。
- お願いした背景
  - L2データ抽出はAMD OSの地盤。
  - ここがズレると、コックピット、Textbook、スコア、月次レビュー、通知の全部が弱くなる。
  - 香川出張の間にロジックを少し変えた記憶があり、実機に反映されているか確認が必要だった。
- 現状どうなってるか
  - 動作状態: 復旧済み、自然発火watch。worker thread `019e809e-8588-7ce0-bf69-88710cfd99b5` がL2/Atlas/Macrotrend抽出責任と実行状態を再整理し、backlogを反映した。
  - 監視状態: AMD OS未完タスク監視heartbeatで、2026-06-02朝のL2①次回実行とMMO側outbox増加を継続監視する。
  - MMOマシンには接続でき、主要なL2抽出ルールは反映済み。
  - L2①月次報告はMac側Codex automation `amd-os-l2` をACTIVEへ戻した。次回実行は2026-06-02 05:30 JST。
  - 自然発火前の手動確認では、`amd-os-l2` automation定義、正規outbox、LaunchAgent applier、helper health、DB現物が確認済み。
  - `automation-prepare --ym 202606` でsnapshot refreshに成功し、正規outboxに置いたno-op route-checkは正規applierで `applied/` へ移動した。DB writeは発生していない。
  - Supabase現物として、L2① monthly reports 5件とsource cache 11件が2026-06-01に反映済みであることを確認した。
  - L2②〜⑥はMMOマシンCodex Desktop automationがACTIVEで、2026-06-01朝の実行履歴を確認済み。
  - L2⑦⑧/MS差分・L2⑨・Atlas・MacrotrendはMMO側Codex automationがACTIVE。
  - MMO側outbox backlogはdrain済み。`amd-atlas-2`, `amd-macrotrend-evidence-review`, `amd-os-ms`, `amd-os-strategy-signals`, `amd-os-l6-meeting-flow` のoutbox json countは0。
  - DB/API反映済み: L2① monthly reports 5件、source cache 11件、通知1件。L2⑦⑧/MS差分 registryDiffs 11件、xrlEvidence 20件、revisions 8件、通知35件。L2⑨ strategySignals 3件、通知3件。Macrotrend 12件insert/1件skip。Atlasは既存分重複skip、2026-06-01分はrecent照合で9件存在確認。
  - Atlasは、Codex automationがweb/source searchで一次情報・信頼できる報道・公式発表URLを集め、`atlas_signal_review_tool.mjs` 経由で `atlas_signals` へ入れる。省庁系は別系統で `atlas-collect-policy` のdirect fetch設計がある。
  - Macrotrendは、UN SDGs / WEF Global Risksをbackboneにしつつ、公開source URL付きのmacrotrend evidenceをAtlas signals形式で投入する。LLM非依存のVercel cron `macro-aggregate-indicators` は `observation_log` と `atlas_signals` から `macro_index_log` を更新する。
  - 会議サマリは、会議IDがなくても弾かない方針へ更新済み。
  - 月次報告は、今後は生データを毎回直接見るより、まずOS内に集まった整理済みデータを主入力にする方針へ寄せた。
- 残課題は何か
  - 2026-06-02朝にL2①が自然発火し、automation run、outbox生成、applier反映、monthly reports/source cacheの更新まで通るか確認する。
  - MMO側run statusは保留中表示が多いため、今後もACTIVEだけでhealthy扱いせず、outbox/applied/DB反映まで見る。
  - L2⑥は毎時起動しているが、Calendar色/default color権限問題は別タスクで解決する。

### 8. ERS制度比較マトリクスの実データ入力を進める

- お願いしたタスク内容
  - ERS評価を5段階だけでなく、制度整備状況や規程比較として細かく入力できるようにする。
  - 香川大、KUTE、NIMSなどの実データ入力を進める。
- お願いした背景
  - 大学・研究機関への提案では、単なる点数よりも「どの制度が整っていて、何が足りないか」を比較できることが価値になる。
  - 香川大は次回ヒアリングで一気に確認する項目が多い。
  - KUTEやNIMSは既存資料や公開情報から先に埋められる可能性がある。
- 現状どうなってるか
  - 動作状態: main取り込み済み、確認待ち。worker thread `019e8231-7b00-7a80-b49e-c1070e28d5a8` が実データ入力・取り込み整理を完了した。
  - 制度整備状況や規程比較を入力する枠は実装済み。
  - 本番側の安全設定も見直し済み。
  - 香川大/KUTE/NIMSの制度比較seed 96件と入力記録を取り込み準備済み。
  - 本番DBには対象3機関の制度比較データがすでに96件あり、read-only確認では各機関32件、confirmed_at欠け0件だった。
  - worker成果のmigrationは既存番号と衝突したため、`120_institution_policy_assessments_seed.sql` へ採番変更済み。
  - worker branchには古い台帳差分が混ざっていたため、PR #4はそのままmergeせずclosedにした。
  - docsと冪等seedの安全な6ファイルだけをmainへ取り込み済み。commit: `9f72c50 docs: add ERS policy matrix seed`。
  - runtime変更はないためdeploy不要。
- 残課題は何か
  - 香川大はヒアリングで未確認項目を確認する。
  - KUTEは規程整備ログから埋める。
  - NIMSは公開情報と既存DBから埋める。
  - 今後の新環境再構築時は `120_institution_policy_assessments_seed.sql` を冪等seedとして使う。

### 9. 設計書を「読めば再構築できる」水準まで引き上げ続ける

- お願いしたタスク内容
  - 設計書を、単なる説明ではなく、今のAMD OSを再構築できる水準まで引き上げる。
  - workerが適当な整理で止まらないよう、司令塔が品質を監視する。
- お願いした背景
  - OS開発を複数セッション・複数workerで進めるため、設計書が弱いとすぐに現在地が崩れる。
  - まさが毎回細かく確認しなくても、司令塔が品質ゲートを持つ必要がある。
- 現状どうなってるか
  - PWA画面、データ構造、通知、コックピット、L2の主要領域はかなり補強済み。
  - L2のうち、プロトコル、進捗、プロジェクト知識、メンバー知識、会議フローは再構築しやすい粒度まで進んだ。
  - TextbookやBZMの設計方針も整理されてきている。
- 残課題は何か
  - 管理画面、報酬・請求、GAS、iOS、Atlas、Seeds、VC、Scholarなどはまだ再構築水準に届いていない。
  - 完了扱いにする前に、司令塔が「本当に再構築できるか」を見る。

### 10. TextbookをBefore Zero実践テキストとして育てる

- お願いしたタスク内容
  - OS全体司令塔として、Textbookが単なるBZM理論の解説書ではなく、Before Zeroの現場判断、失敗、仮説修正、関係構築、ケースを扱う実践テキストへ育つよう監督する。
  - 詳細な章構成、候補整理、編集判断はTextbook司令塔の台帳へ分ける。
- お願いした背景
  - Before Zeroの現場では、理論だけではなく、判断の迷い、相手との関係、失敗からの学びが重要。
  - それを残していくことが、ARMADA内の再現性や提案力につながる。
- 現状どうなってるか
  - 動作状態: watch。詳細実装はTextbook司令塔とTextbook台帳側で進行中。OS司令塔は上位方針・本番反映・L2連携だけを見る。
  - Textbook司令塔とBZM司令塔を作成済み。
  - Textbookの方向性は「BZMを中核にしたBefore Zero実践テキスト」で確定済み。
  - 実践章の受け皿を追加済み。
  - L2から候補を出し、承認後にTextbookへ反映する仕組みも入り始めている。
  - Textbook/BZMの詳細タスクは、root台帳ではなく、それぞれの担当ディレクトリ配下の台帳へ分ける方針になった。
- 残課題は何か
  - 抽出された知見を、どの実践章へ入れるかの振り分けを整える。
  - 理論変更に関わるものは、BZM司令塔レビューを必ず挟む。
  - 実ケースを増やすときは、秘密情報や固有名の扱いを慎重に見る。

### 11. OS司令塔・BZM司令塔・Textbook司令塔のタスク台帳運用を定着させる

- お願いしたタスク内容
  - 司令塔ごとに、人間が読めるタスク台帳を作る。
  - 各タスクについて「お願いした内容」「背景」「現状」「残課題」を書く。
  - worker報告をそのまま貼らず、司令塔がまさ向けに要約し直す。
- お願いした背景
  - 司令塔が増えると、どこに何を頼んだか見えにくくなる。
  - まさが毎回「今どうなってる？」と聞かなくても、右側のmdを開けば状況が分かるようにしたい。
- 現状どうなってるか
  - AMD OS司令塔の台帳として、この `COMMANDER_TASKS.md` を作成した。
  - 同じrepo内で台帳名が衝突しないよう、root台帳はAMD OS全体司令塔専用にする。
  - BZM司令塔の台帳は `pwa/bzm/COMMANDER_TASKS.md` へ分ける方針になった。
  - Textbook司令塔の台帳も、Textbook正本ディレクトリ配下へ分ける方針になった。
  - BZM台帳には、未完タスクあり・全worker停止を禁止するheartbeat運用ルールを反映済み。main取り込み済み commit: `69faea2 docs: add BZM commander heartbeat rule`。
  - BZM台帳は2026-06-04のVercel approval gateへ更新済み。local commit: `e34be20 docs: update BZM Vercel approval gate`。push/deployは `approval pending`。
  - Textbook台帳にも同じworker継続監視ルールを反映済み。main取り込み済み commit: `4ac3a2d docs: add Textbook commander heartbeat rule`。
- 残課題は何か
  - BZM/Textbookの詳細タスクは、それぞれの台帳を正本として見る。
  - 今後のタスク追加、worker切り出し、完了報告、差し戻しのたびに台帳更新を徹底する。

### 12. 最新mainの新規変更を司令塔として読み直す

- お願いしたタスク内容
  - origin/mainに新しく入った変更を、司令塔として読み直して current truth へ反映する。
- お願いした背景
  - この台帳作成時点で、ローカルmainよりorigin/mainが進んでいる。
  - `proactive`や研究機関アクセス設計など、別worker由来の新しい変更が入っている。
  - 司令塔が古い認識のまま進めると、タスク判断を誤る。
- 現状どうなってるか
  - 台帳作成用のclean worktreeは最新origin/mainから作成した。
  - ただし、新規変更の中身はまだ司令塔レビューとして十分に読めていない。
- 残課題は何か
  - 最新mainの新規変更を読み、OS全体の方向性・リスク・次タスクへ反映する。
  - 既存のdirty main worktreeを直接触らず、clean worktreeで確認する。

## 完了済みタスク

### 1. Dashboard / PJ Cockpit の TODO UI を整理する

- お願いしたタスク内容
  - Dashboard上部の「今日打つべき一手」とPJ Cockpit側の「先手キュー」を「TODO」に統一する。
  - Dashboardは未送信/要対応だけ最大3件に絞り、注目カードと一覧の重複をなくす。
  - TODOクリック時は遷移ではなく、発生経緯、成果物、履歴、次アクションが分かるモーダルを開く。
  - 既存TODOかんばんは新TODO UIと競合しないよう主要導線から外す。
- お願いした背景
  - 同じTODOが重複表示され、件数が増えるとDashboard上部がTODOだけで埋まっていた。
  - 名称がDashboardとCockpitで揺れていて、カードクリック後も状況を思い出す情報が足りなかった。
- 現状どうなってるか
  - `ProactiveQueuePanel` をTODO UIとして整理済み。
  - Dashboardは `blocked`, `queued`, `sent_to_commander` のみを対象にし、期限超過 / blocked / queued / sent_to_commander / priority / due_at の順で最大3件へ絞る。
  - `outbox_id` 重複排除後、先頭の優先TODOと一覧を分離し、同じTODOを二重表示しない。
  - 詳細モーダルに `source_kind/source_id`、`proactive_loop_events` 履歴、artifact refs、外部送付可否、PJ cockpit補助リンクを追加した。
  - HUD cockpit の旧TODOかんばん表示は主要導線から外した。
  - 検証: targeted eslint、`tsc --noEmit`、`npm run build`、`npm run test:critical-ui`、local browser smokeを実施済み。
- 残課題は何か
  - production deployと本番URL確認を完了ゲートで確認する。

### 2. MTGサマリカードにNotion文字起こし導線を追加する

- お願いしたタスク内容
  - MTGサマリや予定MTGカードから、Notion文字起こしを始めやすくする導線を追加する。
  - AMD OSからNotion録音を勝手に開始するのではなく、既存NotionページやCalendar予定を開く形にする。
- お願いした背景
  - L6はすでにNotionメモや文字起こしを材料として読める前提になっている。
  - ただし、会議前/会議中にMTGカードからNotion文字起こしへすぐ入るUIがなかった。
  - まさが会議カードを見た流れで、Notion側の文字起こし開始画面へ迷わず行けるようにしたかった。
- 現状どうなってるか
  - MTGサマリの各行と詳細モーダルに、Notion文字起こし導線を追加した。
  - `notion_url` がある会議はNotionページを開ける。
  - `notion_url` がない予定MTGは、Calendar予定を開いてNotion側の文字起こし開始へ進める。
  - MTGサマリ上部に「メモ再読込」を追加し、L6が後からNotion URLや会議IDを補完した後に再取得できるようにした。
  - mainへ取り込み、本番反映まで進める予定。
- 残課題は何か
  - NotionページURLの自動保存や作成をどこまでL6 automationへ寄せるかは後続判断。
  - 本番ログイン後の画面で、導線の見た目と押しやすさを確認する。

### 1. バイタル評価のスコア入力と変動理由を、AMD経営判断に使える形へ直す

- お願いしたタスク内容
  - Management Scoreの「継続」「新規」「方向」がなぜ低いのかを、入力分解して原因を特定する。
  - AMDの経営に関係ない個別PJ情報を除外しつつ、香川大のような会社全体に効く高確度パイプラインは正式根拠に入れる。
  - 表示だけでなく、DB分類、L2抽出、backfill、snapshot再計算まで含めて直す。
- お願いした背景
  - p07/LSTなどの個別PJ情報がAMD会社全体の経営バイタルへ混ざっていた。
  - 一方で、個別PJを除外するだけだと、会社全体に効く契約見込みや提案活動まで落として過小評価する危険があった。
  - 香川大はMTG実施前から高確度案件だったため、MTG後confirmed待ちではなく会社パイプラインとして評価されるべきだった。
- 現状どうなってるか
  - 完了。会社バイタル用の分類列をDBへ追加し、本番適用済み。
  - 香川大/KUTE/NIMS/SX/CXの会社level high-confidence pipeline/capacityを targeted backfill した。
  - L2/まさえいMTG signal proposal/validatorを修正し、company / project / cross_project を分類するようにした。
  - 個別PJの技術・実験・設立・顧客論点は会社バイタルから除外し、会社全体の売上、契約見込み、営業パイプライン、資金繰り、人員稼働、資源配分だけを入れる方針にした。
  - 香川大は、202605の新規pipeline根拠として正式反映済み。見込み額、見込み月、確度、会社スコア軸をpayloadに持つ。
  - 202605/202606を本番DBで再収集・再計算済み。
  - 202605は、新規が75まで回復した。以前の100寄りは古いraw材料が残った過大評価も混ざっていた。
  - 202606は、新規21、継続14、方向15。6月データの薄さと、方向軸のOS導入/研究機関partner/fund/graduation入力不足が主因。
  - commit `8ba4a86 Fix management score company vital scope` が `origin/main` に入り、production deploy済み。
- 残課題は何か
  - このタスク自体は完了。
  - 後続候補として、方向軸のpartner評価を会社level strategy signalからどこまで拾うか、OS導入実績を正式テーブルで持つか、入力なし月を0点ではなくunknown扱いにするかを別タスクで判断する。

### 2. Managementページで予実管理と先3か月キャッシュ判断ができる状態にする

- お願いしたタスク内容
  - Managementページの月次試算表そのものを、予算と実績が同じ表内で並んで比較できる予実管理表へ進化させる。
  - 売上計、売上原価、粗利、固定費、社保、臨時収入/支出、営業利益、融資実行、借入返済、税金などの各項目で、月ごとに予算・実績・差額または達成率が読めるようにする。
  - 5月に実際いくら入金され、いくら支払い、予算との差がどこで出たかを見えるようにする。
  - 当月の着地見込みと、先3か月の入金・支払い・資金の谷を判断できる画面にする。
  - CTB 202604分の入金済み反映、202605支払通知書の送付済み・振込済み反映も整理する。
- お願いした背景
  - Managementページの目的は、単月黒字ではなく、入金タイミングのズレや先3か月の資金繰りを判断することだった。
  - まさが特に求めているのは、添付の月次試算表で予算値と実績値が並び、予算との差をその場で読めること。
- 現状どうなってるか
  - 動作状態: complete。差し戻し対応worker thread `019e808b-5b8d-7841-9e8e-53fbe6cd0666` が、月次試算表そのものを予算/実績/差額で読める表へ修正した。
  - 前回実装では `/management-score` にキャッシュ判断パネルを追加し、202605実績、202606当月見込み、202606〜202608の先3か月キャッシュ予測を表示できるようにした。
  - freee PL売上、入金確認済み、支払通知書送付済み、実績差引、通常月キャッシュフロー、最低現金残高、未確認アラートは出している。
  - CTB 202604と202605支払通知書のOS反映も実施済み。
  - commit `44bb784 feat(management): show actual cash outlook` が `origin/main` に入り、Vercel production `amd-os-pwa` へdeploy済み。
  - 差し戻し対応では、キャッシュ判断パネルを補助として残しつつ、下部の `GasMonthlySimulationPanel` を月ごとに `予算` / `実績` / `差分` の3列が横並びになる構造に直した。
  - 数字色は、予算をグレー、実績を黒、差分をプラス水色・マイナスピンクで表示する。
  - 売上計、入金、売上原価、粗利、固定費、社保、臨時収入/支出、営業利益、融資実行、借入返済、税金、月次CF、支払い、キャッシュを同じ表内で比較できる。
  - 未来月は実績欄を `未確定`、過去月で実績sourceが無い欄は `未反映`、source未接続の項目は `未連携` として表示する。
  - 追加差し戻しとして、予算・実績・差分が縦に並ぶ構造ではなく、1か月を3列にして左から `予算` / `実績` / `差分` の順に横並びで読める形へ修正済み。
  - 数字色は、予算をグレー、実績を黒、差分プラスを水色、差分マイナスをピンクで表示する。
  - commit `f8594f6 Improve management budget actual table layout` が `origin/main` に入り、Vercel production Readyまで完了した。
  - production alias `https://amd-os-pwa.vercel.app` は deployment `dpl_Hkd9qKd1ZiFAo9wEHFeoS1icCobM` / `https://amd-os-8zmf0n0z6-armada0130.vercel.app` に向いている。
  - production画面versionは `v0.13.2`。ログイン済みChromeから `/management-score` を確認済み。
  - `2026年1月` などの月headerが `colSpan=3`、下段headerが `予算 / 実績 / 差分` になっていることを確認済み。
  - budget cell color `rgb(127, 135, 146)`、actual cell color `rgb(26, 26, 26)`、negative variance color `rgb(216, 77, 122)`、positive diffの `+19,135` / `+761,610` などの表示を確認済み。
  - source chip `freee PL`、`billing確認済(税込)`、`支払通知書送付済(税抜)` も確認済み。
- 残課題は何か
  - このタスク自体は完了。
  - Management月次試算表の3列予実UIはproduction反映・目視確認まで完了。未解決なし。
  - p19:202605は client入金未確認のため、支払通知/振込情報は反映しつつstatusは維持している。運用を変えるなら別判断。

### 3. PRSモデルを、現行AMD Scoreを壊さず比較/シミュレーション層として実装する

- お願いしたタスク内容
  - BZM司令塔が整理したP×R×S / 9軸候補モデルを、AMD OS上で現行7軸AMD Scoreの置換ではなく比較・試算レイヤーとして実装する。
  - P、R、S、P/R/S内訳、現行7軸との対応、retrofit比較を誤読なく見られるようにする。
- お願いした背景
  - 現行AMD ScoreはMXFモデル寄りのままなので、新モデル候補をOS上で検証したい。
  - ただし、P/R_netのrubricや正式DB schema、BZM教科書の理論更新はまだ確定させない。
- 現状どうなってるか
  - 動作状態: deploy approval pending。BZM一次レビュー後、OS司令塔からmain取り込み・production deploy・認証済み画面確認workerを切り出し、main取り込みまでは完了した。
  - OS取り込みworker thread: `019e8270-2784-74d1-b48e-adb6dfd699cd`。
  - branch: `origin/codex/prs-comparison-layer`。
  - commit: `c101e6c feat: add PRS comparison layer`。
  - main取り込みmerge: `90e10f0 Merge PRS comparison layer`。
  - main追従merge/push: `45a8587 Merge main after PRS comparison layer`。
  - 現在の `origin/main` は `69e0bf3 fix(management): mark future actuals pending` で、`c101e6c` と `45a8587` は祖先として取り込み確認済み。
  - BZM一次レビュー判断: 採用圏内、差し戻し不要。
  - 現行7軸 `calculateAmdScore()` は置換しておらず、PRS計算は `calculatePrsScore()` として独立追加。
  - P/R_netはDB列化せず、retrofit画面の保存しない仮入力に留めている。
  - P/R_net未設定時はscoreを出さず `not enough data` / missing扱いにしている。
  - BZM判断として、現行7軸の正式置換、P/R_net正式rubric、DB本番列追加、全PJ正式retrofit再計算、BZM教科書正式理論更新は今回決め打ちしない。
  - targeted eslint、`npx tsc --noEmit`、`npm run build` は最終統合状態で成功。DB write/DDLなし。
  - Vercel production deployは `api-deployments-free-per-day` quotaで失敗し、production aliasはまだPRS取り込みcommitではない既存Ready deploymentを指している。
- 残課題は何か
  - PRS取り込み分はdeploy bundle候補へ回し、含める変更、除外する変更、local検証、予定deploy回数、push/deploy先、rollback/本番確認方法を `askuserquestion` で提示して承認を得る。
  - deploy bundle承認後に限り、認証済み環境で `/venture-map/amd-score/retrofit` を目視確認する。
  - PRS列/表示、既存7軸非置換、P/R_net仮入力・非保存、画面崩れ/文字切れなしを確認する。
  - P/R_netや理論変更に踏み込む場合はBZM司令塔レビューを必須にする。

### 4. admin裏wikiページを作る

- お願いしたタスク内容
  - adminページに新しく「裏wiki」を作る。
  - AMDメンバー、取引先、クライアントなどの趣味・プライベート・関係性メモを、PJごとにグループ分けして保存できるようにする。
  - UI上で手作業でも追加・編集でき、Codex/えいみが拾った情報を後で投入できるデータ構造にする。
- お願いした背景
  - 取引先やクライアントとの関係づくりでは、仕事上の肩書きだけでなく、趣味・関心・話題・過去の接点などの文脈が重要。
  - ただしセンシティブな個人メモなので、通常PJ画面や外部workspaceには出さず、admin-onlyで閉じる必要がある。
- 現状どうなってるか
  - 動作状態: main取り込み済み、production追従確認待ち。admin裏wiki実装workerが実装・DB適用・main取り込みまで完了した。
  - worker thread: `019e8269-69f6-7be3-9b24-bca052c25754`。
  - branch: `codex/admin-private-wiki` / main取り込みbranch `codex/admin-private-wiki-main`。
  - 実装commit: `32a7835 Add admin private wiki`。
  - main取り込みcommit: `e489f93 Add admin private wiki`。
  - 本番DB migration 121 `private_wiki_entries` は適用済み。seedなし。
  - admin-only API `GET/POST/PATCH /api/admin/private-wiki` と `/admin/private-wiki` UIを追加済み。
  - AdminSidebarに「裏wiki」を追加し、PJ別grouping、検索、filter、追加/編集/archive form、source/confidence表示を実装済み。
  - ローカルのログイン済みChromeで `/admin/private-wiki` を確認済み。title、version `v0.13.0`、sidebar、空データ、追加フォーム表示を確認した。
  - 未ログイン状態は `/auth/login?next=%2Fadmin%2Fprivate-wiki` へredirect確認済み。非admin sessionでは未確認だが、route/API/RLSはadmin guard実装済み。
  - 当時のVercel production deployは `api-deployments-free-per-day` quotaで失敗していた。
  - その後、最新mainはManagement v0.13.2としてproduction Readyまで進んでいるため、`/admin/private-wiki` が本番aliasへ含まれている可能性が高い。ログイン済みadminでの本番URL直接確認は未完。
- 残課題は何か
  - 本番 `https://amd-os-pwa.vercel.app/admin/private-wiki` をログイン済みadminで確認する。
  - 可能なら非adminで拒否されることも確認する。

### 5. コックピット2タブの速度とタブUIを改善する

- お願いしたタスク内容
  - プロジェクトコックピット上部にAMDスコアとXRLグラフを常時表示する。
  - その下に「進捗管理」と「スコア詳細」の2タブを置き、現行コックピット内容とスコア詳細を切り替えられるようにする。
  - スコア詳細タブの表示が遅いので、頻繁に変わらないデータとしてキャッシュし、体感表示を速くする。
  - 2タブは横幅いっぱいを半分ずつ使い、ボタンではなくタブらしい見た目にする。
- お願いした背景
  - コックピットはプロジェクト判断の中心画面なので、スコア推移と詳細根拠を同じ画面で見られる状態を早く使えるようにしたい。
  - 2タブ化自体は本番で確認できたが、スコア詳細のローディングが重く、タブUIも左寄せのボタンっぽく見えていた。
- 現状どうなってるか
  - 2タブ化、スコア詳細の裏読み込み、短時間の再利用、タブを切り替えても中身を保持する改善まで本番反映済み。
  - スコア詳細データは同じ画面内で再利用され、時間が経った場合も表示済み内容を保ったまま裏で取り直す。
  - API側にも短時間のブラウザ再利用設定を入れた。
  - タブUIは横幅いっぱいの左右2分割になり、クリック領域も半分ずつになった。
  - 本番画面で、バージョン表示、横幅2分割タブ、スコア詳細本体、2回目表示で読み込み表示が出にくいこと、上部グラフ常時表示を確認済み。
- 残課題は何か
  - 個別タスクとしては完了。
  - 補足として、デプロイ補助スクリプトが本番URLをうまく拾えないことがあり、これは別の改善候補。

### 3. NIMSカードをPJコックピット化する

- お願いしたタスク内容
  - 新しいNIMS用PJを別に作るのではなく、既存ダッシュボードのNIMSカードをPJコックピットへ進化させる。
  - NIMSについて、MS進捗管理とMTGツリーを使えるようにする。
- お願いした背景
  - まさは当初「NIMS用のPJを立ち上げる」と考えていたが、すでにダッシュボード上にNIMSカードがあることに気づいた。
  - 既存カードを活かせば、重複PJを作らずに、NIMSの進捗と会議履歴を追える状態にできる。
- 現状どうなってるか
  - まさが見ているNIMSカードは、ダッシュボード下段の研究機関リスト側のカードだと特定済み。
  - 新規NIMS PJは作らず、既存NIMSカードからNIMS専用コックピットへ入る導線を追加した。
  - NIMS専用コックピットの中では、既存関連PJであるCX/CryoXのコックピット情報を使い、MS進捗、月次、MTG履歴を追える形にした。
  - 月別のMTGツリーも追加し、各会議から通常PJコックピットのMTG詳細へ行けるようにした。
  - 本番DBへの書き込みや新規NIMS PJ作成はしていない。
  - mainへ取り込み済みで、次回mainデプロイでもNIMSコックピットが消えない状態になった。
  - 本番URLでも、NIMSコックピットがログイン導線まで載っていることを確認済み。
- 残課題は何か
  - 個別タスクとしては完了。
  - 今後NIMS固有の進捗項目やMTGが増えたら、既存CX/CryoXとの関係を崩さず追加する。

### 4. KUTE月曜りりMTGカードをコックピットに出す

- お願いしたタスク内容
  - 2026-06-01のKUTE月曜MTGカードがKUTEコックピットに出ていない原因を特定する。
  - 原因を特定したうえで、KUTEコックピットにMTG予定カードを生成する。
  - カードには、りりへの共有目的、直近やること、KUTE側で作成済みの資料リンクを入れる。
- お願いした背景
  - まさは月曜にりりとKUTE作業整理をする予定。
  - そのMTGカードが出ていないと、りりに何を共有し、何から着手してもらうかの導線が弱くなる。
  - KUTE司令塔からOS司令塔へ、原因調査とカード生成の依頼が来た。
- 現状どうなってるか
  - Calendar予定は存在していたが、KUTEコックピットに表示される予定カードは未生成だった。
  - 予定名にKUTEとAMDが両方入っていたため、OS側の自動判定がKUTEの予定かAMD全体の予定か迷い、カード生成をスキップしていた。
  - KUTEのプロジェクトだと明示したうえで、KUTEコックピットのMTG欄に予定カードを生成済み。
  - カードには、MTG目的、直近作業、KUTE側で作成済みの5つの資料リンク、Calendar/Meet情報を入れた。
  - KUTE司令塔へも完了報告を転送済み。
- 残課題は何か
  - 個別カード生成は完了。
  - 再発防止として、今後は `[KUTE]` のようなプロジェクト略称を、`AMD` という一般語より優先して判定する改善が必要。

### 5. ZMPの前回会議サマリを復旧する

- お願いしたタスク内容
  - ZMPの前回会議サマリが生成されていなかった原因を調べ、必要なら生成させる。
- お願いした背景
  - まさが、ZMPの前回会議サマリが無いことに気づいた。
  - 会議サマリが抜けると、L2データや月次レビュー、Textbook候補にも影響する。
- 現状どうなってるか
  - 対象の会議は特定済み。
  - サマリは復旧済み。
  - 関連するNotion側の紐づけも補完済み。
  - 原因は、会議後に抽出処理が走るべき時間帯に、MMOマシン側の会議サマリ抽出が起動していなかったことだと判断している。
- 残課題は何か
  - 個別復旧は完了。
  - 再発防止は「L2会議サマリ抽出を確実に起動させる」タスクで継続する。

### 6. BZM司令塔とTextbook司令塔を作る

- お願いしたタスク内容
  - OS司令塔の下に、BZM司令塔とTextbook司令塔を作る。
- お願いした背景
  - BZM理論とTextbook編集は、それぞれ独立した判断軸が必要。
  - OS司令塔だけで全部を見ると、理論品質と編集品質の両方が薄くなる。
- 現状どうなってるか
  - BZM司令塔とTextbook司令塔は作成済み。
  - BZM司令塔は理論の一貫性、過剰一般化防止、式や用語の変更ゲートを見る。
  - Textbook司令塔は実践テキストとしての章構成、ケース配置、読み物としての流れを見る。
- 残課題は何か
  - 司令塔作成自体は完了。
  - 今後は、それぞれのタスク台帳運用を定着させる。

### 7. worker報告運用をworker quiet modeへ更新する

- お願いしたタスク内容
  - 旧「worker完了・停止・要判断時は担当司令塔へ必ず能動報告」運用を廃止し、worker quiet modeへ更新する。
- お願いした背景
  - 能動報告を必須にすると、親司令塔チャットがworkerの進捗・中間報告・自己判断完了報告で流れ、current truth確認が重くなるため。
- 現状どうなってるか
  - 2026-06-03以降、workerは原則として親司令塔チャットへ進捗・中間報告・自己判断の完了報告を送らない。
  - workerスレッド内でまさが「完全に完了」「OK」「これでよし」等と明示した後、1回だけ親司令塔へ最終closeoutを送る。
  - 例外は、UU conflict、未分類dirty、権限/破壊的操作/外部判断、同じblocking conditionで進行不能など、司令塔側の介入が必要な場合のみ。
- 残課題は何か
  - 今後のworker promptから旧能動報告必須ルールを削除/上書きする。
  - 司令塔側はheartbeat/read_threadで静かに確認し、台帳にはActive workerあり、worker id、状態、次回確認条件、まさ要判断だけを短く残す。
