# HANDOFF　BZM批判的基礎講座

> **更新日**：2026-07-31
>
> **仕事種別**：非開発PJ作業。BZM理論の批判的講座と研究整理。
>
> **正本パス**：`/Users/masa/projects/AMD/amd-os/pwa/bzm`

## 今回の到達点

大学院1年生向けの全16回カリキュラムと、Session 0「BZMの二つの観測対象とSPSの役割」を作成した。

講義資料の現在地は、[講座索引](./course-bzm-foundations-index.md)と[Session 0](./course-bzm-foundations-s00.md)にある。

Session 0は、まさとの対話を反映した`live-reviewed v1.0`である。

今回の中心的な整理は次のとおり。

1. BZMはSU側のPJと研究機関側を別々に観測する。
2. 証拠、採点、合成値を分ける。
3. 現行の九軸式と$M\times P\times R\times S$は代数的に同一である。
4. 九軸の0〜9が共通の量的尺度であることは未検証である。
5. 現行$S=FRL\times R_{\mathrm{net}}$は、売上自走状態または生存確率の検証済み測定ではない。
6. SPSは、当面、版管理された探索的なPJ軌跡指数として残す。
7. 有償PoC、自走、技術移転、資金接続は、各軸と履歴を使う別々の予測モデルで扱う。
8. 目標別予測、価値評価、判断、介入をSPSへ再統合しない。

BZM構築時に反論可能性を必ず探索する規律は、[BZM用AGENTS.md](./AGENTS.md)へ保存した。

## Repo状態

- 作業場所：`/Users/masa/projects/AMD/amd-os`
- branch：`main`
- 講義資料コミット：`d7e0d50b docs(bzm): add critical foundations session 0`
- `d7e0d50b`は2026-07-31時点でローカルのみ。
- push、deploy、外部公開、本番データ書き込み：未実施。
- 理由：この講座タスクでは、まさが明示しない限りpush、deploy、外部公開を行わない条件がある。
- このセッションで作成したbranch、worktree：なし。
- 開発用`design_log/`：未使用。
- OSマニュアル：対象外。BZM理論と講座資料のみで、AMD OSの製品または運用仕様を変更していない。

## 未解決

1. `BZM_2_0_REVISION_REQUIREMENTS.md` 4.2節の「概念式と九軸式は同一の対象ではない」は、現行PWA仕様の代数的同一性と矛盾する。次回以降に修正案を確定する。
2. SPS軌跡の一点を、月次、重要イベント時、判断直前のどこで記録するか未確定。
3. 採点基準または合成方式を変更したとき、全履歴を再計算するか、版の切れ目を残すか未確定。
4. 「イケている」という人間の定性的所見の記録形式は未確定。SPSから自動生成せず、循環検証を避ける必要がある。
5. 目標別アウトカムの定義、期間、打切り、競合事象は未確定。
6. 13を超えるPJと複数時点の保有データは、まさから共有された事実だが、未入力分の件数と内容は未確認。
7. 現行PWAのSPS計算を置き換える判断はしていない。現行積は暫定診断として残る。

## 次セッションの最初の一手

Session 1「測定尺度」を、一問ずつ対話で進める。

最初の問いは次である。

> SPS軌跡の一点は、月次の定期観測、重要イベントの直後、意思決定の直前のうち、どの時点で発生させるべきか。

まさの直感を聞いたあと、各方式が持つ観測頻度の偏り、後知恵、測定不変性、欠測の違いを示す。

いきなりデータ構造または新しい数式を確定しない。

## 最初に読む資料

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/bzm/AGENTS.md`
5. このHANDOFF
6. `/Users/masa/projects/AMD/amd-os/pwa/bzm/course-bzm-foundations-index.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/bzm/course-bzm-foundations-s00.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/bzm/BZM_2_0_REVISION_REQUIREMENTS.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/4-2-amd-score-current-spec.md`

次回用の完全な起動文は、[SESSION_MIGRATION_PROMPT_BZM_COURSE.md](./SESSION_MIGRATION_PROMPT_BZM_COURSE.md)に保存する。
