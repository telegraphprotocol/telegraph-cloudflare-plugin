# telegraph-cloudflare-plugin

Turn a Cloudflare Worker into an active Telegraph miner with `wrangler
deploy` — no hand-written YAML, no manual `cast send`, no separate hosting
for the integration manifest.

Built for the Cloudflare Kitesurf wave (headless browsers on V8 isolates,
cheap enough that scraper Workers are about to get a lot more common) but
works for any on-demand Worker that answers a query.

See [`docs/superpowers/specs/2026-09-02-miner-plugin-design.md`](docs/superpowers/specs/2026-09-02-miner-plugin-design.md)
for the full design and the reasoning behind it — in particular why this
plugin *only* registers Workers the developer running it controls (their
wallet signs the transaction), and deliberately does not auto-register
other people's deployments.

## Packages

- [`@telegraph/miner-sdk`](packages/sdk) — Worker middleware. Wraps your
  fetch handler, serves the integration manifest at
  `/.well-known/telegraph.yaml`, and speaks Telegraph's fixed wire contract
  so your YAML never needs a custom `param_map`.
- [`telegraph-miner`](packages/cli) — the CLI: `init`, `deploy`, `update`,
  `status`.
- [`@telegraph/miner-core`](packages/core) — shared chain/YAML/HTTP code
  used by both.

## Quick start

```bash
npm install
npm run build

cd your-worker-project
npx telegraph-miner init      # asks for slug, intents, price, wallet
# wire withTelegraphMiner(...) into your Worker entrypoint (init prints
# exactly what to add)
npx telegraph-miner deploy    # wrangler deploy, then registers on-chain
npx telegraph-miner status    # check activation status any time
```

See [`examples/kitesurf-scraper`](examples/kitesurf-scraper) for a minimal
wired-up Worker.

## How it works

```
telegraph-miner deploy
  → wrangler deploy                         (your code goes live)
  → GET {workers.dev url}/.well-known/telegraph.yaml   (served by the SDK)
  → sha256 the response
  → registerMiner(yamlUrl, yamlHash, feeAddress, minPriceUsdc, intents)
  → poll /api/miners/{id} until active/rejected
```

Nothing is registered on anyone's behalf without their own wallet signing
the transaction — `TELEGRAPH_EVM_PRIVATE_KEY` lives in your local `.env`
(generated for you on `init` if you don't have one yet, same pattern as
[telegraph-mcp](https://github.com/telegraphprotocol/telegraph-mcp)) and
never leaves your machine.

Redeploying with unchanged config is a no-op. Changing intents/price/code
requires an explicit `telegraph-miner update` — deploy never silently
deregisters a live miner.

## Status

Early / unreleased. Built against the Base Sepolia testnet deployment
documented in the main Telegraph repo
(`docs/testnet-deployment-base-sepolia.md`). Not yet published to npm.
