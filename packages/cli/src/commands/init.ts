import {
  resolveNetwork,
  makePublicClient,
  getCanonicalIntents,
  pickFreeYamlId,
} from "@telegraph/miner-core";
import { loadOrCreateWallet } from "../wallet.js";
import { readConfig, readState, writeConfig } from "../state.js";
import { openPrompt } from "../prompt.js";

export async function initCommand(cwd: string): Promise<void> {
  const existing = readConfig(cwd);
  if (existing && readState(cwd)) {
    console.log(`This miner is already registered (slug: ${existing.slug}). Edit telegraph.config.json and run \`telegraph-miner update\` instead.`);
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

  const prompter = openPrompt();
  let slug: string, name: string, description: string, intentsRaw: string, priceRaw: string, feeAddress: string;
  try {
    if (existing) {
      const replace = await prompter.ask(`Replace the existing telegraph.config.json (slug: ${existing.slug})? y/N`, "N");
      if (replace.toLowerCase() !== "y") return;
    }
    slug = await prompter.ask("Miner slug (kebab-case)", "my-miner");
    name = await prompter.ask("Display name", slug);
    description = await prompter.ask("Description (optional)");

    console.log(`Intents and what each one means: ${network.nodeApiUrl}/engine/v1/intents`);
    for (let last = ""; ; last = intentsRaw) {
      intentsRaw = await prompter.ask("Supported intents (comma-separated)", "WEB_SEARCH_GENERAL");
      const list = splitList(intentsRaw);
      const unknown = canonicalIntents.length ? list.filter((i) => !canonicalIntents.includes(i)) : [];
      if (list.length > 0 && unknown.length === 0) break;
      if (intentsRaw === last) throw new Error("No valid intent given. Run `telegraph-miner init` again.");
      if (list.length === 0) console.log("List at least one intent.");
      for (const name of unknown) {
        const close = canonicalIntents.filter((i) => i.startsWith(name));
        console.log(`"${name}" is not an intent on the network.${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`);
      }
    }
    priceRaw = await prompter.ask("Floor price in micro-USDC (10000 = $0.01)", "10000");
    feeAddress = await prompter.ask("Payout address", wallet.address);
  } finally {
    prompter.close();
  }

  const supportedIntents = splitList(intentsRaw);
  const minPriceUsdc = Number.parseInt(priceRaw, 10);

  writeConfig(cwd, {
    slug,
    name,
    ...(description ? { description } : {}),
    supportedIntents,
    minPriceUsdc,
    feeAddress: feeAddress as `0x${string}`,
    // Picked now, so the Worker serves a valid manifest under `wrangler dev` before the first deploy.
    yamlId: await pickFreeYamlId(network.nodeApiUrl),
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
  console.log("  2. Try it locally: `npx wrangler dev`, then open http://localhost:8787/.well-known/telegraph.yaml");
  console.log("  3. Sign in to Cloudflare once: `npx wrangler login`");
  console.log(`  4. Put about 0.01 Sepolia ETH on ${wallet.address} (free faucet, e.g. https://cloud.google.com/application/web3/faucet/ethereum/sepolia)`);
  console.log("  5. Run `npx telegraph-miner deploy`. It also gets the MACHINA bond for you.");
}

function splitList(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
