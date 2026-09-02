export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  diamondAddress: `0x${string}`;
  nodeApiUrl: string;
}

// Base Sepolia testnet — from docs/testnet-deployment-base-sepolia.md in the
// main Telegraph repo. Override any of these via env vars for other networks.
export const NETWORKS: Record<string, NetworkConfig> = {
  "base-sepolia": {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    diamondAddress: "0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8",
    nodeApiUrl: "http://13.237.89.59:7044",
  },
};

export function resolveNetwork(name = "base-sepolia"): NetworkConfig {
  const base = NETWORKS[name];
  if (!base) {
    throw new Error(`Unknown network "${name}". Known: ${Object.keys(NETWORKS).join(", ")}`);
  }
  return {
    chainId: base.chainId,
    rpcUrl: process.env.TELEGRAPH_RPC_URL || base.rpcUrl,
    diamondAddress: (process.env.TELEGRAPH_DIAMOND_ADDRESS as `0x${string}`) || base.diamondAddress,
    nodeApiUrl: process.env.TELEGRAPH_NODE_URL || base.nodeApiUrl,
  };
}
