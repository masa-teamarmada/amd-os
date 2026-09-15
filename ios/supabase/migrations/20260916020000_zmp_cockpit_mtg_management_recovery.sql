-- ZMP cockpit recovery for the 2026-09-16 meeting.
--
-- The latest meeting notes, Slack, and the two OkuDoor Messenger threads were
-- reconciled on 2026-09-16.  This migration promotes only that reviewed ZMP
-- operating tree.  Older water-business candidates remain proposals.
-- Raw transcripts, Messenger URLs, and credentials are intentionally omitted.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The four workspace lanes say what is true now and what happens next.
-- ---------------------------------------------------------------------------

UPDATE public.project_theme_profiles
SET current_state_md = CASE track_key
      WHEN 'kr_management_reform' THEN
        '2026年9月8日、契約金額の増額は見送りとなり、現行の月額30万円を前提に継続検討中。成果・担当・費用・提出物が見えにくかった点が課題として示された。9月16日に直近の会議、Slack、Messengerの論点とTODOをゴールツリーへ統合したが、更新条件そのものは未合意。'
      WHEN 'katsushika_hydrogen' THEN
        'ラウンドテーブル構想資料は作成済み。九州大学・広瀬さんとの接点、9月25日の神戸スイーパー視察、9月29日の宇佐美グループ・中西商会との面談が次の具体日程。参加合意、運営規則、MOU、対価設計は未成立。商標調査は資料の正本と報告日を確認中。'
      WHEN 'okudoor_operations' THEN
        '開業は11月10日、オープニングイベントは11月15日。はたらくラボの規則案はあるが未承認。料金、清掃、現場体制、許認可、マニュアル、研修、イベント運営が残る。9月24日の現地視察は、まさが不参加のため代理参加者と記録担当が未確定。'
      WHEN 'okudoor_system' THEN
        'Vercel上のティザーは公開済みだが、okudoor.comはSquarespaceの近日公開ページのまま。9月13日の最新指示は、11月15日のイベントを前面にした簡易ティザーへ更新し、本番サイトを11月16日0時に公開すること。アプリ予約、決済、権限、LINE、月次報告、引継ぎは通し確認前。'
      ELSE current_state_md
    END,
    next_focus_note = CASE track_key
      WHEN 'kr_management_reform' THEN
        '毎回のMTG後に論点・TODO・決定・根拠を反映し、週次レビューで担当・期限・完了証跡を確認する。9月30日までに4論点の役割・成果・費用対応表と、対象をOkuDoor＋水素RTへ絞る契約案を先方判断へ出す。'
      WHEN 'katsushika_hydrogen' THEN
        '9月25日の視察結果を記録し、宇佐美向け資料と9月29日面談の役割・参加方法を確定する。並行してラウンドテーブルの参加条件、対価、MOU骨子を詰める。'
      WHEN 'okudoor_operations' THEN
        '9月24日の現地視察、10月16日のCBRE視察、11月10日開業、11月15日イベントを一枚のゲート表で管理する。規則案の承認、清掃・設備、スタッフ、マニュアルを期限と証跡つきで閉じる。'
      WHEN 'okudoor_system' THEN
        '新ティザー素材の受領後にイベント中心の表示へ更新し、11月15日の予約枠をアプリへ設定する。11月16日0時の本番公開までに公式導線、決済、権限、LINE、月次報告を通し確認する。'
      ELSE next_focus_note
    END,
    updated_by_member_id = 'ID001',
    updated_at = now(),
    version = version + 1
WHERE project_id = 'p19'
  AND track_key IN ('kr_management_reform', 'katsushika_hydrogen', 'okudoor_operations', 'okudoor_system');

-- ---------------------------------------------------------------------------
-- 2. Masa explicitly approved showing these four goals and their milestones.
-- ---------------------------------------------------------------------------

UPDATE public.project_questions
SET review_state = 'accepted',
    proposal_reason = NULL,
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001',
    updated_at = now(),
    version = version + 1
WHERE project_id = 'p19'
  AND id IN (
    '19000000-2026-4000-8000-000000009001',
    '19000000-2026-4000-8000-000000009002',
    '19000000-2026-4000-8000-000000009003',
    '19000000-2026-4000-8000-000000009004',
    '19000000-2026-4000-8000-000000009101',
    '19000000-2026-4000-8000-000000009102',
    '19000000-2026-4000-8000-000000009103',
    '19000000-2026-4000-8000-000000009104',
    '19000000-2026-4000-8000-000000009105',
    '19000000-2026-4000-8000-000000009106'
  );

UPDATE public.project_questions
SET title = CASE id
      WHEN '19000000-2026-4000-8000-000000009101' THEN '成果が見える契約・管理モデルの確立'
      WHEN '19000000-2026-4000-8000-000000009104' THEN 'OkuDoor開業前の現地確認（7〜8月分）'
      ELSE title
    END,
    due_date = CASE id
      WHEN '19000000-2026-4000-8000-000000009101' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000009102' THEN DATE '2026-12-31'
      WHEN '19000000-2026-4000-8000-000000009103' THEN DATE '2027-04-30'
      WHEN '19000000-2026-4000-8000-000000009104' THEN DATE '2026-08-31'
      WHEN '19000000-2026-4000-8000-000000009105' THEN DATE '2026-11-16'
      WHEN '19000000-2026-4000-8000-000000009106' THEN DATE '2026-11-16'
      ELSE due_date
    END,
    owner_label = CASE id
      WHEN '19000000-2026-4000-8000-000000009101' THEN 'まさ'
      WHEN '19000000-2026-4000-8000-000000009102' THEN 'まさ（担当再確認）'
      WHEN '19000000-2026-4000-8000-000000009103' THEN 'まさ'
      WHEN '19000000-2026-4000-8000-000000009104' THEN 'こたさん・まさ'
      WHEN '19000000-2026-4000-8000-000000009105' THEN 'こたさん・まさ'
      WHEN '19000000-2026-4000-8000-000000009106' THEN 'まさ'
      ELSE owner_label
    END,
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE project_id = 'p19'
  AND id BETWEEN '19000000-2026-4000-8000-000000009101'::uuid
             AND '19000000-2026-4000-8000-000000009106'::uuid;

UPDATE public.project_questions
SET status = 'answered',
    answer = '7〜8月の先行現地対応は実施済み。9月以降の未完了事項は「OkuDoor現地運用・オープン検証」へ移して管理する。',
    answered_on = DATE '2026-09-16',
    answered_by = 'ID001',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000009104';

-- Put the trademark decision under the management goal instead of leaving it
-- as an unrelated root, and retain the narrower brand-registration question.
UPDATE public.project_questions
SET parent_id = '19000000-2026-4000-8000-000000009101',
    contribution = 'required',
    due_date = DATE '2026-09-23',
    owner_label = 'こう・まさ',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002441';

UPDATE public.project_questions
SET parent_id = '19000000-2026-4000-8000-000000002441',
    contribution = 'required',
    due_date = DATE '2026-09-23',
    owner_label = 'こう',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '182d29c4-788e-4f41-838a-054bbd6ff480';

-- Close the two questions whose answer is the completed source integration.
UPDATE public.project_questions
SET status = 'answered',
    answer = CASE id
      WHEN '19000000-2026-4000-8000-000000002413' THEN
        '9月7日の九州大学・広瀬さんMTG結果は水素ラウンドテーブル構想と関連TODOへ反映済み。'
      WHEN '19000000-2026-4000-8000-000000002422' THEN
        '9月2日・9日の会議記録、9月16日までのSlack、Messengerの直近論点を9月16日に統合し、ゴールツリー・TODO・ガントで追える状態へ整理した。'
      ELSE answer
    END,
    answered_on = DATE '2026-09-16', answered_by = 'ID001',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002413',
  '19000000-2026-4000-8000-000000002422'
);

-- Current dates and wording from the latest conversations.
UPDATE public.project_questions
SET title = 'ティザー更新と11月16日本番公開の計画を確定する',
    background = '9月13日の最新指示は、11月15日のイベントを前面にした簡易ティザーへ更新し、本番サイトを11月16日0時に公開すること。okudoor.comは9月16日時点でSquarespaceの近日公開ページのまま。',
    due_date = DATE '2026-09-18',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002431';

UPDATE public.project_questions
SET due_date = CASE id
      WHEN '19000000-2026-4000-8000-000000002101' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002102' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002121' THEN DATE '2026-11-10'
      WHEN '19000000-2026-4000-8000-000000002122' THEN DATE '2026-11-15'
      WHEN '19000000-2026-4000-8000-000000002131' THEN DATE '2026-11-16'
      WHEN '19000000-2026-4000-8000-000000002132' THEN DATE '2026-11-10'
      WHEN '19000000-2026-4000-8000-000000002401' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002402' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002411' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002421' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002423' THEN DATE '2026-09-24'
      WHEN '19000000-2026-4000-8000-000000002433' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002434' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002501' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002502' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002511' THEN DATE '2026-09-30'
      ELSE due_date
    END,
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE project_id = 'p19'
  AND id IN (
    '19000000-2026-4000-8000-000000002101','19000000-2026-4000-8000-000000002102',
    '19000000-2026-4000-8000-000000002121','19000000-2026-4000-8000-000000002122',
    '19000000-2026-4000-8000-000000002131','19000000-2026-4000-8000-000000002132',
    '19000000-2026-4000-8000-000000002401','19000000-2026-4000-8000-000000002402',
    '19000000-2026-4000-8000-000000002411','19000000-2026-4000-8000-000000002421',
    '19000000-2026-4000-8000-000000002423','19000000-2026-4000-8000-000000002433',
    '19000000-2026-4000-8000-000000002434','19000000-2026-4000-8000-000000002501',
    '19000000-2026-4000-8000-000000002502','19000000-2026-4000-8000-000000002511'
  );

-- ---------------------------------------------------------------------------
-- 3. Promote the reviewed current operating actions.  IDs 001xxx remain
--    proposals because they belong to an older water-business candidate tree.
-- ---------------------------------------------------------------------------

UPDATE public.project_actions
SET review_state = 'accepted',
    proposal_reason = NULL,
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE project_id = 'p19'
  AND left(id::text, 33) = '19000000-2026-4000-8000-000000002';

-- Contract-management tasks.  Draft completion and counterparty agreement are
-- deliberately separate states.
UPDATE public.project_actions
SET status = CASE id
      WHEN '19000000-2026-4000-8000-000000002303' THEN 'done'
      ELSE 'running'
    END,
    progress_pct = CASE id
      WHEN '19000000-2026-4000-8000-000000002201' THEN 35
      WHEN '19000000-2026-4000-8000-000000002202' THEN 30
      WHEN '19000000-2026-4000-8000-000000002302' THEN 30
      WHEN '19000000-2026-4000-8000-000000002303' THEN 100
      WHEN '19000000-2026-4000-8000-000000002304' THEN 20
      WHEN '19000000-2026-4000-8000-000000002305' THEN 20
      WHEN '19000000-2026-4000-8000-000000002306' THEN 25
      WHEN '19000000-2026-4000-8000-000000002542' THEN 20
      ELSE progress_pct
    END,
    planned_end = CASE id
      WHEN '19000000-2026-4000-8000-000000002201' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002202' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002302' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002303' THEN DATE '2026-09-08'
      WHEN '19000000-2026-4000-8000-000000002304' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002305' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002306' THEN DATE '2026-09-23'
      WHEN '19000000-2026-4000-8000-000000002542' THEN DATE '2026-09-23'
      ELSE planned_end
    END,
    actual_end = CASE id
      WHEN '19000000-2026-4000-8000-000000002303' THEN DATE '2026-09-08'
      ELSE actual_end
    END,
    blocker = CASE id
      WHEN '19000000-2026-4000-8000-000000002303' THEN '絞り込み案の作成は完了。先方の契約承認は別タスクで未完了。'
      ELSE '更新条件は先方未合意。役割・成果・費用・稼働目安を一つの対応表にする必要がある。'
    END,
    done_evidence = CASE id
      WHEN '19000000-2026-4000-8000-000000002303' THEN '9月8日にOkuDoor＋水素ラウンドテーブルへ対象を絞る案を作成。先方承認は未取得。'
      ELSE done_evidence
    END,
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002201','19000000-2026-4000-8000-000000002202',
  '19000000-2026-4000-8000-000000002302','19000000-2026-4000-8000-000000002303',
  '19000000-2026-4000-8000-000000002304','19000000-2026-4000-8000-000000002305',
  '19000000-2026-4000-8000-000000002306','19000000-2026-4000-8000-000000002542'
);

UPDATE public.project_actions
SET status = 'running', planned_start = DATE '2026-09-16', planned_end = DATE '2026-11-16',
    progress_pct = 10,
    blocker = 'ゲート表の初回更新と週次更新責任者の確定が未完了。',
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002541';

-- Hydrogen near-term dates.
UPDATE public.project_actions
SET status = 'running', progress_pct = CASE id
      WHEN '19000000-2026-4000-8000-000000002311' THEN 70
      WHEN '19000000-2026-4000-8000-000000002312' THEN 25
      WHEN '19000000-2026-4000-8000-000000002392' THEN 20
      WHEN '19000000-2026-4000-8000-000000002315' THEN 15
      ELSE progress_pct
    END,
    planned_start = CASE id
      WHEN '19000000-2026-4000-8000-000000002392' THEN DATE '2026-09-16'
      ELSE planned_start
    END,
    planned_end = CASE id
      WHEN '19000000-2026-4000-8000-000000002311' THEN DATE '2026-09-29'
      WHEN '19000000-2026-4000-8000-000000002312' THEN DATE '2026-09-29'
      WHEN '19000000-2026-4000-8000-000000002392' THEN DATE '2026-09-28'
      WHEN '19000000-2026-4000-8000-000000002315' THEN DATE '2026-09-28'
      ELSE planned_end
    END,
    blocker = CASE id
      WHEN '19000000-2026-4000-8000-000000002392' THEN '宇佐美向け資料の完成と共有状態が未確認。'
      WHEN '19000000-2026-4000-8000-000000002315' THEN 'まさのオンライン参加方法と当日の役割が未確定。'
      ELSE blocker
    END,
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002311','19000000-2026-4000-8000-000000002312',
  '19000000-2026-4000-8000-000000002392','19000000-2026-4000-8000-000000002315'
);

UPDATE public.project_actions
SET title = '商標調査の正本資料と報告日を確定する',
    status = 'running', progress_pct = 50, planned_end = DATE '2026-09-23',
    owner_label = 'こう',
    blocker = '9月16日に準備済みとの報告がある一方、添付名が商標案件と一致せず、報告時期も「本日」と「来週」が併存。正本資料と共有日を確認する。',
    done_criteria = 'ZeMA・OkuDoorの商標調査について、正しい資料、調査範囲、相談要否、共有日が確認され、判断が記録されている。',
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002332';

-- Operations and opening control.
UPDATE public.project_actions
SET status = 'running',
    progress_pct = CASE id
      WHEN '19000000-2026-4000-8000-000000002321' THEN 35
      WHEN '19000000-2026-4000-8000-000000002322' THEN 25
      WHEN '19000000-2026-4000-8000-000000002323' THEN 50
      WHEN '19000000-2026-4000-8000-000000002325' THEN 30
      ELSE progress_pct
    END,
    planned_end = CASE id
      WHEN '19000000-2026-4000-8000-000000002321' THEN DATE '2026-09-30'
      WHEN '19000000-2026-4000-8000-000000002322' THEN DATE '2026-09-24'
      WHEN '19000000-2026-4000-8000-000000002323' THEN DATE '2026-09-18'
      WHEN '19000000-2026-4000-8000-000000002325' THEN DATE '2026-10-15'
      ELSE planned_end
    END,
    blocker = CASE id
      WHEN '19000000-2026-4000-8000-000000002321' THEN 'あび作成の規則案は存在するが、料金・ブース・郵便受け・イベント利用を含む最終承認が未完了。'
      WHEN '19000000-2026-4000-8000-000000002322' THEN '清掃見積の提出・受領・採算確認のreadbackが取れていない。'
      WHEN '19000000-2026-4000-8000-000000002323' THEN '9月24日・25日、10月16日、11月10日・15日・16日を反映した初回ゲート表の確認待ち。'
      WHEN '19000000-2026-4000-8000-000000002325' THEN 'Airレジ＋Squareの方向性は確認済み。申込・端末・精算の通し完了は未確認。'
      ELSE blocker
    END,
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002321','19000000-2026-4000-8000-000000002322',
  '19000000-2026-4000-8000-000000002323','19000000-2026-4000-8000-000000002325'
);

UPDATE public.project_actions
SET planned_start = DATE '2026-10-01', planned_end = DATE '2026-11-10',
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN ('19000000-2026-4000-8000-000000002223','19000000-2026-4000-8000-000000002327');

-- The old Sep 15 switch was superseded, rather than silently left blocked.
UPDATE public.project_actions
SET status = 'dropped', progress_pct = 0,
    blocker = '9月13日の最新指示で、イベント中心の新ティザーと11月16日0時の本番公開へ変更。',
    done_evidence = '9月15日の一般公開計画は最新指示により置き換え。新しい公開タスクで継続管理する。',
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002342';

UPDATE public.project_actions
SET planned_end = CASE id
      WHEN '19000000-2026-4000-8000-000000002231' THEN DATE '2026-11-16'
      WHEN '19000000-2026-4000-8000-000000002346' THEN DATE '2026-11-14'
      WHEN '19000000-2026-4000-8000-000000002347' THEN DATE '2026-10-31'
      WHEN '19000000-2026-4000-8000-000000002348' THEN DATE '2026-11-09'
      WHEN '19000000-2026-4000-8000-000000002349' THEN DATE '2026-10-31'
      WHEN '19000000-2026-4000-8000-000000002350' THEN DATE '2026-11-09'
      ELSE planned_end
    END,
    last_verified_at = DATE '2026-09-16', updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002231','19000000-2026-4000-8000-000000002346',
  '19000000-2026-4000-8000-000000002347','19000000-2026-4000-8000-000000002348',
  '19000000-2026-4000-8000-000000002349','19000000-2026-4000-8000-000000002350'
);

-- ---------------------------------------------------------------------------
-- 4. Missing actions that came directly from the latest meetings/messages.
--    The same action records feed both the goal tree and the gantt.
-- ---------------------------------------------------------------------------

INSERT INTO public.project_actions (
  id, project_id, parent_id, title, detail, action_kind, status, owner_label,
  planned_start, planned_end, actual_end, date_certainty, progress_pct, blocker,
  done_criteria, done_evidence, origin_kind, origin_ref, sort_order,
  last_verified_at, created_by, updated_by, review_state, client_token
)
VALUES
  (
    '19000000-2026-4000-8000-000000009201','p19','19000000-2026-4000-8000-000000002201',
    '直近MTG・Slack・Messengerの論点とTODOをワークスペースへ統合する',
    '9月2日・9日の会議記録、9月16日までのSlack、指定されたMessenger 2スレッドを突合し、確定・未合意・TODO・根拠を分けてゴールツリーへ反映する。',
    'work','done','まさ確認・えいみ反映',DATE '2026-09-16',DATE '2026-09-16',DATE '2026-09-16','confirmed',100,NULL,
    '直近の論点とTODOがゴールツリーへ入り、同じTODOをガントで確認できる。',
    '2026年9月16日に4テーマ、現行TODO、直近日程、未合意事項、根拠を統合。','manual','まさ指示 2026-09-16 / えいみ整理',710,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009201'
  ),
  (
    '19000000-2026-4000-8000-000000009202','p19','19000000-2026-4000-8000-000000002202',
    'MTG後48時間以内の反映担当と週次レビュー日を決める',
    '会議で生まれた論点、決定、TODO、根拠を誰がいつまでにOSへ入れ、誰が承認し、週のどこで期限・担当・完了証跡を確認するかを決める。',
    'work','running','まさ（責任者決定）',DATE '2026-09-16',DATE '2026-09-18',NULL,'provisional',20,
    '更新担当、承認者、週次レビュー日時が未確定。',
    '更新担当、承認者、反映期限、週次レビュー日時、完了証跡の置き方が合意され、次回MTGから運用できる。',NULL,
    'manual','まさ指示 2026-09-16',720,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009202'
  ),
  (
    '19000000-2026-4000-8000-000000009203','p19','19000000-2026-4000-8000-000000002231',
    '11月15日イベントを前面にした新ティザーを公開する',
    'こたさんから追加予定の画像を確認し、イベント日時と参加導線を中心にした簡易ティザーへ更新する。',
    'work','blocked','まさ・Web担当',DATE '2026-09-13',DATE '2026-09-18',NULL,'provisional',20,
    'こたさんから送付予定の追加画像を9月16日時点で確認できていない。',
    '最新画像と文言が承認され、公開URLでイベント中心のティザーを確認できる。',NULL,
    'meeting','Messenger直近指示 2026-09-13',730,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009203'
  ),
  (
    '19000000-2026-4000-8000-000000009204','p19','19000000-2026-4000-8000-000000002231',
    '11月16日0時にOkuDoor本番サイトを公開する',
    '定例で本番サイトの内容と切替手順を合意し、イベント終了後の11月16日0時に公式ドメインを本番サイトへ切り替える。',
    'work','not_started','まさ・Web担当',DATE '2026-09-23',DATE '2026-11-16',NULL,'confirmed',0,
    '本番サイト内容、DNS切替承認、切替担当、戻し手順が未確定。',
    'okudoor.comで本番サイトが表示され、主要ページと導線が本番環境で確認できる。',NULL,
    'meeting','Messenger直近指示 2026-09-13',740,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009204'
  ),
  (
    '19000000-2026-4000-8000-000000009205','p19','19000000-2026-4000-8000-000000002222',
    '9月24日現地視察の代理参加者・確認項目・記録担当を決める',
    'まさが参加できないため、代理参加者、現地で見る項目、写真・決定・宿題の記録担当と共有先を事前に決める。',
    'work','blocked','代理参加者未確定',DATE '2026-09-16',DATE '2026-09-24',NULL,'confirmed',0,
    '代理参加者と記録担当が未確定。',
    '代理参加者、確認表、記録担当、共有先が決まり、視察後に結果と新規TODOがOSへ反映される。',NULL,
    'meeting','ZeMA議事録 2026-09-09',750,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009205'
  ),
  (
    '19000000-2026-4000-8000-000000009206','p19','19000000-2026-4000-8000-000000002222',
    '10月16日CBRE視察の説明内容・資料・役割を確定する',
    'CBRE向けに現地の運営計画、開業条件、システム、地域貢献の説明範囲と当日の役割を決める。',
    'work','not_started','まさ',DATE '2026-09-29',DATE '2026-10-15',NULL,'confirmed',0,
    NULL,'説明資料、当日進行、担当、想定質問、持ち帰り事項の記録先が確定している。',NULL,
    'meeting','ZeMA議事録 2026-09-09',760,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009206'
  ),
  (
    '19000000-2026-4000-8000-000000009207','p19','19000000-2026-4000-8000-000000002328',
    '11月15日リース作りの予約枠をアプリへ設定し通し確認する',
    '料金500円、30分単位10枠、各回上限8人、合計80人の条件で予約・定員・決済・管理画面を設定する。',
    'work','not_started','まさ・うめ・あび',DATE '2026-09-23',DATE '2026-10-31',NULL,'confirmed',0,
    NULL,'利用者予約、定員超過防止、500円決済、管理画面確認、取消・返金を本番相当環境で通し確認できる。',NULL,
    'meeting','Messengerイベント依頼 2026-09-12',770,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009207'
  ),
  (
    '19000000-2026-4000-8000-000000009208','p19','19000000-2026-4000-8000-000000002211',
    '9月25日神戸スイーパー視察の評価項目を決め、結果を記録する',
    '神戸・東亜ブラシでのスイーパー視察について、参加者、確認項目、写真・測定・所感の記録方法を決め、水素ラウンドテーブルの検討材料へ反映する。',
    'work','running','まさ・広瀬さん（参加確認）',DATE '2026-09-16',DATE '2026-09-25',NULL,'confirmed',10,
    '参加者の最終確認と評価項目の合意が未完了。',
    '参加者、現地確認項目、写真・測定・所感の記録先が決まり、視察結果が水素ラウンドテーブルの問いへ反映されている。',NULL,
    'meeting','ZeMA議事録 2026-09-09',780,DATE '2026-09-16','ID001','ID001','accepted','19000000-2026-4000-8000-000000009208'
  )
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, detail = EXCLUDED.detail, status = EXCLUDED.status,
    owner_label = EXCLUDED.owner_label, planned_start = EXCLUDED.planned_start,
    planned_end = EXCLUDED.planned_end, actual_end = EXCLUDED.actual_end,
    date_certainty = EXCLUDED.date_certainty, progress_pct = EXCLUDED.progress_pct,
    blocker = EXCLUDED.blocker, done_criteria = EXCLUDED.done_criteria,
    done_evidence = EXCLUDED.done_evidence, origin_ref = EXCLUDED.origin_ref,
    last_verified_at = EXCLUDED.last_verified_at, updated_by = EXCLUDED.updated_by,
    review_state = 'accepted', updated_at = now(), version = public.project_actions.version + 1;

-- Direct question links make the meeting demo navigable in both directions.
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
VALUES
  ('p19','19000000-2026-4000-8000-000000002001','19000000-2026-4000-8000-000000009201'),
  ('p19','19000000-2026-4000-8000-000000002102','19000000-2026-4000-8000-000000009202'),
  ('p19','19000000-2026-4000-8000-000000002431','19000000-2026-4000-8000-000000009203'),
  ('p19','19000000-2026-4000-8000-000000002431','19000000-2026-4000-8000-000000009204'),
  ('p19','19000000-2026-4000-8000-000000002433','19000000-2026-4000-8000-000000009204'),
  ('p19','19000000-2026-4000-8000-000000002121','19000000-2026-4000-8000-000000009205'),
  ('p19','19000000-2026-4000-8000-000000002121','19000000-2026-4000-8000-000000009206'),
  ('p19','19000000-2026-4000-8000-000000002122','19000000-2026-4000-8000-000000009207'),
  ('p19','19000000-2026-4000-8000-000000002131','19000000-2026-4000-8000-000000009207'),
  ('p19','19000000-2026-4000-8000-000000002111','19000000-2026-4000-8000-000000009208')
ON CONFLICT (question_id, action_id) DO NOTHING;

INSERT INTO public.project_action_dependencies
  (project_id, predecessor_action_id, successor_action_id)
VALUES
  ('p19','19000000-2026-4000-8000-000000009203','19000000-2026-4000-8000-000000009204'),
  ('p19','19000000-2026-4000-8000-000000009208','19000000-2026-4000-8000-000000002315'),
  ('p19','19000000-2026-4000-8000-000000002392','19000000-2026-4000-8000-000000002315')
ON CONFLICT (predecessor_action_id, successor_action_id) DO NOTHING;

-- Known internal owners only.  External participants stay in owner_label.
INSERT INTO public.project_action_owners (project_id, action_id, member_id, created_by)
VALUES
  ('p19','19000000-2026-4000-8000-000000002201','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002202','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002302','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002303','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002304','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002305','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002306','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002315','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000002332','ID004','ID001'),
  ('p19','19000000-2026-4000-8000-000000002321','ID009','ID001'),
  ('p19','19000000-2026-4000-8000-000000002325','ID008','ID001'),
  ('p19','19000000-2026-4000-8000-000000002325','ID009','ID001'),
  ('p19','19000000-2026-4000-8000-000000002327','ID009','ID001'),
  ('p19','19000000-2026-4000-8000-000000002345','ID008','ID001'),
  ('p19','19000000-2026-4000-8000-000000002345','ID009','ID001'),
  ('p19','19000000-2026-4000-8000-000000009202','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000009203','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000009204','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000009206','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000009207','ID001','ID001'),
  ('p19','19000000-2026-4000-8000-000000009207','ID008','ID001'),
  ('p19','19000000-2026-4000-8000-000000009207','ID009','ID001'),
  ('p19','19000000-2026-4000-8000-000000009208','ID001','ID001')
ON CONFLICT (action_id, member_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Compact evidence behind the tree.  These are facts, not inferred status.
-- ---------------------------------------------------------------------------

INSERT INTO public.project_findings (
  id, project_id, summary, finding_kind, observed_on, source_label, confidence,
  from_action_id, sort_order, last_verified_at, created_by, updated_by,
  review_state, proposed_question_id, client_token
)
VALUES
  ('19000000-2026-4000-8000-000000009301','p19',
   '9月8日、契約金額の増額は見送りとなり、成果・役割・成果物の見えにくさが契約更新上の課題として示された。現行月額30万円を前提に継続検討中。',
   'contradicts',DATE '2026-09-08','こたさん契約更新回答', 'high',NULL,10,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009301'),
  ('19000000-2026-4000-8000-000000009302','p19',
   '9月16日、直近会議、Slack、Messengerの論点とTODOを4テーマのゴールツリーとガントへ統合した。',
   'supports',DATE '2026-09-16','AMD OS反映結果', 'high','19000000-2026-4000-8000-000000009201',20,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009302'),
  ('19000000-2026-4000-8000-000000009303','p19',
   '9月13日の最新指示は、11月15日イベント中心の簡易ティザーへ更新し、イベント後の11月16日0時に本番サイトを公開すること。',
   'neutral',DATE '2026-09-13','Messenger直近指示', 'high',NULL,30,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009303'),
  ('19000000-2026-4000-8000-000000009304','p19',
   '9月16日時点でokudoor.comはSquarespaceの近日公開ページ、Vercel側は別のティザーを表示しており、公式ドメイン切替は未完了。',
   'neutral',DATE '2026-09-16','公開URL確認', 'high',NULL,40,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009304'),
  ('19000000-2026-4000-8000-000000009305','p19',
   'はたらくラボの規則案は作成済みだが、料金、ブース、郵便受け、イベント利用を含む最終承認は確認できていない。',
   'missing',DATE '2026-09-16','Slack・会議記録', 'high',NULL,50,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009305'),
  ('19000000-2026-4000-8000-000000009306','p19',
   '商標調査は準備済みとの報告があるが、添付名が案件と一致せず、共有時期も本日と来週が併存しているため、正本資料と報告日の確認が必要。',
   'missing',DATE '2026-09-16','ZMP Slack', 'high','19000000-2026-4000-8000-000000002332',60,DATE '2026-09-16','ID001','ID001','accepted',NULL,'19000000-2026-4000-8000-000000009306')
ON CONFLICT (id) DO UPDATE
SET summary = EXCLUDED.summary, finding_kind = EXCLUDED.finding_kind,
    observed_on = EXCLUDED.observed_on, source_label = EXCLUDED.source_label,
    confidence = EXCLUDED.confidence, from_action_id = EXCLUDED.from_action_id,
    last_verified_at = EXCLUDED.last_verified_at, updated_by = EXCLUDED.updated_by,
    review_state = 'accepted', updated_at = now(), version = public.project_findings.version + 1;

INSERT INTO public.project_question_findings (project_id, question_id, finding_id)
VALUES
  ('p19','19000000-2026-4000-8000-000000002001','19000000-2026-4000-8000-000000009301'),
  ('p19','19000000-2026-4000-8000-000000002101','19000000-2026-4000-8000-000000009301'),
  ('p19','19000000-2026-4000-8000-000000002001','19000000-2026-4000-8000-000000009302'),
  ('p19','19000000-2026-4000-8000-000000002422','19000000-2026-4000-8000-000000009302'),
  ('p19','19000000-2026-4000-8000-000000002431','19000000-2026-4000-8000-000000009303'),
  ('p19','19000000-2026-4000-8000-000000002431','19000000-2026-4000-8000-000000009304'),
  ('p19','19000000-2026-4000-8000-000000002421','19000000-2026-4000-8000-000000009305'),
  ('p19','19000000-2026-4000-8000-000000002441','19000000-2026-4000-8000-000000009306')
ON CONFLICT (question_id, finding_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Fail closed if the demo-critical rows were not actually established.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  accepted_goals integer;
  accepted_current_actions integer;
  new_actions integer;
  linked_new_actions integer;
BEGIN
  SELECT count(*) INTO accepted_goals
  FROM public.project_questions
  WHERE project_id = 'p19'
    AND id IN (
      '19000000-2026-4000-8000-000000009001','19000000-2026-4000-8000-000000009002',
      '19000000-2026-4000-8000-000000009003','19000000-2026-4000-8000-000000009004'
    )
    AND review_state = 'accepted';

  SELECT count(*) INTO accepted_current_actions
  FROM public.project_actions
  WHERE project_id = 'p19'
    AND left(id::text, 33) = '19000000-2026-4000-8000-000000002'
    AND review_state = 'accepted';

  SELECT count(*) INTO new_actions
  FROM public.project_actions
  WHERE project_id = 'p19'
    AND id BETWEEN '19000000-2026-4000-8000-000000009201'::uuid
               AND '19000000-2026-4000-8000-000000009208'::uuid
    AND review_state = 'accepted';

  SELECT count(DISTINCT action_id) INTO linked_new_actions
  FROM public.project_question_actions
  WHERE project_id = 'p19'
    AND action_id BETWEEN '19000000-2026-4000-8000-000000009201'::uuid
                      AND '19000000-2026-4000-8000-000000009208'::uuid;

  IF accepted_goals <> 4 THEN
    RAISE EXCEPTION 'ZMP cockpit recovery expected 4 accepted goals, got %', accepted_goals;
  END IF;
  IF accepted_current_actions < 54 THEN
    RAISE EXCEPTION 'ZMP cockpit recovery expected at least 54 reviewed current actions, got %', accepted_current_actions;
  END IF;
  IF new_actions <> 8 OR linked_new_actions <> 8 THEN
    RAISE EXCEPTION 'ZMP cockpit recovery new action/link mismatch: actions %, linked %', new_actions, linked_new_actions;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_actions
    WHERE project_id = 'p19' AND status = 'done' AND actual_end IS NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ZMP cockpit recovery left a completed action without actual_end';
  END IF;
END $$;

COMMIT;
