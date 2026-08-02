#!/usr/bin/env node
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = read("scripts/migrations/203_bzm_theory_editor.sql");
const resetMigration = read("scripts/migrations/208_bzm_theory_map_user_authored_reset.sql");
const memoMigration = read("scripts/migrations/214_bzm_theory_node_memos.sql");
const positionMigration = read("scripts/migrations/220_bzm_theory_node_positions.sql");
const graph = read("src/lib/bzm-theory-graph.ts");
const store = read("src/lib/bzm-theory-store.ts");
const api = read("src/app/api/bzm/theory-map/route.ts");
const view = read("src/components/bzm/BzmTheoryMapView.tsx");
const composer = read("src/components/bzm/BzmTheoryComposerDialog.tsx");
const markdown = read("src/components/bzm/BzmMarkdown.tsx");
const uiLib = read("src/lib/bzm-theory-map-ui.ts");

for (const value of [
  "concept", "claim", "measure", "decision", "source", "question",
  "cross-layer", "evidence", "diagnosis", "prediction", "institution", "portfolio",
  "established", "conditional", "design-choice", "hypothesis", "refuted", "unknown",
  "defines", "supports", "challenges", "refutes", "depends_on", "supersedes",
  "operationalizes", "tests", "raises",
]) {
  assert.ok(migration.includes(`'${value}'`), `migration allowlist missing ${value}`);
}

const nodeSeedSection = migration.split("-- Seed: 21 nodes")[1].split("-- Seed: 34 relations")[0];
const edgeSeedSection = migration.split("-- Seed: 34 relations")[1];
assert.equal((nodeSeedSection.match(/\n\(\n  '[^']+'/g) ?? []).length, 21, "migration must seed 21 nodes");
assert.equal((edgeSeedSection.match(/\('[^']+', '[^']+', '[^']+', 'seed'\)/g) ?? []).length, 34, "migration must seed 34 edges");
assert.match(nodeSeedSection, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(edgeSeedSection, /ON CONFLICT \(from_node_id, relation_type, to_node_id\) DO NOTHING/);
assert.match(migration, /public\.is_admin\(\)/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /bzm_theory_edges_value_limits/);
assert.match(migration, /from_node_id <> to_node_id/);
assert.match(migration, /validate_bzm_theory_edge/);
assert.match(migration, /raises edge target must be an active question node/);
assert.match(migration, /validate_bzm_theory_node_kind/);
assert.match(
  resetMigration,
  /DELETE FROM public\.bzm_theory_edges;[\s\S]*DELETE FROM public\.bzm_theory_nodes;/,
  "user-authored reset must delete edges before nodes"
);

// ---------------------------------------------------------------------------
// migration 214: bzm_theory_node_memos — empty table, node/edge/memo concept
// separation. Must not touch existing node/edge/seed data.
// ---------------------------------------------------------------------------
assert.match(memoMigration, /CREATE TABLE IF NOT EXISTS public\.bzm_theory_node_memos/);
assert.match(
  memoMigration,
  /node_id text NOT NULL REFERENCES public\.bzm_theory_nodes\(id\) ON DELETE CASCADE/,
  "memo table must FK to bzm_theory_nodes with cascade delete"
);
for (const memoType of ["supports", "challenges", "refutes", "raises", "tests"]) {
  assert.ok(memoMigration.includes(`'${memoType}'`), `memo migration allowlist missing ${memoType}`);
}
assert.match(memoMigration, /char_length\(btrim\(body\)\) BETWEEN 1 AND 2000/, "memo body must be CHECK-bound to 1..2000 chars");
assert.match(memoMigration, /ENABLE ROW LEVEL SECURITY/);
assert.match(memoMigration, /bzm_theory_node_memos_select_active/);
assert.match(memoMigration, /public\.is_admin\(\)/);
assert.match(memoMigration, /bzm_theory_node_memos_service/);
assert.match(memoMigration, /TO service_role/);
assert.match(memoMigration, /idx_bzm_theory_node_memos_node_id/);
assert.match(memoMigration, /idx_bzm_theory_node_memos_memo_type/);
assert.doesNotMatch(
  memoMigration,
  /DELETE FROM|UPDATE public\.bzm_theory_nodes|UPDATE public\.bzm_theory_edges|INSERT INTO public\.bzm_theory_nodes|INSERT INTO public\.bzm_theory_edges/,
  "migration 214 must only create the memo table, not touch existing node/edge data"
);

// Position migration is strictly structural: existing user-authored nodes are
// never backfilled or rearranged by DDL.
assert.match(positionMigration, /ADD COLUMN IF NOT EXISTS position_x double precision/);
assert.match(positionMigration, /ADD COLUMN IF NOT EXISTS position_y double precision/);
assert.doesNotMatch(positionMigration, /\bUPDATE\b|\bINSERT\b|\bDELETE\b/);

// bzm-theory-graph.ts must define the memo type vocabulary independently of
// the 9 edge relation types (memo is not an edge).
assert.match(graph, /export type TheoryMemoType/);
assert.match(graph, /export const THEORY_MEMO_TYPES/);
for (const memoType of ["supports", "challenges", "refutes", "raises", "tests"]) {
  assert.ok(graph.includes(`"${memoType}"`), `THEORY_MEMO_TYPES missing ${memoType}`);
}

assert.match(api, /requireMember\(\)/, "GET must authenticate an AMD member");
assert.equal((api.match(/requireAdmin\(\)/g) ?? []).length, 3, "all three mutation methods must require admin");
assert.match(api, /function isRecord\(value: unknown\)/, "mutation JSON bodies must reject null and arrays");
assert.match(api, /"create_memo"/, "POST must support the create_memo action");
assert.match(api, /createMemo\(db, body, auth\.user\.email\)/, "create_memo action must call the store's createMemo");
for (const contract of [
  "createNodeWithOptionalEdge", "createEdge", "createMemo", "updateNode", "deleteEdge",
  "compensation delete failed", "UUID_PATTERN", "THEORY_RELATION_TYPES", "THEORY_MEMO_TYPES",
]) {
  assert.ok(store.includes(contract), `store contract missing ${contract}`);
}
assert.doesNotMatch(store, /loadMarkdownTheoryMap|falling back to markdown/);
assert.match(store, /storageMode: "unavailable"/);
assert.match(store, /MEMOS_TABLE = "bzm_theory_node_memos"/);
assert.match(store, /memos: TheoryMapMemoDTO\[\]/, "loadTheoryMap result must carry memos alongside nodes/edges");
assert.doesNotMatch(
  store,
  /select\("id,node_id,memo_type,body,created_by,created_at"\)/,
  "created_by is audit metadata and must not be exposed in the memo API payload"
);
assert.doesNotMatch(uiLib, /createdBy/, "memo UI DTO must not carry unused author identity");

// createMemo must only ever insert into the memo table — never create a node
// or an edge as a side effect (this is exactly the bug being fixed: memo
// creation used to fabricate 1 node + 1 edge per memo).
const createMemoBody = store.split("export async function createMemo")[1]?.split("/** ノード更新")[0] ?? "";
assert.ok(createMemoBody.length > 0, "createMemo function body must be present");
assert.match(createMemoBody, /\.from\(MEMOS_TABLE\)\s*\n\s*\.insert/, "createMemo must insert into MEMOS_TABLE");
assert.doesNotMatch(
  createMemoBody,
  /\.from\(NODES_TABLE\)\.insert|\.from\(EDGES_TABLE\)\.insert/,
  "createMemo must never insert a node or an edge — memo is not 1 node + 1 edge"
);

// ---------------------------------------------------------------------------
// bzm-theory-map-ui.ts: the wrong "1 memo = 1 node + 1 edge" helpers must be
// gone. Memo role labels/colors are a distinct, edge-independent vocabulary.
// ---------------------------------------------------------------------------
assert.doesNotMatch(
  uiLib,
  /relationRoleDefaults|relationDirection|deriveNoteTitle|RELATION_ROLE_OPTIONS/,
  "the retracted 1-memo=1-node+1-edge helpers must not remain anywhere in the shared UI lib"
);
assert.match(uiLib, /export const MEMO_TYPE_OPTIONS/);
assert.match(uiLib, /export const MEMO_TYPE_LABEL/);
assert.match(uiLib, /export function parseTheoryMapMemoDto/);

for (const label of [
  "ここから、まさの理論マップが始まる", "メモを追加",
  "⌘＋次のノードで即接続", "⌘＋クリックで2つ選ぶと接続", "メモ", "接続しているノード",
]) {
  assert.ok(view.includes(label) || composer.includes(label), `editor UI missing ${label}`);
}
assert.doesNotMatch(view, /関連メモ/, "the edge list must not be labeled 関連メモ — that conflates edges with memos");
assert.doesNotMatch(
  view,
  /anchorGraphPoint/,
  "memo composer must anchor from the selected node itself; pre-offsetting the anchor can cover the target node"
);
assert.match(
  view,
  /graph2ScreenCoords\(\s*sourcePoint\.x,\s*sourcePoint\.y,/,
  "memo composer must preserve the selected node coordinate before applying the shared node gap"
);
for (const contract of [
  "onBackgroundClick", "onNodeDragEnd", "onLinkClick", "handleNodeDragEnd", "handleNodeClick",
  "suppressNextBackgroundClick", "draggedNodeClickRef", "event.metaKey || event.ctrlKey",
  "setConnectingFromId", "openDraftComposer", 'data-bzm-map-panel=',
  "KIND_COLOR", "createDirectEdge", "parseTheoryMapEdgeDto", "connectingPending", "stableHash",
  "size.h, size.w", "fallbackMapPosition", "screen2GraphCoords", "draftNode", "draftId",
  "pendingEdge", "setPendingEdge(optimisticEdge)", "clippedLinkPoints", "nodeBoundaryDistance",
  'linkCanvasObject={drawClippedLink}', 'data-bzm-map-overlay-host="composer"',
  "composerAnchor.y", "composerOverlayStyle", "openMemoComposer",
  "onMemoCreated", "parseTheoryMapMemoDto",
]) {
  assert.ok(view.includes(contract) || composer.includes(contract), `direct-manipulation contract missing ${contract}`);
}
assert.match(view, /positionX: dragged\.x, positionY: dragged\.y/, "node drag must persist the exact dropped coordinates");
assert.match(view, /if \(dragged\.draft \|\| !Number\.isFinite\(dragged\.x\)/, "draft nodes must never be persisted through the position PATCH");
assert.match(view, /fallbackMapPosition\(n\)/, "legacy null positions need a deterministic client-only fallback");
assert.doesNotMatch(view, /initialPositionById|createLayerForce/, "reload placement must not return to the layer-based vertical column force");
assert.match(store, /position_x,position_y/, "store must load persistent map coordinates");
assert.match(store, /optionalMapPosition/, "server must validate map coordinates");
assert.match(composer, /positionX: draftPosition\?\.x/, "new node creation must save its clicked draft coordinate");
// 2026-08-02 right-ledger removal: the permanent selected-node read/ledger
// panel (title/summary/source/body preview, coverage-gap warning, memo list,
// per-row edge delete list) is gone. Node detail reading/editing lives only
// in the map-internal edit overlay; the map now owns the full width.
assert.doesNotMatch(
  view,
  /function MemoList|function ConnectedNodesList|memosForSelected|relatedEdges|incomingForSelected|outgoingForSelected/,
  "the removed right-side node ledger components/state must not remain"
);
assert.doesNotMatch(
  view,
  /data-bzm-edge-row-delete/,
  "the retired per-row edge delete button in the removed right ledger must not remain"
);
assert.doesNotMatch(
  view,
  /_380px\]|カバレッジの欠落/,
  "the map must not reserve a fixed-width column for a permanent ledger, nor show the retired coverage-gap panel"
);
assert.doesNotMatch(view, /理論を書く|このノードを育てる|既存ノードとつなぐ/);
assert.doesNotMatch(view, /openGrowComposer|relationRoleDefaults|type: "grow"/, "the retracted grow (1 memo = 1 node + 1 edge) flow must not remain");
assert.doesNotMatch(view, /nearestDistance|overlapDistance/, "dragging must not create an edge");
assert.doesNotMatch(view, /fillText\(KIND_/, "node centers must not contain kind glyphs");
assert.doesNotMatch(
  view,
  /data-bzm-draft-node/,
  "the draft node must render only through the canvas, not a duplicate HTML marker"
);
assert.doesNotMatch(
  view,
  /\bdraftVisual\b/,
  "the HTML draft marker's derived variable must be removed with the marker itself"
);
assert.match(
  view,
  /setPendingEdge\(optimisticEdge\);[\s\S]*?await callTheoryMapApi/,
  "the edge must become visible before persistence completes"
);

// Adding a memo must never touch nodes/edges state — nodes/edges counts must
// stay unchanged after a memo add (the concept fix this test locks in).
const memoHandlerMatch = view.match(/onMemoCreated=\{\(memo\) => \{([\s\S]*?)\n\s*\}\}/);
assert.ok(memoHandlerMatch, "view must wire an onMemoCreated handler on the composer");
const memoHandlerBody = memoHandlerMatch[1];
assert.doesNotMatch(
  memoHandlerBody,
  /setNodes\(|setEdges\(/,
  "adding a memo must not mutate nodes/edges state — memo count is independent of node/edge count"
);
assert.match(memoHandlerBody, /setMemos\(/, "adding a memo must append to memos state only");

// draftNode() (blank-click node creation) must not carry memo-role defaults
// any more — memo composer never creates a draft node.
assert.doesNotMatch(view, /function draftNode\([^)]*noteRelationType/, "draftNode must no longer branch on a memo relation type");

assert.match(composer, /role="dialog"/);
assert.match(composer, /aria-modal="false"/);
assert.match(composer, /data-bzm-map-panel="composer"/);
assert.match(composer, /data-bzm-map-overlay="composer"/, "composer must float inside the map");
assert.match(composer, /下書きノードをマップに作成済み/);
assert.match(composer, /onDraftChange\(state\.draftId, form\)/);
assert.doesNotMatch(composer, /type: "connect"|mode === "connect"|接続先ノードを検索|既存ノードとつなぐ/);
assert.doesNotMatch(composer, />\s*つなぐ\s*</, "direct node connection must not require a confirmation button");
assert.doesNotMatch(
  composer,
  /"support" \| "challenge" \| "question"/,
  "memo mode must let the user choose a role, not a fixed 3-button preset"
);
assert.doesNotMatch(
  composer,
  /RELATION_ROLE_OPTIONS|relationRoleDefaults|relationDirection|deriveNoteTitle|type: "grow"/,
  "the retracted grow (1 memo = 1 node + 1 edge) contract must not remain in the composer"
);
assert.doesNotMatch(composer, /接続のプレビュー/, "memo has no edge, so it must not show a connection-direction preview");
assert.match(composer, /MEMO_TYPE_OPTIONS/, "memo mode must offer the shared memo role picker");
assert.match(composer, /"create_memo"/, "composer must call the create_memo action, not create_node");
assert.match(composer, /type: "memo"; node: TheoryMapNode/, "ComposerState must carry the target node, not a draft node id, for memo mode");
assert.match(composer, /sourceRef: form\.sourceRef,/);
assert.match(composer, /requiredTextMissing/);
assert.match(
  composer,
  /showSourceRef=\{mode === "create" \|\| form\.kind === "source"\}/,
  "new-node creation must always expose its optional reference-link field, regardless of kind"
);
assert.match(
  composer,
  /参考リンク（任意）/,
  "the create-mode sourceRef field must use the concise optional-link label"
);
assert.match(
  composer,
  /URL・DOI・書誌情報/,
  "the reference-link input must keep a short, useful placeholder"
);

// ---------------------------------------------------------------------------
// small node inspector (2026-08-02): no giant "ノードを編集" heading, kind
// picker collapses from a 6-card radiogroup to a single select, the panel
// scrolls internally inside the map viewport, clicking another node while the
// composer is open switches straight to that node's editor (discarding any
// in-flight create draft), and a background click while the composer is open
// only closes it — it must never fabricate a draft node on that same click.
// ---------------------------------------------------------------------------
assert.doesNotMatch(composer, /ノードを編集/, "the edit-mode heading must be fully removed, not replaced by another heading");
assert.doesNotMatch(composer, /role="radiogroup"/, "the 6-card kind picker must be gone");
assert.doesNotMatch(composer, /KIND_OPTIONS/, "the kind card option list must be gone");
assert.match(composer, /data-bzm-kind-select/, "kind must be selectable via a single <select>");
assert.match(composer, /data-bzm-composer-scroll/, "the composer body must be an explicit internal scroll region");
assert.match(composer, /data-bzm-composer-drag-handle="true"/, "composer must expose a dedicated drag handle");
assert.match(composer, /function startHeaderDrag/, "composer drag must be pointer-driven from the header only");
assert.doesNotMatch(composer, /aria-label="閉じる"|<X\b/, "the close X must be removed; outside-map click closes the panel");
assert.match(composer, /function NodeReadMode/, "existing nodes must first render a display mode");
assert.match(composer, /onEdit=\{\(\) => setEditing\(true\)\}/, "only an explicit edit action may enter the editor");
assert.match(composer, /<BzmMarkdown source=\{node\.body\} compact/, "read mode must render Markdown and KaTeX body content");
assert.match(composer, /whitespace-pre-wrap[^>]*><BzmMathText source=\{memo\.body\}/, "memo line breaks must remain visible while math renders");
assert.match(view, /memos=\{memos\}/, "read mode must receive current node memos");
assert.match(view, /if \(composerState && composerState\.type === "create"\)\s*\n\s*discardDraft\(composerState\.draftId\);\s*\n\s*openEditComposer/, "clicking another node while a create draft is open must discard the draft before switching");
assert.doesNotMatch(view, /if \(composerState\) return;\s*\n\s*if \(draggedNodeClickRef/, "a normal node click must not be blocked just because the composer is open");
assert.match(view, /if \(composerState\) \{\s*\n\s*closeComposer\(\);\s*\n\s*return;\s*\n\s*\}/, "a background click while the composer is open must close it and return without creating a draft");

// Regression: Cmd/Ctrl+click on another node while a *create* draft composer
// is open used to call setComposerState(null) directly, which cleared the
// composer state but left the draft node orphaned in nodes/nodePositions
// (never removed via discardDraft). The modifier (connect) branch must reuse
// closeComposer(), which discards a create draft before entering connect
// mode; a bare setComposerState(null) must not remain in that branch.
const handleNodeClickBody =
  view.split("function handleNodeClick(node: GraphNode, event: MouseEvent) {")[1]
    ?.split(/\n  useEffect\(\(\) => {\n    if \(!notice\)/)[0] ?? "";
assert.ok(handleNodeClickBody.length > 0, "handleNodeClick function body must be present");
const modifierBranch =
  handleNodeClickBody.split(/if \(canEdit && modifierPressed\) \{/)[1]?.split(/\n    \}\n\n    setConnectingFromId\(null\);/)[0] ?? "";
assert.ok(modifierBranch.length > 0, "handleNodeClick must have a canEdit && modifierPressed branch");
assert.match(
  modifierBranch,
  /closeComposer\(\);/,
  "the Cmd/Ctrl connect branch must call closeComposer() so an in-flight create draft is discarded, not just setComposerState(null)",
);
assert.doesNotMatch(
  modifierBranch,
  /setComposerState\(null\)/,
  "the Cmd/Ctrl connect branch must not clear composer state directly — that orphans a create-mode draft node in nodes/nodePositions",
);

// ---------------------------------------------------------------------------
// desktop composer geometry (2026-08-02 follow-up): maxHeight must be derived
// from the confirmed `top`, not a fixed `size.h - 24`. A fixed maxHeight lets
// top + maxHeight exceed the viewport whenever top > 12, clipping the panel's
// bottom under the parent's overflow and defeating the internal scroll
// contract (the scroll region never sees its real visible height).
// ---------------------------------------------------------------------------
const desktopComposerGeometry =
  view.split("const panelWidth = Math.min(360, size.w - 24);")[1]?.split("})();")[0] ?? "";
assert.ok(desktopComposerGeometry.length > 0, "desktop composer geometry IIFE body must be present");
assert.doesNotMatch(
  desktopComposerGeometry,
  /maxHeight:\s*size\.h\s*-\s*24/,
  "maxHeight must not be a viewport-fixed constant independent of the computed top",
);
assert.match(
  desktopComposerGeometry,
  /const maxHeight = Math\.max\(180, bandBottom - top - 12\);/,
  "maxHeight must be derived from the confirmed top inside the live viewport band, guaranteeing top + maxHeight <= bandBottom - 12",
);
assert.match(
  desktopComposerGeometry,
  /return \{ left, top, width: panelWidth, maxHeight \};/,
  "the returned style must use the top-derived maxHeight, not a separate viewport-fixed value",
);

// ---------------------------------------------------------------------------
// Live-viewport clamp (2026-08-02, v3.54.17): the map element's own height
// (size.h) is NOT the visible height. With the page scrolled / a tall header
// above the map, a composer laid out against size.h runs off the bottom of the
// browser viewport — measured in production at 1547x831, a blank lower-area
// click produced a composer rect of top 586 / bottom 1008 (177px below the
// window). The overlay must instead be clamped to window.innerHeight mapped
// into the map element's local coordinates (viewportBand), with a 12px margin,
// while keeping the composer inside the map overlay and preserving the
// dialog's internal scroll region.
// ---------------------------------------------------------------------------
assert.match(
  view,
  /const \[viewportBand, setViewportBand\] = useState\(\{ top: 0, bottom: 600 \}\)/,
  "the map view must track a live viewport band in map-local coordinates"
);
assert.match(
  view,
  /const innerHeight = window\.innerHeight \|\| rect\.height;/,
  "the band must be measured from the real browser viewport height, not the map element height"
);
assert.match(
  view,
  /setViewportBand\(\{\s*top: Math\.max\(0, -rect\.top\),\s*bottom: Math\.min\(rect\.height, innerHeight - rect\.top\),\s*\}\);/,
  "the band must be window.innerHeight projected through the map element's viewport rect"
);
assert.match(
  view,
  /window\.addEventListener\("scroll", update, true\);/,
  "page/ancestor scrolling moves the map rect, so the band must be re-measured on scroll"
);
assert.match(
  view,
  /window\.removeEventListener\("scroll", update, true\);/,
  "the scroll listener must be removed on cleanup"
);
assert.match(
  view,
  /const visibleTop = Math\.max\(0, Math\.min\(viewportBand\.top, size\.h\)\);/,
  "the band top must be clamped into the map element"
);
assert.match(
  view,
  /const visibleBottom = Math\.max\(\s*visibleTop,\s*Math\.min\(size\.h, viewportBand\.bottom\),\s*\);/,
  "the band bottom must be clamped into the map element and never invert"
);
assert.match(
  view,
  /const visibleHeight = Math\.max\(204, visibleBottom - visibleTop\);/,
  "the band must always reserve the 180px minimum panel height plus the 12px top/bottom margins"
);
assert.match(
  view,
  /const bandBottom = visibleTop \+ visibleHeight;/,
  "the usable bottom edge must come from the band, not size.h"
);
assert.match(
  desktopComposerGeometry,
  /const top = Math\.max\(visibleTop \+ 12, Math\.min\(bandBottom - 180, baseTop \+ composerOffset\.y\)\);/,
  "dragging must still clamp the desktop composer into the visible band"
);
assert.doesNotMatch(
  desktopComposerGeometry,
  /size\.h/,
  "the desktop composer geometry must no longer reference the map element height for vertical placement"
);

const mobileComposerGeometry =
  view.split("const composerOverlayStyle: React.CSSProperties =")[1]?.split("      : (() => {")[0] ?? "";
assert.ok(mobileComposerGeometry.length > 0, "mobile composer geometry branch must be present");
assert.match(
  mobileComposerGeometry,
  /top: Math\.max\(visibleTop \+ 12, Math\.min\(bandBottom - 180, visibleTop \+ 12 \+ composerOffset\.y\)\)/,
  "the mobile top-anchored composer must sit at the band top plus the 12px margin"
);
assert.match(
  mobileComposerGeometry,
  /bottom: Math\.max\(12, size\.h - bandBottom \+ 12 - composerOffset\.y\)/,
  "the mobile bottom-anchored composer must offset by however much of the map lies below the visible band"
);
assert.match(
  mobileComposerGeometry,
  /maxHeight: Math\.max\(180, visibleHeight \/ 2 - 28\)/,
  "the mobile composer height must derive from the visible band height, not size.h"
);

// The clamp must not regress the two contracts shipped just before it: the
// composer still lives inside the map overlay (no portal to document.body) and
// the dialog keeps its own internal scroll region.
assert.match(
  view,
  /data-bzm-map-overlay-host="composer"[\s\S]{0,200}style=\{composerOverlayStyle\}/,
  "the clamped composer must remain an in-map overlay host driven by composerOverlayStyle"
);
assert.doesNotMatch(
  view,
  /createPortal/,
  "the composer must stay inside the map overlay, not escape to a body-level portal"
);

// ---------------------------------------------------------------------------
// Production browser measurement (2026-08-02, same-day follow-up): even with
// the top-derived host maxHeight above, the composer's child <aside> capped
// itself with the Tailwind class max-h-full (= max-height: 100%). A
// percentage max-height only resolves against an ancestor with an explicit
// (non-auto) height; the host div is position:absolute with only an inline
// maxHeight (not height) set, so the child's 100% resolved to none and the
// panel grew to its full content height (849px measured vs. the host's
// 348px), overflowing the host and defeating the internal scroll region.
// The child must instead set maxHeight: "inherit" so it takes on the host's
// own computed (pixel) max-height value.
// ---------------------------------------------------------------------------
assert.doesNotMatch(
  composer,
  /max-h-full/,
  "the composer <aside> must not rely on Tailwind's max-h-full (percentage max-height) to bound itself against the absolutely-positioned host",
);
assert.match(
  composer,
  /maxHeight:\s*"inherit"/,
  "the composer <aside> must set maxHeight: \"inherit\" so it takes on the host overlay's own computed (pixel) max-height, not a percentage that fails to resolve",
);

assert.ok(markdown.includes(String.raw`\[ ... \]`), "display math must support \\[...\\]");
assert.ok(markdown.includes(String.raw`\( ... \)`), "inline math must support \\(...\\)");
assert.match(view, /<BzmMathText source=\{selected\.title\}/);
assert.doesNotMatch(
  view,
  /<BzmMarkdown/,
  "the removed right ledger's read-only body renderer must not remain in the map view — body is read/edited via the composer overlay only"
);

// ---------------------------------------------------------------------------
// Node soft-delete (2026-08-02): admin-only recoverable delete via
// bzm_theory_nodes.archived_at (never a physical DELETE), exposed through
// DELETE ?nodeId= alongside the existing DELETE ?edgeId=, with an in-overlay
// confirm step (not an immediate delete) and a per-row edge delete
// affordance in the "接続しているノード" ledger.
// ---------------------------------------------------------------------------
assert.match(store, /export async function archiveNode/, "store must export an explicit archiveNode function");
assert.doesNotMatch(
  store,
  /dropping orphan (edge|memo)/,
  "retained rows for archived nodes are expected and must not emit load errors",
);
const archiveNodeBody = store.split("export async function archiveNode")[1]?.split("\nfunction rowToNodeDto")[0] ?? "";
assert.ok(archiveNodeBody.length > 0, "archiveNode function body must be present");
assert.match(
  archiveNodeBody,
  /archived_at: new Date\(\)\.toISOString\(\)/,
  "archiveNode must set archived_at, not physically delete the row"
);
assert.match(archiveNodeBody, /updated_by: actorEmail/, "archiveNode must record the acting admin as updated_by");
assert.match(
  archiveNodeBody,
  /\.is\("archived_at", null\)/,
  "archiveNode must only ever target an active (non-archived) node"
);
assert.doesNotMatch(
  archiveNodeBody,
  /\.delete\(\)/,
  "archiveNode must never physically DELETE the row — it is a recoverable soft-delete"
);

assert.match(api, /archiveNode/, "route must import/call the store's archiveNode");
const deleteHandlerBody = api.split("export async function DELETE")[1] ?? "";
assert.ok(deleteHandlerBody.length > 0, "DELETE handler body must be present");
assert.match(
  deleteHandlerBody,
  /hasEdgeId === hasNodeId/,
  "DELETE must reject when edgeId and nodeId are both present or both absent"
);
assert.match(deleteHandlerBody, /status: 400 \}/, "DELETE must 400 on the edgeId/nodeId exclusivity violation");
assert.match(
  deleteHandlerBody,
  /archiveNode\(db, nodeId \?\? "", auth\.user\.email\)/,
  "DELETE must call archiveNode with the authenticated admin's email"
);

// ---------------------------------------------------------------------------
// Composer: 44px vermilion delete trigger in edit-mode footer, switching to
// an in-overlay confirm (not an immediate delete, not a modal/menu).
// ---------------------------------------------------------------------------
assert.match(composer, /data-bzm-node-delete-trigger="true"/, "edit mode must expose a delete trigger button");
assert.match(
  composer,
  /data-bzm-node-delete-confirm="true"/,
  "the confirm screen must expose a distinct confirm-delete button"
);
assert.match(
  composer,
  /onNodeDeleted: \(nodeId: string\) => void/,
  "ComposerState props must carry an onNodeDeleted callback"
);
assert.match(
  composer,
  /getConnectionCount: \(nodeId: string\) => number/,
  "composer must accept a connection-count getter for the delete confirmation"
);
assert.match(
  composer,
  /getMemoCount: \(nodeId: string\) => number/,
  "composer must accept a memo-count getter for the delete confirmation"
);
assert.match(composer, /deleteConfirmOpen/, "composer must track a delete-confirmation UI state");
assert.match(
  composer,
  /setDeleteConfirmOpen\(false\)/,
  "the (re)open effect must reset delete confirmation state per the codebase's reset-on-prop-change pattern"
);

const deleteTriggerButtonBody =
  composer.split('data-bzm-node-delete-trigger="true"')[1]?.split("</button>")[0] ?? "";
assert.ok(deleteTriggerButtonBody.length > 0, "delete trigger button markup must be present");
assert.match(
  deleteTriggerButtonBody,
  /onClick=\{\(\) => setDeleteConfirmOpen\(true\)\}/,
  "the trigger button must only open the confirmation, never delete immediately"
);
assert.doesNotMatch(
  deleteTriggerButtonBody,
  /submitDelete/,
  "the trigger button must not call submitDelete directly — immediate delete is forbidden"
);

const submitDeleteBody = composer.split("async function submitDelete")[1]?.split("\n  function handleSubmit")[0] ?? "";
assert.ok(submitDeleteBody.length > 0, "submitDelete function body must be present");
assert.match(submitDeleteBody, /method: "DELETE"/);
assert.match(
  submitDeleteBody,
  /query: `\?nodeId=\$\{encodeURIComponent\(node\.id\)\}`/,
  "submitDelete must call DELETE ?nodeId="
);
assert.match(
  submitDeleteBody,
  /onNodeDeleted\(node\.id\)/,
  "submitDelete must report success back to the parent via onNodeDeleted"
);

assert.match(
  composer,
  /function DeleteConfirmFields/,
  "the delete confirmation must render node name, connection count, and memo count"
);
assert.match(composer, /connectionCount: number/);
assert.match(composer, /memoCount: number/);
assert.match(composer, /編集へ戻る/, "the confirm screen must offer a way back to editing without deleting");
assert.doesNotMatch(
  composer,
  /role="dialog"[\s\S]*?role="dialog"/,
  "the delete confirmation must reuse the composer's single overlay, not open a second dialog"
);

// ---------------------------------------------------------------------------
// Map view: wiring the node delete callback (onNodeDeleted removes the node,
// its incident edges on either endpoint, its memos, and its saved position,
// then closes the composer). The 2026-08-02 right-ledger removal retired the
// "接続しているノード" list's per-row edge delete button — edge deletion is
// line-click only now — so that contract is intentionally not tested here.
// ---------------------------------------------------------------------------
const nodeDeleteHandlerMatch = view.match(/onNodeDeleted=\{\(nodeId\) => \{([\s\S]*?)\n\s*\}\}/);
assert.ok(nodeDeleteHandlerMatch, "view must wire an onNodeDeleted handler on the composer");
const nodeDeleteHandlerBody = nodeDeleteHandlerMatch[1];
assert.match(nodeDeleteHandlerBody, /setNodes\(/, "deleting a node must remove it from nodes state");
assert.match(nodeDeleteHandlerBody, /setEdges\(/, "deleting a node must remove its incident edges from state");
assert.match(
  nodeDeleteHandlerBody,
  /edge\.from !== nodeId && edge\.to !== nodeId/,
  "deleting a node must drop edges on either endpoint, not just one direction"
);
assert.match(nodeDeleteHandlerBody, /setMemos\(/, "deleting a node must remove its memos from state");
assert.match(nodeDeleteHandlerBody, /memo\.nodeId !== nodeId/);
assert.match(
  nodeDeleteHandlerBody,
  /setNodePositions\(/,
  "deleting a node must remove its saved canvas position"
);
assert.match(nodeDeleteHandlerBody, /setSelectedId\(""\)/, "deleting a node must clear the current selection");
assert.match(nodeDeleteHandlerBody, /setComposerState\(null\)/, "deleting a node must close the composer overlay");

console.log("ok - BZM theory editor migration, auth, mutation and UI contracts passed");
