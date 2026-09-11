# 次セッション引き継ぎ: ゴールツリー Phase 0（到達点・MSの型、ガント新構造、SX/ZMPの木の組み直し）（2026-09-11 時点）

cwd: `/Users/masa/projects/AMD/amd-os`

## 読む順

0. **正規checkout `/Users/masa/projects/AMD/amd-os` は本流より50件以上遅れていて、この引き継ぎで参照するファイル（3-22 等）が手元に無い。** 最初に `git fetch` し、使い捨てクリーンクローンを作って、以降のファイルはそのクローンで読む・書く（作り方は下の状態スナップショット）。正規checkoutは読み書きしない。
1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. AMD横断memory `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md` の **I節**
4. `pwa/spec/3-22-goal-tree-plan.md` **全文**（設計正本。まさ確定済み。特に §3 型、§4 会議中と会議後、§5 MSリストとガント、§6 ptの配り方、§8.1 SXの切り直し案、§14 3-21/2-9 の改訂点）
5. `pwa/spec/3-21-question-tree-current-spec.md` 全文と `pwa/manual/2-9-question-tree.md`（現行の木の正本。Phase 0 で改訂する）
6. `pwa/spec/3-16-project-weekly-control-current-spec.md` の「2026-09-09 現行ガント契約」「2026-08-04 現行ガント契約」「ガント直接編集とマイルストーン配置」節（ガントの密度・操作の引き継ぎ元）
7. `pwa/design_log/sessions_2026-09.md` の 2026-09-10「問いの木」節と 2026-09-11 の3節（移行の手順、`npx supabase db push` が使えない理由、書き漏らし検出の経路、設計相談の経緯）
8. 報酬に触る場面が来たら `pwa/manual/7-1-reward-calc-spec.md` と `pwa/spec/3-10-l2-ms-progress-current-spec.md` を全文（hook が拾い読みを止める）。**Phase 0 では触らない。**

## 状態スナップショット（2026-09-11 時点）

- 設計はまさ確定（骨格、予備50%、余りはシーズン合算で獲得pt比、検収実績への切り替え、Slack配信を既定、支払済み残作業は pt 0、SXの到達点直下は5本、CEO業務は定常継続、pt配分の暫定値）。正本は 3-22。**担当・期限・ptの割り振りは、ゴールツリーの構造に沿ってつくよみが提案し、PMが承認する（まさ確定 2026-09-11。人が手で全PJぶん付ける運用にはしない）。ガントは日程だけ。** 0-1 と 0-2 は本流に入った（25a73334 / 9902586b）。
- 本番DB: 問いの木のテーブル（`project_questions` / `project_actions` / `project_findings` / つなぎ3つ）は稼働中。SX（p21）は問い28・やること50、ZMP（p19）は問い37・やること70。`review_state='proposed'` の受け皿と承認/却下API、つくよみの書き漏らし検出（daily 04:35 JST、outbox → LaunchAgent applier）は本番稼働中。
- 旧 `project_management_*` は読むだけ。ガントはまだ旧構造（`project_management_tasks`）で動いている（3-21 の残作業①）。
- 9/9 の「NewCo設立」ツリー（根1 + 条件4 + 子12）は `project_actions` に「やること」として存在する。設立の停止条件2件（有償PoC口頭合意 / 出資口頭合意）は旧テーブルで論理削除済みで、どこにも生きていない。
- SXの現行シーズンMS（`PC-p21-202604`、120pt、13本）は Phase 0 では触らない。切り直しは Phase 1 で `/admin/ms-overview` の保存前支払検算を通して行う（8.1）。
- git: `main` 一本。**正規checkout `/Users/masa/projects/AMD/amd-os` は 50件以上 behind で、別セッションの未コミット38件と未push2件がある。触らない。** 使い捨てクリーンクローンで作業する:

```sh
git clone --reference-if-able /Users/masa/projects/AMD/amd-os --branch main --single-branch https://github.com/masa-teamarmada/amd-os.git <scratchpad>/amd-os-clean
```

  push直前に `git fetch` して `HEAD..origin/main` が0件であることを確認する。今日は同じ領域（問いの木）を別セッションが動かしていた。push前に `git log --oneline HEAD..origin/main` の中身を必ず読む。
- Vercel: pwa配下の変更は1push=1deploy。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。`BUILD_VERSION` を上げる（前セッションが忘れて、まさに「反映されていない」と見えた）。

## Phase 0 の作業単位（この順で。1単位=1commit=1push）

### 0-1. 型の追加（DB）

- `project_questions.question_kind` の CHECK に `goal` / `milestone` を追加する。**根だけ `goal`、`milestone` は `goal` の直下だけ**。DB trigger と API の両方で検査する。
- `project_question_milestones`（`project_id`, `question_id`, `milestone_id` = `value_milestones.milestone_id`）。多対多。Phase 0 ではテーブルだけ作り、行は Phase 1 で入れる。
- `project_actions` に `estimated_pt numeric(6,1)`, `accepted_pt numeric(6,1)`, `accept_state text`（`unassigned` / `assigned` / `accepted` / `negotiating`、既定 `unassigned`）, `accepted_at`, `accepted_by`, `reviewed_at`, `reviewed_by`, `review_result text`（`accepted` / `returned`）。担当が付いたら `assigned` へ。
- `project_action_owners`（`action_id`, `member_id`, `share numeric`、既定は均等）。既存の `owner_label` は表示互換で残す。
- migration は `ios/supabase/migrations/2026091xHHMMSS_goal_tree_phase0_*.sql`。**`npx supabase db push` は使わない**（ローカルにあってリモート履歴に無いmigrationが20件以上あり、pushすると巻き込む）。MCP の `apply_migration` で1本ずつ当て、列と制約を readback する。
- 検査: 既存行が新しい CHECK を通ること（`question_kind` の既存値は変えない）。
- **0-1b（追加、2026-09-11 まさ指摘の反映）**: 割り振りの提案用の列を `project_actions` に足す。`proposed_owner_ids text[]`（`members.member_id`）、`proposed_due date`、`proposed_pt numeric(6,1)`、`assign_proposal_reason text`、`assign_proposal_state text`（`none` / `proposed` / `accepted` / `edited`、既定 `none`）。起票提案の `review_state` / `proposal_reason` とは別物。提案は確定値（`owner` / `planned_end` / `estimated_pt`）に触らない。

### 0-2. ゴールツリーの画面（論点・仮説タブ）

- 「子を追加」の種類に **到達点**（根にだけ出す）と **MS**（到達点の直下にだけ出す）を追加。他の種類は 3-21 のまま。
- 到達点行と直下のMS行は、他の問いと区別がつく表示にする（3-21 の色の意味は増やさない。行の左の印か字体で）。
- **未アサインの印**: `accept_state='unassigned'`（担当か期限が空）のTODO行に印。3-21「上部へ抜き出さない」に従い、行の中で示す。
- 会議中の追加は種類とタイトルだけで保存できること。担当・期限・ptは任意で、必須にしない（まさ確定「会議中にアサインしない」）。
- 名称: 正本と設計書では「ゴールツリー」。**画面のタブ名は「論点・仮説」のまま**にし、まさへ「タブ名を変えるか」を確認事項として残す。
- 判定・並び・色・モーダル・ドラッグは 3-21 のまま変えない。
- **割り振りは人が手で付ける運用にしない**（まさ 2026-09-11「いちいち手作業で全PJこれをやれるわけない」）。担当・期限・見積ptは、つくよみが提案しPMが承認する（3-22 §4）。Phase 0 で作るのは**その器**: 未アサインのTODO行に提案値（担当・期限・見積pt・根拠）を薄く表示し、行の「採用」で確定、値を直してから採用もできる。ヘッダーに「提案 n件をまとめて採用」。手入力の欄（見積pt・期限・担当）は提案を直すための入口として残す。提案を作る側（つくよみ）は Phase 1 の最初の単位。

### 0-3. ガントを新構造へ

- 左列＝ゴールツリー（到達点 → MS → 論点 → TODO）、右列のバー＝TODO（`planned_start` / `planned_end`）。旧 `project_management_tasks` ベースのガントを置き換える。
- **日程未設定行**: 日程が無いTODOをまとめて出し、ここでは日程だけを付ける。担当・見積ptはゴールツリー側（0-2）で付ける。新しい一覧画面は作らない。
- 前後関係は `project_action_dependencies`（既存、`finish_to_start` のみ）。
- 密度・操作は 3-16 の現行ガントを引き継ぐ（行高48px、詳細は重畳モーダル、値を押すとその位置だけ入力欄、依存線は「＋」ポート、mobile は縦一覧）。
- SX（p21）と ZMP（p19）で確認。他PJも同じコードで動くこと。

### 0-4. SXとZMPの木の組み直し（データ）

- SX: 到達点「2027年4月1日にNewCoを設立し事業を開始している」を根に1本。直下に5本のMS（`question_kind='milestone'`）: ユニットエコノミクスと売上アドオンの検証 / 出資の確約 / NewCo体制案確定 / 愛媛大との諸手続き完了 / SIERのMOU締結。既存の論点27件・やること50件を 8.1 の表に従って付け替える（`parent_id` の付け替え。`project_question_actions` で複数に効くものはそのまま）。9/9 の「NewCo設立」ツリーのやること17件は、対応するMSの下へ。支払済みMSの残作業（チーム全体の設計、役割・最低エフォート決定、登記事項の最終合意、資本政策の更新、候補先との連絡の継続）は `estimated_pt=0` で登録する。
- ZMP: テーマ4つ（KR経営改革 / 水素循環 / OkuDoor運営 / OkuDoorシステム）を到達点に、現行MS10本のうち状態で書かれている6本を直下のMSに。既存の論点37件・やること70件を付け替える。
- 手順は 9/9 の再編と同じ: **変更前にJSON snapshotを Drive の該当PJ日付フォルダへ退避**し、migration（seed）で入れる。削除はしない（付け替えだけ）。付け替え前後で件数が一致することを readback する。
- 付け替えで迷うものは、勝手に決めずに「未接続」のまま残し、まさとPM（かる・あび）が画面で置く。

### 0-5. 3-21 / 2-9 の改訂

- 名称をゴールツリーに統一。型（goal / milestone）、判定に「未アサイン」「受託待ち」「検収待ち」を追加（受託・検収の動作自体は Phase 2）。「上部へ抜き出さない」は維持。2-9 に「会議中は種類とタイトルだけ。アサインは会議後にPMがまとめて（ガントの日程未設定行）」を追記。
- 3-22 の §14 に列挙してある。実装と同じ commit で。附則（`spec/6-1`, `manual/9-3`）に日時つきで追記。

### 0-6. 検査と本番反映

- 型0件、`npm run build`、`npm run test:critical-ui`、question-tree 関連の既存テスト、参照系キャッシュ契約（ツリー・TODOは可変系のまま）。
- 実寸1440pxで SX と ZMP の論点・仮説タブとガント。横スクロールなし、コンソールエラー0。スマホ幅は対象外。
- `deploy.sh` で本番反映。`BUILD_VERSION` を上げる。本番で `/project/p21/workspace` と `/project/p19/workspace` を認証付きで確認。
- `pwa/design_log/sessions_2026-09.md` に節を追加し、`HANDOFF.md` の I節を更新する。

## Phase 0 の完了条件

SXとZMPの論点・仮説タブで、根に到達点、直下にMS、その下に既存の論点・TODOが1本の木で見え、担当か期限が空のTODOに印が出て、ツリーのTODO行に割り振りの提案を表示して採用できる器（列・表示・採用ボタン）があり、ガントの左列がその木で日程を付けられる。本番反映済み。3-21 / 2-9 改訂済み。

## Phase 0 でやらないこと

- `value_milestones` と報酬計算（7-1）、月初合意（3-14）に触らない。SXのMS切り直し（8.1）は Phase 1。
- 通知を送らない（Slack配信は Phase 2。対人通知は既定OFF）。
- 旧 `project_management_*` の撤去（まさ確認後）。
- つくよみの役割（書き漏らしだけ拾う）を変えない。
- ptの見積・確定の運用開始（Phase 1）。Phase 0 は列と入力欄だけ。
- **つくよみの割り振り提案（担当・期限・見積pt）の automation は Phase 1 の最初の単位。** 経路は書き漏らし検出と同じ（Codex automation → outbox → LaunchAgent applier → 提案で止める）。Phase 0 では器だけ作る。

## 運用ルール（このPJで確立済み）

- 使い捨てクリーンクローンで作業。正規checkoutの別セッションdirtyに触らない。push前に fetch と `HEAD..origin/main` の中身確認。
- workerは haiku / sonnet。fable / opus を使わない。
- 本番データを触る前に控えを取る（2026-09-10 並び替えの事故）。
- 「できない」と言う前に3つ試す。ブラウザ承認は device code。
- まさへの報告は画面で何が変わったかから。判断点は骨格→詳細の順で出し、設計の合意前に判断点を先出ししない（2026-09-11 の教訓）。

## まさへの確認事項（実装中に出す）

- タブ名を「論点・仮説」から「ゴールツリー」に変えるか。
- 付け替えで迷った論点・やること（未接続のまま残したもの）の置き場。
