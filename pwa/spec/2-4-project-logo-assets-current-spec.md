# PJ Logo Assets 仕様

> **この章は何か**: PJロゴを AMD OS 内で安全に扱うための current spec。Drive上のロゴ候補を直接公開URLで使わず、review 済み asset として表示する前提を固定する。

## 目的

- Dashboard / PJ list / Cockpit header で、PJ名と一緒にロゴを表示する。
- OS内の文章で PJ を参照するとき、Notion の mention chip のように小さいロゴ + PJ名を添えられるようにする。
- Drive上のロゴ候補は read-only で検出し、利用許諾・公開範囲・画像形式を確認してから OS 用 asset へ取り込む。

## Current Implementation

| 領域 | 実装 | 現行挙動 |
|---|---|---|
| UI component | `pwa/src/components/projects/ProjectLogo.tsx` | `logoAssetUrl` があり `usageStatus` が `approved` / `active` のとき画像表示。未設定・要review時は PJ initials fallback |
| mention chip | `pwa/src/components/projects/ProjectMention.tsx` | `ProjectMention` は logo + PJ label。`ProjectMentionText` は `[[pj:p06]]` / `[[pj:CTB]]` の明示tokenだけを置換し、通常本文を自動置換しない |
| logo resolver | `pwa/src/lib/project-logo-assets.ts` | 現時点は static mapping 空。将来DB/Storageから hydrate する read path と同じ型を先に固定 |
| Dashboard PJ list | `pwa/src/components/dashboard/DashboardGrid.tsx` | 横長 PJ stripe の左端に `ProjectLogo` を表示。ロゴ未設定時は既存の initials 相当 |
| Cockpit header | `pwa/src/components/cockpit/CockpitHeader.tsx` | PJ名の左に `ProjectLogo` を表示 |
| Data hydration | `pwa/src/lib/supabase-data.ts` | `DashProject` / `CockpitData.project` に `logoAssetUrl` / `logoUsageStatus` を追加。DB未追加のため現状は resolver fallback |

## Drive 確認結果

2026-06-02 JST に Google Drive connector で read-only 確認した。

- 共有ドライブは複数見える。AMD運営/ARMADA系の共有ドライブが候補。
- `projects.drive_folder_id` は一部PJだけ設定済み。未設定PJもまだ多い。
- 共有Drive上にはロゴ候補らしい PDF / PPTX が存在するが、PNG/SVG/WebP のような UI 直表示用 asset として整理済みとは限らない。
- PJフォルダ直下だけでなく、下位フォルダや別共有フォルダに置かれている候補があるため、単純に `drive_folder_id` 直下だけを探すと漏れる。
- ファイル名・URL・file id は OS spec / report に記載しない。取り込み helper の dry-run artifact でも private/admin-only 扱いにする。

## Asset 保存方針

| 案 | 評価 | 結論 |
|---|---|---|
| Drive URL 直接参照 | 権限切れ、cookie依存、画像最適化不可、公開範囲が不透明 | 採用しない |
| Vercel `public/` へ手置き | 速いが、差し替え履歴・source trace・権限reviewが弱い | 短期デモのみ |
| Supabase Storage | signed/public URL、cache、source metadata、admin review と相性が良い | 第一候補 |

初期運用は `Supabase Storage bucket: project-logos` を想定する。ただし本番DB DDL / bucket作成 / 画像取り込みはこの実装では行わない。

## 推奨データ設計

ロゴは `projects` に列を足すより、履歴とreview状態を持てる `project_assets` table が安全。

| column | type | 意味 |
|---|---|---|
| `asset_id` | uuid PK | asset row id |
| `project_id` | text FK | `projects.project_id` |
| `asset_kind` | text | `logo` / `mark` / `deck_image` など。最初は `logo` |
| `pj_code` | text | CTB / CX / SX など mention fallback 用 |
| `logo_asset_url` | text nullable | UIが読む signed/public URL。永続正本は storage path |
| `logo_storage_path` | text nullable unique | Supabase Storage path |
| `source_drive_file_id` | text nullable | private/admin-only。外部報告に出さない |
| `source_updated_at` | timestamptz nullable | Drive側候補の更新時刻 |
| `usage_status` | text | `needs_review` / `approved` / `active` / `retired` / `missing` |
| `visibility` | text | `internal` / `public` / `admin_only` |
| `license_note` | text nullable | 利用許諾・出典・注意 |
| `created_at` / `updated_at` | timestamptz | audit |

`projects.logo_asset_url` のような列追加は、単一ロゴだけなら簡単だが、Drive候補・review・差し替え履歴・公開範囲を持ちにくい。長期正本は `project_assets`、Dashboardのread performanceが必要なら view / materialized cache で吸収する。

## Import Helper 方針

1. `dry-run`: `projects.drive_folder_id` と Drive search で候補を検出し、候補数・mime種別・親フォルダ階層だけを admin-only artifact に出す。
2. `review`: 著作権・利用許諾・正式ロゴかを人間確認し、`usage_status='approved'` にする。
3. `import`: PDF/PPTX は画像化または元PNG/SVGを抽出し、Supabase Storageへ保存する。
4. `publish`: UIは `project_assets` の `asset_kind='logo'` かつ `usage_status in ('approved','active')` のみ表示する。

## UI Rules

- ロゴは小さくても潰れにくい `object-contain`、固定幅/高さ、`rounded-md`、薄いborderで表示する。
- dark/light のどちらでも、fallback initials は背景・文字コントラストを保つ。
- 横長table / stripe ではロゴは `shrink-0` にし、PJ名側だけ truncate する。
- inline mention は本文を自動置換しない。安全な明示tokenまたはReact componentでのみ挿入する。
- `needs_review` のロゴは画像表示せず initials fallback に倒す。

## 未実装 / 次の worker

- `project_assets` migration と RLS / admin-only source metadata policy。
- Drive候補検出 dry-run helper。
- Supabase Storage bucket 作成と画像import。
- `/admin/projects` で logo candidate / review status を確認するUI。
- `ProjectMentionText` を MTG summary / private wiki / knowledge本文 renderer へ段階導入。
