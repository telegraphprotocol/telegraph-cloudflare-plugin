import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { minerRegistryAbi } from "./abi.js";
import type { NetworkConfig } from "./network.js";

export function loadAccount(privateKey: Hex) {
  return privateKeyToAccount(privateKey);
}

function viemChain(network: NetworkConfig) {
  return {
    id: network.chainId,
    name: `chain-${network.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [network.rpcUrl] } },
  } as const;
}

/** Read-only client — no wallet needed. Used for e.g. getCanonicalIntents during `init`. */
export function makePublicClient(network: NetworkConfig): PublicClient {
  return createPublicClient({ chain: viemChain(network), transport: http(network.rpcUrl) });
}

export interface Clients {
  account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function makeClients(network: NetworkConfig, privateKey: Hex): Clients {
  const account = loadAccount(privateKey);
  const chain = viemChain(network);
  const publicClient = createPublicClient({ chain, transport: http(network.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(network.rpcUrl) });
  return { account, publicClient, walletClient };
}

export interface RegisterArgs {
  yamlUrl: string;
  yamlHash: Hex;
  feeAddress: Hex;
  minPriceUsdc: bigint;
  supportedIntents: string[];
}

async function sendAndGetRegistrationId(
  clients: ReturnType<typeof makeClients>,
  diamondAddress: Hex,
  functionName: "registerMiner" | "updateMiner",
  args: unknown[],
  eventName: "MinerRegistered" | "MinerUpdated",
  idField: "registrationId" | "newRegistrationId"
): Promise<{ txHash: Hex; registrationId: bigint }> {
  const { publicClient, walletClient, account } = clients;

  // functionName/args are dynamic here on purpose (this helper drives both
  // registerMiner and updateMiner) — that's one thing too many for viem's
  // per-function ABI overload inference, so we step outside it deliberately
  // rather than fighting the type checker for two call sites.
  const request = {
    address: diamondAddress,
    abi: minerRegistryAbi,
    functionName,
    args,
    account,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0];
  // The diamond forwards calls into libraries, so a tx sent with exactly the
  // estimate can run out of gas inside them (updateMiner did on beta 2).
  const gas = ((await publicClient.estimateContractGas(request as never)) * 13n) / 10n;
  const hash = await walletClient.writeContract({ ...request, gas });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${functionName} failed on-chain (tx ${hash}).`);
  }

  const logs = parseEventLogs({
    abi: minerRegistryAbi,
    eventName,
    logs: receipt.logs,
  });

  if (logs.length === 0) {
    throw new Error(
      `${functionName} confirmed (tx ${hash}) but no ${eventName} event was found in the receipt`
    );
  }

  const registrationId = (logs[0].args as unknown as Record<string, bigint>)[idField];
  return { txHash: hash, registrationId };
}

export async function registerMiner(
  clients: ReturnType<typeof makeClients>,
  diamondAddress: Hex,
  args: RegisterArgs
) {
  return sendAndGetRegistrationId(
    clients,
    diamondAddress,
    "registerMiner",
    [args.yamlUrl, args.yamlHash, args.feeAddress, args.minPriceUsdc, args.supportedIntents],
    "MinerRegistered",
    "registrationId"
  );
}

export async function updateMiner(
  clients: ReturnType<typeof makeClients>,
  diamondAddress: Hex,
  oldRegistrationId: bigint,
  args: RegisterArgs
) {
  return sendAndGetRegistrationId(
    clients,
    diamondAddress,
    "updateMiner",
    [
      oldRegistrationId,
      args.yamlUrl,
      args.yamlHash,
      args.feeAddress,
      args.minPriceUsdc,
      args.supportedIntents,
    ],
    "MinerUpdated",
    "newRegistrationId"
  );
}

export async function deregisterMiner(
  clients: ReturnType<typeof makeClients>,
  diamondAddress: Hex,
  registrationId: bigint
) {
  const { publicClient, walletClient, account } = clients;
  const hash = await walletClient.writeContract({
    address: diamondAddress,
    abi: minerRegistryAbi,
    functionName: "deregisterMiner",
    args: [registrationId],
    account,
    chain: walletClient.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function getCanonicalIntents(
  clients: { publicClient: ReturnType<typeof makePublicClient> },
  diamondAddress: Hex
): Promise<string[]> {
  return clients.publicClient.readContract({
    address: diamondAddress,
    abi: minerRegistryAbi,
    functionName: "getCanonicalIntents",
  }) as Promise<string[]>;
}
