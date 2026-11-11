const CACHE = "malen-v12";
const TEMPLATES = ["unicorn", "garden", "sea", "castle", "dinosaur", "space", "farm", "butterfly", "train", "jungle",
                   "octopus", "koala", "giraffe", "sheep", "panda", "reindeer", "pumpkin", "xmastree", "icecream", "rainbow", "rescue",
                   "snowman", "bunny", "beach", "autumn", "ghost"];
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icon.svg", ...TEMPLATES.map(t => `templates/${t}.svg`)];
// cache: "reload"/"no-cache" bypass the browser's HTTP cache, so an update never re-caches an old file.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Cache-first with background refresh; offline navigations to unknown URLs fall back to the app shell.
self.addEventListener("fetch", e => {
  // Only the app's own files are cached; third-party requests (PayPal) and the APK download go straight to the network.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin || e.request.url.endsWith(".apk")) return;
  const nav = e.request.mode === "navigate";
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request, { cache: "no-cache" }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit || (nav ? caches.match("index.html") : Response.error()));
    return hit || net;
  }));
});
