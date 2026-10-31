/**
 * 書斎を AMD OS とは別のアドレスで開くための振り分け（middleware から呼ぶ純関数）。
 *
 * 書斎は同じサーバ・同じ Supabase のまま、別のアドレス（SHOSAI_HOST）で別アプリとして開く。
 * アドレス（オリジン）が違えば、AMD OS をインストールしていても書斎は AMD OS の窓に取り込まれず、
 * ホーム画面や Dock に独立したアプリとして入る。
 * - 書斎のアドレスでは、書斎の画面・図の API・ログインだけを出す。`/` は棚へ。それ以外は AMD OS のアドレスへ送る。
 * - AMD OS のアドレスで書斎（/bzm/read 配下）を開いたら、書斎のアドレスへ送る。
 * - AMD OS のアドレスで、表示を止めた本の画面（教科書の章・その入口・旧ナラティブ版）を開いたら、書斎の本棚へ送る。
 *   本と論文の正本は書斎へ移したので、OS では表示しない。理論マップ /bzm/map は OS に残す（2026-10-31 まさ「止めて」）。
 * - 上の2つ以外のアドレス（プレビュー、手元の開発）は振り分けない。
 * 設計正本: pwa/design/bzm_reader.md §2.1
 */

export const SHOSAI_HOST = "bookshelf-armada.vercel.app";
export const AMD_OS_HOST = "amd-os-pwa.vercel.app";

/** Host ヘッダを比べられる形にする（小文字、ポートを外す） */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

/** 書斎のアドレスで開いた要求か */
export function isShosaiHost(host: string | null | undefined): boolean {
  return host ? normalizeHost(host) === SHOSAI_HOST : false;
}

function isReaderPath(pathname: string): boolean {
  return pathname === "/bzm/read" || pathname.startsWith("/bzm/read/");
}

/**
 * OS 上の表示を止めた本の画面。教科書の入口 /bzm、教科書の章 /bzm/{slug}、旧ナラティブ版 /bzm/public 配下。
 * 理論マップ /bzm/map と書斎 /bzm/read は含めない（前者は OS に残し、後者は isReaderPath が扱う）。
 */
export function isRetiredBookPath(pathname: string): boolean {
  if (pathname === "/bzm" || pathname === "/bzm/") return true;
  if (pathname === "/bzm/public" || pathname.startsWith("/bzm/public/")) return true;
  const m = /^\/bzm\/([^/]+)\/?$/.exec(pathname);
  return !!m && m[1] !== "map" && m[1] !== "read";
}

/** 書斎のアドレスで出してよいパス。ログイン（/auth/*）は書斎のアドレスのまま通し、ログイン後は書斎へ戻る */
export function isShosaiHostPath(pathname: string): boolean {
  return (
    isReaderPath(pathname) ||
    pathname.startsWith("/api/bzm-reader/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/build-info"
  );
}

/**
 * 振り分け先の URL。振り分けないときは null。
 * `host` は要求の Host ヘッダ（無ければ URL の host）。ポート付きでも比べられるよう小文字にしてポートを外す。
 */
export function readerHostRedirect(url: URL, host: string | null): string | null {
  const h = normalizeHost(host ?? url.host);
  const path = url.pathname;
  if (h === SHOSAI_HOST) {
    if (path === "/" || path === "") return `https://${SHOSAI_HOST}/bzm/read`;
    if (isShosaiHostPath(path)) return null;
    return `https://${AMD_OS_HOST}${path}${url.search}`;
  }
  if (h === AMD_OS_HOST && isReaderPath(path)) {
    return `https://${SHOSAI_HOST}${path}${url.search}`;
  }
  // 表示を止めた本の画面は、どの章から来ても書斎の本棚へ。書斎の本棚は書斎自身が表示するので、
  // 書斎の旧章リンク（/bzm/{slug} を OS へ送る）と往復しない。
  if (h === AMD_OS_HOST && isRetiredBookPath(path)) {
    return `https://${SHOSAI_HOST}/bzm/read`;
  }
  return null;
}
