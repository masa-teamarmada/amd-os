/**
 * 書斎を AMD OS とは別のアドレスで開くための振り分け（middleware から呼ぶ純関数）。
 *
 * 書斎は同じサーバ・同じ Supabase のまま、別のアドレス（SHOSAI_HOST）で別アプリとして開く。
 * アドレス（オリジン）が違えば、AMD OS をインストールしていても書斎は AMD OS の窓に取り込まれず、
 * ホーム画面や Dock に独立したアプリとして入る。
 * - 書斎のアドレスでは、書斎の画面・図の API・ログインだけを出す。`/` は棚へ。それ以外は AMD OS のアドレスへ送る。
 * - AMD OS のアドレスで書斎（/bzm/read 配下）を開いたら、書斎のアドレスへ送る。
 * - 上の2つ以外のアドレス（プレビュー、手元の開発）は振り分けない。
 * 設計正本: pwa/design/bzm_reader.md §2.1
 */

export const SHOSAI_HOST = "bookshelf-armada.vercel.app";
export const AMD_OS_HOST = "amd-os-pwa.vercel.app";

function isReaderPath(pathname: string): boolean {
  return pathname === "/bzm/read" || pathname.startsWith("/bzm/read/");
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
  const h = (host ?? url.host).toLowerCase().replace(/:\d+$/, "");
  const path = url.pathname;
  if (h === SHOSAI_HOST) {
    if (path === "/" || path === "") return `https://${SHOSAI_HOST}/bzm/read`;
    if (isShosaiHostPath(path)) return null;
    return `https://${AMD_OS_HOST}${path}${url.search}`;
  }
  if (h === AMD_OS_HOST && isReaderPath(path)) {
    return `https://${SHOSAI_HOST}${path}${url.search}`;
  }
  return null;
}
