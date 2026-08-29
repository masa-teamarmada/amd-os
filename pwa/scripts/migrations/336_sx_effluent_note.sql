-- 336: 排液のメモ欄と、成分バッジのプルダウン語彙への正規化
--
-- 2026-08-29 まさ「モーダルの中のバッジがプルダウン選択にないものになってるから、
-- プルダウン選択のいずれかにして。あとカラム最下部にメモ欄も追加してほしい」。
--
-- これまで effluent_components には議事録の作文がそのまま入っており、読点で切られた
-- 文の断片がバッジとして表示されていた。成分は SX_EFFLUENT_COMPONENT_CHOICES の語彙
-- だけを持つ列にし、語彙へ収まらない作文は新設の effluent_note (メモ) へ移す。
-- 本文に書かれている成分名は sxSplitEffluentComponents と同じ判定で拾い直す。
-- 作文は1文字も捨てず、メモが空の行にだけ書き込む (再実行しても二重にならない)。

alter table project_management_partners
  add column if not exists effluent_note text;

comment on column project_management_partners.effluent_note is
  '排液まわりの自由メモ。定型語彙 (effluent_components) へ収まらない話はここへ書く';

-- 日本食研
update project_management_partners set effluent_components = 'リン,窒素,油分', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '油水分離後から調整槽流入部付近の食品製造排液（油分・リン・窒素の影響を含む）' else effluent_note end where id = '628c0fc7-b504-462f-a35d-cc0fddf3753f' and effluent_components = '油水分離後から調整槽流入部付近の食品製造排液（油分・リン・窒素の影響を含む）';
-- 神戸工業試験場
update project_management_partners set effluent_components = null, effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '受領済み排液の分析では重金属がほとんど検出されなかった' else effluent_note end where id = '51cbc357-cd3f-433b-bd65-05595308bf8f' and effluent_components = '受領済み排液の分析では重金属がほとんど検出されなかった';
-- メイト: 語彙のみ、変更なし (Nd, Dy)
-- ヤマキ
update project_management_partners set effluent_components = 'COD,BOD,リン,油分', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '固体製品工場はリン負荷、液体製品工場はBOD/CODと油分。薬剤でリンを凝集する運用' else effluent_note end where id = 'c334eb40-361f-4bf5-c13d-53bf72e6e003' and effluent_components = '固体製品工場はリン負荷、液体製品工場はBOD/CODと油分。薬剤でリンを凝集する運用';
-- ハタダ
update project_management_partners set effluent_components = 'COD,BOD,リン,窒素,油分,SS', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '油分（原水のノルマルヘキサン37）、BOD 8.3×10²・COD 4.2×10²。放流水はBOD 0.7・COD 7.5・SS 4・窒素17・リン2.6。重金属の話は出ていない' else effluent_note end where id = '61dad0d7-e612-436c-99c5-391fd908b821' and effluent_components = '油分（原水のノルマルヘキサン37）、BOD 8.3×10²・COD 4.2×10²。放流水はBOD 0.7・COD 7.5・SS 4・窒素17・リン2.6。重金属の話は出ていない';
-- 日本ゼオン
update project_management_partners set effluent_components = 'Ni,Pb,Cr,Mn,Al,COD', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '触媒分離後の水相にニッケルが数百ppm。活性汚泥へ入る排水には鉛・マンガン・クロムが低濃度で含まれ、ケースによりニッケル・アルミも。高CODや毒性を持つ系統もある' else effluent_note end where id = 'e487371c-774d-4bb7-a90c-39328fe6d88f' and effluent_components = '触媒分離後の水相にニッケルが数百ppm。活性汚泥へ入る排水には鉛・マンガン・クロムが低濃度で含まれ、ケースによりニッケル・アルミも。高CODや毒性を持つ系統もある';
-- オカベ
update project_management_partners set effluent_components = '色度,糖分', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '砂糖・醤油ベースの調味液が中心。糖分ばかりで分解対象となる成分がなく、色度が課題' else effluent_note end where id = 'b223da3f-250e-4ae4-b02c-42ae61d5df02' and effluent_components = '砂糖・醤油ベースの調味液が中心。糖分ばかりで分解対象となる成分がなく、色度が課題';
-- マルトモ
update project_management_partners set effluent_components = 'COD,BOD,リン,塩分', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then '中華わかめの緑色合成着色料でCODが悪化。BOD/COD・リンが基準超過。だしの素工程は塩分が最大20%と高い' else effluent_note end where id = 'a112c92e-149d-4fd3-a91b-31fd50c4ce01' and effluent_components = '中華わかめの緑色合成着色料でCODが悪化。BOD/COD・リンが基準超過。だしの素工程は塩分が最大20%と高い';
-- ユナイテッドシルク
update project_management_partners set effluent_components = 'BOD', effluent_note = case when effluent_note is null or btrim(effluent_note) = '' then 'タンパク質由来の低分子有機物がBOD源の可能性。詳細成分・濃度は未確認。' else effluent_note end where id = '7f432fc7-00df-40c9-bef7-5d2d616a04ff' and effluent_components = 'タンパク質由来の低分子有機物がBOD源の可能性。詳細成分・濃度は未確認。';
