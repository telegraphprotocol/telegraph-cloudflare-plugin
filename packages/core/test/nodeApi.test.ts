import { describe, it, expect, vi, afterEach } from "vitest";
import { pickFreeYamlId } from "../src/nodeApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pickFreeYamlId", () => {
  it("returns max(id) + 1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: 3 }, { id: 7 }, { id: 1 }]), { status: 200 }))
    );
    expect(await pickFreeYamlId("http://node")).toBe(8);
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
