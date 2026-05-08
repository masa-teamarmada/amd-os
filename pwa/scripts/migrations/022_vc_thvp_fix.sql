-- 022_vc_thvp_fix.sql
--
-- THVP は東北大ファンド (東北大学ベンチャーパートナーズ Tohoku University Venture Partners) と
-- まさ訂正があったため修正。
-- 021 で誤って TOMY 系として登録していた。

UPDATE vcs
SET name = '東北大学ベンチャーパートナーズ',
    name_en = 'Tohoku University Venture Partners (THVP)',
    slug = 'thvp',
    type = 'university_affiliated',
    thesis = '東北大学発スタートアップ特化、サイエンス系 DT (材料 / ライフ / グリーン) を初期から伴走。',
    hq = '仙台',
    website = 'https://thvp.co.jp',
    notes = '東北大学発のディープテック VC。AMD 案件 KT / r3kt / MC 等で接点履歴あり。',
    amd_rating = 4,
    amd_rating_note = '東北大発 DT 特化、サイエンス系のアーリー / DD / リードができる。AMD と相性良い大学発 VC の 1 つ。',
    amd_rating_updated_at = NOW(),
    updated_at = NOW()
WHERE name = 'THVP';
