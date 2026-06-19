# admin オペ

月次の管理オペレーション。

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
週次活動の抽出は Codex 側 writer が書く。current truth は Mac の `AMD OS D-10 メンバー活動根拠抽出 (Mac)` (`amd-os-l2-2`, 18:30 JST) と MMO の `amd-os-l2-member-weekly-activities` launcher (19:30 JST)。どちらも同じ PWA route `/api/cron/member-weekly-activities?interactive=1` を叩き、窓は前日18:00〜当日18:00 の 24h。詳細は [`manual/8-3-l2-extraction-routines-spec.md`](8-3-l2-extraction-routines-spec.md)。なお D-10 だけは内部 route が Anthropic API を使う例外。

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

## admin/private-wiki (= 裏wiki)

URL: `/admin/private-wiki`

### 何をする画面か
AMDメンバー、取引先、クライアント、研究者、外部協力者など、人物単位の関係性メモを PJ ごとに残す admin-only 台帳。

- 人物名 / 種別 / 所属 / 関係性
- 趣味・関心・プライベート寄りの接点メモ
- tag / confidence / status
- source_kind / source_ref / source_excerpt

### 重要な仕様
- 保存先は `private_wiki_entries`。RLS は admin authenticated と service_role だけ。
- 通常 PJ cockpit、公開ページ、研究機関外部 workspace には出さない。
- source_excerpt は短い根拠抜粋だけ。メール全文・議事録全文・資料全文は保存しない。
- Codex / えいみが後から投入する entry は `source_kind='codex'` などで出所を残し、低確度なら `status='needs_review'` にする。
- 不要になった entry は削除ではなくまず `archived` にする。直接的すぎる機微情報は本文に残さず、source_ref で辿れる最小限にする。

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

## コックピット月次確認 / admin請求との接続

コックピット右カラムの月次確認は、PM が月次報告書の確認nudgeへ返す入口。請求・支払・立替データを触る主入口は admin 側に寄せる。

```text
コックピット月次確認
  月次報告書確認
    -> monthly_reports / billing_cycles

admin
  /admin/projects  -> PJ 台帳・支払条件・月次予算
  /admin/billing   -> SU x 月の請求発行・送付・立替・入金状態マトリクス
  /admin/payouts   -> AMD から SU への支払通知書
```

締切・クリック先・CTB停止中の扱いは **[2-3 章 1.5 月次確認](2-3-pj-cockpit.md#15-月次確認--報告書--admin請求)** が読み手向け正本。実装詳細と回帰防止は [`pwa/design/routine.md`](../design/routine.md) が開発正本。

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
- 設計議論: [`pwa/design/FEATURE_REGISTRY.md`](../design/FEATURE_REGISTRY.md) (= 各画面の消してはいけない業務導線), [`pwa/design/routine.md`](../design/routine.md) (= 月次確認)
