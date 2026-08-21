"""SE (project p10) の知財台帳シード。

出典は Google Drive「SE_240521」特許棚卸しシート (2024年5月時点)。
`ip_asset_id` / `ip_right_id` を固定キーにした冪等 upsert なので、原本の更新を反映したいときは
このファイルを直して再実行する (重複行は増えない)。

  cd pwa && python3 -X utf8 scripts/seed_project_ip_p10_se.py

migration: scripts/migrations/308_project_ip_ledger.sql / 仕様: spec/3-19-project-ip-current-spec.md
"""
import json, os, re, urllib.request

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['SUPABASE_SERVICE_ROLE_KEY']

SRC = '出典: Drive「SE_240521」特許棚卸しシート（2024年5月時点）'
# 棚卸し基準日。1年以上前なので、知財タブでは全件が「要再調査」表示になる (それが正しい状態)。
VERIFIED_ON = '2024-05-31'

def A(sid, relation, title, appno, pubno, regno, applicants, status, domain, breadth, importance,
      threat=None, url=None, note='', assignee=None):
    # 年金 (特許料) は棚卸しシートに納付状況の記載が無い。分かるのは「年金不納で消滅した2件」だけ。
    # 未登録の出願は年金の対象外 (na)、登録済みは納付状況が不明 (unknown) として区別する。
    if status == 'expired':
        annuity = 'lapsed'
    elif status == 'granted':
        annuity = 'unknown'
    else:
        annuity = 'na'
    return {
        'ip_asset_id': f'ipa_se_{sid}',
        'project_id': 'p10',
        'relation': relation,
        'ip_kind': 'patent',
        'title': title,
        'jurisdiction': 'JP',
        'application_number': appno,
        'publication_number': pubno,
        'registration_number': regno,
        'applicants': applicants,
        'status': status,
        'tech_domain': domain,
        'claim_breadth': breadth,
        'importance': importance,
        'threat_level': threat,
        'confidentiality': 'internal',
        'external_url': url,
        'source_kind': 'manual',
        'annuity_status': annuity,
        'pct_status': 'unknown',
        'practice_status': 'unknown',
        'current_assignee': assignee or [],
        'last_verified_on': VERIFIED_ON,
        'note_md': note + '\n\n' + SRC,
    }

assets = [
 A('2007202305','university','無線電力受電アダプタ','2007-202305','2009-038924',None,['京都大学'],'expired','整流・受電回路',4,2,'none',
   None,'棚卸し時のステータス: 消滅（年金不納による特許権の消滅）。京大の初期出願で、現在は権利として存在しない。'),
 A('2012023857','blocking','レクテナ及びこれを用いた受電システム','2012-023857','2013-160673','特許5998501',['IHIエアロスペース'],'expired','レクテナ',4,3,'low',
   None,'棚卸し時のステータス: 消滅（年金不納による特許権の消滅）。SEは実施許諾契約を締結済だが、契約の有効期限は棚卸し時点で未確認（シート上「いつまで有効？」）。権利自体が消滅しているため実施の障害にはならない。'),
 A('2014253012','watch','レクテナ制御器','2014-253012','2016-116325',None,['IHIエアロスペース'],'abandoned','レクテナ',3,2,'none',
   None,'棚卸し時のステータス: 審査未請求。公開のみで権利化されていない。'),
 A('2015024130','watch','レクテナ装置及びレクテナ装置の故障検出方法','2015-024130','2016-149824',None,['IHIエアロスペース'],'abandoned','レクテナ',3,2,'none',
   None,'棚卸し時のステータス: 審査未請求。公開のみで権利化されていない。'),
 A('2015140999','joint','無線電力供給システム','2015-140999','2017-022949','特許6666663',['京都大学','Space Power Technologies','菊池製作所','玉置電子工業'],'granted','システム・応用',4,4,None,
   None,'棚卸し時のステータス: 有効（権利移転）。4者共同出願。ライセンス条件は棚卸し時点で未確認（シート上「？」）。',
   ['京都大学','Space Power Technologies']),
 A('2015192484','watch','レクテナ','2015-192484','2014-066404',None,['IHIエアロスペース'],'rejected','レクテナ',3,1,'none',
   None,'棚卸し時のステータス: 却下・拒絶（出願の拒絶・却下）。'),
 A('2018105942','joint','計測装置、受電装置、送電装置、および飛行システム','2018-105942','2019-211272','特許7144801',['京都大学','Space Power Technologies'],'granted','システム・応用',3,4,None,
   None,'棚卸し時のステータス: 有効（登録公報の発行）。京大との共同出願。ライセンス条件は棚卸し時点で未確認（シート上「？」）。'),
 A('2018105943','own','レクテナ装置','2018-105943','2019-213313','特許7041859',['Space Power Technologies'],'granted','レクテナ',4,5,None,
   'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-7041859/15/ja','棚卸し時のステータス: 有効（登録公報の発行）。SE単独保有の有効特許2件のうちの1件。'),
 A('2019174233','own','レクテナ装置','2019-174233','2021-052515','特許7289437',['Space Power Technologies'],'granted','レクテナ',4,5,None,
   'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-2021-052515/11/ja','棚卸し時のステータス: 有効（登録公報の発行）。SE単独保有の有効特許2件のうちの1件。'),
 A('2020176086','joint','低電力回路用入力過電圧保護回路及び低電力回路装置','2020-176086','2022-067396',None,['シーディーエヌ','Space Power Technologies'],'under_examination','保護回路',3,3,None,
   None,'棚卸し時のステータス: 審査中（手続補正）。シーディーエヌとの共同出願。'),
 A('2020182507','own','受電回路、起動回路、及び無線システム','2020-182507','2022-072845',None,['Space Power Technologies'],'under_examination','整流・受電回路',4,4,None,
   None,'棚卸し時のステータス: 審査中（審査請求）。自己評価◎「出願人でありライセンスも確保可能でリスクなし」。'),
 A('2021209635','own','レクテナアレイ装置','2021-209635','2021-209635',None,['Space Power Technologies'],'published','レクテナ',3,4,None,
   None,'棚卸し時のステータス: 審査請求前（公開公報の発行）。自己評価◎「出願人でありライセンスも確保可能でリスクなし」。**審査請求期限（出願から3年）の現況を要確認**。'),
 A('2022065070','joint','データ送信装置、データ回収装置、及びデータ回収システム','2022-065070','2023-155634',None,['拓和','Space Power Technologies'],'published','システム・応用',3,3,None,
   None,'棚卸し時のステータス: 審査請求前（公開公報の発行）。拓和との共同出願。自己評価◎「出願人でありライセンスも確保可能でリスクなし」。**審査請求期限（出願から3年）の現況を要確認**。'),
]

def R(rid, aid, holder_kind, holder_name, license_to='none', agreement='none', note=''):
    """権利者行。PostgRESTの一括POSTは全要素のキー集合が一致している必要があるので、必ずこの関数で作る。"""
    return {'ip_right_id': rid, 'ip_asset_id': aid, 'holder_kind': holder_kind,
            'holder_name': holder_name, 'share_pct': None,
            'license_to_project': license_to, 'license_agreement_status': agreement,
            'royalty_terms': None, 'non_practice_compensation': None, 'contract_id': None,
            'note': note + SRC}

rights = [
 R('ipr_se_2012023857_ihia', 'ipa_se_2012023857', 'partner_company', 'IHIエアロスペース',
   'non_exclusive', 'executed',
   'SEが実施許諾契約を締結済。有効期限は棚卸し時点で未確認。特許権自体は年金不納で消滅。'),
 R('ipr_se_2015140999_ku', 'ipa_se_2015140999', 'university', '京都大学',
   note='共同出願人。実施許諾条件・不実施補償は棚卸し時点で未確認。'),
 R('ipr_se_2015140999_se', 'ipa_se_2015140999', 'project_company', 'Space Power Technologies',
   note='共同出願人（権利移転により取得）。'),
 R('ipr_se_2018105942_ku', 'ipa_se_2018105942', 'university', '京都大学',
   note='共同出願人。実施許諾条件・不実施補償は棚卸し時点で未確認。'),
 R('ipr_se_2018105942_se', 'ipa_se_2018105942', 'project_company', 'Space Power Technologies',
   note='共同出願人。'),
]

def post(table, rows):
    req = urllib.request.Request(
        f'{URL}/rest/v1/{table}?on_conflict={"ip_asset_id" if table.endswith("assets") else "ip_right_id"}',
        data=json.dumps(rows, ensure_ascii=False).encode('utf-8'),
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}',
                 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation'},
        method='POST')
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

try:
    a = post('project_ip_assets', assets)
    print('assets upserted:', len(a))
    r = post('project_ip_rights', rights)
    print('rights upserted:', len(r))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode()[:800])
