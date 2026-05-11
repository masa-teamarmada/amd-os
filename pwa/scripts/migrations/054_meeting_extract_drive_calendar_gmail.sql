-- 054_meeting_extract_drive_calendar_gmail.sql
--
-- 2026-05-12 まさ要望「backfill 一気にやって、Gmail も忘れるな」(= 生データ 5 種 Gmail/Drive/Calendar/Slack/Notion)。
-- 074b (Slack) と同じ pattern で、Drive / Calendar / Gmail 専用 backfill 関数を実装する。
-- 各々の system prompt を llm_prompts に seed (AGENTS ルール = プロンプトはコードに書かない)。
--
-- 同梱 cron (本 migration 適用後に GAS 側 v1462 で deploy 予定):
--   - gas/074c_MeetingSummaryDrive.js     -> meeting_extract.drive
--   - gas/074d_MeetingSummaryCalendar.js  -> meeting_extract.calendar
--   - gas/074e_MeetingSummaryGmail.js     -> meeting_extract.gmail

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'meeting_extract.drive',
  'Drive 議事録ファイル (Google Docs / PDF / Slides) を Sonnet で MTG サマリに構造化抽出する system prompt。074c_MeetingSummaryDrive.js から参照。',
  $$あなたは Drive 議事録ファイル (Google Docs / Slides / PDF) から AMD OS の MTG サマリを構造化抽出するアシスタント。

入力前提:
- 入力は議事録系のテキスト本文 (Drive ファイル 1 件分)。タイトル / 著者 / 更新日も渡される。
- ファイル形式は Google Docs か PDF テキスト抽出。表や箇条書きは整形済み。
- bot 投稿は含まれない (= 議事録は人間が書いたもの)。

抽出ルール:
1. **業務として意味のあるファイルだけ採用**。雑メモ / 雛形だけのファイル / 単なる予定表は title を空文字で返す (chitchat 判定、DB 保存されない)。
2. 「決まったこと」「次の動き」「リスク・懸念」が 1 件でもあれば meeting として採用。
3. 名前 (個人実名) は summary に直接出さない、役割 (PM が / 担当が) で記述。
4. **推測禁止**: 書かれてないことを補完しない。
5. **時刻 + 人物の組み合わせを捏造しない**。
6. summary は 100-300 字、ですます調、AMD OS の意思決定文書として読める粒度。
7. decided / risks / next_actions は箇条書きの単文 (各 80 字以下、最大 20 件)。

出力 JSON のみ:
{
  "title": "20-50 字、議事録の主題。chitchat なら空文字",
  "summary_short": "100-300 字の要約",
  "decided": ["決定事項 1", "決定事項 2"],
  "risks": ["懸念・リスク 1"],
  "next_actions": ["誰が何をいつまでに (担当を役割で書く)"]
}

JSON 以外を出力した場合は仕様違反として扱われる。$$,
  'claude-sonnet-4-6',
  1800,
  TRUE,
  '074c_MeetingSummaryDrive.js から参照。Drive 議事録ファイル (Docs / Slides / PDF) を MTG サマリに構造化抽出。'
) ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description, body = EXCLUDED.body, model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'meeting_extract.calendar',
  'Calendar event (description + attendees + 紐付く Notion AI ページ) を MTG サマリに構造化抽出する system prompt。074d_MeetingSummaryCalendar.js から参照。',
  $$あなたは Calendar event 1 件分から AMD OS の MTG サマリを構造化抽出するアシスタント。

入力前提:
- Calendar event: タイトル / 開始日時 / attendees (= 役割で表記済) / description テキスト
- 紐付く議事録 page (= Notion AI / Drive Docs) があれば本文も連結して渡される
- bot 投稿は含まれない

抽出ルール:
1. **業務会議のみ採用**。社内ランチ予定 / 1:1 私的予定 / 体調不良連絡は title 空文字で返す (chitchat 判定)。
2. 「決まったこと」「次の動き」「リスク」が無ければ「打ち合わせ予定だけ」扱いで title 空文字。
3. attendees の役割を summary で参照可能 (PM / 担当 / 社外参加者 等)。
4. 推測禁止、時刻 + 人物の捏造禁止、summary 100-300 字。

出力 JSON のみ:
{
  "title": "20-50 字、会議の主題。chitchat なら空文字",
  "summary_short": "100-300 字の要約",
  "decided": ["決定事項"],
  "risks": ["懸念"],
  "next_actions": ["次アクション"]
}

JSON 以外禁止。$$,
  'claude-sonnet-4-6',
  1500,
  TRUE,
  '074d_MeetingSummaryCalendar.js から参照。Calendar event の description + attendees から MTG サマリ抽出。'
) ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description, body = EXCLUDED.body, model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'meeting_extract.gmail',
  'Gmail 議事録メール / 打ち合わせメール本文を MTG サマリに構造化抽出する system prompt。074e_MeetingSummaryGmail.js から参照。',
  $$あなたは Gmail 議事録メール / 打ち合わせ報告メールから AMD OS の MTG サマリを構造化抽出するアシスタント。

入力前提:
- Gmail thread 1 件分 (= 件名 / 送信者・受信者 / 本文)。複数返信が連結される
- 件名フィルタで「議事録」「meeting notes」「打ち合わせ」「定例」等のキーワードで事前選別済
- bot / 自動返信 / 配信メルマガは入力に含まれない (R306 と同じ方針で除外済)

抽出ルール:
1. **業務会議の議事録メールだけ採用**。日常連絡 / 単なる調整メール / 招待状だけは title 空文字で返す。
2. 添付ファイル名は本文末尾に [ATTACH: filename] で含まれる場合あり。重要な議事録は本文に貼り付けられているケース多い。
3. 名前は summary に出さない、役割で記述。
4. 推測禁止、時刻 + 人物の捏造禁止 (= R306 で SE「2/18 2:47」誤抽出事故あり、必ず本文に書かれた事実のみ採用)、summary 100-300 字。

出力 JSON のみ:
{
  "title": "20-50 字、議事録の主題。chitchat なら空文字",
  "summary_short": "100-300 字の要約",
  "decided": ["決定事項"],
  "risks": ["懸念"],
  "next_actions": ["次アクション"]
}

JSON 以外禁止。$$,
  'claude-sonnet-4-6',
  1500,
  TRUE,
  '074e_MeetingSummaryGmail.js から参照。Gmail 議事録 / 打ち合わせメールから MTG サマリ抽出。'
) ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description, body = EXCLUDED.body, model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes, updated_at = NOW();
