# HANDOFF - AMD OS PWA

- Last updated: 2026-06-15 (株主・ガバナンス + 要対応(D-14) のOS化 / JC cap table取り込み / スコア反映)
- Topic: JOYCLE臨時株主総会招集通知の取りこぼしを起点に、株主/総会/決議/保有株式/バリュエーション + 期日つき要対応をOS化
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: **v0.20.12 Ready 確認済み** (deploy.sh で git_sha 一致確認済)

## 直近セッション (2026-06-15 株主・ガバナンス + 要対応)

まさが「5/28着のJOYCLE臨時株主総会招集通知がOSに抽出されてない、埋もれさせてはいけない」と気づいたのが起点。Gmail抽出が report_emails ゲート + active/進捗PJ中心で、終了PJ(p09)・期日つき要対応・株主情報を拾えていなかった (3つの穴: 取り込み/分類/受け皿)。

- **新4テーブル** (migration 137): `action_items`(汎用 要対応) / `project_shareholders` / `project_valuation_rounds` / `project_shareholder_meetings`。RLS=service_role+is_admin。
- **UI**: cockpit「🏛株主・ガバナンス」欄(終了PJでも表示) / dashboard・notifications「要対応(期日順)」面 / `/admin/governance` 手入力CRUD。API: `/api/governance`・`/api/action-items`・`/api/action-items/extract`。抽出 routine Phase K-C (D-14)。
- **JC実データ**: Gmail+Drive(株主名簿/公式captable)精読でcap table復元(計146,903株、検算一致)。まさ=普通株417(2024-08セカンダリー、¥998,298=¥2,394/株)。計画(Series A¥10,000)vs実績(¥3,500)大幅未達・評価額横ばい。総会資料13点リンク添付。
- **スコア(A)**: `amd_score_inputs` にJC 2026-06-15行追加 → 「μ_I上昇でスコアは上向くのに評価額停滞=現PRSモデルの盲点」を時系列に可視化。

詳細: `pwa/design_log/sessions_2026-06.md` 2026-06-15 エントリ。確定仕様: `pwa/design/governance_action_items.md` / 使い方: `pwa/manual/2-3-pj-cockpit.md`。

## Repo State

- Production v0.20.12 (このセッションで v0.20.9→12 を4回 deploy)。`build-info.ts` = v0.20.12。
- 作業ツリー: handoff cleanup で **まさ既存WIP(bzm倫理章/tasks spec)を保全commit済**(3722e927)。この handoff doc 更新分は次 commit に含める。push 後 dirty 無し想定。
- ⚠️ 次セッション開始時は必ず `git fetch` → 今回ローカルが origin より9commit遅れていた(最新build把握漏れ)。

## Unresolved / 次セッションへの申し送り

1. **(別セッション=チップ済 task_6027de9a)** 「拾うべき情報の自動検知」仕組み化 — 今回まさが気づいて拾えた取りこぼしを、OS側で自動検知して候補提示する coverage/gap scanner の設計 (脱・属人化の核心)。D-5台帳差分の拡張 or 新系統を議論。
2. **(別セッション=チップ済 task_2eff788c)** AMD Scoreモデル改良v3.3 — 実現モメンタム係数 + R&Dガバナンス整合の2新パラメータ。コアモデル変更=設計先行・まさ承認必須。
3. **(保留・ツール制約)** JC総会資料PDF10点のDrive「総会関連資料/20260605_臨時株主総会」フォルダへの本体アップ。Drive書込OAuthスコープ無し+MCP base64 inline上限超で自動不可。DL済みファイルは `~/projects/AMD/JC/総会関連資料_20260605/`。まさがドラッグ or Drive書込スコープ付与で解消。
4. **(任意・データ補完)** JC AA/AAA各ラウンドの1株価格は公式captable_241217で判明済み(反映済)。残: 前澤のSeedフォローオン等の細目は必要なら投資契約で再確認。
5. **(保留・まさ承認待ち、過去継続)** 残骸 `l2_routine` / `tsukuyomi_estimate` 行の DELETE 掃除 (実害なし)。
6. **(監視、過去継続)** 7月以降 p21 事業計画策定が未確定なら初の `ms_schedule_delay` 通知が出る。`/notifications` の "D-2 MS計画遅延" ラベル実地確認。
7. **(別ワークストリーム、過去継続)** payment PR #2 / ERS 根拠メモ「未確認」埋め。下記 pointer 参照。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

この handoff の doc 更新 (design_log + HANDOFF) を commit & push してから、次の依頼に入る。

## Pointers

- **株主・ガバナンス+要対応 (今回)**: 設計 `pwa/design/governance_action_items.md` / 使い方 `pwa/manual/2-3-pj-cockpit.md` / migration `pwa/scripts/migrations/137_governance_and_action_items.sql` / 導線保護 `pwa/design/FEATURE_REGISTRY.md` / D-14抽出 `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` Phase K-C。SU資本知識は `knowledge/jc.md`。
- 確定仕様 (spec): `pwa/spec/3-10-l2-ms-progress-current-spec.md` (D-2 MS進捗の全契約)
- 使い方 (manual): `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`
- 中核データ正本: `pwa/design/L2_DATA.md` / コックピット: `pwa/design/cockpit.md`
- バグ・教訓: `pwa/BUGS.md` (今回のセッションは新規バグなし)
- 過去セッションログ: `pwa/design_log/sessions_2026-06.md` (6/12 v3移行 / 6/13 アンカー方式)
- 実装ファイル: `pwa/src/lib/ms-schedule-shared.ts` (`anchoredExpectedCumPctForYm`) / `progress-estimator.ts` / `reward-summary.ts` / `src/app/api/cron/ms-schedule-progress/route.ts` / `src/app/api/progress/ms-schedule/route.ts`

### 別ワークストリーム (過去 handoff からの継続事項)

- payment PR #2 (`https://github.com/masa-teamarmada/amd-os/pull/2`): 古い base のため直 merge せず main-based で作り直す方針。詳細は `pwa/design_log/sessions_2026-05.md` #96 / `pwa/BUGS.md`。
- ERS 実データ本評価 / 制度比較マトリクス: `pwa/design_log/sessions_2026-05.md` #103〜#106。`/institutions/assess` 根拠メモの「未確認」項目 (香川大 軸5/6/7、工学院大 軸5/6/7、NIMS 軸3/5/6/7-d) が残課題。

## Deploy / Verification コマンド (今セッションで実行したもの)

```bash
# 本番反映 (push 方式、CLI deploy は廃止)
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# D-2 デフォルト按分 cron 手動実行 (CRON_SECRET は .env.local、チャットに出さない)
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -s -H "Authorization: Bearer $SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/ms-schedule-progress?projectId=p21&ym=202606"
```
