-- 146_drop_milestone_monthly_contribution_allocations.sql
-- 2026-06-19: reward calculation no longer supports monthly actual-share overrides.
-- Current reward source of truth is milestone period proration + milestone_responsibility.share.

DROP TABLE IF EXISTS public.milestone_monthly_contribution_allocations;
