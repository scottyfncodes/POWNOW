/**
 * Vercel serverless adapter for the POW NOW data proxy.
 *
 * Every `/api/*` request on the deployed site lands here and is handed to the
 * same router the standalone `node server/index.mjs` process runs — one code
 * path, two hosts. Vercel's request and response objects are Node's own
 * `IncomingMessage` / `ServerResponse` (with the body pre-parsed onto
 * `req.body`, which the router accepts), so there is nothing to translate.
 *
 * Deployed beside the static frontend, this makes the proxy same-origin:
 * `VITE_API_BASE_URL=/` in the build, no CORS allowlist needed. Secrets
 * (`GOOGLE_ROUTES_API_KEY`, `COTRIP_API_KEY`) and the optional shared cache
 * (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) are Vercel project environment
 * variables — see .env.example.
 */
import { handleRequest } from '../server/index.mjs';

export default function handler(req, res) {
  return handleRequest(req, res);
}
