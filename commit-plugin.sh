#!/bin/bash
set -euo pipefail
cd /root/telegraph-repos/telegraph-miner-plugin
git add -A
git status
git commit -m "Initial telegraph-miner-plugin: SDK + CLI for one-command miner registration

Cloudflare Worker middleware serves the fixed wire contract and its own
integration YAML; the CLI wraps wrangler deploy and registers on-chain
against the Base Sepolia diamond, holding the miner's key locally.
Redeploys are idempotent; changing config requires an explicit update."
git log --oneline -5
