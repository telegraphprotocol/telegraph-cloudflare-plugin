#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { initCommand } from "./commands/init.js";
import { deployCommand } from "./commands/deploy.js";
import { updateCommand } from "./commands/update.js";
import { statusCommand } from "./commands/status.js";

const cwd = process.cwd();
loadDotenv({ path: `${cwd}/.env` });

const HELP = `telegraph-miner <command>

Commands:
  init      Interactively create telegraph.config.json (and a wallet if you don't have one)
  deploy    Run wrangler deploy, then register (first run) or no-op/warn (later runs)
  update    Re-deploy and atomically replace your registration with the new config
  status    Print the current activation status of your registration

Env:
  TELEGRAPH_EVM_PRIVATE_KEY   Miner wallet key (generated into .env by init if unset)
  TELEGRAPH_NETWORK           Network name (default: beta-2)
  TELEGRAPH_NODE_URL          Override the node API URL
  TELEGRAPH_WORKER_URL        Skip wrangler-output URL detection, use this instead
`;

async function main() {
  const [, , command] = process.argv;

  switch (command) {
    case "init":
      return initCommand(cwd);
    case "deploy":
      return deployCommand(cwd);
    case "update":
      return updateCommand(cwd);
    case "status":
      return statusCommand(cwd);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
