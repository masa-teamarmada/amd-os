"use client";
import { loadReferenceData, peekReferenceData, invalidateReferenceData } from "@/lib/reference-data-cache";
import type { PortfolioPulseResponse } from "@/lib/portfolio-pulse";

const KEY = "dashboard:portfolio-pulse";
const TTL = 60_000;
const ENDPOINT = "/api/dashboard/portfolio-pulse";
export function peekPortfolioPulse() { return peekReferenceData<PortfolioPulseResponse>(KEY, TTL); }
export function loadPortfolioPulse(options?: { force?: boolean }) {
  return loadReferenceData(KEY, async () => {
    const response = await fetch(`${ENDPOINT}${options?.force ? "?fresh=1" : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`portfolio pulse: ${response.status}`);
    const value = await response.json() as PortfolioPulseResponse;
    if (!value.ok) throw new Error("portfolio pulse failed");
    return value;
  }, { ttlMs: TTL, force: options?.force }).then((value) => {
    if (value.institutionError || value.seedsError || value.screeningBandsError) invalidateReferenceData(KEY);
    return value;
  });
}
export function invalidatePortfolioPulseCache() { invalidateReferenceData(KEY); }
