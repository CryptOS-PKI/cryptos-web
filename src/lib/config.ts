/*
Copyright The CryptOS Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { MachineConfig } from "@/gen/fleet/cryptos/v1/config_pb";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// ApplyResult is what applyNodeConfig reports back to the UI: the node's new
// config generation and whether the change takes effect only on reboot.
export interface ApplyResult {
  generation: number;
  requiresReboot: boolean;
}

// getNodeConfig fetches a managed node's full current machine config through
// the manager's GetNodeConfig RPC. The caller holds this whole config as the
// baseline and edits a subset of it; applyNodeConfig then sends the whole thing
// back. `mock` mode has no live RPC to drive -- the form keeps its local demo
// there and never reaches here -- so calling this in mock mode is a clear error
// rather than a silent no-op.
export const getNodeConfig = async (nodeName: string): Promise<MachineConfig> => {
  if (fleetMode() === "mock") {
    throw new Error("getNodeConfig: live config read requires live mode");
  }

  const response = await fleetClient().getNodeConfig({ nodeName });
  if (!response.config) {
    throw new Error(`getNodeConfig: node ${nodeName} returned no config`);
  }
  return response.config;
};

// applyNodeConfig applies a FULL machine config to a managed node through the
// manager's ApplyNodeConfig RPC. The node's ApplyConfig is a whole-config
// replace, so `config` must be the config fetched via getNodeConfig with only
// the edited fields changed -- never a freshly built partial, which would drop
// untouched fields such as `management` and unlink the node from the fleet. As
// with getNodeConfig, mock mode is a clear error rather than a silent no-op.
export const applyNodeConfig = async (
  nodeName: string,
  config: MachineConfig,
): Promise<ApplyResult> => {
  if (fleetMode() === "mock") {
    throw new Error("applyNodeConfig: live config apply requires live mode");
  }

  const response = await fleetClient().applyNodeConfig({ nodeName, config });
  return {
    generation: Number(response.generation),
    requiresReboot: response.requiresReboot,
  };
};

// parseList reads a list-valued config field (nameservers, search domains) from
// a single text input. Commas and whitespace both separate entries because
// operators paste resolv.conf-style lists as often as comma-separated ones.
export const parseList = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

// formatList renders a list-valued config field for a text input in a form
// parseList reads back unchanged.
export const formatList = (list: readonly string[] | undefined): string => (list ?? []).join(", ");
