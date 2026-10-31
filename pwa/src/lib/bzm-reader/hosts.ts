/**
 * 書斎を AMD OS とは別のアドレスで開くための振り分け（middleware から呼ぶ純関数）。
 *
 * 書斎は専用の Vercel プロジェクト（SHOSAI_HOST）で動く別アプリ。本・論文・教科書の原稿の正本も書斎にある。
 * - AMD OS のアドレスで書斎（/bzm/read 配下）を開いたら、同じパスのまま書斎のアドレスへ送る。
 * - AMD OS のアドレスで、それ以外の /bzm 配下（教科書の入口・章、旧ナラティブ版、理論マップ）を開いたら、書斎の本棚へ送る。
 *   OS では本と論文と理論マップを表示しない（2026-10-31 まさ「止めて」「理論マップも削除していいよ」）。
 * - 書斎のアドレスでは、書斎の画面とログインだけを出す。`/` は棚へ。それ以外は AMD OS のアドレスへ送る。
 * - 上の2つ以外のアドレス（プレビュー、手元の開発）は振り分けない。
 * 書斎側の正本仕様は書斎のリポジトリの DESIGN.md。OS 側の振り分けは spec 2-1 に記す。
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

/** OS 上の表示をやめた /bzm 配下。書斎 /bzm/read は含めない（isReaderPath が扱う） */
export function isRetiredBzmPath(pathname: string): boolean {
  if (isReaderPath(pathname)) return false;
  return pathname === "/bzm" || pathname.startsWith("/bzm/");
}

/** 書斎のアドレスで出してよいパス。ログイン（/auth/*）は書斎のアドレスのまま通し、ログイン後は書斎へ戻る */
export function isShosaiHostPath(pathname: string): boolean {
  return (
    isReaderPath(pathname) ||
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
  // 表示をやめた /bzm 配下は、どこから来ても書斎の本棚へ。書斎の本棚は書斎自身が表示するので、
  // 書斎の旧章リンク（/bzm/{slug} を OS へ送る）と往復しない。
  if (h === AMD_OS_HOST && isRetiredBzmPath(path)) {
    return `https://${SHOSAI_HOST}/bzm/read`;
  }
  return null;
}
