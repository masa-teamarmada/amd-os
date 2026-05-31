# NIMS AMD OS Installation Gates and Pricing Hypothesis

作成日: 2026-05-31
ステータス: Draft for internal decision
対象: NIMS向けAMD OS導入準備、次機関展開判断、FY27/FY28月次売上試算

## Executive summary

NIMS向けAMD OS導入は、現行正本ではFY27試験導入予定であり、2026年は「AMD内部運用の安定化」と「URA向け教科書STEP1着手」の年である。したがって、2026年中に急いでNIMSへ外部公開運用を始めるのではなく、NIMS側が「いつまで待てばよいか」「何を準備すればよいか」を判断できる開始ゲートを先に合意する。

導入開始ゲートは、単なるロードマップ日付ではなく、以下の7項目すべてを満たした時点でGO判定する。

1. AMD OS内部運用が4週間連続で安定し、L2抽出・月次レビュー・通知採否・ERS評価が実運用で回っている。
2. NIMS向け最小ユースケースが「CX + NIMS内シーズ探索 + 月次レビュー」に絞られ、対象ユーザー・対象PJ・対象データが確定している。
3. NIMSデータとAMD内部データの分離方針、権限、閲覧範囲、外部共有禁止範囲が文書化されている。
4. 松本さん側の準備物が揃っている。
5. URA/EIR向けオンボーディング資料 v0.7 があり、1回の模擬導入で説明できる。
6. 月次レビュー運用の責任者・開催日・入力データ・成果物が決まっている。
7. まさ、りり、松本さん、AMD OS担当が同じ判定表でGOを出す。

価格は、初期はSaaS単体ではなく「業務委託バンドル + OS利用権」として売る。データ蓄積前はOS単体価値が限定的なため、Pilotは月30-50万円、Standardは月80-120万円、Full Y-modeは月150-250万円を仮説レンジとする。FY27試算には保守50万円/月、標準100万円/月、強気150万円/月を置く。FY28は導入機関が3機関に増える中期計画と整合させ、保守150万円/月、標準300万円/月、強気500万円/月を置く。

## Current truth

### ロードマップ上の位置づけ

- `/Users/masa/projects/knowledge/amd_os_vision.md` では、2026年は内部運用 + URA向け教科書STEP1着手、2027年はNIMS試験導入、2027-28年は愛媛大・東京科学大・工学院大等への連携機関展開とされている。
- `/Users/masa/projects/knowledge/partner_institutions.md` では、NIMSは「Y準備中」、AMD OS導入はFY27予定、関連PJはCX `p20` である。
- `/Users/masa/projects/knowledge/midterm_plan.md` では、FY27にOS導入機関1件、FY28に3件、FY30に10件、FY35に60+件という計画になっている。
- `/Users/masa/projects/knowledge/company_profile.md` では、AMD OS / AMDプロトコル / AMDスコアを研究機関・URA・EIRへ普及させる仕組みレイヤーが中核戦略で、現時点の収益経路は「業務委託 x OSバンドル」が最も現実に近い。

### NIMS / CX / 松本さん / りり / AMD OS の関係

- NIMSはCXの起点機関であり、現行の機関単位契約はコンサル W2025014019 と包括連携系の文脈にある。
- CXは `p20`、NIMS神谷グループの磁気冷凍技術を核にしたスタジオモデルPJで、2026-08法人設立予定として整理されている。
- りりはNIMSスタートアップ支援室側の事業化支援メンバーで、AMDにも参画している。NIMS側の実務・現場感とAMD側のOS設計をつなぐ橋渡し役になり得る。
- 松本さんはNIMS側の発注者・準備主体として扱う。具体的な個人情報や未公開事情はこの設計メモには入れず、「NIMS側準備責任者」として必要タスクだけを定義する。
- AMD OSは、NIMSの全業務を一気に置き換えるものではなく、まずCXとNIMS内シーズ探索を通じて、URA/EIRがAMDプロトコル・AMDスコア・ERSを使う導線を作るものとして導入する。

### OS側に既にある機能

| 領域 | 既存機能 / 正本 | NIMS導入で使えること |
|---|---|---|
| L2データ | `pwa/design/L2_DATA.md`, `pwa/spec/3-1-l2-data-extraction-current-spec.md` | Gmail / Drive / Calendar / Slack / Notion から月次報告、Protocol、MS進捗、PJナレッジ、MTGサマリ、台帳差分、XRL根拠、経営ハイライトを抽出する中核 |
| AMD Protocol | `pwa/spec/3-9-l2-protocol-current-spec.md` | 経営判断を分岐点 / 判断材料 / アクション / 結果観測として残し、URA/EIR教育へ転用する |
| MS進捗 | `pwa/spec/3-10-l2-ms-progress-current-spec.md` | CXやNIMSシーズ探索の月次進捗、レビュー、未達理由を見える化する |
| ERS | `pwa/design/institution_readiness.md`, `pwa/spec/4-3-ers-current-spec.md` | NIMSを機関として評価し、どの制度・人材・資金・産学連携機能がギャップかを示す |
| 機関台帳 | `institutions`, `institution_assessments` など | 機関マスタ、ERS評価、制度比較のDB基盤 |
| シーズ台帳 | `pwa/design/seeds.md` | NIMS内の研究シーズ候補を台帳化し、PJ化・見送り・接触履歴を管理する余地 |
| 月次レビュー | `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals` | NIMS側との月次レビュー資料と判断ログの下地 |
| 通知採否 | `/notifications` と L2 feedback | 候補をAMD側が確認して正本反映するhuman-in-the-loop |

### まだ足りないもの

| 不足領域 | 現状 | 導入前に必要な状態 |
|---|---|---|
| データ分離 | 現行DBはAMD内部運用を前提。機関別閲覧権限・外部ユーザー境界は未確定 | NIMS workspace / institution scope / row-level policy / external user role の設計 |
| 外部ユーザー権限 | admin中心の運用が多い | NIMS URA/EIRが見てよい画面、書いてよい項目、AMDだけが見る項目の分離 |
| 契約 | OS利用権が既存委託に明示されていない | 業務委託範囲、OS利用権、データ利用、秘密保持、二次利用、解約時データ扱いを明文化 |
| NIMSユースケース | CX文脈はあるが、OS上の最小運用単位は未確定 | CX、シーズ3-5件、月次レビュー1系統に絞る |
| オンボーディング | URA向け教科書STEP1は進行予定 | 60分説明資料、操作ガイド、月次レビューの入力テンプレ、FAQ |
| データ移行 | NIMS既存データの取り込み範囲未定 | 最初は過去全量移行しない。2026-10以降など期間を切る |
| 監査・事故対応 | 内部運用前提 | 権限事故、誤反映、機密混入時の停止・連絡・復旧手順 |

## NIMS install start gate

### Gate 0: 事前合意

GO判定日を置く前に、以下を合意する。

| 判定項目 | 必須条件 | 判定者 |
|---|---|---|
| 導入目的 | NIMS全体DXではなく、URA/EIRが事業化判断を回すためのPilotである | まさ / りり / 松本さん |
| Pilot対象 | CX `p20` と、NIMS内の追加シーズ候補3-5件まで | まさ / りり / 松本さん |
| 利用者 | NIMS側は松本さんを準備責任者、実利用者はURA/EIR 1-3名から開始 | 松本さん / りり |
| データ範囲 | CXとPilot対象シーズに関する、事業化判断に必要な情報だけ | まさ / AMD OS担当 |
| 成功定義 | 月次レビュー2サイクルで、判断材料・次アクション・未整備ギャップがOS上で追える | まさ / 松本さん |

### Gate 1: AMD OS内部運用の安定性

NIMSインストール開始の最低条件。

| 項目 | GO条件 |
|---|---|
| L2抽出 | L2①〜⑨の現行writer / outbox / applierの責務が文書化され、直近4週間で重大な未復旧停止がない |
| 月次レビュー | AMD内部PJで月次報告、MS進捗、MTGサマリ、経営ハイライトが1サイクル以上実運用されている |
| ERS | NIMS / 工学院大 / 香川大など複数機関でERS評価が登録され、評価根拠メモが残っている |
| 通知採否 | L2候補を通知で確認し、yes/no/commentで正本反映する運用が破綻していない |
| 手戻り時の復旧 | stale snapshot、network failure、outbox failureが起きた時のfallback pathが分かる |

### Gate 2: NIMS向け最小ユースケース確定

Pilotの最小ユースケースは、以下に絞る。

1. CX月次レビュー: CXの設立準備、技術・事業・人材・資金の進捗を月次で整理する。
2. NIMSシーズ探索: 追加シーズ3-5件をシーズ台帳に入れ、事業化候補 / 保留 / 見送りを管理する。
3. ERSギャップ確認: NIMSのURA/EIR、知財、産学連携、資金、EIR供給、規程をERSで棚卸しする。
4. AMD Protocol学習: 実際の判断をProtocol化し、URA/EIR向け教科書STEP1の教材へ接続する。

非対象は明確に外す。

- NIMS全体の研究管理システムにはしない。
- NIMS内の全研究者・全シーズを初期取り込みしない。
- 人事評価、予算執行管理、契約稟議システムにはしない。
- AMD内部の全PJデータをNIMS側に見せない。
- NIMSデータを他機関営業に使う場合は、匿名化・許諾・範囲を別途合意する。

### Gate 3: 情報管理・権限・データ分離

外部機関導入の最大ゲート。

| 項目 | GO条件 |
|---|---|
| データスコープ | NIMS workspace / institution_id / project_id の対象範囲が定義済み |
| 閲覧権限 | NIMS側ユーザーが見られる画面・テーブル・添付資料が一覧化されている |
| 書込権限 | NIMS側が編集できるのはメモ、評価、コメントなど限定項目。正本反映はAMD確認を通す |
| AMD内部データ | AMD内部PJ、報酬、経理、他機関情報、非公開ProtocolはNIMS側から不可視 |
| NIMSデータ | NIMS由来データをAMD内部の運用改善・匿名化事例・他機関比較に使う条件を契約化 |
| 監査 | 誰がいつ見た/書いたかを追えるログ方針がある |
| 事故対応 | 誤共有・誤反映・機密混入時の停止、連絡、復旧手順がある |

### Gate 4: 月次レビュー運用

| 項目 | GO条件 |
|---|---|
| 開催頻度 | 月1回、60-90分。初回3か月は固定開催 |
| 事前入力 | AMD側がL2 snapshot、CX進捗、ERS更新候補、シーズ候補を前日までに準備 |
| 会議体 | まさ / りり / 松本さん / AMD OS担当 / 必要に応じて対象URA/EIR |
| 成果物 | 月次レビュー議事録、次アクション、Protocol候補、ERS更新、シーズ台帳更新 |
| 採否 | 会議中または翌営業日までにOS上の候補をconfirm/reject |
| KPI | 未整備ギャップが毎月1つ以上解消または次アクション化される |

### Gate 5: GO判定

GO判定は「FY27だから開始」ではなく、以下の判定会で行う。

| タイミング | 目安 | 判定者 | 出力 |
|---|---|---|---|
| Pre-gate review | 2026 Q4 | まさ / りり / AMD OS担当 | Gate 1-4の不足一覧 |
| Matsumoto prep review | 2027 Q1 | まさ / りり / 松本さん | NIMS側準備チェック |
| Install GO / NO-GO | 2027 Q1末 or Q2頭 | まさ最終判断、りり・松本さん合意 | Pilot開始日、対象ユーザー、対象PJ、契約/覚書 |

## Matsumoto-side preparation checklist

| チェック | 内容 | 完了条件 |
|---|---|---|
| Pilot責任者 | NIMS側の窓口、承認者、実利用者を決める | 氏名・役割・連絡導線が1枚にまとまる |
| 対象シーズ | CX以外に見るシーズ候補を3-5件選ぶ | PI名、技術概要、現状課題、公開可否が整理済み |
| 対象会議 | 月次レビューに乗せる会議体を決める | 初回3か月の日程候補がある |
| データ提供範囲 | 共有できる資料、共有できない資料、要匿名化資料を分ける | 資料リストに公開範囲ラベルが付く |
| 既存制度資料 | URA、知財、TLO、起業支援、EIR、GAP資金、COI/兼業規程の資料 | ERS評価に必要な最低資料が揃う |
| 利用者教育 | URA/EIR候補がOSの目的を理解する | 60分オンボーディングに参加できる |
| 契約・覚書 | OS利用権、データ利用、秘密保持、二次利用範囲 | AMD側ひな形に対する確認コメントが返る |

## AMD-side readiness checklist

| チェック | 内容 | 完了条件 |
|---|---|---|
| OS安定運用 | 内部L2、月次、ERS、通知採否が4週間安定 | run log / outbox / dashboardで確認可能 |
| NIMS workspace設計 | institution scope、外部user role、RLS/API guard | design/specへ記載済み |
| Pilotテンプレ | CX月次レビュー、シーズ台帳、ERSヒアリング、Protocol候補のテンプレ | 初回導入でそのまま使える |
| オンボーディング | URA/EIR向け教科書STEP1とOS操作を接続 | v0.7資料がある |
| 契約ひな形 | 業務委託 + OS利用権 + データ利用条項 | 法務レビュー前のドラフトがある |
| 価格表 | Pilot / Standard / Full Y-mode、初期費、月額、オプション | 月次試算へ入れられる |
| 事故対応 | 誤共有・権限・正本誤反映の停止手順 | 連絡先と復旧責任者が明記済み |

## Pilot scope / non-goals

### Pilot scope

| 項目 | 範囲 |
|---|---|
| 対象機関 | NIMS |
| 対象PJ | CX `p20` |
| 対象シーズ | CX以外に3-5件まで |
| 対象ユーザー | NIMS URA/EIR 1-3名、松本さん、りり、AMD側 |
| 対象データ | 月次レビュー、会議要約、シーズ候補、ERS評価、Protocol候補 |
| 対象期間 | 初期3か月をPilot、6か月でStandard判定 |
| レビュー | 月1回 |

### Non-goals

- NIMS全体への即時展開。
- 全研究者・全研究室のデータ取り込み。
- NIMS内部システムとの深い自動連携。
- 外部ユーザーによるAMD正本DBへの直接反映。
- 他機関営業への無許諾利用。
- SaaS単体売りでの高額課金。

## Next-institution expansion gate

NIMSが完全自走するまで待つ必要はない。ただしAMD側支援負荷が爆発する前に、次機関へ進む条件を置く。

### Expansion GO条件

| 観点 | GO条件 | 理由 |
|---|---|---|
| 実運用期間 | NIMSで2か月以上、できれば3か月運用 | 初回オンボーディングの欠陥が見える |
| 管理対象 | CX + 追加シーズ3件以上がOS上で管理されている | 1PJだけだと機関展開の再現性が見えない |
| 月次レビュー | 月次レビュー2サイクル完了 | L2、ERS、Protocolが会議に乗るか確認 |
| AMD支援負荷 | Pilot 2か月目以降、定常支援が2-4h/week以下 | 次機関を足しても破綻しない |
| 導入キット | 初回説明、権限設計、月次レビュー、ERSヒアリングがテンプレ化 | 愛媛大・工学院大・香川大へ再利用できる |
| 権限事故 | 誤共有・誤閲覧・誤反映の重大事故ゼロ | 外部機関展開の必須条件 |
| データ品質 | NIMSデータが匿名化すれば営業事例に使える粒度 | 次機関営業の根拠になる |
| 契約 | Pilot契約からStandard契約への更新余地が見える | 無償実験で終わらせない |

### Expansion HOLD条件

- NIMS側が月次レビューに参加できず、AMDが代行入力しているだけ。
- 権限・機密の不安が未解消。
- 対象シーズがCXだけで、機関単位の価値が証明できない。
- AMD支援負荷が5h/weekを超えて下がらない。
- 導入キットが毎回個別作業になっている。

### 次機関の優先順位仮説

| 候補 | 進め方 | 理由 |
|---|---|---|
| 工学院大 | KUTEのエコシステム構築PJにERS + シーズ台帳を載せる | 既にエコシステムPJがあり、制度整備との相性が良い |
| 愛媛大 | SXのGAP/PSI運用とMS進捗を接続 | 既存Yモードが強く、事業化実務に入りやすい |
| 香川大 | VSX + エコシステム構築見込みに対して、NIMS導入キットを軽量移植 | 2026-05訪問後の関係構築が進んでいる |
| 東京科学大 | 既存連携の詳細確認後 | 機関単位契約・対象PJの確認が先 |

## Service menu and pricing hypothesis

### 外部価格ベンチマーク

2026-05-31に公式価格ページで確認できる範囲では、汎用業務SaaSはユーザー課金、エンタープライズ・データプラットフォームはcustom pricingが中心である。

| 参照先 | 価格の見え方 | AMD OSへの示唆 |
|---|---|---|
| Airtable pricing | Teamは年払いで$20/user/month、Businessは$45/user/month、Enterprise Scaleはcustom pricing | 汎用DB/ワークフローSaaS単体の価格上限は低い。AMD OSを単体SaaSとして高額化しにくい |
| Notion pricing | Businessは$20/member/month、Enterpriseはcustom pricing、AI/agent系はcredits課金あり | 情報共有SaaS単体では月数十万円に届きにくい。AI活用・セキュリティ・導入支援が価格差になる |
| Smartsheet pricing | Enterprise / Advanced Work Managementはcustom pricing、10+ members向け | 組織横断・ポートフォリオ管理・統制機能は個別見積もりにしやすい |
| Dealroom pricing | PremiumはEUR 12,600/yearから、Premium PlusはEUR 17,000/yearから、Enterprise/APIはcustom pricing | startup ecosystem dataは年額数百万円未満から始まるが、API/Enterprise/analyst supportはcustomになる |

出典:

- Airtable pricing: https://airtable.com/pricing
- Notion pricing: https://www.notion.com/pricing
- Smartsheet pricing: https://www.smartsheet.com/pricing
- Dealroom pricing: https://dealroom.co/pricing/

この比較から、AMD OSの初期価格は「SaaS利用料」ではなく、AMDのBefore 0実務・月次レビュー・URA/EIR育成・シーズ探索・Protocol移転を含む業務委託バンドルとして設計するのが妥当である。

### メニュー

| メニュー | 内容 | 初期費 | 月額 | 想定対象 |
|---|---|---:|---:|---|
| Pilot | CXまたは1テーマ、シーズ3-5件、月次レビュー、ERS初回評価、最小オンボーディング | 50-150万円 | 30-50万円 | NIMS初回導入 |
| Standard | 機関内3-5テーマ、月次レビュー、ERS更新、シーズ台帳、Protocol候補、URA/EIRトレーニング | 150-300万円 | 80-120万円 | NIMS本導入、工学院大/愛媛大展開 |
| Full Y-mode | 機関全体のエコシステム構築伴走、複数PJ、制度整備、シーズ探索、EIR育成、月次/四半期レビュー | 300-600万円 | 150-250万円 | 重点機関、包括連携 |
| X-mode OS利用権 | 自走機関向け。OS利用、軽い月次確認、年数回レビュー | 50-150万円 | 20-50万円 | NIMSが自走化した後 |

### スポット業務 / オプション

| オプション | 価格仮説 | 備考 |
|---|---:|---|
| ERS初回診断ワークショップ | 50-100万円 / 回 | 制度資料レビュー + ヒアリング + ギャップ提案 |
| シーズ探索スプリント | 100-200万円 / 4-6週間 | シーズ10-20件棚卸し、3-5件を深掘り |
| GAP/補助金申請伴走 | 100-300万円 / 件 | 成功報酬は別途検討 |
| URA/EIR研修 | 50-150万円 / 半日-2日 | 教科書STEP1と連動 |
| Protocol/AMDスコア導入研修 | 50-150万円 / 回 | OS操作ではなく判断フレーム移転 |
| データ移行 / 初期設定 | 50-200万円 | 既存資料量と権限設計で変動 |

### 価格設計の考え方

- 保守的に始める。初回NIMSはデータ蓄積前であり、提供価値はAMDの伴走と月次レビューに寄る。
- SaaS単体価値は後から上がる。NIMS、工学院大、愛媛大、香川大のデータが蓄積し、ERS比較・Protocol事例・シーズ探索の再利用性が出るほどStandard/Fullの単価を上げられる。
- 価格表は外部公開用ではなく月次試算用の内部仮説。契約時は相手の予算科目に合わせて「エコシステム構築委託」「事業化支援委託」「OS利用権付き伴走支援」などに分ける。

## FY27/FY28 monthly revenue assumptions

### FY27

| シナリオ | 導入機関 | 単価 | 月次試算 | 年額換算 |
|---|---:|---:|---:|---:|
| 保守 | NIMS Pilot 1機関 | 50万円/月 | 50万円/月 | 600万円 |
| 標準 | NIMS Standard 1機関 | 100万円/月 | 100万円/月 | 1,200万円 |
| 強気 | NIMS Full寄り 1機関 | 150万円/月 | 150万円/月 | 1,800万円 |

月次試算に入れる初期値は、保守なら50万円/月、標準なら100万円/月を推奨する。初期費は試算上はスポット売上に分け、月次MRRとは分離する。

### FY28

中長期計画ではFY28のOS導入機関は3件。NIMSに加えて、工学院大・愛媛大・香川大のいずれか2機関を想定する。

| シナリオ | 導入機関 | 構成 | 月次試算 | 年額換算 |
|---|---:|---|---:|---:|
| 保守 | 3機関 | 50万円 x 3 | 150万円/月 | 1,800万円 |
| 標準 | 3機関 | 100万円 x 3 | 300万円/月 | 3,600万円 |
| 強気 | 3機関 | NIMS 150万円 + 他2機関 100万円 + option 150万円平均 | 500万円/月 | 6,000万円 |

FY28の強気ケースは、OS利用料だけでなく、ERS診断・シーズ探索・URA研修・補助金伴走などのスポット業務を月次平均化して含める。

## Open questions

1. NIMS側の正式な「発注者」は誰か。松本さんが準備責任者でよいか、契約・予算上の決裁者は別か。
2. NIMS Pilotの対象ユーザーは、松本さん + りり + URA/EIR候補1-3名でよいか。
3. CX以外のNIMSシーズ候補を、誰が何件選ぶか。
4. NIMSデータを、匿名化したうえで他機関営業・ERS比較・教科書に使えるか。
5. 外部ユーザー権限を、AMD OSの現行Supabase/PWAにどう安全に入れるか。
6. NIMS Pilot契約は、既存コンサル/包括連携に追加するか、別契約にするか。
7. URA向け教科書STEP1のv0.7を、いつNIMSオンボーディングに使える状態にするか。
8. 価格表をNIMSに提示するタイミングは、Pilot前か、Pilot設計合意後か。

## Next actions for AMD OS / CX / AMD総司令塔

### AMD OS

1. `pwa/design` または `pwa/spec` に、外部機関導入時のtenant / institution scope / role設計を作る。
2. NIMS Pilot用の最小画面リストを決める: ERS、シーズ台帳、CX cockpit、月次レビュー、Protocol候補。
3. NIMS側ユーザー権限で見せてはいけないデータ一覧を作る。
4. 月次レビューのテンプレを作る。
5. URA/EIRオンボーディング資料 v0.7 を準備する。

### CX

1. CX `p20` の2026-08設立準備マイルストーンと、NIMS Pilotで見せる進捗項目を対応させる。
2. 神谷さん・NIMS側に見せる情報と、AMD内部だけに残す情報を分ける。
3. CX以外のNIMSシーズ候補を3-5件選ぶための候補リストを作る。

### AMD総司令塔

1. まさ・りり・松本さんで、NIMS導入の目的を「全体DX」ではなく「URA/EIRがBefore 0事業化判断を回すPilot」として合意する。
2. FY27月次試算には、いったん保守50万円/月、標準100万円/月の2本を入れる。
3. FY28はOS導入3機関の前提で、保守150万円/月、標準300万円/月を置く。
4. NIMS PilotのGO判定会を2027 Q1末 or Q2頭に置き、2026 Q4にPre-gate reviewを入れる。

## Candidate updates to canonical docs

この文書は導入設計・価格設計のdraftであり、以下は反映候補に留める。

| 反映先候補 | 反映内容 |
|---|---|
| `/Users/masa/projects/knowledge/partner_institutions.md` | NIMSの「次アクション」に、Pre-gate review、Matsumoto-side checklist、Pilot対象確定を追記 |
| `/Users/masa/projects/knowledge/midterm_plan.md` | FY27/FY28のOS導入単価仮説を数値計画メモに追加 |
| `/Users/masa/projects/knowledge/company_profile.md` | 業務委託 x OSバンドルの価格レンジを内部メモとして追加 |
| `pwa/spec/5-3-automation-responsibility-current-spec.md` | 外部機関導入時のwriter / reviewer / applier境界を追加 |
| `pwa/spec/4-3-ers-current-spec.md` | ERSをNIMS Pilotの導入ゲートに使う運用を追記 |
| 新規 `pwa/design/institution_tenant_access.md` | 外部機関向けデータ分離・権限・監査ログ設計 |
