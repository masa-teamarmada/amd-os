begin;
select set_config('amd.cost_change_reason','491: コスト入力の連続表示に合わせ、削除した目次・全行切替の使い方のみ更新。計算入力・権限は変更しない。',true);
do $guard$ begin if (select md5(body_md) from project_cost_notes where cost_note_id='cn2_r5' and cost_model_id='cm_p21_260820') is distinct from '928c3fd7edb17cd94025943c49742948' then raise exception 'reading guide changed since readback'; end if; end $guard$;
update project_cost_notes set body_md=replace(body_md,$old$上の目次と小分けの札を押すと、その場所へ移動する。「すべての行を出す」で、選んだ組み合わせで発生しない明細も出る。$old$,$new$内訳の札を押すと、その額を動かす入力欄へページ内で移動する。すべての明細は最初から表示され、前提・作業・明細はページ全体のスクロールで続けて読める。$new$),updated_at=now() where cost_note_id='cn2_r5' and cost_model_id='cm_p21_260820';
commit;
