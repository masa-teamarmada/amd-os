-- 312: seed_screening_bands に P^ind (産業創出価値) の判断根拠を保存する列を足す。
--
-- 背景:
--   P^ind は判断層方式 (pwa/bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md §3) で置いている。
--   閉じた算出式を持たず、えいみがタイトル・要約 + 常識で桁の帯を直接置く。
--   その「なぜこの桁か」は判断記録 md にだけあり、DBに列が無かったので OS 画面に出せず、
--   まさから「Pind_min がどうして50億円になったのか現状だと分からない」と指摘された。
--   md だけに正本を置かない (pwa/AGENTS.md) ため、判断理由をDBへ持ち上げる。
--
-- 列:
--   p_rationale        判断理由 (一行)。md の「判断理由（一行）」列と同じ文。
--   p_external_demand  外需属性。'高' | '中' | '低' | 'なし'。P^ind の帯そのものではなく属性。
--   p_basis_doc        判断記録の出典 md ファイル名。p_class に紛れ込んでいた文字列の正しい置き場。
alter table public.seed_screening_bands
  add column if not exists p_rationale text,
  add column if not exists p_external_demand text,
  add column if not exists p_basis_doc text;

comment on column public.seed_screening_bands.p_rationale is
  'P^ind帯を置いた判断理由 (一行)。判断層方式なので閉じた式は無く、この文が根拠そのもの。';
comment on column public.seed_screening_bands.p_external_demand is
  'P^ind判断の外需属性 (高/中/低/なし)。帯の値ではなく、輸出・海外市場への出方の属性。';
comment on column public.seed_screening_bands.p_basis_doc is
  'P^ind判断記録の出典 md ファイル名 (pwa/bzm/ 配下)。';

-- 凍結ガードの精緻化。
--
-- 283 の元実装は「frozen 行の UPDATE / DELETE を一律拒否」だった。
-- 趣旨は「評価値を後から書き換えて履歴を消すのを防ぐ」ことであり、これは維持する。
-- ただし今回のように「凍結時に記録し損ねた判断根拠を後から補う」操作まで巻き込んで止まり、
-- 判断根拠が md にしか無い状態が固定されてしまった。
--
-- そこで以下に分ける:
--   * 評価値・版・凍結フラグ … 従来どおり一切変更禁止 (評価のすり替え防止)
--   * 判断根拠の注記3列       … OLD が NULL のときだけ NEW を入れられる (一方向の埋めのみ)
--   * DELETE                  … 従来どおり常に拒否
-- 「一度入った根拠を書き換える」ことは引き続きできないので、凍結の趣旨は壊れない。
create or replace function public.guard_frozen_seed_screening_band()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.frozen then
      raise exception 'frozen seed_screening_bands row % is immutable; append a reassessment instead', old.id;
    end if;
    return old;
  end if;

  if old.frozen then
    -- 評価値・版・凍結フラグに1つでも差があれば拒否。
    if (old.seed_id, old.ruleset_version, old.evaluator, old.assessed_at,
        old.stage_lower, old.stage_upper, old.stage_tag, old.axis_bands,
        old.q_lower_pct, old.q_upper_pct, old.q_main_factor, old.q_evidence,
        old.p_class, old.p_lower_yen, old.p_upper_yen,
        old.sps_lower_yen, old.sps_upper_yen, old.frozen, old.notes,
        old.measure_version, old.model_version, old.q_model_version,
        old.q_ruleset_version, old.p_model_version, old.information_cutoff)
       is distinct from
       (new.seed_id, new.ruleset_version, new.evaluator, new.assessed_at,
        new.stage_lower, new.stage_upper, new.stage_tag, new.axis_bands,
        new.q_lower_pct, new.q_upper_pct, new.q_main_factor, new.q_evidence,
        new.p_class, new.p_lower_yen, new.p_upper_yen,
        new.sps_lower_yen, new.sps_upper_yen, new.frozen, new.notes,
        new.measure_version, new.model_version, new.q_model_version,
        new.q_ruleset_version, new.p_model_version, new.information_cutoff)
    then
      raise exception 'frozen seed_screening_bands row % is immutable; append a reassessment instead', old.id;
    end if;

    -- 判断根拠の注記は NULL からの初回投入だけ許す (上書き・消去は拒否)。
    if old.p_rationale is not null and new.p_rationale is distinct from old.p_rationale then
      raise exception 'frozen seed_screening_bands row %: p_rationale is already recorded and cannot be rewritten', old.id;
    end if;
    if old.p_external_demand is not null and new.p_external_demand is distinct from old.p_external_demand then
      raise exception 'frozen seed_screening_bands row %: p_external_demand is already recorded and cannot be rewritten', old.id;
    end if;
    if old.p_basis_doc is not null and new.p_basis_doc is distinct from old.p_basis_doc then
      raise exception 'frozen seed_screening_bands row %: p_basis_doc is already recorded and cannot be rewritten', old.id;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_frozen_seed_screening_band() is
  'frozen評価は評価値・版・削除が不可。再評価はappend-only insertで行う。判断根拠の注記 (p_rationale / p_external_demand / p_basis_doc) だけはNULLからの初回投入を許し、上書きは拒否する。';
