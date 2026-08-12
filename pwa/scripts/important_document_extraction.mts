import fs from "node:fs";
import path from "node:path";
import { extractImportantEvidence, toImportantEvidenceOutbox, type ImportantEvidenceBatch } from "./lib/important_evidence_extraction.mts";
import { extractImportantDocuments, type ImportantDocumentBatch } from "./lib/important_document_extraction.mts";

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const inputPath = typeof args.file === "string" ? path.resolve(args.file) : "";
if (!inputPath) throw new Error("--file <batch.json> is required");
const raw = JSON.parse(fs.readFileSync(inputPath, "utf8")) as ImportantEvidenceBatch | ImportantDocumentBatch;
const result = "documents" in raw ? extractImportantDocuments(raw) : extractImportantEvidence(raw);
const outbox = toImportantEvidenceOutbox(result);
const serialized = `${JSON.stringify(outbox, null, 2)}\n`;
if (typeof args.out === "string") {
  const outputPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
} else {
  process.stdout.write(serialized);
}
