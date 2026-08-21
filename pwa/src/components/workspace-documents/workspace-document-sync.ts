/**
 * 資料室の一覧タブと、別タブで開いた編集ページの同期。
 *
 * 編集は別タブで完結するので、保存しても元の一覧タブは古いままになる。
 * 同一オリジンの BroadcastChannel で「この資料が変わった」とだけ伝え、
 * 受け取った一覧が自分で読み直す。本文は載せない (5MB を配る意味がない)。
 */

export const WORKSPACE_DOCUMENT_SYNC_CHANNEL = "amd-os-workspace-documents";

export type WorkspaceDocumentSyncMessage = {
  type: "document-updated";
  documentId: string;
};

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(WORKSPACE_DOCUMENT_SYNC_CHANNEL);
  } catch {
    return null;
  }
}

export function broadcastWorkspaceDocumentUpdated(documentId: string) {
  const channel = openChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: "document-updated", documentId } satisfies WorkspaceDocumentSyncMessage);
  } finally {
    channel.close();
  }
}

/** 購読を開始する。戻り値を呼ぶと購読を止める (useEffect の cleanup にそのまま渡せる)。 */
export function subscribeWorkspaceDocumentUpdates(
  handler: (message: WorkspaceDocumentSyncMessage) => void,
): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  const listener = (event: MessageEvent) => {
    const data = event.data as WorkspaceDocumentSyncMessage | null;
    if (!data || data.type !== "document-updated") return;
    if (typeof data.documentId !== "string" || !data.documentId) return;
    handler(data);
  };
  channel.addEventListener("message", listener);
  return () => {
    channel.removeEventListener("message", listener);
    channel.close();
  };
}
