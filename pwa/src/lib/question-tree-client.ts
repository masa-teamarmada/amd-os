/**
 * ゴールツリーのクライアント側キャッシュ層。
 *
 * 画面（ゴールツリータブ / ガントタブ / MS・月次のptリスト）は必ずここを通す。
 * 素の fetch を張ると、タブを行き来するたびに往復を払う（本番実測で 500〜700ms）。
 * 土台は src/lib/reference-data-cache.ts、規範は spec/5-10。
 *
 * 【分類】木そのものは編集する面なので純粋な参照系ではない。ただし
 * 書き込みAPIが必ず最新の束を返す作りなので、保存のたびにキャッシュを
 * その戻り値で置き換えれば、自分の書き込みが古く見えることはない。
 * 他の人の更新のために、TTLは参照系の既定（5分）より短い60秒にする。
 */

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { QuestionTreeBundle } from "@/lib/question-tree-types";

const PREFIX = "question-tree:";
/** 編集する面なので短め。他の人の更新は1分で入る */
const TTL_MS = 60_000;

const treeKey = (projectId: string) => `${PREFIX}${projectId}:tree`;
const pointsKey = (projectId: string) => `${PREFIX}${projectId}:points`;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload?.error || "読み込めなかったよ");
  return payload;
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描くために使う。 */
export function peekQuestionTree(projectId: string): QuestionTreeBundle | undefined {
  return peekReferenceData<QuestionTreeBundle>(treeKey(projectId), TTL_MS);
}

export function loadQuestionTree(
  projectId: string,
  options?: { force?: boolean },
): Promise<QuestionTreeBundle> {
  return loadReferenceData<QuestionTreeBundle>(
    treeKey(projectId),
    () => getJson<QuestionTreeBundle>(`/api/project/${projectId}/question-tree`),
    { ttlMs: TTL_MS, force: options?.force },
  );
}

/** タブに触れた時点で温める。クリックが届くまでの数百ミリ秒で取得が終わる。 */
export function prefetchQuestionTree(projectId: string): void {
  prefetchReferenceData(
    treeKey(projectId),
    () => getJson<QuestionTreeBundle>(`/api/project/${projectId}/question-tree`),
    { ttlMs: TTL_MS },
  );
}

/**
 * 書き込みAPIが返した最新の束で置き換える。
 * これがあるので、保存直後に自分の変更が古く見えることはない。
 */
export function putQuestionTree(projectId: string, bundle: QuestionTreeBundle): void {
  void loadReferenceData(treeKey(projectId), () => Promise.resolve(bundle), {
    ttlMs: TTL_MS,
    force: true,
  });
  // ptリストは木の内容から作るので、木が変わったら捨てる。
  invalidateReferenceData(pointsKey(projectId));
}

export function peekGoalTreePoints<T>(projectId: string): T | undefined {
  return peekReferenceData<T>(pointsKey(projectId), TTL_MS);
}

export function loadGoalTreePoints<T>(projectId: string, options?: { force?: boolean }): Promise<T> {
  return loadReferenceData<T>(
    pointsKey(projectId),
    () => getJson<T>(`/api/project/${projectId}/question-tree?view=points`),
    { ttlMs: TTL_MS, force: options?.force },
  );
}

export function invalidateQuestionTree(projectId?: string): void {
  invalidateReferenceData(projectId ? `${PREFIX}${projectId}` : PREFIX);
}

/**
 * 木への書き込み。画面は必ずここを通す（素の fetch を張ると、キャッシュが
 * 古いまま残る）。API が最新の束を返したら、その場でキャッシュを置き換える。
 * 失敗は例外で返すので、呼び手はメッセージをそのまま出せる。
 */
export async function mutateQuestionTree(
  projectId: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<{ id?: string | null; bundle?: QuestionTreeBundle; applied?: unknown }> {
  const response = await fetch(`/api/project/${projectId}/question-tree`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    id?: string | null;
    bundle?: QuestionTreeBundle;
    applied?: unknown;
    error?: string;
  };
  if (!response.ok) throw new Error(payload?.error || "保存できなかったよ");
  if (payload.bundle) putQuestionTree(projectId, payload.bundle);
  return payload;
}
