AMD OSの「きよ」報酬見通しを確認・再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` を作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF_KIYO_REWARD_OUTLOOK_20261120.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `pwa/design/FEATURE_REGISTRY.md` の `/admin/kiyo`、`pwa/spec/3-14-monthly-work-agreement-current-spec.md`
7. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/spec/5-10-reference-data-caching-current-spec.md`、`pwa/BUGS.md`

状態:

- 「きよ → 04 報酬見通し」は2026-10-23の `5f00375a` でmainに反映済み。対象月に参画中の各メンバーとPJについて、月初合意と同じシーズン報酬棒グラフを表示する。2026-11-20のmainにも含まれる。
- 画面は管理者限定の閲覧。計算式・報酬合意・支払・通知書への書込みは変えない。
- 2026-11-18に固定報酬・追加原資の別作業がmainへ反映済み。グラフの数値確認では、対象月の月初合意とこの計算変更を先に照合する。
- 今回は終了記録だけを保存した。製品コード・DB・権限・定期処理は変更していないため、再公開やDB操作はしていない。

次の依頼の扱い:

- 数字の誤り・表示対象の漏れは、対象月、PJ、メンバーを先に特定する。`/monthly-agreement` の本人向け棒グラフと元データを読み取りで比較し、きよ側だけの表示なのか、元の報酬計算なのかを分けて原因を示す。
- 新しい表示・集計を加える場合は、`FEATURE_REGISTRY`、該当spec、OSマニュアル、附則、Native境界を同じ作業単位で更新する。PCのChromeで確認し、対象検査の後に正規の反映手順でmainへ送る。
- `S01_富士山_日本語.md` は本件と別の未追跡原稿。内容を変更・削除・一括保存しない。SOL契約条件の引き継ぎは別作業として保存済み。
