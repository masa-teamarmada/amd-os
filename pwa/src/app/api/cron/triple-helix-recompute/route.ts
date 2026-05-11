/**
 * triple-helix-recompute cron — BVAR Kalman smoother で隠れ状態 (μ_A, μ_I, μ_G) を
 * ASPI 8 domain × 直近 16 quarter 全部について推定し、`triple_helix_state_log` に upsert。
 *
 * 設計:
 *   - 観測量は triple-helix-observations.ts の fetchTripleHelixComputed と同じ算出パスを通す
 *     (= papers_log + atlas_signals + observation_log + project_ventures.lanes)
 *   - 各観測量 history を 16 quarter で min-max 正規化 (0-9) して時系列を作る
 *   - Kalman (RTS) smoother で隠れ状態を推定
 *   - σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
 *   - triple_helix_state_log (lane, observed_at) UNIQUE で upsert
 *
 * cron スケジュール: 毎週月曜 04:30 JST (= 19:30 UTC 日曜) 想定。
 *   Vercel Hobby plan の cron 上限により vercel.json には登録せず、
 *   GAS / curl から手動キック想定 (= 当面)。Pro 移行後に vercel.json に登録する。
 *
 * 正本:
 *   - pwa/HANDOFF_pwa_rebuild.md ★4
 *   - before-zero/theory/state_space_model.md §10
 *   - pwa/scripts/migrations/043_triple_helix_state_log.sql
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ASPI_DOMAIN_IDS, type AspiDomainId } from "@/lib/aspi-lanes";
import { fetchTripleHelixComputed } from "@/lib/triple-helix-observations";
import {
  buildKalmanInput,
  kalmanSmooth,
  type ObservationSeries,
} from "@/lib/kalman-bvar";

export const maxDuration = 300;
export const runtime = "nodejs";

const QUARTERS_HISTORY = 16;

function minMaxNormalize(value: number, history: number[]): number {
  if (history.length === 0) return 0;
  const min = Math.min(...history);
  const max = Math.max(...history);
  if (max === min) return value === 0 ? 0 : 4.5;
  return Math.max(0, Math.min(9, (9 * (value - min)) / (max - min)));
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  type StateRow = {
    lane: string;
    observed_at: string;
    mu_a: number;
    mu_i: number;
    mu_g: number;
    sigma_su: number;
    model: string;
    raw_meta: Record<string, unknown>;
    computed_at: string;
  };

  const computedAt = new Date().toISOString();
  const allRows: StateRow[] = [];
  const errors: { lane: string; error: string }[] = [];

  for (const lane of ASPI_DOMAIN_IDS as readonly AspiDomainId[]) {
    try {
      const computed = await fetchTripleHelixComputed(lane);
      const observations = computed.observations.filter(
        (o) => o.history && o.history.length > 0
      );
      if (observations.length === 0) {
        errors.push({ lane, error: "no observations with history" });
        continue;
      }

      // 全観測量で同じ quarter 列に揃える (= 最初の history の observed_at 配列を基準)
      const referenceHist = observations[0].history;
      const T = referenceHist.length;
      const observedAtList = referenceHist.map((h) => h.observed_at);

      // 各観測量を min-max 正規化して時系列化
      const series: ObservationSeries[] = observations.map((o) => {
        const rawValues = o.history.map((h) => h.value);
        const normValues: (number | null)[] = rawValues.map((v) =>
          minMaxNormalize(v, rawValues)
        );
        return {
          key: o.observation,
          loading: [o.loading.mu_a, o.loading.mu_i, o.loading.mu_g],
          values: normValues,
        };
      });

      const kInput = buildKalmanInput(series, T, { aDiag: 0.95, qDiag: 0.1 });
      const result = kalmanSmooth(kInput);

      // 各 t の smoothed state を row 化
      for (let t = 0; t < T; t++) {
        const [muA, muI, muG] = result.states[t];
        // clip to non-negative (= Triple Helix では負値は意味なし、欠損時は0扱い)
        const a = Math.max(0, Number.isFinite(muA) ? muA : 0);
        const i = Math.max(0, Number.isFinite(muI) ? muI : 0);
        const g = Math.max(0, Number.isFinite(muG) ? muG : 0);
        const sigma = Math.cbrt((a + 1) * (i + 1) * (g + 1)) - 1;
        allRows.push({
          lane,
          observed_at: observedAtList[t],
          mu_a: Math.round(a * 1000) / 1000,
          mu_i: Math.round(i * 1000) / 1000,
          mu_g: Math.round(g * 1000) / 1000,
          sigma_su: Math.round(sigma * 1000) / 1000,
          model: "kalman-bvar-v1",
          raw_meta: {
            observation_keys: series.map((s) => s.key),
            coverage: computed.coverage,
            quarter_idx: t,
            T,
          },
          computed_at: computedAt,
        });
      }
    } catch (e) {
      errors.push({ lane, error: String(e) });
    }
  }

  if (allRows.length === 0) {
    return NextResponse.json({
      ok: false,
      inserted: 0,
      errors,
    });
  }

  // upsert chunks of 200 で投げる
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += 200) {
    const chunk = allRows.slice(i, i + 200);
    const { error } = await db.from("triple_helix_state_log").upsert(chunk, {
      onConflict: "lane,observed_at",
      ignoreDuplicates: false,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, inserted, errors },
        { status: 500 }
      );
    }
    inserted += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    inserted,
    lanes: ASPI_DOMAIN_IDS.length,
    quarters: QUARTERS_HISTORY,
    errors,
  });
}
