import { describe, it, expect, vi, afterEach } from "vitest";
import { pickFreeYamlId, getMinerStatus, pollUntilSettled } from "../src/nodeApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pickFreeYamlId", () => {
  it("returns the smallest free id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: 3 }, { id: 1 }, { id: 2 }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(4);
  });

  it("fills a gap rather than running past the maximum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: 1 }, { id: 2 }, { id: 708425 }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(3);
  });

  it("treats id 0 as taken, never returning it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: 0 }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(1);
  });

  // Regression: the live node returns `id` as a string ("200"), not a
  // number. A typeof-number filter silently dropped every record and
  // returned 1 — an id already taken on any populated network, so the
  // registration came back rejected for an id conflict.
  it("handles string ids as the live node actually returns them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: "1" }, { id: "2" }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(3);
  });

  it("ignores records with a missing or unparseable id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: "1" }, {}, { id: "not-a-number" }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(2);
  });

  it("returns 1 when there are no existing miners", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    expect(await pickFreeYamlId("http://node")).toBe(1);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(pickFreeYamlId("http://node")).rejects.toThrow("500");
  });
});

// Regression: a registration confirmed on-chain is absent from miner_registry
// until the node indexes the event, so the first poll after deploy 404s. That
// aborted the whole deploy with a raw "failed: 404" — observed live on
// registration 420, which landed one id past the node's frontier.
describe("getMinerStatus", () => {
  it("returns null on 404 rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"miner registration not found"}', { status: 404 })));
    expect(await getMinerStatus("http://node", "420")).toBeNull();
  });

  it("still throws on a real server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(getMinerStatus("http://node", "420")).rejects.toThrow("500");
  });

  it("unwraps the { miner } envelope the node sends", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ miner: { activation_status: "active" } }), { status: 200 }))
    );
    expect((await getMinerStatus("http://node", "419"))?.activation_status).toBe("active");
  });
});

describe("pollUntilSettled", () => {
  it("keeps polling while unindexed, then settles once the row appears", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        return calls < 3
          ? new Response("{}", { status: 404 })
          : new Response(JSON.stringify({ miner: { activation_status: "active" } }), { status: 200 });
      })
    );
    const status = await pollUntilSettled("http://node", "420", { intervalMs: 1, timeoutMs: 5000 });
    expect(status?.activation_status).toBe("active");
    expect(calls).toBe(3);
  });

  it("resolves null if it is still unindexed at the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await pollUntilSettled("http://node", "420", { intervalMs: 1, timeoutMs: 30 })).toBeNull();
  });
});
