# admin オペ

月次の管理オペレーション。

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
- 手動「報酬キャッシュ再計算」ボタンまたは保存系処理だけが `refreshRewards=1` で再計算
- ZMP の通常固定費は 300,000 円 × 65% = 195,000 円を cap として扱う。OkuDoor追加開発など追加受託分を支払うときは、`PJ予算確定・調整` で `cap外追加支払枠` に合意額を入れ、`billing_cycles.budget_yen` を `通常cap + 追加枠` にする
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
| `draft` | gray | 台帳作成済みだが、契約・稼働・営業状態がまだ固まっていない準備中 PJ | `admin/projects` で情報を揃える段階。通常の月次ルーティンや請求対象にはまだ入れない |
| `active` | emerald | AMD が伴走・運用中の PJ | cockpit / 月次ルーティン / 請求・支払 / MS 進捗抽出の標準対象 |
| `sales` | blue | 商談・受注前・提案中の PJ | 台帳や資料生成には載せるが、契約後の月次オペは個別に確認してから開始 |
| `ended` | gray | AMD の伴走・契約が終了した PJ | 履歴として残す。新規の月次ルーティンは原則表示しない |
| `frozen` | amber | 明示的に休止中の PJ | 新規月次ルーティンは止める。再開見込みがある場合は `freeze_from_ym` / `restart_expected_ym` も併用 |
| `lost` | red | 失注 / 破談 / 契約化しなかった PJ | `/admin/payouts` では支払原資なしの個別確認対象。契約が取れなかった場合の支払は個別合意が必要 |

#### status と凍結期間の使い分け

- `status` は PJ の大きな状態ラベル。`active` / `sales` / `ended` / `lost` のような契約・営業フェーズを表す。
- `freeze_from_ym` / `restart_expected_ym` は **期間つきの休止オーバーレイ**。たとえば「契約は継続してるが 202605 から一時停止」のように、`status='active'` のまま月次ルーティンだけ止めたい時に使う。
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

## admin/billing

URL: `/admin/billing`

### 何をする画面か
月次請求マトリクス。各 SU × 各月の請求状態 (= 発行済 / 送付済 / 入金済 / 未対応) を一覧。

---

## 立替申請

URL: `/reimburse`

### 何をする画面か
AMD メンバーが業務関連で立替えた費用 (= 出張 / イベント参加費 / 書籍 等) を申請。
- 領収書 (= 写真 / PDF アップロード)
- 金額 / 用途 / PJ 紐付け
- 承認フロー (= まさが /admin で確認 → 月次支払に合算)

---

## コックピット月次ルーティンとの接続

コックピット右カラムの月次ルーティンは、admin の請求・支払・立替データを触る入口。

```text
コックピット月次ルーティン
  請求額確定
    -> billing_cycles / PL 承認 / PJ 予算
  報告会日程調整
    -> meeting-slots / schedule-meeting
  月次報告書FIX
    -> monthly_reports / billing_cycles
  立替精算確認
    -> /reimburse
  請求書発行・送付
    -> billing_cycles / freee invoice / invoice_sent_at

admin
  /admin/projects  -> PJ 台帳・支払条件・月次予算
  /admin/billing   -> SU x 月の請求状態マトリクス
  /admin/payouts   -> AMD から SU への支払通知書
```

締切・クリック先・CTB 例外は **[2-3 章 1.5 月次ルーティン](2-3-pj-cockpit.md#15-月次ルーティン--報告書--請求--会計)** が読み手向け正本。実装詳細と回帰防止は [`pwa/design/routine.md`](../design/routine.md) が開発正本。

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

## 関連
- 設計議論: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md) (= 各画面の消してはいけない業務導線), [`pwa/design/routine.md`](../design/routine.md) (= 月次ルーティン)
