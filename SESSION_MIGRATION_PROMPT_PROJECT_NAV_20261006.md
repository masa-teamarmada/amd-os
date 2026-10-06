AMD OSの左ナビ・複数タブ・DD資料目録・組織図の改善を引き継いで。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。今回の依頼は本番確認まで完了し、まさが「おけ」と受入済み。追加実装の依頼はまだない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md（AMD共通知識）
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF_PROJECT_NAV_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/2-1-pwa-runtime-routes.md、2-7-ui-design-code-current-spec.md、3-23-project-format-current-spec.md、3-24-project-surface-pages-current-spec.md、5-17-dd-package-current-spec.md、pwa/manual/2-1-member-quick-start.md
6. pwa/BUGS.md、pwa/design/SPEC_GOVERNANCE.md、pwa/design/FEATURE_REGISTRY.md、ios/DESIGN.md
7. 開発履歴が必要ならpwa/design_log/sessions_2026-10.md。本仕様より履歴を優先しない。

状態スナップショット:
- 製品変更の最新commitは17d15894d57dbcd0a80fec1b72228c31c14b6d85。main統合・push済み。本番v3.160.7/main/dirty=false、公開build-infoのSHA一致を確認済み。この後は引き継ぎ文書のみの更新。
- 確認時のlocal mainとorigin/mainはahead0/behind0。本タスクの未コミット・未push・競合は0。開始時にfetch/status/build-infoを再確認し、後続変更を旧SHAへ戻さない。
- 左上は「≡」で全体メニューを開く。PJのコックピット・ワークスペース・DDは並列の左入口。ホームからPJを開くと既定で別タブ。
- DDは資料名による33入口。資本政策表・株主名簿・次回ラウンドタームシート、経営陣略歴などは独立した資料。定款・規程類を含む。従業員名簿はコックピットとワークスペースだけに表示する。認可・正式資料・未登録表示の境界はspec5-17。
- Chrome PWAでは非選択の枠が青灰色、選択タブが白。タブ題名はPJ・スペース・ページと現在表示の印に追従する。
- 組織図は3スペース共通の縦型ひな形。後続の別作業で登録値の表示も追加済み。現在の登録仕様はspec3-23とHANDOFF_ORGANIZATION_CHART_20261006.md。古いひな形専用表示へ戻さず、組織案を正式所属の確定へ変えない。
- 左ナビはPCで28px行・上下4px、分類末尾4px。項目の余白を含む全幅のホバーが青灰色、選択中ホバーは一段濃い背景。現在地の左線・太字・キーボード枠を保つ。
- ワークスペースでは全体button44px指定が下段だけを広げていた。ProjectNavigation.module.cssのPC .menu .rowを優先し、上3リンク・分類・子ページすべて28pxへ修正。本番DOM計測と画像で確認済み。ローカルの共通部品だけで完了を判断せず、実ワークスペースの親CSS条件を確認する。
- まさはPWAをPCで使い、スマホはSwift版。PWAのスマホ確認を追加しない。Native移植は今回の依頼範囲外。
- 検査はtest:critical-uiと通常deploy.shのゲートが成功。本番確認はPC Chrome。確認専用タブ・route・サーバ・使い捨てcloneを除去済み。証跡は.jez/artifacts/design-review.mdとnav-equal-rows-live-20261006.png。
- 既存の未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは別件のタスク報酬移行資料。前の引き継ぎでGit保存の判断待ちとされている。所有境界は移行担当／まさ。変更・stage・削除せず保護し、当該移行の再開時またはまさの明示判断時に扱う。本件の未完了実装ではない。
- 以前の資本政策の再開用プロンプトはSESSION_MIGRATION_PROMPT_CAPITAL_PLAN_20261006.mdへ内容不変で保持。

次の行動:
- 今回の追加実装は不要。まさの新しい依頼を待つ。
- 左ナビの追加調整を頼まれたら、上3スペースと「進捗管理」以下を同じ密度で比較する。ホバーは文字だけでなくカード全幅で分かることをPCで確認する。
- 全体メニューとPJ内の3スペース切替を混同しない。資料の集合であるDDを調査テーマ名へ戻さず、別資料を1項目へ束ねない。

運用:
- main一本。新規branch/worktree・subagentを作らない。既存dirtyをreset/stash/deleteしない。対象ファイルのみ明示stage。
- 着手前とpush前にfetchし、behindを解消してから作業する。使い捨てcloneで配布した場合は正規checkoutの同期も確認する。
- 製品の恒久仕様はspec/manualと附則、画面の追加・改名はios/DESIGNへ同じcommitで同期。実装履歴はdesign_log、現在地は短いHANDOFFへ分離。
- 製品変更の配布は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。main pushで自動配布、本番SHAとPC画面を確認。CLI直接deployや微細変更ごとのpushはしない。
- 今回は引き継ぎ文書だけの最終更新を[skip ci]でpushし、製品の再配布を増やさない。本番17d15894がmainの祖先であることを確認する。
