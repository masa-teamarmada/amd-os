# SPEC — AMD OS PWA

AMD OS PWA の **正本仕様書**。
画面構成・データモデル・共通インフラ・運用コマンド・実装規約を 1 箇所にまとめる。

> **manual / spec / bzm 3層分割中**: PWA ランタイム・route・API・cron の確定仕様は `/spec/2-1-pwa-runtime-routes.md` へ移行開始済み。移行完了までは、この `design/SPEC_pwa.md` も未移行領域の正本として残し、迷う内容は両方に置く。

このファイルは「いま何があるか」を記述する。
- 各セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- バグ・教訓 → `BUGS.md`
- 直近セッション + 次の一手 → `HANDOFF_pwa_rebuild.md`
- 共通運用ルール → リポジトリ root の `CLAUDE.md`

仕様が変わったらここを **同じ commit** で更新する。

---

## 1. 概要

| 項目 | 値 |
|---|---|
| 種別 | Next.js (App Router) PWA |
| 技術 | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui |
| 正本パス | `/Users/masa/projects/AMD/amd-os/pwa` |
| リポ | `https://github.com/masa-teamarmada/amd-os.git` (branch: `main`) |
| Vercel project | `amd-os-pwa` (scope: `armada0130`, projectId: `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`) |
| 本番 URL | https://amd-os-pwa.vercel.app |
| Supabase | `nbnhrhybjslbawdukvvk` (Tokyo) — モノレポ全クライアント共通 |
| ローカル dev | `npm run dev` (default port 3000) |

---

## 2. ディレクトリ構成

```
pwa/
├── SPEC_pwa.md                  ← この文書 (正本仕様)
├── HANDOFF_pwa_rebuild.md       ← 直近セッション + 次の一手だけ (slim)
├── BUGS.md                      ← バグ/教訓 (症状/原因/解決策/教訓 型)
├── CLAUDE.md / AGENTS.md        ← PWA 固有ルール
├── design_log/                  ← セッションログ・設計議論・MS knowledge 等
│   ├── sessions_2026-04.md
│   ├── sessions_2026-05.md
│   ├── 2026-04_atlas.md
│   ├── 2026-04_policy_signals.md
│   ├── 2026-04_progress_estimation.md
│   ├── 2026-05_venture_map_model.md
│   └── ...
├── public/
│   └── tsukuyomi/sheet-v4.png
├── scripts/
│   ├── apply_ddl.py             ← Supabase Management API で DDL 適用
│   └── migrations/NNN_name.sql  ← 全 migration 必ずここに残す
├── src/
│   ├── app/
│   │   ├── (app)/               ← 認証必須ルート (middleware で gate)
│   │   ├── api/                 ← API routes / cron
│   │   ├── auth/                ← Supabase Auth callback / login
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/  cockpit/  dashboard/  nav/  tsukuyomi/  venture-map/  ui/
│   ├── lib/
│   │   ├── supabase/            ← client / server / middleware / api-auth
│   │   ├── supabase-data.ts     ← 主データアクセス層 (anon read-only + auth client)
│   │   ├── gas-api.ts           ← GAS bridge (legacy / 暫定)
│   │   ├── atlas-*.ts           ← Atlas 各機能
│   │   ├── venture-map-data.ts  ← Venture Map データ
│   │   ├── progress-estimator.ts
│   │   ├── exec_summary/        ← ⭐ 「📑 全 PJ 紹介資料作成」用テンプレ正本
│   │   │   ├── template_section.html         ← 雛形 04 CHALLENERGY section (= 文字置換ベース)
│   │   │   ├── template_section_challenergy.html  ← 雛形オリジナル (絶対パス未修正、参考用)
│   │   │   └── template.css                  ← 雛形 polish-styles + 本体 CSS (18KB)
│   │   └── ...
│   ├── middleware.ts            ← matcher で _next / favicon.ico / manifest.json / *.{ico,png,svg,...} を bypass
│   └── types/
├── public/
│   ├── AMD_logo_mark.png        ← team ARMADA ロゴマーク (= 雛形コピー、紹介資料 + favicon source)
│   ├── AMD_logotype.png         ← team ARMADA ロゴタイプ (= 雛形コピー、紹介資料用)
│   ├── favicon-amd.ico / favicon.ico / icon.png / apple-icon.png  ← public/ 直配信 (= app/ から移動、Next.js Route Handler 経由を停止。HTML は cache 回避のため favicon-amd.ico を優先)
│   ├── icons/                   ← PWA installable 用 192/512 + maskable
│   ├── manifest.json            ← 4 icons (any + maskable)
│   └── ...
├── AMD_allPJ_introduction.html  ← まさが渡した PJ 紹介資料の雛形 (= bundler tipo、template の出典元、編集禁止)
├── supabase/                    ← (モノレポ ios/supabase が正本)
├── vercel.json                  ← cron 定義 (sync-pj-facts 含む)
└── package.json
```

---

## 3. ルーティング

### 公開ルート (no auth)

| パス | 役割 |
|---|---|
| `/` | top → 認証済みなら `/dashboard`、未認証なら `/auth/login` |
| `/auth/login` | Google OAuth ログイン (Supabase Auth) |
| `/auth/callback` | OAuth callback |
| `/hud/dashboard/embed` | STAPA投影資料など外部プレゼン用の公開HUD埋め込みroute。通常の `/hud/dashboard` は認証必須のまま、embed routeのみ `frame-ancestors 'self' http://127.0.0.1:8766 http://localhost:8766` を許可する。 |

### `(app)/` 配下 (auth 必須、middleware が gate)

| パス | 機能 |
|---|---|
| `/dashboard` | トップ。PJ 一覧 + 先手TODOバッジ + Atlas/Venture Map/MyPage/Admin への入口。上部のバイタルサイン枠はクリックで AMD 全体 cockpit (`/project/p00/cockpit`) へ遷移し、右上の詳細リンクだけ `/management-score` へ遷移する。基本表示順は左/mainカラム内で PJ 一覧 → 研究機関ERSリスト、下段全幅で Company Content shelf。PJ一覧は通常PJだけを表示し、AMD 全体PJ (`p00`) はバイタルサイン枠を入口にして通常PJ一覧には表示しない。`projects.project_category='ecosystem'` または `p25` / `p28` / KUTE・NIMS名に該当する研究機関エコシステム構築PJは研究機関ERSリスト側へ寄せる。研究機関ERSリストはPJリストの続きとして、PJ名を主タイトルに寄せて KUTE / KGW / NIMS を title、工学院大学 / 香川大学 / 物質・材料研究機構を subtitle にする。KUTEカードは `/institutions/inst_kute/cockpit`、NIMSカードは `/institutions/inst_nims/cockpit` へ遷移する。Company Content shelf はメンバー / 沿革 / メディア掲載 / photo を preview する。右カラムの MyPage embed は「今週やったこと」までに留め、月別PJカードは `/mypage` 単体にだけ残す |
| `/dashboard-cyber-3d-lab` | 実験中の3D Cyber Dashboard。`three.js` 空間上に X/F/M 軸、PJ球体、床面KPI、ホログラム投影コックピットを配置。仕様方針は [`cyber_hud_design_code.md`](cyber_hud_design_code.md) / [`cyber_dashboard_content_design.md`](cyber_dashboard_content_design.md) |
| `/dashboard-cyber-glass-cube` | 廃案比較用の旧 Cyber Dashboard 第2案。ガラスキューブPJ群は情報構造がカオス化したため、今後の正本候補にはしない。公開モックは `/mock/dashboard-cyber-glass-cube` |
| `/dashboard-cyber-hud-wall` | Cyber Dashboard 第2案の作り直し。固定視点の `three.js` 空間に、参考HUD画像のようなKPI/PJ/Proof/Alert HUDモジュールを固定配置し、PJ選択時は同一空間内にPJ Cockpit Spatial Viewを展開する。公開モックは `/mock/dashboard-cyber-hud-wall` |
| `/mypage` | 自分の参加 PJ × 今月の活動 + 今週やったこと + 月次報酬予定。PM向け月次TODO/nudgeは出さない。りり (`ID006`) は NIMS からの無償出向のため、報酬額は金額ではなく `ー` 表示 |
| `/project/[projectId]/cockpit` | PJ コックピット (上 Header + Hero (AMD Score + XRL 横並び) + MS / 資料 + 経営ハイライト + ガバナンス + 助成金 + 下段 月次 + MTGサマリ)。Header はPJリスト正本からPJメンバー、契約条件、業務委託料、支払い条件、提出物、立替精算の発生額/不可を表示する。資料は Drive の当該PJ folder配下 `AMD OS 資料` folder に保存し、OSには `project_documents` のmetadata/linkだけを残す。旧 `proactive_outbox` 由来のTODO欄は表示しない。`max-w-[1600px]` で画面幅を広く使う。詳細は [`cockpit.md`](cockpit.md) / [`project_strategy_signals.md`](project_strategy_signals.md) |
| `/institutions/[institutionId]/cockpit` | 研究機関カードから開く機関コックピット。KUTE (`inst_kute`) は既存KUTE PJ (`p25`)、NIMS (`inst_nims`) は正式NIMS OS導入PJ (`p28`) の `CockpitView` を同画面へマウントし、MS進捗・月次・MTG履歴を操作/確認する。CX (`p20`) はNIMS導入の初期ユースケースであり、NIMS PJそのものとは分けて扱う。既存PJコックピットの内容も研究機関ERS側の評価内容も削除しない。上部にERS概要と readiness snapshot を置き、進捗管理とスコア詳細をタブで分ける |
| `/project/[projectId]/config` | 旧PJ設定。コックピットからは導線を外し、PJごとの契約・請求・支払条件は `/admin/projects` を正本にする |
| `/manual` `/manual/[slug]` | AMD OS マニュアル。`pwa/manual/*.md` を正本として表示し、左カラムで章タイトル / summary / 見出し / 本文 / 画面パス / テーブル名を全文検索できる。`/manual` と各章だけに Gemini 実験版の `ManualTsukuyomiFloat` を出し、`POST /api/manual/tsukuyomi/ask` が該当章のマニュアル本文を根拠に回答する。DB 書き込みや既存つくよみ修正 tool は持たない |
| `/knowledge-map` | AMD Knowledge Map。`protocols` / `project_knowledge` / `member_knowledge` / `project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `monthly_reports` / `textbook_insight_candidates` の件数と直近代表 node を force graph で表示する read-only route。NotebookLM へ渡す Knowledge Pack の OS 側プレビューであり、raw本文は持たず、L2 text / short refs / status だけを表示する |
| `/reimburse` | 立替精算 |
| `/admin/settings` | Operations Settings。admin限定で Raw Data / L2 Data / Cron Control を一覧化する。停止中cronはここに旧頻度・入力・出力・停止理由を表示する。`/settings` は一般ユーザー誤操作防止のため削除 |
| `/atlas` | シグナル & ストーリー一覧 |
| `/atlas/inbox` | 未確認シグナル (政策/ニュース フィルタ + 一括 Accept) |
| `/atlas/inbox/submit` | 手動投入 (auto-tag 付) |
| `/atlas/map` | ストーリーノードグラフ |
| `/atlas/divergence` | マクロトレンドマップ (世界×日本 3 ビュー: カード / 散布図 / ヒートマップ) |
| `/atlas/decisions` | 判断ログ |
| `/atlas/admin/themes` | テーマクラスタリング管理 |
| `/venture-map` | 9 PJ プロット (View A) |
| `/venture-map/su/[id]` | SU 個別ビュー (XRL × マクロ指数) |
| `/venture-map/amd-score` | AMD Score 一覧 (PRS primary、legacy M-X-F comparison)。詳細は [`amd_score.md`](amd_score.md) |
| `/venture-map/amd-score/[projectId]` | AMD Score 個別 (PRS Primary / PRS history / legacy Triple Helix M-X-F / 軸クリックで Tsukuyomi) |
| `/venture-map/amd-score/retrofit` | α 重み調整 + 全 PJ シミュレーション (タブバー非表示、詳細ページからリンク) |
| `/management-score` | AMD Management Score (会社全体の経営状況スコア: 先手力 / 財務耐久 / 既存PJ継続 / 新規案件獲得 / 戦略接近度)。詳細は [`management_score.md`](management_score.md) |
| `/admin/contracts` | 契約管理。admin左メニュー配下の契約台帳で、初期表示は `registry_status IN ('accepted','candidate')` かつ cancelled 以外の「1行=1契約/契約ファミリー」だけを出す。MTG、議事録、テンプレート、Drive folder は契約行ではなく evidence として扱う。契約予定枠、status、相手先、関連PJ、締結/発効日、終了/更新日、version history、押印版metadata、5生データ予兆dry-run、Slack nudge dry-runを扱う。実ファイル本体は `共有ドライブ/ARMADA/a3_backoffice/契約` に置き、DBにはDrive metadata/linkだけ保存する。詳細は [`/spec/5-6-contracts-management-current-spec`](/spec/5-6-contracts-management-current-spec) |
| `/venture-map/oscillator` | (実験) coupled oscillator 可視化 |
| `/venture-map/state-space` | (実験) Triple Helix 状態空間 |
| `/scholar` | 学術トレンド (μ_A 観測量 N) — lane × quarter の論文数 line chart + 前年同期比。OpenAlex 由来。詳細は [`amd_score.md`](amd_score.md) Triple Helix 観測モデル参照 |
| `/reimburse` | 立替精算。PWAから申請/編集/削除、領収書添付、PM承認、admin承認まで実行。申請/編集は `/api/reimbursements` 経由で server-side 保存。status flow: `submitted` → `pmApproved` → `approved` |
| `/admin/invoices` | admin 請求書発行。締め済み稼働月のうち請求額がある行だけを、きよが処理する `発行待ち / 要確認 / 設定不足 / 発行済み / 送付済み / 入金済み / すべて` filter で一覧する。`発行待ち` だけ `発行` / `請求書を発行` から OS → freee の請求書発行を実行でき、freee取引先未設定や報告書未FIX、立替未確定は発行対象から分ける。旧 `/admin/billing` はこの route への互換 redirect のみ |
| `/admin/payouts` | 報酬支払。支払月を選び、`billing_cycles.invoice_ym` があればそれを優先、空なら `/admin/projects` の支払条件 (`projects.payment_due_rule`) から支払月を自動判定して報酬確定済みcycleを集約する。通常表示は `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけにし、明示的な「報酬キャッシュ再計算」・発行/送付などのwrite処理・日次 `payout-reward-cache-refresh` cron だけが再計算する。画面を開いただけでは保存しない。画面の支払額とPDF生成元は最新計算額を正にし、`monthly_reward_payout.total_pay` / `payout_notices.total_yen` は税抜スナップショットとして、夜間の `payout-notice-prebuild` または正式PDF発行時に同期する。PWA集約済み明細からの改善版支払通知書PDF発行 (`notice_no` / `pdf_url` / `sent_at`)、契約由来の本契約cap確認、OkuDoor追加開発などの別財布支払分離、縦型PJ収支表、本契約cap超過チェック、後追い予算未確定 / 予算不足 / 失注ステータス警告、入金確認nudge、明細クリックから月次モーダルを開く導線を持つ。報酬額の手入力フォームは置かず、MS / PlanCycle / responsibility から計算できるものだけを支払対象にする。`tag='cap_extra'` のMSは `extraBasePay` として通常枠から分離し、画面では `本契約発生` / `別財布発生` を別表示する。`メンバー別支払` は主作業表としてサマリ直下・報酬債務台帳より上に置き、PDF URL手入力欄は置かず、各行に `支払通知書発行` / `PDF確認` / `送付` を置く。メンバー別支払の `支払額` は画面上で税抜 / 税込を併記し、DB同期値 (`monthly_reward_payout.total_pay` / `payout_notices.total_yen`) は税抜。PDF宛先は `members.contractor_name` (= 未設定時は `member_name` / `code_name`) と `members.member_address`、メンバー側インボイス登録番号は `members.invoice_registration_number` を使い、PDF上のラベルは宛先側・発行者側とも `登録番号`、発行者側の値は AMD のインボイス登録番号 `T7021001064067` を表示する。PDFには振込先欄を出さない。行の `PDF確認` は保存済み正式PDFを開くだけで、PDF生成は行わない。確認用PDFを作る場合は別操作の `確認用PDF生成` を使い、`payout_notices` には保存しない。`payout-notice-prebuild` は支払データ同期後に正式PDFを事前生成する。正式な通知書発行・全員分PDF一括発行・強制再発行は、サーバー側で最新計算額を同期してから実行する。金額変更分、現行テンプレート更新時刻より古い未送付PDF、または `members.updated_at` より古い未送付PDFは再生成対象へ戻す。最新支払計算に対応する明細が無い未送付 `payout_notices` は孤立レコードとして削除し、古いPDFリンクを active な通知書として残さない。送付済み通知書は履歴保護し、`force=true` でも上書きしない。通常の差分は発行時に自動同期するため状態バッジを出さず、開きっぱなしの画面は 60 秒ごとに read-only 再取得して同期状態だけ追随する。月初合意gate・本契約cap blocker がある場合だけ `同期できない` と表示し、admin override または blocker 解消を待つ。一括PDF生成で失敗または強制再発行なのに未送付PDFが未再生成になった場合は `ok: false` として画面に失敗を出す。`送付` は確認モーダル (件名: 支払通知書のご案内 固定 / 本文編集可 / 添付PDF / Bcc: masa+kyoko 固定) を開く前にPDF生成せず、保存済み正式PDFが最新DBと一致し、確認用PDFではなく、未送付であることだけを照合する。そこで「はい・送信」を押すと保存済み正式PDFを添付して `keiri@team-armada.jp` から実メール送信し、成功時に `payout_notices.sent_at` を set する。支払通知書PDFは admin/payouts の支払額を税抜として扱い、GAS PDF生成時に消費税10%を上乗せして税込合計を出す。支払通知書PDFの見た目契約は [`FEATURE_REGISTRY.md`](FEATURE_REGISTRY.md) の `/admin/payouts` に固定し、`test:critical-ui` でGAS側の改善版フォーマット anchor も検査する |
| `/admin/payouts` 支払通知書再生成 contract | 正式な通知書発行・全員分PDF一括発行・強制再発行は、サーバー側で最新計算額を同期した後に DB を再読込し、最新の `members.contractor_name` / `members.member_address` / `members.invoice_registration_number` を GAS PDF 生成へ渡す。金額差分が無くても、admin が再生成を押したらメンバー台帳の住所・宛名・登録番号修正を反映する。未送付PDFの `last_generated_at` より `members.updated_at` が新しければ差分検出でも再生成対象にする。差分検出で GAS 呼び出しを抑制できるのは cron の先回り生成と非 force の一括発行だけ |
| `/admin/kiyo` | きよ向け月次経理チェック。active PJ だけを対象に、`/admin/payouts` と同じ支払月集計から今月のメンバー支払額、`reimbursements` から立替精算状態、`billing_cycles` から請求書送付状態を read-only で表示する。請求書は `invoice_sent_at` を送付済み判定に使い、`invoice_sent_by` または `billing_log` に `keiri@team-armada.jp` の証跡がある場合だけ `keiri確認` とする。送付済みでも keiri 証跡が無ければ `要確認` と表示し、送付元を断定しない。支払保存・PDF生成・メール送信・立替承認・請求送付などの write action は置かない |
| `/admin/finance` | 経理オペ台帳。サブスク / 固定継続費 / 自動振替 / 引落口座 / budget forward-fill / Gmail領収書イベント |
| `/admin/japanese-culture-map` | 日本文化マップ。`jp_culture_items` の active 行を admin-only の読み取り画面として表示し、マインドマップと日本地図で文化知識を俯瞰する。旧 `/japanese-culture-map` はこの route へ redirect する。 |
| `/admin/management-knowledge` | 経営ノウハウ。`management_knowledge_entries` を admin-only で読み書きし、事業化ルート、座組、価格、資金、法務論点などの再利用カードを保存する。追加/編集/archive、検索、PJ/category/maturity/tag/status filter、`source_kind` / `source_ref` / `source_excerpt` / `confidence` 表示を持つ。書き込みは `/api/admin/management-knowledge` の `requireAdmin()` + service_role 経由。初期カードとして香川藻場回復メモ由来の Proto-RT 型を保存する |
| `/admin/private-wiki` | 裏wiki。`private_wiki_entries` を admin-only で読み書きし、AMDメンバー・取引先・クライアント・研究者・外部協力者などの人物単位メモをPJ別に保存する。通常PJ cockpit、公開ページ、研究機関外部workspaceには出さない。追加/編集/archive、検索、PJ/person_kind/tag/status filter、`source_kind` / `source_ref` / `source_excerpt` / `confidence` 表示を持つ。書き込みは `/api/admin/private-wiki` の `requireAdmin()` + service_role 経由 |
| `/admin/projects` `/admin/members` `/admin/contexts` `/admin/protocols` `/admin/tsukuyomi` `/admin/settings` | 各 admin。`/admin/projects` はPJごとの契約・請求・支払条件の正本で、支払条件は稼働月基準の `当月末 / 当月25日 / 翌月末 / 翌月25日 / 翌々月末 / 翌々月25日` を `projects.payment_due_rule` に保存する。提出物の有無、月次報告書の状態・時期・提出期限・フォーマット・記載事項、立替精算の発生額/不可は `projects.contract_terms_json` に保存し、契約書/見積書から抽出した `contract_terms.extracted_terms_json` と実務運用を Contract Apply / 手入力で畳む。例: 5月稼働分を6月に請求して6月末支払なら `翌月末`。`/admin/members` はGoogle Calendar共有状態 (`members.google_calendar_status`) とOS最終ログイン (`members.last_login_at`) を表示し、最終ログインが新しい順に並べる。支払通知書向けに `members.contractor_name` (= 既定は個人の `member_name`、法人契約時だけ手入力)、`members.member_address`、`members.invoice_registration_number` も編集する。登録番号は保存時とPDF生成時に全角T・T風文字・空白/ハイフンを正規化する |
| `/admin/prompts` | LLM プロンプト管理 (= AGENTS ルール「プロンプトをコードに書かない」執行 UI)。`llm_prompts` 3 件 (tsukuyomi.system / protocol.extract / monthly_report.r313_extract) + スプシ由来 `tsukuyomi_context` 20+ 件を併記。body 全文閲覧 + 編集 + is_active トグル可能。詳細は [`amd_protocol.md`](amd_protocol.md) と [`L2_DATA.md`](L2_DATA.md) |
| `/vcs` | VC リスト (国内ディープテック VC マスタ。ソート/ファセット/検索) |
| `/vcs/[id]` | VC 詳細 (4 ペイン: 特性 / ファンド + DPE残 / PJ 接点 / 出資先 + ニュース) |
| `/vcs/[id]/edit` | VC 編集 (基本情報 + amd_rating + funds/investments/contacts/relations モーダル CRUD) |
| `/vcs/inbox` | VC ニュース受信箱 (verify / dismiss / fundraise → ファンド情報反映)。詳細は [`vc_list.md`](vc_list.md) |
| `/seeds` | 研究シーズリスト (大学・国研・高専のシーズ × AMD 視点の事業化適性)。検索/ファセット/ソート/モーダル詳細編集。詳細は [`seeds.md`](seeds.md) |
| `/seeds/[id]` | シーズ詳細 (URL 直接アクセス用フォールバック)。リスト画面でのモーダルが正規 |
| `/seeds/inbox` | Seeds 受信箱 (cron 自動収集分の未確認シーズ)。verify/dismiss で消化。GlobalNav に sky 色バッジ |

### API routes (`/api/`)

**進捗:** `progress/estimate` `progress/confirm` `progress/unconfirmed` `progress/batch-save` `progress/events` (= member_activities + 新列 initiative_origin/impact/depth/responsibilities を ProgressEvent にマップ、2026-05-12 復元) `progress/revisions` `progress/reimbursement`
**PJ 月次ノート:** `project/monthly-note` (= GET / POST。MS なし PJ でも月次モーダルで自由記述ノートを残せる。`project_monthly_notes` テーブル、PK `(project_id, ym)`、まさ 2026-05-12 タスク 3)
**Atlas:** `atlas/auto-tag` `atlas/backfill` `atlas/seed` `atlas/match-stories` `atlas/merge-stories` `atlas/move-signal` `atlas/themes/{cluster,apply,list}`
**請求/レポート:** `invoice/{create,preview}` `report/{generate,fix}`
**Admin:** `admin/projects/[id]` (= PATCH、AdminProjectsTable から projects + project_ventures 1 セル単位 update を service_role 経由、admin必須)、`admin/members` (= PATCH、AdminMembersTable から members 1 セル単位 update を service_role 経由、保存済み row を返して UI state を置き換える。browser 直接 `members.update` は禁止)、`admin/management-knowledge` (= GET/POST/PATCH。`management_knowledge_entries` を list/create/update/archive。admin必須 + service_role)、`admin/private-wiki` (= GET/POST/PATCH。`private_wiki_entries` を list/create/update/archive。admin必須 + service_role)、`admin/payment-confirm` (= Slack入金確認ボタン / 金額入力フォームから signed token で `billing_cycles.payment_confirmed_at` を更新し、`POST mode=expected` はブラウザを開かず予定額で確定、実額・freee照合の証跡は `billing_log.detail` に保存)、`admin/project-members/bulk` (= POST、PJ メンバー一括 incremental update + 論理削除 (is_active=false)、`ProjectMembersEditor` から呼ばれる、admin/projects のメンバー列モーダルと project/[id]/config の両方で共有、admin必須)、`admin/pj-introduction-html` (= ダッシュボード「📑 全 PJ 紹介資料作成」ボタンから POST、選択 PJ のエグゼクティブサマリー HTML を雛形 fmt で生成。Sonnet 4.5 で 1 PJ ごと JSON 集約 + concurrency 3。雛形 = `src/lib/exec_summary/template_section.html` + `template.css`、prompt = `llm_prompts.exec_summary.extract`、admin必須)、`project-documents` (= GET/POST、PJ cockpit資料。`projects.drive_folder_id` 配下 `AMD OS 資料` folderへDrive uploadし、`project_documents`へmetadata/linkだけ保存。対象PJのactive memberまたはadmin必須)、`contracts` (= GET/POST/PATCH/documents/signal-dry-run/nudges-dry-run。契約書はadmin限定、Drive backoffice契約folder metadata、Slackはdry-runのみ)、`admin/lane-suggestions/[id]` (= LLM lane 提案の approve/reject、admin必須)、`admin/seed-vcs` 等
**通知:** `notifications/feedback` (= admin限定。まさ/きよからの修正依頼を `l2_feedbacks` に保存し、候補L2の「はい/いいえ」状態遷移も処理)
**ソース refs:** `sources/slack/collect` / `sources/gmail/collect` (= source_cacheへ短いsnippet/hash/source_urlだけ保存。取り込み完了通知は作らない)、`cron/governance-email-sweep` (= D-14G。`/admin/projects` の総会/役会ON PJだけ `report_emails` × ガバナンスkeywordで Gmail を検索し、`source_cache(source='gmail_governance')` と `/api/governance/extract` candidate/apply に流す)
**関連メンバー:** `founding-members/revise` (= コックピットのつくよみ修正依頼。提案プレビュー後、OK確定で `project_founding_members` をupsert/invalid化)
**その他:** `activities/infer`

**通知反映ルール:** 通知に表示される候補は、通知画面で「はい」を押したものだけ正本反映する。`project_knowledge` / `founding_members` / `project_registry_diff` / `xrl_evidence` は candidate/tentative/pending を経由し、「はい」で active/confirmed/applied、「いいえ」で rejected/invalid にする。`protocols` は yes で `confirmed`。`member_knowledge` は現 schema に `status` 列がないため、候補採否を row 自体に持つには migration が必要。

**Auth:** Google Workspace login requires `calendar.readonly` and `gmail.readonly`. `/auth/callback` verifies Calendar API access before entering the app, stores non-secret status on `members.google_calendar_status`, updates `members.last_login_at` on successful login, and stores provider tokens in `member_google_oauth_tokens` for server-side ingestion. Existing sessions may not pass through `/auth/callback`, so middleware also touches `members.last_login_at` for authenticated page access at most once per hour.

### Cron (`vercel.json`、UTC、Hobby plan で maxDuration=300 上限)

2026-07-01時点で Vercel cron に残すのは、LLMを使わない運用・同期系だけ。LLM利用cronは `vercel.disabled-crons.json` に退避し、復活にはownerの明示承認を要する。D-2 MS進捗の旧 GAS 154 → PWA `/api/cron/hourly-estimate` も停止済みで、旧MMO writer は現行運用から外す。D-2 LLMズレ検知は rehome required、H-1 は local Codex / Codex automation 側を現行 writer とする。

| path | schedule (UTC) | JST | 内容 |
|---|---|---|---|
| `cron/daily-estimate` | disabled | 03:00 daily | 旧進捗推定cron。LLM課金回避のためVercel scheduleから外す |
| `cron/hourly-estimate` | disabled fallback | — | 旧 D-2 MS進捗 writer。2026-05-29 に GAS 154 と PWA route を再停止。`ALLOW_PWA_LLM_CRONS=1` なしでは LLM を呼ばない |
| `cron/atlas-collect` | disabled | 08:00 daily | 課金回避のため停止済み。旧定義は `vercel.disabled-crons.json` に保管。現在は Codex automation `AMD Atlas外部シグナルレビュー` が担当 |
| `cron/atlas-collect-policy` | disabled | 07:00 daily | 政府方針シグナル収集。Sonnet利用のため停止済み |
| `cron/atlas-daily` | disabled | 06:00 daily | atlas 日次レポート。内部で `atlas-report.ts` がAnthropicを使うため停止済み |
| `cron/atlas-weekly` | disabled | 17:00 fri | atlas 週次。内部で `atlas-report.ts` がAnthropicを使うため停止済み |
| `cron/atlas-monthly` | disabled | 07:00 month-1 | atlas 月次。内部で `atlas-report.ts` がAnthropicを使うため停止済み |
| `cron/atlas-divergence` | disabled | 06:00 sun | テーマ単位 divergence 再生成。Sonnet利用のため停止済み |
| `cron/member-activities` | disabled | 04:00 daily | 月次レポート + MTGサマリ + source_cache refs → Sonnet 推論 → member_activities。LLM課金回避で停止済み |
| `cron/member-weekly-activities` | disabled legacy synthesis / evidence route only | — | Anthropic 経路を持つ legacy GET synthesis は active cron から退避。D-10定期は Codex automation が `GET ?mode=evidence` → `POST activities[]` で保存する |
| `cron/payout-reward-cache-refresh` | `5 18 * * *` | 03:05 daily | `/admin/payouts` の高速表示用に、前月・当月・翌月の支払月で対象cycleを集約し、`syncRewardSummariesForBillingCycles()` で `billing_cycles.reward_summary_json` を再生成する。LLM/GAS非使用。手動実行は `?ym=YYYYMM` 指定可 |
| `cron/payout-notice-prebuild` | `0 17 * * *` | 02:00 daily | 当月+翌月の支払 ym 全部について、まず `monthly_reward_payout` / `payout_notices.total_yen` を最新計算額へ同期し、その後に各メンバーの支払通知書PDFを「金額が変わったもの・まだ無いもの・メンバー台帳更新後で古いもの」だけ事前生成して `payout_notices.pdf_url` / `last_generated_at` に埋める (= 差分検出スキップあり、concurrency=3 並列)。朝 `/admin/payouts` を開いた時点で即PDF表示可能にするのが目的。手動実行は `?ym=YYYYMM&force=1` 指定可。仕様: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`「先回り生成」セクション |
| `cron/relearn-lane-weights` | disabled | 03:30 daily | macro lane weights 再学習。Sonnet利用のため停止済み |
| `cron/macro-backfill-historical` | disabled | 12:00 sun | 2010-2025 macro_index_log を Sonnet 推定で埋めるため停止済み |
| `cron/amd-score-l2-refresh` | disabled | 03:00 mon | 6 ソース (Slack/Drive/Notion/Gmail/Calendar/WebSearch) から AMD Score / XRL根拠 (M-2) を Sonnet 抽出するため停止済み |
| `cron/seeds-ingest` | disabled | 09:00 mon | 研究シーズ探索。LLM/web search課金回避のため停止済み |
| `cron/vc-discover` | disabled | 09:00 sat | VCニュース/VC stub探索。LLM/web search課金回避のため停止済み |
| `cron/papers-quarterly-ingest` | `20 18 * * 1` | 03:20 火 | OpenAlex で ASPI 8 domain × 直近 16 quarter の論文数を papers_log に upsert (μ_A 観測量 N の供給)。Triple Helix 観測モデルの主入力。詳細は [`amd_score.md`](amd_score.md) |
| `cron/founding-members-extract` | disabled | 03:30 火 | 関連メンバー抽出。Sonnet利用のため停止済み |
| `cron/sync-pj-facts` | `0 19 * * *` | 04:00 daily | `project_ventures` の構造化フィールド (founded_at / outcome_pattern / origin_org / origin_pi / lane / amd_support_*) を `project_knowledge` に `category='basic_fact'` で同期。/admin/contexts や cockpit から見える状態に。**まさが PJ ナレッジで設立日 / outcome を見られる用途** |
| `cron/frl-grit-resilience-extract` | disabled | 月初 03:00 JST | FRL grit/resilience抽出。Sonnet利用のため停止済み |
| `cron/macro-aggregate-indicators` | `0 19 1 * *` | 月初 04:00 JST | observation_log + atlas_signals を ASPI lane × month で集計 → `macro_index_log` の `budget_amount` (= kaken/grant 集計) / `investment_amount` (= vc 集計) / `policy_mention_count` (= atlas_signals.source_type='policy' 件数) / `raw_signal_count` (= atlas_signals 全件) を update + 欠落 row を insert。`?since=YYYY-MM` 指定可 (= デフォルト過去 36 ヶ月)。atlas_signals.domain (= "I.ICT・AI" 等の ATL 独自) → ASPI domain mapping は cron 内 ATL_DOMAIN_TO_ASPI に定義 |
| `cron/freee-payment-sync` | `10 0 * * *` | 09:10 daily | freee会計の収入取引 (`/api/1/deals`, `type=income`) と口座明細 (`/api/1/wallet_txns`, `entry_side=income`) を支払月で取得し、取引先ID・請求番号・入金額・PJ別 `payment_alias` からOSの入金予定と照合。支払済みなら `billing_cycles.payment_confirmed_at` を自動更新し、照合証跡を `billing_log.detail` に保存 |
| `cron/payment-confirm-nudges` | `30 0 * * *` | 09:30 daily | 支払月単位で未入金のPJを抽出し、active admin (`members.is_admin=true`) のSlack DMへ入金確認nudgeを送る。ボタンは「予定通り入金済み」(通常は既存URL confirm。`PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` かつ GAS worker デプロイ済みなら Slack interactive action -> GAS worker -> `POST /api/admin/payment-confirm mode=expected` -> つくよみがSlackスレッド返信) と「金額を入力」(`/payment-confirm`)。LLM非使用なのでLLM系cron停止とは別枠で稼働 |
| Codex `AMD OS M-1 月次報告抽出` | Codex automation | 05:30 daily | 5生データ + OS snapshot から `monthly_reports` draft を抽出し、`/Users/masa/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` を作る。非LLM applier が Supabase に反映。R313 / PWA heavy route は定期実行しない |
| Codex `amd-os` | Codex automation | 03:20 daily | 5生データ + OS snapshot から経営ハイライト候補を抽出し、`/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/*.json` を作る。非LLM applier が `project_strategy_signals` / `l2_notifications` へ反映 |
| `scripts/backfill_strategy_signals_from_activities.mjs` | one-shot script | on-demand | 既存 `member_activities` から初期表示用の経営ハイライト候補を決定的ルールで抽出し、outbox JSON を作る。`ms_progress_review_tool.mjs apply-outbox` で `project_strategy_signals` / `l2_notifications` へ反映する。LLM/GAS非使用 |
| `cron/management-score-raw-data` | (vercel cron 未登録) | on-demand / monthly | AMD Management Score 用 raw signal intake。OS内部データを `amd_management_score_raw_signals` に集約。`?includeFreee=1` で freee trial_pl → `company_actual_monthly` も同期。local: `npm run collect:management-score-raw -- --ym=YYYYMM [--include-freee]` |
| `cron/management-score-calculate` | (vercel cron 未登録) | on-demand / after raw | `amd_management_score_raw_signals` から `amd_management_score_snapshots` / evidence を算出。`?ym=YYYYMM` 指定可 |
| `cron/monthly-reports-backfill` | (vercel cron 未登録) | on-demand 手動 curl | billing_cycles LEFT JOIN monthly_reports IS NULL の row を Sonnet 4.6 で順次生成 → monthly_reports upsert。重い従量課金 route なので定期実行しない。定期 writer は Codex `AMD OS M-1 月次報告抽出` |
| `cron/freeze-period-backfill` | (vercel cron 未登録) | on-demand / daily candidate | `projects.freeze_from_ym` + `restart_expected_ym` がある PJ について、休止期間の `monthly_reports` + `project_meeting_summaries` を Sonnet で統合し、`freeze_period_backfills` に保存。対象PJと再開月確認後に手動キック |
| `cron/triple-helix-recompute` | (vercel cron 未登録) | on-demand / weekly candidate | ASPI 8 domain × 直近 16 quarter について、`papers_log` / `atlas_signals` / `observation_log` / `project_ventures.lanes` から BVAR/Kalman smoother で `triple_helix_state_log` を再計算 |

認証: 全 cron route が `Authorization: Bearer ${CRON_SECRET}` を確認。`CRON_SECRET` 未設定なら処理スキップ。

---

## 4. データモデル (Supabase)

スキーマ正本は `ios/supabase/migrations/`。PWA 起源の追加分は `pwa/scripts/migrations/`。

### コア (GAS / iOS と共通)

| table | 用途 |
|---|---|
| `members` | メンバー (28 件) |
| `projects` | PJ (22 件) |
| `project_members` | 紐付け |
| `billing_cycles` | 月次請求 (126 件) — `rewardSummaryJson` / `msProgressSummaryJson` キャッシュ列あり |
| `value_plan_cycles` | PlanCycle |
| `value_milestones` | MS (136 件) |
| `milestone_sub_items` | サブ MS (138 件、チェックボックス) |
| `milestone_responsibility` | 担当割合 + role + task_description (209 件) — `UNIQUE(milestone_id, member_id, role)` |
| `milestone_monthly_progress` | 月次 % + `note` + `source` (`tsukuyomi_estimate` / `pm_confirmed` / `pm_rejected` / `pm_manual` / `routine_auto` / `criteria_toggle`) |
| `monthly_reports` | 月次レポート (final_content / draft_content) |
| `tasks` | 旧カンバン / H-1 next action 互換。`/tasks` 画面は廃止済み |
| `member_activities` | メンバー × 今月活動 (`source='inferred'` / `'slack'` 等) |
| `reimbursements` | 立替 (status: `submitted` `pmApproved` `approved` `paid` ...)。`receipt_storage_paths` / `receipt_file_names` で private Storage `reimbursement-receipts` の領収書添付を保持 |

### Atlas (PWA 起源)

| table | 内容 |
|---|---|
| `atlas_signals` | 個別シグナル (`source_type` に `'policy'` 含む)、`metadata` jsonb (省庁/announced_at)、`story_id` |
| `atlas_stories` | ストーリー (signals を集約) |
| `atlas_story_merges` | merge ログ (LLM が学習する) |
| `atlas_themes` / `atlas_story_themes` | テーマ (54 件確定) と story の多対多 |
| `atlas_divergences` | テーマ単位 世界/日本 要約 + 乖離度 + 活発度 |

### Venture Map (PWA 起源)

| table | 内容 |
|---|---|
| `project_ventures` | SU 系 PJ の基本情報 (`project_id` PK = `projects.project_id` FK)。9 PJ。`ventures` を廃止して 008 で統合 |
| `project_xrl_log` | TRL/BRL/HRL 時系列 + `bottleneck` (旧 `ventures_xrl_log`、008 で rename) |
| `project_events` | PJ ごとの汎用イベントログ (`kind` ∈ hire/funding/deal/governance/note 等、`occurred_on` + `meta` jsonb)。沿革生成の元データ + AMD スコアグラフのアノテーション |
| `amd_score_inputs` | AMD Score の PRS input (`prs_potential`, `prs_r_net`) と legacy 7 軸入力 (μ_A/I/G + 5 XRL + FRL, shallow_tech_mode)。`UNIQUE(project_id, evaluated_at)` (013 migration) |
| `amd_score_alpha` | 弾力性 α_i のバージョン管理 (`effective_from` / `effective_to`、jsonb)。base case を seed 済 |
| `seeds` | seed 管理 |
| `papers_log` | OpenAlex 論文数 (lane × **quarter**、UNIQUE lane+observed_at)。Triple Helix 観測量 N の供給。`cron/papers-quarterly-ingest` で投入 |
| `macro_index_log` | マクロ指数 (lane × month、Atlas 集計 + Sonnet 2010-2025 推定) |
| `macro_lane_weights` | レーン重み (Sonnet が毎日再学習) |
| `triple_helix_loading` | C 行列 (6 観測量 × 3 隠れ状態 μ_A/I/G の loading prior、bvar_prior §3.2)。AmdScoreView の M カードで参照 |
| `project_founding_members` | PJ 関連メンバー (= HRL 評価のベース。SU 立ち上げ候補 / AMD伴走 / 大学キーパーソン)。DB名は紛らわしいが manual 上は「関連メンバー」と呼ぶ。LLM 抽出 route はあるが Sonnet 利用のため schedule 停止中。`(project_id, person_name)` UNIQUE。詳細は [`xrl_evidence.md`](xrl_evidence.md) / [`amd_score.md`](amd_score.md) / [`../manual/4-4-frl-related-members-score-spec.md`](../manual/4-4-frl-related-members-score-spec.md) |
| `project_strategy_signals` | D-6 経営ハイライト。重要方針・事業進捗・戦略転換・提携・資金・知財/規制・リスク・次の一手をPJ単位で保持し、cockpitのMS直下に表示する。詳細は [`project_strategy_signals.md`](project_strategy_signals.md) |
| `project_documents` | PJ cockpit資料のDrive link台帳。実ファイルは Google Drive の `projects.drive_folder_id` 配下 `AMD OS 資料` folder に置き、DBには file id / folder ids / webViewLink / name / MIME / size / uploaded_by / timestamps のみ保存 |
| `proactive_outbox` | 旧先手力維持ループのキュー。2026-06-27 に廃止済みで、Dashboard / PJ cockpit には表示しない。現行の先手TODO棚卸しは `proactive_todos` + `/proactive` + dashboard 上段バッジで扱う |

### つくよみ / その他

`tsukuyomi_nudge_queue` `tsukuyomi_learnings` `ms_progress_revisions` `ms_revision_messages` `source_cache` (Gmail/Slack source refs。旧L1正本ではなく、短いsnippet/hash/source_urlの証跡キャッシュ)

### 月次ノート / 進捗イベント拡張 (2026-05-12 追加)

| テーブル | 役割 |
|---|---|
| `project_monthly_notes` | PJ × ym 単位の自由記述進捗ノート (UNIQUE (project_id, ym))。MS plan_cycle 未設定 PJ でも月次モーダルから記録できる。`/api/project/monthly-note` GET/POST、CockpitMonthlyModal の MonthlyNoteSection から書き込み |
| `member_activities` (= 既存) の追加列 | `initiative_origin` (5 値 + unknown CHECK) / `impact` (1-5) / `depth` (0-1) / `reject_reason` / `origin_lost_reason`。member_id / milestone_id は NULL 許容に変更。/api/cron/member-activities が Sonnet で抽出 → /api/progress/events が ProgressEvent にマップ → CockpitMonthlyModal EventsSection で「先手力」スコア計算 |

### AMD Management Score (設計中)

| テーブル | 役割 |
|---|---|
| `amd_management_score_snapshots` | AMD会社全体の経営状況スコア snapshot。`total_score` + 5軸 (`initiative_score` / `finance_score` / `retention_score` / `pipeline_score` / `direction_score`) + weights / inputs / next_actions |
| `amd_management_score_evidence` | 各軸の短い根拠。full raw data は保存せず、source ref / snippet / confidence / impact を保存 |
| `amd_management_score_source_runs` | Management Score raw data intake の実行ログ。source別 counts / partial error を保存 |
| `amd_management_score_raw_signals` | Management Score 算出前の月次 raw signal。5軸ごとに既存OSデータ / freee / Atlas 等を source_hash + payload 付きで保持 |
| `company_budget_inputs` | GAS `CFG_*` 相当の予算 / 計画入力。PJ売上、固定費、変動費、借入、スポット収支、シナリオを保持 |
| `company_budget_simulation_runs` | GAS `runSimulation()` 相当の実行 snapshot。scenario / params / engine_version / ran_at を保持 |
| `company_budget_monthly` | GAS 月次試算表から移植する予算 / 計画の正本 |
| `company_actual_monthly` | freee API から正規化した月次実績 |
| `company_budget_actual_monthly` | 予算と実績を突合する view。finance_score / 予実管理 UI の主入力 |
| `company_budget_variance_notes` | 予実差分理由・未反映予定・L2根拠の短いメモ |
| `company_finance_recurring_items` | admin finance台帳。サブスク / 固定継続費 / 自動振替 / 引落口座 / budget forward-fill |
| `company_finance_receipt_events` | Gmail/freee/manual 由来の領収書イベント。実績同期・継続費候補の根拠 |
| `freee_oauth_tokens` | freee refresh_token rotation store。service_role 限定で、production cron が refresh 後の最新 token を次回も読めるようにする |

詳細は [`management_score.md`](management_score.md) / [`project_pl_monthly.md`](project_pl_monthly.md)。GAS 月次試算表を予算、freee を実績、AMD OS を予実管理と経営スコアの統合場所として扱う。

### VC List (PWA 起源)

| テーブル | 役割 |
|---|---|
| `vcs` | VC マスタ。`amd_rating` (★1-5) で AMD 視点の相性評価 |
| `vc_funds` | ファンド単位 (vc_id + fund_no 一意)。size / status / `dry_powder_*` (出所: estimated/heard_from_contact/public_disclosure) |
| `vc_investments` | 出資イベント。自社 PJ なら `our_project_id` で `projects` に紐付け |
| `vc_contacts` | VC 担当者 (投資家としての関係。GAP 事業化推進機関は `project_venture_members` を使う) |
| `project_vc_relations` | PJ × VC × AMD担当 × ステータス (not_contacted/pitching/evaluating/dd/term_sheet/invested/passed/declined) |
| `vc_news` | VC 関連ニュース (Atlas とは独立系統)。`verified` / `dismissed` で受信箱状態管理。`suggested_fund_patch` でファンド更新候補 |

### Seeds (研究シーズリスト、PWA 起源 — 024_seeds_overhaul.sql)

| テーブル | 役割 |
|---|---|
| `seeds` | 研究シーズマスタ。機関 + PI + シーズ情報を 1 行に統合。`status` 候補→調査中→接触済→協議中→PJ化/見送り、`amd_rating` (★1-5)、`spun_off_project_id` で PJ 紐付け |
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等の採択) |
| `seed_news` | 関連ニュース・論文・プレス (Atlas とは独立系統) |
| `seed_contact_log` | AMD メンバー × シーズ の接触履歴 |

旧 `seeds` (006_venture_map.sql の予兆 4 件用) は 024 で破棄。Venture Map のグラフ予兆プロットも同時に削除。詳細は [`seeds.md`](seeds.md)。

データ流入: cron route `vc-discover` (旧: 毎週土 09:00 JST、Claude + web_search、業界横断 + 新規 VC 発見 + suggested_fund_patch。現在は LLM/web_search 課金回避で自動 schedule 停止) / つくよみ chat tool 群 (`upsert_vc` `upsert_vc_fund` `update_vc_dry_powder` `add_vc_investment` `add_vc_contact` `add_vc_news` `link_project_vc`) / `/vcs/[id]/edit` 手動。詳細は [`vc_list.md`](vc_list.md)。

初期投入: `POST /api/admin/seed-vcs` (Bearer CRON_SECRET) で Claude + web_search に国内ディープテック VC を一括生成させ、`vcs` / `vc_funds` / `vc_investments` を upsert。再実行可。

---

## 5. 共通インフラ

### Supabase

- project ref: `nbnhrhybjslbawdukvvk`
- 認証: Google OAuth (team-armada.jp 限定の予定、現状 DEV_MODE)
- RLS: 多くのテーブルで `anon_read (USING true)` (DEV_MODE)。書き込みは `getAuthClient()` (auth 付き browser client) 経由
- 過去の RLS 再帰問題のため `member_pm_read` 等は DROP 済み

### GAS bridge (legacy / 暫定)

- `NEXT_PUBLIC_GAS_WEBAPP_URL` で anonymous webapp に到達
- 用途: Gmail からの修正依頼の source 抽出 (`mode=pwaApi` adapter)
- 長期: PWA サーバーから直接抽出する設計に置換予定 (TODO)

### つくよみ chat bridge

- スプライト: `pwa/public/tsukuyomi/sheet-v4.png` (2304×512)
- 4 アニメ × 18 frames × 128×128、足元アンカー (64, 124)
- 2026-05-28: 右下に常駐していた visible mascot button は非表示化。`(app)/layout.tsx` には `TsukuyomiChatBridge` だけを残し、`window.dispatchEvent(new CustomEvent("tsukuyomi:open", ...))` で起動する明示的な修正依頼導線は維持する。
- 旧 mascot は `pwa/src/components/tsukuyomi/Mascot.tsx` に残るが、global layout からは読み込まない。
- 2026-05-29: `/manual` 系だけ `ManualTsukuyomiFloat` を表示する実験導線を追加。これは global mascot 復活ではなく、OS マニュアル専用の読取 Q&A。`/api/manual/tsukuyomi/ask` は Gemini 2.5 Flash に検索で選んだ該当章の本文を渡し、回答 + 「ここ見たらOK」の参照章リンクを返す。DB 書き込み、project 修正、`tsukuyomi_chat_logs` 保存はしない。
- 素材生成元: `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/` (Codex 生成、annotation なし)
- 統合シート生成: `/tmp/combine_v2_frames.py` (FRAMES_PER_ROW=18, ROWS=4)

### メンバーコードネームリンク

- OS内の文章中にAMDメンバーのコードネーム（例: まさ / うめ / あび）が出る場合は、共通UI `LinkedMemberText` を通して `/mypage?memberId=<member_id>` へのリンクにする。
- 目的は可読性と追跡性。青字リンクで目立たせ、誰の話かをその場で辿れるようにする。
- `/mypage?memberId=...` はadmin閲覧用。他メンバーのマイページを一般ユーザーが閲覧する導線にはしない。
- `member_id` は `members.member_id` の値をそのまま使う（例: `ID001`）。`001` のように `ID` prefix を削ったURLは無効。
- 社内OSの自由文・通知・カード内で AMD メンバーの本名 / 姓+敬称 (例: `山地さん`) / active member 内で一意な姓 (例: `[owner: 山地]`) が混ざった場合も、active `members` の alias map で `code_name` に寄せてからリンクする。正式な対外提出物など、個別 spec が本名表示を明示している画面だけ例外。
- 自由文の自動リンクは standalone mention のみ対象にする。`しかるべき` 内の `かる` や `こうして` 内の `こう` のように、長い日本語/英数字の語へ埋まった code_name はリンクしない。短い code_name を確実にリンクしたい場合は Markdown の明示リンクを書く。
- `/admin/members` の codeName セルは `/mypage?memberId=<member_id>` への基準リンクUI。コードネームクリックでマイページを開き、台帳編集はセル内の編集ボタンから行う。

---

## 6. 認証

- 現状: Supabase Auth + middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`)
- `(app)/layout.tsx` で `getUser()` を呼び未認証なら `/auth/login` へ redirect
- `/api/` は middleware で auth redirect から除外 (cron 401→redirect 事故回避)
- Google OAuth プロバイダ設定: Client IDs は `webクライアントID,iOSクライアントID` の順 (先頭が code flow で使用)

---

## 7. 環境変数

### `.env.local` (ローカル) と Vercel production env (両方必要)

| key | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client / SSR 共通 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (cron, server actions) |
| `SUPABASE_ACCESS_TOKEN` | DDL 適用 (`scripts/apply_ddl.py`) |
| `ANTHROPIC_API_KEY` | Claude (Sonnet/Haiku) |
| `GEMINI_API_KEY` | Gemini Flash (政策フィルタ) |
| `CRON_SECRET` | 全 cron の Authorization Bearer |
| `FREEE_CLIENT_ID` `FREEE_CLIENT_SECRET` `FREEE_COMPANY_ID` `FREEE_REFRESH_TOKEN` | freee invoice |
| `NEXT_PUBLIC_GAS_WEBAPP_URL` `NEXT_PUBLIC_GAS_API_KEY` | GAS bridge |
| `NEXT_PUBLIC_DEV_MODE` | `'true'` で DEV モード (anon read 全開) |
| `SLACK_BOT_TOKEN` | Slack Bot (xoxb-…)。AMD Score L2 cron 用。scopes: search:read, channels:history, channels:read, groups:history, groups:read |
| `NOTION_API_KEY` | Notion Integration (secret_…)。AMD Score L2 cron 用。Integration を root ページに招待 |
| `GOOGLE_OAUTH_CLIENT_ID` `GOOGLE_OAUTH_CLIENT_SECRET` `GOOGLE_OAUTH_REFRESH_TOKEN` | Google OAuth (個人 Gmail/Calendar 代理)。L2 cron で Drive/Gmail/Calendar 全部使う。PJ資料uploadには Drive write scope が必要 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (任意、OAuth refresh token の代替) Service Account JSON。Drive のみ用、Gmail/Calendar には domain-wide delegation 必須。PJ資料uploadでは当該PJ folderへの共有と Drive write scope が必要 |

**注意**: `.env.local` を変更しても Vercel に自動反映されない。`vercel env add <KEY> production` で明示追加が必要。

---

## 8. 運用コマンド

### Vercel デプロイ (正本)

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

- 2026-06-12以降、PWA 本番反映は **main push = Vercel Git 自動 production deploy**。CLI 直接 deploy / preview deploy は廃止。
- 原則、deploy 前の事前確認で止めない。build/test/browser確認、含める変更、除外する変更、push先、rollback/本番確認方法は deploy bundle として事後報告に残す。
- 微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployしない。複数worker成果を束ねて1回でdeployする。
- deploy script の `AMD_OS_VERCEL_DEPLOY_APPROVED=1` は承認フラグではなく誤実行防止の明示スイッチ。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` で main push・build監視まで進める。
- **`--cwd` はリポジトリ root** (`pwa/` ではない)。Vercel project `amd-os-pwa` の Settings → Build → Root Directory が `pwa` のため、`--cwd .../pwa` だと `pwa/pwa` 二重で失敗する
- リポ root に `.vercel/project.json` (amd-os-pwa を指す) があること。無いと `--yes` で誤って `amd-os` 新プロジェクトが作られる (2026-05-06 BUGS 参照)
- 復元: `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel`
- 確認は **常に本番環境** (`amd-os-pwa.vercel.app`) で行う方針 (`pwa/AGENTS.md` 参照)

ロールバック:
```bash
npx vercel ls --scope armada0130                   # デプロイ ID 確認
npx vercel promote dpl_<ID> --scope armada0130 --yes
```

### Supabase DDL

```bash
python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql
```

- Management API (`/v1/projects/{ref}/database/query`) を直叩く
- `.env.local` の `SUPABASE_ACCESS_TOKEN` (sbp_…) 使用
- **User-Agent ヘッダー必須** (Cloudflare 1010 回避)
- migration は必ず `scripts/migrations/NNN_name.sql` に残す
- `supabase-js REST + rpc("exec_sql")` は存在しない

### ローカル

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run dev          # 開発
npm run build        # 本番ビルド (deploy 前の確認)
npx tsc --noEmit     # 型チェック
```

---

## 9. 実装規約 (引っかかりやすい点)

### 進捗 % の扱い
- LLM (`progress-estimator.ts`) が返す `progressPct` は **対象月時点の累積進捗**
- DB `milestone_monthly_progress.progressPct` に保存するのも **累積**
- 基本値は `value_milestones.period_start_ym`〜`target_ym` の期間按分。5か月MSなら1か月目20%、2か月目40%、3か月目60%が基準
- MS開始前は0%。LLM推定対象から外し、既存のAI/自動由来行があれば0%へ補正する
- AI由来値 (`tsukuyomi_estimate`) は過大推定なら下方修正OK。`pm_manual` / `pm_confirmed` / `pm_rejected` / `criteria_toggle` / `tsukuyomi_revision` はスキップ
- `tag='routine'` の定常業務は LLM 推定ではなく月割り自動進捗。`value_milestones.period_start_ym`〜`target_ym` の月数で 100% を割り、対象月までの各月を `source='routine_auto'` で補完する。1年PJなら毎月 `100/12%`。

### コミット % の扱い
- DB `milestone_responsibility.share` は **0.0-1.0 の小数**
- UI は **0-100 の整数**
- 表示: `Math.round(r.share * 100)`

### MS分割と報酬配分の扱い
- `milestone_responsibility.share` は **MS設計時点の予定担当比率**。新規MSではここを初期値として入れる。
- 当月報酬では常に `milestone_responsibility.share` を使う。活動ログ由来の実績配分・PM/admin override は報酬計算に入れない。
- `tag='cap_extra'` のMSは別財布として `extraBasePay` に分け、通常固定費の `65% - buffer` cap 確認から分離する。
- 1つのMSに、事業計画 / 資本政策 / 知財戦略のような独立して進捗する成果物を混ぜない。
- 誰か1人または一部メンバーだけで進む成果物が含まれる場合は、成果物ごとに別MSへ分ける。
- 例: SX旧MS#1は `事業計画策定` / `資本政策策定` / `知財戦略策定` へ分割。知財戦略だけ進んだ月に、事業計画・資本政策担当へ報酬が乗らないようにする。

### MS別期間設定の扱い
- 年間MS設定では、PlanCycle全体の開始/終了とは別に、各MSごとの `MS開始` / `MS終了` を必ず表示する。
- 正本列は `value_milestones.period_start_ym` / `target_ym`。未設定時はPlanCycle全体またはlegacy scheduleへfallbackするが、新規保存ではMS別期間を保存する。
- `/api/progress/ms-schedule`、Cockpit、HUD、月次モーダルの期間表示と期待進捗アンカーは、GAS推定より `value_milestones` のMS別期間を優先する。対象月の期待累積%は `period_start_ym`〜`target_ym` の経過月数で計算する。
- 回帰防止: 年間MS設定UIを触ったら `npm run test:next-period-ui` を通す。`MS開始` / `MS終了`、DB列、schedule override のいずれかが消えたら失敗させる。

### `立替確認` 自動判定 (`/admin/invoices`)
- 対象稼働月の翌月 4 日を締切 (土日なら前営業日に補正)
- 締切日前: 必ず未完
- 締切日以降、`reimbursements.status` が `submitted` / `pmapproved` の未処理がなければ完了
- 例: `202606` → 2026-07-04 が土曜 → 2026-07-03 に判定
- 手動変更は不可 (Swift 版と同じ)

### 通知 admin-only
- `/notifications` / `/hud/notifications` は server-side で `members.is_admin` を確認し、admin以外は404扱い。
- `l2_notifications` / `meeting_notifications` / `app_notifications` / `l2_feedbacks` は migration 066 で admin authenticated のみ SELECT/UPDATE/INSERT 可能。
- iOS/APNs 配信済みは `notified_at`、PWA上の人間の既読は `read_at`。既読は削除ではなく状態更新。現状はDBに蓄積し続け、UI側で最新100件 + 既読折りたたみとして扱う。

### 月次ルーティン廃止
- PM向けの OS 月次ルーティン / 月次TODO / cockpit step UI は廃止。
- 報告書確認の軽い連絡は Slack 側で扱い、OS には TODO / nudge カードを出さない。
- `/admin/invoices` はきよが月次で処理する請求書発行キューとして残す。対象は締め済み稼働月までで、稼働期間外・freeze後・請求額ゼロ・請求しないPJは発行キューに出さない。主画面は `発行待ち / 要確認 / 設定不足 / 発行済み / 送付済み / 入金済み / すべて` filter と、`金額 / 報告 / 立替` のきよ確認だけを出す。旧 `/admin/billing` は互換 redirect のみ。
- `?step=<stepId>&ym=YYYYMM` は legacy query。現行 cockpit は `step` を解釈せず、月次カードから `CockpitMonthlyModal` を開く。
- `CockpitRoutine*` component / modal と `/api/notify/pl-review` は削除済み。詳細は [`routine.md`](routine.md)。
- GAS legacy の monthly reminder / meeting schedule / invoice workflow / report fix cron は no-op。PWA cockpit は `tsukuyomi_nudge_queue` に残った legacy monthly message を表示しない。

MTG サマリ詳細は `/project/[projectId]/cockpit?meeting=<meeting_id>` で直接開く。MTGカードをクリックすると `meeting` query が URL に入り、共有された URL では該当 detail modal を auto-open する。`meeting` と `ym` / `step` が同時にある場合は MTG詳細を優先する。

### `/admin/invoices` の発行キュー
- 対象: 直近 13 か月の締め済み稼働月 (= 現月は含めず、前月まで) の `billing_cycles`。PJ は `projects.status IN ('active','ended','frozen')` を読むが、発行対象は `start_ym` 以降、`end_ym` 以前、`freeze_from_ym` より前、かつ請求額がある行だけ。
- 状態: `payment_confirmed_at` あり = 入金済み、`invoice_sent_at` あり = 送付済み、`invoice_issued_at` あり = 発行済み。未発行行は、freee取引先未設定なら `設定不足`、金額/外部提出が必要な報告/立替が未完なら `要確認`、全部そろったものだけ `発行待ち`。
- きよ確認: `金額 / 報告 / 立替` だけを小さく表示する。`報告` は対外提出が必要な `monthly_report_scope='internal_and_external'` を発行前 blocker として扱う。`支払通知 / 報酬支払` など、請求書発行の前提でない全ステップ横並び matrix は戻さない。

### shadcn / Tailwind v4 での落とし穴
- `Dialog` 幅: `sm:max-w-sm` が base に仕込まれていて `max-w-[1400px]` で上書き不可。`!important` 必須 → `!max-w-[1400px] sm:!max-w-[1400px]`
- 数値入力で "0" を消したい: `type="number"` ではなく `type="text" inputMode="numeric"` + `onFocus={(e)=>e.target.select()}`
- flex 子の `h-[calc(100vh-Npx)]` が高さ 0 になることがある → `style={{ height: ..., minHeight: 600 }}` で inline 指定 + flex item に `minWidth/minHeight: 0`

### LLM 選定
- 複雑な抽出 (レポート → MS 別 % delta、cluster、divergence): **Sonnet** (`claude-sonnet-4-5-20250929` / 4.6)
- 軽量分類 (auto-tag、ストーリー紐付け、メンバー活動推論): **Haiku** (`claude-haiku-4-5-20251001`)
- 政策シグナルの「事業判断に効くか」二値判定: **Gemini 2.5 Flash** (無料枠で実質無料)
- LLM JSON 出力に生制御文字が混入する → `sanitizeJsonControlChars()` で文字列内のみ sanitize (cluster + divergence で使用)

### RLS / Supabase クライアント
- 読み取り (DEV_MODE): module-level `supabase` (anon)
- 書き込み: 必ず `getAuthClient()` (`createBrowserClient` from `@supabase/ssr`) を都度生成。anon では `is_admin()` が false で INSERT 拒否される
- FK 削除順: `value_milestones` 削除前に `milestone_responsibility` / `milestone_sub_items` を先に DELETE (CASCADE なし)

---

## 10. 既知の TODO / 未着手

設計レベルで残っている課題。新規実装着手時はここを更新する。

- **AMD プロトコル結果運用**: プロトコル抽出本体は稼働中。`結果` は自動抽出せず、`protocol_result_observations` に時間差の観測として入れる。観測登録UI/cronは今後拡張対象。
- **Atlas タグ正規化 UI**: 表記揺れ (semiconductor / 半導体 等) 統合管理が数百シグナル超で必要 (`/admin/atlas/tags` 候補)
- **本番認証**: 現状 DEV_MODE。Supabase Auth + RLS ポリシー再構築 (再帰なし) が必要
- **`source_cache` 依存**: `/api/report/generate` はまだ `source_cache` を参照するが、定期 M-1 writer ではない。GAS broad L1 cron は廃止済みだが、PWA API で Gmail/Slack の短い source refs は投入可能。Drive/Calendar/Notion の同形PWA化と、M-1 Codex automation への接続整理が残る
- **GAS bridge → PWA 直抽出**: Gmail/source 抽出を PWA サーバーから直接やる設計に置換
- **Supabase → スプシ逆同期**: 現在は GAS → Supabase 一方向のみ。バックアップ手段未定
- **Venture Map**: 数式モデルの未解決論点 5 点 (`venture_map_model.md`)、競合密度 / 予算データ未投入

### Critical UI regression guard

cockpit/adminの中核UIを触ったら、通常の `npx tsc --noEmit` / `npm run build` に加えて以下を必ず実行する。

```
npm run test:next-period-ui
npm run test:critical-ui
```

`test:critical-ui` は、MS期間設定、年間MS Gantt、報酬cap/stock、進捗イベント編集、admin.payouts の報酬キャッシュ/支払通知書発行/縦型PJ収支表、project_category、AMD Score対象分岐、通知詳細のraw_data_gap/source refs表示anchor、cockpit の経営ハイライトanchorを検査する。あわせて支払通知書PDFの golden PNG (`scripts/__fixtures__/payout_notice_golden.png` + `.sha256`) の存在と SHA256 一致を検査し、改善版フォーマットの 1 ページ目画像が壊れた場合に落ちる。改善版PDFを変更したらまさが目視確認したうえで fixture と SHA256 を更新する運用にし、外部 PNG との突合は `npm run test:payout-notice-pdf -- --diff <input.png>` で実行する。重要UIの契約は [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md) にも登録する。

---

## 11. 関連ドキュメント

| 目的 | ファイル |
|---|---|
| 共通運用ルール (全クライアント) | `/Users/masa/projects/AMD/amd-os/CLAUDE.md` |
| iOS 全画面の正本仕様 | `/Users/masa/projects/AMD/amd-os/ios/DESIGN.md` |
| 既知バグ・教訓 (PWA) | `BUGS.md` |
| 直近セッション + 次の一手 | `HANDOFF_pwa_rebuild.md` |
| 過去セッションログ | `design_log/sessions_YYYY-MM.md` |
| Atlas 全体設計 | `atlas.md` |
| 政策シグナル設計 | `policy_signals.md` |
| 進捗推定設計 | `progress_estimation.md` |
| Venture Map 数理モデル | `venture_map_model.md` |
| PJ Status コックピット (SU 系 PJ の上部セクション) | `cockpit.md` ⭐ |
| AMD Score (PRS primary / legacy M-X-F comparison) | `amd_score.md` ⭐ |
