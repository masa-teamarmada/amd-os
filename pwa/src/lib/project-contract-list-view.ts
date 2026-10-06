import type { ProjectContractListRow } from "./project-contract-list";
export type ContractListSort = "updated" | "title" | "status";
export function filterProjectContracts(rows: ProjectContractListRow[], search: string, status: string, sort: ContractListSort) {
  const query = search.trim().toLocaleLowerCase("ja-JP");
  return rows.filter(row => (!query || [row.title, row.contractingParty, row.counterparty, row.latestDocument?.label].some(value => value?.toLocaleLowerCase("ja-JP").includes(query))) && (!status || row.status === status)).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ja");
    if (sort === "status") return a.status.localeCompare(b.status) || a.title.localeCompare(b.title, "ja");
    return (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") || a.contractId.localeCompare(b.contractId);
  });
}
