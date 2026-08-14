# SESSION MIGRATION PROMPT — 請求対象PJの契約原本監査 継続

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
前セッションでは、SX（p21）の締結済み請負契約書を契約台帳の押印版として登録し、コックピットの実行条件を原本に基づいて更新した。CX（p20 / NIMS）には、現行の仕様・見積合わせ・提出書類、本見積書、前年度の入札一式を資料室へAMD内部限定でリンクした。

次の主作業は、請求書作成画面に出る全PJについて、現行の締結済み契約書原本または現行契約台帳を根拠に `expenseReimbursementAllowed` と根拠注記を監査し、未完了分を正規経路で反映すること。メモ、プロジェクト名、会議名から可否を推測しない。原本がないPJは未抽出のまま「原本欠測」として報告する。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os` で `git fetch origin main`、`git rev-list --left-right --count HEAD...origin/main`、`git status -sb --untracked-files=all`、`git log --branches --not --remotes --oneline`、`git worktree list`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `pwa/AGENTS.md` と `pwa/CLAUDE.md`
8. `pwa/spec/5-6-contracts-management-current-spec.md`
9. `pwa/spec/3-8-cockpit-current-spec.md`
10. `pwa/manual/6-7-contracts-management-spec.md`

## 状態スナップショット

- canonical repo は `/Users/masa/projects/AMD/amd-os`、`main` / `98194573`。2026-08-14時点で `origin/main` と一致、ahead 0 / behind 0。
- BZMのUI、検査、仕様・manualに別レーンの未コミット差分がある。契約監査の対象ではないので、開始時の `git status` にあるBZM差分をstage・revert・削除しない。BZM担当が引き取るまで保全する。
- SX（p21）は現行契約が `signed`。締結済み原本と現行見積書を資料室へAMD内部限定でリンク済み。
- SXコックピットには、別紙内訳の月額請求、検査合格・適法な請求書受領後60日以内の支払、毎月の完了通知・検査、立替上乗せ不可、再委託の事前承認を表示している。
- CX（p20 / NIMS）の「入札・調達」には4件の資料リンクを登録済み。共有範囲はすべてAMD内部。
- p28 NIMSは連携覚書。個別有償支援の条件は都度書面であり、今回確認範囲に入札一式はない。

## 次タスクの詳細

1. 本番の請求書作成画面から、請求対象になり得るPJを状態違い・future・endedも含めて列挙する。
2. SX（p21）は再判定しない。AMD（p00）は社内PJのため、クライアント契約対象外なら理由を残す。
3. 各PJについて、現行の締結済み原本または現行契約台帳だけで、立替精算をクライアント請求へ上乗せできるかを判定する。
4. 原本がある値だけ候補にし、既存の candidate → review → apply を通す。直接DB更新や一括手打ちはしない。
5. 反映済みは契約台帳、PJコックピット、請求側の読戻しで確認する。原本欠測は値を作らない。
6. 研究機関の契約で、現行契約に紐づく仕様書・見積書・入札関連書類がDriveにあれば、PJ資料室の「入札・調達」へAMD内部限定でリンクする。古い版や汎用テンプレは混ぜない。KUTEは私立なので入札書類セットの対象外。

## 確立済みの運用境界

- `contracts.operational_terms_json` が契約の実務条件の正本。PJコックピットは `projects.contract_terms_json.currentContracts[]` を表示する。
- Driveのファイル本体をDBへ保存しない。契約書は押印版metadataとして登録し、資料室には既存Driveリンクを追加する。共有設定は変えない。
- `expenseReimbursementAllowed` の未抽出は未確認のまま。`申請不可` や `申請可` を推測で設定しない。
- コード・仕様変更が必要な場合は、対象だけをmainへcommit・pushし、PWAなら `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番buildと画面を確認する。今回のような既存画面からのデータ登録だけならコードdeployは不要。
- branch / worker worktreeを作らない。既存dirtyは保全し、対象差分だけを扱う。

最初の報告は、対象PJ数、原本あり/なし、適用候補数、未確認点だけを短く出すこと。URL、原本文面、秘密値、個人情報は出さない。
```
