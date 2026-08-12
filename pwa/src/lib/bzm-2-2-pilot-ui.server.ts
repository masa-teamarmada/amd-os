import "server-only";

import type { Bzm22PilotProject } from "@/lib/bzm-2-2-pilot-ui";

type PilotLoader = () => Promise<unknown>;

const PILOT_LOADERS: Record<string, PilotLoader> = {
  p03: () => import("@/generated/bzm-2-2-pilot/p03.json"),
  p04: () => import("@/generated/bzm-2-2-pilot/p04.json"),
  p06: () => import("@/generated/bzm-2-2-pilot/p06.json"),
  p07: () => import("@/generated/bzm-2-2-pilot/p07.json"),
  p09: () => import("@/generated/bzm-2-2-pilot/p09.json"),
  p11: () => import("@/generated/bzm-2-2-pilot/p11.json"),
  p18: () => import("@/generated/bzm-2-2-pilot/p18.json"),
  p20: () => import("@/generated/bzm-2-2-pilot/p20.json"),
  p21: () => import("@/generated/bzm-2-2-pilot/p21.json"),
  p24: () => import("@/generated/bzm-2-2-pilot/p24.json"),
  p26: () => import("@/generated/bzm-2-2-pilot/p26.json"),
  p29: () => import("@/generated/bzm-2-2-pilot/p29.json"),
};

export async function fetchBzm22PilotProject(
  projectId: string,
): Promise<Bzm22PilotProject | null> {
  const loader = PILOT_LOADERS[projectId];
  if (!loader) return null;

  const loadedModule = await loader() as { default: unknown };
  const pilot = loadedModule.default as Bzm22PilotProject;
  if (
    pilot.schemaVersion !== "bzm2.2-pilot-ui/v1" ||
    pilot.projectId !== projectId ||
    pilot.groups.reduce((sum, group) => sum + group.parameters.length, 0) !== 103
  ) {
    throw new Error(`BZM 2.2 pilot UI projection is invalid for ${projectId}`);
  }
  return pilot;
}
