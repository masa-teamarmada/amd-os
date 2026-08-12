# admin オペ

月次の管理オペレーション。

## admin 共通レイアウト

`/admin/*` を開いている間は、通常の AMD OS 左メニューが admin 専用メニューへ切り替わる。通常メニューと admin メニューを横に2枚並べない。admin メニュー先頭の `AMD OS` からダッシュボードへ戻れる。

admin の各業務表は、この単一メニューを除いた本文幅を使う。契約台帳のような横長の表を、入れ子のサイドバーで狭めない。

adminメニューは追加順ではなく、`組織・権限`、`契約・お金`、`PJ・実行`、`知識・AI`、`運用`の仕事単位でまとめる。

既存の25画面は削除せず、共通surface catalogから同じ表示名、URL、分類を読む。

mobileではメニュー、戻る、閉じる、各画面リンクの操作領域を44px以上にする。

## admin/kiyo (= きよの月次経理作業台)

URL: `/admin/kiyo`

### 何をする画面か

きよが月次経理をこのURLで完了する主入口。画面名は `きよ`。

1. `立替精算`: 申請・編集、PM承認・差戻し、admin承認・却下
2. `請求書`: 発行前確認、freee取引先設定、請求書発行、発行取消
3. `メンバー支払`: 報酬確認、支払通知書発行、PDF確認、送付、入金確認nudge

上の3taskは `/admin/kiyo?task=...` で切り替わる。専用画面へのリンクではなく、`/reimburse`、`/admin/invoices`、`/admin/payouts` の現行作業componentを同じページ内に埋め込む。そのため処理内容、権限、保存先、server-side guardは各専用画面と一致する。

「読み取り専用」の状態一覧には戻さない。確認したあと別画面を探す運用も作らない。

3taskの切替UIは丸角カードではなく横並びタブ（`role="tablist"` / `role="tab"` / `aria-selected`、角丸ゼロ・影ゼロ・border-only）。PCは3taskを同じ幅の3区画として隣接表示し、縦の境界線で区切る。選択中の区画は古典的なタブのように上辺・左右辺を持ち、下辺を作業面の背景色で消して下の作業面とつながる前面状態にする。非選択の区画は薄い面色と下辺を持つ。1段目に番号+名称、2段目に工程説明を置き、区画幅は説明の長さに引っ張られず3等分で固定する（説明は省略記号で切る）。mobileは各タブに安定したmin-widthを持たせ、タップ領域44px以上を保ったまま意図的な横スクロール1行タブにする。見出し・タブ・埋め込み作業面の余白は4/8/12px系の密な間隔にし、埋め込み時は各専用画面側の重複見出し（`請求書発行` / `Payouts` 等）を出さず、きよのタブ見出しだけで用途を示す。専用route（`/reimburse` / `/admin/invoices` / `/admin/payouts`）はカード型の見出しをそのまま維持する。

## admin/weekly (= 週次活動 × 月次報酬マトリクス)

URL: `/admin/weekly`

### 何をする画面か
member_activities(`source='member_weekly'`) を PJ × メンバーのマトリクスで一覧する。マイページの「今週やったこと」を全メンバー分集約した admin ビュー。週は JST 月曜はじまり、◀前週 / 次週▶ で最大 26 週さかのぼれる。

### 報酬の可視化 (2026-06-12 追加)
- 各セルの橙色バッジ = そのメンバー × PJ の**月次報酬** (`billing_cycles.reward_summary_json` の `members[].totalPay`)。週次按分ではなく、**表示週の月曜が属する月**の月次計算値
- 右端列 = メンバー別の今月報酬合計、最下行 = PJ 別の今月報酬合計、右下 = 今月支払総合計 (サマリーバーにも表示)
- 報酬計算の仕様は [`manual/7-1-reward-calc-spec.md`](7-1-reward-calc-spec.md)、支払通知フローは下の admin/payouts を参照
- 活動が無くても今月報酬がある PJ / メンバーは行・列に表示される (= 抽出漏れの発見にも使う)
- **役員 (`members.is_officer=true`、まさ・きよ) の報酬は表示しない & 0 円扱い** (= セルバッジ・メンバー合計・PJ 合計・総合計すべてから除外、まさ確定 2026-06-12)

### データの入り方
週次活動の抽出は Mac の Codex automation `AMD OS D-10 メンバー活動根拠抽出 (Mac)` (`amd-os-l2-2`, 18:30 JST) が書く。PWA route `/api/cron/member-weekly-activities?mode=evidence` は証拠を集め、Codex automation が活動文を合成して `POST /api/cron/member-weekly-activities` で保存する。窓は前日18:00〜当日18:00 の 24h。詳細は [`manual/8-3-l2-extraction-routines-spec.md`](8-3-l2-extraction-routines-spec.md)。legacy `interactive=1` GET 一発実行は保存に使わない。

**全メンバー抽出の前提 (2026-06-12)**: Gmail / Calendar はメンバー本人の Google OAuth token (`member_google_oauth_tokens`) で本人として読む。token は **そのメンバーが PWA に Google ログインした時に自動保存**される。一度もログインしていないメンバーは Gmail / 本人 Calendar が読めず抽出が薄くなる — 特定メンバーの行だけスカスカなら、まずその人に PWA ログインを 1 回してもらう。

## admin/payouts (= 月次支払通知書フロー)

URL: `/admin/payouts?ym=YYYYMM`

### 何をする画面か
AMD から SU に対する月次業務委託費 (= AMD 業務委託フィー) の **支払通知書発行**フロー。SU 法人がまだ無い PJ (= pre-founding) でも、業務委託契約に基づき支払が発生する。

### 月次サイクル
1. **報酬サマリ表示** (= 過去 cycle の `billing_cycles.reward_summary_json` をキャッシュ表示)
2. **月次ベースでメンバー別支払額確認**
3. **支払通知書発行**:
   - **番号発行** (= `payout_notices.notice_no` = `PN-YYYYMM-NNN`)
   - **PDF URL 保存** (= GAS `064_PayoutFreeeNotice.js` で改善版フォーマット生成)
   - **送付済み化** (= `payout_notices.sent_at` set)
4. 「PDF 確認」ボタンで支払データ確定前でも確認用 PDF 生成可能 (= 確認用は `payout_notices` に保存しない)

### 重要な仕様 (= 過去ハマり防止)
- 通常 GET は **報酬キャッシュを読むだけ** (= `syncRewardSummariesForBillingCycles` は重い再計算なので暗黙実行しない)
- `ym` はメンバー支払月。`billing_cycles.invoice_ym` はクライアント請求月なので、支払対象の稼働月は PJ 台帳の支払条件から判定する
- 手動「報酬キャッシュ再計算」ボタンまたは保存系処理だけが `refreshRewards=1` で再計算
- ZMP の通常固定費は 300,000 円 × 65% = 195,000 円を本契約 cap として扱う。OkuDoor追加開発など追加受託分は通常capに混ぜず、MS `tag='cap_extra'` の別財布支払として確認する
- 支払通知書 PDF フォーマット: **2026-04 改善版** が正本。白地、青アクセント、公式ロゴ画像、青ヘッダ明細表、税内訳、支払予定/方法/振込先/備考を出す
- `setValue("team ARMADA")` / `brandCell` / `支払通知書番号` 等の旧版 anchor は復活禁止 (= `npm run test:critical-ui` で検知)
- golden PNG: `pwa/scripts/__fixtures__/payout_notice_golden.png` + SHA256

### ScriptProperties
- `PAYOUT_LOGO_FILE_ID` / `PAYOUT_LOGOTYPE_FILE_ID` を gas/CLAUDE.md に明記

→ 詳細仕様: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md)

---

## admin/projects

URL: `/admin/projects`

### 何をする画面か
全 PJ 台帳の編集。
- PJ メタ (= 名前 / レーン / アウトカム / 設立日 / 起源機関 / 代表者)
- 月次予算
- メンバー紐付け
- report_emails (= 月次報告書送付先メールアドレス、chip 表示で個別削除 + 一括保存可能)

### sticky thead
- ヘッダーは `sticky top-0 z-30` で固定 (= 大量 PJ で下スクロールしてもヘッダー見える、まさ #15 確定 2026-05-24)

### projects.status (= PJ の稼働・営業状態)

`projects.status` は **契約・営業・稼働状態** の軸。`project_category` (= AMD OS 上の扱い / 事業モデル) とは別物。

| value | 表示色 | 意味 | 主な扱い |
|---|---|---|---|
| `draft` | gray | 台帳作成済みだが、契約・稼働・営業状態がまだ固まっていない準備中 PJ | `admin/projects` で情報を揃える段階。通常の月次確認や請求対象にはまだ入れない |
| `active` | emerald | AMD が伴走・運用中の PJ | cockpit / 月次確認 / 請求・支払 / MS 進捗抽出の標準対象 |
| `sales` | blue | 商談・受注前・提案中の PJ | 台帳や資料生成には載せるが、契約後の月次オペは個別に確認してから開始 |
| `ended` | gray | AMD の伴走・契約が終了した PJ | 履歴として残す。新規の月次確認は原則表示しない |
| `frozen` | amber | 明示的に休止中の PJ | 新規月次確認は止める。再開見込みがある場合は `freeze_from_ym` / `restart_expected_ym` も併用 |
| `lost` | red | 失注 / 破談 / 契約化しなかった PJ | `/admin/payouts` では支払原資なしの個別確認対象。契約が取れなかった場合の支払は個別合意が必要 |

#### status と凍結期間の使い分け

- `status` は PJ の大きな状態ラベル。`active` / `sales` / `ended` / `lost` のような契約・営業フェーズを表す。
- `freeze_from_ym` / `restart_expected_ym` は **期間つきの休止オーバーレイ**。たとえば「契約は継続してるが 202605 から一時停止」のように、`status='active'` のまま月次確認だけ止めたい時に使う。
- 複数回の凍結 / 再開履歴は `project_freeze_periods` が正本。`projects.freeze_from_ym` / `restart_expected_ym` は現在表示用キャッシュ。
- 新しく凍結・再開を扱う実装では、`projects.status='frozen'` だけで判断せず、`project_freeze_periods` と現在 ym も見る。

### project_category (= status の右隣の分類チップ)

`projects.project_category` = AMD OS 上で PJ をどう扱うかの軸 (= status と別軸、契約状態とは無関係)。

| value | 表示 | 意味 | AMD Score | MS 進捗抽出 |
|---|---|---|---|---|
| `dtsu` | DTSU (cyan) | 学術発 SU 伴走 PJ (通常) | 対象 | 対象 |
| `new_business` | 新規事業創出 (emerald) | レガシー企業 DX + 研究シーズ取込で新規事業創出 | 対象 | 対象 |
| `ecosystem` | Ecosystem (violet) | 研究機関の SU エコシステム構築業務 | 対象外 | 対象 |
| `advisor` | Advisor (amber) | まさが社外取締役 / 経営顧問として入る PJ | 対象 | 対象外 (月次ノート運用) |

- ZMP (`p19`) は `new_business` (= まさ判断 2026-05-25、葛飾ロード新規事業創出)
- KUTE (`p25`) は `ecosystem`、LST (`p07`) は `advisor`
- 詳細・追加経緯は [§5.6 project_category に `new_business` 追加](9-1-decisions-and-history.md#56-project_category-に-new_business-追加--2026-05-25) 参照

---

## admin/members

URL: `/admin/members`

### 何をする画面か
AMD 内部メンバー台帳の編集。
- code_name (= AMD OS 内で使うメンバー識別名)
- email
- 個人情報 (= 入社日、稼働率等)
- 支払通知書向け情報 (= 契約者名、住所、インボイス登録番号、振込先)
- どの PJ に伴走してるか

### sticky thead 同様

---

## admin/japanese-culture-map (= 日本文化マップ)

URL: `/admin/japanese-culture-map`

### 何をする画面か
日本文化コンテンツを、admin 側でマインドマップと日本地図の 2 つの見方で確認する読み取り専用ビュー。

- `jp_culture_items` の active 行を表示する
- マインドマップでは大分類 / 中分類 / アイテムのつながりを見る
- 日本地図では都道府県 / 市区町村ごとの文化コンテンツを見る
- 旧 `/japanese-culture-map` は、この admin route へ移動済み

### 重要な仕様
- 通常の「資料」ナビや共通左サイドナビには置かず、admin 画面内のサイドバーだけに置く。
- この画面から DB 書き込み、LLM 呼び出し、外部同期は行わない。

---

## admin/private-wiki (= 裏wiki)

URL: `/admin/private-wiki`

### 何をする画面か
AMDメンバー、取引先、クライアント、研究者、外部協力者など、人物単位の関係性メモを PJ ごとに残す admin-only 台帳。

- 人物名 / 種別 / 所属 / 関係性
- 誕生日 / 出身地 / 居住地 / 接点
- 家族 / タブーなど、接し方に関わる private メモ
- confidence / status
- source_kind / source_ref / source_excerpt

### 重要な仕様
- 保存先は `private_wiki_entries`。RLS は admin authenticated と service_role だけ。
- 通常 PJ cockpit、公開ページ、研究機関外部 workspace には出さない。
- source_excerpt は短い根拠抜粋だけ。メール全文・議事録全文・資料全文は保存しない。
- Codex / えいみが後から投入する entry は `source_kind='codex'` などで出所を残し、低確度なら `status='needs_review'` にする。
- 不要になった entry は削除ではなくまず `archived` にする。直接的すぎる機微情報は本文に残さず、source_ref で辿れる最小限にする。
- 旧 `tags` は既存互換のため DB には残すが、UI/API の編集・検索・フィルタの主導線には使わない。人物文脈は `birthday_label` / `origin_label` / `residence_label` / `contact_context` / `family_note` / `taboo_note` に分けて保存する。

---

## admin/management-knowledge (= 経営ノウハウ)

URL: `/admin/management-knowledge`

### 何をする画面か
事業化ルート、座組、価格、資金、法務論点など、PJをまたいで再利用できる経営ノウハウを保存する admin-only 台帳。

- タイトル / 分類 / route_type / maturity
- 要約 / 本文 / 再利用条件 / 次に確認する論点
- tag / confidence / status
- source_kind / source_ref / source_excerpt

### 重要な仕様
- 保存先は `management_knowledge_entries`。RLS は admin authenticated と service_role だけ。
- `project_id` は任意。null は AMD 全体で再利用する知見として扱う。
- source_excerpt は短い根拠抜粋だけ。メール全文・議事録全文・資料全文は保存しない。
- maturity は `raw_note` / `hypothesis` / `field_tested` / `playbook` で分ける。思いつきと再利用可能な型を混ぜない。
- 人物の趣味・関係性メモは `admin/private-wiki` に置き、経営ノウハウには混ぜない。
- 初期カードとして、香川の藻場回復メモから Proto-RT 型の事業化知見を保存する。

---

## admin/invoices (= 請求書発行)

URL: `/admin/invoices`

### 何をする画面か
月次の請求書発行ページ。締め済み稼働月のうち、請求額があるものだけをきよが上から処理する。初期表示は `未完了` とし、`発行待ち / 要確認 / 設定不足 / 過去滞留` をまとめて出す。対象月の `発行待ち` 行だけ「請求書を発行」から OS 上で明細確認 → freee 請求書発行まで進める。

未来月、請求が発生しないPJ、稼働期間外、freeze後、請求額ゼロの空cycleは発行対象として表示しない。`budget_yen` は AMD 側の原資/報酬予算なので請求額として扱わない。freee取引先未設定や対外提出が必要な報告書未FIX、立替未確定は発行ボタンを出さず、きよ確認として分けて表示する。過去滞留は稼働月ではなく請求月 (`invoice_ym || ym`) で判定し、請求月が対象月なら今月発行分として扱う。

`要確認 / 設定不足 / 過去滞留` は状態バッジまたは行操作から詳細モーダルを開き、`freee取引先 / 請求額 / 報告書 / 立替` のどこで止まっているかと解消方法を確認する。`設定不足` では freee取引先IDをその場で保存できる。

請求書発行モーダルは、件名、基本明細行、承認済み立替、調整行、請求日、支払期日、備考を確認してから freee 発行する。件名とヘッダーは請求先名 (`client_name`) を使い、AMD内部のPJ名やproject idを出さない。月額固定契約で基本行合計が契約月額と違う場合は、差分を確認してから発行する。

旧 `/admin/billing` は廃止し、互換のため `/admin/invoices` へ自動遷移する。

---

## 立替申請

URL: `/reimburse`

### 何をする画面か
AMD メンバーが業務関連で立替えた費用 (= 出張 / イベント参加費 / 書籍 等) を申請。
- 領収書 (= 写真 / PDF アップロード)
- 金額 / 用途 / PJ 紐付け
- 承認フロー (= まさが /admin で確認 → 月次支払に合算)

### 交通費は片道の金額を入れる

カテゴリが交通費のとき、**金額欄に入れるのは片道ぶん**。「往復」を選ぶと OS が自動で 2 倍して申請する。往復の合計額を入れてから「往復」を選ぶと 2 倍の 2 倍になる。

申請画面ではこれが分かるように、金額のラベルに「片道ぶんを入れて」と出し、出発地・到着地の下に注意書きを置く。金額を入れると、その下に「往復: ¥1,000 × 2 = ¥2,000 で申請」のように**実際に申請される金額**が出るので、送信前に確認できる。

### 申請されたときの通知

新規申請が入ると、admin (= `is_admin` かつ在籍中、Slack ID 登録済み) 全員に Slack DM が届く。申請者自身が admin の場合、自分宛てには届かない。DM には PJ名・申請者・発生日・カテゴリ・金額・摘要・領収書件数と `/reimburse` を開くボタンが入る。

**申請者本人にも同時に受付控えの DM が届く**。「受け付けたよ」+ 申請内容 + 「承認まで 24 時間ごとに admin へリマインドが飛ぶ」の一文が入るので、申請が通ったかどうかを画面を開かずに確認できる。

既存申請の**編集では鳴らさない**。編集のたびに DM が飛ぶと通知が摩耗して、本当に見るべき新規申請を見落とすため。

Slack が落ちていても申請自体は必ず保存される (通知は best effort)。届かなかった場合は API の返り値 `warnings` に理由が残る。

### 承認されないときの 24 時間リマインド

承認されないまま放置された立替は、**24 時間ごとに admin 全員と申請者本人へ再送信**される。

- 毎日 JST 10:00 に cron (`/api/cron/reimbursement-reminders`) が走り、前回送信 (初回は申請時) から 24 時間以上経った未承認申請だけを拾う。深夜には鳴らない。
- 対象は `approved` / `rejected` / `paid` **以外**の状態。つまり PM 承認待ちでも admin 承認待ちでも鳴り続け、**承認・却下した時点で自動的に止まる**。回数上限は設けていない。
- admin 向け DM には「◯日間 未承認のまま」と現在の状態 (PM 承認待ち / admin 承認待ち) が入る。申請者向け DM には「まだ承認されてない」+ 「admin にもリマインドを送った」が入る。
- 申請者が admin の場合は本人向け DM に寄せ、二重には送らない。

### Slack から直接承認する

申請の DM とリマインドの DM には、状態に応じた**承認ボタン**が付く。OS を開かずにその場で判断できる。

- まだ PM が見ていない申請 (= 申請中) には `PM承認` / `差戻し`。
- PM 承認済みの申請には `admin承認` / `却下`。
- 押せるのは権限を持つ人だけ。PM ボタンはそのPJの PM だけ、admin ボタンは admin だけが通る。権限が無い、状態がもう進んでいる (= 誰かが先に処理した) 場合は、押しても反映されず理由がスレッドに返る。
- 反映先は OS と同じ正本なので、Slack で承認した内容はそのまま `/reimburse` の一覧に出る。二重に承認し直す必要はない。

### 承認待ちカードに出る情報

`/reimburse` の承認待ちカードには、交通費の場合、**どこからどこまで移動したか**が出る。出発地 → 到着地、移動手段 (電車 / バス / タクシー / 自家用車 / その他)、片道か往復かが 1 行にまとまる。往復申請では、表示金額 (= 往復合計) の下に片道いくらだったかも出る。摘要だけでは判断できなかった「これは妥当な区間か」をカード上で判断できる。

### 領収書の保管先

添付した領収書は 2 箇所に入る。

1. Supabase Storage `reimbursement-receipts` (= 一次保管、OS 画面から参照する正本)
2. 共有ドライブ `ARMADA/a3_backoffice/立替精算領収書/<発生月 YYYY-MM>/` (= 二次保管、経理が Drive だけで月次処理を閉じられるようにするため)

Drive 側のファイル名は `発生日_PJ名_申請者_金額円_元ファイル名`。月フォルダは初回申請時に自動作成されるので、手で作る必要はない。

Drive への複製に失敗しても申請は通る (= 一次保管には必ず残る)。その場合 Drive にはファイルが無いので、経理側で見つからないときは OS の `/reimburse` から原本を確認する。

---

## admin請求との接続

OS 上の PM 月次ルーティンは廃止済み。報告書確認の軽い連絡は Slack 側で扱い、請求・支払・立替データを触る主入口は admin 側に寄せる。

```text
admin
  /admin/kiyo      -> きよが立替・請求書・メンバー支払を完了する主入口
  /admin/projects  -> PJ 台帳・支払条件・月次予算
  /admin/invoices  -> SU x 月の請求書発行・送付・立替・入金状態
  /admin/payouts   -> AMD から SU への支払通知書
```

廃止後の実装境界は [`pwa/design/routine.md`](../design/routine.md) が開発正本。

---

## admin/settings (= Operations Settings)

URL: `/admin/settings`

### 何をする画面か
Raw Data / L2 Data / Cron Control を見る admin 専用の運用台帳。

- Raw Data: Calendar / Notion / Gmail / Slack / Drive / Web がどの table に入るか
- L2 Data: monthly report, AMD Protocol, MS 進捗, MTG サマリ, 経営ハイライトなどの table と目的
- Cron Control: 稼働中・停止中の処理、旧頻度、入力、出力、Run Now 可否
- DB Settings: `settings` table の key/value

### 重要な仕様
- `Stopped` の operation は意図的に止めている。旧 LLM cron や subscription automation 移管対象なので、すぐ復活させない
- `Run Now` できるものも、`dryRun` がある時はまず `dryRun=1` で確認する
- 表示内容の正本は `pwa/src/lib/operations-catalog.ts`

詳細は **[6-1 章 Operations Settings](6-1-operations-settings-spec.md)**。

---

## /proactive (= 先手 TODO リスト)

URL: `/proactive`

### 何をする画面か
全 PJ 横断・期限順・1 画面の先手 TODO リスト。「外部 MTG が終わったあと AMD ボールが止まる」「相手から催促されるまで動かない」を防ぐためのリスト。

### どこから TODO が湧くか
毎朝 09:15 JST に動く `/api/cron/proactive-todo-extract` が自動投入する (= MVP は daily 運用。物足りなければ後で頻度を上げる)。検知元は 2 つ:

1. **過去 14 日の開催済みMTGの `next_actions`**: AMD ボール or 主語不明のものだけ。「○○先生が」「相手側」など相手主語のものは入らない
2. **PJ連絡先から届く期限つきGmail依頼**: 返信・返送・日程回答など、期限を読める依頼だけを積む

予定MTGの agenda / 進行案準備は Codex の W-Prep / prep worker で行う。2026-08-11 以降は `次回MTG準備` を先手TODOへ新規生成せず、既存の未対応・ブロック中も「関係ない」へ自動退避する。

開催済みMTGの `next_actions` から作る TODO は、本文内に「2026-08-04 次回MTGまで」「8/4のMTGまで」「7/17まで」などの日付つき期限があればそれを期限にする。明示期限が読めない場合だけ、前回MTG日 + 7 日を仮期限にする。

### 使い方
- タブ: 未対応 / ブロック中 / 完了 / 関係ない
- 行をクリックで展開、元 MTG・元 next_action テキスト・期限・ボール種別が見える
- 3 ボタン:
  - **✅ 完了**: やった
  - **⏸ ブロック中**: 待ち中 (任意で 1 行メモ、3 日経つと自動で「未対応」に復帰する)
  - **🗑 関係ない**: cron 誤検知扱い、二度と同じものを積まない
- 期限超過の open は 🔴 red になり、dashboard 上段のバッジが赤くなる

### dashboard 上段のバッジ
左上の「先手 TODO」バッジは admin のみ表示。未対応件数 / 期限超過件数を 1 行で出し、クリックで `/proactive` へ。

### 過去の経緯
2026-06-12 に「ループカーネル × 役割レンズ」として `/loop` の 5 段ループ盤面 (観測 → 評価 → 判断 → 実行 → 学習) と dashboard 上段の `LoopKernelBoard` を実装したが、(a) 5 段のうち先手と関係する段が「実行」だけだった (b) 完了UIが無く超過 666h の seed が叫び続けた (c) heartbeat の受け側 (= 司令塔セッションのえいみ) が実運用で機能しなかった、という理由で 2026-06-27 まさ判断で**白紙やり直し**。詳細仕様は [`pwa/spec/2-4-proactive-todo-current-spec.md`](../spec/2-4-proactive-todo-current-spec.md)。

---

## 関連
- 設計議論: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md) (= 各画面の消してはいけない業務導線), [`pwa/design/routine.md`](../design/routine.md) (= 月次ルーティン廃止)
