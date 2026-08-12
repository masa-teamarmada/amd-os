/**
 * 旧CLIとの互換入口。
 * 決算書専用判定は廃止し、全形式・全重要カテゴリの共通抽出器へ渡す。
 */
import {
  extractImportantEvidence,
  toImportantEvidenceOutbox,
  type ImportantEvidenceBatch,
  type ImportantEvidenceInput,
  type ImportantEvidenceProject,
} from "./important_evidence_extraction.mts";

export * from "./important_evidence_extraction.mts";

export type ImportantDocumentInput = Omit<ImportantEvidenceInput, "source" | "source_ref" | "material_kind" | "title"> & {
  file_id: string;
  name: string;
};

export type ImportantDocumentProject = ImportantEvidenceProject;

export type ImportantDocumentBatch = {
  project: ImportantDocumentProject;
  observed_at: string;
  documents: ImportantDocumentInput[];
};

export function extractImportantDocuments(batch: ImportantDocumentBatch) {
  return extractImportantEvidence({
    project: batch.project,
    observed_at: batch.observed_at,
    materials: batch.documents.map((document) => ({
      ...document,
      source: "drive",
      source_ref: `drive-file:${document.file_id}`,
      material_kind: "document",
      title: document.name,
      // 旧バッチはプロジェクト単位の親階層解決後データだったため互換的にroot一致とする。
      project_root_matched: document.project_root_matched ?? true,
    })),
  } satisfies ImportantEvidenceBatch);
}

export const toCoverageGapOutbox = toImportantEvidenceOutbox;
