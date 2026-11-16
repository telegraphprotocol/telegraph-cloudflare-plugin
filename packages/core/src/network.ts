export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  diamondAddress: `0x${string}`;
  nodeApiUrl: string;
  /** Uniswap SwapRouter02, used to buy the MACHINA miner bond with test USDC. */
  swapRouter: `0x${string}`;
  /** Fee tier of the MACHINA/USDC pool the bond is priced on. */
  poolFee: number;
}

// Beta 2 testnet on Ethereum Sepolia — from protocol/addresses-and-params.md
// in telegraph-docs. Override any of these via env vars for other networks.
export const NETWORKS: Record<string, NetworkConfig> = {
  "beta-2": {
    chainId: 11155111,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    diamondAddress: "0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b",
    nodeApiUrl: "https://devnode.telegraphprotocol.com",
    swapRouter: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    poolFee: 3000,
  },
};

export function resolveNetwork(name = "beta-2"): NetworkConfig {
  const base = NETWORKS[name];
  if (!base) {
    throw new Error(`Unknown network "${name}". Known: ${Object.keys(NETWORKS).join(", ")}`);
  }
  return {
    ...base,
    chainId: Number(process.env.TELEGRAPH_CHAIN_ID) || base.chainId,
    rpcUrl: process.env.TELEGRAPH_RPC_URL || base.rpcUrl,
    diamondAddress: (process.env.TELEGRAPH_DIAMOND_ADDRESS as `0x${string}`) || base.diamondAddress,
    nodeApiUrl: process.env.TELEGRAPH_NODE_URL || base.nodeApiUrl,
  };
}
