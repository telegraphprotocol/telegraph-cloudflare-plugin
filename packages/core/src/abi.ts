// MinerRegistryFacet ABI fragment — from contracts/evm/facets/MinerRegistryFacet.sol
// in the main Telegraph repo. Only the functions/events this plugin calls.
export const minerRegistryAbi = [
  {
    type: "function",
    name: "registerMiner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "yamlUrl", type: "string" },
      { name: "yamlHash", type: "bytes32" },
      { name: "feeAddress", type: "address" },
      { name: "minPriceUsdc", type: "uint256" },
      { name: "supportedIntents", type: "string[]" },
    ],
    outputs: [{ name: "registrationId", type: "uint256" }],
  },
  {
    type: "function",
    name: "updateMiner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "oldRegistrationId", type: "uint256" },
      { name: "yamlUrl", type: "string" },
      { name: "yamlHash", type: "bytes32" },
      { name: "feeAddress", type: "address" },
      { name: "minPriceUsdc", type: "uint256" },
      { name: "supportedIntents", type: "string[]" },
    ],
    outputs: [{ name: "newRegistrationId", type: "uint256" }],
  },
  {
    type: "function",
    name: "deregisterMiner",
    stateMutability: "nonpayable",
    inputs: [{ name: "registrationId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getCanonicalIntents",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string[]" }],
  },
  {
    type: "event",
    name: "MinerRegistered",
    inputs: [
      { name: "registrationId", type: "uint256", indexed: true },
      { name: "miner", type: "address", indexed: true },
      { name: "yamlUrl", type: "string", indexed: false },
      { name: "yamlHash", type: "bytes32", indexed: false },
      { name: "feeAddress", type: "address", indexed: false },
      { name: "minPriceUsdc", type: "uint256", indexed: false },
      { name: "supportedIntents", type: "string[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MinerUpdated",
    inputs: [
      { name: "oldRegistrationId", type: "uint256", indexed: true },
      { name: "newRegistrationId", type: "uint256", indexed: true },
      { name: "miner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MinerDeregistered",
    inputs: [
      { name: "registrationId", type: "uint256", indexed: true },
      { name: "miner", type: "address", indexed: true },
    ],
  },
] as const;
