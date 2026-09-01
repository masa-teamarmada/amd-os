-- seeds.company_note: シーズ一覧の「会社名」セルに添える但し書き。
-- 会社名が未確定でも、設立予定であることや大学の認定状態を一覧のまま読めるようにする。
-- 社内メモ (internal_notes) とは別で、研究機関向け公開面にも出してよい内容だけを入れる。
alter table public.seeds add column if not exists company_note text;

comment on column public.seeds.company_note is
  '会社名欄に添える但し書き。設立予定、大学の認定状態など、一覧の会社名セルに小さく表示する。研究機関向け公開ビューにも含める。社内限定の内容は internal_notes に書く。';
