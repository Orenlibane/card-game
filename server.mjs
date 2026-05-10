import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(root, normalize(requested)));

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "cache-control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Card game server listening on port ${port}`);
});
