import { resolveNetwork, getMinerStatus } from "@telegraph/miner-core";
import { readState } from "../state.js";

export async function statusCommand(cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state) {
    console.error("No registration found. Run `telegraph-miner deploy` first.");
    process.exitCode = 1;
    return;
  }

  const network = resolveNetwork(process.env.TELEGRAPH_NETWORK);
  const status = await getMinerStatus(network.nodeApiUrl, state.registrationId);
  if (!status) {
    console.log(`slug:              ${state.slug}`);
    console.log(`registrationId:    ${state.registrationId}`);
    console.log("activation_status: not indexed by the node yet");
    return;
  }

  console.log(`slug:              ${state.slug}`);
  console.log(`registrationId:    ${state.registrationId}`);
  console.log(`activation_status: ${status.activation_status}`);
  if (status.rejection_reason) console.log(`rejection_reason:  ${status.rejection_reason}`);
  if (typeof status.retrying === "boolean") console.log(`retrying:          ${status.retrying}`);
  console.log(`last updated:      ${state.updatedAt}`);
}
