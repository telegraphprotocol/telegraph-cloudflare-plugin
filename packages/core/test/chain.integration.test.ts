import { describe, it, expect } from "vitest";
import { makeClients, registerMiner, updateMiner, deregisterMiner } from "../src/chain.js";
import { sha256Hex } from "../src/hash.js";
import type { NetworkConfig } from "../src/network.js";

// Exercises the real registerMiner/updateMiner/deregisterMiner call + event
// decoding path against a live chain (Anvil, or testnet). Mirrors
// scripts/prod/register-miners.sh in the main Telegraph repo: it assumes a
// diamond is already deployed and reachable, it doesn't stand one up.
//
// Run with:
//   ANVIL_RPC_URL=http://localhost:8545 \
//   ANVIL_DIAMOND_ADDRESS=0x... \
//   ANVIL_PRIVATE_KEY=0x... \
//   npm run test --workspace=@telegraph/miner-core
//
// Skipped by default — no local Anvil/diamond fixture in this repo yet.
const RPC_URL = process.env.ANVIL_RPC_URL;
const DIAMOND = process.env.ANVIL_DIAMOND_ADDRESS as `0x${string}` | undefined;
const PRIVATE_KEY = process.env.ANVIL_PRIVATE_KEY as `0x${string}` | undefined;

describe.skipIf(!RPC_URL || !DIAMOND || !PRIVATE_KEY)("registerMiner (live chain)", () => {
  const network: NetworkConfig = {
    chainId: Number(process.env.ANVIL_CHAIN_ID || 31337),
    rpcUrl: RPC_URL!,
    diamondAddress: DIAMOND!,
    nodeApiUrl: "unused-in-this-test",
  };

  it("registers, updates, and deregisters, decoding the right event each time", async () => {
    const clients = makeClients(network, PRIVATE_KEY!);
    const yaml = `version: "1"\nkind: miner\nid: 999001\nslug: chain-it-test\nname: Chain IT Test\nbase_url: https://example.workers.dev\n`;

    const reg = await registerMiner(clients, network.diamondAddress, {
      yamlUrl: "https://example.workers.dev/.well-known/telegraph.yaml",
      yamlHash: sha256Hex(yaml),
      feeAddress: clients.account.address,
      minPriceUsdc: 10000n,
      supportedIntents: ["WEB_SEARCH"],
    });
    expect(reg.registrationId).toBeGreaterThan(0n);

    const updatedYaml = yaml.replace("chain-it-test", "chain-it-test-v2");
    const upd = await updateMiner(clients, network.diamondAddress, reg.registrationId, {
      yamlUrl: "https://example.workers.dev/.well-known/telegraph.yaml",
      yamlHash: sha256Hex(updatedYaml),
      feeAddress: clients.account.address,
      minPriceUsdc: 10000n,
      supportedIntents: ["WEB_SEARCH", "NEWS_SEARCH"],
    });
    expect(upd.registrationId).toBeGreaterThan(reg.registrationId);

    await expect(
      deregisterMiner(clients, network.diamondAddress, upd.registrationId)
    ).resolves.toBeDefined();
  }, 60_000);
});
