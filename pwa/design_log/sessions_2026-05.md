# Sessions Log — 2026-05 (AMD OS PWA)

PWA セッションの作業ログを月単位で集約。
仕様は `SPEC_pwa.md`、バグは `BUGS.md`、直近の引き継ぎは `HANDOFF_pwa_rebuild.md` を参照。

> ⚠️ **2026-05-30 に月内分割**。このファイルが 1万行/835KB まで肥大し、全セッションで `tool call could not be parsed` エラーを多発させた (Edit/Read に巨大文字列が渡りツール呼び出しの JSON が壊れる) ため、過去分を part に切り出した。
> **運用ルール: このファイルには直近分のみ追記する。本体が ~3000行 / ~300KB を超えたら、古い分を次の `sessions_2026-05_partN.md` に切り出して本体を縮める。** これは「気をつける」ではなく肥大したら必ず実施する構造ルール。次月以降の `sessions_YYYY-MM.md` も同じ。

## 📁 過去ログ索引 (2026-05)

| 範囲 | ファイル |
|---|---|
| 05-02 〜 05-13 | [`sessions_2026-05_part1.md`](sessions_2026-05_part1.md) |
| 05-14 〜 05-22 | [`sessions_2026-05_part2.md`](sessions_2026-05_part2.md) |
| 05-23 〜 05-28 (#89) | [`sessions_2026-05_part3.md`](sessions_2026-05_part3.md) |
| 05-29 〜 (最新, #90〜) | このファイル（下記） |

過去のセクション参照 (例 `#30` / `#96`) は上記いずれかにある。`grep -n "#NN" sessions_2026-05*.md` で特定可能。
行番号直指定 (`L5582` 等) は分割でズレるので今後は使わず、セクション見出し参照を使うこと。

---

## 2026-05-29 (#90) — Cowork セッション (cowork-eimi) / カレンダー色→PJ判定の無断削除を復旧 + JC色→VSX + 9-3附則新設 + manual 404 真因修正

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。次のえいみ (Codex / 別 Cowork) が読めば把握できるよう残す。

### コンテキスト
- まさ「今日からカレンダーの JC の色を VSX=p26 に割り当てて、設定変えて」から開始。
- 調査の結果、色→PJ判定 (`CFG_ColorPJHistory`) が **#71 の Claude routine 移植時に無断削除**され `project_name` substring match に簡略化されていたと判明。まさ「作ってきた機能が勝手に消されてる」「二度と起きないようにして」「マニュアルに書いてないの?」。
- #71 の実スコープは「L2 抽出を Claude routine に移す」(課金/アーキ移行) で、色判定削除は過去えいみの拡大解釈だった (= 設計 md `l2_extract_claude_routine.md:240` は「color+alias を Supabase に移植して残す」と明記していた)。
- まさ確認: L2⑥ の現役ランナーは **(B) Windows Codex Desktop `amd-os-l6-meeting-flow`**。Mac の Claude routine (A) は現役でない。

### 実装
- **設定シート** (`CalendarRepo_AMD_OS`, `COLOR_PJ_CONFIG_SPREADSHEET_ID`): `CFG_ColorPJHistory` に `6 | 2026-05-28 | VSX` 追加 (= colorId 6 = JC の橙 を今日以降 VSX に切替、履歴方式で過去予定は JC のまま)。`CFG_PJAlias` に `VasculaX→VSX(100)` / `VSX→VSX(90)`。Chrome で直接編集。
- **コード**: [amd-os-l6-meeting-extract SKILL.md](../scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md) (+ ライブ `~/.claude` 版) の Phase A PJ判定に color→PJ 解決を「色優先」で復活 (色 → title alias → substring の3段)。[next.config.ts](../next.config.ts) の `outputFileTracingIncludes` に `manual/**/*.md` を追加。`.env.local` に `COLOR_PJ_CONFIG_SPREADSHEET_ID`。
- **manual/doc**: [3-2-data-and-extraction.md](../manual/3-2-data-and-extraction.md) に「🎨 カレンダー色→PJ判定 (恒久仕様・削除禁止)」追加。[9-3-appendix-changelog.md](../manual/9-3-appendix-changelog.md) 新設 (附則=append-only 変更履歴) + `manual-chapters.ts` 登録。`AGENTS.common.md` (git外) に「移植・リファクタ時の機能保全」厳格ルール + Cowork memory に `feedback_no_silent_feature_deletion.md`。
- **guard**: [check_color_pj_resolution.cjs](../scripts/check_color_pj_resolution.cjs) 新規 + `package.json` `test:color-pj-resolution` (= SKILL/manual から色判定が消えたら CI で落ちる)。

### Verified
- シート: Drive MCP (ルーティンと同経路) で `6|2026-05-28|VSX` + VSX alias 反映確認。
- guard: `node scripts/check_color_pj_resolution.cjs` exit 0。
- deploy: `v0.8.2` (Vercel 6adnzockb)。まさログイン Chrome で `/manual/9-3-appendix-changelog` が 200 表示・附則テーブル確認。

### Cowork ↔ Codex 衝突メモ
- 並行セッションが**同ツリー**でマニュアル改修 (検索 `manual-search.ts` + Gemini つくよみ Q&A `api/manual/tsukuyomi/ask`、`ManualMapClient`/`[slug]/page`/`manual-data`/`page.tsx`) を進行中。build-info が数分おきに churn、deploy も連続。
- commit は**あたしの分だけ** specific add。並行の純機能ファイル (上記) は触らず未commit のまま残す (向こうが commit する)。
- 9-3 が連続 404 だった真因: あたしの 9-3 未commit + 並行 deploy 上書き + manual 動的化 (ƒ) で md が serverless bundle 未含有。`next.config` の tracing include 追加で**全章の dynamic 404 穴**を塞いだ。

### 次のえいみへ (帰宅後 TODO)
- **task#6**: (B) Windows Codex `amd-os-l6-meeting-flow` の automation.toml に色判定を移植 (= Mac SKILL step7 と同じ color→PJ 解決)。**これをやるまで今日の VSX 自動判定は実際には効かない**。
- **task#4**: B に色判定が入った後、5/25〜の色だけ塗った MTG を backfill。
- **セキュリティ**: `AMD_OS_DB` シートに ScriptProperties 全平文ダンプ (ANTHROPIC/OPENAI/FREEE/SLACK/NOTION 等) → ローテ + 該当タブ削除推奨。

### 関連メモ更新 (Cowork memory)
- `feedback_no_silent_feature_deletion.md` 新規 + `MEMORY.md` index 更新。

## 2026-05-29 (#91) — Cowork セッション (cowork-eimi) / 香川大訪問 議事録の OS 投入 + manual 冒頭に「OS の意義」

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。次のえいみ (Codex / 別 Cowork) が読めば把握できるよう残す。

### コンテキスト
- 2026-05-28 香川大訪問 (VasculaX/p26) の議事録を、Notion 自動議事録が落とした座組み・対価・次ステップを補完して OS に投入する依頼。
- 途中で重要な原則指摘が連続: ①成果物は「行がある/表示される/まさが確認」でなく **えいみ自身が品質を担保**して完了 ②**OS が唯一の正本**で全情報を OS に集約 ③まさは**代表パートナー (CEO不在・特別扱いしない)**、OS は**脱・属人化 (まさ依存を減らす)** のためにある。
- 下川先生への御礼メール返信案も作成 (まさが修正して送信、こちらは送信せず)。

### 実装
- **DB** (PJ=p26):
  - `project_meeting_summaries` 1件 (`meeting_id=manual_eimi:p26:2026-05-28`, `source_kinds=manual_eimi`)。当初 narrative 数行で過少だったため、まさのダンプを漏れなく拾った **3,347字の完全版**に書き直し。
  - `project_strategy_signals` 5件を `candidate` で投入 (funding/partnership/commercial_progress/tech_progress/risk)。
  - `project_founding_members` 4件 (下川/永冨/丸尾/筧、`category=university` = HRL 根拠)。
- **doc**: [pwa/manual/1-1-intro.md](../manual/1-1-intro.md) 冒頭に「OS の意義 (脱・属人化)」を新設。CEO→代表パートナー、「自動意思決定=まさの判断を奪わない」の本末転倒記述を修正、SU 側メンバーを利用者から削除 (OS は社内専用)。→ commit `d979e79` で push 済。
- **ローカル正本** (`~/projects/knowledge/`, git 管理外): `VasculaX.md` 新規、`members.md`/`partner_institutions.md`/`su.md` を訪問成果で更新。`~/projects/AMD/kagawa/2026-05-28_meeting_notes.md` 作成。

### Verified
- DB: `ms=1 / signals=5 / founders=4`、`narrative_len=3347` を SELECT で確認。
- 本番コックピット `/project/p26/cockpit` を Chrome で開き、MTGサマリ詳細モーダルに narrative が整形表示・経営ハイライト5件が「未確認 (candidate)」表示されるのを目視。
- manual は commit `d979e79` で origin/main 反映済。

### Cowork ↔ Codex 衝突メモ
- 並行 codex/別 cowork セッション (`d5efc1d`「カレンダー色→PJ判定 復旧」) が先に #90 を使用 → 本エントリは当初 #90 で commit (`a8d5119`) 後、重複に気づき **#91 に採番し直し**。push は fast-forward 成功・データ損失なし、互いの編集ファイルは非重複 (向こう=3-2/9-3/next.config 等、こちら=1-1-intro/本log)。
- 教訓: 並行時は採番が衝突しうる。push 後に `grep -E "\(#N\)"` で重複確認する。amd-os は `1-1-intro.md` と本 design_log のみ specific add、他の uncommitted は触らず。

### 関連メモ更新 (Cowork memory)
- `feedback_research_keypersons.md`(新) / `feedback_eimi_persona_nonstop.md`(新) / `feedback_verify_by_outcome.md`(→「えいみが自分で品質担保」に改題) / `feedback_masa_role_os_purpose.md`(新) を整備、`MEMORY.md` index 更新。

## 2026-05-29 (codex) — コックピット予定MTG weekly recurring を次回1件に制限 + v0.8.5 deploy

### コンテキスト

- まさ指摘: コックピットの MTG ツリーで、weekly MTG が数か月先まで全部カード化されていてノイズになっていた。
- 要件: weekly MTG は次回分だけ見えていればよい。複数の weekly があるケースでは、それぞれの series ごとに1件ずつ表示する。
- 既に作られた future row も画面で隠す必要があるため、同期 route と cockpit 表示の両方に guard を入れた。

### 実装

- `pwa/src/app/api/meeting-prep/calendar-sync/route.ts`
  - `recurring_event_id` / `recurringEventId` / `recurrence` を受け取り、Google Calendar recurring series を優先 key にする。
  - recurring id が無い場合は `project + title + weekday + JST start time + location` を fallback series key にする。
  - 6〜8日間隔の future occurrence を weekly series とみなし、2件目以降を `weekly_recurring_future_occurrence` として skip。
- `pwa/src/components/cockpit/CockpitMeetingSummary.tsx`
  - DBに既に残っている weekly future row も、series ごとに次回1件だけ残す `keepNextWeeklyOccurrenceOnly` filter を追加。
- `pwa/design/meeting_summaries.md` / `pwa/design/L2_DATA.md` / `pwa/manual/3-2-data-and-extraction.md` / `pwa/manual/8-3-l2-extraction-routines-spec.md`
  - L2⑥予定MTG同期の恒久仕様として「weekly recurring は series ごとに次回1件のみ」を追記。
- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
  - routine が recurring metadata を渡し、weekly は次回1件だけ送るよう明記。
- `pwa/scripts/check_pwa_critical_ui.cjs`
  - `weekly_recurring_future_occurrence` と weekly recurring 設計文言を guard に追加。
- `pwa/src/lib/build-info.ts`
  - `v0.8.5` に bump。

### Verification / Deploy

- `npx tsc --noEmit` pass。
- `npm run test:critical-ui` pass。
- `npm run build` pass。
- Vercel deployment: `https://amd-os-drc9u9qmv-armada0130.vercel.app` / `dpl_H9RG63JndSyL84ks9TazQkcSEXn7` が Ready。
- Production alias `https://amd-os-pwa.vercel.app` が同 deployment を指すことを `vercel inspect` で確認。
- `curl -I -L https://amd-os-pwa.vercel.app/project/p21/cockpit` は login redirect、`/auth/login` HTML の `data-dpl-id` が `dpl_H9RG63JndSyL84ks9TazQkcSEXn7` であることを確認。
- まさが本番画面で「ちゃんとできてた！」と確認。

### 衝突 / 運用メモ

- worktree は並行作業で広く dirty。今回の weekly MTG 差分以外に manual search、L2① monthly report、docs/ip などの未整理差分がある。
- `pwa/src/app/api/dialogue-meeting/narrate/route.ts` は build 中に unrelated syntax issue が見つかり、固定見出しの backtick escape だけ修正した。元の narrative heading 改修は並行作業由来なので、次回は ownership を決めて扱う。
- deploy script は local session が code -1 / no output で切れたが、Vercel 側は Ready。再 deploy せず `vercel inspect` と alias 確認で完了判定した。
- `npm run build` 中に stale `next build` が `.next/lock` を握る再発があり、`ps` 確認後に stale process 終了 + lock 削除で復旧。

## 2026-05-29 (#92) — Codex セッション / マニュアル sidebar 復旧 + MTGサマリ手動修正 + 議事録 narrative 固定 + `/mtg-minutes` skill

### コンテキスト

- まさ指摘: マニュアル章を開くと左のメニューが消える。章ページでもメニューを消さず復活させる。
- まさ要望: コックピットの MTGサマリは「つくよみに修正依頼」ではなく、人間が手動で修正できるようにする。LLM補正に頼らない。
- まさ要望: えいみが今後議事録を作るとき、箇条書きにしない。参加していなかったメンバーにも理解できる文章にする。
- まさ確認: 議事録本文は `🎯背景 → 📊経緯 → ✅決まったこと → ▶️次の一手 → ⚠️残課題` の順で Markdown 化する。
- まさ指摘: 長い prompt を毎回手で打つのは現実的でない。slash で呼べる skill が必要。

### 実装

1. **マニュアル章ページ**
   - commit `f2947fa fix(pwa): keep manual sidebar on chapter pages`
   - `pwa/src/app/(app)/manual/[slug]/page.tsx` を `ManualMapClient` で包み直し、章本文を開いた状態でも左の本文目次 / カテゴリメニューが残るようにした。
   - `BUILD_VERSION` は `v0.7.8`。

2. **MTGサマリ手動修正**
   - commit `6c83fd5 fix(pwa): make meeting summaries manually editable`
   - `CockpitMeetingDetailModal` から「つくよみに修正依頼」ブロックを撤去し、「議事録を手動修正」UIを主導線にした。
   - `POST /api/meeting-summary/manual-update` で `title / summary_short / narrative_md / decided / progress / next_actions / risks` を保存し、`generated_by_model='manual-edit'` にする。`source_hash` は変えない。
   - `pwa/design/FEATURE_REGISTRY.md` / `pwa/design/meeting_summaries.md` / `pwa/manual/2-3-pj-cockpit.md` / `check_pwa_critical_ui.cjs` に手動編集正本化を反映。
   - `BUILD_VERSION` は `v0.7.12`。

3. **議事録 narrative ルール**
   - commit `170b731 fix(pwa): require narrative meeting minutes`
   - commit `0ff8a9f fix(pwa): enforce narrative meeting minutes format`
   - `project_meeting_summaries.narrative_md` を本文正本とし、`summary_short` / `decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助にした。
   - L2⑥ routine と `/api/dialogue-meeting/narrate` の prompt を、箇条書き禁止 + 欠席メンバーに伝わる文章 + 固定5見出しへ更新した。
   - `v7_fixed_heading_narrative` と `blocked_wrong_narrative_headings` を追加し、見出し表記・順序違いを品質 gate で止める。
   - `pwa/CLAUDE.md` / `pwa/design/meeting_summaries.md` / `pwa/design/project_strategy_signals.md` / `pwa/manual/2-2-member-workflows-quick-start.md` / `pwa/manual/2-3-pj-cockpit.md` / `pwa/manual/2-4-amd-cockpit.md` / `pwa/manual/8-3-l2-extraction-routines-spec.md` に同期。
   - 最終 deploy 対象の `BUILD_VERSION` は `v0.8.5`。

4. **Codex slash skill**
   - repo外ローカル skill として `/Users/masa/.codex/skills/mtg-minutes/SKILL.md` と `/Users/masa/.codex/skills/mtg-minutes/agents/openai.yaml` を追加。
   - 呼び出し名は `/mtg-minutes`。メモ貼り付けだけでなく、Notion URL / Notionページ名 / 「Notionの議事録を見て」などの素材指定でも使える。
   - 出力は固定5見出し、本文は箇条書き禁止。正式決定でない内容は「提案として固まったこと」と分かるように書く。

### Verification / deploy

- `npm run test:critical-ui` pass。
- `npx tsc --noEmit --pretty false` pass。
- clean worktree `/tmp/amd-os-verify-0ff8a9f` でも `npm run test:critical-ui` と `npx tsc --noEmit --pretty false` pass。
- deploy script pass。
  - Deployment: `https://amd-os-9cvi9iswi-armada0130.vercel.app`
  - Inspect: `https://vercel.com/armada0130/amd-os-pwa/GzCtmNY6VwVxJYSsgK5t3GhWQpfV`
  - Deployment id: `dpl_GzCtmNY6VwVxJYSsgK5t3GhWQpfV`
  - Production alias: `https://amd-os-pwa.vercel.app`
- `curl -I -L https://amd-os-pwa.vercel.app/manual/2-3-pj-cockpit` は login へ 307 redirect、`next=/manual/2-3-pj-cockpit` 保持を確認。

### Handoff メモ

- `main` / `origin/main` は `0ff8a9f` で同期済み。
- handoff時点で同じ worktree には、manual search / weekly recurring upcoming MTG / L2① monthly reports / docs/ip などの未整理差分が残っている。今回の手動修正・議事録固定とは混ぜない。
- 現在の worktree `pwa/src/lib/build-info.ts` は別作業由来で `v0.8.6` になっているが、本エントリで deploy 済みの functional HEAD は `v0.8.5`。
- `/mtg-minutes` はこの Mac のローカル skill。別マシンで使う場合は同じ skill をコピー / install する。

## 2026-05-29 (codex handoff refresh) — `defcfb5` と本番 weekly-MTG 差分の整合メモ

### 目的

- `/handoff` 呼び出し時点で `HANDOFF.md` / `pwa/HANDOFF_pwa_rebuild.md` が weekly recurring MTG fix を指していた一方、git の `HEAD` / `origin/main` は `defcfb5` だった。
- つまり production `dpl_H9RG63JndSyL84ks9TazQkcSEXn7` は、`defcfb5` 上の未コミット weekly-MTG 差分を含む可能性が高い。
- 次回 clean deploy で production behavior が巻き戻らないよう、handoff に production-ahead-of-git risk を明記した。

### 更新

- `HANDOFF.md` と `pwa/HANDOFF_pwa_rebuild.md` の HEAD 表記を `defcfb5` に更新。
- 「weekly recurring MTG は production verified だが、関連差分は worktree に未コミットで残っている」ことを Repo State / Open Tasks に追記。
- 本 handoff refresh ではコード・DB・manual仕様は変更していない。

### Verification

- `git log --branches --not --remotes --oneline` が空で、未push commit が無いことを確認。
- `git diff --check` pass。

## 2026-05-29 (#93) — Cowork セッション (cowork-eimi) / 過去の箇条書きMTGサマリ 110+件を narrative backfill + 通常MTG用 narrate API 新設

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。#92 (Codex) が「今後の議事録は narrative」という生成ルールを作ったのに対し、本セッションは「既存の箇条書きデータを遡及で narrative 化」を担当した。補完関係。

### コンテキスト
- 発端は「SX コックピットの FC (ファインケム) との MTG モーダルが勝手にブラウザで開いた」というまさの気づき → 別セッション (#92 Codex) の verify 動作と判明
- まさ不満: FC・JAFCO の MTG サマリが箇条書きに劣化し narrative が無い。「せっかくクオリティ高い議事録作ったのに上書きされて消えてる」
- 原因特定: 旧抽出経路 (`gemini-2.5-flash` / `anthropic:claude-sonnet-4-5-20250929` / `(null)` / `codex_manual_*`) が `narrative_md` を作らず箇条書きだけ書いていた。新 L2⑥ は過去 MTG (終了60-180分窓外) を再処理しないため箇条書きのまま凍結。JAFCO は旧 sonnet-4-5 backfill が「まさ(JAFCO)」等の誤りごと上書きしていた
- まさ指示: ①Codex automation は議事録を書き続ける (止めない) ②ただし narrative 形式必須 ③MMOマシンの automation 更新は帰宅後 ④既存の箇条書き全MTGを narrative に書き換え ⑤帰宅後タスクを別セッションでリマインド

### 実装
- **DB**: `project_meeting_summaries.narrative_md` を 110+件 backfill (SX 36 / p06 16 / p19 14 / p20 12 / p07 LiSTie 9 / FC・JAFCO 2)。最終 `with_narrative_total=167`、`real_meetings_still_no_narrative=0`。`source_hash` / `generated_by_model` は不変 (= 抽出経路情報を保持 + L2⑥ 再抽出から保護)
- **コード**: [meeting-summary/narrate/route.ts](../src/app/api/meeting-summary/narrate/route.ts) 新設。dialogue narrate と対称の通常MTG用バッチ narrate (Sonnet 4.6 / 固定5見出し / 箇条書き禁止 = #92 ルール準拠)。`{meeting_id}` 単発 + `{all:true, project_id?, limit?}` バッチ、CRON_SECRET 認証
- **scheduled task**: `amd-os-codex-narrative-upgrade-reminder` 新設 (毎朝9時、帰宅後 MMOマシンの Codex automation narrative 化をプッシュリマインド、完了で自己 disable)

### Verified
- DB: `real_meetings_still_no_narrative=0` / `with_narrative_total=167` を SELECT 確認
- コード: FC/JAFCO/愛大産連/LiSTie 経営会議の narrative をまさが本番目視「クオリティ戻った！」と確認。tsc pass、v0.8.4 で deploy
- backfill 経路: SX〜p20 は narrate API バッチ (Sonnet)、FC・JAFCO と p07 LiSTie 9件は cowork-eimi 直接生成 (Opus) → SQL UPDATE

### Cowork ↔ Codex 衝突メモ
- #92 (Codex) と本セッションは**同じ MTG narrative 領域を並行**。#92 が「生成ルール (L2⑥ prompt / dialogue narrate / 品質gate `v7_fixed_heading`)」、本セッションが「既存データ backfill + バッチ narrate API」= 補完関係
- narrate/route.ts は本セッション新設後、#92 の SYSTEM_PROMPT ルール (固定5見出し・箇条書き禁止) に別セッションが整合させた
- **事故**: narrate route を v0.8.4 で deploy → 直後に #92 系の v0.8.5 deploy が走り、未コミットの narrate route が本番から消えた (POST が HTML を返す)。backfill 後半 (p07) は API 非依存の Opus 手書きに切替えて回避
- **教訓**: 未コミットの新 route は別セッション deploy で本番から落ちる。新 route は早めに commit して保全すべき。`build-info.ts` は #92 系が v0.8.5/v0.8.6 を管理中のため本セッションは触っていない
- **未処理**: narrate route はまだ未コミット (本 handoff で commit する)。L2⑥ routine と「MMOマシンの Codex automation (outbox 系)」が narrative を出すかは #92 と本リマインドで二重追跡中

### 関連メモ更新 (Cowork memory)
- `memory/feedback_mtg_narrative_required.md` 新規 (MTG議事録は narrative が正本、箇条書きは劣化、全抽出経路が narrative 生成すべき)
- `MEMORY.md` に1行追加

## 2026-05-29 (#94) — Codex セッション / L2抽出ルートを「人間が復旧できる粒度」に再整理 + v0.8.10 deploy

### コンテキスト

- まさ指摘: `amd-os-l3-ms-progress-extract` のような処理IDだけでは、MMOマシン automation なのか、課金ルートは何か、止まったらどこを見るのかが人間にもつくよみにも分からない。
- さらに、③ MS進捗だけ直しても、同じ画面範囲にある L2 ①②④⑤⑥⑦⑧⑨ が同じ粒度で説明されていなければ要望未達。まさ「③だけやったから、人間はこの画面範囲全部理解できる状態になったといえるの？」
- MS進捗ロジック自体は、`pwa/src/lib/progress-estimator.ts` と `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` に、5か月MSなら月20%基準 / MS開始前は0% / 成功条件に直結する成果物なしで80%以上にしない、というルールが入っていることを確認した。

### 実装 / doc 更新

- `pwa/manual/3-2-data-and-extraction.md` 冒頭に、L2 ①〜⑨ 全体の「実行場所 / 現行処理 / 課金ルート / 止まった時に見る場所」早見表を追加。
- `pwa/manual/8-3-l2-extraction-routines-spec.md` を、旧 Cloud routine 案の説明ではなく、現行の subscription automation / MMOマシン automation / outbox applier の正本表として再整理。
- `pwa/manual/6-1-operations-settings-spec.md` / `9-1-decisions-and-history.md` / `3-1-system-architecture.md` / `3-3-notifications-and-tsukuyomi.md` / `4-1` / `4-7` / `2-2` / `8-1` / `8-2` / `9-2` / `6-6` / `2-6` など、古い current-looking Cloud routine / ghost / PWA hourly 表記を現行ルートへ同期。
- `pwa/design/L2_DATA.md` と `pwa/design/l2_extract_claude_routine.md` に、Claude routine は履歴であり、現行復旧主導線は実行場所つきの automation 表を見る、という正本を反映。
- `pwa/scheduled-tasks/README.md` に実行場所列を追加。
- `pwa/src/app/(app)/manual/manual-chapters.ts` の 8-3 summary / topic description に残っていた古い `Claude routine` 表記を、MMOマシン automation / outbox-applier 表記へ修正。
- `pwa/src/lib/build-info.ts` を `v0.8.10` に更新。

### Verification / deploy

- `npm run build` pass (`/Users/masa/projects/AMD/amd-os/pwa`)。
- Vercel production deploy pass:
  - Deployment URL: `https://amd-os-lq15f5gi1-armada0130.vercel.app`
  - Deployment id: `dpl_DuETT2yHgf35KZPQsMdp2Jox4MeP`
  - Production alias: `https://amd-os-pwa.vercel.app`
- 最初に `pwa/` から `vercel --prod` した時は、Vercel が repo root 下の `pwa/pwa` を見に行って失敗。repo root (`/Users/masa/projects/AMD/amd-os`) から再deployして成功。
- 最後の deploy script は local session が code -1 / no output で切れたが、`vercel ls` / `vercel inspect` で `dpl_DuETT2yHgf35KZPQsMdp2Jox4MeP` Ready + production alias を確認。`/auth/login` HTML の `data-dpl-id` も同 deployment を指していた。
- stale-current grep: `current truth.*Cloud|現状.*Cloud|現状.*ghost|復旧方針は Claude|Claude routine 復旧予定|Cloud routine \+|Cloud routine L2|Claude routine \`amd-os|ghost 状態。復旧|新規自動取り込みが ghost|Cloud routine 側|Cloud routine 発火|Cloud routine fetch|Cloud routine ->|Claude routine ->|旧 GAS L2 の復旧先` は、履歴として許容される `6-1` 1件のみ。

### 未確認 / 次回

- 本番 `/manual/3-2-data-and-extraction` / `/manual/8-3-l2-extraction-routines-spec` をブラウザで開き、v0.8.10 の表示と Manual Q&A の回答品質を目視するところまでは未確認。
- L2 ⑤ `member_knowledge` の schema gap (`status` / `source_hash` 不在) は未解決。
- 今回は docs/manual/metadata の整合が主。MS進捗の実データ再推定結果 (= DD開始前MSが202604で0%になるか) は DB readback 未確認。次に触るなら `pwa/src/lib/progress-estimator.ts` と `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` を起点に、実行履歴 / `milestone_monthly_progress` を確認する。

## 2026-05-29 (#95) — Codex セッション / OSマニュアル検索 + つくよみ Manual Q&A + deploy rollback 復旧

### コンテキスト

- まさ要望: OSマニュアルに検索機能を追加し、`/manual` だけつくよみフロートを復活させて、Gemini にマニュアル質問へ回答させる形式を試したい。
- 初回 deploy 後、検索欄の場所が分からず、つくよみフロートも出ていなかったため、表示導線を見直した。
- Manual Q&A の初回回答で「この抜粋だけだと」と出て、L2質問にも弱かった。まさ指摘どおり、設計ロジック側の検索/RAG表現がユーザー向けに漏れていた。
- その後、回答内容は改善したが、つくよみフロートが本番から一度消えた。原因は direct dirty deploy 後に GitHub `main` clean deploy が production alias を上書きしたこと。

### 実装 / doc 更新

- `pwa/src/app/(app)/manual/manual-search.ts` を追加し、軽量スコアリングで章タイトル / summary / 見出し / 本文 / 画面パス / table 名を検索できるようにした。
- `ManualMapClient` に「検索ワード」欄を明示し、左カラム・上部のどちらでも検索できるようにした。
- `ManualTsukuyomiFloat` を追加し、`/manual` と `/manual/[slug]` だけ右下に「つくよみに聞く」フロートを出す。global visible mascot は戻していない。
- `POST /api/manual/tsukuyomi/ask` を追加。`requireAuth()` + `GEMINI_API_KEY` + `gemini-2.5-flash` でマニュアル本文だけを根拠に回答する read-only route。DB 書き込み、PJ修正 tool、`tsukuyomi_chat_logs` 保存はしない。
- L2 / 検索などの頻出質問は guide docs を先に含め、日本語 + 英数字結合 token の検索を補強。`monthly_reports` など underscore 入り identifier は code 表示を保護する。
- 回答 UX は、つくよみキャラとして敬語禁止、高校生にも分かる噛み砕き、「ここ見たらOK」の参照章リンクつきにした。「この抜粋」表現は prompt / docs から外した。
- `pwa/design/os_manual.md` / `pwa/design/SPEC_pwa.md` / `pwa/design/FEATURE_REGISTRY.md` / `pwa/manual/1-1-intro.md` / `3-3` / `9-2` / `9-3` に仕様を反映。

### Verification / deploy

- `npx tsc --noEmit` pass。
- `npm run build` pass。
- Chrome authenticated verification:
  - `/manual` に `検索ワード` が 2 箇所表示されることを確認。
  - `つくよみに聞く` float が表示されることを確認。
  - `L2データにはどのような種類がある？` と `L2データってなに？` で、9種類説明、`ここ見たらOK` リンク、underscore 保護、敬語除去、「この抜粋」なしを確認。
- Commit / push:
  - `c06cdd6 Add searchable manual and manual Tsukuyomi Q&A`
  - `origin/main` へ push 済み。
- Vercel:
  - direct deploy 復旧後、GitHub `main` auto deploy でも Manual Q&A 入り build が Ready。
  - handoff中に parallel deploy で production alias が複数回動いた。最後の `vercel inspect https://amd-os-pwa.vercel.app --scope armada0130` では `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` / `https://amd-os-qsfx93eva-armada0130.vercel.app` が production alias。次回は deploy ID を固定せず、必ず inspect し直す。
  - まさが本番画面で「復活した！」と確認。

### 衝突 / 運用メモ

- current branch は `feat/bzm-textbook`。`c06cdd6` は `main` と `origin/main` にも入っている。
- worktree は広く dirty。BZM/IP/ERS/L2/manual など並行作業が残っているので、次回も stage/revert は file-by-file でやる。
- deploy rollback 事故は `pwa/BUGS.md` の `[PWA/manual-qa-deploy]` に恒久メモ化済み。

## 2026-05-29 (#96) — Codex セッション / 入金確認nudge Slack action準備 + GAS invalid_raptで安全弁運用

### コンテキスト

- まさ指摘: 入金確認nudgeの「予定通り入金済み」を押すだけでブラウザが開き、「入金確認をOSに反映したよ」を見る待ち時間が発生するのがUX悪い。
- 望ましい挙動は、Slack上でボタンを押したらそのままつくよみがSlackスレッドに「反映したよ」と返すこと。
- 既存の「金額を入力」は実額・差額メモ用の公開フォームなのでブラウザ導線を残す。

### 実装 / doc 更新

- `pwa/src/app/api/admin/payment-confirm/route.ts` に `POST mode=expected` を追加。signed tokenの予定額で `confirmPaymentGroup` を実行し、HTML遷移ではなくJSONで成功/失敗を返す。
- `pwa/src/app/api/cron/payment-confirm-nudges/route.ts` を変更し、`PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` のときだけ「予定通り入金済み」を Slack interactive action (`payment_confirm_expected`) にする。未設定なら既存URL confirmのまま。
- `gas/80_SlackWebhook.js` は `payment_confirm_expected` を許可し、Slackへ即時ackを返す。
- `gas/081_SlackInteractive.js` は `payment_confirm_expected` workerを追加。action value内のsigned tokenでPWA `POST /api/admin/payment-confirm` を `mode=expected` で呼び、完了後に元DMスレッドへつくよみ返信を投稿する。
- `pwa/design/SPEC_pwa.md` と `pwa/manual/6-4-finance-payment-confirm-spec.md` に、Slack action / `mode=expected` / `PAYMENT_CONFIRM_SLACK_INTERACTIVE` safety flag / GAS deploy順序を反映。
- `pwa/BUGS.md` に、GAS未deployのままPWAだけSlack actionを有効化すると押下不能になる事故パターンを恒久メモ化。

### Verification / deploy

- Current checkout:
  - `npm run lint -- src/app/api/cron/payment-confirm-nudges/route.ts src/app/api/admin/payment-confirm/route.ts src/lib/build-info.ts` pass。
  - `node --check gas/80_SlackWebhook.js && node --check gas/081_SlackInteractive.js` pass。
  - `npm run build` pass。
- Clean worktree `/tmp/amd-os-payment-confirm-action`:
  - `npm ci` 後に同じlint / GAS syntax check / build pass。
  - Clean feature commit: `dc7027a fix(payment): prepare Slack-native payment confirmation`。
  - Branch: `codex/payment-confirm-slack-action`。
  - Draft PR: `https://github.com/masa-teamarmada/amd-os/pull/2`。
- PWA production:
  - 初回はSlack action常時ON版を `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` にdeployしてしまった。
  - GAS deploy失敗後、安全弁 `PAYMENT_CONFIRM_SLACK_INTERACTIVE` default offを入れて `dpl_9jcgL4SRYk97zq7PpsvwhTVSTBVB` へ再deploy。
  - `https://amd-os-pwa.vercel.app` は final safe deploymentにalias済み。
  - `vercel env ls --scope armada0130` で `PAYMENT_CONFIRM_SLACK_INTERACTIVE` が未設定なことを確認。現時点では本番buttonは既存URL confirmのまま。
- GAS:
  - `npx --yes @google/clasp@latest push --force` が `invalid_grant` / `invalid_rapt` で失敗。
  - `npx --yes @google/clasp@latest deployments` も同じ再認証blockerで失敗。
  - GAS worker production deployは未完了。

### 未確認 / 次回

- `clasp login` でGoogle再認証を通す。
- GAS deployment `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` を `clasp deploy --deploymentId` で更新する。
- GAS反映後にだけ、Vercel production env `PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` を設定してPWAを再deployする。
- 最後にSlack実押下で、即時ack、PWA API更新、`billing_cycles.payment_confirmed_at`、`billing_log.action='payment_confirmed'`、つくよみスレッド返信をend-to-end確認する。

### 衝突 / 運用メモ

- current local branchは `feat/bzm-textbook` で、worktreeはBZM/IP/ERS/L2/cockpit/manual/paymentなど広くdirty。`git add .` / broad revert禁止。
- Payment-confirmの実装差分は clean worktree branch `codex/payment-confirm-slack-action` と PR #2 に隔離済み。
- PWAだけを先に本番へ出す場合でも、Slack actionは必ずfeature flagで閉じておく。GAS OAuth再認証が必要なときは、コードを疑ってretry連打しない。

## 2026-05-29 — BZM 教科書 全10章を教科書品質に増補 (Opus, branch `feat/bzm-textbook`)

### 概要

BZM (Before Zero Model) 教科書の既存 10 章が「中身スカスカ」だったため、各章に **worked example (例題)・導出・章末まとめ・練習問題** を追加して教科書品質に引き上げた。コンテンツ正本は `pwa/bzm/*.md`、ページ実装は `pwa/src/app/(app)/bzm/`、レンダラは `BzmMarkdown` (KaTeX)。

### 章ごとの追記内容

- **0-1-preface**: 「各章の構成」節 (例題/まとめ/練習問題 の教育方針説明) を追加。
- **1-1-why-before-zero**: §2.1 同 Valuation 10億・内部状態の違う 2 ベンチャー比較表、§6 まとめ、§7 考察問題。
- **2-1-sigma-su-triple-helix**: §3.3 例題2-1 (σ_SU 幾何平均 vs min: μ=(6,1,2)→42^(1/3)−1≈2.48)、§4.1 例題2-2 (観測モデルから μ_G=14.80/2.75=5.38)、§6.1 まとめ、§6.2 練習4問。
- **2-2-state-space-model**: §5.1 例題2-2 (A_c=[[-0.1,-0.6],[0.6,-0.1]], λ=-0.1±0.6i, T=2π/0.6≈10.5四半期, τ=10; 対称→実固有値→螺旋なし)、連続時間ノート、§8 まとめ、§9 練習4問。※ theory の `state_space_model.md`/`bvar_prior.md` はリポに無いので捏造せず自己完結な例で対応。
- **3-1-xrl-group**: §3.1 例題3-1 (アンカリング表, X≈34.3)、§5.1 まとめ、§5.2 練習4問。
- **4-1-frl-founder-readiness**: §4.1 例題4-1 (ALQ平均7.0→FRL=6.8)、§4.2 感度分析 (ΔFRL=0.2×(8−5)=0.6)、§6.1 まとめ、§6.2 練習4問。
- **5-1-amd-score-integration**: §で誤りだった練習問題 #1 を修正 (詳細は下記バグ)。
- **6-1-retrofit-verification**: §3.4 例題6-1 (2012 setup =133 を再現)、透明性ノート (表値=専門家事前情報による期待値)、§7 まとめ、§8 練習4問。
- **7-1-ers-ecosystem-readiness**: §4.3 例題7-1 (軸7 sub-axes→A_7=0.75, 8軸→ERS=50%)、§7.1 まとめ、§7.2 練習4問。
- **8-1-amd-os-operations**: §4.1 例題8-1 (K再校正: SRL 0.2→0.7→Σα=6.5→K≈0.0316)、§6 Shallow Tech K=1.0 ノート、§10.1 まとめ、§10.2 練習4問。

### 自己発見した不具合 (BUGS.md `[bzm/retrofit-table-inconsistency]` に記録)

- 前セッションの 5-1 練習問題 #1 が「2009 ティエムの score を計算して表の 27 と一致を確かめよ」という再現不能な誤問だった (手計算 ≈78)。retrofit 表の期待値を「再計算できる値」と誤認したのが原因。→ 自己完結な計算問題 (≈581) に差し替え。
- より深い問題: 6-1 retrofit 表の headline score 列は **専門家事前情報による期待値** で、同表の軸値からは再現しない行が複数 (2009/2011/2012-10/2014)。一方 2007/2012setup/2017 は再現する。theory 正本 §335-358 に「表と seed の μ は一致しない/数式は正しい」と明記済み。本文に透明性ノート (B案) を暫定追記。表自体の扱いは **まさの A/B 判断待ち** (A=全行再計算で自己整合 / B=期待値のまま運用)。

### Commit / deploy

- commit `de97c62` (5章増補) → `f35c2b3` (全章増補 + 5-1修正)。`feat/bzm-textbook` に push 済、未 push commit なし。
- `pwa/src/lib/build-info.ts` BUILD_VERSION v0.10.3 → v0.10.4。
- deploy 成功 (`byvyl0ye3`, exit 0, Ready, 約4分)。build 成功 = KaTeX 記法が build 時にパース OK。ただし `(app)` は auth 配下で curl が 307、レンダ後 HTML は未確認 → まさに /bzm 目視を依頼済み。

### 運用メモ / 衝突

- worktree は他セッション (payment-confirm / ERS / L2 / cockpit / manual 等) の dirty を多数含む。`git add .` / broad revert 禁止。今回は `pwa/bzm/*.md` と `build-info.ts` のみ stage して commit した。
- HANDOFF_pwa_rebuild.md は codex の payment-confirm 引き継ぎが正本。BZM の引き継ぎは別途 `pwa/HANDOFF_bzm_textbook.md` に分離 (clobber 回避)。

## 2026-05-30 (#97) — Codex セッション / CTB 202604 請求額・入金予定額 mismatch 修正 + `予定請求額` 概念を廃止寄せ

### コンテキスト

- まさ指摘: CTB の 2026-04 稼働分について、freee 会計の請求書上は `297,000円税込` (= `270,000円税抜`) なのに、AMD OS の予定入金額が `303,428円税込` (= `275,844円税抜`) になっていた。
- まさの違和感: 「budget_reported_amount と言われても分からない」「予定請求額という概念が必要なのか。請求額を入力したなら請求額はその値になるべき」。
- 調査対象は live Supabase、PWA finance/payment-confirm code、請求書発行モーダル、manual/design 正本。

### 調査結果

- `projects.project_id='p06'` が CTB。`billing_cycles(project_id='p06', ym='202604')` は `status='budget_confirmed'`。
- 修正前の live row:
  - `budget_reported_amount=275844`
  - `budget_yen=179299`
  - `budget_buffer_amount=0`
  - `invoice_ym='202605'`
  - `reward_summary_json.monthlyBudget65=179299`
  - `reward_summary_json.capBudgetYen=179299`
- 入金予定計算 (`pwa/src/lib/payment-groups.ts`) が `budget_reported_amount` を優先し、`275844 × 1.1 = 303428` になっていた。
- `source_cache` / `reimbursements` / `billing_log` には `5,844円` の出どころを示す current evidence は見つからなかった。既存 `billing_log` は p06/202604 について空だったため、元入力の監査証跡は残っていない。
- `monthly_reward_payout` は ID007 `112,500` + ID012 `63,000` = `175,500` で、これは `270,000 × 65%` と一致。支払側はすでに正しい金額になっていた。

### 実装 / data 修正

- live Supabase を補正:
  - `budget_reported_amount: 275844 -> 270000`
  - `budget_yen: 179299 -> 175500`
  - `reward_summary_json.monthlyBudget65/capBudgetYen: 179299 -> 175500`
  - `billing_log.action='invoice_amount_corrected'` を追加し、before/after と理由を保存。
- `pwa/src/lib/payment-groups.ts`:
  - freee 発行済み請求書 (`invoice_issued_at` or `freee_invoice_number`) かつ `invoice_base_lines_json` 明細がある場合は、明細合計を税抜請求額の正本として優先。
  - 未発行または明細なしの場合は、確定請求額 (`budget_reported_amount`) を使う。
- `pwa/src/components/cockpit/CockpitRoutineInvoiceModal.tsx`:
  - 請求書明細の初期 fallback を `budget_yen` (= AMD側支払cap) ではなく `budget_reported_amount` (= 請求額) から作るよう変更。互換 fallback としてのみ `budget_yen / 0.65` を使う。
- `CockpitRoutineBudgetModal` / `/payment-confirm` / nudge 表示:
  - UI文言を `予定入金額` -> `入金予定額`、`税抜ベース` -> `請求額（税抜）`、`予算確定` -> `請求額確定`、承認前 `請求額案`、承認後 `確定請求額` へ整理。
- `pwa/src/app/(app)/mypage/page.tsx`:
  - `reported` badge を `申告中` ではなく `承認待ち` に変更。
- 正本更新:
  - `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
  - `pwa/manual/6-4-finance-payment-confirm-spec.md`
  - `pwa/manual/2-3-pj-cockpit.md`
  - `pwa/design/routine.md`
  - `pwa/design/SPEC_pwa.md`
  - `pwa/design/FEATURE_REGISTRY.md`
  - `pwa/src/lib/ui-hints/index.ts`

### Verification

- live DB readback: CTB 202604 は補正後 `expectedNet=270000` / `expectedGross=297000`。
- `billing_log` に `invoice_amount_corrected` が入っていることを readback 確認。
- `rg` で `予定入金額` / `税抜ベース` / `予算申告` / `請求額.*申告` / `再申告` / `申告中` の残存を確認し、該当なし。
- `npx tsc --noEmit` pass。
- `npm run test:critical-ui` pass。
- `npm run build` pass。
- `git diff --check` pass。

### 未反映 / 次回

- PWA production deploy は未実施。worktree に BZM / ERS / L2 / cockpit / manual / payment-confirm Slack action などの dirty 差分が混在しているため、このまま deploy すると今回以外も本番に乗る。
- 次回は finance fix を clean branch / clean worktree に切り出して commit -> deploy -> production で CTB 入金予定額 `297,000円税込` を確認する。

### 運用メモ

- `budget_reported_amount` は列名互換で残るが、業務上の意味は「請求額（税抜）」。別の「予定請求額」は置かない。
- `budget_yen` は AMD 側の支払可能額 / PJ予算であり、クライアントへの請求額として直接使わない。
- finance の数字理由を説明するときは、code + live DB values + `billing_log` を必ず見る。証跡が無い元入力は「復元不可」と明示する。

---

## 2026-05-30 (後半) — BZM データ図 F1/F2/F4/F5 生成・教科書埋め込み・v0.10.7

- **データ図を matplotlib で生成** (`pwa/scripts/bzm_figures.py` → `pwa/public/bzm/f{1,2,4,5}.png`)。F1=σ_SU シフト幾何平均 vs min 律の比較、F2=複素固有値ペアが生む減衰螺旋 (T=12,τ=18)、F4=ERS 8軸レーダー (例題7-1、軸4/5 赤強調)、F5=軸別限界感度 α_i/(X_i+1) と律速軸 (FRL crimson)。
- **F3 (retrofit 時系列) はスキップ**: 実データ未確定で、数値捏造は AGENTS 図捏造禁止に触れるため。実データ確定後に生成。
- **データ図 vs 概念図の切り分け**: 数式・実データからの matplotlib プロットは「正当な可視化」で「画像生成ごまかし」ではない。概念図 (G1 二層構造フロー / G3 Triple Helix 螺旋) のみ外部生成依頼対象、と `design/bzm_paper.md` §3 で確定。
- **埋め込み先**: 教科書 2-1/2-2/5-1/7-1 (各 `![alt](/bzm/fX.png)` + 図番号 blockquote) と論文ドラフト `design/bzm_paper_draft.md` (図1〜4)。`BzmMarkdown` の `img` で描画。middleware matcher は `.png` を auth 除外済 → 静的配信。
- **before-zero/ 場所誤認を恒久修正**: 理論正本 `before-zero/theory/*.md` は実在 (monorepo の外 `/Users/masa/projects/AMD/before-zero/theory/`)。過去要約に「does NOT exist」と刷り込まれ毎セッション誤認 → メモリ `feedback_read_full_theory_md.md` に絶対パスを固定。
- **巻き込みコミット事故**: figure チャンク 11 ファイルが別セッションの `481113f` (cockpit 修正) に混入して push 済み。実害なし・本番反映済みで放置クローズ。詳細 `BUGS.md [git/cross-session-bundling]`。
- BUILD_VERSION v0.10.7、deploy.sh で本番反映成功 (2分59秒)。

## 2026-05-30 (#98) — Cowork セッション (cowork-eimi) / 研究機関 ERS を新設 origin/main へ clean commit (f671edd, v0.10.0)

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。次のえいみ (Codex / 別 Cowork) が読めば把握できるよう残す。

### コンテキスト
- まさから「各研究機関 (香川大 / KUTE / NIMS) が何をできて・何が未整備で・どんな特徴かを OS で記録・スコアリングしたい」と依頼。
- 個体レイヤー (AMD Score) とは別の **苗床レイヤー指標 = ERS (Ecosystem Readiness Score / 機関エコシステム整備度)** として新設。ERS は **加重和 (充足率) で乗算しない**。AMD Score の数式には**絶対に入れない** (二重計上禁止)、σ_SU の μ_A 経由で概念連動するだけ。
- 並行作業ドラマ: まさは別セッションで BZM 教科書を実装したい → このセッションは ERS 専念で確定。fork で作った `feat/bzm` は削除済、まさの BZM ブランチ `feat/bzm-textbook` は残す指示。

### 実装
- **DB**: 4 テーブル新設 (institution / 軸 / サブ軸 criteria / assessment 系)。migration `pwa/scripts/migrations/108_institution_readiness_ers.sql` で適用済。`db_schema.md` を `dump_schema.py` で再生成 (128 tables)。
- **コード**:
  - [ers.ts](../src/lib/ers.ts) / [ers-data.ts](../src/lib/ers-data.ts) — 集計ロジック (normalizeLevel=(lv-1)/4、軸=採点済サブ軸の平均 (N/A 除外)、ERS=採点済軸の加重平均×100)。
  - [institutions/page.tsx](../src/app/\(app\)/institutions/page.tsx) — 機関一覧ヒートマップ。
  - [institutions/[institutionId]/page.tsx](../src/app/\(app\)/institutions/[institutionId]/page.tsx) — 8 軸 SVG レーダー + 軸ごとサブ軸 rubric (Lv1-5)。
  - [InstitutionReadinessList.tsx](../src/components/dashboard/InstitutionReadinessList.tsx) — dashboard 下段に機関一覧を縦積み (上=SU/AMD Score、下=機関/ERS)。
  - [GlobalNav.tsx](../src/components/nav/GlobalNav.tsx) に「研究機関」リンク追加、[layout.tsx](../src/app/\(app\)/layout.tsx) にタブタイトル追加。
- **doc**: 設計正本 [institution_readiness.md](../design/institution_readiness.md) (前セッション作成) を commit に同梱。

### Verified
- `tsc --noEmit` 通過。clean staging worktree (origin/main 起点 detached) に ERS の 12 ファイルだけ再現 → commit `f671edd` (v0.10.0) → `0d1eb0b..f671edd HEAD -> main` push。
- staging で GlobalNav の「研究機関」リンクは **Edit で再現** (= BZM の `/bzm` リンクを除外するため copy せず)、dashboard/layout 差分も ERS-only を verify。`.env.local` 混入なし。

### Cowork ↔ Codex/BZM 衝突メモ
- 共有 working tree は他セッション (BZM / payment-confirm / L2 / cockpit 等) の dirty を多数含む。`git add -A` / broad revert 厳禁。今回も staging worktree 方式で main 汚染を完全回避。
- origin/main の session log は #93 まで。#94-96 (Codex) と BZM の無番号エントリは別ブランチのみ → 衝突回避で本エントリは #97 採番。
- 教訓: 並列セッションでは共有 working tree のブランチを勝手に切り替えない。clean commit は /tmp の detached worktree で。

### 次セッションのタスク
- **実データ投入してスコアリング**: 3 機関 (香川大 / KUTE / NIMS) の各サブ軸を実際に Lv1-5 評価して `institution_assessments` に投入。KUTE は seed 時「※正式名称・タイプ要確認」付きなので確定も必要。

### 関連メモ更新 (Cowork memory)
- `memory/feedback_handoff_commit_push_auto.md` 新規 (handoff は確認待ちせず commit→push まで一気に完遂)

## 2026-05-30 (#99) — Claude Code セッション (eimi) / BZM: AMD Score を P×R×S 3因子に再構成 + F3生成

> Claude Code (CLI) で動いた eimi セッション。BZM 教科書/論文ワークストリームが、図作成から **AMD Score の根本モデル進化**に発展。モデル議論の正本は `knowledge/before_zero_theory.md` (monorepo 外)。

### コンテキスト
- 「BZM 教科書/論文を継続」で開始。当初は F3 retrofit図とデータ拡充の予定
- まさが「ティエム retrofit に頼りすぎ」「DTSU は VC 頼り切らずライスワークで自走が肝」と問題提起 → AMD Score の構造そのものの再設計に発展
- まさの因果修正: 「2つの TRL は根幹でなく、自走性を高めた結果」。えいみの (i)ライン別案・DCFの割引率r は撤回。まさ「批判的視点を入れろ、迎合するな」明示で是々非々で議論

### 実装
- **図**: [bzm_figures.py](../scripts/bzm_figures.py) に `fig_f3()` 追加 (theory §9 軸値の自己整合再計算、設立133→仮想2017 2861≈22倍)。`public/bzm/f3_retrofit_timeseries.png`。教科書 [6-1](../bzm/6-1-retrofit-verification.md) §3.2・論文 [bzm_paper_draft.md](../design/bzm_paper_draft.md) §4.2 に埋込。v0.10.8 deploy・本番配信200確認
- **論文**: 付録A/B/C を self-contained 化 + §4.2 に表1 (ティエム時系列)
- **新モデル試算**: [prxs_retrofit_test.py](../scripts/prxs_retrofit_test.py) 新規。現行7軸に P(潜在規模)+RW(ライスワーク実益)を足した9軸(A案)。ティエム史実(RW=0) vs 商社案(RW立ち上げ)で2017に4.2倍差を可視化 (全て仮値、retrofit校正前提)
- **正本化(monorepo外)**: `knowledge/before_zero_theory.md` に新章「P×R×S 3因子再構成」(AMD Score = P潜在規模 × R到達度=XRL群 × S生存確率=σ_SU×FRL×RW、生存条件式 B−R_net≤F)。`knowledge/tiem.md` に相互リンク
- **是正**: 経営知識/モデル議論を `pwa/design/bzm_retrofit_cases.md` に書いた AGENTS.common 違反 → knowledge へ移管し design 側削除
- **HANDOFF**: [HANDOFF_bzm_textbook.md](../HANDOFF_bzm_textbook.md) を P×R×S 反映で全面更新

### Verified
- F3 本番配信 200・tsc/build 通過・v0.10.8 deploy 成功。prxs 試算スクリプト実行成功 (検証PNGは非配信)
- 全 commit main に push 済 (`8712ad6`→`da5cb7e`)

### Cowork ↔ Codex 衝突メモ
- セッション中に別セッションが `feat/bzm-textbook` を main にマージ+削除 (main直運用へ) → 以降 main で個別 add→push に切替、巻き込みなし。build-info は別セッションが v0.10.9 に bump

### 関連メモ更新 (memory)
- `feedback_graphs_matplotlib.md` 新規 (グラフは matplotlib 統一。まさ「クオリティ高い、毎回これ使って」2026-05-30)

## 2026-05-30 (#99 後半) — Claude Code (eimi) / BZM: データ収集→収益化指数確定→XRL原典準拠実装

> #99 の続き。P×R×S モデルを「データ収集→定義の線引き確定→本番OS実装」まで前進。モデル議論の正本は `knowledge/before_zero_theory.md` (monorepo外)。

### モデル確定事項 (まさ判断、knowledge/before_zero_theory.md に正本化)
- **収益化指数 (R_net) — 軸名・定義確定**: 旧「ライスワーク実益/RW」廃止 (RW2文字は2変数の積と誤読、ライスワークは系統I連想)。正式名「**収益化指数**」、中身は R_net=事業が生む純キャッシュ貢献。**系統I(つなぎ事業)/系統II(本命の先行収益)を区別しない** (理由①収益あれば系統問わず生存↑ ②系統IIはR軸も上げるのでモデルが自然に差を吸収)。生存条件式 B−R_net≤F
- **創薬RW=0問題**: 創薬は型確立+大EXIT+大Pで S を別ルート確保→RW=0でも大差にならない。SをRW一本に依存させない (まさ見解)
- **時点=経時で見る** / **反実仮想は別軸で重要** / **多元スケール=別指標でなく重みを変えるだけ** (まさ方針)

### データ収集 (捏造せず L2 + Web + 口述)
- 全9PJの P(潜在規模)/収益化指数/XRL を収集。各PJ `knowledge/{pj}.md` の「P（潜在規模）」節に Web市場調査を出典付き記録
- **`knowledge/LST.md` 新規作成** (論文9PJだが md 欠落していた。p07, 設立2023-07-06, Before0, UMI打診→星野CEO/まさCOO/2年弱体制構築)
- jc/BWE/KT/yd/tiem/ctb に口述+Web反映。誤報告訂正 (BWE/SX の md は最初から正しかった=サブエージェント抽出ミスを鵜呑みにした)
- **判定 rubric v0.1** `knowledge/xrl_rubric.md` 作成 (後に原典準拠実装で OS 側に移行)
- 9PJ横断 retrofit スクリプト [prxs_9pj_inputs.py](../scripts/prxs_9pj_inputs.py) (設立時点・根拠付き0-9化)。ティエム(P最大でもTRL0でScore最下位級)・CTB(RW=0でも中位)がまさ直感どおり再現

### XRL 原典準拠実装 (本セッションの主成果)
- **原典PDF** (共有ドライブ ARMADA/a1_all/データベース/XRLの元文献.pdf = 内閣府SIP2023公募要領 図2-6) を読込
- 既存 [xrl-level-definitions.ts](../src/lib/xrl-level-definitions.ts) は前任の創作 (原典に無い語・全軸9段階) で**間違い** → 原典完全準拠で全面書換え
  - **TRL/BRL=9段階、GRL/SRL/HRL=8段階** (後者は慶應栗野研提案)。label/description は原典文言そのまま。`maxLevel` で軸別段階数。`exit_criteria` 廃止→各レベルに観測 `checklist[]` (原典description分解)
- **DB**: [migration 109](../scripts/migrations/109_amd_score_xrl_checklist.sql) で `amd_score_inputs.xrl_checklist` (JSONB) 追加・適用済。形式 `{axis:{level:[bool,...]}}`
- **UI**: [XrlChecklistPanel.tsx](../src/components/venture-map/XrlChecklistPanel.tsx) 新規。スコア詳細ページ ([AmdScoreView.tsx](../src/components/venture-map/AmdScoreView.tsx)) の FrlAlqPanel 下に設置。5軸タブ→レベル別チェック→達成レベル自動算出(積み上げ式)→保存でupsert+XRL生値上書き。運用=えいみ初期入力→まさ修正 (Tsukuyomi不使用、まさ指示)
- [CockpitXrlDetailModal.tsx](../src/components/cockpit/CockpitXrlDetailModal.tsx) と [tsukuyomi/chat/route.ts](../src/app/api/tsukuyomi/chat/route.ts) を新定義に追従 (exit_criteria→checklist)
- **全11PJ初期投入** [seed_xrl_checklist.mjs](../scripts/seed_xrl_checklist.mjs): 各PJ最新評価行の現在XRL値のfloorを達成レベルとし、そのレベル以下の全項目true。項目数は定義ファイルから機械抽出。まさ確認「現実との乖離は意外と少ない」

### Verified
- tsc/build 通過・v0.11.3 deploy 成功 (build-info は後に別更新で v0.11.4)。全11PJ投入 11/11 OK・SQLで検証 (p06 TRL6→Lv1-6全true 確認)
- 全 commit main push 済 (`df4534a`→`44a904d`)

### 次セッションへの申し送り (まさ指示、HANDOFF_bzm_textbook.md にも記載)
- **#1 スコア詳細ページが HUD版に汚染**: 現状UIはHUD版側に新設し、通常版スコア詳細ページを別途実装
- **#2 スコア詳細をコックピットに移植**: コックピット上部のAMDスコアグラフ+XRLグラフは常時表示、その下を「進捗管理」「スコア詳細」2タブに。現状表示は進捗管理タブ、スコア詳細ページ中身を丸ごとスコア詳細タブへ。スコアクリックで出る「スコア内訳」モーダルは完全廃止

---

## 2026-05-30 (#100) — Cowork セッション (cowork-eimi) / ERS 評価入力マトリクス UI + 比較ヒートマップ転置・単色濃淡

> #98 で新設した研究機関 ERS のセッション (タイトル "Ecosystem institution scoring system") がエラーで落ちたため、別 Cowork セッションで継続。過去トランスクリプト (`~/.claude/projects/<proj>/<uuid>.jsonl`) を読んで文脈復元 → 実装まで前進。

### prod 表示問題は解消済みだった (調査結果)
- 元セッション末尾の課題「prod で `/institutions` が見えない (真因 = BZM 枝がデプロイされ ERS コミットを含まないデプロイずれ)」は、**`bfd4b55` (Merge feat/bzm-textbook into main) で既に解消済み**だった。ERS のコード・migration・データは main + 本番に乗っており、ログイン後に `/institutions` ヒートマップが正常表示されることを確認。残課題ではなかった。

### 実装 (本セッションの主成果)
- **評価入力マトリクス** `/institutions/assess` (page.tsx) 新規 (admin)。各サブ軸を Lv1-5 の 5 行に展開し各レベルの rubric をフル表示、右の各機関列はチェックボックスのみ。1 つにチェック=そのレベル、どの Lv にも未チェック=N/A (軸平均から除外)。各サブ軸末尾に根拠メモ行 (インライン)。変更は 1 セル即保存 (楽観更新)、ERS リアルタイム再計算。ヘッダ行・左列 sticky。
  - UX 変遷 (捨てた案): 初版は「列=機関/行=サブ軸、各セルに Lv1-5 ボタン + rubric ツールチップ」→ まさ指摘「ツールチップ UX 悪い／各レベルを行で分けて基準を全部見せてチェックだけ」で行展開型に刷新。
- **書き込み API** `POST /api/institutions/assess` (route.ts) 新規。admin 判定 → institution_assessments を当日分で onConflict(institution_id,criterion_id,evaluated_at) upsert。スキーマ変更なし (既存テーブルへの書き込みのみ)。
- **比較ヒートマップ** `/institutions` を転置 (行=8軸〔左に番号+軸名+対応XRL〕/列=機関)、最上部に総合 ERS 行を大フォント太字で強調、セルを indigo 単色濃淡 (濃いほど高得点) に変更 (赤→緑配色を廃止)、下部凡例を撤去。右上に「評価を入力/編集」導線。
- KUTE = 工学院大学 (大学) に確定済を確認 (seed の「※要確認」は解消済)。

### Verified
- tsc / build 通過、deploy 成功 (v0.11.2 → v0.11.4)。本番 https://amd-os-pwa.vercel.app/institutions で転置・単色濃淡・ERS 強調を目視確認 (まさ)。
- commit: d22eb0a (マトリクス初版) → 9651470 (行展開型に刷新) → 1fc68f0 (ヒートマップ転置) → e9fbd41 (単色濃淡 + ERS 強調)。すべて main push 済。
- 並行セッション (#99 続き / XRL checklist) が worktree を dirty にしていたため、自分の institutions 関連ファイルのみ個別 stage して commit (git add . 不使用)。build-info.ts は別セッションの版番号運用 (v0.11.3) を尊重し、deploy 判別用に working tree で v0.11.4 に上げたが commit には含めず。

### 次セッションへ
- 実データ本評価: 3 機関の確信低サブ軸を `/institutions/assess` で実態評価して確定 (現状ドラフト 84 件、ERS 香川大 35% / 工学院 24% / NIMS 62%)。
