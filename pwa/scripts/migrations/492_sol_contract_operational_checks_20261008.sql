-- SOLの押印原本を全ページ目視確認した短い論点・手続き要約のみ。本文・個人情報は保存しない。
-- 読取原本 SHA256: 168d83586a79a14bee39d81c43a527c1f090785765d3f2dfa9c5f2eae5f5b810
-- 既存の金額・期間・掲載範囲・DD設定・請求cycleは変更しない。
BEGIN;
DO $$
DECLARE
  patch jsonb := $data${"operationalChecks": [{"id": "third-party-disclosure", "question": "技術・事業の秘密情報を第三者に開示するときは？", "status": "needs_confirmation", "answer": "確認した請負契約原本では、技術・事業の秘密情報全般の定義、第三者開示の承認者・申請方法・例外は確定できない。第11条は個人情報の取扱いを規定する。未定事項は第14条に基づく双方協議の対象。", "actions": [{"kind": "recommended_check", "text": "開示する資料・情報、情報の保有者、相手先、目的、開示範囲を具体化する。"}, {"kind": "recommended_check", "text": "大学との別NDA、添付仕様書、共同研究・知財契約など、その情報に適用される合意と開示条件を確認する。"}, {"kind": "recommended_check", "text": "大学側に開示の可否、承認権限者、必要な承諾の形式を確認し、資料の版・範囲・相手先・目的を含む確認記録を残す。"}, {"kind": "recommended_check", "text": "開示先のNDAの締結・適用範囲と、情報提供元との条件をそれぞれ確認し、条件が確定した範囲で開示する。"}], "unresolved": ["大学との別NDA・添付仕様書等は今回未確認。", "大学側の承認者、書面承諾の要否、申請先・様式、承認済みの開示範囲は未確認。", "開示先とNDAを結ぶだけで、大学由来情報を開示できるとは判断しない。"], "sourceTitle": "260601_請負契約書(260601_270331)_愛媛大学_AMD.PDF", "sourceUrl": "https://drive.google.com/file/d/13WZ4FQtpdx9BpvgOaCuQ6UkxaeSX-HYT/view", "sourceClause": "全14条を確認／第11条（個人情報）、第14条（未定事項の双方協議）", "checkedAt": "2026-10-08"}, {"id": "personal-information", "question": "個人情報を第三者に渡したり、目的外に使うときは？", "status": "confirmed", "answer": "第11条第1項第1号は、個人データの取扱いを通じて知り得た個人情報の第三者への漏えい・目的外利用を禁止し、業務終了後も同様とする。一般的な第三者提供の許可手続きは、この条項からは確定できない。", "actions": [{"kind": "contract_requirement", "text": "第三者への漏えい・目的外利用をしない。業務終了後も同じ義務を守る。"}, {"kind": "contract_requirement", "text": "大学から提供された個人情報の複写・複製は、大学の承諾がある場合を除いて行わない。"}, {"kind": "contract_requirement", "text": "漏えい等の事故又はそのおそれがある場合は、直ちに大学へ書面で報告し、指示に従う。"}, {"kind": "contract_requirement", "text": "業務終了時は、条項に該当する個人情報の消去・媒体返却を行う。"}], "unresolved": ["再委託の承諾と、第三者への一般的な情報開示の許可は別に確認する。"], "sourceTitle": "260601_請負契約書(260601_270331)_愛媛大学_AMD.PDF", "sourceUrl": "https://drive.google.com/file/d/13WZ4FQtpdx9BpvgOaCuQ6UkxaeSX-HYT/view", "sourceClause": "第11条第1項第1号・第3号〜第5号", "checkedAt": "2026-10-08"}, {"id": "subcontracting", "question": "第三者・子会社へ業務を再委託するときは？", "status": "confirmed", "answer": "第11条第1項第2号は第三者（子会社を含む）への再委託を原則禁止し、発注者が承諾した場合を例外とする。個人情報の取扱業務を再委託する場合は、再委託先にも同条第1項の措置を守らせる。", "actions": [{"kind": "contract_requirement", "text": "再委託する前に、発注者である愛媛大学の承諾を得る。"}, {"kind": "contract_requirement", "text": "個人情報の取扱業務を再委託する場合、再委託先に第11条第1項の措置を遵守させる。"}, {"kind": "recommended_check", "text": "再委託先・業務範囲・扱う情報を特定し、大学の承諾方法と必要な記録を確認する。"}], "unresolved": ["承諾する担当者・申請先・様式・書面の要否は原本に明記されていない。"], "sourceTitle": "260601_請負契約書(260601_270331)_愛媛大学_AMD.PDF", "sourceUrl": "https://drive.google.com/file/d/13WZ4FQtpdx9BpvgOaCuQ6UkxaeSX-HYT/view", "sourceClause": "第11条第1項第2号・第3項", "checkedAt": "2026-10-08"}]}$data$::jsonb;
  target_id uuid := 'a887fa6f-055c-441b-8f5e-40625c19195e';
  current_json jsonb;
  matches integer;
BEGIN
  PERFORM 1 FROM contracts WHERE contract_id=target_id AND project_id='p21' AND is_current_for_project=true AND status='signed' AND md5(operational_terms_json::text)='345a819ebfa2d0a17959f98019883b58' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract changed or already applied; inspect readback'; END IF;
  SELECT contract_terms_json INTO current_json FROM projects WHERE project_id='p21' AND md5(contract_terms_json::text)='699f0cddec1ac210a4c73f7aa0dc6ce1' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project terms changed or already applied; inspect readback'; END IF;
  SELECT count(*) INTO matches FROM jsonb_array_elements(current_json->'currentContracts') item WHERE item->>'contractId'=target_id::text;
  IF matches<>1 THEN RAISE EXCEPTION 'Expected exactly one current contract'; END IF;
  UPDATE contracts SET operational_terms_json=operational_terms_json || patch WHERE contract_id=target_id;
  UPDATE projects SET contract_terms_json=jsonb_set(current_json,'{currentContracts}',(
    SELECT jsonb_agg(CASE WHEN item->>'contractId'=target_id::text THEN jsonb_set(item,'{terms}',coalesce(item->'terms','{}'::jsonb)||patch) ELSE item END ORDER BY position)
    FROM jsonb_array_elements(current_json->'currentContracts') WITH ORDINALITY AS records(item,position)
  )) WHERE project_id='p21';
END $$;
COMMIT;
