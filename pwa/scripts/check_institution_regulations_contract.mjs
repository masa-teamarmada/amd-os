#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (file, anchors) => {
  const source = read(file);
  for (const anchor of anchors)
    if (!source.includes(anchor)) throw new Error(`${file} missing ${anchor}`);
};
expect("scripts/migrations/282_institution_regulation_ledger.sql", [
  "institution_regulation_types",
  "institution_regulation_cells",
  "institution_regulation_versions",
  "amd_os_is_member()",
  "is_admin()",
  "regver_ehime_recognition_current",
]);
expect("scripts/migrations/316_ehime_regulation_ledger_enrichment.sql", [
  "external_program_support",
  "reg_ehime_side_job",
  "reg_ehime_coi",
  "reg_ehime_joint_research",
  "reg_ehime_venture_support",
  "reg_ehime_jst_post_startup_support",
  "('inst_ehime', 'shared_equipment', 'reg_ehime_venture_support', 'review'",
  "共同研究は石原先生から出た提案段階で、実施は未合意",
  "12/18設立は目安",
]);
expect("src/lib/institution-regulations.ts", [
  "currentVersion",
  "?.externalUrl ||",
  "`/institutions/${institutionId}/regulations/${regulation.regulationId}`",
]);
expect("src/app/api/institution-regulations/route.ts", [
  "requireMember()",
  "requireAdmin()",
  'action === "save_cell"',
  'action === "add_version"',
]);
expect("src/components/institutions/InstitutionRegulations.tsx", [
  "全研究機関 SU関連規程リスト",
  "外部文書を正本として優先",
  "作成中",
  "◯",
  "RegulationEditor",
]);
expect("src/app/(app)/institutions/page.tsx", [
  'ViewMode = "catalog" | "regulations" | "ecr"',
  "RegulationMatrix",
]);
expect("src/app/(app)/institutions/[institutionId]/cockpit/page.tsx", [
  '| "regulations"',
  "InstitutionRegulationsPanel",
]);
expect(
  "src/app/(app)/institutions/[institutionId]/regulations/[regulationId]/page.tsx",
  ["外部正本が未登録", "版履歴"],
);
console.log("institution regulations contract OK");
