# 次セッション引き継ぎ: SX / SolvioraX Slack 取り込みとコックピット Slack タブ（2026-09-09 時点）

cwd: `/Users/masa/projects/AMD/amd-os`

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. AMD横断memory `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md` の **G節**
4. `pwa/manual/2-3-pj-cockpit.md`「Slack タブ」節（製品仕様の正本）
5. `pwa/design/L2_DATA.md` の 2026-09-09 の3行（取り込みとタブの設計正本）
6. `pwa/BUGS.md` 末尾3件（今回の教訓）
7. 実装の細部と捨てた案が要るときだけ `pwa/design_log/sessions_2026-09.md` 2026-09-09 節

## 状態スナップショット（2026-09-09 時点）

**本番反映済み・未解決なし。** 実画面 `/project/p21/cockpit?tab=slack` で確認済み。

- 取り込み: 毎朝6:00 JST の `/api/cron/slack-source-sync`（別セッションが 2026-09-06 `be85ea5b` で実装、LLM非使用）。今朝も 06:27 に稼働を確認。
- 取り込み対象は `project_slack_sources`（`project_id` × `workspace_key` × `channel_id`）が正本。SX（`p21`）は有効4件:
  - `armada` / `C093DQ4D04W`（team ARMADA の `#p21_sx`）
  - `solviorax` / `C0A7MEDSLJH`（`00_全体_連絡`）
  - `solviorax` / `C0APH4XMEJ3`（`01_定例`）
  - `solviorax` / `C0BAK1ZH88N`（`20_商談_アポ`）
- 無効6件（`enabled=false`、つくよみも不在）: `10_技術開発 C0A79EP15DM` / `poc推進 C0A7QT0S89Y` / `90_psi事務局 C0AQ26U0UN8` / `99_雑談 C0AQ26Z96N8` / `30_poc_顧客開発 C0AQBFM4BS5` / `30_poc_事業_顧客開発 C0AQSSE0Y3A`
- SolvioraX Slackアプリ「つくよみ」: `A0BV7LLTD8S`（team `T0A7JFY6U9H`、bot user `U0BV1EB4DDH`）。スコープは `channels:history` / `channels:read` / `channels:join` / `groups:history` / `groups:read` / `users:read`。**`chat:write` は無い＝投稿できない。**
- トークン: Vercel production の `SLACK_BOT_TOKEN_SOLVIORAX`（2026-09-09 にまさが手で更新）。`armada` は従来の `SLACK_BOT_TOKEN`。
- git: `main` 一本、未pushなし。本セッションの反映は使い捨てクリーンクローンから push した（正規checkoutは別セッションの未コミット差分があり `deploy.sh` の clean tree 検査で止まるため）。
- **正規checkout `/Users/masa/projects/AMD/amd-os` は behind のことがある。** 着手前に `git fetch` と `git log --oneline -5 -- <対象ディレクトリ>` を必ず読む。別セッションの dirty（`bzm/`、`pwa/src/components/cockpit/CockpitBusinessPlan.tsx` 等）には触らない。

## 次にやること（優先順）

### 1. まさが石原先生の許可を取ったら、技術開発チャンネルを戻す

まさ 2026-09-06「おれが入ってないということは、BOTだけ勝手に入れるわけにもいかんわ。先に許可とってからにしよう」。9/9 に一度「技術開発のも取り込んで」と言われたが、直後に同じ理由で取り消された。**許可が取れたと明言されるまで着手しない。**

許可が出たときの手順（10分）:

```sh
# 1) つくよみを対象チャンネルへ参加させる（TOKEN は Vercel の SLACK_BOT_TOKEN_SOLVIORAX）
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  --data "channel=C0A79EP15DM" https://slack.com/api/conversations.join
# 2) 取り込み対象へ戻す
#    update project_slack_sources set enabled=true where project_id='p21' and channel_id='C0A79EP15DM';
# 3) 当月と直近月を collect（CRON_SECRET は pwa/.env.local）
curl -s -H "authorization: Bearer $CRON_SECRET" \
  "https://amd-os-pwa.vercel.app/api/sources/slack/collect?projectId=p21&ym=202609&save=1&maxMessages=500"
```

技術開発の6〜7月分41件は既にDBにあるので、有効化するだけで読める。ただし**90日を過ぎた分は名前解決も全文も入らない**（取り直せない）。

### 2. 取り込みが止まったときに気づける導線（未着手・提案止まり）

Slackタブ右上に「最終取り込み」を出したが、**タブを開かないと気づけない**。まさへ提案済みで未決:「Slackから何件、いつまで取れてるか」をコックピットの目に付く場所か通知に出す。`project-workspace.ts` が `evidenceBySource`（source別の件数と最終観測日）を既に計算しているが、**どの画面からも参照されていない**（`grep evidenceBySource` でUI参照ゼロ）。ここを使えば安い。

### 3. 画像の保存（まさ判断待ち）

Slackの画像実体URLは認証必須なのでOSに表示できない。ファイル名とSlackへのリンクまでが現状。**90日で消えるので、画像もOS側へ保存するかはまさの判断**。要ると言われたら保存先（Supabase Storage か Drive）と容量の話から。

## このPJで確立済みの運用ルール

- **Slackの全文は `metadata_json.text_full` へ、`content_text` は700字snippetのまま。** L2抽出が読むのは `content_text` なので、全文保存でLLMへ渡す量とトークン消費を増やさない。この分離を崩さない。
- **取り込みにLLMを使わない。** `src/app/api/cron/**` で従量課金LLMに触れると `check_llm_spend_gate_contract.mjs` が本番反映前に落とす。
- **参照系の読み取りは必ずクライアント層経由。** `/api/slack/messages` は `lib/slack/slack-messages-client.ts` からだけ呼ぶ（`check_reference_data_cache_contract.mjs` が検査）。
- **migration は `db push` が使えない。** リモート履歴23件がローカルに無い状態なので、Supabase MCP の `apply_migration` を使い、同じSQLを `ios/supabase/migrations/` にもファイルとして残す。`migration repair` は勝手にやらない。
- **環境変数を変えたら再デプロイまで。** Vercelの環境変数は既存デプロイに効かない。Deployments → 対象 → Redeploy（「Use existing Build Cache」ではなく最新の Project Settings で作り直す方）。
- **認証情報の受け渡しはまさに頼む。** ブラウザとローカルの間でクリップボードが繋がらない（BUGS 参照）。トークンを会話へ貼らない。
- **UI変更後は本番画面を実際に開いて確認する。** `tsc --noEmit` と契約テストだけで完了と呼ばない。
