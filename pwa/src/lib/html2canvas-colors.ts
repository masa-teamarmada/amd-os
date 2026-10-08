/** html2canvasの色パーサーが扱えないCSS Color 4を、印刷用の複製だけでRGBAへ変換する。 */
export function normalizeHtml2CanvasColors(document: Document): void {
  const view = document.defaultView;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!view || !context) throw new Error("PDF用の色を変換できなかった。");
  const modernColor = /\b(?:lab|lch|oklab|oklch|color|color-mix)\(/;
  const colors = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "text-decoration-color"];
  for (const element of document.querySelectorAll<HTMLElement>("*")) {
    const style = view.getComputedStyle(element);
    for (const property of colors) {
      const value = style.getPropertyValue(property);
      if (!modernColor.test(value)) continue;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      element.style.setProperty(property, `rgba(${r}, ${g}, ${b}, ${a / 255})`, "important");
    }
    // 装飾の影は本文に影響しない。色の関数を含む影だけ複製から外す。
    for (const property of ["box-shadow", "text-shadow"]) {
      if (modernColor.test(style.getPropertyValue(property))) element.style.setProperty(property, "none", "important");
    }
  }
}
