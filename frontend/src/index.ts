import { serve } from "bun";
import index from "./index.html";

const PRODUCER_URL =
  process.env.PRODUCER_URL || "http://localhost:3001";

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
  routes: {
    // Proxy all /api/* requests to the producer service.
    "/api/*": async (req) => {
      const url = new URL(req.url);
      const target = `${PRODUCER_URL}${url.pathname}${url.search}`;
      return fetch(target, {
        method: req.method,
        headers: forwardHeaders(req.headers),
        body: req.body,
        // @ts-expect-error – duplex is required by the Fetch spec for streaming bodies but not yet in lib.dom.d.ts
        duplex: "half",
      });
    },

    // Serve React SPA for all other routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Frontend server running at ${server.url}`);
console.log(`   Proxying /api/* → ${PRODUCER_URL}`);
