"""SE (project p10) の知財台帳シード。

出典は2本立て。

- **権利の現況 (出願人・現在の権利者・登録番号・日付・年金): J-PlatPat 照会 (2026-08-27)**。
  出願番号ごとに番号照会し、権利が動いている案件は経過情報の「出願情報」「登録情報」まで開いて
  出願人記事・権利者記事を読んだ。ここが正本。
- 実施許諾契約の有無・自己評価など、公報に出ない情報のみ Google Drive「SE_240521」特許棚卸しシート
  (2024年5月時点) から引く。

2026-08-27 の照会で、2024年5月のシートから起こした初版に次の誤りが見つかったので全面的に置き換えた。

1. **出願人の社名が違っていた**。8件を「Space Power Technologies」としていたが、J-PlatPat の出願人記事は
   7件が **株式会社翔エンジニアリング (識別番号 518195771)**。SPT が出願人なのは 2018-105943 の1件だけで、
   これも2018年の出願時は翔エンジニアリングで、2020/07/02 の出願人名義変更届で SPT へ移っている。
2. **2件は出願番号の欄に公開番号が入っていた**。2012-023857 と 2015-192484 は公開番号で、
   出願番号として J-PlatPat を引くと別分野の他社特許 (凸版印刷「紙カップフランジ段差測定器」/
   三共「仮設足場用足場板」) に当たる。正しい出願番号は 2010-159720 と 2014-066404。
3. **IHIエアロスペースのレクテナ特許は消滅していない**。5686540 / 6389114 / 6414978 の3件が有効。
4. **翔エンジニアリング名義の案件が4件漏れていた** (2025-012236 / 2025-012229 / 2013-225976 / 2012-098183)。
5. **2026年7月に特許7041859 と 特許6666663 が競合のエイターリンク株式会社へ移転していた**。

`ip_asset_id` / `ip_right_id` を固定キーにした冪等 upsert なので、原本の更新を反映したいときは
このファイルを直して再実行する (重複行は増えない)。出願番号を正した2件は ID が変わるので、
旧 ID の行を DELETE してから upsert する。

  cd pwa && python3 -X utf8 scripts/seed_project_ip_p10_se.py

migration: scripts/migrations/308_project_ip_ledger.sql / 仕様: spec/3-19-project-ip-current-spec.md
"""
import json, os, re, urllib.parse, urllib.request

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['SUPABASE_SERVICE_ROLE_KEY']

JPP = '出典: J-PlatPat 照会（2026-08-27）'
SHEET = '出典: Drive「SE_240521」特許棚卸しシート（2024年5月時点）'
# J-PlatPat で権利の現況を確認した日。
VERIFIED_ON = '2026-08-27'

SE = '株式会社翔エンジニアリング'


def jpp_url(regno, pubno):
    """J-PlatPat の固定アドレス。登録済みは特許公報 (/15/)、未登録は公開公報 (/11/)。"""
    if regno:
        return f'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-{regno}/15/ja'
    return f'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-{pubno}/11/ja'


def A(relation, title, appno, pubno, regno, applicants, status, domain, breadth, importance,
      threat=None, note='', assignee=None, annuity='unknown', app_date=None, pub_date=None,
      reg_date=None, expiry=None, inventors=None):
    return {
        'ip_asset_id': 'ipa_se_' + appno.replace('-', ''),
        'project_id': 'p10',
        'relation': relation,
        'ip_kind': 'patent',
        'title': title,
        'jurisdiction': 'JP',
        'application_number': appno,
        'publication_number': pubno,
        'registration_number': regno,
        'application_date': app_date,
        'publication_date': pub_date,
        'registration_date': reg_date,
        'expiry_date': expiry,
        'applicants': applicants,
        'inventors': inventors or [],
        'status': status,
        'tech_domain': domain,
        'claim_breadth': breadth,
        'importance': importance,
        'threat_level': threat,
        'confidentiality': 'internal',
        'external_url': jpp_url(regno, pubno),
        'source_kind': 'manual',
        'annuity_status': annuity,
        'pct_status': 'unknown',
        'practice_status': 'unknown',
        'current_assignee': assignee or [],
        'last_verified_on': VERIFIED_ON,
        'note_md': note,
    }


assets = [
 # ── 翔エンジニアリングが現に権利者である登録特許 (6件) ────────────────────────────
 A('own', '受電回路、起動回路、及び無線システム', '2020-182507', '2022-072845', '特許7544374',
   [SE], 'granted', '整流・受電回路', 4, 5, None,
   'J-PlatPat の権利者記事は 株式会社翔エンジニアリング（518195771）の単独。'
   '**SEが単独で保有する唯一の登録特許**。請求項11、2024/08/26 登録、存続期間満了日 2040/10/30、3年分納付済。\n\n'
   '発明者は藤原暉雄・長谷川和雄・青木勝・野田龍三。\n\n' + JPP,
   annuity='paid', app_date='2020-10-30', pub_date='2022-05-17', reg_date='2024-08-26',
   expiry='2040-10-30', inventors=['藤原暉雄', '長谷川和雄', '青木勝', '野田龍三']),

 A('joint', 'レクテナアレイ装置', '2021-209635', '2023-094257', '特許7754416',
   [SE, '国立大学法人佐賀大学', '国立研究開発法人宇宙航空研究開発機構'], 'granted', 'レクテナ', 3, 4, None,
   'J-PlatPat の権利者記事は 翔エンジニアリング・佐賀大学・JAXA の3者。請求項3、'
   '存続期間満了日 2041/12/23、3年分納付済。\n\n'
   '**JAXAとの共同保有**。発明者は藤原暉雄・牧野克省（JAXA）・豊田一彦・西山英輔（佐賀大）。\n\n' + JPP,
   annuity='paid', app_date='2021-12-23', pub_date='2023-07-05', expiry='2041-12-23',
   inventors=['藤原暉雄', '牧野克省', '豊田一彦', '西山英輔']),

 A('joint', 'レクテナ装置', '2019-174233', '2021-052515', '特許7289437',
   ['国立大学法人東京科学大学', SE], 'granted', 'レクテナ', 4, 5, None,
   'J-PlatPat の権利者記事は 東京科学大学（旧東京工業大学）と翔エンジニアリングの2者。請求項5、'
   '2023/06/02 登録、存続期間満了日 2039/09/25、4年分納付済。\n\n'
   'エイターリンクへ移った特許7041859と同じ「レクテナ装置」の系列で、**SEの手元に残っているレクテナの権利**。'
   '発明者は戸村崇・広川二郎（東京科学大）・藤原暉雄・古川実。\n\n' + JPP,
   annuity='paid', app_date='2019-09-25', pub_date='2021-04-01', reg_date='2023-06-02',
   expiry='2039-09-25', inventors=['戸村崇', '広川二郎', '藤原暉雄', '古川実']),

 A('joint', '計測装置、受電装置、送電装置、および飛行システム', '2018-105942', '2019-211272', '特許7144801',
   ['国立大学法人京都大学', SE], 'granted', 'システム・応用', 3, 4, None,
   'J-PlatPat の権利者記事は 京都大学と翔エンジニアリングの2者。請求項10、2022/09/21 登録、'
   '存続期間満了日 2038/06/01、4年分納付済。\n\n'
   '発明者は篠原真毅（京大）と藤原暉雄。実施許諾条件・不実施補償は未確認。\n\n' + JPP,
   annuity='paid', app_date='2018-06-01', pub_date='2019-12-12', reg_date='2022-09-21',
   expiry='2038-06-01', inventors=['篠原真毅', '藤原暉雄']),

 A('joint', '低電力回路用入力過電圧保護回路及び低電力回路装置', '2020-176086', '2022-067396', '特許7545140',
   [SE, '株式会社シーディエヌ'], 'granted', '保護回路', 3, 3, None,
   'J-PlatPat の権利者記事は 翔エンジニアリングとシーディエヌの2者。請求項5、'
   '存続期間満了日 2040/10/20、3年分納付済。\n\n'
   '発明者は野田龍三（シーディエヌ）と藤原暉雄。\n\n' + JPP,
   annuity='paid', app_date='2020-10-20', pub_date='2022-05-06', expiry='2040-10-20',
   inventors=['野田龍三', '藤原暉雄']),

 A('joint', 'データ送信装置、データ回収装置、及びデータ回収システム', '2022-065070', '2023-155634', '特許7817697',
   [SE, '株式会社拓和'], 'granted', 'システム・応用', 3, 3, None,
   'J-PlatPat の権利者記事は 翔エンジニアリングと拓和の2者。請求項6、'
   '存続期間満了日 2042/04/11、3年分納付済。\n\n'
   '発明者は藤原暉雄・長谷川和雄（SE）と奥田満紀子・飯島義明・沼口太一（拓和）。\n\n' + JPP,
   annuity='paid', app_date='2022-04-11', pub_date='2023-10-23', expiry='2042-04-11',
   inventors=['藤原暉雄', '長谷川和雄', '奥田満紀子', '飯島義明', '沼口太一']),

 # ── 翔エンジニアリング名義で係属中の出願 (2件・審査請求前) ──────────────────────
 A('joint', '電子回路及びデータ収集システム', '2025-012236', '2026-128138', None,
   [SE, '株式会社ディエステクノロジー', '株式会社シーディエヌ'], 'published', 'システム・応用', 3, 3, None,
   'J-PlatPat の出願人記事は 翔エンジニアリング・ディエステクノロジー・シーディエヌの3者。'
   '2025/01/28 出願、2026/08/07 公開、審査請求前（査定なし）。請求項9。\n\n'
   '**審査請求期限は出願から3年の 2028/01/28**。発明者は藤原暉雄・岸本篤始・長谷川和雄・青木勝・野田龍三。\n\n' + JPP,
   annuity='na', app_date='2025-01-28', pub_date='2026-08-07',
   inventors=['藤原暉雄', '岸本篤始', '長谷川和雄', '青木勝', '野田龍三']),

 A('joint', '電子機器', '2025-012229', '2026-128132', None,
   [SE, '株式会社ディエステクノロジー', '株式会社シーディエヌ'], 'published', 'システム・応用', 3, 3, None,
   'J-PlatPat の出願人記事は 翔エンジニアリング・ディエステクノロジー・シーディエヌの3者。'
   '2025/01/28 出願、2026/08/07 公開、審査請求前（査定なし）。請求項7。\n\n'
   '**審査請求期限は出願から3年の 2028/01/28**。発明者は 2025-012236 と同じ。\n\n' + JPP,
   annuity='na', app_date='2025-01-28', pub_date='2026-08-07',
   inventors=['藤原暉雄', '岸本篤始', '長谷川和雄', '青木勝', '野田龍三']),

 # ── SEが出願したが競合のエイターリンクへ移った権利 (2件) ────────────────────────
 A('blocking', 'レクテナ装置', '2018-105943', '2019-213313', '特許7041859',
   ['株式会社Space Power Technologies'], 'granted', 'レクテナ', 4, 5, 'high',
   '**この権利はSEのものではない**。2018/06/01 に翔エンジニアリングが単独で出願し（公開公報の出願人は翔エンジニアリング）、'
   '2020/07/02 の出願人名義変更届で 株式会社Space Power Technologies（519416853）へ移り、'
   '2026/07/03 の本権移転登録申請書（譲渡）を経て 2026/07/28 に **エイターリンク株式会社**（東京都千代田区）へ移転した。\n\n'
   'SPT・エイターリンクはいずれも `project_knowledge` の競合マップでマイクロ波方式の直接競合として記録されている。'
   '発明者は古川実と藤原暉雄（SE代表）で、**SEの中核技術が競合の権利になっている**。'
   '請求項4、2022/03/16 登録、存続期間満了日 2038/06/01、5年分納付済。\n\n' + JPP,
   assignee=['エイターリンク株式会社'], annuity='paid', app_date='2018-06-01', pub_date='2019-12-12',
   reg_date='2022-03-16', expiry='2038-06-01', inventors=['古川実', '藤原暉雄']),

 A('blocking', '無線電力供給システム', '2015-140999', '2017-022949', '特許6666663',
   ['国立大学法人京都大学', '玉置電子工業株式会社', SE, '株式会社菊池製作所'], 'granted', 'システム・応用', 4, 4, 'high',
   '**この権利はSEのものではない**。出願人記事は 京都大学・玉置電子工業・翔エンジニアリング・菊池製作所の4者だが、'
   '登録情報の権利者記事は **エイターリンク株式会社の単独**（更新日付 2026/07/29）。'
   '4者の持分がすべて競合へ移っている。\n\n'
   '請求項11、存続期間満了日 2035/07/15、7年分納付済。発明者は三谷友彦（京大）・玉置賀浩・小野晃義・'
   '岸本篤始・藤原暉雄・小川重行・野波健蔵。\n\n' + JPP,
   assignee=['エイターリンク株式会社'], annuity='paid', app_date='2015-07-15', pub_date='2017-01-26',
   expiry='2035-07-15',
   inventors=['三谷友彦', '玉置賀浩', '小野晃義', '岸本篤始', '藤原暉雄', '小川重行', '野波健蔵']),

 # ── 他社が持つ、同分野の有効な権利 (3件) ──────────────────────────────────────
 A('blocking', 'レクテナ及びこれを用いた受電システム', '2010-159720', '2012-023857', '特許5686540',
   ['株式会社ＩＨＩエアロスペース'], 'granted', 'レクテナ', 4, 3, 'medium',
   '**有効な権利**（年金の支払い）。台帳の初版は出願番号の欄に公開番号 2012-023857 を入れていたため、'
   'J-PlatPat で別の特許（凸版印刷「紙カップフランジ段差測定器と測定方法」特許5998501）に当たり、'
   '「年金不納で消滅」と記録していた。正しい出願番号は 2010-159720。\n\n'
   'SEは実施許諾契約を締結済だが、契約の有効期限は棚卸し時点で未確認（シート上「いつまで有効？」）。'
   '**権利が生きているので、許諾契約の現況を確認する必要がある**。\n\n' + JPP + ' / ' + SHEET,
   annuity='paid', app_date='2010-07-14', pub_date='2012-02-02'),

 A('blocking', 'レクテナ制御器', '2014-253012', '2016-116325', '特許6389114',
   ['株式会社ＩＨＩエアロスペース'], 'granted', 'レクテナ', 3, 3, 'medium',
   '**有効な権利**（年金の支払い）。台帳の初版は「審査未請求・公開のみで権利化されていない」としていたが、'
   'J-PlatPat では特許6389114 として登録され、年金が納付されている。\n\n' + JPP,
   annuity='paid', app_date='2014-12-15', pub_date='2016-06-23'),

 A('blocking', 'レクテナ装置及びレクテナ装置の故障検出方法', '2015-024130', '2016-149824', '特許6414978',
   ['株式会社ＩＨＩエアロスペース'], 'granted', 'レクテナ', 3, 3, 'medium',
   '**有効な権利**（年金の支払い）。台帳の初版は「審査未請求・公開のみで権利化されていない」としていたが、'
   'J-PlatPat では特許6414978 として登録され、年金が納付されている。\n\n' + JPP,
   annuity='paid', app_date='2015-02-10', pub_date='2016-08-18'),

 # ── 大学の初期出願 (消滅) ──────────────────────────────────────────────────
 A('university', '無線電力受電アダプタ', '2007-202305', '2009-038924', '特許5455174',
   ['国立大学法人京都大学'], 'expired', '整流・受電回路', 4, 2, 'none',
   '京大の初期出願。特許5455174 として登録されたが、年金不納で消滅している。'
   '権利として存在しないので実施の障害にはならない。\n\n' + JPP,
   annuity='lapsed', app_date='2007-08-02', pub_date='2009-02-19'),

 # ── 権利化されなかった出願 (3件) ───────────────────────────────────────────
 A('watch', 'レクテナ', '2014-066404', '2015-192484', None,
   ['株式会社ＩＨＩエアロスペース'], 'rejected', 'レクテナ', 3, 1, 'none',
   '却下・拒絶（出願の拒絶・却下）。権利は存在しない。台帳の初版は出願番号の欄に公開番号 2015-192484 を'
   '入れていたため、J-PlatPat で別の特許（三共「仮設足場用足場板」）に当たっていた。'
   '正しい出願番号は 2014-066404。\n\n' + JPP,
   annuity='na', app_date='2014-03-27', pub_date='2015-11-02'),

 A('watch', 'レクテナ装置', '2013-225976', '2015-089239', None,
   ['日本電業工作株式会社', SE], 'rejected', 'レクテナ', 3, 1, 'none',
   '却下・拒絶（出願の拒絶・却下）。権利は存在しない。'
   '**翔エンジニアリングが出願人に入っている案件で、台帳の初版には載っていなかった**。'
   '日本電業工作との共同出願で、SEが2013年時点でレクテナの出願をしていた記録として残す。\n\n' + JPP,
   annuity='na', app_date='2013-10-30', pub_date='2015-05-07'),

 A('watch', 'レクテナ装置', '2012-098183', '2013-226020', None,
   ['日本電業工作株式会社', SE], 'rejected', 'レクテナ', 3, 1, 'none',
   '却下・拒絶（出願の拒絶・却下）。権利は存在しない。'
   '**翔エンジニアリングが出願人に入っている案件で、台帳の初版には載っていなかった**。'
   '日本電業工作との共同出願。SEのレクテナ出願としては最も古い（2012/04/23）。\n\n' + JPP,
   annuity='na', app_date='2012-04-23', pub_date='2013-10-31'),
]


def R(rid, aid, holder_kind, holder_name, license_to='none', agreement='none', note=''):
    """権利者行。PostgRESTの一括POSTは全要素のキー集合が一致している必要があるので、必ずこの関数で作る。"""
    return {'ip_right_id': rid, 'ip_asset_id': aid, 'holder_kind': holder_kind,
            'holder_name': holder_name, 'share_pct': None,
            'license_to_project': license_to, 'license_agreement_status': agreement,
            'royalty_terms': None, 'non_practice_compensation': None, 'contract_id': None,
            'note': note}

rights = [
 R('ipr_se_2020182507_se', 'ipa_se_2020182507', 'project_company', SE,
   note='単独の権利者。' + JPP),
 R('ipr_se_2021209635_se', 'ipa_se_2021209635', 'project_company', SE,
   note='共有の権利者（佐賀大学・JAXAと3者）。' + JPP),
 R('ipr_se_2021209635_saga', 'ipa_se_2021209635', 'university', '国立大学法人佐賀大学',
   note='共有の権利者。実施許諾条件・不実施補償は未確認。' + JPP),
 R('ipr_se_2021209635_jaxa', 'ipa_se_2021209635', 'other', '国立研究開発法人宇宙航空研究開発機構',
   note='共有の権利者。実施許諾条件・不実施補償は未確認。' + JPP),
 R('ipr_se_2019174233_se', 'ipa_se_2019174233', 'project_company', SE,
   note='共有の権利者（東京科学大学と2者）。' + JPP),
 R('ipr_se_2019174233_isct', 'ipa_se_2019174233', 'university', '国立大学法人東京科学大学',
   note='共有の権利者。実施許諾条件・不実施補償は未確認。' + JPP),
 R('ipr_se_2018105942_se', 'ipa_se_2018105942', 'project_company', SE,
   note='共有の権利者（京都大学と2者）。' + JPP),
 R('ipr_se_2018105942_ku', 'ipa_se_2018105942', 'university', '国立大学法人京都大学',
   note='共有の権利者。実施許諾条件・不実施補償は未確認。' + JPP),
 R('ipr_se_2020176086_se', 'ipa_se_2020176086', 'project_company', SE,
   note='共有の権利者（シーディエヌと2者）。' + JPP),
 R('ipr_se_2020176086_cdn', 'ipa_se_2020176086', 'partner_company', '株式会社シーディエヌ',
   note='共有の権利者。' + JPP),
 R('ipr_se_2022065070_se', 'ipa_se_2022065070', 'project_company', SE,
   note='共有の権利者（拓和と2者）。' + JPP),
 R('ipr_se_2022065070_takuwa', 'ipa_se_2022065070', 'partner_company', '株式会社拓和',
   note='共有の権利者。' + JPP),
 R('ipr_se_2018105943_atl', 'ipa_se_2018105943', 'other', 'エイターリンク株式会社',
   note='現在の権利者。2026/07/28 に移転登録済。SEが2018年に単独出願した権利が競合へ渡っている。' + JPP),
 R('ipr_se_2015140999_atl', 'ipa_se_2015140999', 'other', 'エイターリンク株式会社',
   note='現在の単独の権利者（更新日付 2026/07/29）。出願人だった京大・玉置電子工業・翔エンジニアリング・'
        '菊池製作所の持分がすべて移っている。' + JPP),
 R('ipr_se_2010159720_ihia', 'ipa_se_2010159720', 'partner_company', '株式会社ＩＨＩエアロスペース',
   'non_exclusive', 'executed',
   'SEが実施許諾契約を締結済。有効期限は棚卸し時点で未確認。**特許5686540 は有効なので契約の現況確認が要る**。'
   + JPP + ' / ' + SHEET),
]

# 出願番号の欄に公開番号が入っていた2件は ip_asset_id が変わる。旧 ID の行を先に消す。
# あわせて、SPT を「PJ法人の権利者」として登録していた旧行と、エイターリンクへ移った案件の
# 旧権利者行も消す (現在の権利者は上の rights で作り直す)。
STALE_ASSETS = ['ipa_se_2012023857', 'ipa_se_2015192484']
STALE_RIGHTS = ['ipr_se_2012023857_ihia', 'ipr_se_2015140999_ku', 'ipr_se_2015140999_se']


def req(method, path, body=None):
    r = urllib.request.Request(
        f'{URL}/rest/v1/{path}',
        data=json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None,
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}',
                 'Content-Type': 'application/json',
                 'Prefer': 'resolution=merge-duplicates,return=representation'},
        method=method)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else []


def post(table, rows):
    key = 'ip_asset_id' if table.endswith('assets') else 'ip_right_id'
    return req('POST', f'{table}?on_conflict={key}', rows)


def delete(table, key, ids):
    if not ids:
        return []
    q = urllib.parse.quote(f'in.({",".join(ids)})', safe='(),.')
    return req('DELETE', f'{table}?{key}={q}')


try:
    # 権利者行 → 資産行の順に消す (資産を先に消すと ip_asset_id の参照が外れる)。
    dr = delete('project_ip_rights', 'ip_right_id', STALE_RIGHTS)
    print('stale rights deleted:', len(dr))
    da = delete('project_ip_assets', 'ip_asset_id', STALE_ASSETS)
    print('stale assets deleted:', len(da))
    a = post('project_ip_assets', assets)
    print('assets upserted:', len(a))
    r = post('project_ip_rights', rights)
    print('rights upserted:', len(r))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode()[:800])
