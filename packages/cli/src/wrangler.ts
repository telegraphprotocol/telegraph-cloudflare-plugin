import { spawn } from "node:child_process";

/**
 * Runs `wrangler deploy` and extracts the deployed workers.dev URL from its
 * stdout. Wrangler has no stable machine-readable output for `deploy`, so
 * this is a best-effort regex over the human-readable log — the same thing
 * a developer would eyeball to find their URL. If the deploy used a custom
 * domain wrangler doesn't print in this shape, set TELEGRAPH_WORKER_URL to
 * skip detection entirely.
 */
export async function wranglerDeploy(cwd: string): Promise<string> {
  const override = process.env.TELEGRAPH_WORKER_URL;
  if (override) return override.replace(/\/$/, "");

  const output = await run("wrangler", ["deploy"], cwd);
  return extractWorkerUrl(output);
}

/** Pure so it's testable without spawning a process — see wrangler.test.ts. */
export function extractWorkerUrl(wranglerOutput: string): string {
  const match = wranglerOutput.match(/https?:\/\/[^\s]+\.workers\.dev/);
  if (!match) {
    throw new Error(
      "wrangler deploy succeeded but no *.workers.dev URL was found in its output. " +
        "Set TELEGRAPH_WORKER_URL=<your deployed url> and re-run if you're using a custom domain."
    );
  }
  return match[0].replace(/\/$/, "");
}

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
      } else {
        resolve(out);
      }
    });
  });
}
