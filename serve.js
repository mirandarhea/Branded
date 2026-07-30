// Production server for the built site.
// Uses Node.js since better-sqlite3 does not work with Bun's runtime.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = path.resolve(__dirname, "dist/client");

// Ensure DATA_DIR is set for the bundled db module before any imports.
// Use an absolute path based on this file's location so the SSR bundle,
// which loads the db module lazily, always finds the database.
const DATA_DIR_ABSOLUTE = path.resolve(__dirname, "data");
process.env.DATA_DIR = DATA_DIR_ABSOLUTE;
const DB_PATH_ABSOLUTE = path.join(DATA_DIR_ABSOLUTE, "branded.db");
console.log("DB path configured:", DB_PATH_ABSOLUTE, "exists:", fs.existsSync(DB_PATH_ABSOLUTE));

// Dynamically import the SSR handler (default export is the server entry)
const mod = await import("./dist/server/server.js");
const handler = mod.default;

// Import db for domain lookups
let dbModule = null;
async function getDbModule() {
  if (!dbModule) {
    // The SSR bundle has the db module; import the db directly
    dbModule = await import("./dist/server/assets/db-" + 
      fs.readdirSync("./dist/server/assets").find(f => f.startsWith("db-") && f.endsWith(".js"))
    );
  }
  return dbModule;
}

// Known Branded hostnames (not custom domains)
const BRANDED_HOSTS = new Set([
  "brandedapp.us",
  "brandedapp.ctonew.app",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isBrandedHost(host) {
  const h = host.split(":")[0].toLowerCase(); // strip port
  return BRANDED_HOSTS.has(h) || h.endsWith(".brandedapp.us") || h.endsWith(".brandedapp.ctonew.app");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Free port using lsof
import { execSync } from "node:child_process";
try {
  const pids = execSync(
    `lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true`,
    { encoding: "utf8" }
  ).trim();
  if (pids) {
    for (const pid of pids.split("\n").filter(Boolean)) {
      try { process.kill(parseInt(pid), "SIGTERM"); } catch { /* ok */ }
    }
  }
} catch { /* no server to free */ }

const server = http.createServer(async (req, res) => {
  try {
    const rawHost = req.headers.host || "localhost";
    const host = rawHost.split(":")[0].toLowerCase();
    const url = new URL(req.url || "/", `http://${rawHost}`);
    let pathname = url.pathname;

    // Custom domain routing: if the Host is not a Branded host,
    // look up the domain and rewrite to /app/{slug}/...
    if (!isBrandedHost(rawHost)) {
      try {
        const mod = await getDbModule();
        let business = null;

        // Try getBusinessByDomain if exported, else fall back to direct DB query
        if (typeof mod.getBusinessByDomain === "function") {
          business = mod.getBusinessByDomain(host);
        } else if (typeof mod.getDb === "function") {
          const db = mod.getDb();
          business = db.prepare(
            "SELECT * FROM businesses WHERE custom_domain = ? AND custom_domain_verified = 1"
          ).get(host);
        }

        if (business && business.slug) {
          // Rewrite the path to the customer-facing app route
          if (pathname === "/" || pathname === "") {
            pathname = `/app/${business.slug}`;
          } else {
            pathname = `/app/${business.slug}${pathname}`;
          }
          url.pathname = pathname;
        }
      } catch (err) {
        // Domain lookup failed, proceed with normal routing
        console.error("Domain lookup error:", err.message);
      }
    }

    // Serve static files
    if (pathname !== "/") {
      const filePath = path.join(CLIENT_DIR, pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath);
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(content);
        return;
      }
    }

    // SSR via handler
    const protocol = "http";
    const requestHost = req.headers.host || "localhost";
    // Use the potentially rewritten pathname for domain-routed requests
    const requestUrl = `${protocol}://${requestHost}${url.pathname}${url.search}`;

    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v || ""])),
      body,
    });

    const response = await handler.fetch(request);

    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    res.writeHead(response.status, responseHeaders);

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      };
      pump().catch(() => res.end());
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`team-site serving on http://${HOST}:${PORT}`);
});