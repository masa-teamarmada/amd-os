-- 全件議論用。研究の実現性・企業意向・新規性は未確認。
begin;
insert into public.seed_need_research (dataset,id,title,kind,gap,hypothesis,experiment,success_criteria,next_action) values ('example','003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','曲面センサー向けの発電・配線一体化','combination','発電層を曲面へ置くときの配線・密着・耐久性を一緒に考える必要がある、という仮説。','熱電発電とフレキシブル導電膜を組み合わせ、取り付け面に追従する給電部材を研究できないか。接合・抵抗・出力の両立は未検証。','対象設備と必要電力を聞き、材料の接合条件・曲げた状態での抵抗変化を研究者に確認する。','必要電力、曲率、温度条件を先に定め、試験可能な組み合わせと不足機能を特定する。','センサー側・材料側の研究者に、共同で検討できる範囲を確認。');
insert into public.seed_need_research_markets (research_id,dataset,market_need_id) values ('003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','example','d985f367-83d7-5524-b9ce-5f95e53d61a7');
insert into public.seed_need_research_companies (research_id,dataset,company_need_id) values ('003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','example','7a1d48bd-01ac-5a66-a741-a7e454e186a9');
insert into public.seed_need_research_companies (research_id,dataset,company_need_id) values ('003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','example','ad83ef62-bca6-5054-ac6e-a950b85a342a');
insert into public.seed_need_research_seeds (research_id,dataset,seed_id) values ('003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','example','a1390f71-3d7d-4bbc-9016-ca25bc901c34');
insert into public.seed_need_research_seeds (research_id,dataset,seed_id) values ('003e4a6f-0d5d-5fd0-8563-9aed0f0dd854','example','fc966b38-8411-40bb-a91f-7cee9e4bd3a2');
insert into public.seed_need_research (dataset,id,title,kind,gap,hypothesis,experiment,success_criteria,next_action) values ('example','4d74e88d-5763-522b-bf49-fcca554eef0b','加工条件の違いを扱う工具交換判断','new_seed','企業ごとに異なる設備・材料・加工条件でも、判断に必要な情報を集められるかは未整理。','現場条件が変わったときの誤判定を説明し、少量の現場データで補正できる技術を研究テーマにできないか。新規性・既存技術との差分は未調査。','複数の加工現場で、設備・加工条件・判定記録の取り方とばらつきを確認する。','共通に測れる項目と現場固有の項目を分け、既存技術で足りる部分と追加研究が必要な部分を特定する。','加工受託会社の仮の企業像から、最初のヒアリング先と質問を決める。');
insert into public.seed_need_research_markets (research_id,dataset,market_need_id) values ('4d74e88d-5763-522b-bf49-fcca554eef0b','example','af62e3af-4595-5f08-8526-599507b3669b');
insert into public.seed_need_research_companies (research_id,dataset,company_need_id) values ('4d74e88d-5763-522b-bf49-fcca554eef0b','example','42285561-60ab-5d76-8642-e9a81978a8ad');
commit;
