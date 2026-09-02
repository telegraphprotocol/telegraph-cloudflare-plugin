import { withTelegraphMiner } from "@telegraph/miner-sdk";
import config from "../telegraph.config.json";

// Replace this with your actual scraper logic — e.g. a Kitesurf-based
// headless-browser fetch. `withTelegraphMiner` handles everything
// Telegraph-specific: the manifest endpoint, request/response envelope,
// and error formatting.
async function scrape(query: string): Promise<unknown> {
  const res = await fetch(`https://example.com/search?q=${encodeURIComponent(query)}`);
  return { text: await res.text() };
}

export default {
  fetch: withTelegraphMiner(async ({ query }) => {
    const result = await scrape(query);
    return { result };
  }, config as any),
};
