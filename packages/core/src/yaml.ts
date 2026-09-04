import { stringify } from "yaml";
import type { ResolvedMinerConfig } from "./types.js";

// Fixed wire contract v1 — see docs/superpowers/specs/2026-09-02-miner-plugin-design.md.
// The SDK middleware (packages/sdk) implements this exact shape, so the YAML
// never needs a per-miner param_map: every miner built with this plugin
// exposes the same single endpoint.
export function buildIntegrationYaml(cfg: ResolvedMinerConfig): string {
  // `id` is required by the schema, and a missing one serializes to an
  // absent key rather than an error — so a Worker deployed before
  // `telegraph-miner deploy` has assigned an id would silently serve an
  // invalid manifest, and only fail later at on-chain validation. Fail here
  // instead, where the cause is obvious.
  if (!Number.isSafeInteger(cfg.yamlId) || cfg.yamlId < 0) {
    throw new Error(
      `telegraph: missing or invalid "yamlId" (got ${JSON.stringify(cfg.yamlId)}). ` +
        "Run `telegraph-miner deploy` — it assigns a free id and writes it to telegraph.config.json."
    );
  }
  if (!cfg.supportedIntents?.length) {
    throw new Error('telegraph: "supportedIntents" must list at least one canonical intent.');
  }

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
        // Distinct copies on purpose: handing the same array object to both
        // fields makes the serializer emit a YAML anchor/alias (&a1 / *a1)
        // instead of writing the list twice. Parsers resolve that, but the
        // manifest is hashed, read by humans, and schema-validated — it
        // should be plain, literal YAML.
        intents: [...cfg.supportedIntents],
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
      supported_intents: [...cfg.supportedIntents],
    },
  };

  // yaml's default line width can wrap long values (e.g. descriptions),
  // which changes the byte content silently on re-render. Keep it wide so
  // what we hash is exactly what we serialize.
  return stringify(doc, { lineWidth: 0 });
}
