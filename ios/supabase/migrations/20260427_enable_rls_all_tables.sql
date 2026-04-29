-- Enable RLS on all public tables that were missing it
-- Tier 1: service_role-only tables (no policy needed; anon/authenticated blocked)
ALTER TABLE public.payout_agreement      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_model_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ms_progress_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ms_progress_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ms_proposal_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ms_revision_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigator_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tsukuyomi_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_ms_activities  ENABLE ROW LEVEL SECURITY;

-- Tier 2: client-facing tables (authenticated users get full access)
ALTER TABLE public.reimbursements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.reimbursements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON public.knowledge_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
