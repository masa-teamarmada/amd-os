import { InstitutionRegulationsPanel } from "@/components/institutions/InstitutionRegulations";

/** 既存の工学院大PJ導線も、全研究機関共通の規程台帳を参照する。 */
export function CockpitKuteRegulations() {
  return <InstitutionRegulationsPanel institutionId="inst_kute" />;
}
