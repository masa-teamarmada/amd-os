/**
 * 参照系データのクライアント側キャッシュ (全画面共通の土台)。
 *
 * 【なぜ要るか】
 * モーダルやタブを開くたびに `fetch` を張り直すと、めったに変わらないデータでも
 * 毎回ネットワーク往復 + 認証 + DBクエリを払う。まさから繰り返し指摘されている
 * 「開くたびに待たされる」の正体はこれ。参照系 (読み取り専用・更新頻度が低い) の
 * データは、この土台を通して「一度読んだらプロセス内で使い回す」を既定にする。
 *
 * 【使い分け】
 * - 参照系 (マスタ、確定済み評価、ルーブリック、設定値) → このキャッシュを通す
 * - 可変系 (残高、進行中タスク、通知、編集中の下書き) → 通さず毎回読む
 *
 * 【破棄】
 * TTL 経過で自動的に読み直す。書き込み側の画面は保存直後に
 * `invalidateReferenceData(prefix)` を呼んで、次の読み取りで最新へ戻す。
 *
 * 全PJ共通の規範は /Users/masa/projects/AGENTS.common.reference.md「参照系データの体感速度」節。
 * PWA での適用範囲と guard は pwa/spec/5-10-reference-data-caching-current-spec.md。
 */

/** 既定TTL。参照系の想定更新頻度 (日〜週単位) に対して十分短い。 */
export const REFERENCE_DATA_DEFAULT_TTL_MS = 5 * 60 * 1000;

type Entry = { value: unknown; storedAt: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function isFresh(entry: Entry, ttlMs: number): boolean {
  return Date.now() - entry.storedAt < ttlMs;
}

/**
 * キャッシュ済みなら同期で返す。モーダルの初回描画を待たせないために使う
 * (`peek` で即描画 → `loadReferenceData` で裏で確認、が定型)。
 */
export function peekReferenceData<T>(key: string, ttlMs = REFERENCE_DATA_DEFAULT_TTL_MS): T | undefined {
  const entry = store.get(key);
  if (!entry || !isFresh(entry, ttlMs)) return undefined;
  return entry.value as T;
}

/**
 * キャッシュがあればそれを、無ければ `loader` を1回だけ走らせて返す。
 * 同じキーへ同時に来た呼び出しは1本のリクエストへ束ねる (single-flight)。
 */
export function loadReferenceData<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? REFERENCE_DATA_DEFAULT_TTL_MS;
  if (!options?.force) {
    const cached = peekReferenceData<T>(key, ttlMs);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      store.set(key, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request as Promise<unknown>);
  return request;
}

/**
 * クリックより前に裏で温めておく (行 hover / フォーカス時に呼ぶ)。
 * 失敗しても表示には影響させないので、例外は握りつぶす。
 */
export function prefetchReferenceData<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { ttlMs?: number },
): void {
  void loadReferenceData(key, loader, options).catch(() => {});
}

/** 前方一致でキャッシュを捨てる。引数なしで全部。保存処理の直後に呼ぶ。 */
export function invalidateReferenceData(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear();
    inflight.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(keyPrefix)) inflight.delete(key);
  }
}
