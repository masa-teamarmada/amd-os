// D001_Router.gs
// Dev GAS エントリポイント・ルーター

function doGet(e) {
  return HtmlService.createTemplateFromFile('D200_DevPage')
    .evaluate()
    .setTitle('dev-AMD-OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}