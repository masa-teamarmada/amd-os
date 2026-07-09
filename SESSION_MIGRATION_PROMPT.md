# SESSION MIGRATION PROMPT - AMD OS monthly agreement modal density

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/2-2-member-workflows-quick-start.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
15. /Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
17. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- branch: main only。新規branch/worktreeは禁止。
- accepted product state: 月初合意モーダルの情報密度改善は、まさが「これならいい」と確認済み。
- accepted product commits: f13de200 fix(pwa): tighten monthly agreement modal density / d8934395 fix(pwa): widen monthly agreement unpaid flow
- accepted production proof before docs refresh: https://amd-os-pwa.vercel.app/api/build-info = v0.39.34 / d89343957fd51ce637fb08aa83aad369d1013a1c / main / dirty=false
- current main also includes later docs closeout commits 6aef2bc5 / 6f61764c, invoice prerequisite fix 49cd543d, closeout-doc line daccb19f, and dirty-inventory correction f29fc560.
- canonical root checkoutは f29fc560 へfast-forward済み。残dirtyは別worker由来のPOC matching系だけ。月初合意laneでは触らない。対象workerが対象ファイルだけstage/commit/deployする。

完了内容:
- 月初合意モーダル上部の警告・合意ボタン・指標カードを圧縮し、右側に残っていた広い空白を減らした。
- 「今月の約束」は契約書と一致しないため使わず、「今月の発注条件」「発注条件と予定額」へ寄せた。
- `この画面で確認すること` は3カードの説明レールにし、契約/SOW、予定額の出どころ、支払いとの関係を短く表示する。
- `直してほしいこと` はdetails化し、モーダルでは入力欄を1行寄りにして右側の無駄な空白を減らした。
- PJカード上段は `予定額 / 支払 / 未払残` の3列サマリーにして、PJ名周辺の余白を減らした。
- MS一覧は、行数が多いコンパクト表示では2列へ分割し、MS名と担当割合の間の無駄な空きを減らした。
- `未払いがどう残るか` は長い棒グラフや縦積みカードではなく、左に項目・右に稼働月を並べる横長マトリクスへ変更。行は `前月残 / 当月発生 / 支払対象 / 支払 / 月末残`。
- `増える分` や `働いた月` のようなOS内の他表現とズレる言葉は使わず、稼働月・当月発生・支払・未払残の表現へ寄せた。

検証済み:
- product laneで git diff --check、npx tsc --noEmit、targeted eslint、npm run build を実行済み。
- temporary visual-check routeで wide / desktop / narrow / mobile screenshotを確認し、routeはcommit前に削除済み。
- 正規deploy scriptでmain push / Vercel production反映済み。
- production /api/build-info は v0.39.34 / d89343957fd51ce637fb08aa83aad369d1013a1c / dirty=false。
- まさが最終UIを確認し「これならいい」と受け入れ済み。

現在残っている別件dirty:
- 月初合意fixとは別のactive WIP。巻き込まない。
- /admin/invoices の freee取引先選択 / 請求書発行条件 WIP は 49cd543d でmainに入った。
- 残っているのは /poc matching UI/docs WIP。
  - 主なfiles: pwa/src/app/(app)/poc/page.tsx, pwa/design/poc_matching.md, pwa/manual/2-5-research-assets-quick-start.md, pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md, pwa/manual/9-3-appendix-changelog.md, pwa/design/FEATURE_REGISTRY.md, pwa/scripts/check_pwa_critical_ui.cjs, pwa/src/lib/build-info.ts (v0.39.36).
- 次セッションでWIPを扱うなら、POC bundleの差分全体を確認し、必要なspec/manual/changelogを同期してから、対象ファイルだけ stage / commit / push / deployする。

次タスク:
- 月初合意モーダルの既知残タスクはない。
- 追加修正を頼まれたら、最初にproduction build-infoとorigin/mainを合わせ、実データのモーダルをスクショで見る。
- まさの前回指摘のニュアンスは「無駄なスペースが全然減っていない。右側空白、1行で済む情報の改行、MS表の列間、未払いグラフ/表の横長さを、ひとつひとつ言わないとだめなのか」。次回は個別指摘待ちではなく、画面全体の情報密度を自分で点検する。
- 現実的な別lane次アクションは、/poc matching WIP をbundle単位で完成させること。

運用ルール:
- PWA本番反映は main push = Vercel自動deploy。直接 npx vercel deploy は使わない。必要な時は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh。
- dirtyを理由にstage/commit/push/deployを止めない。既存dirtyは戻さず、今回の対象ファイルだけ明示してstageする。git add .は禁止。
- UI密度改善では、CSS差分や「カードを小さくした」だけで完了扱いしない。実データ・本番相当の横幅・スクショで、上から順に余白、改行、表の列幅、棒/表の長さを確認する。
- 契約・月初合意まわりの文言は、OS内と契約書の言葉に合わせる。新しい言い方を足すと別パラメータに見えるため、言葉を発明しない。
- closeout時は worktree/branch/ahead/dirty を必ず inventory し、dirtyには owner/action/risk を付ける。
- handoff/closeout時は、HANDOFFを薄くしすぎず、状態スナップショット・成果物・検証・次アクション・運用ルールをこのプロンプトだけで再開できる粒度にする。
```
