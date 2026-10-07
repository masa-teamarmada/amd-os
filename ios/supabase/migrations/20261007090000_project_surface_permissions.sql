-- PJとスペースを指定した、内部メンバーへの追加権限。既存の所属・管理者権限は変更しない。
BEGIN;
CREATE TABLE public.project_surface_member_permissions (
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  member_id text NOT NULL REFERENCES public.members(member_id) ON DELETE RESTRICT,
  surface text NOT NULL CHECK (surface IN ('cockpit','workspace','dd')),
  permission text NOT NULL CHECK (permission IN ('view','edit')),
  granted_by_member_id text NOT NULL REFERENCES public.members(member_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id,member_id,surface)
);
ALTER TABLE public.project_surface_member_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_surface_member_permissions FROM anon, authenticated;
GRANT ALL ON public.project_surface_member_permissions TO service_role;
COMMENT ON TABLE public.project_surface_member_permissions IS 'adminがPJ・スペース単位で付与する追加権限。退会者は無効。管理者や既存所属の権限は独立。';
CREATE FUNCTION public.amd_os_admin_grant_project_surface(p_actor_member_id text,p_member_id text,p_project_id text,p_surface text,p_permission text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM members WHERE member_id=p_actor_member_id AND is_admin AND status='active') THEN RAISE EXCEPTION 'admin_required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM members WHERE member_id=p_member_id AND status='active') THEN RAISE EXCEPTION 'active_member_required'; END IF;
 INSERT INTO project_surface_member_permissions(project_id,member_id,surface,permission,granted_by_member_id)
 VALUES(p_project_id,p_member_id,p_surface,p_permission,p_actor_member_id)
 ON CONFLICT(project_id,member_id,surface) DO UPDATE SET permission=excluded.permission,granted_by_member_id=excluded.granted_by_member_id,updated_at=now();
 INSERT INTO workspace_access_audit_logs(event_type,project_id,detail) VALUES('admin_project_membership_mutation',p_project_id,jsonb_build_object('action','grant_surface','actor_member_id',p_actor_member_id,'member_id',p_member_id,'surface',p_surface,'permission',p_permission));
END $$;
REVOKE ALL ON FUNCTION public.amd_os_admin_grant_project_surface(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.amd_os_admin_grant_project_surface(text,text,text,text,text) TO service_role;
ALTER TABLE public.dd_package_grants DROP CONSTRAINT dd_package_grants_capabilities_known;
ALTER TABLE public.dd_package_grants ADD CONSTRAINT dd_package_grants_capabilities_known CHECK(capabilities <@ ARRAY['dd.view','dd.download','dd.edit']::text[] AND 'dd.view'=ANY(capabilities));
COMMENT ON COLUMN public.dd_package_grants.capabilities IS 'dd.view=閲覧 / dd.download=添付ダウンロード / dd.edit=当該DDの掲載項目編集。権限再付与と受付状態変更はadminのみ。';
COMMIT;
