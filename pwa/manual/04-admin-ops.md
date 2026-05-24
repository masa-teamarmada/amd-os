# 04. admin オペ

月次の管理オペレーション。

## 4.1 admin/payouts (= 月次支払通知書フロー)

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
- 支払通知書 PDF フォーマット: **2026-04 改善版** が正本。白地、青アクセント、公式ロゴ画像、青ヘッダ明細表、税内訳、支払予定/方法/振込先/備考を出す
- `setValue("team ARMADA")` / `brandCell` / `支払通知書番号` 等の旧版 anchor は復活禁止 (= `npm run test:critical-ui` で検知)
- golden PNG: `pwa/scripts/__fixtures__/payout_notice_golden.png` + SHA256

### ScriptProperties
- `PAYOUT_LOGO_FILE_ID` / `PAYOUT_LOGOTYPE_FILE_ID` を gas/CLAUDE.md に明記

→ 詳細仕様: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md)

---

## 4.2 admin/projects

URL: `/admin/projects`

### 何をする画面か
全 PJ 台帳の編集。
- PJ メタ (= 名前 / レーン / アウトカム / 設立日 / 起源機関 / 代表者)
- 月次予算
- メンバー紐付け
- report_emails (= 月次報告書送付先メールアドレス、chip 表示で個別削除 + 一括保存可能)

### sticky thead
- ヘッダーは `sticky top-0 z-30` で固定 (= 大量 PJ で下スクロールしてもヘッダー見える、まさ #15 確定 2026-05-24)

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
- 詳細・追加経緯は [§5.6 project_category に `new_business` 追加](05-decisions-and-history.md#56-project_category-に-new_business-追加--2026-05-25) 参照

---

## 4.3 admin/members

URL: `/admin/members`

### 何をする画面か
AMD 内部メンバー台帳の編集。
- code_name (= まさ / かる / ちこ等)
- email
- 個人情報 (= 入社日、稼働率等)
- どの PJ に伴走してるか

### sticky thead 同様

---

## 4.4 admin/billing

URL: `/admin/billing`

### 何をする画面か
月次請求マトリクス。各 SU × 各月の請求状態 (= 発行済 / 送付済 / 入金済 / 未対応) を一覧。

---

## 4.5 立替申請

URL: `/reimburse`

### 何をする画面か
AMD メンバーが業務関連で立替えた費用 (= 出張 / イベント参加費 / 書籍 等) を申請。
- 領収書 (= 写真 / PDF アップロード)
- 金額 / 用途 / PJ 紐付け
- 承認フロー (= まさが /admin で確認 → 月次支払に合算)

---

## 関連
- 設計議論: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md) (= 各画面の消してはいけない業務導線)
