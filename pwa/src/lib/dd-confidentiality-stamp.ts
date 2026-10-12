/** 画像生成した秘密指定スタンプ。同じ素材を画面・閲覧写し・保存出力に使う。 */
export const DD_STAMP_URL = "/dd/confidential-stamp-20261012.webp";
export const DD_STAMP_PNG_URL = "/dd/confidential-stamp-20261012.png";
export const DD_STAMP_WIDTH = 1925;
export const DD_STAMP_HEIGHT = 817;

let stampRequest: Promise<Uint8Array> | undefined;
/** 低頻度の固定素材。並行出力をまとめ、失敗だけ再取得する。 */
export function loadDdStampBytes(): Promise<Uint8Array> {
  return stampRequest ??= fetch(DD_STAMP_PNG_URL).then(async response => {
    if (!response.ok) throw new Error("秘密情報スタンプを読み込めなかった。");
    return new Uint8Array(await response.arrayBuffer());
  }).catch(error => { stampRequest = undefined; throw error; });
}
