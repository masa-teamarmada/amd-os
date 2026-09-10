---
name: amd-os-l11-question-extract
description: AMD OS の論点・仮説タブ向け、つくよみ書き漏らし検出の正本。毎日、前日以降の project_meeting_summaries.narrative_md と既存の project_questions / project_actions を意味で照合し、木に無い問い・やることだけを PJ あたり最大5件、親候補と理由つきの outbox JSON にする。DBへ直接書かない。
---

# つくよみ 書き漏らし検出

## 役割

会議の記録から論点・やることを全部作り直す処理ではない。会議中または当日に人が「論点・仮説」タブへ書く運用を前提に、**議事録にはあるのに木へ書かれていないものだけ**を毎日拾う。

- writer: Codex automation `4-35`（毎日 04:35 JST）
- input: 前日 00:00 JST 以降の開催済み `project_meeting_summaries.narrative_md`
- output: `/Users/masa/.codex/automations/amd-os-l11-question-extract/outbox/*.json`
- consumer: 非LLM LaunchAgent `jp.teamarmada.amd-os-question-tree-outbox-applier`（5分ごと）
- apply: `pwa/scripts/apply_question_tree_outbox.mjs`
- UI: PJワークスペース「論点・仮説」上部の「つくよみが拾った、まだ木に無いもの」

抽出側は Supabase の GET だけを使う。POST / PATCH / DELETE / SQL、PWA write route、Slack・メール・通知送信は禁止。DBへの反映は outbox consumer だけに任せる。

## 動く前に読む

1. `/Users/masa/projects/AGENTS.common.md`
2. `AGENTS.md`
3. `pwa/spec/3-21-question-tree-current-spec.md`
4. `pwa/manual/2-9-question-tree.md`
5. `pwa/design/db_schema.md` の `project_meeting_summaries`
6. `pwa/scripts/apply_question_tree_outbox.mjs`
7. `/Users/masa/.codex/automations/4-35/automation.toml`

## Phase 0: 実行環境と日付

作業場所は `/Users/masa/projects/AMD/amd-os-automation-runtime`。最初に `git pull --ff-only origin main` を成功させる。失敗時は古いSKILLで続行せず、outboxを作らず終了する。

`pwa/.env.local` から `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` をプロセス内だけで読む。秘密値を表示・報告・ファイル保存しない。

基準日はJST。検索開始日は「実行日の前日 00:00 JST」の `YYYY-MM-DD`。終了は実行時点。前回の実行が失敗していても、毎回この窓を読み直す。

## Phase A: 議事録と木を読む

### A-1. 対象議事録

次を `meeting_date` 昇順で読む。

```text
project_meeting_summaries
  ?meeting_date=gte.<JSTの前日YYYY-MM-DD>
  &narrative_md=not.is.null
  &select=meeting_id,project_id,meeting_date,title,narrative_md,source_hash,source_url,source_kinds
  &order=meeting_date.asc
```

ローカルで次を除外する。

- `source_kinds` が `none` / `upcoming` / `upcoming_tentative`
- `narrative_md` が空、または見出しだけで具体的な記録が無い
- `project_id` が無い

議事録本文は比較の間だけ使う。outboxへ全文を写さない。

### A-2. PJごとの既存データ

対象PJごとに次を読む。

```text
project_questions?project_id=eq.<PJ>&select=id,parent_id,title,background,question_kind,status,answer,review_state,proposal_reason,origin_ref,client_token,deleted_at
project_actions?project_id=eq.<PJ>&select=id,title,detail,action_kind,status,review_state,proposal_reason,origin_ref,client_token,deleted_at
```

使い分ける。

- `review_state='accepted'` かつ `deleted_at IS NULL`: 現在の木。意味の照合と親候補に使う。
- `review_state='proposed'` かつ `deleted_at IS NULL`: すでに提案中。意味が同じなら再提案しない。
- `deleted_at IS NOT NULL`: 以前「いらない」と判断されたものを含む。意味が同じなら拾い直さない。

親候補に使えるのは、accepted かつ未削除の `project_questions.id` だけ。

## Phase B: 意味で書き漏らしを判定する

議事録の各記述を、現在の問い・やること・提案中・却下済みと意味で照合する。単語が違うだけの言い換えは同じものとして扱う。

### 出すもの

- 答えが必要な、新しく生じた論点・仮説・決めること
- 問いへ答えるための、新しく生じた確認・測定・調査
- 決まったことを実行する、新しく生じた作業
- 議事録に主語・対象・行為が明記され、既存の木に同じ意味が無いもの

### 出さないもの

- `next_actions` や「次の一手」の全件転記
- 既存行の言い換え、進捗報告、完了報告、日付や担当だけの更新
- すでに提案中、または過去に「いらない」とされたもの
- 会話のアイデア、雑談、一般論、根拠のない推測
- 「分かったこと」だけの行。本ルーチンの対象は問いとやることだけ
- どの既存の問いの下に置くか説明できないもの

PJあたり、問いとやることの合計で最大5件。6件以上ありそうなら、次の順で5件へ絞る。

1. 会議で明示的に新しく発生した判断・阻害要因
2. 期限・担当・次の確認が具体的なもの
3. 上位の問いを前へ進めるもの

親候補は必須。問いは `proposedParentId`、やることは `proposedQuestionId` に accepted / 未削除の問いIDを1件入れる。問いは `proposedContribution` も `required` または `alternative` から必ず入れる。`proposalReason` は「議事録のどの記述から拾い、既存のどの問いの下が妥当か」を1〜3文で書く。

## Phase C: outboxを作る

候補が0件のPJには何も作らない。空JSON、穴埋め候補、通知は作らない。

候補があるPJごとに1ファイル作る。いったん `/Users/masa/.codex/automations/amd-os-l11-question-extract/staging/` に保存し、検査後だけ `outbox/` へ移す。ファイル名は `<YYYYMMDD-HHmmss>-<projectId>-question-gaps.json`。

```json
{
  "generatedAt": "2026-09-11T04:35:00+09:00",
  "source": "codex-automation",
  "projectId": "p21",
  "sourceRef": "question-gap-daily:2026-09-10",
  "questions": [
    {
      "title": "問いの文",
      "background": "議事録から必要最小限に圧縮した前提",
      "questionKind": "open",
      "ownerLabel": null,
      "dueDate": null,
      "originRef": "project_meeting_summaries:<meeting_id>",
      "proposedParentId": "<acceptedな既存問いのUUID>",
      "proposedContribution": "required",
      "proposalReason": "書き漏らしと親候補の理由",
      "clientToken": null
    }
  ],
  "actions": [
    {
      "title": "やること",
      "detail": "方法や条件。無ければnull",
      "actionKind": "measure",
      "ownerLabel": null,
      "plannedEnd": null,
      "originRef": "project_meeting_summaries:<meeting_id>",
      "proposedQuestionId": "<acceptedな既存問いのUUID>",
      "proposalReason": "書き漏らしと親候補の理由",
      "clientToken": null
    }
  ]
}
```

`ownerLabel` と日付は議事録に明記された時だけ入れる。推測で担当者や期限を作らない。記録上の主語がまさでも、担当を自動確定せず `ownerLabel: null` とし、理由へ「記録上の主語はまさ。担当は承認時に確認」と書く。

保存後、次を行う。

1. `node pwa/scripts/question_tree_outbox_tokenize.mjs <staging JSON>` で、PJ・根拠・種類・正規化した内容から決定的なUUIDを入れる。
2. `node pwa/scripts/apply_question_tree_outbox.mjs --dir <staging dir> --dry-run` を実行する。
3. JSONの候補数とdry-runの「問い + やること」が一致し、除外0・重複0なら `outbox/` へ移す。
4. 一致しなければoutboxへ移さず、stagingに残して失敗理由を報告する。

同じ議事録と同じ意味の候補は同じ `clientToken` になる。consumerはDBの既存tokenを先読みしてからPOSTするため、同じファイルの再実行、前回適用済み、却下済みを二重に入れない。

## Phase D: 報告

次だけを短く報告する。

- 対象になった議事録数 / PJ数
- outboxを作ったPJと、問い・やることの件数
- 意味重複、提案中、却下済みとして除いた件数
- stagingに止めたファイルと理由

議事録本文、秘密値、個人情報、長い抜粋は報告しない。候補0件は正常終了。

## 禁止

- 議事録から全TODO・全論点を作る
- 文字列一致だけで重複を判定する
- PJあたり6件以上出す
- 親候補・理由なしで出す
- `review_state='accepted'` や `parent_id` を直接書く
- Supabase / PWA APIへの書き込み、SQL実行
- Slack、メール、通知の送信
- raw議事録をoutbox・ログ・報告へ残す
