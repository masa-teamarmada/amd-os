# BWE governance takeoff patch (2026-06-22)

このファイルは、2026-06-22 に発生した「BWE 第1回定時株主総会 同意書 (6/18 21:12 メール) の取りこぼし」事故対応として、`scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` と `pwa/design/governance_action_items.md` に入れるべき変更を一時的にまとめたもの。**マニュアル正本 (`pwa/manual/9-3-appendix-changelog.md`) と BUGS.md にも同内容が記録されている**。実装変更が落ち着いたら、本ファイルの本体修正分を SKILL / governance_action_items.md に転記して、本ファイルは削除する (= 仮の置き場、まさへの状況伝達と recovery 用)。

---

## 1. SKILL.md (Phase 0 / D-14 / D-14G / Phase M) に入れる差分

`pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` の以下のセクション。

### Phase 0 — `active PJ` 取得を 2 種類に分ける

```
Phase 0: 環境セットアップ + PJ リスト取得 (active / all 2 種類)
```

- `activeProjects` = `projects?status=eq.active`。D-1 / D-2 / D-3 / D-4 / D-7 / D-8 / D-9 など、進捗・知識・経営シグナルを抽出する Phase A〜J に使う (= 5-10 PJ)。
- `allProjects` = `projects?select=*` (status フィルタなし、ended / frozen 含む全 PJ)。**Phase K-C (D-14 要対応) / D-14G (Governance Email Sweep) / Phase M (Coverage Scanner) はこの `allProjects` を使う**。
- なぜ all が必要か: 株主総会・取締役会・要対応・清算系は ended PJ にも発生する (= まさは退任しても株主として残る、AMD は卒業 PJ の cap table 持分が残る)。`L2_DATA.md` §「ended でも清算・株主総会等は残す」と `pwa/design/governance_action_items.md` §1 の JOYCLE (p09) / BWE (p11) 取りこぼし事故が起点。**active 限定で走査すると同じ事故が再発する**。

### Phase K-C: D-14 要対応 (Action Items)

- 起点に BWE (p11) みなし第1回定時株主総会 同意書 (2026-06-18) を追加 (JOYCLE と並列)。
- 拾う signal キーワードに「みなし決議 / 書面決議 / 同意書」を追加。
- **PJ 紐付け対象は `allProjects`** (status フィルタなしの全 PJ list)。本文/件名の会社名で `allProjects` を引く (例: JOYCLE→p09, BWE→p11)。**`activeProjects` を使わない (= ended PJ の取りこぼし再発防止)**。
- 期日抽出に「同意書提出期限」を追加。

### D-14G Governance Email Sweep

- 「総会」「役会」フラグ ON の PJ は `allProjects` から (ended/frozen 含む) 引く。ended でフラグ ON の PJ も対象 (= BWE p11 は ended だが株主総会・取締役会監視 ON)。

### Phase M: Coverage Scanner

- 取りこぼし事故起点に BWE (6/18) を追加。
- 会社名→PJ 紐付けは Phase 0 の `allProjects` を使う。**`activeProjects` を使わない**。

---

## 2. `pwa/design/governance_action_items.md` (§3.1 / §3.2) に入れる差分

### §3.1 要対応スイープ

- 拾う signal キーワードに「みなし決議 / 書面決議 / 同意書」を追加。
- 会社名→PJ 紐付けは `allProjects` (status フィルタなし) を使う。`activeProjects` を使わない。BWE p11 も対象。

### §3.2 株主/総会/バリュエーション

- 監視フラグ ON の PJ に **BWE (p11, ended)** を 2026-06-22 追加。
- 「ended PJ もガバナンス対象から外さない」方針を明示。

---

## 3. 実行済み backfill

- BWE p11 の `governance_watch_shareholder_meetings=true` / `governance_watch_board_meetings=true` を Supabase REST PATCH で投入済。
- `project_shareholder_meetings` 1 行を `POST /api/governance/extract { apply: true, store_attachments: false }` で投入: `id=be80374e-b630-4829-9576-9c56d8df83d0`, `project_id=p11`, `meeting_type=shareholder_written_resolution`, `meeting_date=2026-06-22`, `amd_response=consented`, `source_ref=gmail://thread/19eed63f8ddd31b7`。
- `action_items` 1 件を `POST /api/action-items/extract` で投入: `action_id=ai:245c793187c8df4aee3272e573cabd11a77737feaf40d949987b4b175d4328cb`, `title=[BWE] みなし第1回定時株主総会 同意書提出`, `due_at=2026-06-22T18:00:00+09:00` (= 6/22 09:00 UTC), `priority=critical`, `category=governance`, `review_status=candidate`。

---

## 4. なぜこのファイルが残っているか

2026-06-22 のこのセッションで `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` / `pwa/design/governance_action_items.md` / `pwa/manual/8-3-l2-extraction-routines-spec.md` を Edit したが、別 worker と並行作業中で Edit が反映直後に revert される現象が複数回観測された。データ修正と backfill (Supabase + API) は確実に completed しているので、本ファイルでまずパッチ内容を保存し、後続で SKILL / governance_action_items.md / manual 8-3 の本体に手で merge する。

完了したらこのファイルは削除する。
