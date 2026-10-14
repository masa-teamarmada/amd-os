BEGIN;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('project-tech-graphs','project-tech-graphs',false,8388608,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY amie_tech_graph_service_all ON storage.objects FOR ALL TO service_role
USING (bucket_id='project-tech-graphs') WITH CHECK (bucket_id='project-tech-graphs');
-- 原画像は社内の認可済みrouteのみから閲覧。DD/sharedへ投影しない。
ALTER TABLE public.project_tech_entries ADD CONSTRAINT amie_effluent_graphs_valid CHECK (
 experiment IS NULL OR NOT experiment ? 'graphs' OR coalesce(
   jsonb_typeof(experiment->'graphs')='array' AND jsonb_array_length(experiment->'graphs') <= 12,false)
);
COMMIT;
