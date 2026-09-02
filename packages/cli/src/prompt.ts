import { createInterface } from "node:readline/promises";

// Piped (non-TTY) stdin typically arrives as one chunk and closes
// immediately after. readline.Interface.question(), called repeatedly
// across multiple questions, races that close: whichever question is
// in flight when the underlying stream hits EOF can reject with
// "readline was closed" even though later lines were already buffered.
// The async-iterator protocol (`rl[Symbol.asyncIterator]()`) does not have
// this race — it hands back already-buffered lines before signalling done,
// on both piped and interactive (TTY) input — so we drive prompts through
// that instead of .question().
export interface Prompter {
  ask(question: string, defaultValue?: string): Promise<string>;
  close(): void;
}

export function openPrompt(): Prompter {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();

  return {
    async ask(question: string, defaultValue?: string): Promise<string> {
      const suffix = defaultValue ? ` (${defaultValue})` : "";
      process.stdout.write(`${question}${suffix}: `);
      const { value, done } = await lines.next();
      const answer = (done ? "" : value).trim();
      return answer || defaultValue || "";
    },
    close(): void {
      rl.close();
    },
  };
}
