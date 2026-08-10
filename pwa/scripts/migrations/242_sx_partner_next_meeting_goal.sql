-- 242: 関係先の「次回面談の着地点」欄
--
-- 背景 (2026-08-07 まさ):
--   次回面談の欄に日時・形式・場所・準備物はあるが、「そのMTGで何を得るべきか」を
--   書く場所が無かった。準備物 (何を持っていくか) と着地点 (何を持ち帰るか) は別物で、
--   面談前に読み返したいのは着地点のほう。
--
--   自由記述テキスト。「有償PoCの口頭合意」「排液サンプル提供の可否」のように
--   1行で書ける粒度を想定する。

alter table project_management_partners
  add column if not exists next_meeting_goal text;

comment on column project_management_partners.next_meeting_goal is
  '次回面談の着地点。その面談で何を得られれば成功かを1行で書く。準備物 (next_meeting_prep) とは別。';
