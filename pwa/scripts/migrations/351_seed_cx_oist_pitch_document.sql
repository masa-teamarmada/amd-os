-- 351_seed_cx_oist_pitch_document.sql
-- CX (p20) 資料室へ、OIST Lifetime Startup Elevate 2026 の書類審査用ピッチ資料を登録する。
--
-- 依頼: まさ (2026-08-29)「あきの作ったプレゼン資料を、コックピットの資料室に入れておいて」
--
-- 資料本体は Google Slides (あき作成、2026-08-27 版 = OLSE_2026/08/27_v1、31枚)。
-- Drive上のファイルなので entry_kind='link' で登録する。
-- 提出締切 2026-08-31。本番ピッチ (2026-11-06) 用の資料は採択後に別途作成する流れ。
--
-- 内部限定 (amd_internal)。外部ワークスペースaccountへは出さない。

begin;

insert into workspace_documents
  (scope_kind, project_id, entry_kind, visibility, folder_path, display_name,
   mime_type, source_kind, created_by_member_id)
select 'project', 'p20', 'folder', 'amd_internal', '', 'ピッチ資料',
       'application/x-directory', 'manual_folder', 'ID001'
where not exists (
  select 1 from workspace_documents
   where project_id = 'p20'
     and entry_kind = 'folder'
     and folder_path = ''
     and display_name = 'ピッチ資料'
);

insert into workspace_documents
  (scope_kind, project_id, entry_kind, visibility, folder_path, display_name,
   external_url, mime_type, source_kind, source_ref, created_by_member_id)
select 'project', 'p20', 'link', 'amd_internal', 'ピッチ資料',
       'OIST Elevate 2026 審査用ピッチ資料 (OLSE_2026-08-27_v1)',
       'https://docs.google.com/presentation/d/1Td6p5IQnG-le7uhZJzbdmNNlRHHZlulOrBWWBZmCvac/edit',
       'text/uri-list', 'manual_link',
       'OIST Lifetime Startup Elevate 2026 の書類審査提出用。作成: あき (末永晃理)。全31枚。提出締切 2026-08-31。11/6本番ピッチ用は採択後に別途作成。2026-08-28 レビュー指摘は knowledge/cx.md に記録',
       'ID001'
where not exists (
  select 1 from workspace_documents
   where project_id = 'p20'
     and entry_kind = 'link'
     and external_url = 'https://docs.google.com/presentation/d/1Td6p5IQnG-le7uhZJzbdmNNlRHHZlulOrBWWBZmCvac/edit'
);

commit;
