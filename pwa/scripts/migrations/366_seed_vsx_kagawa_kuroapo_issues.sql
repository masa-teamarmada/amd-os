-- 366_seed_vsx_kagawa_kuroapo_issues.sql
--
-- VSX / VasculaX (p26) の論点・仮説台帳に、香川大学とのクロスアポイントメント協定の
-- 現在地を登録する。香川大学は機関PJ契約前 (institutions 側は prospect) で独立PJを持たず、
-- 香川大まわりの実務は p26 に載せる。
--
-- 出典: 2026-08-26 中村綾花さん (香川大学イノベーションデザイン研究推進課) からのメールと
--       添付2点 (240221_ひな形_クロアポ協定書.docx / 様式_給与支給及び社会保険料等見込証明書.docx)、
--       2026-06-22〜06-29 の永冨先生・宮脇さんとのやりとり、
--       freee人事労務の給与明細 (2026-04〜08月払い) と freee会計の法定福利費。
--       成果物は共有ドライブ ARMADA / p26_vsx / 260826_クロアポ。
--
-- knowledge_type: fact / hypothesis / decision_needed / decision
-- status: open / validating / closed / on_hold
-- 冪等性: ON CONFLICT DO NOTHING。人が後から直した内容を上書きしない。

BEGIN;

-- p26 には管理柱が未登録で、複合FK (project_id, track) を満たせないため先に登録する。
INSERT INTO public.project_management_tracks
  (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p26', 'business_development',    '事業開発', '事業', '#315f7d', 1),
  ('p26', 'technology_development',  '技術開発', '技術', '#38745d', 2),
  ('p26', 'funding',                 '資金調達', '資金', '#bf7b2c', 3),
  ('p26', 'organizational_building', '体制構築', '体制', '#76637b', 4)
ON CONFLICT (project_id, track_key) DO NOTHING;

INSERT INTO public.project_management_issues (
  project_id, slug, track, title, knowledge_type, status,
  owner_label, due_date, last_verified_at, confidence, source_kind, source_ref, sort_order, background
)
SELECT 'p26', v.slug, v.track, v.title, v.ktype, v.status,
       v.owner, v.due_date, DATE '2026-09-04', v.confidence, 'manual', 'kagawa_kuroapo_20260826', v.sort_order, v.background
FROM (VALUES
  ('kuroapo-status', 'organizational_building',
   'クロスアポイントメント協定の現在地',
   'fact', 'open', 'まさ / きよ', NULL::date, 'high', 110,
   '2026-08-26に香川大学イノベーションデザイン研究推進課の中村さんから、今年度のクロアポ協定を進めたい旨の連絡。大学が示した順序は (1)協定書ひな形を締結可能か確認 (2)山地の給与支給及び社会保険料等見込証明書を作成して年間人件費を大学へ知らせる (3)それを踏まえて大学が協定書案を作成し、両者合意のうえ締結。(1)(2)は並行で進め、進行状況で契約開始時期を確定する建て付け。' ||
   E'\n\n' ||
   '2026-09-01時点で(2)の証明書は作成完了。共有ドライブ ARMADA / p26_vsx / 260826_クロアポ にWordとPDFを保管。大学の様式をそのまま使い、レンダリングまで確認済み。きよが内容を確認したうえで、きよから中村さんへ送付する段取り。大学にはまだ何も送っていない。(1)の協定書ひな形の内容確認は継続中。' ||
   E'\n\n' ||
   '証明書送付にあわせて、代表取締役であることと他社役員兼務の2点を大学へ伝える文面を用意している。いずれも大学が協定書案を書き始める前に伝えないと作り直しになる。'),

  ('kuroapo-effort-rate', 'organizational_building',
   'クロアポの従事割合を10分の1と10分の2のどちらにするか',
   'decision_needed', 'open', 'まさ', NULL::date, 'medium', 120,
   '大学は見込証明書の年間人件費を見てから従事割合 (エフォート率) を決める。協定書第7条は10分の1刻み。年間人件費9,671,068円と、下の年間213日を前提に半年契約で試算すると、10分の1で約48.4万円・半年で約11日 (月1.8日)、10分の2で約96.7万円・半年で約21日 (月3.6日)。1日あたりの単価はどちらも約45,400円で変わらず、割合は日数と総額を同時に決めるだけ。' ||
   E'\n\n' ||
   '判断材料は、その日数をVSXの立ち上げとPSI Step2の作業で埋められるかどうか。協定書第1条の目的が農業分野の研究推進および大学発ベンチャーの育成なので、VSXの立ち上げはそのまま香川大の業務として数えられる。埋められるなら10分の2で枠を使い切り、埋められないなら10分の1に抑える。' ||
   E'\n\n' ||
   '今年度の予算枠は10月から3月の半年で100万円という2026-05-28訪問時の見立てで、2026-08-26のメールに金額の記載はない。枠を半分残すと、永冨先生が捻出した経緯から来年度の予算拡大を頼みにくくなる可能性がある。協定書第8条2項は1勤務日を終日どちらか一方の業務に充てる建て付けなので、日数は半日単位に割れない。'),

  ('kuroapo-officer-not-employee', 'organizational_building',
   '協定書が従業員の出向前提。代表取締役をどう扱うか',
   'decision_needed', 'open', '香川大 中村さん / まさ', NULL::date, 'medium', 130,
   '大学から届いたひな形は在籍型出向として、丙が甲と雇用契約関係にある前提で書かれている。第11条は甲の就業規則を丙へ適用し、第13条は雇用保険を挙げる。まさは代表取締役で支給しているのは給与ではなく役員報酬。freee人事労務でも雇用保険と労災はいずれも非加入で0円。' ||
   E'\n\n' ||
   '証明書の送付とあわせて、この点と、本件でどのような取扱いが適切かの照会を大学へ出す。大学が協定書案を書き始めてから指摘すると作り直しになるため、順序としてここが先。'),

  ('kuroapo-agreement-open-points', 'organizational_building',
   '協定書ひな形の未処理レビュー論点',
   'decision_needed', 'open', 'まさ', NULL::date, 'medium', 140,
   '第1条の目的が農業分野の研究推進および大学発ベンチャーの育成で、永冨先生が2026-06-23に示した2段目の役割 (大学の複数シーズを対象にした技術デューデリジェンスとビフォーゼロ支援) より狭い。今年度はVSXが主戦場なので実害は小さく、広げる交渉は来年度の特任教授と予算の相談材料へ回す。' ||
   E'\n\n' ||
   '第5条2項の就業場所が高松のイノベーションデザイン研究所。リモート勤務の可否と、第8条が別に定めるとしている勤務日の記録方法が未確認。旅費は第17条2項で大学負担のため、高松往復は自己負担にならない。' ||
   E'\n\n' ||
   '第22条と第23条により乙の業務でなした成果は乙帰属。協定締結前から甲または丙が保有する知的財産とノウハウは本協定の影響を受けない旨の一文を入れてもらう。' ||
   E'\n\n' ||
   '第10条の給与等負担金の支払時期が空欄。一括か分割か、入金がいつになるかを確認する。年度末一括だとAMDが半年分を立て替える形になる。' ||
   E'\n\n' ||
   '第4条の職名は非常勤教員 (特命○○) のままでよい (2026-09-01 まさ確定)。特任教授は今年度の成果を出したら来年度検討という説明しか受けていないため、今年度は特任研究員で進める。'),

  ('kuroapo-labor-cost-basis', 'funding',
   'クロアポの金額根拠となる年間人件費',
   'fact', 'open', 'まさ', NULL::date, 'high', 150,
   '令和8年度 (2026年4月から2027年3月) のまさの人件費見込は9,671,068円。内訳は給与8,400,000円と社会保険料等の事業主負担1,271,068円。この額に大学側の従事割合を掛け、契約期間で日割りした額が協定書第10条の給与等負担金になる。' ||
   E'\n\n' ||
   '事業主負担は月額が一定ではない。4月払い116,401円、5月払いと6月払いが各117,528円、7月払い以降が102,179円。役員報酬の改定が2026年3月25日払いからで、標準報酬月額への反映が7月25日払いからのため。子ども子育て支援金は2026年4月に始まった新しい負担で、従来の子ども子育て拠出金と置き換わったものではなく上乗せされる。労災と雇用保険は役員のため非加入で0円。' ||
   E'\n\n' ||
   'freee会計の役員報酬勘定は山地ときよの2名合算 (月104万円) なので、個人の額としては使えない。個人別はfreee人事労務の給与明細から取る。各月の内訳はfreee会計の法定福利費と5か月分すべて1円まで一致することを確認済み。' ||
   E'\n\n' ||
   '協定書第7条の従事割合は甲乙双方の業務に占める割合で、他社分は分母に入らない。まさはCLGとLSTの役員を兼務し月18時間 (年約27日) を充てているため、甲乙の分母は年213日として扱う。この情報は証明書にも大学のひな形にも表れないので、伝えないと大学は年240日を分母に計算する。')
) AS v(slug, track, title, ktype, status, owner, due_date, confidence, sort_order, background)
ON CONFLICT (project_id, slug) DO NOTHING;

DO $$
DECLARE v_tracks integer; v_issues integer;
BEGIN
  SELECT count(*) INTO v_tracks FROM public.project_management_tracks WHERE project_id = 'p26';
  IF v_tracks < 4 THEN RAISE EXCEPTION 'p26の管理柱が % 本 (想定4本以上)', v_tracks; END IF;

  SELECT count(*) INTO v_issues
  FROM public.project_management_issues
  WHERE project_id = 'p26' AND deleted_at IS NULL AND slug LIKE 'kuroapo-%';
  IF v_issues <> 5 THEN RAISE EXCEPTION 'p26のクロアポ論点が % 件 (想定=5)', v_issues; END IF;
END $$;

COMMIT;
