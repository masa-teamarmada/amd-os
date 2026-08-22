# AMD OS GAS

Google Apps Script。freee連携、Slack通知、外部サービス→Supabase 供給ハブ。

> 共通ルール（`/Users/masa/projects/AGENTS.common.md`）は `~/.claude/CLAUDE.md` 経由で
> どの cwd でも自動で読まれる。ここで再importしない。
> このディレクトリの詳細ルールは `AGENTS.reference.md`（該当作業のときだけ読む）。

AMD OS は Team ARMADA が複数のディープテックスタートアップ（DTSU）を同時並行・長期で経営するための業務OS。
Google Apps Script + Google Spreadsheet を正本DBとし、Notion / Slack / freee / Google Drive / Calendar と連携する。

**思想：事実と解釈の徹底分離 / append-only / 人の判断を消さない**

- デプロイ: `clasp push`
- モノレポ全体の方針は `../AGENTS.md`、詳細手順と過去事故は `../AGENTS.reference.md`
- GAS 固有の詳細（実装規約、データ契約、運用手順）は `AGENTS.reference.md`
