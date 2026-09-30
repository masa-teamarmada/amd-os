# DDパッケージ仕様（投資家・金融機関向けの開示面）

> **この章は何か**: 投資家・金融機関が、共有対象に指定されたページ・資料だけを閲覧する「DDパッケージ」の確定仕様。入れる領域と操作の分け方、公開版の作り方、画面、権限の検証、残課題を定める。初版は SOL（p21）で 2026-09-30 に実装した（migration 455・456）。

## 1. 3つの領域

AMD OS の PJ 情報は、アクセスできる人と中身で3つの領域に分ける。

| 領域 | 入れる人 | 根拠（毎リクエスト DB 再確認） | 中身 |
|---|---|---|---|
| コックピット `/project/[id]/cockpit` | AMD メンバー | `members`・`project_members`（Supabase の社内ログイン） | 経営管理・内部判断・交渉情報 |
| ワークスペース `/project/[id]/workspace` | 招待した研究者・事業化メンバー | `project_access_memberships`（外部アカウント）/ PJ限定メンバー | 共同作業に要る情報 |
| DD `/dd/[slug]` | 招待した投資家・金融機関 | `dd_package_grants`（外部アカウント） | 共有対象に指定した項目の公開版だけ |

- **入れる領域と、できる操作を別に持つ。** 領域は付与の表（どの表に行があるか）で決まり、操作は DD の付与行の `capabilities`（`dd.view` 閲覧 / `dd.download` 添付のダウンロード）で決まる。`dd.view` は必須。
- DD の付与はワークスペース・コックピットへ入る根拠にならない。ワークスペースの所属（`readonly` を含む）も DD へ入る根拠にならない。`workspace-access-scope-core.ts` の範囲判定は DD の付与を数えない。
- AMD の admin（`members.is_admin` かつ portfolio）は、未公開を含むすべてのパッケージを「管理者プレビュー」として開ける。admin 以外の内部メンバーと PJ限定メンバーは DD を開けない。
- ログインの仕組みは外部ワークスペースと同じ（メールリンク → 署名 cookie `amd_os_workspace_session`、`pwa/design/institution_seed_project_model.md` §6.4）。

## 2. 認証とログイン

| 段階 | DD のための動作 |
|---|---|
| `POST /api/auth/email-start` | ワークスペースの所属が無くても、公開中（`open`）パッケージへの有効な DD 付与（招待済み・有効、期限内、`dd.view` あり）があればログインリンクを送る（`hasLoginEligibleDdGrant`）。未公開・受付終了のパッケージへの付与だけではリンクを送らない |
| ログインリンクの方式 | **PKCE**（`@/lib/supabase/server` の SSR クライアント、コード検証値は cookie）。2026-09-30 まで supabase-js 既定の implicit で送っており、戻り先 URL のフラグメントにアクセストークンが付くため `/auth/callback` が完了せず、トークンが本人のアドレス欄に残っていた（外部アカウント12件は全員未ログインで実害なし）。リンクはログイン画面を開いたのと同じブラウザで開く |
| `GET /auth/callback`（`login_scope=workspace`） | 招待済みの DD 付与を `active` にする（失敗したら閉じる）。ワークスペースの範囲と DD の範囲を両方引き直し、どちらかがあればログインを通す。DD だけの人は、戻り先の指定が `/` か `/workspaces` なら `/dd` へ送る |
| 関所 `src/lib/supabase/middleware.ts` | 外部アカウントの署名 cookie を認証として通すのは、ワークスペースの面と DD の面（`isDdViewerPath`: `/dd`、`/dd/[slug]`、`/dd/[slug]/items/[itemId]`、`/dd/[slug]/items/[itemId]/file`）だけ。コックピット・管理画面・DD の管理画面は社内ログインへ戻す |
| `/workspaces`・`/` | DD だけの人は `/workspaces` から `/dd` へ案内し、`/` には「閲覧できるDD資料へ」を出す。両方を持つ人は `/workspaces` に DD の一覧も出す |

停止・失効は cookie の期限（30日）を待たず次のリクエストで効く。判定は `buildDdViewerScope`（`src/lib/dd-package-core.ts`）の純関数で固定し、アカウントが `active` で Supabase の認証と紐付き cookie のメールと一致すること、付与が `active` で期限内で `dd.view` を持つこと、パッケージが `open` であることをすべて満たす付与だけを数える。

## 3. データ（migration 455）

| 表 | 役割 |
|---|---|
| `dd_packages` | パッケージ。`status`: `draft`（未公開・管理者だけ）/ `open`（付与された人だけ閲覧）/ `closed`（誰も閲覧できない）。`slug` は URL、`notice_text` は冒頭の注意書き |
| `dd_package_grants` | 閲覧権限。外部アカウント × パッケージ。`status`: invited / active / suspended / revoked、`capabilities`、`expires_at`、`organization_name`（投資家・金融機関名）。同じ人への2つ目の付与は作れず、停止・失効は作成で復活しない |
| `dd_package_items` | 掲載項目（内部の選択）。区分 `section_key`、種類 `item_kind`、元データ `source_key`、作り方の選択 `source_options`、表題・一行説明・未確認事項・根拠資料。`published_publication_id` が外部に見せる版で、NULL なら非公開。新しい項目は NULL で作る |
| `dd_item_publications` | 公開版。追記のみ（更新・削除は trigger で拒否、service_role からの直接 INSERT も権限で拒否）。`payload`（許可した項目だけの表示用データ）、`source_refs`（元データの表・ID・版・更新日時・内容の sha256）、`source_as_of`、`unverified_notes`、`evidence_item_ids`、添付の実体（private Storage `dd-publication-files`、内容の sha256 で置き場を決める）、`content_hash`、`revision`、公開した admin、確認メモ |

- 4表とも RLS 有効、anon と一般 authenticated の直接権限なし、admin は SELECT だけ。書込みは service_role のサーバ経路。
- 行の変更は `workspace_record_security_row_mutation()` で同じ transaction の `workspace_access_audit_logs` に入り、OS 全体の変更履歴（`amd_os_data_change_history`）にも入る。物理削除はしない。
- 公開版は DB 関数 `dd_publish_item()`（service_role だけが実行）だけが作る。admin の実行者を確認し、項目を行ロックし、根拠資料を同じパッケージの有効な資料項目に絞り、`content_hash` を DB が計算する。現在の公開版と内容が同じなら新しい版を作らない。
- DB 側の約束は `scripts/dd_package_db_readback.sql` で本番 DB 上を確かめる（最後に必ず ROLLBACK、16項目）。

## 4. 公開版の作り方

1. admin が元データから項目を追加する（未公開）。
2. 「下書きを見る」で、いまの元データで作った公開版を投資家向けと同じ部品で確認する（保存しない、添付は開かない）。
3. 「公開」で、サーバが元データを読み直して payload を作り、添付は公開時点の実体を複製してから `dd_publish_item()` を呼ぶ。**画面から送られた中身は公開しない。**
4. 元データがその後変わっても、公開版は変わらない。管理画面は `source_refs` を今の元データと比べて「公開後に更新あり」を出し、admin が「更新して公開」を押したときだけ次の版になる。
5. 「取り下げ」は外部に見せる版を無くすだけで、公開版の記録は残す。取り下げた後に古い版へ戻して見せることはない（外部へは版の一覧を返さない）。

### 元データごとに写すもの（許可リスト、`src/lib/dd-payload.ts`）

| 種類 | 元データ | 写すもの | 写さないもの |
|---|---|---|---|
| 資料 | 資料室（`workspace_documents`）のファイル、または Google ドライブのファイルへのリンク | 公開時点のファイルの複製、ファイル名・形式・サイズ | 資料室の保存先・フォルダ・共有範囲。Google ドキュメント等は書き出してから置く |
| 技術台帳のページ | `project_tech_topics` + `project_tech_entries` | 題・要約・本文・表の行（値・条件・時点・確度・出典の種類）・社外向けの見せ方。行の備考は「公開可」のページだけ | 出典の社内参照（`source_ref` / `source_url`）、作成者・更新者、別ページの行、社内・要秘匿のページの行の備考（社内メモが混ざりやすい） |
| 資金計画 | `project_monthly_cashflow.planning_details_json` | `resolveFundingPlan` で整合を検査した計画（表示部品 `CockpitFundingPlan` がそのまま描く） | 旧PL/CF の参考計画 |
| 資本政策 | `project_capital_plans`（作業中の案・改定番号）または `project_capital_plan_versions`（凍結済みの提出版） | ラウンド名・種類・時期・状態・新規調達・プレマネー・転換上限・割引・完全希薄化後の株式数と持株比率、株主名と区分。載せるラウンドを「このラウンドまで」で選べる。転換型の資金調達（J-KISS等）の株式数は、キャップで転換したと仮定した試算である旨を未確認事項に自動で入れる | ラウンド・配分・株主のメモ、株を持たない株主 |
| 採算（コスト試算） | `project_cost_models` 系（燃料の試算は未対応） | 計算エンジン `computeCostModel` を株ごとに回した、方式ごとの1単位あたりの総コスト・売価・差・6区分の内訳（方式名は処理場所つき。例: オンサイト・直接投入）、菌体1kgあたりの原価、主要な前提（`isKey`）、試算の注意書き（caveat） | 明細・単価・作業の行、出典・担当・メモ、回答済みの確認事項 |

- 技術台帳の「要秘匿」のページは、管理画面で「開示してよいと確認した」を付けたときだけ追加できる。「社内」の項目・資料室で社内限定の資料には注意を出す。
- **未確認事項** = 管理者が書いた分 + 元データから自動で拾った分（技術台帳の要確認と理由、資金計画の未確定の条件、資本政策の未定ラウンドと「作業中の案を固定」の旨、採算の未解決の確認事項）。自動分は項目ごとに外せる。
- **根拠資料** = 同じパッケージの資料項目。公開時に固定し、閲覧時は「いま公開中」の資料だけをリンクする。
- 金額の表記は、表と図が百万円、本文と強調表示が億円・万円（資金計画の表示部品と資本政策の表）。

## 5. 画面

| route | 誰 | 中身 |
|---|---|---|
| `/dd` | 外部アカウント / admin | 閲覧できるパッケージが1つならそのトップへ、複数なら一覧。admin には全パッケージのプレビューと管理への入口 |
| `/dd/[slug]` | 付与のある外部アカウント / admin | DDトップ。先頭に公開中の項目数・最終更新・未確認事項・添付の数、その下に7区分（事業概要／技術・製品／顧客・市場／採算・数値計画／資本政策／知財・契約・体制／証憑一覧）をすべて同じ表の形で出す。各行は第N版・公開日・元データの基準日・未確認事項の件数 |
| `/dd/[slug]/items/[itemId]` | 同上 | 項目1件。公開版・公開日・元データの基準日・元データの種類、本文、根拠資料、未確認事項 |
| `/dd/[slug]/items/[itemId]/file` | 同上 | 添付。HTML はスクリプト・外部通信・フォーム送信を止めたサンドボックスで返し（`next.config.ts` の `ddPublicationFileSecurityHeaders` が全体の CSP を上書きする）、PDF・画像は60秒の署名URLへ送る。`?download=1` は `dd.download` を持つ人だけ |
| `/project/[projectId]/dd` | admin（portfolio） | 管理画面。パッケージの設定と状態、区分ごとの掲載項目（公開版・元データの変化・下書き・公開・取り下げ・編集・外す）、元データから追加、閲覧権限（招待・停止・再開・失効・ダウンロード許可・期限）、閲覧記録 |
| `/project/[projectId]/dd/preview/[itemId]` | admin（portfolio） | 下書きのプレビュー |
| `/admin/access` の「DD閲覧権限」 | admin | 全パッケージの付与の一覧（読むだけ）。付与・停止・失効は各パッケージの管理画面で行う |

- 管理者メニューの「組織・権限」に「DDパッケージ」（`/dd`）を置く。
- 閲覧者の面は社内の枠（AppShell）を使わず、タイトルに PJ 名・パッケージ名を出さない（権限の確認より先に描かれるため）。権限が無い・未公開・取り下げ・別パッケージはすべて「見つからない」で閉じ、存在を区別させない。
- 閲覧者の面はサーバコンポーネントで描き、閲覧者へ返すのは公開版の列 `DD_PUBLICATION_VIEW_FIELDS` だけ（添付の保存先・確認メモ・公開した admin・元データの内部参照・content hash は返さない）。内部の値をブラウザへ送ってから隠す方式は使わない。
- DD には検索の入口を置かない。版の一覧も閲覧者へは返さない。

## 6. 閲覧記録

外部アカウントのトップ閲覧・項目閲覧・添付の表示・ダウンロードを `workspace_access_audit_logs` に `dd_package_viewed` / `dd_item_viewed` / `dd_file_opened` / `dd_file_downloaded` で残す（detail はパッケージ・付与・項目・公開版の ID と版番号だけ）。管理者プレビューは記録しない。admin の操作は `admin_dd_mutation` と行変更の監査に残る。管理画面の「閲覧記録」にそのパッケージの直近200件を出す（同じPJの別パッケージの記録は混ぜない）。

## 7. 権限の検証

| 検査 | 内容 |
|---|---|
| `npm run test:dd-package`（deploy 前ゲート） | 純関数（閲覧範囲・ログイン可否・関所の path・直列化）、公開版の許可リスト（社内の値に目印を仕込み、公開版に残らないこと）、コードの契約（領域の分離、データを読む前の権限確認、閲覧者へ返す列、公開は DB 関数だけ、管理 API の requireAdmin と同一サイト確認、停止・失効の非復活、関所・ログイン・受け口の閉鎖、migration の権限） |
| `scripts/dd_package_db_readback.sql` | 本番 DB 上で ROLLBACK 付きに16項目（新しい項目は未公開、PJ不一致の拒否、根拠資料の絞り込み、admin 以外の公開拒否、版番号、同じ内容で版を増やさない、公開版の更新・削除の拒否、物理削除の拒否、公開中のまま外せない、他項目の版を指せない、取り下げで記録が残る、付与の操作の制約、重複付与の拒否、ワークスペース所属を作らない、同一 transaction の監査） |
| 実リクエストの確認（2026-09-30、ローカルの本番ビルド + 本番 DB） | 確認用パッケージ `dd-verification`（公開しない。確認後に受付終了）と確認用の外部アカウント（`@example.invalid`、停止済み）で、ログインなしの拒否、DD だけの人のトップ・項目・添付、未公開・存在しない・別パッケージの項目、ワークスペース・コックピット・管理画面・資料室・内部 API・つくよみへの直接アクセスの拒否、公開前の修正が外へ出ないこと、ダウンロード権限の付与と取り外し、停止・失効・期限切れ・受付終了・未公開に戻す・アカウント停止が同じログイン状態のまま次のリクエストで効くこと、取り下げ、閲覧記録を確かめた |

## 8. 同時に閉じた経路（2026-09-30）

DD の「内部の値を外へ出さない」を満たすために、既存の次の経路を閉じた。

- `POST /api/tsukuyomi/chat` はログインの有無を名前の表示にしか使っておらず、未ログインでも `project_id` を指定すると PJ コックピットの内部 context を読み込めた。先頭で `requireMember()` を必須にした（PWA は cookie、macOS アプリは同じ Supabase の Bearer で通る）。
- `GET /api/project-tech` / `project-cost-model` / `project-ip` は `requireAuth()`（Supabase にログインしているだけ）で通っていた。`requireMember()` または当該PJのワークスペース権限（DB 再確認）に絞った。
- 外部向けメールログインを PKCE にした（§2）。

## 9. 残課題

- **ログインなしで読める表**: 公開用の鍵だけで、`project_monthly_cashflow`（SOL の資金計画を含む）、`project_pl_monthly`、`project_knowledge`、`monthly_reports`、`company_budget_monthly`、`member_activities`、`tsukuyomi_chat_logs`、`llm_prompts` など多数の表が読める（`{public}` に `USING (true)` の読み取り方針が125件）。DD の公開版は保護されているが、元データそのものが外から読めるため、**DD を投資家へ開く前に閉じる**。ログインなしで動く画面（HUD の埋め込み等）が依存している可能性があり、影響を洗ってから閉じる（まさの判断待ち）。
- `requireAuth()` だけで通る受け口がほかにも残る（`funding-stats`、`progress/unconfirmed`、`atlas/*`、`business-cards/*` など）。外部アカウントの Supabase ユーザーでも通り得るので、上と合わせて点検する。
- 既存の資料室の HTML プレビュー（`/api/workspace-documents/[id]/render`）も、route の付けたサンドボックスの CSP が全体の CSP に上書きされている（DD の添付表示と同じ仕組み。DD 側は `next.config.ts` で上書きし直した）。資料室側を直すと、スクリプトや外部の画像に頼る既存の HTML の表示が変わるので、まさの確認を取ってから直す。
- 検査 `test:workspace-documents-contract` と `test:workspace-fact-origin-contract` は、DD 実装前の main でも落ちている（deploy 前ゲートの外）。
- 将来拡張（初回は作らない）: 投資家ごとの追加開示（パッケージを分けるか、項目の audience を持たせる）、質問対応、添付の PDF 化、知財台帳・契約・体制・燃料の試算の写し方、DD 全体の PDF 出力。

## 10. SOL（p21）の状態

- パッケージ `sol`（SolvioraX DD資料）は `draft`（未公開・管理者だけがプレビューできる）。閲覧権限は0件。投資家への招待・付与はしていない。
- 掲載項目は、DD初版（Drive `p21_sol/260930_DD資料パッケージ`）の構成を参考に、現在の SOL のコックピット・ワークスペースの元データから下書きとして選んである（どれも未公開）。公開はまさが下書きを確認してから行う。

## 確認した current truth

- `pwa/src/lib/dd-package-core.ts` / `dd-access.ts` / `dd-payload.ts` / `dd-sources.ts` / `dd-package-server.ts` / `dd-format.ts`
- `pwa/src/app/dd/**`、`pwa/src/app/(app)/project/[projectId]/dd/**`、`pwa/src/app/api/admin/dd/route.ts`
- `pwa/src/components/dd/**`、`pwa/src/components/cockpit/tech-blocks.tsx`、`pwa/src/components/admin/DdGrantLedger.tsx`
- `pwa/scripts/migrations/455_dd_packages.sql`・`456_sol_dd_initial_selection.sql`、`pwa/scripts/dd_package_db_readback.sql`
- `pwa/scripts/check_dd_package_core.mts` / `check_dd_payload.mts` / `check_dd_package_contract.mjs`
