import fs from "node:fs";
import path from "node:path";
import { buildTheoryGraph, parseTheoryNode, type TheoryNode } from "@/lib/bzm-theory-graph";
import { BzmTheoryMapView, type TheoryMapNode } from "@/components/bzm/BzmTheoryMapView";

/**
 * /bzm/map — 理論マップ (BZM 2.0 の論証台帳)。
 *
 * pwa/bzm/theory-graph/*.md を fs で読み、既存の parser (src/lib/bzm-theory-graph.ts)
 * で node/edge を構築し、クライアント側の力学グラフ + 一覧 UI に渡す。
 */

function theoryGraphDir() {
  return path.join(process.cwd(), "bzm", "theory-graph");
}

function bzmDir() {
  return path.join(process.cwd(), "bzm");
}

const SOURCE_REF_PATTERN = /([A-Za-z0-9_./-]+\.md)(#[-\w]+)?/;

function resolveSourceHref(sourceRef: string): string | null {
  const match = sourceRef.match(SOURCE_REF_PATTERN);
  if (!match) return null;
  const [, mdPath] = match;
  const fileName = mdPath.split("/").pop() ?? mdPath;
  if (!fileName.endsWith(".md")) return null;
  const slug = fileName.replace(/\.md$/, "");
  const filePath = path.join(bzmDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  // BzmMarkdown does not currently emit stable heading ids, so source links
  // intentionally open the document rather than a misleading fragment URL.
  return `/bzm/${encodeURIComponent(slug)}`;
}

function loadTheoryNodes(): { nodes: TheoryNode[]; errors: string[] } {
  const dir = theoryGraphDir();
  if (!fs.existsSync(dir)) return { nodes: [], errors: [`理論マップのディレクトリが見つからない: ${dir}`] };

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const nodes: TheoryNode[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      nodes.push(parseTheoryNode(raw, filePath));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { nodes, errors };
}

export default async function BzmTheoryMapPage() {
  const { nodes, errors } = loadTheoryNodes();

  let mapNodes: TheoryMapNode[] = [];
  let edges: ReturnType<typeof buildTheoryGraph>["edges"] = [];
  const buildErrors: string[] = [...errors];

  try {
    const graph = buildTheoryGraph(nodes);
    edges = graph.edges;
    mapNodes = graph.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      kind: node.kind,
      layer: node.layer,
      status: node.status,
      summary: node.summary,
      sourceRef: node.sourceRef,
      sourceHref: resolveSourceHref(node.sourceRef),
      body: node.body,
    }));
  } catch (error) {
    buildErrors.push(error instanceof Error ? error.message : String(error));
  }

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <BzmTheoryMapView nodes={mapNodes} edges={edges} errors={buildErrors} />
    </section>
  );
}
