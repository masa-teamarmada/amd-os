"""LST (project p07 / 株式会社LiSTie) の知財台帳シード。

まさの依頼 (2026-09-30)「知財タブ（特許を1件ずつ並べる台帳）…うん、やっておいてほしい」。

出典は3本立て。

- **公開・登録された権利: Google Patents と J-PlatPat の照会 (2026-09-30)**。
  Google Patents で QST（量子科学技術研究開発機構）・星野毅・出光興産のリチウム回収の出願を洗い出し、
  日本の登録特許は J-PlatPat の固定アドレスで「特許 有効／消滅」と年金の状態を確かめた。
  登録日（設定登録日）は J-PlatPat の経過情報まで開いていないので空欄にし、特許公報の発行日を備考に書いた。
- **LiSTie 自身の出願: 経営会議・取締役会の記録 (Notion の文字起こし、2025-11〜2026-09)**。
  2026-09-30 時点で公開前のため、出願番号・出願日・正式な発明の名称は無い。題名は会議での呼び方。
  2026年8月取締役会資料の「コア特許10件の目標に対し9件出願済み」＝ 国内4件（うち3件をPCT化）＋ 新規の国内4件 ＋ QSTとの共同出願1件。
- 立場（relation）の判断: QST・原子力機構の出願は university。QST と第三者の共有は、LiSTie が使うには
  共有者全員の同意が要り得るので blocking。第三者の単独出願は、LiSTie の工程と重なり得るものを blocking、
  それ以外を watch。**抵触するかどうかは判断していない**（備考の「確かめること」を弁理士に確認する）。

QST の関連特許の件数: 会社紹介資料は「QST特許24件」、2026-07-08 の経営会議は「全5件（スタック関連4件）」。
ここで確かめたQSTの出願の系統は 2013・2016・2019（2つ）・2023 の5つで、国ごとに数えると20件を超える。
24件は国別、5件は系統の数え方とみられる（技術タブ「特許と出願」の要確認の行）。

`ip_asset_id` などを固定キーにした冪等 upsert なので、照会し直したらこのファイルを直して再実行する。

  cd pwa && python3 -X utf8 scripts/seed_project_ip_p07_lst.py

仕様: spec/3-19-project-ip-current-spec.md
"""
import json, urllib.request

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['SUPABASE_SERVICE_ROLE_KEY']

VERIFIED_ON = '2026-09-30'
SRC = '出典: Google Patents・J-PlatPat 照会（2026-09-30）'
MTG = '出典: LiSTie 経営会議・取締役会の記録（Notion の文字起こし）'

QST = '国立研究開発法人量子科学技術研究開発機構'
IDM = '出光興産株式会社'
JAEA = '国立研究開発法人日本原子力研究開発機構'
LST = '株式会社LiSTie'

DOMAINS = {
    'membrane': '膜（選択透過膜）',
    'cell': 'セル・電極',
    'operation': '装置・運転条件',
    'pre': '前処理（溶出・アルカリ化）',
    'post': '後処理（水酸化リチウム）',
    'li6': 'リチウム6',
}


def jpp(regno):
    return f'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-{regno}/15/ja'


def gp(pubno, lang='ja'):
    return f'https://patents.google.com/patent/{pubno}/{lang}'


def A(aid, relation, title, jur, appno, pubno, regno, applicants, status, domain, breadth, importance,
      threat=None, note='', assignee=None, annuity='unknown', pct='unknown', app_date=None, pub_date=None,
      expiry=None, priority=None, inventors=None, family_key=None, family_size=None, url=None, ipc=None,
      practice='unknown', confidentiality='internal', kind='patent'):
    """資産行。PostgREST の一括 POST は全要素のキー集合が一致している必要があるので、必ずこの関数で作る。

    SE（p10）と同じ決まり: current_assignee は出願人と現在の権利者が違うときだけ入れる（今回は該当なし）。
    expiry_date は登録情報の存続期間満了日を読めたものだけに入れる。Google Patents の「満了の見込み」は
    出願日からの推定なので列には入れず、備考に書く。
    """
    if expiry:
        note = note.replace('\n\n' + SRC, f'\n\n満了の見込み: {expiry}（Google Patents の推定。存続期間満了日は J-PlatPat の登録情報で未確認）。\n\n' + SRC, 1)
    if assignee and sorted(assignee) == sorted(applicants):
        assignee = []
    return {
        'ip_asset_id': aid, 'project_id': 'p07', 'relation': relation, 'ip_kind': kind, 'title': title,
        'jurisdiction': jur, 'application_number': appno, 'publication_number': pubno,
        'registration_number': regno, 'application_date': app_date, 'publication_date': pub_date,
        'registration_date': None, 'expiry_date': None, 'priority_date': priority,
        'applicants': applicants, 'inventors': inventors or [], 'status': status,
        'tech_domain': DOMAINS[domain], 'claim_breadth': breadth, 'importance': importance,
        'threat_level': threat, 'confidentiality': confidentiality, 'external_url': url,
        'source_kind': 'manual', 'annuity_status': annuity, 'pct_status': pct,
        'practice_status': practice, 'current_assignee': assignee or [], 'last_verified_on': VERIFIED_ON,
        'family_key': family_key, 'family_size': family_size, 'ipc_codes': ipc or [], 'note_md': note,
    }


assets = [
 # ── QST の基本特許（LiSMIC の出どころ）──────────────────────────────────────
 A('ipa_lst_jp6818334', 'university', 'リチウム選択透過膜、リチウム回収装置、リチウム回収方法、水素製造方法',
   'JP', '2016-015423', '特開2017-131863', '特許6818334', [QST], 'granted', 'membrane', 4, 5, 'none',
   '**LiSMIC の中核特許**。LLTO（リチウム・ランタン・チタンの酸化物）を主体とする膜の表面に、酸処理などでリチウムを'
   '吸着する層を作って回収速度を大きく上げる。請求項15（膜、回収装置、pHを上げてから回収する方法、回収液に炭酸ガスを通す方法、'
   '回収と同時に水素を作る方法）。\n\n'
   'J-PlatPat: 特許 有効・年金納付（年金領収書 2024-01-05）。特許公報の発行 2021-01-20。'
   '同じ系統の外国出願: 米国 US10689766B2（2020-06-23 登録）、韓国 KR102064692B1、オーストラリア AU2017212260、'
   'チリ CL2018002018、国際出願 PCT/JP2017/002612。\n\n'
   '確かめること: LiSTie への実施許諾の内容（範囲・対価）は資料で未確認。\n\n' + SRC,
   assignee=[QST], annuity='paid', pct='national_phase', app_date='2016-01-29', pub_date='2017-08-03',
   expiry='2036-01-29', priority='2016-01-29', inventors=['星野毅'], family_key='qst-2016-llto-membrane',
   family_size=6, url=jpp('6818334'), ipc=['B01D61/44'], practice='practicing'),

 A('ipa_lst_jp6233877', 'university', '金属イオン回収装置、金属イオン回収方法',
   'JP', '2013-165034', '特開2015-034315', '特許6233877', [QST], 'granted', 'cell', 4, 4, 'none',
   'リチウムのイオン伝導体の膜の両面に電極を付け、電圧をかけて原液から回収液へリチウムを移す装置の元になる特許（LiSMIC の最初の形）。'
   '中核特許（特許6818334）はこの特許を先行技術として挙げている。\n\n'
   'J-PlatPat: 特許 有効・年金納付（年金納付書 2026-09-11）。特許公報の発行 2017-11-22。'
   '同じ系統: 米国 US9932653B2（2018-04-03 登録）、韓国、国際出願 WO2015/020121。\n\n'
   '確かめること: LiSTie への実施許諾の内容は資料で未確認。\n\n' + SRC,
   assignee=[QST], annuity='paid', pct='national_phase', app_date='2013-08-08', pub_date='2015-02-19',
   expiry='2033-08-08', priority='2013-08-08', inventors=['星野毅'], family_key='qst-2013-metal-ion-recovery',
   family_size=4, url=jpp('6233877'), practice='practicing'),

 A('ipa_lst_jp7385297', 'university', '金属イオン回収装置、金属回収システムおよび金属イオンの回収方法（筒状の膜）',
   'JP', '2021-511365', 'WO2020/203187', '特許7385297', [QST], 'granted', 'cell', 3, 3, 'none',
   '筒状の金属イオン選択透過膜で原液槽と回収液槽を仕切り、内外に電極を置く装置。会議の記録で「円筒型」と呼ばれている系統とみられる。\n\n'
   'J-PlatPat: 特許 有効（年金納付書 2026-09-11）。特許公報の発行 2023-11-22。'
   '国際出願 PCT/JP2020/011148（優先日 2019-03-29）。移行先: 米国、韓国、オーストラリア AU2020250331、チリ、アルゼンチン AR118307。'
   '2025-11-26 の経営会議では、QSTはオーストラリア・アルゼンチン・ボリビアで「円筒型・板状型」の6件を維持し、年金は1か国6万〜7.6万円と説明された。\n\n'
   + SRC,
   assignee=[QST], annuity='paid', pct='national_phase', app_date='2020-03-13', pub_date='2020-10-08',
   expiry='2040-03-13', priority='2019-03-29', inventors=['星野毅'], family_key='qst-2019-tubular',
   family_size=7, url=jpp('7385297')),

 A('ipa_lst_au2020254379', 'university', '金属イオン回収装置、金属回収システムおよび金属イオンの回収方法（多孔質の集電体とスペーサー）',
   'AU', 'AU2020254379', 'AU2020254379A1', 'AU2020254379B2', [QST], 'granted', 'cell', 3, 3, 'none',
   '膜と陽極・陰極の間をスペーサーで空け、多孔質の集電体を通して電極と膜をつなぐ構造。会議の記録で「板状型」と呼ばれている系統とみられる。\n\n'
   'オーストラリアで 2025-06-05 に登録。国際出願 PCT/JP2020/011039（優先日 2019-03-29、JP2019-069257）。'
   '移行先: 日本、米国、韓国、チリ、アルゼンチン AR118308。日本の番号と登録の有無は未確認。\n\n' + SRC,
   assignee=[QST], annuity='unknown', pct='national_phase', app_date='2020-03-13', pub_date='2021-10-28',
   expiry='2040-03-13', priority='2019-03-29', inventors=['星野毅'], family_key='qst-2019-collector',
   family_size=7, url=gp('AU2020254379B2', 'en')),

 A('ipa_lst_wo2025094613', 'university', 'リチウム回収装置（集電体と膜の接触面積を膜の5%以下にする）',
   'WO', 'PCT/JP2024/035964', 'WO2025/094613', None, [QST], 'published', 'cell', 3, 4, 'none',
   '膜と集電体の接触面積を膜の主面の5%以下（従属項で0.5%以下）にして、膜を長く安定に使う。'
   '**会議の記録の「小面積電極の特許」**（高価な電極の使用量を減らしても回収速度は平板の電極並み）。\n\n'
   '国際出願 2024-10-08、優先日 2023-10-30、国際公開 2025-05-08。国内移行: 中国 CN202480065645.5、オーストラリア AU2024373047'
   '（Google Patents で確認できた分。ほかの国は未確認）。\n\n'
   '会議の記録: 出願人はQSTで、LiSTieは出願人ではない。各国移行の費用は LiSTie 75%・QST 25%（2025-11-26）。'
   '移行国は記録によって違う（経営会議: 米国・欧州・中国・韓国・インド＋オーストラリア・チリ／取締役会: 日本・米国・欧州・中国・韓国・英国・オーストラリア）。\n\n'
   + SRC + ' / ' + MTG,
   assignee=[QST], annuity='na', pct='national_phase', app_date='2024-10-08', pub_date='2025-05-08',
   priority='2023-10-30', inventors=['星野毅', '松本貴則', '森田健司'], family_key='qst-2023-collector-area',
   family_size=3, url=gp('WO2025094613A1'), ipc=['B01D61/44'], practice='planned'),

 A('ipa_lst_jp5765850', 'university', 'リチウムの回収方法およびリチウムの回収装置（イオン液体を含ませた膜）',
   'JP', '2011-169342', '特開2012-055881', '特許5765850', [JAEA], 'granted', 'membrane', 3, 2, 'low',
   'リチウムを選んで通すイオン液体を含ませた膜で仕切り、電気透析でリチウムを分けて回収する。'
   '技術タブのリチウム6の行にある「イオン液体と隔膜による電気透析」はこの方式にあたるとみられる。\n\n'
   '**権利者は日本原子力研究開発機構（JAEA）で、QSTではない**。J-PlatPat: 特許 有効・年金納付（2025-04-09）。'
   '特許公報の発行 2015-08-19。同じ系統: 韓国、中国。\n\n'
   '確かめること: LiSTie がこの方式を使うか。使うなら JAEA との許諾が要る。\n\n' + SRC,
   assignee=[JAEA], annuity='paid', pct='none', app_date='2011-08-02', pub_date='2012-03-22',
   expiry='2031-08-02', inventors=['星野毅', '及川史哲'], family_key='jaea-2011-ionic-liquid',
   family_size=3, url=jpp('5765850')),

 A('ipa_lst_jp5429658', 'university', 'リチウム同位体分離濃縮法および装置、並びに6Li同位体または7Li同位体高濃縮回収システムおよび回収方法',
   'JP', '2008-195404', '特開2010-029797', '特許5429658', ['株式会社化研', JAEA], 'expired', 'li6', 3, 2, 'none',
   'リチウム6・リチウム7を分けて濃縮する方法の元の特許。**年金の不納で権利は消滅している**（J-PlatPat: 特許 消滅）。'
   '2026-08-12 の経営会議で「QST時代の知識は特許性がなく自由に使える」との回答があったこととあわせて、リチウム6の自由度を考える材料。\n\n'
   + SRC,
   assignee=[], annuity='lapsed', pct='none', app_date='2008-07-29', pub_date='2010-02-12',
   priority='2008-07-29', inventors=['星野毅', '蓼沼克嘉', '根本忠洋', '中野菜都子'], family_key='jaea-2008-li-isotope',
   family_size=1, url=jpp('5429658')),

 # ── QST と出光興産の共有（LiSTie が使うには共有者の同意が要り得る）─────────────────
 A('ipa_lst_jp7270130', 'blocking', 'リチウム回収装置及びリチウム回収方法（抽出液のpHを12〜14に調節）',
   'JP', '2018-204165', '特開2019-081953', '特許7270130', [QST, IDM], 'granted', 'operation', 3, 5, 'high',
   '**リチウム電池の処理部材から取った抽出液**を、リチウム選択透過膜とメッシュ状の電極で回収する装置で、'
   '抽出液のpHを12以上14以下に調節し、アルカリ性の水溶液を足す手段を持つもの。\n\n'
   'J-PlatPat: 特許 有効・年金納付（2026-03-17）。特許公報の発行 2023-05-10。優先日 2017-10-31。\n\n'
   '確かめること: LiSTie の前処理は溶出液をアルカリ化してpH14以上にしてから LiSMIC に入れる設計で、原料は電池リサイクルが中心。'
   '請求項と実際の運転条件を照らして、抵触するかを弁理士に確認する。共有特許なので、LiSTie が実施の許諾を受けるには QST と出光興産の両方の同意が要り得る。\n\n'
   + SRC,
   assignee=[QST, IDM], annuity='paid', pct='none', app_date='2018-10-30', pub_date='2019-05-30',
   expiry='2038-10-30', priority='2017-10-31', inventors=['荒川毅志', '星正太', '勝又聡', '星野毅'],
   family_key='qst-idemitsu-2017-ph', family_size=1, url=jpp('7270130')),

 A('ipa_lst_jp7792087', 'blocking', 'リチウム回収装置及びリチウム回収方法（抽出液と回収液の温度を空間ごと調節）',
   'JP', '2021-180281', '特開2022-075618', '特許7792087', [IDM, QST], 'granted', 'operation', 2, 4, 'medium',
   'リチウム電池の処理部材から取った抽出液を膜で回収する装置で、抽出液の貯留槽・配管・処理槽（と回収液の槽・配管）を収めた空間の温度を調節する手段を持つもの。'
   '回収方法の請求では抽出液を30〜100℃に調節する。\n\n'
   'J-PlatPat: 特許 有効（特許証 2025-12-23）。特許公報の発行 2025-12-25。優先日 2020-11-06。\n\n'
   '確かめること: LiSTie は温度が高いほど回収が速い性質を使い、ベンチ機70℃・2号機90℃を目指す。自社の「高温保持セル」の出願との関係と、'
   '抵触の有無を弁理士に確認する。共有特許なので許諾には QST と出光興産の同意が要り得る。\n\n' + SRC,
   assignee=[IDM, QST], annuity='paid', pct='none', app_date='2021-11-04', pub_date='2022-05-18',
   expiry='2041-11-04', priority='2020-11-06', inventors=['星野毅', '宇都野太', '星正太', '町田雅志', '佐藤淳', '勝又聡'],
   family_key='qst-idemitsu-2020-temperature', family_size=1, url=jpp('7792087')),

 A('ipa_lst_jp7806991', 'blocking', '水酸化リチウムの製造方法（回収液を50℃以上に保ち、不活性ガスの中で晶析）',
   'JP', '2021-180294', '特開2022-075619', '特許7806991', [QST, IDM], 'granted', 'post', 3, 5, 'high',
   'リチウム電池の処理部材から取った抽出液から膜でリチウムだけを回収液に移し、回収液を50℃以上に保って回収し、'
   '回収液から水酸化リチウムを晶析で分ける。晶析は不活性ガス（または一酸化炭素・二酸化炭素・炭化水素が10ppm以下のガス）を使う。'
   '従属項で温度80〜100℃。\n\n'
   'J-PlatPat: 特許 有効（特許証 2026-01-27）。特許公報の発行 2026-01-27。優先日 2020-11-06。'
   '同じ系統: 国際出願 PCT/JP2021/040755（WO2022/097715）、米国 18/251,338。\n\n'
   '確かめること: LiSTie は水酸化リチウムを窒素で覆った箱の中で蒸発・粉砕する計画で、回収は70〜90℃。'
   '請求項（晶析か蒸発か、ガスの条件）と照らして抵触するかを弁理士に確認する。共有特許なので許諾には QST と出光興産の同意が要り得る。\n\n'
   + SRC,
   assignee=[QST, IDM], annuity='paid', pct='national_phase', app_date='2021-11-04', pub_date='2022-05-18',
   expiry='2041-11-04', priority='2020-11-06', inventors=['森大輔', '町田雅志', '宇都野太', '星野毅'],
   family_key='qst-idemitsu-2020-lioh', family_size=3, url=jpp('7806991')),

 # ── 第三者の特許（LiSTie の工程と重なり得るもの）────────────────────────────────
 A('ipa_lst_jp7705925', 'blocking', '水酸化リチウムの製造方法（2段のpH調整で他の元素を除き、膜で回収して液を戻す）',
   'JP', '2023-509336', 'WO2022/203055', '特許7705925', [IDM], 'granted', 'pre', 3, 4, 'medium',
   'リチウムと他の元素を含む水溶液に塩基を加え、pH6〜10とpH12以上の2段で混ぜて他の元素の水酸化物を除き、'
   'リチウム選択透過膜の電気化学装置でリチウムだけを回収し、回収後の液を反応槽に戻してpH調整に使う。\n\n'
   'J-PlatPat: 特許 有効（特許証 2025-07-08）。特許公報の発行 2025-07-10。優先日 2021-03-25。同じ系統: 中国、米国、国際出願。\n\n'
   '確かめること: LiSTie の前処理（中和・沈殿で不純物を除き、LiSMIC で回収し、液を戻して濃さを保つ）と重なるかを弁理士に確認する。\n\n' + SRC,
   assignee=[IDM], annuity='paid', pct='national_phase', app_date='2022-03-25', pub_date='2022-09-29',
   expiry='2042-03-25', priority='2021-03-25', inventors=['星正太', '森大輔', '宇都野太', '佐藤淳', '勝又聡'],
   family_key='idemitsu-2021-lioh-two-stage', family_size=4, url=jpp('7705925')),

 A('ipa_lst_jp7479883', 'watch', 'リチウム水溶液の製造方法（リチウム含有物をアルカリ性の水溶液と混ぜてろ過）',
   'JP', '2020-046505', '特開2021-147637', '特許7479883', [IDM, 'DOWAエコシステム株式会社'], 'granted', 'pre', 3, 3, 'medium',
   'リチウムと、アルミニウム・ケイ素・リン・マンガン・鉄・コバルト・ニッケル・ゲルマニウムの少なくとも一つを含むリチウム含有物を、'
   'アルカリ性の水溶液と混ぜてろ過し、リチウム水溶液を作る。\n\n'
   'J-PlatPat: 特許 有効（特許証 2024-05-07）。特許公報の発行 2024-05-09。\n\n'
   '確かめること: LiSTie はブラックマスや匣鉢くずを水で溶かす（水溶出）。水溶出がこの請求項にあたるかを弁理士に確認する。\n\n' + SRC,
   assignee=[IDM, 'DOWAエコシステム株式会社'], annuity='paid', pct='none', app_date='2020-03-17', pub_date='2021-09-27',
   expiry='2040-03-17', priority='2020-03-17', inventors=['星正太', '宇都野太', '森大輔', '渡邊亮栄', '本間善弘', '西川千尋'],
   family_key='idemitsu-dowa-2020-alkaline-leach', family_size=1, url=jpp('7479883')),

 A('ipa_lst_ep4134156', 'watch', 'イオン選択透過膜およびイオン回収装置（無機のイオン伝導体の層）',
   'EP', 'EP21784533.8', 'EP4134156A1', None, [IDM], 'under_examination', 'membrane', 2, 2, 'low',
   '無機のイオン伝導体の層を持つイオン選択透過膜。出光興産の単独。優先日 2020-04-08。同じ系統: 米国 US20230155244A1、中国、日本、国際出願。'
   '欧州は審査中（Google Patents の表示）。\n\n' + SRC,
   assignee=[IDM], annuity='na', pct='national_phase', app_date='2021-04-07', pub_date='2023-02-15',
   priority='2020-04-08', family_key='idemitsu-2020-membrane', family_size=5, url=gp('EP4134156A1', 'en')),

 A('ipa_lst_wo2024203897', 'watch', '水酸化リチウムの製造方法（出光興産、2023年）',
   'WO', None, 'WO2024/203897', None, [IDM], 'published', 'post', 2, 2, 'low',
   '出光興産の水酸化リチウムの製造方法の国際出願（優先日 2023-03-29、国際公開 2024-10-03）。請求項の中身は未確認。\n\n' + SRC,
   assignee=[IDM], annuity='na', pct='unknown', pub_date='2024-10-03', priority='2023-03-29',
   family_key='idemitsu-2023-lioh', url=gp('WO2024203897A1')),

 A('ipa_lst_wo2024203898', 'watch', 'イオン透過膜（出光興産、2023年）',
   'WO', 'PCT/JP2024/011386', 'WO2024/203898', None, [IDM], 'published', 'membrane', 2, 2, 'low',
   '固体電解質とカルボキシ基を持つ樹脂を含み、アルカリ性に強いイオン透過膜（国際出願 2024-03-22、国際公開 2024-10-03）。'
   '日本の国内段階 JP2025-510745。\n\n' + SRC,
   assignee=[IDM], annuity='na', pct='national_phase', app_date='2024-03-22', pub_date='2024-10-03', priority='2023-03-29',
   family_key='idemitsu-2023-membrane', url=gp('WO2024203898A1')),

 A('ipa_lst_cn120659658', 'watch', 'リチウム選択透過膜およびその製造方法（日本ファインセラミックス）',
   'CN', None, 'CN120659658A', None, ['日本ファインセラミックス株式会社'], 'published', 'membrane', 2, 3, 'low',
   'LiSTie の第2の膜の供給元である日本ファインセラミックスの、リチウム選択透過膜と製造方法の出願（優先日 2023-02-21）。'
   '中核特許（特許6818334）を引用している。膜の調達先の権利として見ておく。\n\n' + SRC,
   assignee=['日本ファインセラミックス株式会社'], annuity='na', pct='unknown', priority='2023-02-21',
   family_key='jfc-2023-membrane', url=gp('CN120659658A', 'zh')),

 A('ipa_lst_wo2025115490', 'watch', 'リチウム溶液の製造方法、及び、リチウム溶液の製造装置（リチウム鉱石を焼かずに溶かす）',
   'WO', 'PCT/JP2024/038458', 'WO2025/115490', None, [QST], 'published', 'pre', 2, 1, 'none',
   'QST の別のチームの出願。α-スポジュメンを含むリチウム鉱石をメディアで砕いてから酸に溶かし、高温の焼成を省く。'
   'LiSMIC とは別の技術で、原料が鉱石の場合の前処理として見ておく（国際出願 2024-10-29、国際公開 2025-06-05）。\n\n' + SRC,
   assignee=[QST], annuity='na', pct='unknown', app_date='2024-10-29', pub_date='2025-06-05', priority='2023-11-30',
   family_key='qst-2023-spodumene', url=gp('WO2025115490A1')),

 # ── LiSTie の出願（2026-09-30 時点で公開前。題名は会議での呼び方）──────────────────
 A('ipa_lst_own_hightemp', 'own', '高温で保持するセル（温度が高いほど回収が速い性質を使う）',
   'JP', None, None, None, [LST], 'filed', 'cell', None, 4, None,
   '国内出願済み。2026-01-21 の取締役会で PCT 出願を決議し、台湾にも個別に出願する。PCT の対象国は日本・米国・欧州・中国・インド・チリなど。'
   '出願番号・出願日・正式な発明の名称は未確認（公開前）。QSTと出光興産の共有特許（特許7792087、温度の調節）との関係を弁理士に確認する。\n\n' + MTG,
   assignee=[LST], pct='pct_filed', practice='planned', family_key='lst-2025-high-temp-cell'),
 A('ipa_lst_own_cc', 'own', '定電流で運転し、回収量を見積もる運転の制御',
   'JP', None, None, None, [LST], 'filed', 'operation', None, 3, None,
   '国内出願済み。電圧一定ではなく電流一定で運転して回収量を見積もる。2026-01-21 の取締役会で PCT 出願を決議し、アルゼンチンにも個別に出願する。'
   '出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST], pct='pct_filed', practice='planned', family_key='lst-2025-constant-current'),
 A('ipa_lst_own_pretreat', 'own', '前処理（溶出とアルカリ化）',
   'JP', None, None, None, [LST], 'filed', 'pre', None, 4, None,
   '国内出願済み。2026-01-21 の取締役会で PCT 出願を決議。出願番号などは未確認（公開前）。'
   '出光興産の特許（特許7705925・特許7479883）、QSTと出光の共有特許（特許7270130）との関係を弁理士に確認する。\n\n' + MTG,
   assignee=[LST], pct='pct_filed', practice='planned', family_key='lst-2025-pretreatment'),
 A('ipa_lst_own_domestic4', 'own', '国内出願（4件目。PCT にしなかった1件、題名は未確認）',
   'JP', None, None, None, [LST], 'filed', 'operation', None, 2, None,
   '2025年までの国内出願4件のうち、PCT にしなかった1件。2026-03-18 の経営会議で、PCT にする3件のうち1件をこの件と入れ替える検討があった（結果は未確認）。\n\n' + MTG,
   assignee=[LST], pct='none', family_key='lst-2025-domestic-4th'),
 A('ipa_lst_own_power', 'own', '電源の直列・並列の組み合わせ（膜1枚ごとの通電）',
   'JP', None, None, None, [LST], 'filed', 'operation', None, 3, None,
   '2026-01-21 の取締役会で決議した新規の国内出願。ホルダー10個を全部直列にすると約100V、全部並列では太いケーブルが要るため、直列の塊を並列につなぐ。'
   '出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST], pct='none', practice='planned', family_key='lst-2026-power-connection'),
 A('ipa_lst_own_surface100', 'own', '膜の表面処理を100℃以上・約10分で行う方法',
   'JP', None, None, None, [LST], 'filed', 'membrane', None, 4, None,
   '2026-01-21 の取締役会で決議した新規の国内出願。塩酸に約5日かかっていた処理を、100℃以上で約10分（1回5枚）に縮める。'
   '出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST], pct='none', practice='planned', family_key='lst-2026-surface-100c'),
 A('ipa_lst_own_dewater', 'own', '電気透析で脱水し、LiSMIC の発熱で蒸発させる濃縮',
   'JP', None, None, None, [LST], 'filed', 'pre', None, 3, None,
   '2026-01-21 の取締役会で決議した新規の国内出願。出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST], pct='none', practice='planned', family_key='lst-2026-dewater'),
 A('ipa_lst_own_crack', 'own', '膜のひび割れ時に回収液側を加圧して原液の混入を防ぐ',
   'JP', None, None, None, [LST], 'filed', 'cell', None, 3, None,
   '2026-01-21 の取締役会で決議した新規の国内出願。ひび割れは異常な電流が出にくく見つけにくいため、回収液側を少し加圧する。'
   '出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST], pct='none', practice='planned', family_key='lst-2026-crack-pressure'),
 A('ipa_lst_joint_soak', 'joint', '酸処理した膜をリチウム溶液に浸して立ち上がりを速める表面処理（QSTとの共同出願）',
   'JP', None, None, None, [LST, QST], 'filed', 'membrane', None, 4, None,
   'QST との委託研究から生まれ、国内は共同で出願済み。浸さないと最高の回収速度まで5日〜1週間かかるのが、浸すと数時間になる。'
   '2026-07-22 の取締役会で PCT 出願（約100万円弱）を承認。外国出願の費用と外国の権利は LiSTie が100%持ち、QST は外国出願をしない（2026-07-01 の経営会議）。'
   '出願番号などは未確認（公開前）。\n\n' + MTG,
   assignee=[LST, QST], pct='unknown', practice='planned', family_key='lst-qst-2025-soak'),
 A('ipa_lst_idea_intermittent', 'own', '電圧を間欠的にかける運転方法（出願を予定）',
   'JP', None, None, None, [LST], 'idea', 'operation', None, 4, None,
   '2026-05-27 の取締役会で、データがそろい次第出願すると説明。電圧のオン・オフで膜の性能の低下を抑える運転（技術タブ「膜の運転条件と限界」）。'
   '2026-10 から TYK で500時間の運転で確かめる。出願したかは未確認。\n\n' + MTG,
   assignee=[LST], pct='none', practice='planned', family_key='lst-idea-intermittent'),
 A('ipa_lst_idea_li6', 'own', 'リチウム6の濃縮の改良（出願を検討）',
   'JP', None, None, None, [LST], 'idea', 'li6', None, 3, None,
   '2026-08-12 の経営会議: QST時代の知識は特許性がなく自由に使えるとの回答を受け、改良して自社で出願する案。今年度中に最低1件の目標。'
   'QSTの回答は書面で確かめる方針。\n\n' + MTG,
   assignee=[LST], pct='none', family_key='lst-idea-li6'),
]


def R(rid, aid, holder_kind, holder_name, license_to='none', agreement='none', note=''):
    """権利者行。PostgREST の一括 POST は全要素のキー集合が一致している必要があるので、必ずこの関数で作る。"""
    return {'ip_right_id': rid, 'ip_asset_id': aid, 'holder_kind': holder_kind,
            'holder_name': holder_name, 'share_pct': None,
            'license_to_project': license_to, 'license_agreement_status': agreement,
            'royalty_terms': None, 'non_practice_compensation': None, 'contract_id': None,
            'note': note}


UNKNOWN_LICENSE = 'LiSTie への実施許諾の有無・範囲は資料で未確認。'
rights = [
 R('ipr_lst_jp6818334_qst', 'ipa_lst_jp6818334', 'university', QST, note='単独の権利者。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_jp6233877_qst', 'ipa_lst_jp6233877', 'university', QST, note='単独の権利者。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_jp7385297_qst', 'ipa_lst_jp7385297', 'university', QST, note='単独の権利者。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_au2020254379_qst', 'ipa_lst_au2020254379', 'university', QST, note='単独の権利者。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_wo2025094613_qst', 'ipa_lst_wo2025094613', 'university', QST,
   note='出願人。会議の記録では各国移行の費用を LiSTie 75%・QST 25%で負担。QST が移行しない国は取り決めが無く、LiSTie 単独では出願できない。'
        + UNKNOWN_LICENSE + MTG),
 R('ipr_lst_jp7270130_qst', 'ipa_lst_jp7270130', 'university', QST, note='共有の権利者（出光興産と2者）。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_jp7270130_idm', 'ipa_lst_jp7270130', 'partner_company', IDM, note='共有の権利者。LiSTie と出光興産の取り決めは無い（資料で確認できない）。' + SRC),
 R('ipr_lst_jp7792087_qst', 'ipa_lst_jp7792087', 'university', QST, note='共有の権利者（出光興産と2者）。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_jp7792087_idm', 'ipa_lst_jp7792087', 'partner_company', IDM, note='共有の権利者。LiSTie と出光興産の取り決めは無い（資料で確認できない）。' + SRC),
 R('ipr_lst_jp7806991_qst', 'ipa_lst_jp7806991', 'university', QST, note='共有の権利者（出光興産と2者）。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_jp7806991_idm', 'ipa_lst_jp7806991', 'partner_company', IDM, note='共有の権利者。LiSTie と出光興産の取り決めは無い（資料で確認できない）。' + SRC),
 R('ipr_lst_jp7705925_idm', 'ipa_lst_jp7705925', 'other', IDM, note='単独の権利者。' + SRC),
 R('ipr_lst_jp7479883_idm', 'ipa_lst_jp7479883', 'other', IDM, note='共有の権利者（DOWAエコシステムと2者）。' + SRC),
 R('ipr_lst_jp7479883_dowa', 'ipa_lst_jp7479883', 'other', 'DOWAエコシステム株式会社', note='共有の権利者。' + SRC),
 R('ipr_lst_jp5765850_jaea', 'ipa_lst_jp5765850', 'university', JAEA, note='単独の権利者。' + UNKNOWN_LICENSE + SRC),
 R('ipr_lst_joint_soak_lst', 'ipa_lst_joint_soak', 'project_company', LST,
   note='共同出願人。外国出願の費用と外国の権利は LiSTie が100%（2026-07-01 の経営会議）。' + MTG),
 R('ipr_lst_joint_soak_qst', 'ipa_lst_joint_soak', 'university', QST,
   note='共同出願人（日本）。外国出願はしない扱い。根拠の書面の有無は未確認。' + MTG),
]


def E(eid, aid, date, kind, title, detail=''):
    return {'ip_event_id': eid, 'ip_asset_id': aid, 'project_id': 'p07', 'event_date': date,
            'event_kind': kind, 'title': title, 'detail': detail, 'source_kind': 'manual', 'external_raw': None}


events = [
 E('ipe_lst_wo2025094613_20251126', 'ipa_lst_wo2025094613', '2025-11-26', 'note', '各国移行を承認（費用は LiSTie 75%・QST 25%）',
   '1か国100〜150万円＋翻訳約50万円（日本以外）。移行国は同日の記録で違いがある（備考）。' + MTG),
 E('ipe_lst_own_20260121_pct', 'ipa_lst_own_hightemp', '2026-01-21', 'note', '国内出願済み3件の PCT 出願を決議',
   '高温保持セル・定電流の運転制御・前処理（溶出とアルカリ化）の3件。' + MTG),
 E('ipe_lst_own_cc_20260121', 'ipa_lst_own_cc', '2026-01-21', 'note', 'PCT 出願を決議（アルゼンチンにも個別に出願）', MTG),
 E('ipe_lst_own_pretreat_20260121', 'ipa_lst_own_pretreat', '2026-01-21', 'note', 'PCT 出願を決議', MTG),
 E('ipe_lst_own_power_20260121', 'ipa_lst_own_power', '2026-01-21', 'note', '新規の国内出願4件を決議', '国内出願は1件60万円強の見積。' + MTG),
 E('ipe_lst_joint_soak_20260722', 'ipa_lst_joint_soak', '2026-07-22', 'note', 'PCT 出願を承認（約100万円弱）',
   '審査官の意見を見て、各国移行の前に内容を補強する。' + MTG),
 E('ipe_lst_jp5429658_lapsed', 'ipa_lst_jp5429658', '2026-09-30', 'lapsed', '年金不納による消滅を確認', SRC),
]


def D(did, aid, kind, label, due, status, note=''):
    return {'ip_deadline_id': did, 'ip_asset_id': aid, 'project_id': 'p07', 'deadline_kind': kind, 'label': label,
            'due_on': due, 'status': status, 'owner_member_id': None, 'note': note, 'source_kind': 'manual'}


deadlines = [
 D('ipd_lst_wo2025094613_np', 'ipa_lst_wo2025094613', 'pct_national_phase', '各国移行の期限（優先日から30か月）', '2026-04-30', 'done',
   '中国・オーストラリアへの移行を確認（Google Patents）。ほかの国の移行の有無は未確認。' + SRC),
]


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


KEYS = {'project_ip_assets': 'ip_asset_id', 'project_ip_rights': 'ip_right_id',
        'project_ip_events': 'ip_event_id', 'project_ip_deadlines': 'ip_deadline_id'}


def post(table, rows):
    return req('POST', f'{table}?on_conflict={KEYS[table]}', rows)


if __name__ == '__main__':
    ids = [a['ip_asset_id'] for a in assets]
    assert len(ids) == len(set(ids)), '資産IDの重複'
    for r in rights + events + deadlines:
        assert r['ip_asset_id'] in ids, r
    try:
        print('assets upserted:', len(post('project_ip_assets', assets)))
        print('rights upserted:', len(post('project_ip_rights', rights)))
        print('events upserted:', len(post('project_ip_events', events)))
        print('deadlines upserted:', len(post('project_ip_deadlines', deadlines)))
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:800])
