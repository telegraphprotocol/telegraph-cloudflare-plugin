import { describe, it, expect } from "vitest";
import { extractWorkerUrl } from "../src/wrangler.js";

describe("extractWorkerUrl", () => {
  it("finds a workers.dev URL in typical wrangler output", () => {
    const output = `
 ⛅️ wrangler 3.90.0
-------------------
Total Upload: 12.34 KiB / gzip: 4.56 KiB
Uploaded acme-scraper (1.23 sec)
Deployed acme-scraper triggers (0.45 sec)
  https://acme-scraper.my-account.workers.dev
Current Version ID: abc-123
`;
    expect(extractWorkerUrl(output)).toBe("https://acme-scraper.my-account.workers.dev");
  });

  it("strips a trailing slash", () => {
    expect(extractWorkerUrl("https://foo.workers.dev/\n")).toBe("https://foo.workers.dev");
  });

  it("throws when no workers.dev URL is present", () => {
    expect(() => extractWorkerUrl("Deployed to https://example.com\n")).toThrow(
      /no \*\.workers\.dev URL/
    );
  });
});
