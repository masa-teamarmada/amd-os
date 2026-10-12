"use client";
import {
  loadReferenceData,
  peekReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { CardBundle } from "./project-card-designs";
const key = (pid?: string, admin = false) =>
  `card-designs:${admin ? "admin" : pid}`;
export const peekCardDesigns = (pid?: string, admin = false) =>
  peekReferenceData<CardBundle>(key(pid, admin), 30000);
export function loadCardDesigns(pid?: string, admin = false, force = false) {
  return loadReferenceData<CardBundle>(
    key(pid, admin),
    async () => {
      const r = await fetch(
        `/api/project-card-designs?${admin ? "admin=1" : `project_id=${encodeURIComponent(pid || "")}`}${force ? "&fresh=1" : ""}`,
        { cache: "no-store" },
      );
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      return b;
    },
    { ttlMs: 30000, force },
  );
}
export async function mutateCardDesigns(path: string, payload: unknown) {
  const r = await fetch(`/api/project-card-designs${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const b = await r.json();
  if (r.ok) invalidateReferenceData("card-designs:");
  return { r, b };
}
