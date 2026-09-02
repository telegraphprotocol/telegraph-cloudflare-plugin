# Telegraph Miner Plugin — Design

**Status:** Approved for implementation
**Date:** 2026-09-02

## Problem

Registering a miner on Telegraph requires an on-chain `registerMiner` transaction
(wallet, gas, `feeAddress`, `minPriceUsdc`, `supportedIntents`) plus a publicly
hosted YAML matching Telegraph's Open Integration Standard v1
(`modules/miner-dispatcher/schemas/integration.schema.json` in the main
`Telegraph` repo). Today a developer does this by hand: write YAML, host it,
compute `sha256`, call `cast send`.

Goal: a developer who deploys a Cloudflare Worker (e.g. a Kitesurf-based
scraper) should be able to go from `wrangler deploy` to an active, ranked
Telegraph miner with effectively zero manual steps beyond picking their
price/intents once.

## Non-goals

- Auto-registering third-party services the developer never consented to
  (e.g. crawling GitHub and registering strangers' repos). Registration
  requires a signature from the miner's own wallet — there is no way to do
  this on someone else's behalf without holding their key. Out of scope for
  this plugin entirely.
- Arbitrary API shape auto-detection. The plugin defines one fixed wire
  contract; the developer's Worker implements it via the SDK middleware.
  No LLM-based reverse-engineering of an existing, unrelated API.

## Architecture

Two packages in one repo (npm workspaces):

- **`packages/sdk`** (`@telegraph/miner-sdk`) — a Cloudflare Workers
  middleware. Wraps the developer's fetch handler:
  `withTelegraphMiner(handler, config)`. Serves two things on the same
  Worker: the fixed inference contract (`POST /` — see Wire contract below)
  and the generated integration YAML at `/.well-known/telegraph.yaml`. No
  external hosting needed — the Worker hosts its own registration manifest.
- **`packages/cli`** (`telegraph-miner`) — commands `init`, `deploy`,
  `update`, `status`. Holds the miner's EVM key locally (env var
  `TELEGRAPH_EVM_PRIVATE_KEY`, generated as a burner wallet on `init` if
  unset — same pattern as `telegraph-mcp`'s `TELEGRAPH_EVM_PRIVATE_KEY`).

Both packages share `packages/core`: YAML templating, sha256 hashing, the
`registerMiner`/`deregisterMiner`/`getMiner` ABI bindings (viem), and HTTP
calls to the node's `/api/miners` endpoints.

## Wire contract (fixed, v1)

```
POST /
Content-Type: application/json
{ "intent": "<canonical intent string>", "query": "<string>" }

200 OK
{ "result": <any JSON>, "confidence"?: number }
```

This is the *only* endpoint the generated YAML declares:

```yaml
endpoints:
  - path: /answer
    external_path: /
    method: POST
    intents: [<configured supported_intents>]
    params:
      body:
        required:
          - { name: query, type: string, intents: ["*"] }
```

The SDK middleware handles parsing/responding to this shape and delegates
the actual work (calling the underlying scraper, etc.) to the handler
function the developer passes in. Nothing about the developer's original
Worker logic needs to change shape — the middleware is the adapter.

## Data flow

```
dev: telegraph-miner init
  → prompts: intents (from canonical list), min_price_usdc, fee_address
    (default: wallet address); generates/loads TELEGRAPH_EVM_PRIVATE_KEY
  → writes telegraph.config.json
  → wires withTelegraphMiner(...) into the Worker entrypoint (codemod or
    documented one-line edit if the entry file isn't recognizable)

dev: telegraph-miner deploy
  → runs `wrangler deploy`, parses the printed workers.dev URL
  → GETs {url}/.well-known/telegraph.yaml (retried — edge propagation lag)
  → sha256(yaml bytes)
  → reads .telegraph/state.json for a prior registration
      - no prior registration → pick a free `id` (GET /api/miners, take
        max+1), call registerMiner(...), poll /api/miners/{id}, write
        state.json, print activation status
      - prior registration, same hash → no-op ("already registered, no
        changes")
      - prior registration, different hash → warn: "config changed, run
        `telegraph-miner update`" and exit non-zero; does NOT silently
        deregister a live miner

dev: telegraph-miner update
  → explicit deregisterMiner(oldId) + registerMiner(new...) for changed
    config; only path that ever deregisters

dev: telegraph-miner status
  → GET /api/miners/{id} from state.json, print activation_status /
    rejection_reason / retrying
```

## Error handling

- No gas on the wallet → CLI checks balance before building the tx, fails
  with a testnet faucet link rather than letting `cast`/viem error out
  opaquely.
- `wrangler deploy` fails → abort before any registration attempt.
- YAML endpoint not yet reachable post-deploy → retry with backoff (a few
  attempts over ~30s) before hashing, since the node will need to fetch the
  exact same URL.
- On-chain rejection (schema/hash mismatch) → CLI polls to a terminal
  status and prints the real `rejection_reason`, never declares success at
  tx-confirmation time (registration success and *activation* are
  different things per `miner-registry.md`).

## Local state

`.telegraph/state.json` (gitignored): `{ registrationId, slug, id,
lastYamlHash, network }`. Makes `deploy` idempotent across repeated CI runs.

## Testing

- Unit: YAML templating (config → YAML string), sha256 hashing, id-picking
  logic (max+1 over a fetched id list) — no network.
- Integration: against local Anvil, mirroring the existing
  `scripts/prod/register-miners.sh` pattern in the main Telegraph repo —
  `init` → fake `wrangler deploy` (a stub script printing a known
  workers.dev-shaped URL) → `deploy` → assert a `MinerRegistered` event and
  that the served YAML round-trips through the schema. Requires Anvil +
  the deployed Diamond locally; not run in CI without that fixture.

## Reference values (Base Sepolia, from the main Telegraph repo docs)

- Diamond: `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`
- `registerMiner(string yamlUrl, bytes32 yamlHash, address feeAddress, uint256 minPriceUsdc, string[] supportedIntents) returns (uint256)`
- YAML schema required fields: `version` (`"1"`), `kind` (`"miner"`), `id`,
  `slug`, `name`, `base_url`. `endpoints` may be a single entry (see Wire
  contract above).
