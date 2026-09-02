import type { MinerStatus } from "./types.js";

/**
 * Picks a free numeric YAML `id` (distinct from the on-chain registrationId —
 * see docs/superpowers/specs/2026-09-02-miner-plugin-design.md). Mirrors the
 * `curl .../api/miners | jq -r '.[].id' | sort -n` guidance in yaml-standard.md.
 */
export async function pickFreeYamlId(nodeApiUrl: string): Promise<number> {
  const res = await fetch(`${nodeApiUrl}/api/miners`);
  if (!res.ok) {
    throw new Error(`GET /api/miners failed: ${res.status}`);
  }
  const miners = (await res.json()) as Array<{ id?: number }>;
  const ids = miners.map((m) => m.id).filter((id): id is number => typeof id === "number");
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

export async function getMinerStatus(nodeApiUrl: string, registrationId: string): Promise<MinerStatus> {
  const res = await fetch(`${nodeApiUrl}/api/miners/${registrationId}`);
  if (!res.ok) {
    throw new Error(`GET /api/miners/${registrationId} failed: ${res.status}`);
  }
  const body = (await res.json()) as { miner?: MinerStatus } & MinerStatus;
  return body.miner ?? body;
}

/**
 * Fetches the manifest the deployed Worker is serving, retrying while the
 * edge network catches up right after a deploy. We hash exactly these bytes
 * — never a locally-reconstructed YAML — so what we register is guaranteed
 * to be byte-identical to what the node will later fetch and verify.
 */
export async function fetchServedYaml(
  yamlUrl: string,
  { attempts = 6, delayMs = 5000 }: { attempts?: number; delayMs?: number } = {}
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(yamlUrl);
      if (res.ok) return await res.text();
      lastError = new Error(`GET ${yamlUrl} → ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `Could not fetch ${yamlUrl} after ${attempts} attempts: ${String(lastError)}`
  );
}

/** Polls until the registration reaches a terminal or "active" status. */
export async function pollUntilSettled(
  nodeApiUrl: string,
  registrationId: string,
  { timeoutMs = 10 * 60 * 1000, intervalMs = 15000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<MinerStatus> {
  const terminal = new Set(["active", "rejected", "deregistered", "unreachable"]);
  const deadline = Date.now() + timeoutMs;
  let status = await getMinerStatus(nodeApiUrl, registrationId);
  while (!terminal.has(status.activation_status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    status = await getMinerStatus(nodeApiUrl, registrationId);
  }
  return status;
}
