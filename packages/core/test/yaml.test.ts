import { describe, it, expect } from "vitest";
import { buildIntegrationYaml } from "../src/yaml.js";
import { sha256Hex } from "../src/hash.js";
import { parse } from "yaml";
import type { ResolvedMinerConfig } from "../src/types.js";

const cfg: ResolvedMinerConfig = {
  slug: "acme-scraper",
  name: "Acme Scraper",
  description: "Scrapes acme.com",
  supportedIntents: ["WEB_SEARCH", "NEWS_SEARCH"],
  minPriceUsdc: 10000,
  yamlId: 42,
  baseUrl: "https://acme-scraper.example.workers.dev",
  feeAddress: "0x000000000000000000000000000000000000aa",
};

describe("buildIntegrationYaml", () => {
  it("produces YAML satisfying the schema's required fields", () => {
    const yaml = buildIntegrationYaml(cfg);
    const doc = parse(yaml);

    expect(doc.version).toBe("1");
    expect(doc.kind).toBe("miner");
    expect(doc.id).toBe(42);
    expect(doc.slug).toBe("acme-scraper");
    expect(doc.name).toBe("Acme Scraper");
    expect(doc.base_url).toBe(cfg.baseUrl);
  });

  it("declares exactly the fixed wire-contract endpoint", () => {
    const doc = parse(buildIntegrationYaml(cfg));
    expect(doc.endpoints).toHaveLength(1);
    expect(doc.endpoints[0]).toMatchObject({
      path: "/answer",
      external_path: "/",
      method: "POST",
      intents: cfg.supportedIntents,
    });
  });

  it("is deterministic — same config hashes the same", () => {
    const a = sha256Hex(buildIntegrationYaml(cfg));
    const b = sha256Hex(buildIntegrationYaml({ ...cfg }));
    expect(a).toBe(b);
  });

  it("changes hash when intents change", () => {
    const a = sha256Hex(buildIntegrationYaml(cfg));
    const b = sha256Hex(buildIntegrationYaml({ ...cfg, supportedIntents: ["WEB_SEARCH"] }));
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("matches the known sha256(\"\") vector", () => {
    expect(sha256Hex("")).toBe(
      "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});
