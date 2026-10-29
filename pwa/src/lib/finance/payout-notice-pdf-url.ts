/**
 * 管理画面が開く支払通知書PDFのURLを、Driveへの直リンクではなく
 * 同一オリジンの閲覧専用エンドポイントへ統一する。
 * ここでは文字列を組み立てるだけで、認可・Drive読取は呼び出し先のAPI routeが行う。
 */
export function payoutNoticePdfViewUrl(ym: string, memberId: string): string {
  const params = new URLSearchParams({ ym, memberId });
  return `/api/admin/payouts/pdf?${params.toString()}`;
}
