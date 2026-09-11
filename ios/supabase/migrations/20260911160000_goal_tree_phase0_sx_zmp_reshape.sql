-- ゴールツリー Phase 0-4: SXとZMPの木を到達点とMSの下へ組み直す
-- 正本: pwa/spec/3-22-goal-tree-plan.md §8（移行）・§8.1（SXのMS切り直し案、まさ確定）
--
-- やること
--   1. SX（p21）に到達点1本と、その直下のMS5本を置き、既存の根15件を §8.1 の表どおり付け替える
--   2. ZMP（p19）にテーマ4本の到達点と、状態が書かれているシーズンMS6本を置き、既存の根を付け替える
--   3. 9/9 の「NewCo設立」ツリーの実作業を、対応するMSへつなぐ
--   4. 支払済みMSの残作業を pt 0 のTODOとして足す（§6 原則10）
--
-- 消さない。付け替えるだけ。付け先に迷うものは未接続のまま残し、まさとPMが画面で置く。
-- 各TODOへ何ptを配るかはここで決めない（§8.1「えいみが机上で配らない」）。

-- 1. SX: 到達点 ---------------------------------------------------------------

insert into public.project_questions
  (id, project_id, parent_id, contribution, title, question_kind, status, owner_label, due_date,
   background, origin_kind, sort_order, review_state)
values
  ('21000000-2026-4000-8000-000000009001', 'p21', null, null,
   '2027年4月1日にNewCoを設立し事業を開始している', 'goal', 'open', '担当未確認', '2027-04-01',
   'シーズン（2026年4月〜2027年3月）の到達点。9/9 に整理した4条件に、ユニットエコノミクスと売上アドオンの検証を加えた5本で成り立たせる（spec 3-22 §8.1、まさ確定 2026-09-11）。',
   'manual', 10, 'accepted')
on conflict (id) do nothing;

-- 2. SX: 到達点の直下のMS5本 --------------------------------------------------

insert into public.project_questions
  (id, project_id, parent_id, contribution, title, question_kind, status, owner_label, due_date,
   background, origin_kind, sort_order, review_state)
values
  ('21000000-2026-4000-8000-000000009101', 'p21', '21000000-2026-4000-8000-000000009001', 'required',
   'ユニットエコノミクスと売上アドオンの検証', 'milestone', 'open', '担当未確認', '2026-12-18',
   'まさ「VCと話しているうちに、有償PoCの有無より、ユニットエコノミクスが成立するか、バイオディーゼルと金属回収でどれだけ売上をアドオンできるかの方が重要だと分かってきた」。有償PoCはこの条件の検証手段の一つとして下に置く。',
   'manual', 10, 'accepted'),
  ('21000000-2026-4000-8000-000000009102', 'p21', '21000000-2026-4000-8000-000000009001', 'required',
   '出資の確約', 'milestone', 'open', '担当未確認', '2027-03-12',
   '9/9 に整理した設立の条件。DD対応、出資者・出資額・条件の確定、出資確約の取得まで。', 'manual', 20, 'accepted'),
  ('21000000-2026-4000-8000-000000009103', 'p21', '21000000-2026-4000-8000-000000009001', 'required',
   'NewCo体制案確定', 'milestone', 'open', '担当未確認', '2027-02-26',
   '9/9 に整理した設立の条件。設立直前の体制整備まで。', 'manual', 30, 'accepted'),
  ('21000000-2026-4000-8000-000000009104', 'p21', '21000000-2026-4000-8000-000000009001', 'required',
   '愛媛大との諸手続き完了', 'milestone', 'open', '担当未確認', '2027-03-19',
   '9/9 に整理した設立の条件。学内手続き、愛媛大発SU認定、知財ライセンス合意まで。', 'manual', 40, 'accepted'),
  ('21000000-2026-4000-8000-000000009105', 'p21', '21000000-2026-4000-8000-000000009001', 'required',
   'SIERのMOU締結', 'milestone', 'open', '担当未確認', '2027-03-19',
   '9/9 に整理した設立の条件。参画企業・役割の確定、条件合意、MOU締結まで。', 'manual', 50, 'accepted')
on conflict (id) do nothing;

-- 3. SX: 既存の根15件を付け替える（spec 3-22 §8.1 の「下に付く既存の論点・試験」） ----

update public.project_questions
   set parent_id = '21000000-2026-4000-8000-000000009101', contribution = 'required'
 where project_id = 'p21' and deleted_at is null and parent_id is null
   and id in (
     '118edacd-b4a8-443f-8543-557630fff1cc',  -- バイオディーゼル事業は成立するか
     'ce2591cd-4692-4e97-81a2-22d617784656',  -- 取り込める金属の原子数が決まっている？
     '0b4398d8-4e73-49c8-9d0b-a0fdaf88ab16',  -- 乾燥菌体の総脂肪酸量と脂肪酸組成の測定（取り下げ済み）
     'aed8e9f7-d401-4dc4-9cac-d18573d692e2',  -- PoC候補の受入条件は実証計画に落とせるか
     'dbac6203-8092-4fde-9429-1f07cc9d82a8',  -- 処理コストを用途別に比較できるか
     'f93b798a-d76d-4f20-8788-49b6c8e75906',  -- 再設計したリアクター構成で評価条件を再現できるか
     '51f59a02-4f13-4e03-9ca6-26ac84614724',  -- Dyを含む工程液の回収は事業化候補になりうるか
     'e89f7383-612e-4a60-9889-5afd6fd3bf05',  -- オンサイトPoC完了をTRL5判定に接続できるか
     '4e807c02-09bf-49b3-be1c-558f5891652f',  -- PoC候補先対応をアルマダ中心の管理へ移す
     '613f0934-b80e-4d98-aa1d-6f16844c8e0a',  -- メタラチオネイン超発現の強化株
     '39788123-4aa9-4ad2-ae26-d2f8e36ade8f'   -- 廃液調達候補を県外へ広げる
   );

update public.project_questions
   set parent_id = '21000000-2026-4000-8000-000000009102', contribution = 'required'
 where project_id = 'p21' and deleted_at is null and parent_id is null
   and id = 'e766fe1b-b30d-4646-a79d-162eb67fc112';  -- 資金関係の現在地

update public.project_questions
   set parent_id = '21000000-2026-4000-8000-000000009103', contribution = 'required'
 where project_id = 'p21' and deleted_at is null and parent_id is null
   and id in (
     '8103b1db-ebff-4827-84ef-10132d4c5b8f',  -- NewCoの役割・知財・大学側条件を決められるか
     'f68b921c-3653-4584-9dac-4bc402bf1ad7'   -- 利益相反をどう整理するか
   );

update public.project_questions
   set parent_id = '21000000-2026-4000-8000-000000009105', contribution = 'required'
 where project_id = 'p21' and deleted_at is null and parent_id is null
   and id = '6ba65316-b73d-45a0-a46f-99506d94d012';  -- EWIR（SIER）組成の範囲・担当・決裁経路

-- 4. SX: 9/9 の「NewCo設立」ツリーの実作業を、対応するMSへつなぐ -------------------
--    中間ノード（NewCo設立 / 各MSと同名の4件）はつながない。木で名前が二重に出るため。
--    実体は消さずに残すので、必要になれば画面から拾い直せる。

insert into public.project_question_actions (project_id, question_id, action_id)
select 'p21', q.question_id, a.id
from (values
  ('21000000-2026-4000-8000-000000009102'::uuid, 'DD対応'),
  ('21000000-2026-4000-8000-000000009102'::uuid, '出資者・出資額・条件の確定'),
  ('21000000-2026-4000-8000-000000009102'::uuid, '出資確約の取得'),
  ('21000000-2026-4000-8000-000000009103'::uuid, 'チーム全体の設計'),
  ('21000000-2026-4000-8000-000000009103'::uuid, '役割・最低エフォート決定'),
  ('21000000-2026-4000-8000-000000009103'::uuid, '登記事項の最終合意'),
  ('21000000-2026-4000-8000-000000009104'::uuid, '学内手続き'),
  ('21000000-2026-4000-8000-000000009104'::uuid, '愛媛大発SU認定'),
  ('21000000-2026-4000-8000-000000009104'::uuid, '知財ライセンス合意'),
  ('21000000-2026-4000-8000-000000009105'::uuid, '参画企業・役割の確定'),
  ('21000000-2026-4000-8000-000000009105'::uuid, '条件合意'),
  ('21000000-2026-4000-8000-000000009105'::uuid, 'MOU締結')
) as q(question_id, action_title)
join public.project_actions a
  on a.project_id = 'p21' and a.title = q.action_title
 and a.deleted_at is null and a.review_state = 'accepted'
on conflict (question_id, action_id) do nothing;

-- 5. SX: 支払済みMSの残作業は pt 0（spec 3-22 §6 原則10・§8.1） ------------------
--    9月末までに月按分で消化済みのMSに残っている作業。終わるまでやるが、新たなptは付かない。

update public.project_actions
   set estimated_pt = 0
 where project_id = 'p21' and deleted_at is null and review_state = 'accepted'
   and title in ('チーム全体の設計', '役割・最低エフォート決定', '登記事項の最終合意');

insert into public.project_actions
  (id, project_id, title, detail, action_kind, status, owner_label, estimated_pt,
   origin_kind, sort_order, review_state)
values
  ('21000000-2026-4000-8000-00000000a001', 'p21', '資本政策の更新',
   '出資条件に合わせて資本政策を更新する。資本政策策定のMSは9月末で支払済みのため、新たなptは付かない（spec 3-22 §6 原則10）。',
   'work', 'unassessed', '担当未確認', 0, 'manual', 900, 'accepted'),
  ('21000000-2026-4000-8000-00000000a002', 'p21', '候補先との連絡の継続',
   'PoC先候補探索のMSは9月末で支払済み。候補先との連絡は続けるが、新たなptは付かない（spec 3-22 §6 原則10）。',
   'work', 'unassessed', '担当未確認', 0, 'manual', 910, 'accepted')
on conflict (id) do nothing;

insert into public.project_question_actions (project_id, question_id, action_id)
values
  ('p21', '21000000-2026-4000-8000-000000009102', '21000000-2026-4000-8000-00000000a001'),
  ('p21', '21000000-2026-4000-8000-000000009105', '21000000-2026-4000-8000-00000000a002')
on conflict (question_id, action_id) do nothing;

-- 6. ZMP: テーマ4本を到達点にする（spec 3-22 §8） ------------------------------

insert into public.project_questions
  (id, project_id, parent_id, contribution, title, question_kind, status, owner_label, due_date,
   background, origin_kind, sort_order, review_state)
values
  ('19000000-2026-4000-8000-000000009001', 'p19', null, null, 'KR経営改革', 'goal', 'open',
   '担当未確認', '2026-12-31', '葛飾ロードの経営を、成果が見える契約・管理の形へ移す。', 'manual', 10, 'accepted'),
  ('19000000-2026-4000-8000-000000009002', 'p19', null, null, '水素循環', 'goal', 'open',
   '担当未確認', '2026-12-31', '都内で水素をつくる・ためる・つかうところまでを、産学連携と助成で進める。', 'manual', 20, 'accepted'),
  ('19000000-2026-4000-8000-000000009003', 'p19', null, null, 'OkuDoor運営', 'goal', 'open',
   '担当未確認', '2026-12-31', 'OkuDoorを開業し、現地の運営が回る状態にする。', 'manual', 30, 'accepted'),
  ('19000000-2026-4000-8000-000000009004', 'p19', null, null, 'OkuDoorシステム', 'goal', 'open',
   '担当未確認', '2026-12-31', 'OkuDoorのシステムを本番運用へ移す。', 'manual', 40, 'accepted')
on conflict (id) do nothing;

-- 7. ZMP: 状態が書かれているシーズンMS6本を、テーマの直下に置く -------------------
--    成功条件が空の4本（定例運営 / 事務手続き / 採用支援 / SEAMS変更登記）は
--    定常か終了なので、ツリーの外に残す（spec 3-22 §8）。

insert into public.project_questions
  (id, project_id, parent_id, contribution, title, question_kind, status, owner_label, due_date,
   background, origin_kind, sort_order, review_state)
values
  ('19000000-2026-4000-8000-000000009101', 'p19', '19000000-2026-4000-8000-000000009001', 'required',
   'OkuDoor運営巻き取り戦略・契約スキーム設計', 'milestone', 'open', '担当未確認', '2026-08-31',
   'シーズンMS MS-p19-2026-01-okudoor-planning に対応。', 'manual', 10, 'accepted'),
  ('19000000-2026-4000-8000-000000009102', 'p19', '19000000-2026-4000-8000-000000009002', 'required',
   '水素 助成金・補助金申請', 'milestone', 'open', '担当未確認', '2026-12-31',
   'シーズンMS MS-p19-2026-04-h2-station に対応。', 'manual', 10, 'accepted'),
  ('19000000-2026-4000-8000-000000009103', 'p19', '19000000-2026-4000-8000-000000009002', 'required',
   '水素 産学連携・フェーズ2事業開発', 'milestone', 'open', '担当未確認', '2026-12-31',
   'シーズンMS MS-p19-2026-05-h2-circulation に対応。', 'manual', 20, 'accepted'),
  ('19000000-2026-4000-8000-000000009104', 'p19', '19000000-2026-4000-8000-000000009003', 'required',
   'OkuDoor開業前の現地対応（7〜8月先行分）', 'milestone', 'open', '担当未確認', '2026-08-31',
   'シーズンMS MS-p19-2026-10-okudoor-preopen に対応。', 'manual', 10, 'accepted'),
  ('19000000-2026-4000-8000-000000009105', 'p19', '19000000-2026-4000-8000-000000009003', 'required',
   'OkuDoor現地運用・オープン検証', 'milestone', 'open', '担当未確認', '2026-12-31',
   'シーズンMS MS-p19-2026-03-okudoor-ops に対応。', 'manual', 20, 'accepted'),
  ('19000000-2026-4000-8000-000000009106', 'p19', '19000000-2026-4000-8000-000000009004', 'required',
   'OkuDoorシステム開発', 'milestone', 'open', '担当未確認', '2026-10-31',
   'シーズンMS MS-p19-2026-02-okudoor-system に対応（別財布 cap_extra）。', 'manual', 10, 'accepted')
on conflict (id) do nothing;

-- 8. ZMP: 既存の根を付け替える ---------------------------------------------------
--    商標2件と地方土地のコラボは、どのテーマの下かをここで決めない。未接続のまま残し、
--    まさとPM（あび）が画面で置く。

update public.project_questions
   set parent_id = '19000000-2026-4000-8000-000000009101', contribution = 'required'
 where project_id = 'p19' and deleted_at is null and parent_id is null
   and id in (
     '19000000-2026-4000-8000-000000002001',  -- 成果が見える契約・管理モデルへ更新する
     '0636f4d3-c872-4143-9ef3-351f0918f6b4'   -- 地元の決議と経営の会議体を分ける
   );

update public.project_questions
   set parent_id = '19000000-2026-4000-8000-000000009103', contribution = 'required'
 where project_id = 'p19' and deleted_at is null and parent_id is null
   and id in (
     '19000000-2026-4000-8000-000000002002',  -- 葛飾水素社会実装ラウンドテーブルを組成する
     '19000000-2026-4000-8000-000000001001'   -- 都内で水素をつくる・ためる・つかう
   );

update public.project_questions
   set parent_id = '19000000-2026-4000-8000-000000009104', contribution = 'required'
 where project_id = 'p19' and deleted_at is null and parent_id is null
   and id = '19000000-2026-4000-8000-000000002521';  -- OkuDoor開業日とオープニング日

update public.project_questions
   set parent_id = '19000000-2026-4000-8000-000000009105', contribution = 'required'
 where project_id = 'p19' and deleted_at is null and parent_id is null
   and id in (
     '19000000-2026-4000-8000-000000002003',  -- OkuDoorを開業し運営へ移行する
     'f4720b85-0c2e-4511-b14b-3fabf7d879c4'   -- OkuDoorにポストがあるか確認
   );

update public.project_questions
   set parent_id = '19000000-2026-4000-8000-000000009106', contribution = 'required'
 where project_id = 'p19' and deleted_at is null and parent_id is null
   and id = '19000000-2026-4000-8000-000000002004';  -- OkuDoorシステムを本番運用へ移す

-- 9. 取り下げ済みの論点は木に付けない（適用後に画面を見て気づいた分） ---------------
--    3-21 の判定では「必須の子が1件でも取り下げ済み」だと親が「枝が死んだ」になる。
--    この論点は別の論点へ吸収済みで、同じ内容がやること「乾燥菌体の総脂肪酸量と
--    脂肪酸組成」として生きているため、MS全体を赤くするのは実態と合わない。
--    消さずに未接続へ戻す。
update public.project_questions
   set parent_id = null, contribution = null
 where project_id = 'p21'
   and id = '0b4398d8-4e73-49c8-9d0b-a0fdaf88ab16'
   and status = 'dropped';
