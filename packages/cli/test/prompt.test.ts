import { describe, it, expect, vi, afterEach } from "vitest";
import { Readable, Writable } from "node:stream";
import { openPrompt } from "../src/prompt.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Regression test for a real bug found while manually driving the CLI with
// piped input: piped (non-TTY) stdin usually arrives as one chunk
// containing every line, then closes immediately. Looping
// readline.Interface.question() across multiple prompts races that close —
// whichever question is in flight when the stream hits EOF can reject with
// "readline was closed" even though later lines were already buffered, so
// only the first (or first couple, depending on timing) prompt(s) ever got
// real answers. Fixed by driving prompts through the async-iterator
// protocol instead (see prompt.ts) — this test pipes all answers in a
// single chunk, the same shape a piped `printf ... | telegraph-miner init`
// produces, and asserts every question still resolves correctly in order.
function fakeStdio(input: string) {
  const stdin = Readable.from([input]) as NodeJS.ReadStream;
  const stdout = new Writable({ write(_c, _e, cb) { cb(); } }) as unknown as NodeJS.WriteStream;
  vi.spyOn(process, "stdin", "get").mockReturnValue(stdin);
  vi.spyOn(process, "stdout", "get").mockReturnValue(stdout);
}

describe("openPrompt (piped multi-line input)", () => {
  it("resolves every question in order from a single buffered chunk", async () => {
    fakeStdio("line-one\nline-two\nline-three\n");
    const prompter = openPrompt();

    expect(await prompter.ask("Q1", "default1")).toBe("line-one");
    expect(await prompter.ask("Q2", "default2")).toBe("line-two");
    expect(await prompter.ask("Q3", "default3")).toBe("line-three");

    prompter.close();
  });

  it("falls back to the default on an empty line", async () => {
    fakeStdio("\n");
    const prompter = openPrompt();

    expect(await prompter.ask("Q", "fallback")).toBe("fallback");

    prompter.close();
  });

  it("falls back to the default when input ends early (fewer lines than questions)", async () => {
    fakeStdio("only-one\n");
    const prompter = openPrompt();

    expect(await prompter.ask("Q1", "d1")).toBe("only-one");
    expect(await prompter.ask("Q2", "d2")).toBe("d2");

    prompter.close();
  });
});
