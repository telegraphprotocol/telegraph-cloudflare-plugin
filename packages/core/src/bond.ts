import { erc20Abi, formatEther, parseAbi, type Hex } from "viem";
import type { Clients } from "./chain.js";
import type { NetworkConfig } from "./network.js";

const diamondAbi = parseAbi([
  "function quoteMinerBond(uint256 intentCount) view returns (uint256 usd, uint256 machina)",
  "function machinaToken() view returns (address)",
  "function usdcToken() view returns (address)",
]);
const testUsdcAbi = parseAbi(["function mint(address to, uint256 amount)"]);
const routerAbi = parseAbi([
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountIn)",
]);

/**
 * Registering takes a MACHINA bond (returned on deregistration). On the
 * testnet the plugin covers it for the miner: it mints test USDC (anyone can),
 * swaps it for the MACHINA it needs and approves the diamond. Only Sepolia ETH
 * for gas has to come from a faucet.
 */
export async function ensureMinerBond(clients: Clients, network: NetworkConfig, intentCount: number): Promise<void> {
  const { publicClient, walletClient, account } = clients;
  const me = account.address;
  const diamond = network.diamondAddress;
  const chain = walletClient.chain;

  if ((await publicClient.getBalance({ address: me })) === 0n) {
    throw new Error(
      `Your miner wallet ${me} has no Sepolia ETH for gas.\n` +
        "Get about 0.01 from a free faucet, e.g. https://cloud.google.com/application/web3/faucet/ethereum/sepolia, then run this again."
    );
  }

  const [usd, quoted] = await publicClient.readContract({
    address: diamond, abi: diamondAbi, functionName: "quoteMinerBond", args: [BigInt(intentCount)],
  });
  // The bond follows the pool price, which can move before the tx lands.
  const need = quoted + quoted / 20n;
  const machina = await publicClient.readContract({ address: diamond, abi: diamondAbi, functionName: "machinaToken" });

  const send = async (address: Hex, abi: any, functionName: string, args: unknown[]) => {
    const hash = await walletClient.writeContract({ address, abi, functionName, args, account, chain });
    await publicClient.waitForTransactionReceipt({ hash });
  };

  const have = await publicClient.readContract({ address: machina, abi: erc20Abi, functionName: "balanceOf", args: [me] });
  if (have < need) {
    const usdc = await publicClient.readContract({ address: diamond, abi: diamondAbi, functionName: "usdcToken" });
    const usdcMax = usd * 2n;
    console.log(`Getting the ${formatEther(need)} MACHINA bond (test USDC, swapped on the testnet pool)...`);
    await send(usdc, testUsdcAbi, "mint", [me, usdcMax]);
    await send(usdc, erc20Abi, "approve", [network.swapRouter, usdcMax]);
    await send(network.swapRouter, routerAbi, "exactOutputSingle", [
      { tokenIn: usdc, tokenOut: machina, fee: network.poolFee, recipient: me, amountOut: need - have, amountInMaximum: usdcMax, sqrtPriceLimitX96: 0n },
    ]);
  }

  const allowed = await publicClient.readContract({ address: machina, abi: erc20Abi, functionName: "allowance", args: [me, diamond] });
  if (allowed < need) {
    await send(machina, erc20Abi, "approve", [diamond, need]);
  }
}
