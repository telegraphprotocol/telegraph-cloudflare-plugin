import {
  resolveNetwork,
  makeClients,
  registerMiner,
  ensureMinerBond,
  pickFreeYamlId,
  fetchServedYaml,
  pollUntilSettled,
  sha256Hex,
} from "@telegraph/miner-core";
import { readConfig, writeConfig, readState, writeState } from "../state.js";
import { loadOrCreateWallet } from "../wallet.js";
import { wranglerDeploy } from "../wrangler.js";

export async function deployCommand(cwd: string): Promise<void> {
  const config = readConfig(cwd);
  if (!config) {
    console.error("No telegraph.config.json found. Run `telegraph-miner init` first.");
    process.exitCode = 1;
    return;
  }

  const network = resolveNetwork(process.env.TELEGRAPH_NETWORK);

  // The YAML `id` field must be baked into the deployed bundle (the Worker
  // serves its own manifest), so it has to be picked and frozen BEFORE
  // `wrangler deploy` runs, not after — see the design spec.
  if (config.yamlId === undefined) {
    config.yamlId = await pickFreeYamlId(network.nodeApiUrl);
    writeConfig(cwd, config);
    console.log(`Assigned YAML id ${config.yamlId}.`);
  }

  console.log("Running wrangler deploy...");
  const workerUrl = await wranglerDeploy(cwd);
  const yamlUrl = `${workerUrl}/.well-known/telegraph.yaml`;
  console.log(`Deployed: ${workerUrl}`);

  console.log(`Fetching manifest from ${yamlUrl} (retrying while the edge catches up)...`);
  const yamlText = await fetchServedYaml(yamlUrl);
  const yamlHash = sha256Hex(yamlText);

  const state = readState(cwd);
  if (state && state.lastYamlHash === yamlHash) {
    console.log(`Already registered (registrationId=${state.registrationId}), manifest unchanged. Nothing to do.`);
    return;
  }
  if (state && state.lastYamlHash !== yamlHash) {
    console.log(
      `Manifest changed since the last registration (registrationId=${state.registrationId}).\n` +
        "Run `telegraph-miner update` to apply the change on-chain — deploy never re-registers automatically."
    );
    process.exitCode = 1;
    return;
  }

  const wallet = loadOrCreateWallet(cwd);
  const clients = makeClients(network, wallet.privateKey);
  await ensureMinerBond(clients, network, config.supportedIntents.length);

  console.log("Submitting registerMiner...");
  const { txHash, registrationId } = await registerMiner(clients, network.diamondAddress, {
    yamlUrl,
    yamlHash,
    feeAddress: config.feeAddress ?? wallet.address,
    minPriceUsdc: BigInt(config.minPriceUsdc),
    supportedIntents: config.supportedIntents,
  });
  console.log(`Tx: ${txHash}`);
  console.log(`Registration id: ${registrationId}`);

  writeState(cwd, {
    network: process.env.TELEGRAPH_NETWORK || "beta-2",
    yamlId: config.yamlId,
    registrationId: registrationId.toString(),
    slug: config.slug,
    lastYamlHash: yamlHash,
    updatedAt: new Date().toISOString(),
  });

  console.log("Waiting for activation (this can take a few minutes)...");
  const status = await pollUntilSettled(network.nodeApiUrl, registrationId.toString());
  if (!status) {
    console.log(
      `Not indexed by the node yet. The registration is on-chain (id ${registrationId}) and will be picked up; ` +
        "run `telegraph-miner status` later to check."
    );
    return;
  }
  console.log(`Status: ${status.activation_status}${status.rejection_reason ? ` (${status.rejection_reason})` : ""}`);
}
