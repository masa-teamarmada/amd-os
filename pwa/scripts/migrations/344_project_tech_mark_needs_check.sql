-- 344_project_tech_mark_needs_check.sql
-- 既存の行へ「要確認」の印と、確かめる内容を入れる (まさ 2026-08-29)。
-- 未確認・未測定は機械的に立て、資料間で食い違うものは理由を個別に書く。

begin;

-- 1) 確度が「未確認」の行は、そのまま要確認。
update project_tech_entries
set needs_check = true,
    check_reason = coalesce(check_reason, '値が未取得。調べる担当と期限を決める')
where confidence = 'unverified' and needs_check = false;

-- 2) 資料間で食い違う値 (SX) — 両方の行を要確認にし、相手の値を理由に書く。
update project_tech_entries set needs_check = true,
  check_reason = '★m³換算版は30 mg/g-DCW (銅・実測15超)、コスト試算の置き値は50 mg/g-DCW。どちらを採るかで必要菌体量が1.7倍変わり原価に直結する。次のSX定例で確定させる'
where tech_entry_id in ('pte_sx_r02', 'pte_sx_r03');

update project_tech_entries set needs_check = true,
  check_reason = '1回で使い捨てという最も保守的な置き方。色素分解なら数十回使い回せる可能性があるが未確認。10回を超えると培養費用は誤差になる'
where tech_entry_id = 'pte_sx_r10';

update project_tech_entries set needs_check = true,
  check_reason = '確度Hの置き値。実測で確かめる'
where tech_entry_id = 'pte_sx_r09';

update project_tech_entries set needs_check = true,
  check_reason = '20/50/100回で感度分析中。実験で耐久性を確認する'
where tech_entry_id = 'pte_sx_r11';

update project_tech_entries set needs_check = true,
  check_reason = '既存処理500円/m³前後という前提から置いた値。用途別の実勢価格は未検証'
where tech_entry_id in ('pte_sx_c11', 'pte_sx_p07');

update project_tech_entries set needs_check = true,
  check_reason = '絶対値の指定がない。装置設計には数値が要るので杉浦先生へ確認する'
where tech_entry_id = 'pte_sx_k06';

update project_tech_entries set needs_check = true,
  check_reason = '目標300ppmとの差が大きい。実排水の実測濃度で置き換える'
where tech_entry_id = 'pte_sx_r01';

-- 3) 資料間で食い違う値 (CX)
update project_tech_entries set needs_check = true,
  check_reason = '神谷氏は20mKと説明、アーキタイプベンチャーズ北原氏は数K程度ではないかと指摘 (超伝導でない方式の場合)。どちらの前提で装置を設計するかで大型化の要否が変わる'
where tech_entry_id = 'pte_cx_t06';

update project_tech_entries set needs_check = true,
  check_reason = '自社は原理的な無振動を優位性の筆頭に置いているが、産総研G-QuATは振動と熱の染み出しを大きな課題と認識していない。訴求軸として成立するか確かめる'
where tech_entry_id in ('pte_cx_c41', 'pte_cx_c44');

update project_tech_entries set needs_check = true,
  check_reason = '一般に知られる方式の値で、個別機種の実測ではない。Blueforsの公表仕様で裏を取る'
where tech_entry_id = 'pte_cx_c14';

update project_tech_entries set needs_check = true,
  check_reason = '実証されていない見込み値'
where tech_entry_id = 'pte_cx_m06';

update project_tech_entries set needs_check = true,
  check_reason = '大型化の算段はあるが未実証。加えて業界の主流は1台へ量子ビットを集約する方向で、大型化そのものが要るかも確かめる'
where tech_entry_id = 'pte_cx_c71';

-- 4) トピック単位の要確認
update project_tech_topics set needs_check = true,
  check_reason = '取り込み効率と滞留時間が原価を決めるが、いずれも確定していない。次のSX定例で杉浦先生・中島氏へ確認する'
where tech_topic_id = 'ptt_sx_reactor';

update project_tech_topics set needs_check = true,
  check_reason = '20mKでの要求冷凍能力が未確定。産総研G-QuATへの確認事項の筆頭'
where tech_topic_id = 'ptt_cx_temp';

commit;
