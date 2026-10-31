export type GovernanceDriveFolderName = "0_経営会議" | "0_取締役会" | "0_株主総会";

export function governanceDriveFolderForTitle(title: string): GovernanceDriveFolderName | null {
  const shareholder = /株主総会/.test(title);
  const board = /取締役会|取締役決定/.test(title);
  if (shareholder && board) return null;
  if (shareholder) return "0_株主総会";
  if (board) return "0_取締役会";
  if (/経営会議/.test(title)) return "0_経営会議";
  return null;
}

export function governanceDriveFolderForType(type: string): GovernanceDriveFolderName {
  const normalized = type.trim().toLowerCase();
  return /^(agm|egm|shareholder)/.test(normalized) || /株主総会|株主/.test(type)
    ? "0_株主総会"
    : "0_取締役会";
}
