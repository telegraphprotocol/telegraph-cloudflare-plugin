import { createHash } from "node:crypto";

// Node-only (CLI side). The SDK never hashes the YAML itself — it just
// serves it; the CLI hashes whatever bytes the deployed Worker actually
// returns. Kept out of yaml.ts so that module stays safe to bundle into a
// Cloudflare Worker without pulling in node:crypto.
export function sha256Hex(bytes: string | Uint8Array): `0x${string}` {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return `0x${hash}`;
}
