AMD OSの愛媛大学EHMシーズ記録を引き継ぐ。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_EHM_SEEDS_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `pwa/design/seeds.md`、`pwa/design/institution_seed_project_model.md`、`pwa/design/FEATURE_REGISTRY.md`
7. `pwa/manual/2-5-research-assets-quick-start.md`、`pwa/manual/9-3-appendix-changelog.md`
8. `pwa/BUGS.md`、`pwa/design_log/sessions_2026-08.md`

状態:

- 2026-08-18に愛媛大学の澤崎シーズと劉シーズを追加し、MTG・Slack・Teamsの接触履歴を登録した。
- 研究機関コックピットと大元のシーズ一覧は、同じ内部向け詳細モーダルを使う。
- 澤崎シーズの補助金履歴には「NEDO NEP 開拓コース／採択」が1件ある。採択年度・金額・実施期間は根拠がないため空欄。
- `p30 EHM` は正式PJとして `active`。左メニュー「ホーム」のPJ候補へ自動表示する。
- 議事録・Slack・Teamsの取り込みでは、本文要約だけで終えず、助成金は `seed_funding`、接触は `seed_contact_log`、ニュース・論文・特許は `seed_news`、PJ化は `seed_projects` または `institution_projects` へ保存する。根拠にない値は埋めない。
- 実装commitは `9ecf9a835`、`5f88fa8c0`、`0d37e11e5`、`b51921ff9`。2026-11-10のcloseout時点のmainに全件含まれる。
- 2026-08-18時点ではDB読戻し、PWA本番反映、PC画面での「ホーム→EHM」と澤崎シーズの補助金履歴を確認済み。
- closeout記録は `e1f4c013a` でmainへ反映し、GitHubの `origin/main` へのpush成功まで確認した。
- 2026-11-10の閉鎖時点では、本番DB読戻しが管理環境の承認制約で未確認。

次タスク:

1. `git fetch origin --prune` を実行し、mainがorigin/mainより古い場合は編集前にff-onlyで同期する。`git log --branches --not --remotes --oneline` が空であることも確認する。
2. EHMの追加更新が無ければ、実装作業は不要。現在の本番DBで `projects.project_id='p30'` が `active`、澤崎シーズの「NEDO NEP 開拓コース」が `awarded` で厳密に1件であることだけ読み戻す。
3. 画面確認が必要なら、まさのPC版Chromeで `/dashboard` の「ホーム」へマウスを重ねて `EHM / p30` を確認し、シーズ一覧から澤崎シーズを開いて「補助金履歴 (1)」「NEDO NEP 開拓コース」「採択」を確認する。依頼のないスマホWeb検証は行わない。
4. 新しい議事録やSlack・Teams記録を追加するときは、要約と構造化項目を同時に更新し、年度・金額・期間など未確認値は空欄のままにする。

運用:

- migration 286〜288は適用済み。再適用しない。
- main一本。既存dirtyを保ち、対象ファイルだけ明示stageする。`git add .` は使わない。
- push直前に再fetchし、mainへのcommitごとにpushする。
- PWA仕様を変える場合は、該当する設計正本、利用手順、変更履歴、実行可能な回帰検査を同じ変更単位で更新する。
- PWAの完了はmain反映、Vercelの完了、版情報、PC版Chromeの実画面で判断する。
- Notion・Slack・Teams・Driveの本文や生URL、個人情報、秘密値を引き継ぎへ転載しない。正本に保存済みの圧縮済み事実を使う。
