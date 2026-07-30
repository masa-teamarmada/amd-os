import { createClient } from "@/lib/supabase/server";
import { loadTheoryMap } from "@/lib/bzm-theory-store";
import { BzmTheoryMapView, type TheoryMapNode } from "@/components/bzm/BzmTheoryMapView";

/**
 * /bzm/map — 理論マップ (BZM 2.0 の論証台帳)。
 *
 * DB (bzm_theory_nodes / bzm_theory_edges) を正として bzm-theory-store 経由で読み、
 * DB未適用時やクエリ失敗時のみ pwa/bzm/theory-graph/*.md への読み取り専用フォールバックになる。
 */

export default async function BzmTheoryMapPage() {
  const supabase = await createClient();
  const [mapResult, authResult] = await Promise.all([
    loadTheoryMap(supabase),
    supabase.auth.getUser(),
  ]);
  const { storageMode, nodes, edges, errors } = mapResult;
  const { user } = authResult.data;

  let canEdit = false;
  if (user?.email) {
    const { data: member } = await supabase
      .from("members")
      .select("is_admin")
      .eq("email", user.email.toLowerCase())
      .single();
    canEdit = storageMode === "db" && Boolean(member?.is_admin);
  }

  const mapNodes: TheoryMapNode[] = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    kind: node.kind,
    layer: node.layer,
    status: node.status,
    summary: node.summary,
    sourceRef: node.sourceRef,
    sourceHref: node.sourceHref,
    body: node.body,
    editable: node.editable,
  }));

  const mapEdges = edges.map((edge) => ({
    from: edge.from,
    type: edge.type,
    to: edge.to,
    id: edge.id,
    note: edge.note,
    editable: edge.editable,
  }));

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <BzmTheoryMapView
        nodes={mapNodes}
        edges={mapEdges}
        errors={errors}
        storageMode={storageMode}
        canEdit={canEdit}
      />
    </section>
  );
}
