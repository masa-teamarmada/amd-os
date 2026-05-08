-- 018_vc_amd_ratings_initial.sql
--
-- 初期 AMD 相性評価をえいみ独断で 21 社に付与 (2026-05-08)。
--
-- 評価軸 (まさ指示):
--   1. アーリーステージの DTSU に出資する VC として向いてるか
--   2. DD する能力があるか
--   3. リード取れるか
--
-- ★1 — DTSU 向きでない / 関わる場面ほぼ無い
-- ★2 — 限定的、特定条件でだけ意味ある
-- ★3 — そこそこ、後追い参加なら有効
-- ★4 — 強い、AMD と相性良い、リード可能性あり
-- ★5 — 中核パートナー、最優先で関係構築

UPDATE vcs SET amd_rating = 5, amd_rating_note = '国内ディープテック特化のトップ。アーリー / DD / リード 3 軸全部強い。AMD と最大親和性。', amd_rating_updated_at = NOW() WHERE name = 'UntroD Capital Japan（旧リアルテックホールディングス）';

UPDATE vcs SET amd_rating = 5, amd_rating_note = '東大発 DT 特化、アーリー〜A、リード実績豊富、DD 体制も大学技術深く分かる。', amd_rating_updated_at = NOW() WHERE name = 'UTEC（東京大学エッジキャピタルパートナーズ）';

UPDATE vcs SET amd_rating = 5, amd_rating_note = '大学発・DT 特化、アーリー中心、事業化支援強い。AMD のスタジオモデルと親和性最大、共同インキュベーションも検討余地。', amd_rating_updated_at = NOW() WHERE name = 'Beyond Next Ventures';

UPDATE vcs SET amd_rating = 4, amd_rating_note = 'ディープテック / フロンティア特化、シード〜A、Synspective でリード実績。AMD アーリー案件で第一候補級。', amd_rating_updated_at = NOW() WHERE name = 'Abies Ventures';

UPDATE vcs SET amd_rating = 4, amd_rating_note = '東大プラットフォーム、大学発支援強い。リード実績あり。AMD と相性良い。', amd_rating_updated_at = NOW() WHERE name = 'UTokyo IPC（東京大学協創プラットフォーム開発）';

UPDATE vcs SET amd_rating = 4, amd_rating_note = '京大発、サイエンス系特化、アーリー OK。関西発 DTSU に強い。', amd_rating_updated_at = NOW() WHERE name = '京都大学イノベーションキャピタル（京大iCAP）';

UPDATE vcs SET amd_rating = 4, amd_rating_note = '東工大発 DT、アーリー対応、リード可能。BWE 出資先 (2026-05 1億 予定)。', amd_rating_updated_at = NOW() WHERE name = 'みらい創造インベストメンツ';

UPDATE vcs SET amd_rating = 3, amd_rating_note = 'DT 投資もするが SaaS / consumer 比率が高い。アーリーで参加可、リードは案件次第。', amd_rating_updated_at = NOW() WHERE name = 'ANRI';

UPDATE vcs SET amd_rating = 3, amd_rating_note = '気候 DT 専門サブファンド。テーマが合えば有効、当てはまる PJ を選んで持ち込み。', amd_rating_updated_at = NOW() WHERE name = 'ANRI GREEN（ANRIの脱炭素専門ファンド）';

UPDATE vcs SET amd_rating = 3, amd_rating_note = '製造業・建設テックに強い。DT 隣接領域、ハードウェア系 PJ で相性可。', amd_rating_updated_at = NOW() WHERE name = 'IDATEN Ventures';

UPDATE vcs SET amd_rating = 2, amd_rating_note = 'AI 特化、ディープテック一般ではない。AI 強い PJ なら可、それ以外は対象外。', amd_rating_updated_at = NOW() WHERE name = 'DEEPCORE';

UPDATE vcs SET amd_rating = 2, amd_rating_note = '幅広い CVC、DT 特化なし。スポット参加程度。', amd_rating_updated_at = NOW() WHERE name = 'SBI投資（SBI Investment）';

UPDATE vcs SET amd_rating = 2, amd_rating_note = '銀行系、幅広い。DT 専門性は中程度、大手案件で後追い参加。', amd_rating_updated_at = NOW() WHERE name = '三菱UFJキャピタル';

UPDATE vcs SET amd_rating = 2, amd_rating_note = 'AM 系、Future Fund 等で気候 DT に出資するが後期寄り。アーリーは弱い。', amd_rating_updated_at = NOW() WHERE name = 'SPARX Asset Management（SPARX Group）';

UPDATE vcs SET amd_rating = 2, amd_rating_note = '後期グロース中心。アーリー DTSU には向かない、Series B 以降の追加で出てくる可能性。', amd_rating_updated_at = NOW() WHERE name = 'JAFCO グループ';

UPDATE vcs SET amd_rating = 2, amd_rating_note = '政府系、後期寄り。シード DTSU には不向き、PoC 後の規模化で出てくる相手。', amd_rating_updated_at = NOW() WHERE name = '日本政策投資銀行（DBJ）スタートアップ・イノベーションファンド';

UPDATE vcs SET amd_rating = 1, amd_rating_note = '後期グロース専門、アーリーは対象外。', amd_rating_updated_at = NOW() WHERE name = 'JIC VGI（JICベンチャー・グロース・インベストメンツ）';

UPDATE vcs SET amd_rating = 1, amd_rating_note = 'LP 中心、直接出資少ない。AMD 案件で直接対峙する場面ほぼ無い。', amd_rating_updated_at = NOW() WHERE name = '産業革新投資機構（JIC）';

UPDATE vcs SET amd_rating = 1, amd_rating_note = 'SaaS / consumer 特化、ディープテックは対象外と言ってよい。', amd_rating_updated_at = NOW() WHERE name = 'Coral Capital';

UPDATE vcs SET amd_rating = 1, amd_rating_note = 'クロスボーダー、DT は弱い。AMD 案件と相性低い。', amd_rating_updated_at = NOW() WHERE name = 'WiL';

UPDATE vcs SET amd_rating = 1, amd_rating_note = 'グロース寄り、DT 弱い。AMD のアーリー案件には合わない。', amd_rating_updated_at = NOW() WHERE name = 'グロービス・キャピタル・パートナーズ';
