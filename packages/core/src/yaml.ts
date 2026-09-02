import { stringify } from "yaml";
import type { ResolvedMinerConfig } from "./types.js";

// Fixed wire contract v1 — see docs/superpowers/specs/2026-09-02-miner-plugin-design.md.
// The SDK middleware (packages/sdk) implements this exact shape, so the YAML
// never needs a per-miner param_map: every miner built with this plugin
// exposes the same single endpoint.
export function buildIntegrationYaml(cfg: ResolvedMinerConfig): string {
  const doc = {
    version: "1",
    kind: "miner",
    id: cfg.yamlId,
    slug: cfg.slug,
    protocol: "generic",
    name: cfg.name,
    ...(cfg.description ? { description: cfg.description } : {}),
    base_url: cfg.baseUrl,
    endpoints: [
      {
        path: "/answer",
        external_path: "/",
        method: "POST",
        description: "Telegraph miner-plugin fixed wire contract.",
        intents: cfg.supportedIntents,
        params: {
          body: {
            required: [
              { name: "query", type: "string", intents: ["*"] },
              { name: "intent", type: "string", intents: ["*"] },
            ],
          },
        },
      },
    ],
    semantics: {
      supported_intents: cfg.supportedIntents,
    },
  };

  // yaml's default line width can wrap long values (e.g. descriptions),
  // which changes the byte content silently on re-render. Keep it wide so
  // what we hash is exactly what we serialize.
  return stringify(doc, { lineWidth: 0 });
}
