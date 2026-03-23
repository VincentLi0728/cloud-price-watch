import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { compareOffers, getMetadata } from "./src/pricing-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function serveStatic(requestPath, response) {
  const requestedPath = requestPath === "/" ? "index.html" : requestPath.replace(/^[/\\]+/, "");
  const normalizedPath = path.normalize(requestedPath);
  const filePath = path.resolve(publicDir, normalizedPath);

  if (!filePath.startsWith(path.resolve(publicDir))) {
    return json(response, 403, { error: "Forbidden" });
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    return json(response, 200, {
      ok: true,
      service: process.env.APP_NAME || "Cloud Price Watch",
      timestamp: new Date().toISOString(),
      ...getMetadata()
    });
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/metadata") {
    return json(response, 200, getMetadata());
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/compare") {
    try {
      const body = await readJsonBody(request);
      return json(response, 200, compareOffers(body));
    } catch (error) {
      return json(response, 400, {
        error: "Invalid request body",
        detail: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "GET" && !requestUrl.pathname.startsWith("/api/")) {
    return serveStatic(requestUrl.pathname, response);
  }

  return json(response, 404, { error: "Route not found" });
});

server.listen(port, host, () => {
  console.log(`Cloud Price Watch listening on http://${host}:${port}`);
});
