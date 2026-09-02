import {
  resolveNetwork,
  makePublicClient,
  getCanonicalIntents,
} from "@telegraph/miner-core";
import { loadOrCreateWallet } from "../wallet.js";
import { readConfig, writeConfig } from "../state.js";
import { ask } from "../prompt.js";

export async function initCommand(cwd: string): Promise<void> {
  const existing = readConfig(cwd);
  if (existing) {
    console.log(`telegraph.config.json already exists (slug: ${existing.slug}). Delete it to start over.`);
    return;
  }

  const network = resolveNetwork(process.env.TELEGRAPH_NETWORK);
  const wallet = loadOrCreateWallet(cwd);
  if (wallet.created) {
    console.log(`Generated a new wallet and saved it to .env — back this up, it holds your miner identity.`);
  }
  console.log(`Wallet address: ${wallet.address}`);

  let canonicalIntents: string[] = [];
  try {
    canonicalIntents = await getCanonicalIntents(
      { publicClient: makePublicClient(network) },
      network.diamondAddress
    );
  } catch (err) {
    console.log(`Warning: could not fetch the canonical intent list (${String(err)}). You can still type intents manually.`);
  }

  const slug = await ask("Miner slug (kebab-case)", "my-miner");
  const name = await ask("Display name", slug);
  const description = await ask("Description (optional)");

  if (canonicalIntents.length > 0) {
    console.log(`Canonical intents: ${canonicalIntents.join(", ")}`);
  }
  const intentsRaw = await ask("Supported intents (comma-separated)", "WEB_SEARCH");
  const supportedIntents = intentsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const priceRaw = await ask("Floor price in micro-USDC (10000 = $0.01)", "10000");
  const minPriceUsdc = Number.parseInt(priceRaw, 10);

  const feeAddress = await ask("Payout address", wallet.address);

  writeConfig(cwd, {
    slug,
    name,
    ...(description ? { description } : {}),
    supportedIntents,
    minPriceUsdc,
    feeAddress: feeAddress as `0x${string}`,
  });

  console.log("\nWrote telegraph.config.json.");
  console.log("\nNext steps:");
  console.log("  1. Wire your Worker's entrypoint:");
  console.log(`
     import { withTelegraphMiner } from "@telegraph/miner-sdk";
     import config from "../telegraph.config.json";

     export default {
       fetch: withTelegraphMiner(async ({ intent, query }) => {
         // ... call your existing scraper/service here ...
         return { result: /* your answer */ null };
       }, config as any),
     };
`);
  console.log("  2. Run `telegraph-miner deploy`.");
}
