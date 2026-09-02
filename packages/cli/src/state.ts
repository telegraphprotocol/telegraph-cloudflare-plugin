import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { MinerConfig, RegistrationState } from "@telegraph/miner-core";

export const CONFIG_PATH = "telegraph.config.json";
export const STATE_PATH = ".telegraph/state.json";

export type MinerFileConfig = MinerConfig & { yamlId?: number };

export function readConfig(cwd: string): MinerFileConfig | undefined {
  const path = `${cwd}/${CONFIG_PATH}`;
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeConfig(cwd: string, config: MinerFileConfig): void {
  writeFileSync(`${cwd}/${CONFIG_PATH}`, JSON.stringify(config, null, 2) + "\n");
}

export function readState(cwd: string): RegistrationState | undefined {
  const path = `${cwd}/${STATE_PATH}`;
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeState(cwd: string, state: RegistrationState): void {
  const path = `${cwd}/${STATE_PATH}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}
