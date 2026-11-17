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

You need Node 18+, a free Cloudflare account and about 0.01 Sepolia ETH.

```bash
git clone https://github.com/telegraphprotocol/telegraph-cloudflare-plugin.git
cd telegraph-cloudflare-plugin
npm install                      # also builds the packages

cd examples/kitesurf-scraper     # your miner: put your own logic in src/index.ts
npx telegraph-miner init         # slug, intents, price; makes a wallet in .env
npx wrangler dev                 # try it: http://localhost:8787/.well-known/telegraph.yaml
npx wrangler login               # once, opens Cloudflare in the browser
npx telegraph-miner deploy       # deploys, gets the bond, registers on-chain
npx telegraph-miner status       # check activation any time
```

Before `deploy`, send about 0.01 Sepolia ETH to the wallet address `init`
printed (free faucet, e.g.
[Google's](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)).
That is the only thing to fetch by hand: registering takes a MACHINA bond
(about $1, returned when you deregister), and on the testnet `deploy` mints
test USDC and swaps it for the bond itself.

## How it works

```
telegraph-miner deploy
  → wrangler deploy                         (your code goes live)
  → GET {workers.dev url}/.well-known/telegraph.yaml   (served by the SDK)
  → sha256 the response
  → approve the MACHINA bond (bought with test USDC if needed)
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

Early / unreleased. Targets the beta 2 testnet on Ethereum Sepolia
(addresses in telegraph-docs `protocol/addresses-and-params.md`). Not yet
published to npm, so run it from this repo as above.
