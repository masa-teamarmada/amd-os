"use client";

import { loadReferenceData } from "@/lib/reference-data-cache";

export type ModelSectionNavItem = { id: string; label: string };

const MODEL_SECTIONS_KEY = "model:sections";
const MODEL_SECTIONS_ENDPOINT = "/api/model/sections";

async function requestModelSections(): Promise<ModelSectionNavItem[]> {
  const response = await fetch(MODEL_SECTIONS_ENDPOINT);
  const payload = (await response.json()) as {
    ok?: boolean;
    sections?: ModelSectionNavItem[];
  };
  if (!response.ok || !payload.ok) throw new Error("model sections failed");
  return payload.sections ?? [];
}

/** 左ナビ用のモデル節一覧。画面をまたいでも同じ参照結果を使い回す。 */
export function loadModelSections() {
  return loadReferenceData(MODEL_SECTIONS_KEY, requestModelSections);
}
