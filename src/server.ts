import { join, normalize, sep } from "node:path";

const root = join(import.meta.dir, "..", "public");
const port = Number(process.env.PORT ?? 8790);

const server = Bun.serve({
  port,
  hostname: process.env.HOST ?? "0.0.0.0",
  async fetch(req) {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith("/")) path += "index.html";
    const full = normalize(join(root, path));
    if (full !== root && !full.startsWith(root + sep)) return new Response("Not Found", { status: 404 });
    const file = Bun.file(full);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });
    // Always revalidate: the service worker does the offline caching, and a long HTTP max-age would hand it
    // stale copies when it (re)fills its cache after an update.
    return new Response(file, { headers: { "Cache-Control": "no-cache" } });
  },
});

console.log(`draw listening on http://${server.hostname}:${server.port}`);
