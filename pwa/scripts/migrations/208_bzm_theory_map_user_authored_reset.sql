-- 208_bzm_theory_map_user_authored_reset.sql
-- BZM 2.0 理論マップを、利用者本人がゼロから育てる空の台帳へ戻す。
-- migration 203 の既存シードは履歴として残し、現在行だけを明示的に削除する。

BEGIN;

-- 外部キーの参照側を先に削除する。
DELETE FROM public.bzm_theory_edges;
DELETE FROM public.bzm_theory_nodes;

COMMIT;
