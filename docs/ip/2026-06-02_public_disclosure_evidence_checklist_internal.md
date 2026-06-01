# AMD OS / AMDプロトコル 公開済み資料 実物確認候補チェックリスト（内部版）

- 作成日: 2026-06-02
- 位置づけ: 出願前 / 弁理士相談前に、公開済み資料・外部共有候補の実物確認対象を軽量に整理する内部準備メモ。法的評価、新規性喪失判断、特許法30条の例外適用要否の結論ではない。
- 作業範囲: repo内IP資料、BZM / Textbook関連md、NIMS導入準備md、PWA admin IP画面コード、既存設計mdのread-only確認。Web調査、外部送付、弁理士送付、公開削除 / 変更、DB接続、DB writeは未実施。
- 記載制限: 実URL、source permalink、実DB行、prompt全文、few-shot、score weight / threshold / calibration、実PJ本文、顧客名、個人名、契約条件、未公開知財詳細、connector認証 / 監視 / 復旧情報は記載しない。

## 0. 結論: 現時点で弁理士へ確認すべき外部公開 / 外部共有候補

現時点では、弁理士へ確認すべき候補は次の5群。

1. 2026-05-20 StartPass / Stapa関連の公開ページ、登壇資料、投影資料、配布資料、録画、文字起こし、参加者共有。
2. 営業資料、投資家資料、導入提案資料、共同研究 / RFP向け資料の送付履歴、NDA有無、説明粒度。
3. Web / note / public manuscript / `/bzm` 系の公開状態、認証有無、公開範囲、WS-1〜WS-6への接触有無。
4. NIMS向け説明候補が、内部下書き止まりか、実提示済みか、どの範囲で共有されたか。
5. PWA `/admin/ip` やAMD OS画面を外部へ画面共有した実績の有無、見せた可能性がある情報粒度。

まさ認識「StartPassでは概要のみで今回の発明内容は話していない」は、ここでは未確認事実として扱う。現時点で「問題なし」「新規性喪失なし」とは断定しない。

## 1. 軽量棚卸し表

| category | item / material candidate | date / period | externality | material existence | distribution/shared? | invention-core exposure | current evidence location | next action | attorney question |
|---|---|---|---|---|---|---|---|---|---|
| StartPass / Stapa | 公開ページ / イベント告知 / アーカイブ候補 | 2026-05-20前後 | public / unknown | unknown | unknown | unknown | まさ確認待ち。Web調査は禁止のため未確認 | まさ側で公開ページ有無、公開範囲、掲載内容、公開日を確認 | 公開ページが概要告知だけの場合、どの記録を残せば足りるか |
| StartPass / Stapa | 登壇資料 / 投影資料 / デモ表示候補 | 2026-05-20 | external-private / public / unknown | likely | unknown | overview / possible WS touch | `pwa/design/venture_map_demo.md`、`pwa/design_log/`内の5/20関連メモ。実投影版はまさ確認待ち | 当日実際に投影したファイル、配布有無、デモ操作範囲を確認 | デモ画面がAMD Score / BZM理論 / OS導入構想に触れる場合、発明公開に近づく粒度はどこか |
| StartPass / Stapa | 録画 / 文字起こし / 参加者向け共有候補 | 2026-05-20以降 | external-private / public / unknown | likely | unknown | overview / possible WS touch | `pwa/bzm/textbook/runs/2026-06-01-stapa-event-textbook-source-notes.md`。元文字起こし実物はまさ確認待ち | 元文字起こし、録画、参加者共有リンク又は配布ファイルの有無を確認 | まさ認識どおり概要のみだった場合、録画 / transcriptを弁理士へどこまで見せるべきか |
| Sales / investor / proposal | 営業資料 / 導入提案資料 / 投資家説明資料 | 日付未特定 | external-private / NDA / unknown | unknown | unknown | unknown | repo内IP資料では候補として明記。実資料一覧と送付履歴はまさ確認待ち | 資料名、送付日、相手区分、NDA有無、AMD OS / Protocol説明粒度を一覧化 | NDAあり / NDAなしで、WS-1〜WS-6のどの説明が発明公開に近づくか |
| Sales / investor / proposal | 共同研究 / RFP / 提携向け説明候補 | 日付未特定 | external-private / NDA / unknown | unknown | unknown | unknown | repo内IP資料では候補として明記。実送付有無はまさ確認待ち | 送付 / 画面共有 / 口頭説明の実績を確認し、資料があれば削除版候補へ分ける | 出願前に「出願準備中」「出願予定」と言ってよい範囲はどこまでか |
| Web / note / public manuscript | note / Web / public site候補 | 日付未特定 | public / unknown | unknown | unknown | unknown | Web調査は禁止のため未確認。公開URL確認待ち | まさ側で公開URL一覧と公開日、本文のAMD OS / Protocol記載有無を確認 | 一般的なAMD OS理念やBefore Zero説明と、発明コア開示の境界はどこか |
| Web / note / public manuscript | BZM / Textbook本文、`/bzm` 系表示 | 2026-06-01時点 | internal-only / public / unknown | found | unknown | overview / possible WS touch | `pwa/bzm/`、`pwa/src/app/(app)/bzm/`、`pwa/public/bzm/` | 認証有無、公開範囲、外部共有済み範囲、`/bzm/public`相当の実URL有無を確認 | BZM本文内の設立時期、ERS、AMD Score、OS運用説明がWS-6又は請求項中核へ触れるか |
| Web / note / public manuscript | Stapa素材を反映したBZM本文 | 2026-06-01以降 | internal-only / public / unknown | found | unknown | overview / possible WS touch | `pwa/bzm/1-3-field-frictions-and-patterns.md`、`pwa/bzm/1-4-gates-and-judgment-branches.md`、`pwa/bzm/1-6-field-elements-to-bzm-variables.md` | 公開予定前に、発明コアのAND結合、具体処理フロー、実施例に見える表現をscan | Before Zero一般論として安全な範囲と、出願前に削るべきOS具体処理の境界はどこか |
| NIMS説明候補 | NIMS向けAMD OS導入ゲート / 価格仮説 / 初回説明候補 | 2026-05-31以降 | internal-only / unknown | found | unknown | overview / possible WS touch | `docs/strategy/2026-06-nims-os-installation-gates-pricing.md` | 実提示済みか、内部下書き止まりか、共有範囲とNDA / 契約文脈を確認 | 研究機関向け説明で、出願前にOS機能名・Protocol・HITL・outcomeをどこまで話してよいか |
| NIMS説明候補 | NIMS向け低摩擦説明 / screen-share候補 | 2026-05-31以降 | external-private / internal-only / unknown | likely | unknown | unknown | まさ確認待ち。repo内検索では導入準備mdはあるが、実提示資料は未確認 | 実際に見せたスライド / 画面 / 口頭説明の有無を確認 | 実提示済みの場合、特許法30条、外国出願、守秘義務の観点で何を記録すべきか |
| `/admin/ip` / OS screen share | PWA `/admin/ip` 知財レポート | 2026-05-29以降 | internal-only / NDA / unknown | found | unknown | likely core | `pwa/src/app/(app)/admin/ip/page.tsx`、`pwa/src/app/(app)/admin/ip/ip-report.ts`、`docs/ip/HANDOFF_ip.md` | 外部画面共有実績、見せた相手区分、NDA有無、表示した範囲を確認 | 内部admin画面を弁理士へ画面共有する場合、守秘義務前提で足りるか、削除版が必要か |
| `/admin/ip` / OS screen share | AMD OS通常画面 / HUD / Venture Mapデモ | 2026-05-20前後 / 日付未特定 | external-private / public / unknown | likely | unknown | overview / possible WS touch | `pwa/design/venture_map_demo.md`、`pwa/src/app/(app)/venture-map/`、`pwa/public/hud/` | 当日又は商談で見せた画面、公開embed、事前録画の有無を確認 | OSの見た目・スコア画面だけでも、請求項中核の公開と見られる場合があるか |

## 2. まさへ確認したい事項（5個以内）

1. 2026-05-20 StartPass / Stapaで、公開ページ、登壇スライド、配布資料、録画、文字起こし、参加者向け共有のうち、実在するものはどれか。
2. StartPass当日に、AMD OS / AMDプロトコル / `/admin/ip` / Venture Map / HUD等の画面を実投影又は録画したか。した場合、見せた範囲は概要か、処理フローまで踏み込んだか。
3. 営業資料、投資家資料、導入提案資料、共同研究 / RFP資料で、AMD OS又はAMDプロトコルの説明を外部送付した履歴はあるか。NDA有無も分かるか。
4. note / Web / public manuscript / `/bzm`系で、既に公開済み又は公開URLがあるものはどれか。認証付きか、誰でも読めるか。
5. NIMS向けに、OS画面又は説明資料を実際に見せたか。内部下書き止まりなら、現時点で外部共有なしとして扱ってよいか。

## 3. 弁理士確認事項

1. StartPass / Stapaが概要説明のみだった場合、公開済み資料棚卸しとして必要な記録粒度。
2. 営業資料、投資家資料、導入提案資料に、どの粒度でWS-1〜WS-6や請求項A/Bの要素が入ると発明公開に近づくか。
3. 公開URL、録画、文字起こし、配布資料が存在する場合、国内出願、特許法30条の例外、PCT / 外国出願で確認すべき違い。
4. 弁理士への相談時に、内部admin画面を守秘義務前提で画面共有する場合の安全な範囲。
5. NIMS等の研究機関向け説明で、出願前に「出願準備中」「出願予定」「出願中」と表現してよいタイミングと範囲。

## 4. 送付 / 公開前の停止線

- 外部送付、弁理士送付、Drive共有、メール添付、公開URL共有は、送付版を別途作るまで停止。
- 実URL、source permalink、元文字起こし、録画、登壇資料、営業資料の実ファイルは、この内部チェックリストに貼らない。
- `/admin/ip` は内部admin画面想定。外部画面共有実績は未確認のまま扱い、実績確認前に「外部共有なし」と断定しない。
- Web / note / `/bzm/public` はWeb調査未実施。公開状態は「公開URL確認待ち」又は「候補調査worker候補」として扱う。
- NIMS向け説明候補は、実提示済みか内部下書き止まりか未確認。提示済みの場合は、資料、日付、共有範囲、守秘義務文脈を弁理士確認事項へ回す。
- 営業秘密、実データ、実PJ本文、prompt、score条件、DB row、connector運用情報、顧客名、個人名、契約条件は、送付候補資料に入れない。

## 5. 禁止情報チェック

### 5.1 この成果物で避けたもの

- 実URL、source permalink、外部公開ページのURL。
- 元文字起こし、録画、登壇資料、営業資料の本文抜粋。
- 実DB行、production DB row、内部source id。
- prompt全文、few-shot、score weight / threshold / calibration。
- 実PJ本文、顧客名、個人名、契約条件、価格、商談ログ。
- connector認証、監視、復旧、watch対象、運用PC、抽出スケジュール細部。
- 未公開知財詳細、導入先別の実運用ノウハウ。

### 5.2 検索確認メモ

repo内のread-only検索では、既存IP資料、BZM / Textbook関連md、NIMS導入準備md、PWA admin IP画面コード、5/20デモ設計mdに候補が見つかった。一方、外部公開ページ、公開URL、録画、配布資料、実送付資料、NDA有無、外部画面共有実績は、Web調査禁止・外部送付禁止・DB接続禁止のため未確認として残した。

### 5.3 次worker候補

まさ確認で公開URLや実資料の存在だけが分かった後、別workerで「実URLを書かず、資料名・日付・外部性・配布有無・NDA有無・発明コア接触有無だけ」を転記する候補調査を切る。Web調査が必要な場合は、今回の禁止条件とは別promptで、取得結果を成果物に直接URL転載しないルールを明示する。
