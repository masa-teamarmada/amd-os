-- 481: DDの資料リンクはGoogle Driveを参照する。公開公報の内容は同一。
-- Drive同期済みPDF（元の公報PDFとSHA256一致、1,441,395 bytes）を参照する。
-- DD掲載対象・パッケージのdraft・閲覧権限は変更しない。
BEGIN;
SELECT set_config('request.headers', '{"x-amd-os-actor":"amie-sol-dd-content-20261005"}', true);
SELECT set_config('app.workspace_migration', '481', true);
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_documents WHERE document_id='e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b' AND project_id='p21' AND entry_kind='link' AND external_url='https://patentimages.storage.googleapis.com/58/c9/f7/87c0a55e9e7d17/WO2025028350A1.pdf' AND source_ref='sol-dd-content-20261005:patent; 公開公報表紙確認済み、掲載候補、未公開。')
    THEN RAISE EXCEPTION 'Patent reference changed since readback'; END IF;
END $guard$;
UPDATE public.workspace_documents
SET external_url='https://drive.google.com/file/d/1EH1YTgLbIrHWPjvWmW-8VflUX3yPPfr4/view?usp=drivesdk',
    file_size_bytes=1441395,
    source_ref='sol-dd-content-20261005:patent; 公開公報の同一PDFをSOL Driveへ保存。DD掲載対象、パッケージは下書き。',
    updated_at=now()
WHERE document_id='e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b';
COMMIT;
