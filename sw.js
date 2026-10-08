/* ロコ庵アプリ Service Worker（2026-10-08）
   ねらい: 電波が無い所でもアプリが開けること。
   方針: **ネット優先**。オンラインなら必ず最新を取り、取れたものを控える。取れないときだけ控えを返す。
   ＝「画面が変わらない」（10/4のような）は起きない。古い控えは使われない。
   対象は同じサイト内のGET（app.html・shared/…）だけ。窓口GAS（script.google.com）は触らない。 */
const CACHE = "rokoan-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || new Response("オフラインです。電波のある所でもう一度開いてください。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })))
  );
});
