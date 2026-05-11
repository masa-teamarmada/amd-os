# HANDOFF — AMD OS PWA

最終更新: 2026-05-11 (pensive-engelbart-7672ca、3 回目セッション後)

## 🚨 次セッションへの明確な指示

> **「絶対に 1 回で全部完遂する」**こと (まさ要望、明日のイベント前夜)。
> まさは MTG / 用事で 30 分〜数時間放置する可能性。**途中で止めず、tsc / commit / push / main merge / deploy / 動作確認まで一気通貫で走り切る**。
> 不明点があっても止めずに自分の判断で進める (まさのフィードバックは事後で OK)。
> 残タスクは下の【1 ターンで完遂すべき残タスク】に全部書いた。実装方針・コマンド付き。

## 必読 (この順で)

1. **[`BUGS.md`](BUGS.md) 末尾 4 件 (2026-05-11 追加)** — Atlas Map 力場 / worktree path / clasp invalid_rapt / UNIQUE 衝突
2. **[`design/aspi_lanes.md`](design/aspi_lanes.md)** ⭐ — ASPI 8 domain 正本 + Phase 2 全実装の構造
3. **[`design/amd_score.md`](design/amd_score.md)** — Triple Helix M カード (7 観測量カバレッジ 7/7 になった経緯)
4. **[`design/L2_DATA.md`](design/L2_DATA.md)** — cron 一覧 (新 4 cron 追加済)
5. **[`design/db_schema.md`](design/db_schema.md)** — 93 tables (observation_log / lane_suggestions / project_ventures.lanes 含む)
6. **[`/Users/masa/projects/AGENTS.common.md`](../../AGENTS.common.md)** — えいみ人格・共通ルール正本 (思考も日本語、自分の提案を疑う 等)
7. [`design/README.md`](design/README.md) — 設計 md インデックス
8. [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾 (2026-05-11 の 3 ラウンド詳細)

## リポ状態 (2026-05-11 夕)

- main HEAD: `981015d` (docs commit)、その手前 `409c32d` (Atlas zoom + cron hybrid + GAS trigger)
- branch: `claude/pensive-engelbart-7672ca` (worktree)
- 未 push commit: なし
- Vercel deploy: `amd-os-pdg6emk4d-armada0130` (production, Ready)
- GAS deploy: ⚠️ **未反映** (clasp invalid_rapt、まさが clasp login やり直し必要)
- Supabase migration: ...040 / 041 (project_ventures.lanes JSONB) / 042 (observation_log + lane_suggestions + lane rewrite) 全部適用済
- observation_log: 384 rows seed 済 (8 domain × 3 key × 16 quarter)

## 1 ターンで完遂すべき残タスク (優先順)

### ★1. Atlas Map の完全均一分散化 (= まさ最優先、3 ラウンド未解決)

**症状**: 中央密集 + 外周ドーナツ + 5 秒後追加縮小。詳細 [`BUGS.md`](BUGS.md) 該当エントリ。

**実装** [`pwa/src/app/(app)/atlas/map/page.tsx`](src/app/(app)/atlas/map/page.tsx):

```tsx
// (1) cooldown を時間制御に
cooldownTime={3000}     // ← 既存 cooldownTicks=180 を削除し置換
d3VelocityDecay={0.25}

// (2) 力場を更に強化
if (fg.d3Force("charge")) fg.d3Force("charge").strength(-4000);
if (fg.d3Force("link")) fg.d3Force("link").distance(450);
// collide minDist を 32 → 80 に拡大 (= ラベルが重ならない最小距離)
const collisionForce = (alpha: number) => {
  const minDist = 80;
  /* 既存ロジックの minDist を 32 → 80 に変更 */
};

// (3) 孤立 center force を撤去、radial domain force に置き換え
// domain key (色) で角度を割り振り、各ノードを「自 domain の角度 × 半径 500」に弱く引っ張る
const domainAngles = new Map<string, number>();
const uniqueDomains = Array.from(new Set(data.nodes.map((n) => domainKey(n.story.primary_domain) ?? "_"))).sort();
uniqueDomains.forEach((d, i) => {
  domainAngles.set(d, (i / uniqueDomains.length) * 2 * Math.PI);
});
const RADIUS = 600;
const radialDomainForce = (alpha: number) => {
  for (const node of data.nodes as unknown as { x: number; y: number; vx: number; vy: number; story: { primary_domain: string } }[]) {
    const dk = domainKey(node.story.primary_domain) ?? "_";
    const ang = domainAngles.get(dk) ?? 0;
    const tx = Math.cos(ang) * RADIUS;
    const ty = Math.sin(ang) * RADIUS;
    node.vx += (tx - node.x) * 0.05 * alpha;
    node.vy += (ty - node.y) * 0.05 * alpha;
  }
};
fg.d3Force("isolatedCenter", null);  // 撤去
fg.d3Force("radialDomain", radialDomainForce);
fg.d3Force("collide", collisionForce);

// (4) 初期座標を domain 角度配置にして「最初から散らばってる」
// useEffect で data 更新時に各ノードに初期 x/y を割り当てる (まだ未配置のもののみ)
useEffect(() => {
  for (const node of data.nodes as unknown as { x?: number; y?: number; story: { primary_domain: string } }[]) {
    if (node.x !== undefined && node.y !== undefined) continue;
    const dk = domainKey(node.story.primary_domain) ?? "_";
    const ang = domainAngles.get(dk) ?? 0;
    const r = RADIUS + (Math.random() - 0.5) * 200;
    node.x = Math.cos(ang) * r + (Math.random() - 0.5) * 100;
    node.y = Math.sin(ang) * r + (Math.random() - 0.5) * 100;
  }
}, [data, domainAngles]);

// (5) handleEngineStop は最小操作 (zoom 倍率変更削除、setTimeout 削除)
const handleEngineStop = () => {
  if (!fgRef.current || didInitialFitRef.current || data.nodes.length === 0) return;
  didInitialFitRef.current = true;
  const fg = fgRef.current as any;
  fg.zoomToFit(400, 120);  // padding 120、倍率変更しない
  // 旧: zoom × 1.6 setTimeout は削除 (これが「5 秒後に縮小」の見え方の原因)
};
```

検証: 本番 deploy 後 <https://amd-os-pwa.vercel.app/atlas/map> で「均一分散・5 秒後動かない・ラベル可読」確認。

### ★2. clasp login → GAS push → trigger setup (まさが clasp login するだけ、コードは push 済)

```sh
cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/pensive-engelbart-7672ca/gas
npx --yes @google/clasp@latest login          # ブラウザで Google ログイン (まさ作業)
npx --yes @google/clasp@latest push --force
npx --yes @google/clasp@latest deploy \
  --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G \
  --description "v1455_aspi_weekly_triggers"
# trigger setup (one-time、runFunc 経由)
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_pwa_setupWeeklyAspiTriggers_"
```

→ 毎週月曜 04:00 / 05:00 JST に 4 cron が自動キックされる。

### ★3. atlas_signals.domain に量子・センシング・通信新カテゴリ追加

現状 atlas_signals.domain は A-O の 15 カテゴリ。ASPI 8 domain のうち `quantum` / `sensing_timing_navigation` / `advanced_ict` に対応する atlas domain がない (= R 観測量がこれらの domain で常に 0)。

**実装**:
1. **[`pwa/src/lib/atlas-domains.ts`](src/lib/atlas-domains.ts)** に P/Q/R/S 追加:
   ```ts
   P: { color: "#8b5cf6", label: "量子" },        // ASPI quantum
   Q: { color: "#0ea5e9", label: "センシング" },  // ASPI sensing_timing_navigation
   R: { color: "#71717a", label: "通信" },        // ASPI advanced_ict 補完 (I は AI 中心)
   ```
2. **[`pwa/src/app/api/cron/atlas-collect/route.ts`](src/app/api/cron/atlas-collect/route.ts) の Sonnet プロンプト** に新 domain を追記 (`P.量子・量子計算 / Q.センシング・計測 / R.先端通信`)
3. **[`pwa/src/app/api/cron/atlas-collect-policy/route.ts`](src/app/api/cron/atlas-collect-policy/route.ts) の LLM プロンプト** に同様
4. **[`pwa/src/lib/triple-helix-observations.ts`](src/lib/triple-helix-observations.ts) の `LANE_DOMAIN_PREFIXES`** に追加:
   ```ts
   advanced_ict: ["I.", "R."],
   quantum: ["P."],
   sensing_timing_navigation: ["Q."],
   ```

→ atlas-collect が次に走ったときから新 domain で signal が入り始め、Triple Helix の R 観測量が量子・センシング・ICT でも 0 でなくなる。

### ★4. BVAR Kalman filter で μ_A / μ_I / μ_G 隠れ状態推定 (Phase 3)

正本: [`/Users/masa/projects/AMD/before-zero/theory/state_space_model.md`](../../before-zero/theory/state_space_model.md) §10 + [`bvar_prior.md`](../../before-zero/theory/bvar_prior.md)

**実装** (TS で軽量 Kalman filter):
1. 新規 `pwa/src/lib/kalman-bvar.ts`: 状態空間モデル `x_t = A x_{t-1} + B u_t + ε`、`y_t = C x_t + η`。状態 `x = (μ_A, μ_I, μ_G)`、観測 `y = (P, B, V, R, I_R, N, C_compete)`。
   - A: 3×3、対角 0.95 (persistence)、非対角 0 で初期化
   - C: `triple_helix_loading` の 7×3 prior をそのまま採用
   - Q: diag(0.1, 0.1, 0.1) (状態ノイズ)
   - R: diag(各観測量 history 標準偏差)
   - EM アルゴリズムは省略、Kalman smoother のみ実装 (forward + backward pass)
2. **[`pwa/src/lib/triple-helix-observations.ts`](src/lib/triple-helix-observations.ts)** の μ 計算 (簡易加重平均) を Kalman smoother 結果に置き換え。
3. 新規 cron `cron/triple-helix-recompute` (weekly): 全 ASPI 8 domain × 16 quarter で Kalman 走らせて結果を `triple_helix_state_log` (新規テーブル、migration 043) に保存。

**migration 043**:
```sql
CREATE TABLE triple_helix_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,
  observed_at DATE NOT NULL,
  mu_a NUMERIC NOT NULL,
  mu_i NUMERIC NOT NULL,
  mu_g NUMERIC NOT NULL,
  sigma_su NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lane, observed_at)
);
```

UI 側 (`TripleHelixMatrix`) は `triple_helix_state_log` から μ を読むように切り替え (= Phase 1 簡易計算をそのまま残しつつ Phase 3 結果を優先表示)。

### ★5. KAKEN / NEDO 構造化 fetch (Phase 2-C2 / D2)

現状 [`cron/kaken-ingest`](src/app/api/cron/kaken-ingest/route.ts) / [`cron/grant-ingest`](src/app/api/cron/grant-ingest/route.ts) は LLM (Sonnet + web_search) で推定してる。実 API / scrape に置き換え:

- **KAKEN**: `https://nrid.nii.ac.jp/opensearch/?format=json&kw=<keyword>&from=YYYY-MM-DD&until=YYYY-MM-DD` で取得 (公開 OpenSearch、認証不要)。各 ASPI 8 domain × `KAKEN_KEYWORDS_BY_DOMAIN` で fetch、配分額を集計。
- **NEDO**: `https://www.nedo.go.jp/koubo/saitaku_l.html` をプログラム fetch + HTML parser (`cheerio`) で採択タイトル + 金額抽出 → LLM (Sonnet) で domain 分類。
- **AMED**: `https://www.amed.go.jp/koubo/saitaku/` も同様。

→ LLM 推定値を実数値で上書き (observation_log の source を `kaken_api` / `nedo_scrape` に変更、既存 `kaken` / `grant` source 行は古いとマーク)。

### ★6. tsc + commit + push + main merge + deploy + 動作確認

```sh
# worktree 内
cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/pwa && npx tsc --noEmit
python3 -X utf8 scripts/dump_schema.py   # migration あれば再生成
cd .. && git add <touched files>
git commit -m "..."
git push origin <branch>
cd /Users/masa/projects/AMD/amd-os && git checkout main && git pull --ff-only && git merge <branch> --no-ff -m "..." && git push origin main
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh   # 5-6 分
# 本番 URL 確認: /atlas/map / /admin/projects / /venture-map/amd-score
```

## 運用コマンド (常用)

- PWA Vercel deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- DDL 適用: `python3 -X utf8 pwa/scripts/apply_ddl.py <worktree>/pwa/scripts/migrations/NNN_name.sql`
- DB schema 再生成: `python3 -X utf8 <worktree>/pwa/scripts/dump_schema.py`
- 新 4 cron 手動キック (確認用):
  ```sh
  URL="https://amd-os-pwa.vercel.app"
  SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
  for path in lane-suggest kaken-ingest grant-ingest vc-investment-ingest; do
    curl -sL --max-time 300 "$URL/api/cron/$path" -H "Authorization: Bearer $SECRET" | jq
  done
  ```
- GAS push + deploy update: [`pwa/CLAUDE.md`](CLAUDE.md) の「GAS 関数を CLI/curl から実行する手順」参照

## ⚠️ 必読ルール (本セッションで違反/失敗した点)

- **worktree 作業時、Write / Edit の `file_path` は worktree フルパス必須** (= `/Users/masa/projects/AMD/amd-os/.claude/worktrees/<name>/...`)。本セッション 3 回 main repo に書く事故 → BUGS.md 参照
- **「1 時間放置される」と明示されたら 1 時間動き続ける**。途中で「ここで止めて報告」と勝手に判断しない。残タスクが残ってたら自分の判断で実装続行
- **自分の提案を疑う** (memory rule): 本セッション Atlas Map zoom 倍率を 3 回変更して 3 回ともダメ。1 回でダメだったら force layout の根本構造 (radial domain force) に立ち戻る判断を早く
- **正本 md は Read で全文通してから動く** (memory rule): atlas/map/page.tsx を full Read してから force 設定を変えるべきだった (本セッションは部分 grep で済ませてしまった)

## 過去セッションログ

- [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) — 2026-05 全セッション (本セッション 3 ラウンド含む)
- [`design_log/sessions_2026-04.md`](design_log/sessions_2026-04.md) — 2026-04 全セッション
