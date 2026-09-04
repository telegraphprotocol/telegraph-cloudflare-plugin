import { describe, it, expect, vi, afterEach } from "vitest";
import { pickFreeYamlId } from "../src/nodeApi.js";

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
