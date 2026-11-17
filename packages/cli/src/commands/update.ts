import {
  resolveNetwork,
  makeClients,
  updateMiner,
  ensureMinerBond,
  fetchServedYaml,
  pollUntilSettled,
  sha256Hex,
} from "@telegraph/miner-core";
import { readConfig, readState, writeState } from "../state.js";
import { loadOrCreateWallet } from "../wallet.js";
import { wranglerDeploy } from "../wrangler.js";

export async function updateCommand(cwd: string): Promise<void> {
  const config = readConfig(cwd);
  const state = readState(cwd);
  if (!config || !state) {
    console.error("No existing registration found. Run `telegraph-miner deploy` first.");
    process.exitCode = 1;
    return;
  }

  const network = resolveNetwork(process.env.TELEGRAPH_NETWORK);

  console.log("Running wrangler deploy...");
  const workerUrl = await wranglerDeploy(cwd);
  const yamlUrl = `${workerUrl}/.well-known/telegraph.yaml`;

  console.log(`Fetching manifest from ${yamlUrl}...`);
  const yamlText = await fetchServedYaml(yamlUrl);
  const yamlHash = sha256Hex(yamlText);

  const wallet = loadOrCreateWallet(cwd);
  const clients = makeClients(network, wallet.privateKey);
  await ensureMinerBond(clients, network, config.supportedIntents.length);

  console.log(`Submitting updateMiner (replacing registrationId=${state.registrationId})...`);
  const { txHash, registrationId } = await updateMiner(
    clients,
    network.diamondAddress,
    BigInt(state.registrationId),
    {
      yamlUrl,
      yamlHash,
      feeAddress: config.feeAddress ?? wallet.address,
      minPriceUsdc: BigInt(config.minPriceUsdc),
      supportedIntents: config.supportedIntents,
    }
  );
  console.log(`Tx: ${txHash}`);
  console.log(`New registration id: ${registrationId} (old id ${state.registrationId} is now deregistered)`);

  writeState(cwd, {
    ...state,
    registrationId: registrationId.toString(),
    lastYamlHash: yamlHash,
    updatedAt: new Date().toISOString(),
  });

  console.log("Waiting for activation...");
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
