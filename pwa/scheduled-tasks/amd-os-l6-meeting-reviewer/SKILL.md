---
name: amd-os-l6-meeting-reviewer
description: AMD OS H-1 MTGサマリの直後に走るツッコミ役。H-1が保存した `project_meeting_summaries` と raw Notion/Gmail/Drive/Slack/Calendar を見比べ、重大な経営判断・方針転換・CEO/資金調達/地元PoCなどが薄く丸まっていたら `l2_coverage_gaps` + `l2_notifications(l2_kind='coverage_gap')` に要確認として出す。H-1本文は自動上書きしない。報告文は日本語で書く。
---

# AMD OS H-1 MTGレビュアー

これは H-1 MTGサマリ本体ではなく、**H-1の直後に走る別人格のレビュー automation**。

## 目的

H-1 extractor の問いは「この会議を議事録化する」。  
本 reviewer の問いは「raw にある重大な経営判断が、H-1保存結果で薄く潰れていないか」。

2026-06-10 SX 愛媛大訪問では、raw Notion 文字起こしに「まさがCEOを引き受ける覚悟」「VC主軸から地元勢・PoC・共同開発費へ寄せる大転換」があったのに、初回H-1/D-6では「石原先生=開発管理、まさ=BizDev」「VCより補助金・地元企業」程度に丸まった。この事故の再発防止が本 routine の直接目的。

## 実行開始時に必ず説明すること

この automation は、実行の最初に必ず「何のために、何をするのか」を普通の日本語で短く説明してから作業に入る。まさが automation 一覧を見返した時に役割を思い出せるよう、内部名だけで始めない。

冒頭説明の形:

```
H-1 MTGレビュアーを走らせるね。
目的: H-1が作った会議メモに、重大な経営判断の見落としや薄まりがないか確認する。
やること:
- 直近で更新された「開催済みの会議メモ」だけを見る。
- 保存済みメモと、元のノーション・メール・ドライブ・スラック・カレンダーを見比べる。
- 本当に重大な見落としだと確信できるものだけ、まさが確認できる候補として残す。
やらないこと:
- 会議メモ本文を勝手に書き換えない。
- スラック送信はしない。
- 元の文字起こし全文や個人情報は報告に出さない。
```

対象MTGがない可能性が高い回でも、この説明を省略しない。対象がなければ「今回は確認対象があるかだけ見に行く」と添える。

## 報告言語

- 最終報告、H-1結果報告への追記、ツッコミ本文は、コーディングが一切分からない高校生でも理解できる日本語で書く。
- 無駄なアルファベット、コード名、DB列名、英語の状態名をユーザー向け報告に出さない。必要な場合だけ、日本語の説明を先に書き、括弧内に短く補足する。例: `DB` ではなく「保存先」、`coverage_gap` ではなく「要確認として残した見落とし候補」。
- Notion / Calendar / Drive / Slack / Gmail は、必要なら「ノーション」「カレンダー」「ドライブ」「スラック」「メール」と書き、サービス名の羅列だけで説明を終えない。
- 「No issues」「reviewed」「flagged」などの英語だけの報告は禁止。必ず「確認件数」「要確認件数」「要確認として残した見落とし候補」「ブロッカー」のように日本語で書く。
- Notion が取れていない場合でも、レビュー対象の開催済みMTGが無い / 対象が抽出窓外 / `source_kinds='none'` などで raw 会議本文が不足しているだけなら、報告全体を「不完全」とは書かない。Notion 欠落が重大情報の落ち検知に影響した対象MTGごとに「ノーションが取れていないので、この確認は不完全」と明記する。代替ソースだけで確認した結果を「問題なし」「重大な落ちは検知なし」と言い切らない。

## 必ず読む

1. `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
2. `pwa/design/meeting_summaries.md`
3. `pwa/design/h1_source_auth_fallback.md`
4. `pwa/design/coverage_gap_scanner.md`
5. `pwa/design/L2_DATA.md`
6. `pwa/design/db_schema.md`
7. `pwa/scripts/lib/h1_meeting_summary_reviewer.mjs`

## 実行タイミング

- H-1 `amd-os-l6-meeting-flow` が開催済みMTGを保存した直後、または毎時H-1 run の最後。
- 対象は `project_meeting_summaries.updated_at` が直近 90 分以内、`source_kinds` が `none` / `upcoming` / `upcoming_tentative` ではない行。
- `notion_url` がある行を優先する。Notion が無い行も、Gmail/Drive/Slack の raw が取れるなら対象にしてよい。

## 入力

対象 meeting row から最低限読む:

- `meeting_id`, `project_id`, `ym`, `meeting_date`, `meeting_start_at`, `title`
- `notion_url`, `notion_page_id`, `source_url`, `calendar_event_id`
- `source_kinds`, `summary_short`, `decided`, `progress`, `next_actions`, `risks`, `narrative_md`
- `updated_at`, `generated_at`, `generated_by_model`

raw source:

- Notion: visible summary だけで止まらず、**文字起こし / transcript block** まで読む。
- Gmail/Drive/Slack/Calendar: H-1が使った source refs があれば同じ raw を再取得する。
- Notion connector が `UNAUTHORIZED oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` の場合、再認証を待たずに Codex Desktop / Chrome のログイン済みNotion、browser history、open tabs、local cache を read-only で確認する。取れない場合も Gmail / Drive / Slack / Calendar source refs でレビューを続ける。
- auth failure を検知したら `npm run notify:connector-auth -- --connector notion --source h1_meeting_flow --reason <reason> --context "<meeting_id / title>" --dedupe-hours 24` を best-effort で実行し、PWA/Swift 両方が拾える connector/app ID と再認証リンク付きの復旧アクションを即作る。
- raw source が不足してレビュー不能な場合は `review_required_raw_source_insufficient` として coverage gap candidate に回す。`reviewer_blocked_notion_auth` / `waiting_for_reauth` は terminal status として使わない。

## レビュー観点

これは要約品質レビューではなく、**重大情報の落ち検知**。

特に以下を raw から探す:

- CEO / 社長 / 代表 / 就任 / 引き受け / 担う / やってもらいたい / なってほしい
- VC / フルコミット / 兼任 / 出資しない / 投資家 / 調達方針
- 地元 / ダイキ / 大輝 / ダイキアクシス / 三浦工業 / 伊予銀 / いよぎん / 今治 / 今治造船 / 太陽石油
- PoC / 共同開発費 / 導入 / プレス / リリース / 発表 / 派手 / ゴリゴリ / 巻き込む
- 旧正本と逆方向の発話: 外部CEO候補→まさCEO、VC主軸→地元勢、単なるPoC候補→地域発の大型実装、など

危険な丸まり:

- raw は「CEO/社長を誰が担うか」なのに、H-1保存結果が「BizDev分担」だけになっている。
- raw は「VC前提が崩れた」なのに、H-1保存結果が「補助金・地元企業も検討」程度になっている。
- raw は「過去前提の反転」なのに、D-6で `strategic_pivot` / `management_decision` / `critical` へ上がらない。
- raw は「当事者の覚悟・受諾・合意」なのに、H-1保存結果がタスク列挙だけになっている。

## 判定手順

1. raw transcript text と saved H-1 text を作る。
   - saved H-1 text = `summary_short + narrative_md + decided + progress + next_actions + risks`
2. deterministic guard を走らせる。

```bash
cd pwa
node scripts/review_h1_meeting_summary.mjs --fixture scripts/__fixtures__/h1_meeting_summary_reviewer_sx_pivot.json
node scripts/review_h1_meeting_summary.mjs --fixture scripts/__fixtures__/h1_meeting_summary_reviewer_sx_pivot.json --human-ja
```

実運用では fixture ではなく、対象 meeting row と raw transcript を以下の形にして stdin に渡す:

```json
{
  "meeting_id": "...",
  "project_id": "p21",
  "meeting_date": "2026-06-10",
  "title": "...",
  "notion_url": "...",
  "raw_text": "<Notion文字起こし/Gmail/Drive/Slack rawの短縮結合>",
  "summary_short": "...",
  "narrative_md": "...",
  "decided": [],
  "progress": [],
  "next_actions": [],
  "risks": []
}
```

3. guard が `items[]` を返したら、LLMレビュアーとして「これは本当に重大情報の落ちか」を短く再確認する。人間向け報告では JSON をそのまま貼らず、`report_ja` または `--human-ja` 相当の日本語に整える。
4. 確信できる落ちなら `POST /api/coverage-gaps/extract` に渡す。

## 出力

`POST /api/coverage-gaps/extract`:

```json
{
  "items": [
    {
      "source": "notion",
      "source_ref": "<notion_page_id or notion_url>",
      "source_hash": "h1-review:<sha256>",
      "title": "H-1要約で創業体制/資金調達転換が薄まった可能性: ...",
      "summary": "raw transcriptには CEO/代表・就任合意 / VC前提の破れ / 地元勢・PoC・共同開発費 が出ているが...",
      "salience_score": 0.9,
      "matched_patterns": { "reviewer": "h1_meeting_summary_reviewer" },
      "proposed_target_l2": "strategy_signal",
      "gap_class": "extractor_miss",
      "project_id": "p21",
      "scope": "project",
      "evidence_refs_json": {
        "meeting_id": "...",
        "meeting_date": "...",
        "title": "...",
        "notion_url": "...",
        "snippets": ["short snippet only"],
        "saved_summary_preview": "..."
      }
    }
  ]
}
```

この route が `l2_coverage_gaps(review_status='candidate')` と `l2_notifications(l2_kind='coverage_gap')` を作る。raw全文は保存しない。

## 日次まとめスレッドへの追記とアーカイブ (2026-07-20 まさ確定)

H-1本体 (`amd-os-l6-meeting-extract`) と同じ **その日の `H-1 YYYY-MM-DD 日次まとめ` スレッド** に、reviewer の結果も追記する。旧仕様の「H-1 run summary へ追記」は、実運用としてはこの「同日の日次まとめスレッドへの追記」を指す。

- registry は H-1本体と共有: `/Users/masa/.codex/automations/amd-os-l6-meeting-flow/daily_threads/YYYY-MM-DD.json`。
- registry に当日 (JST) の `thread_id` があれば、軽い確認をせずそのまま直接使う。
- registry が無い場合 (= reviewer が H-1本体より先に走った等) は、reviewer が直接 `create_thread` で作成してよい。作成時は `list_threads` によるスレッド検索・query検索・dummy search・広い過去日付検索を一切行わない。作成後、`thread_id` と実際に作成が完了した時点の現在 JST を `created_at_jst` として registry に書く。
- 毎時 reviewer run の結果が確定したら (要確認 0 件 / N 件いずれも)、sanitized な結果を日次まとめスレッドへ追記し、その後に現在の毎時 reviewer run スレッドを `set_thread_archived` でアーカイブする。raw transcript本文、Notion本文、個人情報、secret、URLは送らない。
- 日次まとめへの追記に失敗しても reviewer run を保持し続けない。失敗理由を automation memory に残し、必要なら H-1 本体の OS通知経路 (`app_notifications.kind='h1_report'`) に短い失敗報告を追加で残したうえで run を閉じる。

## H-1結果報告へのツッコミ

H-1 run summary / result chat (= 実運用では同日の `H-1 YYYY-MM-DD 日次まとめ` スレッド) には、レビュアーの結果を必ず日本語で短く入れる。

最終報告は、開発に疎い人でも読めるように、原則として以下の形にする。内部テーブル名、API名、英語だけの状態名は出さない。必要な番号がある場合だけ「要確認候補の番号」として出す。

```
確認件数: 1件
要確認件数: 0件
見た会議: CryoX 定例
要確認として残したもの: なし
ノーション取得可否: 取得できた
ブロッカー: なし

やったこと:
保存済みの会議メモと、元のノーション文字起こし・メール・ドライブ資料・カレンダーを見比べた。
重大な経営判断が薄くなっている箇所は見つからなかった。
会議メモの上書きとスラック送信はしていない。
```

要確認がある場合:

```
H-1レビュアー:
- 要確認: 1
  - SX 杉浦先生との会議: 元の会議メモでは代表を誰が担うか、資金調達の方針転換、地元企業との進め方が話されているのに、保存済みメモでは担当分担の話に薄まっている。要確認として残した。
  - 要確認候補の番号: cg:h1-review:...
```

ゼロ件なら:

```
H-1レビュアー: ノーションまで確認できた範囲では、重大な見落としは見つからなかった。
```

ノーションが取れなかった会議がある場合は、報告の先頭に必ず「ノーションが取れていないので、この確認は不完全」と書く。その場合、「重大な見落としはない」「問題なし」と言い切らない。

## 禁止

- H-1 row を reviewer が自動上書きしない。修正は `coverage_gap` → `/notifications` → 人間確認後。
- raw Notion/Gmail/Slack/Drive全文を DB に保存しない。
- 「Notion認証切れ」だけでレビューを諦めない。Chrome / local fallback と Gmail / Drive / Slack / Calendar source refs を試す。
- `reviewer_blocked_notion_auth` / `waiting_for_reauth` を terminal status にしない。fallback 後も raw が足りなければ `review_required_raw_source_insufficient` と試行経路を残す。
- 普通のTODOや日程調整を gap にしない。これは「重大情報が落ちたか」だけを見る。
