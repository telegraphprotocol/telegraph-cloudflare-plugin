export interface MinerConfig {
  /** kebab-case, e.g. "acme-scraper" */
  slug: string;
  /** human-readable display name */
  name: string;
  description?: string;
  /** canonical intent strings, e.g. ["WEB_SEARCH_GENERAL"] */
  supportedIntents: string[];
  /** floor price in 6-decimal USDC (10000 = $0.01), minimum 10000 */
  minPriceUsdc: number;
  /** payout address; defaults to the wallet address if unset */
  feeAddress?: `0x${string}`;
}

export interface ResolvedMinerConfig extends MinerConfig {
  /** numeric YAML `id`, unique across active miners, picked at deploy time */
  yamlId: number;
  baseUrl: string;
  feeAddress: `0x${string}`;
}

export interface RegistrationState {
  network: string;
  yamlId: number;
  registrationId: string;
  slug: string;
  lastYamlHash: `0x${string}`;
  updatedAt: string;
}

export interface MinerStatus {
  activation_status: string;
  rejection_reason: string | null;
  retrying?: boolean;
  [key: string]: unknown;
}
