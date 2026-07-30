/**
 * Parser and types for pwa/bzm/theory-graph/*.md — one-node-per-Markdown-file
 * theory graph nodes for BZM 2.0 (see BZM_2_0_REVISION_REQUIREMENTS.md,
 * BOOK_DECISIONS.md D-062, book-a-ch-12.md). No external dependencies.
 */

export type TheoryNodeKind =
  | "concept"
  | "claim"
  | "measure"
  | "decision"
  | "source"
  | "question";

export type TheoryNodeLayer =
  | "cross-layer"
  | "evidence"
  | "diagnosis"
  | "prediction"
  | "decision"
  | "institution"
  | "portfolio";

export type TheoryNodeStatus =
  | "established"
  | "conditional"
  | "design-choice"
  | "hypothesis"
  | "refuted"
  | "unknown";

export type TheoryRelationType =
  | "defines"
  | "supports"
  | "challenges"
  | "refutes"
  | "depends_on"
  | "supersedes"
  | "operationalizes"
  | "tests"
  | "raises";

export const THEORY_NODE_KINDS: readonly TheoryNodeKind[] = [
  "concept",
  "claim",
  "measure",
  "decision",
  "source",
  "question",
];

export const THEORY_NODE_LAYERS: readonly TheoryNodeLayer[] = [
  "cross-layer",
  "evidence",
  "diagnosis",
  "prediction",
  "decision",
  "institution",
  "portfolio",
];

export const THEORY_NODE_STATUSES: readonly TheoryNodeStatus[] = [
  "established",
  "conditional",
  "design-choice",
  "hypothesis",
  "refuted",
  "unknown",
];

export const THEORY_RELATION_TYPES: readonly TheoryRelationType[] = [
  "defines",
  "supports",
  "challenges",
  "refutes",
  "depends_on",
  "supersedes",
  "operationalizes",
  "tests",
  "raises",
];

export interface TheoryRelation {
  type: TheoryRelationType;
  target: string;
}

export interface TheoryNode {
  id: string;
  title: string;
  kind: TheoryNodeKind;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  summary: string;
  sourceRef: string;
  relations: TheoryRelation[];
  body: string;
  filePath: string;
}

export interface TheoryEdge {
  from: string;
  type: TheoryRelationType;
  to: string;
}

export interface TheoryGraph {
  nodes: TheoryNode[];
  edges: TheoryEdge[];
}

export class TheoryGraphParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TheoryGraphParseError";
  }
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const RELATIONS_HEADER_PATTERN = /^relations:\s*$/;
const RELATION_TYPE_PATTERN = /^\s*-\s*type:\s*(\S+)\s*$/;
const RELATION_TARGET_PATTERN = /^\s*target:\s*(\S+)\s*$/;
const SCALAR_PATTERN = /^([A-Za-z_]+):\s*(.*)$/;

const REQUIRED_SCALAR_FIELDS = [
  "id",
  "title",
  "kind",
  "layer",
  "status",
  "summary",
  "source_ref",
] as const;

/**
 * Parses a single theory-graph node file. The frontmatter format is a
 * deliberately narrow YAML subset (flat scalars plus one `relations:` list
 * of `{type, target}` pairs) so this can be parsed without a YAML dependency.
 */
export function parseTheoryNode(raw: string, filePath: string): TheoryNode {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new TheoryGraphParseError(`${filePath}: frontmatter delimiter (---) not found`);
  }
  const [, frontmatter, body] = match;
  const lines = frontmatter.split(/\r?\n/);

  const scalars: Record<string, string> = {};
  const relations: TheoryRelation[] = [];
  let inRelations = false;
  let pendingType: string | null = null;

  for (const line of lines) {
    if (line.trim() === "") continue;

    if (RELATIONS_HEADER_PATTERN.test(line)) {
      inRelations = true;
      continue;
    }

    if (inRelations) {
      const typeMatch = line.match(RELATION_TYPE_PATTERN);
      if (typeMatch) {
        pendingType = typeMatch[1];
        continue;
      }
      const targetMatch = line.match(RELATION_TARGET_PATTERN);
      if (targetMatch && pendingType) {
        relations.push({ type: pendingType as TheoryRelationType, target: targetMatch[1] });
        pendingType = null;
        continue;
      }
      inRelations = false;
    }

    const scalarMatch = line.match(SCALAR_PATTERN);
    if (scalarMatch) {
      scalars[scalarMatch[1]] = stripQuotes(scalarMatch[2]);
    }
  }

  if (pendingType) {
    throw new TheoryGraphParseError(
      `${filePath}: relation type "${pendingType}" is missing a target`
    );
  }

  for (const field of REQUIRED_SCALAR_FIELDS) {
    if (!scalars[field]) {
      throw new TheoryGraphParseError(`${filePath}: missing frontmatter field "${field}"`);
    }
  }

  if (!isOneOf(THEORY_NODE_KINDS, scalars.kind)) {
    throw new TheoryGraphParseError(`${filePath}: invalid kind "${scalars.kind}"`);
  }
  if (!isOneOf(THEORY_NODE_LAYERS, scalars.layer)) {
    throw new TheoryGraphParseError(`${filePath}: invalid layer "${scalars.layer}"`);
  }
  if (!isOneOf(THEORY_NODE_STATUSES, scalars.status)) {
    throw new TheoryGraphParseError(`${filePath}: invalid status "${scalars.status}"`);
  }
  for (const relation of relations) {
    if (!isOneOf(THEORY_RELATION_TYPES, relation.type)) {
      throw new TheoryGraphParseError(
        `${filePath}: invalid relation type "${relation.type}" (target ${relation.target})`
      );
    }
  }

  return {
    id: scalars.id,
    title: scalars.title,
    kind: scalars.kind,
    layer: scalars.layer,
    status: scalars.status,
    summary: scalars.summary,
    sourceRef: scalars.source_ref,
    relations,
    body: body.trim(),
    filePath,
  };
}

/**
 * Builds the edge list from a set of already-parsed nodes, validating that
 * every relation target resolves to a known node id.
 */
export function buildTheoryGraph(nodes: TheoryNode[]): TheoryGraph {
  const ids = new Set<string>();
  const edges: TheoryEdge[] = [];

  for (const node of nodes) {
    if (ids.has(node.id)) {
      throw new TheoryGraphParseError(`duplicate theory node id "${node.id}"`);
    }
    ids.add(node.id);
  }

  for (const node of nodes) {
    const relationKeys = new Set<string>();
    for (const relation of node.relations) {
      if (!ids.has(relation.target)) {
        throw new TheoryGraphParseError(
          `${node.filePath}: relation target "${relation.target}" does not exist among parsed nodes`
        );
      }
      const relationKey = `${relation.type}\u0000${relation.target}`;
      if (relationKeys.has(relationKey)) {
        throw new TheoryGraphParseError(
          `${node.filePath}: duplicate relation "${relation.type}" -> "${relation.target}"`
        );
      }
      relationKeys.add(relationKey);
      edges.push({ from: node.id, type: relation.type, to: relation.target });
    }
  }

  return { nodes, edges };
}
