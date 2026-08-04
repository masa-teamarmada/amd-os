# HANDOFF　BZM批判的基礎講座

> **更新日**：2026-08-04
>
> **仕事種別**：非開発PJ作業。BZM理論の批判的講座と、SPS 2.0試行採点の準備。
>
> **正本パス**：`/Users/masa/projects/AMD/amd-os/pwa/bzm`

## 今回の到達点

Session 1「測定尺度とSPSの時間構造」は、まさとの対話を反映した`live-reviewed v1.0`になった。

SPS 2.0の理論原案は、以下まで設計上の選択として固定した。

1. 正本SPSは、社会的価値とPJ自身の経済的価値を保つ$\mathbf{SPS}=q\mathbf P$とする。
2. $q$は、計画期限内かつ戦略余力を失う前に到達境界$X^*$へ着く、校正前のモデル上の条件付き確率推定値とする。
3. $T_C$と$T_Y$は、同じ出来事が双方を動かすため、独立ではなく共同シミュレーションで生成する。
4. XRL段階番号、マイクロトレンド$M$、状態価値$W$を、トップ層へ再乗算しない。証拠を通じて$\mathbf P$または$q$の入力を更新する。
5. 診断、予測、意思決定は、同じ証拠台帳から別々に出す。現行PWAのSPS、GO判定、本番データは変えていない。

統合教材は、[ワークスペース文書「BZM 2.0 理論原案」](https://amd-os-pwa.vercel.app/api/workspace-documents/5c00d293-cc97-4136-86df-4af6cdb1e304/render)を唯一の配布正本とする。ローカルHTMLを配布物または別正本として使わない。

## 次セッションの最初の一手

講義を続ける前に、**SPS 2.0の試行採点を開始する**。

最初に、現行データで$P$と$R_{\mathrm{net}}$まで揃う13行を読取り、PJ単位へ戻して、各PJの入力充足表を作る。

次に、最も証拠が揃う少数PJを選び、次の入力票を埋める。

1. 計画版$v$、情報締切、事象時刻、認識時刻。
2. $\mathbf P=(V_{\mathrm{soc}},V_{\mathrm{econ}})$の暫定尺度と根拠。
3. その価値シナリオに対応する到達境界$X^*$。
4. マイルストーンの依存、最短・最頻・悲観所要時間、成功確率、失敗分岐。
5. 戦略余力を失う事象、補充事象、各事象が$T_C$と$T_Y$へ与える共同の影響。
6. 欠測、評価者、根拠、モデル版。

入力票と尺度・欠測・版管理規則を同時に固定した後、PJごとに1万回の共同シミュレーションを行い、$q$、$T_C$分布、$T_Y$分布、主な失敗経路、SPSベクトルを試行表示する。

単一SPSへの投影、全PJ更新、現行PWA切替はこの試行の後に扱う。試行値を校正済み成功確率、投資判断、自動GO判定とは呼ばない。

## 未解決

1. 社会的価値と条件付きDCFの暫定尺度。
2. PJ類型ごとの$X^*$と価値シナリオの整合規則。
3. マイルストーン三点見積り、成功確率、失敗分岐、$T_Y$事象の入力規則と評価者差。
4. 事象時刻、認識時刻、計画版、モデル版、欠測を保存する実データ構造。
5. $W(X,Y)$の関数形、単一SPSの尺度写像と方針重み、外部成果による校正。

## Repo状態

- 作業場所：`/Users/masa/projects/AMD/amd-os`、branch：`main`。
- BZM対象の変更：診断スコア暫定仕様、Session 1、講座索引、改訂要求書、附則、今回のhandoffと移行プロンプト。
- push、deploy、本番データ書き込み：未実施。講座タスクでは、まさが明示しない限り行わない。
- 現在のローカル`main`は`origin/main`より8コミット遅れている。BZM外のProject ShareおよびPWA仕様のステージ済み変更は別作業として保持し、触らない。
- このセッションで作成したbranch、worktree：なし。開発用`design_log/`：未使用。
- OSマニュアル：対象外。理論、講座、ワークスペース文書の配布先だけを扱い、AMD OS製品仕様を変えていない。

## 読む資料

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/bzm/AGENTS.md`
6. このHANDOFF
7. [`BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md`](./BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md)
8. [`course-bzm-foundations-s01.md`](./course-bzm-foundations-s01.md)
9. [`BZM_2_0_REVISION_REQUIREMENTS.md`](./BZM_2_0_REVISION_REQUIREMENTS.md)
10. `/Users/masa/projects/AMD/amd-os/pwa/spec/4-2-amd-score-current-spec.md`

次回用の完全な起動文は、[SESSION_MIGRATION_PROMPT_BZM_COURSE.md](./SESSION_MIGRATION_PROMPT_BZM_COURSE.md)に保存する。
