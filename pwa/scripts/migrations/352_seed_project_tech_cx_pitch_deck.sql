-- 352_seed_project_tech_cx_pitch_deck.sql
-- CX (p20) 技術台帳へ、OIST審査用ピッチ資料 (2026-08-27版・全31枚) の技術情報を入れる。
--
-- 依頼: まさ (2026-08-29)「ここに書いてある技術情報を、コックピットの技術タブに入れておいてほしい」
--
-- 出所: OIST Elevate 2026 審査用ピッチ資料 (資料室 > ピッチ資料)
--   p7  磁気冷凍の温度域別の実用化状況 (室温域 / 低温域 / 極低温域)
--   p13 磁気冷凍の原理と3つの強み
--   p14 TECHNOLOGY VALIDATION (120mK連続運転 / 熱スイッチ / 磁性体 / 超伝導線材)
--   p28 APPENDIX 技術シーズの詳細 (ΔS 1.5倍 / フィラメント幅10µm / ACロス 1/10)
--   p29 APPENDIX ヘリウム3とは (需給)
--   p30 APPENDIX 競合製品ラインナップ (Bluefors / kiutra の機種別スペック)
--
-- 方針 (spec 3-20 §3.4「食い違いは消さず両方残す」):
--   - 120mK (資料) と 126mK付近 (2026-06-16 NIMS桜MTG) は両方を行として残し、双方 needs_check。
--   - ヘリウム3は「完全に不要」(既存) と「1/1000以下」(資料) が食い違うため、
--     既存の星取り表セルへ needs_check を立て、資料側の数値は成立条件の行として別に置く。
--   - 金額は spec 3-20 §3.5 のとおりコスト試算タブが正本なので、機種別の価格はここへ持ち込まない
--     (資料内の kiutra 価格は社内ヒアリング由来の非公開情報でもあるため)。

begin;

-- ---------------------------------------------------------------------------
-- 1. 業界の実用化状況 (record) — 原理の解説と到達温度の間に置く
-- ---------------------------------------------------------------------------
insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, created_by, updated_by)
values (
  'ptt_cx_industry', 'p20', 'record',
  '磁気冷凍の温度域別の実用化状況 (業界)',
  '磁気冷凍が、どの温度域でどこまで実用化されているか。室温域はすでに製品、極低温域は宇宙で実運用。',
  '磁気冷凍', 15,
  'internal', 'literature',
  'OIST審査用ピッチ資料 (2026-08-27) p7 / p29',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, value_min, value_max, unit,
   value_text, condition_text, observed_on, confidence, source_kind, source_ref,
   needs_check, check_reason, sort_order, created_by, updated_by)
values
  ('pte_cx_p_ind10', 'ptt_cx_industry', 'p20', '室温域 (300K) の実用化', null, null, null,
   '製品として販売中。独 Magnotherm が磁気冷凍の飲料冷却器・食品冷蔵を販売し、スーパー向けも実証済み',
   null, '2026-08-27', 'medium', 'literature',
   'OIST審査用ピッチ資料 p7 (出典: Magnotherm 社公式サイト)',
   false, null, 10, 'amie', 'amie'),

  ('pte_cx_p_ind20', 'ptt_cx_industry', 'p20', '低温域 (20K) の実用化', null, null, null,
   '実証段階。NIMS 神谷グループが磁気冷凍による水素液化を世界初実証。EU でもパイロットプラントが稼働',
   null, '2026-08-27', 'high', 'literature',
   'OIST審査用ピッチ資料 p7 (出典: NIMS 公式サイト)',
   false, null, 20, 'amie', 'amie'),

  ('pte_cx_p_ind30', 'ptt_cx_industry', 'p20', '極低温域 (100mK以下) の実用化', null, null, null,
   '製品化と宇宙実運用が並行。独 kiutra が 300mK 連続運転機を製品化、NASA が極低温磁気冷凍を主導、JAXA 衛星ひとみ・XRISM で 50mK 級を宇宙実証',
   null, '2026-08-27', 'medium', 'literature',
   'OIST審査用ピッチ資料 p7 (出典: kiutra 社公式サイト / NASA / JAXA)',
   false, null, 30, 'amie', 'amie'),

  ('pte_cx_p_ind40', 'ptt_cx_industry', 'p20', 'ヘリウム3 年間需要 (世界)', 40000, 60000, 'L',
   null, '量子・極低温工学・核融合での用途拡大が牽引', '2026-08-27', 'medium', 'literature',
   'OIST審査用ピッチ資料 p29',
   true, 'ピッチ資料の記載で一次統計にあたっていない。供給側 2.2〜3万L と合わせ、出典 (Pulsar Helium 提供データ等) を直接確認する',
   40, 'amie', 'amie'),

  ('pte_cx_p_ind50', 'ptt_cx_industry', 'p20', 'ヘリウム3 年間供給 (世界)', 22000, 30000, 'L',
   null, '核兵器用トリチウムの崩壊副産物。供給できるのは核保有国の国家備蓄のみ', '2026-08-27', 'medium', 'literature',
   'OIST審査用ピッチ資料 p29',
   true, 'ピッチ資料の記載で一次統計にあたっていない。需要側 4〜6万L と合わせ、出典を直接確認する',
   50, 'amie', 'amie');

-- ---------------------------------------------------------------------------
-- 2. 冷却パワーとヘリウム3使用量の見込み (condition)
--    材料の成立条件 (30) と星取り表 (40) の間に置く
-- ---------------------------------------------------------------------------
insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
values (
  'ptt_cx_power', 'p20', 'condition',
  '冷却パワーを上げる打ち手と、その見込み',
  '磁気冷凍の弱点は冷却パワー。熱スイッチ・磁性体・超伝導線材の3つで上げにいく。多くが見込み値なので確度に注意。',
  '磁気冷凍', 35,
  'internal', 'manual',
  'OIST審査用ピッチ資料 (2026-08-27) p14 / p28',
  true,
  '3つの打ち手のうち、実測で裏が取れているのは磁性体のΔSだけ。冷却パワーの向上分を何µW@何mKで示すかが決まっていない',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, value_min, value_max, unit,
   value_text, condition_text, observed_on, confidence, source_kind, source_ref,
   needs_check, check_reason, sort_order, created_by, updated_by)
values
  ('pte_cx_p_pw10', 'ptt_cx_power', 'p20', '磁性体 (新材料) の ΔS', 1.5, 1.5, '倍',
   null, '業界標準の単結晶材料に対する比。ΔS = 磁場変化で吸収できる熱量',
   '2026-08-27', 'medium', 'manual',
   'OIST審査用ピッチ資料 p14 / p28 (実証済みと記載)',
   true, 'どの単結晶材料に対する比か、測定した磁場・温度条件はどこか、一次データを神谷氏へ確認する',
   10, 'amie', 'amie'),

  ('pte_cx_p_pw20', 'ptt_cx_power', 'p20', '磁性体 (新材料) の製造上の利点', null, null, null,
   '単結晶材料は大型育成が難しく製造のボトルネックになるが、新材料はこれを回避しつつ冷却パワーも高い',
   '磁気冷凍サイクルへの組み込みプロセスの確立が今後の課題', '2026-08-27', 'medium', 'manual',
   'OIST審査用ピッチ資料 p28',
   false, null, 20, 'amie', 'amie'),

  ('pte_cx_p_pw30', 'ptt_cx_power', 'p20', '超伝導線材 フィラメント幅 (自社加工)', 10, 10, 'µm',
   null, '独自の微細加工。従来の限界は 100µm', '2026-08-27', 'high', 'manual',
   'OIST審査用ピッチ資料 p14 / p28',
   false, null, 30, 'amie', 'amie'),

  ('pte_cx_p_pw40', 'ptt_cx_power', 'p20', '超伝導線材 フィラメント幅 (従来)', 100, 100, 'µm',
   null, '業界の従来限界', '2026-08-27', 'high', 'manual',
   'OIST審査用ピッチ資料 p28',
   false, null, 40, 'amie', 'amie'),

  ('pte_cx_p_pw50', 'ptt_cx_power', 'p20', '超伝導線材 ACロス (交流損失) 低減', null, null, null,
   '従来比 1/10 以下', 'シミュレーション上の見通し。磁場切り替え時のエネルギー損失',
   '2026-08-27', 'low', 'estimate',
   'OIST審査用ピッチ資料 p14 / p28',
   true, 'シミュレーション値で実測がない。線材の長尺化と特性評価、実機での冷凍能力向上としての実証が未了',
   50, 'amie', 'amie'),

  ('pte_cx_p_pw60', 'ptt_cx_power', 'p20', '超伝導線材による冷却パワー向上', 10, 10, '倍',
   null, '理論上の見通し (従来比)。磁場切り替えの高速化を通じて効く', '2026-08-27', 'low', 'estimate',
   'OIST審査用ピッチ資料 p14 / p28',
   true, '理論値で実機実証がない。長尺化と実機実証を経てから対外資料の数値として使う',
   60, 'amie', 'amie'),

  ('pte_cx_p_pw70', 'ptt_cx_power', 'p20', 'ガスギャップ式熱スイッチによる冷却パワー向上', null, null, null,
   '向上見込み (定量値なし)', '競合 kiutra の機械式熱スイッチに対し、He 充填による高い熱伝導率で優位と主張',
   '2026-08-27', 'unverified', 'manual',
   'OIST審査用ピッチ資料 p14 / p28',
   true, '定量値がない。何µW@何mK で比較するか測定条件を決めて測る。安定製造プロセスの確立も未了',
   70, 'amie', 'amie'),

  ('pte_cx_p_pw80', 'ptt_cx_power', 'p20', 'ヘリウム3使用量 (希釈冷凍機比)', null, null, null,
   '1/1000 以下', '資料 p12 の削減量の記載', '2026-08-27', 'medium', 'manual',
   'OIST審査用ピッチ資料 p12',
   true, '社内整理と星取り表では「完全に不要」としており、1/1000以下 (＝ゼロではない) と食い違う。実機で何をどれだけ使うかを神谷氏へ確認する。対外資料でどちらを言うかが変わる',
   80, 'amie', 'amie');

-- ---------------------------------------------------------------------------
-- 3. 競合製品の機種別スペック (condition) — 星取り表の直後
-- ---------------------------------------------------------------------------
insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, created_by, updated_by)
values (
  'ptt_cx_rivalspec', 'p20', 'condition',
  '競合製品の冷却パワー (機種別)',
  '星取り表を機種の実数値まで落としたもの。100mK での冷却パワーは希釈冷凍機が磁気冷凍を桁で上回る。',
  '磁気冷凍', 45,
  'internal', 'vendor_spec',
  'OIST審査用ピッチ資料 (2026-08-27) p30 APPENDIX 競合製品',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, value_min, value_max, unit,
   value_text, condition_text, observed_on, confidence, source_kind, source_ref,
   needs_check, check_reason, sort_order, created_by, updated_by)
values
  ('pte_cx_p_rs10', 'ptt_cx_rivalspec', 'p20', 'Bluefors LD450sl 冷却パワー @100mK', null, 450, 'µW',
   null, '希釈冷凍。物理量子ビット30規模 / 到達 10mK 以下。業界最安級の入門機',
   '2026-08-27', 'medium', 'vendor_spec', 'OIST審査用ピッチ資料 p30',
   false, null, 10, 'amie', 'amie'),

  ('pte_cx_p_rs20', 'ptt_cx_rivalspec', 'p20', 'Bluefors XLD1000s 冷却パワー @100mK', null, 1000, 'µW',
   null, '希釈冷凍。物理量子ビット30〜400', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30', false, null, 20, 'amie', 'amie'),

  ('pte_cx_p_rs30', 'ptt_cx_rivalspec', 'p20', 'Bluefors XLD1000s 冷却パワー @20mK', null, 30, 'µW',
   null, '希釈冷凍', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30', false, null, 30, 'amie', 'amie'),

  ('pte_cx_p_rs40', 'ptt_cx_rivalspec', 'p20', 'Bluefors KIDE 冷却パワー @100mK', null, 3000, 'µW',
   null, '希釈冷凍。物理量子ビット400〜1,000', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30', false, null, 40, 'amie', 'amie'),

  ('pte_cx_p_rs50', 'ptt_cx_rivalspec', 'p20', 'Bluefors XLDHe High Power 冷却能力 @1〜1.2K', 200, 700, 'mW',
   null, 'シリコン方式 / SNSPD 用。ヘリウム3 不要の機種', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30', false, null, 50, 'amie', 'amie'),

  ('pte_cx_p_rs60', 'ptt_cx_rivalspec', 'p20', 'kiutra L-Type Rapid 冷却パワー @100mK', null, 1, 'µW',
   null, '磁気冷凍 (ADR)。特性評価用途 / 300mK 機', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30',
   true, '資料の kiutra 情報には社内ヒアリング由来の非公開情報が混じる。公開仕様で裏を取り、外部資料へは公開値だけを使う',
   60, 'amie', 'amie'),

  ('pte_cx_p_rs70', 'ptt_cx_rivalspec', 'p20', 'kiutra L-Type Rapid 冷却パワー @1K', null, 160, 'µW',
   null, '磁気冷凍 (ADR)', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30',
   true, '資料の kiutra 情報には社内ヒアリング由来の非公開情報が混じる。公開仕様で裏を取る',
   70, 'amie', 'amie'),

  ('pte_cx_p_rs80', 'ptt_cx_rivalspec', 'p20', 'kiutra X-Type 冷却パワー @20mK', null, 20, 'µW',
   null, '磁気冷凍 (ADR)。販売前', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30',
   true, '販売前の機種。公表仕様が出た時点で値を更新する',
   80, 'amie', 'amie'),

  ('pte_cx_p_rs90', 'ptt_cx_rivalspec', 'p20', 'Bluefors 累計出荷台数', 1800, null, '台',
   null, '以上', '2026-08-27', 'medium', 'vendor_spec',
   'OIST審査用ピッチ資料 p30', false, null, 90, 'amie', 'amie');

-- ---------------------------------------------------------------------------
-- 4. 星取り表へ「冷却パワー」の軸を足す (既存7軸の末尾)
-- ---------------------------------------------------------------------------
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, unit,
   value_text, condition_text, observed_on, confidence, rating, source_kind, source_ref,
   needs_check, check_reason, sort_order, created_by, updated_by)
values
  ('pte_cx_p_c81', 'ptt_cx_compare', 'p20', '冷却パワー', 'CryoX (自社)', null, null, null,
   '未確定 (熱スイッチ・新材料・超伝導線材で向上を開発中)', null,
   '2026-08-27', 'unverified', 'unknown', 'manual',
   'OIST審査用ピッチ資料 p14',
   true, '自社の冷却パワーが何µW@何mK かを示す実測値がない。競合と同じ土俵で比べられる測定条件を決めて測る',
   81, 'amie', 'amie'),

  ('pte_cx_p_c82', 'ptt_cx_compare', 'p20', '冷却パワー', 'kiutra', null, 1, 'µW',
   '≦1µW @100mK (L-Type Rapid)', null,
   '2026-08-27', 'medium', 'poor', 'vendor_spec',
   'OIST審査用ピッチ資料 p30',
   false, null, 82, 'amie', 'amie'),

  ('pte_cx_p_c83', 'ptt_cx_compare', 'p20', '冷却パワー', 'LEMON (EU)', null, null, null,
   '未確認', null, null, 'unverified', 'unknown', 'manual', null,
   true, '値が未取得。調べる担当と期限を決める', 83, 'amie', 'amie'),

  ('pte_cx_p_c84', 'ptt_cx_compare', 'p20', '冷却パワー', '希釈冷凍機 (Bluefors)', null, 3000, 'µW',
   '≦450µW @100mK (LD450sl) 〜 ≦3,000µW @100mK (KIDE)', null,
   '2026-08-27', 'medium', 'excellent', 'vendor_spec',
   'OIST審査用ピッチ資料 p30',
   false, null, 84, 'amie', 'amie');

-- ---------------------------------------------------------------------------
-- 5. 到達実績へ追記。120mK と 126mK は両方残して双方 needs_check
-- ---------------------------------------------------------------------------
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, value_min, value_max, unit,
   value_text, condition_text, observed_on, confidence, source_kind, source_ref,
   needs_check, check_reason, sort_order, created_by, updated_by)
values
  ('pte_cx_p_r65', 'ptt_cx_record', 'p20', '連続運転で到達した温度 (2026-06 時点)', 126, 126, 'mK',
   '126mK 付近まで到達。100mK 帯への安定到達・長時間運転は未達', null,
   '2026-06-16', 'high', 'meeting',
   '2026-06-16 NIMS桜 BUILD鮫島さん面談',
   true, 'ピッチ資料 (2026-08-27) は「120mK を安定保持しながら連続運転に成功」としており、この値と食い違う。どちらが最新の実測かを神谷氏へ確認する',
   65, 'amie', 'amie'),

  ('pte_cx_p_r70', 'ptt_cx_record', 'p20', '連続運転で安定保持した温度 (資料記載)', 120, 120, 'mK',
   '120mK を安定保持しながら連続運転に成功、と審査資料に記載', null,
   '2026-08-27', 'medium', 'manual',
   'OIST審査用ピッチ資料 p14',
   true, '2026-06-16 の記録では 126mK 付近。120mK がその後の実測か資料上の丸めかを神谷氏へ確認する。あわせて資料 p14 の出典が 2021年 MT27 の概念設計発表になっており、実証時期と結びついていない',
   70, 'amie', 'amie'),

  ('pte_cx_p_r80', 'ptt_cx_record', 'p20', '超伝導線材 幅10µm フィラメント加工', null, null, null,
   '加工に成功。審査資料には「特許出願済み」と記載', null,
   '2026-08-27', 'medium', 'manual',
   'OIST審査用ピッチ資料 p14 / p28',
   true, '出願が完了しているか、出願準備中かを確認する。審査資料に「出願済み」と書いているため、事実と違うと信用問題になる',
   80, 'amie', 'amie'),

  ('pte_cx_p_r90', 'ptt_cx_record', 'p20', 'ガスギャップ式熱スイッチ', null, null, null,
   '断熱消磁冷凍機として実証済み (2015年発表)。安定製造プロセスの確立が今後', null,
   null, 'high', 'manual',
   'OIST審査用ピッチ資料 p14 / p28',
   false, null, 90, 'amie', 'amie');

-- ---------------------------------------------------------------------------
-- 6. 既存の星取り表セル「ヘリウム3への依存 × CryoX」を要確認にする。値は消さない
-- ---------------------------------------------------------------------------
update project_tech_entries
   set needs_check = true,
       check_reason = 'ここは「完全に不要」としているが、OIST審査用ピッチ資料 p12 は「ヘリウム3使用量 1/1000以下」(＝ゼロではない) と書いており食い違う。実機で何をどれだけ使うかを神谷氏へ確認する。対外資料でどちらを言うかが変わる',
       updated_by = 'amie',
       updated_at = now()
 where tech_entry_id = 'pte_cx_c21';

commit;
