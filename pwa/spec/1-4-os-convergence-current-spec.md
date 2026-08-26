# AMD OS 全体収束仕様

> この章は、AMD内部、研究機関、スタートアップ、共同PJで増えた画面、権限、データを、役割ごとの入口を残しながら共通の業務構造へ収束させるための現行方針である。
> 2026-08-12時点では、収束原則と情報境界を採択済みとし、SX p21で本人・組織・権限と外部公開版のDBカーネルを先行実装している。PJ画面は既存の完成済みworkspaceへ一本化し、大学向けPJレンズ、共通作業・判断、他PJへの展開は未実装である。
> PJ・AMD・研究機関の三画面で何を同一にし、何を分離するかの受入条件は`1-5-three-party-project-view-acceptance-current-spec.md`を正本とする。

## 目的

AMD OSの問題は、画面数が多いこと自体ではない。

同じ業務概念が、画面ごとに別のデータ、別の権限、別の状態遷移、別の書き込み経路を持ち始めていることが問題である。

本仕様は、新しい利用者へ同じ内部画面を見せることを目的にしない。

一つの正本を、AMD、研究機関、スタートアップ、共同PJの役割に応じて別の見え方と操作権限で提供することを目的にする。

## 監査範囲と確認時点

2026-08-11のcommit `82baecb0`を基準に、PWAの119画面、213 API route、25 admin画面、外部workspace、Project Share、主要spec、manual、design文書、Supabase migrationを監査した。

本番環境の認証設定、外部アカウントの実利用状態、Project Share各instanceの現行認証状態は、この監査だけでは確定していない。

> **現行override（2026-08-26）:** 本文のProject Share並存・未退役という記述は2026-08-11時点の監査履歴。SX / ZMP / VSX / CX / SE / KUTEは移行readback後に全廃し、資料共有の正本は`workspace_documents`とprivate Storage `workspace-files`へ統一した。旧入口、Vercel project、Blob store、共有パスワード方式は復元・再利用しない。

コードに存在することと、本番で安全に運用できていることを分けて扱う。

最近再設計したホームは、本収束作業の再設計対象から外す。

ホームは内部ポートフォリオの入口として維持し、共通カーネルへの接続に必要な最小変更だけを許可する。

## 現状の構造問題

### 利用者と組織

内部member、旧Project ShareのPJ単位cookie、新workspace accountが別々の本人確認と認可を持っている。

新workspaceはaccountと研究機関、accountとPJの明示付与を持つが、スタートアップ法人そのものと法人内役職を表すtenantを持たない。

このままでは、同じスタートアップが複数PJへ参加する場合、代表、法務、財務、取締役、担当者の権限分離、担当交代、退職時の失効を一貫して扱えない。

### 作業と約束

次の行動は、`tasks`、`proactive_todos`、PJ管制のtaskとaction item、会議記録の配列へ分散している。

同じ仕事が別々に作成され、片方だけ完了し、担当と期限が一致しない状態を作り得る。

外部workspaceには、共同で扱う担当、期限、受入条件、相手待ち、自社待ち、完了確認がない。

### 判断と承認

候補、通知採否、会議の判断、PJの判断、契約承認が独立した状態遷移を持つ。

提案と確定、AMD内部判断と共同合意、相手方が確定する法人事実が同じ承認概念として整理されていない。

### 資料と外部公開

外部workspaceは、内部DBの最新ECR、SPS、PJ進捗をそのまま表示する箇所を持つ。

内部の最新値は、外部共有について承認された版とは限らない。

資料室は同じStorage objectを上書きできるため、過去版、承認版、差し替え理由、復元可能性を正本として保持できない。

### 画面と導線

`workspace`、`weekly-control`、`navigation`はPJ実行の近い概念を別画面と別実装で扱う。

`notifications`と`proactive`は、利用者が次に処理すべき項目を別々に表示する。

adminは会社運営機能を追加順に並べており、権限、契約、財務、データ運用という仕事のまとまりを表していない。

これはadminだけの問題ではなく、機能追加単位で新しい画面とwriterを作ってきた全体構造の症状である。

旧Project Shareと新workspaceが並存しているが、どちらを正規入口とし、いつ何を移行し、どの条件で旧入口を閉じるかが完了状態になっていない。

## 採択する全体構造

### カーネルとレンズ

カーネルは、一つの業務概念について正本、認可、状態遷移、writerを所有する共通領域である。

レンズは、同じ正本を利用者の役割と目的に応じて表示し、許可された操作だけを提供する画面群である。

画面ごとに独立した業務正本を持たせない。

| 共通カーネル | 所有する概念 | 現在の主な分散先 |
|---|---|---|
| 本人・組織・権限 | principal、organization、membership、grant、capability、失効 | internal member、workspace account、institution membership、project membership、Project Share session |
| ポートフォリオ | 研究機関、シーズ、PJ、スタートアップ法人と各ライフサイクル | institutions、seeds、projects、project company profile |
| 作業・約束 | 担当組織、責任者、期限、受入条件、状態、確認 | tasks、proactive todo、PJ task、action item、meeting next action |
| 提案・判断 | 提案、レビュー、判断、承認、共同確認、却下 | notifications、candidate、meeting decision、PJ decision、各種admin承認 |
| 資料・公開版 | immutable revision、checksum、公開範囲、承認版、訂正、保全 | workspace documents、monthly reports、Drive metadata、Project Share assets |
| 受信箱・イベント | 誰に何が起き、何を処理すべきか | notifications、proactive、Slack通知、画面固有alert |
| 契約・お金 | 契約原文、共同実務条件、検収、請求、支払、社内採算 | contracts、rewards、payments、reimbursements、GAS連携 |

### 役割レンズ

| レンズ | 主な利用者 | 主目的 |
|---|---|---|
| AMDホーム | AMD全member | 内部ポートフォリオを見渡し、担当PJへ入る |
| AMD経営・会社運営 | admin、経営担当、経理担当 | 権限、契約、財務、報酬、監査を職務別に処理する |
| 研究機関workspace | URA、研究者、研究機関管理者 | 所属シーズ、許可された評価、共同PJ、共有資料を確認する |
| スタートアップworkspace | CEO、法務、財務、取締役、PJ担当 | 自社PJ、法人事実、共同条件、期限、判断依頼を管理する |
| 共同PJ workspace | AMD、研究機関、スタートアップの許可member | 作業、判断、会議記録、成果物、変更履歴を共同で進める |
| AMD内部PJ cockpit | AMD担当、PM、経営 | 内部評価、仮説、助言、リスク、採算を含む内部運用を行う |
| ナレッジ・資料 | 許可された全利用者 | 所有者と公開版を崩さず検索、閲覧、訂正提案を行う |

レンズは利用者種別で固定しない。

同じ人が複数組織と複数PJへ参加する場合は、現在選択している組織とPJの文脈でcapabilityを解決する。

### 組織とPJの関係

AMD、研究機関、スタートアップはすべてorganizationとして扱う。

研究機関への所属だけで、その機関が関係する全PJを閲覧可能にしてはならない。

スタートアップへの所属だけで、その法人が関係する全PJの機微情報を閲覧可能にしてはならない。

PJへの参加は、organizationまたはprincipalへの明示grantとして独立して保持する。

役割名は権限そのものではなく、`view`、`propose`、`update`、`confirm`、`approve`、`manage_members`、`export`などのcapability束である。

## 情報の所有権

| 区分 | 例 | 確定者 | 外部共有 |
|---|---|---|---|
| AMD非公開 | 内部評価、助言仮説、採算、交渉方針、未採用候補 | AMD | 明示的な公開版を作らない限り共有しない |
| 共同正本 | PJ計画、担当、期限、受入条件、会議合意、成果物 | 関係当事者 | 関係者のcapabilityと共同確認状態に従う |
| 相手方主権 | スタートアップの法人・株式・取締役事実、研究機関が確定する制度・シーズ事実 | 当該organizationの権限者 | 当該organizationが確定した版だけを共有する |
| 公開情報 | 公開済みWeb情報、公開資料 | 出典所有者 | 出典、取得日、利用目的、訂正導線を保持する |

AMDが収集、要約、推定したことだけを理由に、相手方主権データの最終確定者になってはならない。

共同正本への変更は、直接上書きではなく変更提案、確認、確定の履歴を残す。

AMD非公開メモ、共同正本、相手方主権データを一つのknowledge tableと一つの承認者へ集約してはならない。

## 外部公開版

内部の最新行を外部へ直接表示することを禁止する。

外部に表示する評価、進捗、計画、資料は、公開対象、版、評価時点、根拠範囲、欠測、公開承認者、訂正先を持つ外部公開版から取得する。

外部公開版は公開後に上書きしない。

訂正は新しいrevisionを作成し、旧版をsupersededとして保持する。

ECRとSPSは別の測定対象であり、合算しない。

外部向けの根拠は、内部メモや個人情報を漏らさないsafe summaryとして別途作成する。

### SX p21の先行実装

SX p21では、PJ固有の別writerを増やさず、PJ横断で再利用する`principal / organization / organization membership / project party / project grant`を先に実装する。

将来の大学・SU向けPJ面の値は、内部テーブルの現在値ではなく、許可されたsource rowと版をAMDの公開承認者が選び、DBが許可列だけから組み立てたimmutable publicationから読む。

外部workspace accountの閲覧には、既存の当該PJ membershipと、新しい当該PJ・当該partyの`publication.view` grantの両方を必要とする。

研究機関workspaceへの所属だけではPJ公開版を読めない。

外部認可がない場合はPJの存在を区別できない`not found`とする。認可済み未公開と取得失敗の表示は、大学・SU向けの正式面を実装するときに現行workspace相当の受入契約と一緒に確定する。

外部向けに内部の最新値へfallbackしない。

2026-08-11に追加した別デザインの共通deckは、完成済みのPJ workspaceと無関係な第4の画面を増やす実装だったため撤回した。DBカーネルは画面へ未接続のまま保持し、新しい表示面を勝手に増やさない。

## 事実境界

未登録を0へ変換してはならない。

未測定を低評価へ変換してはならない。

取得失敗を0件へ変換してはならない。

候補を確定情報として表示してはならない。

報告済みを検証済みとして表示してはならない。

内部の最新版を外部承認済み版として表示してはならない。

画面は、値、状態、評価時点、出所、欠測理由を分けて表示する。

## 画面の収束先

| 現在の画面・機能 | 収束先 | 方針 |
|---|---|---|
| `/dashboard` | AMDホーム | 最近の再設計を維持し、共通カーネルのprojectionだけを受ける |
| `/project/[id]/cockpit` | AMD内部PJ cockpit | AMD非公開の評価、仮説、助言、リスクを担当する |
| `/project/[id]/workspace` | 共同PJ workspace | 作業、判断、会議、共有成果物の共同正本を担当する |
| `/project/[id]/weekly-control` | 共同PJ workspace | `/project/[id]/workspace`への互換redirectだけを残し、独立surfaceを廃止する |
| `/project/[id]/navigation` | PJ計画レンズ | SX固有前提を外し、必要なPJだけが共通計画データを表示する |
| `/notifications` | 共通受信箱 | 判断依頼、確認依頼、失敗、期限イベントを一つの処理列へ投影する |
| `/proactive` | 共通受信箱の先行作業レンズ | 独立TODO正本ではなく、作業とイベントからのprojectionへ移す |
| `/admin/*` | AMD経営・会社運営 | 権限、契約、財務、報酬、データ運用の職務別グループへ再編する |
| `/workspaces` | 外部利用者の組織・PJ切替 | 取得失敗と参加先0件を分離し、organization文脈を選べるようにする |
| `/workspace/[slug]` | 研究機関workspace | 大学の機関全体面を維持し、大学メンバー向けPJレンズをここから接続する。内部cockpitや簡易PJ代替面は流用しない |
| 旧Project Share各instance | 共同PJ workspace | 2026-08-26までに移行readbackと入口閉鎖を完了 |
| HUDと実験画面 | canonical画面のmirrorまたは検証用 | 独立writerを持たせず、surface catalogで状態を明示する |

URLを直ちに減らすことを目的にしない。

先に正本とwriterを一つへ寄せ、旧画面をprojectionまたはread-onlyへ変えた後にredirectと削除を行う。

## 共通作業モデル

共同PJで扱う作業は、最低限として次の属性を持つ。

| 属性 | 意味 |
|---|---|
| `project_id` | 作業が属するPJ |
| `accountable_organization_id` | 結果責任を持つ組織 |
| `responsible_principal_id` | 実行担当者 |
| `requested_by_principal_id` | 依頼者 |
| `due_at` | 合意した期限 |
| `acceptance_criteria` | 完了確認の条件 |
| `visibility` | AMD非公開、共同、特定organization |
| `source_type`と`source_id` | 会議、判断、契約、資料などの発生源 |
| `status` | proposed、accepted、in_progress、blocked、submitted、accepted_done、cancelled |
| `acknowledged_at` | 担当側が認識した時刻 |
| `accepted_at` | 成果を受入側が確認した時刻 |

`proactive_todos`や会議のnext actionは、この作業を生成または参照する入口とし、別の完了状態を持たせない。

## 共通判断モデル

判断は、提案、レビュー、決定、確認を分ける。

提案者、決定権者、影響するorganization、期限、選択肢、根拠、決定内容、決定時点、確認状態を保持する。

共同合意をAMDのadmin一人の承認で代替してはならない。

通知は判断の正本ではなく、未処理の判断や確認を利用者へ届けるprojectionとする。

## 資料の版管理

資料は論理documentとimmutable revisionを分ける。

revisionは、親revision、Storage object、checksum、MIME、作成者、作成時刻、公開範囲、レビュー状態、承認者、superseded状態を持つ。

Storage objectの同一key上書きを正規編集経路にしない。

削除はarchiveを基本とし、保持期限、復元、法的保全、Storage objectの回収を一つの処理として扱う。

資料の閲覧、変更、公開、archiveは監査対象とし、重要操作の監査記録に失敗した場合は本体操作も失敗させる。

## 新規実装のゲート

新しい画面を作る前に、既存レンズで目的を達成できないことをsurface catalogで確認する。

新しいtableを作る前に、既存カーネルの正本へ属性または状態を追加すべきかを確認する。

一つの概念に複数のwriterを作らない。

役割名をroute内で直接分岐する前に、必要なcapabilityへ変換する。

外部向け機能は、明示grant、公開版、監査、訂正、失効を実装してから有効化する。

旧画面は、移行先、差分、read-only開始日、redirect日、削除条件を決めずに削除しない。

## 2026-08-11から2日間の実装範囲

この2日間では、12週間の段階計画を前提にしない。

ただし、全画面と全tableを同時に書き換えて本番へ出すこともしない。

最初の完了単位は、危険な事実変換と外部書き込み境界を直し、以後の追加実装が共通カーネルへ接続される状態を作ることである。

### 最優先で完了させるもの

1. 外部進捗の未登録から0への変換を廃止する。
2. `/workspaces`の取得失敗と参加先0件を分離する。
3. workspaceの資料変更routeへsame-origin検証を共通適用する。
4. 外部認証の連続送信を抑止するrate limitとcooldownを追加する。
5. 権限、資料、公開版に関する重要操作の監査失敗を成功扱いしない。
6. surface catalogを正本化し、canonical、mirror、移行中、deprecatedを表示できるようにする。
7. 本人・組織・grant・capabilityの共通契約と移行migrationを確定する。
8. 作業、判断、資料revisionの共通契約を確定し、新規writerが接続できる入口を作る。

### この2日間で禁止するもの

ホームの再設計は行わない。

支払確認の低利用機能を優先して大規模改修しない。

外部workspaceへAMD内部bundleをそのまま追加しない。

旧Project Shareは移行readbackを完了して2026-08-26に全廃した。以後は復元しない。

未確認の本番状態を完了として記録しない。

## 移行完了条件

本人と組織は一つの認可カーネルで解決され、研究機関所属とPJ閲覧権限は独立している。

スタートアップ法人は複数PJと複数役職を持ち、法人の権限者が自社主権データを確定できる。

共同作業は一つの作業正本を持ち、AMD、研究機関、スタートアップの各レンズで同じ状態を表示する。

共同判断は提案者、決定権者、確認者と履歴を持つ。

外部の評価、進捗、資料は承認済みrevisionから取得される。

取得失敗、未登録、未測定、0件は画面とAPIの両方で区別される。

各画面はsurface catalog上でcanonical、mirror、移行中、deprecatedのいずれかを持つ。

旧Project Shareは内容の移行readback後に入口を閉じ、2026-08-26に全インスタンスの退役を完了した。

仕様、migration、コード、契約テスト、本番build-info、本番権限readbackが同じ変更単位で一致する。

## 現在の実装状態

本章の収束原則と情報所有区分は採択済みである。

ホーム凍結は採択済みである。

surface catalogと資料権限のcapability bundleは初期実装済みである。

外部進捗の未登録保持、`/workspaces`の取得失敗分離、資料変更のsame-origin guard、OTP rate limit、transactional audit、admin access一覧の完全paginationは実装済みである。

security closureのmigration 258は2026-08-11に本番適用し、table、function、trigger、foreign key、実行権限をreadback済みである。

共通principal、organization、organization membership、project party、project grant、immutable publication revisionはmigration 259で初期実装した。

migration 260は本番適用済みで、`publication.approve`をcanonical AMD studio organizationだけへ限定し、研究機関・SU organizationへ誤ったapprove grantが入っても公開RPCで利用できないようにする。本番readbackは不正active grant 0件、guard trigger 1件、resolverのAMD organization guardとstudio party guardを確認済みである。

`/project/[id]/workspace`は完成済みの`SxWeeklyControlDashboard`をPJ実行面として表示する。旧`/project/[id]/weekly-control`はworkspaceへredirectし、同じPJ実行面を二重管理しない。

AMD内部の評価、採算、経営判断は`/project/[id]/cockpit`が所有する。研究機関の入口は`/workspace/[slug]`にあるが、大学メンバーが当該PJを現行workspace相当の品質で見るためのPJレンズは未実装である。

migration 259は人物、外部organization、grant、publicationを自動作成しない。p21の初期grantと最初の公開版は、大学・SU向けの正式面と実利用者・公開対象を明示確認してから別migrationまたは承認操作で作成する。

共通作業・判断の状態遷移、SUと研究機関が自組織データを確定するwriter、資料revision、他PJへのgrant展開は未実装である。旧Project Share退役は2026-08-26に完了した。
