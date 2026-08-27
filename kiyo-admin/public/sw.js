// インストール可能にするための最小 service worker。
//
// ⚠️ わざとキャッシュしない。支払通知書は金額を扱うので、
//    古いレスポンスがオフラインで返る方が事故になる。
//    fetch handler はそのままネットワークへ流すだけ。
//    （Chrome/Edge の install 要件を満たすために fetch handler は必要）

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
