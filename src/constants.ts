/**
 * Project-wide constants.
 *
 * `BIN_NAME` is the single source of truth — change it here and `sn` becomes `sncli`
 * or anything else (package.json `bin` key also needs to match).
 */

import { homedir } from "os";
import { join } from "path";

export const BIN_NAME = "sn";
export const DISPLAY_NAME = "servicenow-cli";
export const VERSION = "0.7.0";

/**
 * XDG config home (spec: ~/.config by default).
 */
export function xdgConfigHome(): string {
  return process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
}

/**
 * Default config file path ($XDG_CONFIG_HOME/servicenow-cli/config.json).
 */
export function defaultConfigPath(): string {
  return join(xdgConfigHome(), DISPLAY_NAME, "config.json");
}

/**
 * Project-local config path (./servicenow-cli.config.json).
 */
export function projectConfigPath(): string {
  return join(process.cwd(), `${DISPLAY_NAME}.config.json`);
}
