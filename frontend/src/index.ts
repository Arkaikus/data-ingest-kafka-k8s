import { resolve } from "node:path";
import { serve } from "bun";

const PRODUCER_URL = process.env.PRODUCER_URL || "http://localhost:3001";
const isProd = process.env.NODE_ENV === "production";
const distDir = resolve(import.meta.dir, "..", "dist");

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function forwardHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  });
  return out;
}

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Proxy all /api/* requests to the producer service.
    if (url.pathname.startsWith("/api/")) {
      const target = `${PRODUCER_URL}${url.pathname}${url.search}`;
      return fetch(target, {
        method: req.method,
        headers: forwardHeaders(req.headers),
        body: req.body,
        // @ts-expect-error – duplex is required by the Fetch spec for streaming bodies but not yet in lib.dom.d.ts
        duplex: "half",
      });
    }

    // Production: serve static files from dist/
    if (isProd) {
      const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const filePath = resolve(distDir, path);
      if (!filePath.startsWith(distDir)) {
        return new Response("Forbidden", { status: 403 });
      }
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response(Bun.file(resolve(distDir, "index.html")), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Development: serve index.html from src/
    const devHtml = Bun.file(resolve(import.meta.dir, "index.html"));
    return new Response(devHtml, {
      headers: { "Content-Type": "text/html" },
    });
  },

  development: !isProd && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Frontend server running at ${server.url}`);
console.log(`   Proxying /api/* → ${PRODUCER_URL}`);
