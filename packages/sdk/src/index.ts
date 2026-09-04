import { buildIntegrationYaml } from "@telegraph/miner-core";
import type { MinerConfig, ResolvedMinerConfig } from "@telegraph/miner-core";

export type TelegraphMinerConfig = MinerConfig & { yamlId: number };

/**
 * The fixed wire contract (v1) this middleware implements — see
 * docs/superpowers/specs/2026-09-02-miner-plugin-design.md.
 *
 *   POST / { "intent": string, "query": string } -> { "result": any, "confidence"?: number }
 *
 * `handler` does the actual work (calling the underlying scraper/service,
 * etc.) and returns the answer; this middleware owns the envelope, the
 * manifest endpoint, and CORS so a miner author never has to implement the
 * Telegraph-specific parts.
 */
export type AnswerHandler = (
  input: { intent: string; query: string },
  request: Request
) => Promise<{ result: unknown; confidence?: number }>;

const MANIFEST_PATH = "/.well-known/telegraph.yaml";

export function withTelegraphMiner(
  handler: AnswerHandler,
  config: TelegraphMinerConfig
): (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === MANIFEST_PATH) {
      // A misconfigured manifest is the developer's most likely failure, and
      // it is only ever read by curl or by a Telegraph node — so answer with
      // the actual reason in plain text rather than letting the throw become
      // an opaque platform 500.
      try {
        const resolved: ResolvedMinerConfig = {
          ...config,
          baseUrl: url.origin,
          feeAddress: requireFeeAddress(config),
        };
        return new Response(buildIntegrationYaml(resolved), {
          status: 200,
          headers: { "Content-Type": "text/yaml; charset=utf-8" },
        });
      } catch (err) {
        return new Response(err instanceof Error ? err.message : String(err), {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/" && request.method === "POST") {
      let body: { intent?: unknown; query?: unknown };
      try {
        body = await request.json();
      } catch {
        return jsonError(400, "invalid JSON body");
      }
      if (typeof body.query !== "string" || typeof body.intent !== "string") {
        return jsonError(400, "body must be { intent: string, query: string }");
      }

      try {
        const { result, confidence } = await handler(
          { intent: body.intent, query: body.query },
          request
        );
        return new Response(JSON.stringify({ result, confidence }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return jsonError(502, err instanceof Error ? err.message : "handler failed");
      }
    }

    return jsonError(404, "not found");
  };
}

function requireFeeAddress(config: MinerConfig): `0x${string}` {
  if (!config.feeAddress) {
    throw new Error(
      "telegraph.config.json is missing feeAddress — run `telegraph-miner init` again or set it manually"
    );
  }
  return config.feeAddress;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
