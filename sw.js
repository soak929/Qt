// 오프라인 지원: 한 번 열어 본 화면과 본문은 인터넷이 없어도 열리게 한다.
const VERSION = "v6";
const SHELL = `qt-shell-${VERSION}`;
const DATA = "qt-data";      // 오늘 장절 (자주 바뀜)
const BIBLE = "qt-bible";    // 성경 본문 (바뀌지 않음)
const FONTS = "qt-fonts";

const SHELL_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "data/bible/index.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qt-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 인터넷 먼저, 안 되면 저장해 둔 것
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

// 저장해 둔 것 먼저, 없으면 인터넷
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes("/data/bible/") && !url.pathname.endsWith("index.json")) {
    event.respondWith(cacheFirst(req, BIBLE));
  } else if (url.pathname.includes("/data/")) {
    event.respondWith(networkFirst(req, DATA));
  } else {
    // 화면 파일: 고친 내용이 바로 반영되도록 인터넷 먼저
    event.respondWith(networkFirst(req, SHELL));
  }
});
