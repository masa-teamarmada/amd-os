-- 347_seed_project_tech_sx_record_fix.sql
-- SX の到達実績を訂正・追加する。
-- 340/341 で「バイオ装置(マニホールド型)を納品」とだけ書いたが、その後この方式は現行ラインから外れている。

begin;

update project_tech_entries
set note = '当初の想定50kgを大きく超えた重量。観察用の窓と二酸化炭素の導入口を持つ。'
           || '⚠ その後、実運用上の課題により現行の開発ラインから外れた (2026-06 月次業務報告書)',
    updated_at = now()
where tech_entry_id = 'pte_sx_d01';

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_d08', 'ptt_sx_record', 'p21', '7L チューブ型装置', null, 7, 7, '試作95%完了', 'L',
 null, null, '2026-01-19', 'high', 'literature', 'SX 定例報告会_260120',
 '杉浦先生が制御条件を挙げたチューブ型の最初の実機', false, null, 25, 'amie', 'amie'),
('pte_sx_d09', 'ptt_sx_record', 'p21', '培養装置の試作 (複数方式)', null, null, null, '10L水槽型 / 47L縦型筒 / UFO型', null,
 null, '並行して試作', '2026-06-30', 'high', 'literature', 'SX_月次業務報告書 202606',
 'マニホールド型 (180kg) は同じ報告で現行ラインから外れている', false, null, 35, 'amie', 'amie'),
('pte_sx_d10', 'ptt_sx_record', 'p21', 'メタロチオネイン過剰発現株 (TmtA1)', null, 2, 2, '遺伝子2つを導入', '個',
 null, '重金属の取り込みを強めた改良株', '2026-08-18', 'high', 'literature', 'SX 定例報告会 (2026-08-18)',
 '遺伝子組み換え体にあたるため、開放系では使えず閉鎖系の設計が要る', false, null, 65, 'amie', 'amie'),
('pte_sx_d11', 'ptt_sx_record', 'p21', 'メタロチオネイン超過剰発現株 (TmtA2)', null, 3, 3, '遺伝子3つを導入。完成したばかり', '個',
 null, '2026年8月に完成', '2026-08-18', 'high', 'literature', 'SX 定例報告会 (2026-08-18)',
 '試験できる細胞量になるまで約1か月と少し。比較実験に追加する',
 true, '取り込み量が野生株からどれだけ増えるかが未測定。ここが取り込み効率の値を動かす', 66, 'amie', 'amie'),
('pte_sx_d12', 'ptt_sx_record', 'p21', '煮豆排液での試験', null, null, null, '鉄は完全に除去、色素は除去できず', null,
 null, '実排液', '2026-07-01', 'high', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '色はむしろ濃くなった。カルコンからケルセチンへの変換の可能性が指摘されている。同定・収率・精製費用・品質保証はいずれも未確認',
 true, '色が濃くなる理由を特定する。色素分解を売りにするなら、どの色素なら分解できるのかの切り分けが要る', 67, 'amie', 'amie'),
('pte_sx_d13', 'ptt_sx_record', 'p21', '排液の法規制上の扱い', null, null, null, '特別管理産業廃棄物に該当する可能性', null,
 null, 'めっき排液などの重金属系', '2026-08-28', 'medium', 'literature', 'SX_月次業務報告書 202608',
 '大学側の処理責任を含めた取扱条件を確認してから受け入れる方針',
 true, '該当するなら、大学で受け入れられる排液の種類が絞られる。確認結果を待つ', 80, 'amie', 'amie');

commit;
