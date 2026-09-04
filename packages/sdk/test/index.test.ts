import { describe, it, expect } from "vitest";
import { withTelegraphMiner } from "../src/index.js";
import { parse } from "yaml";

const config = {
  slug: "test-miner",
  name: "Test Miner",
  supportedIntents: ["WEB_SEARCH"],
  minPriceUsdc: 10000,
  feeAddress: "0x000000000000000000000000000000000000aa" as const,
  yamlId: 1,
};

describe("withTelegraphMiner", () => {
  it("serves a valid manifest with base_url derived from the request origin", async () => {
    const fetch = withTelegraphMiner(async () => ({ result: null }), config);
    const res = await fetch(new Request("https://my-worker.example.workers.dev/.well-known/telegraph.yaml"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/yaml");
    const doc = parse(await res.text());
    expect(doc.base_url).toBe("https://my-worker.example.workers.dev");
    expect(doc.slug).toBe("test-miner");
  });

  it("explains a bad manifest config in the response body, not an opaque 500", async () => {
    const { yamlId, ...noId } = config;
    const fetch = withTelegraphMiner(async () => ({ result: null }), noId as typeof config);
    const res = await fetch(new Request("https://my-worker.example.workers.dev/.well-known/telegraph.yaml"));

    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/yamlId/);
  });

  it("routes POST / to the handler and wraps the result", async () => {
    const fetch = withTelegraphMiner(
      async ({ intent, query }) => ({ result: { echoed: query, intent } }),
      config
    );
    const res = await fetch(
      new Request("https://my-worker.example.workers.dev/", {
        method: "POST",
        body: JSON.stringify({ intent: "WEB_SEARCH", query: "hello" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toEqual({ echoed: "hello", intent: "WEB_SEARCH" });
  });

  it("rejects a body missing query/intent", async () => {
    const fetch = withTelegraphMiner(async () => ({ result: null }), config);
    const res = await fetch(
      new Request("https://my-worker.example.workers.dev/", {
        method: "POST",
        body: JSON.stringify({ query: "hello" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("turns a handler throw into a 502", async () => {
    const fetch = withTelegraphMiner(async () => {
      throw new Error("upstream boom");
    }, config);
    const res = await fetch(
      new Request("https://my-worker.example.workers.dev/", {
        method: "POST",
        body: JSON.stringify({ intent: "WEB_SEARCH", query: "hello" }),
      })
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("upstream boom");
  });

  it("404s on any other path", async () => {
    const fetch = withTelegraphMiner(async () => ({ result: null }), config);
    const res = await fetch(new Request("https://my-worker.example.workers.dev/nope"));
    expect(res.status).toBe(404);
  });
});
