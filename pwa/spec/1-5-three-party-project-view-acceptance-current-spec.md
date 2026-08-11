# PJ・AMD・研究機関の三者PJ面 受入仕様

> この章は、同じPJをPJメンバー、AMD、大学・研究機関が別の画面で扱うときの合格条件を定める。
> 画面の見た目を揃える仕様ではない。同じ正本を役割別の目的、可視範囲、操作権限で投影できていることを検査する仕様である。
> 2026-08-12時点では本仕様とp21合成fixtureを採択済み。大学・研究機関向けPJ面と、現行cockpitから共同正本への完全接続は未実装である。

## 結論

採択するcanonicalなPJ面は次の三つだけである。

| 画面 | route | 主利用者 | 一目で答える問い |
|---|---|---|---|
| PJ workspace | `/project/[projectId]/workspace` | SUを含むPJ実行member | 今どこで、誰が、何を、いつまでに進めるか |
| AMD cockpit | `/project/[projectId]/cockpit` | AMD担当、PM、経営 | AMDはどこへ介入し、何を判断するべきか |
| 研究機関PJ面 | `/workspace/[slug]/project/[projectId]` | 大学・研究機関の許可member | 大学側の責任、確認、提出、相手待ちは何か |

三者共通dashboardや簡易workspaceを第4のcanonical面として追加しない。redirect、埋め込み、read-only projectionはsurface catalogで状態と収束先を明示し、独立writerを持たない場合だけ許可する。

研究機関workspaceの機関全体面`/workspace/[slug]`は維持する。研究機関PJ面は、その中の許可済みPJから入るPJ固有レンズであり、機関全体面の代替ではない。

## 「元のデータが同じ」の定義

同じPJの全項目を同じ画面へ出すという意味ではない。

次の二つを同時に満たすことを意味する。

1. 共同で扱う同じ事実は、一つのcanonical ID、一つの状態遷移、一つのwriterを持つ。
2. AMD非公開、相手方主権、公開承認前の情報は、同じPJであっても権限のないレンズへ出さない。

### 共同事実の同一性

三者に表示する同じ共同作業・共同判断は、最低限として次を一致させる。

| field | 規則 |
|---|---|
| `project_id` | 完全一致。別PJの行を名称や機関所属から混ぜない |
| `source_type / source_id` | 同じcanonical rowを指す。画面用コピーIDを作らない |
| `source_version` | 同じlive共有事実は一致。更新競合を版で検出する |
| `status` | canonical enumは一致。表示文言だけをレンズ別に変えてよい |
| `due_at / due_precision` | 一致。未設定を当日、0日、期限なし確定へ変換しない |
| `accountable_party_id` | 結果責任を持つ組織を一致させる |
| `responsible_principal_id` | 実行担当者を一致させる。未確認を架空の担当へ変換しない |
| `ball_party_ids` | 現在返答・実行すべき当事者を一致させる |
| `acceptance_criteria` | 完了確認条件を一致させる |
| `evidence_state` | 未提出、報告済み、検証済みを区別する |
| `visibility` | AMD非公開、共同、特定organization、公開版を明示する |
| `last_verified_at` | 事実の確認時点を表示できるようにする |

PJ workspaceとAMD cockpitが同じ作業を別tableへ保存し、同期処理で寄せる構造は不合格である。

### live共有事実と公開版を分ける

共同作業・共同判断は、明示grantを持つPJ当事者が同じcanonical rowを扱うlive共有事実である。

評価、経営サマリ、計画要約、成果要約、資料は、内部の最新値をそのまま外へ出さず、承認済みimmutable publicationから読む。

したがって、AMD内部に`source_version=4`の未承認draftがあり、PJ・研究機関に承認済み`source_version=3`を表示する状態は許される。ただし、次をすべて満たす場合だけである。

- 同じ`source_id`に対するdraftと承認版である。
- AMD側に現在のdraft版と外部公開中の版を表示できる。
- 外部側にpublication revision、承認時点、評価時点、鮮度を表示できる。
- 古い版への無言fallbackをしない。
- 最新publicationからaudienceを外した場合、過去に見えた版を再表示しない。

版の違いを表示せず、画面ごとに違う値を「同じ現在値」として見せる構造は不合格である。

## 情報層

| 情報層 | 正本の確定者 | PJ workspace | AMD cockpit | 研究機関PJ面 |
|---|---|---|---|---|
| 共同正本 | capabilityを持つPJ当事者 | 表示・許可操作 | 表示・許可操作 | 表示・許可操作 |
| AMD非公開 | AMD | 非表示 | 表示・AMD操作 | 非表示 |
| 研究機関主権 | 研究機関の権限者 | 確定共有版だけ | 確定共有版だけ | 現在値・確認・訂正 |
| SU主権 | SUの権限者 | 現在値・確認・訂正 | 確定共有版だけ | 確定共有版だけ |
| 承認済み公開版 | publication approver | audienceに含まれるときだけ | draftとの差を含め表示可能 | audienceに含まれるときだけ |

AMDが収集したメモを、研究機関またはSUの主権事実として確定しない。

## 各画面の責任

### PJ workspace

現行`SxWeeklyControlDashboard`の情報密度、操作、デザインを基準にする。

主表示は、現在地、次の一手、担当、期限、ボール、4本柱または当該PJの計画軸、重要経路、関係先、論点、証拠である。

共同事実の更新は共通writerへ送る。AMD内部評価や内部採算を表示しない。

現行デザインを維持することは、複数組織で必要になる責任組織、実行担当、現在のボール、要求行動を隠すことを意味しない。単独運用を前提に省略していたfieldは、三者利用時に同じ情報密度のまま判読できる位置へ戻す。

### AMD cockpit

共同正本の現在地を同じIDで読み、その上へAMD非公開の評価、仮説、助言、採算、経営リスク、介入判断を重ねる。

共同作業の状態をcockpit専用tableへ複製しない。cockpitから共同作業を変更する場合も共通writerを使う。

AMD内部draftと現在の外部承認版が異なる場合、その差分と公開状態を表示する。

### 研究機関PJ面

機関全体のECR・シーズ一覧を縮小コピーする画面ではない。

当該PJについて、研究機関側の担当、ボール、確認依頼、提出物、期限、受入条件、相手待ち、共同判断、承認済み資料を先頭で扱う。

研究機関の権限者は、自組織主権データの確認、訂正、共有版の確定を行える。AMD内部bundle、内部評価、採算、交渉方針、未承認summaryは取得しない。

## 認可と操作

研究機関所属だけではPJを閲覧できない。

全レンズで、principal、organization membership、project party、exact project grant、capability、各statusをserver側で解決する。role名、メールdomain、氏名、route parameterだけから権限を推定しない。

principal、membership、party、grantのproject・organization・principalは複合scopeで一致させる。statusだけでなく`expires_at`も検査し、viewerのpartyはrequest bodyやclientの配列ではなく有効grantから導出する。

| 操作 | PJ member | AMD | 研究機関member |
|---|---:|---:|---:|
| 共同作業を読む | `shared.view` | `shared.view` | `shared.view` |
| 共同作業を更新 | `shared.update` | `shared.update` | capabilityがある項目だけ |
| 証拠を提出 | `evidence.submit` | `evidence.submit` | `evidence.submit` |
| 共同判断を確認 | capabilityがあるparty | capabilityがあるparty | `shared.confirm` |
| 訂正を求める | capabilityがあるparty | capabilityがあるparty | `correction.request` |
| AMD内部評価 | 不可 | `internal.assess` | 不可 |
| 外部公開を承認 | 不可 | `publication.approve` | 自組織主権版は別capability |
| member・grant管理 | `manage_members`保持者だけ | `manage_members`保持者だけ | `manage_members`保持者だけ |

認可なし、失効済み、別PJ grantは、PJの存在を区別できない`not found`へ閉じる。

client側で非表示にするだけでは不合格である。server DTOとDB read経路の両方で対象外の行を返さない。

`publication.approve`は、party roleが`studio`であり、かつorganizationがcanonical AMD（`kind=amd / source_kind=amd_internal / source_id=amd`）である場合だけ付与・解決できる。migration 260はgrant trigger、publish RPCが使うactive-party resolver、既存不正grant検査の三箇所でこれを強制する。研究機関・SUの主権事実は`sovereign.confirm`を持つ当該organizationだけが確定し、AMDの公開承認で代行しない。2026-08-12時点のmigration 259が実装しているcapabilityは`publication.view / publication.approve`であり、`shared.*`、`evidence.*`、`sovereign.*`、`correction.*`は本仕様で確定した未実装契約である。

## 5秒受入

ログイン後5秒以内に、説明を読まず次を判別できることを合格とする。

| 画面 | 判別できること |
|---|---|
| PJ workspace | 現在地、最重要の停止点、現在のボール、次の期限 |
| AMD cockpit | AMDが今日介入する対象、内部リスク、外部公開中の版 |
| 研究機関PJ面 | 大学側が返すもの、確認するもの、提出期限、相手待ち |

390px、768px、1440pxの初期viewportで、スクロールとクリックをせず、各personaが`現在地 / 最重要停止点と下流影響 / ボール保持者と要求行動 / 次期限またはAMDの次介入`の4問へ5秒以内に4問すべて回答できることを測定条件とする。

機械側は、この4問へ使うID、停止点、下流影響、party、要求行動、期限を一つのdecision frameとして欠損なく導出できることと、初期viewport内に対応するsemantic DOMが存在することを検査する。人側はPJ、AMD、研究機関の実利用personaが各幅で判読する。どちらか片方だけでは合格にしない。

ページ上部へ要約カードを増やせば合格ではない。既存の現行PJ画面より比較速度、情報密度、操作到達が落ちる場合は不合格である。

## 合成モデル契約

`scripts/__fixtures__/three_party_project_view_p21.json`はp21を識別子に使う合成fixtureであり、実際のp21 current truthではない。production resolver、DTO、route、DBをまだ呼ばないため、このtestのgreenだけで実装合格や安全性を証明しない。

`npm run test:three-party-project-view`は次を検査する。

1. 三つのcanonicalレンズの責任と、surface catalog上のshared PJ canonical面が一つであること。
2. live共同事実のsource ID、版、状態、期限精度、責任組織、担当principal、ボール、受入条件、証拠状態、visibility、確認時点が三者で一致すること。
3. AMD非公開fieldと秘密canaryがPJ・研究機関DTOへ混ざらず、DTOが厳密allowlistだけを返すこと。
4. 研究機関主権とSU主権について、所有者は現在値、他者は確定共有版だけを読むこと。
5. 当該organizationの`sovereign.confirm`だけが主権事実を確定し、他者の訂正依頼とaudit失敗rollbackを分離すること。
6. p30の事実がp21 viewerへ混ざらず、別IDの第2合成PJでも同じmodelが動くこと。
7. 未設定期限を0や架空日付へ変換しないこと。
8. 内部draftと外部承認版の差をpublication metadata付きで表すこと。
9. 最新publicationのaudience除外後に旧版へ戻らず、draftだけは未公開、read失敗は未公開へ変換せず、訂正後は最新revisionを読むこと。
10. principal、membership、party、grant、capability、expiry、project、organization、workspace slugの不一致を`not found`へ閉じること。
11. capabilityから各レンズの操作を導出し、5秒判読に必要なdecision frameを固定すること。

大学・研究機関向けPJ面を実装するときは、この独立modelをproduction pure resolver / projectorへ置き換えるか、production coreをこのtestから直接importする。実DTO、DB RPC、route、network response、audit rollback、live DB readbackを別integration testで通すまで実装合格にしない。

## 実画面受入

機械テストだけでは完了にしない。

- p21の実利用accountを、PJ、AMD、研究機関の各レンズで用意する。
- 390px、768px、1440pxで主要情報と操作を確認する。
- loading、empty、unpublished、stale、conflict、取得errorを別状態として確認する。
- 同じ共同事実を三画面で開き、ID、状態、期限、ボール、版を照合する。
- AMD非公開、研究機関主権、未承認draft、別PJ行の非表示をnetwork responseでも確認する。
- grant失効後に再読込し、画面、API、DB functionのすべてで拒否されることを確認する。
- publication更新時に旧版fallbackがなく、表示中revisionと鮮度が一致することを確認する。
- 画面には`共有版 / 元データ版 / 基準日`を別の表示語で出し、訂正中は対象版、依頼者、担当、期限を色以外でも判別できることを確認する。
- 重要mutationのaudit insert失敗時に本体もrollbackすることを確認する。
- 本番build-info、git SHA、dirty状態、migration readbackを同じ変更単位で記録する。

スクリーンショットの見た目だけ、単体fixtureだけ、管理者accountだけの確認では合格にしない。

## 実装順

1. 本仕様、surface / writer棚卸し、三者RACI、共同作業・判断の状態遷移、合成fixtureで合格線を固定する。
2. principal / membership / party / exact grant、capability、publication、主権確認、監査を実装し、固定p21 bootstrapを実利用者確認後に投入する。
3. 共通DTOと共通writerを作り、DB RPC、失効、非漏洩、版、audit rollbackのintegration testを通す。
4. 現行PJ workspaceを共通DTO / writerへ接続し、見た目を再設計せず、直後にPJ実accountで縦切り受入する。
5. AMD cockpitの重複表示を同じ共同正本のprojectionへ置き換え、AMD非公開overlayを維持し、直後にAMD実accountで受入する。
6. 研究機関PJ面を`/workspace/[slug]`から接続し、研究機関側の責任と操作を実装し、直後に研究機関実accountで受入する。
7. p21三者を横断照合し、異なるproject ID、party数、計画軸を持つ第2PJで固定分岐がないことを確認してから展開する。

## 現在の合否

| 対象 | 現在 |
|---|---|
| 三画面の責任分担 | 合格条件を確定 |
| p21合成model fixture | 実装済み。runtime安全性の証明ではない |
| migration 260 公開承認者guard | 本番適用・readback済み |
| production resolver / DTO / DB integration test | 未実装 |
| 現行PJ workspaceのデザイン | 維持 |
| PJ workspaceとAMD cockpitの共同正本完全一致 | 未検証・未完了 |
| 研究機関PJ面 | 未実装 |
| p21三者の実account受入 | 未実施 |

本章の追加だけで三者画面が完成したとは扱わない。
