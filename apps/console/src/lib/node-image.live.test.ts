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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getNodeImageStatus = vi.fn(() =>
  Promise.resolve({
    status: {
      activeSha256: "aaaa",
      previousSha256: "bbbb",
      rebootPending: true,
      runningSha256: "cccc",
      runningVersion: "0.2.0",
    },
  }),
);
const stageNodeImage = vi.fn(() =>
  Promise.resolve({ requiresReboot: true, status: { activeSha256: "ffff" } }),
);
const activateNodeImage = vi.fn(() => Promise.resolve({ rebooting: true }));
const rollbackNodeImage = vi.fn(() =>
  Promise.resolve({ requiresReboot: true, status: { activeSha256: "eeee" } }),
);
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ activateNodeImage, getNodeImageStatus, rollbackNodeImage, stageNodeImage }),
}));

import {
  activateNodeImage as activateNodeImageLib,
  getNodeImageStatus as getNodeImageStatusLib,
  rollbackNodeImage as rollbackNodeImageLib,
  stageNodeImage as stageNodeImageLib,
} from "@/lib/node-image";

describe("node-image live path", () => {
  beforeEach(() => {
    getNodeImageStatus.mockClear();
    stageNodeImage.mockClear();
    activateNodeImage.mockClear();
    rollbackNodeImage.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getNodeImageStatus forwards the node name and flattens the response", async () => {
    const status = await getNodeImageStatusLib("acme-issuing-01");
    expect(getNodeImageStatus).toHaveBeenCalledWith(
      expect.objectContaining({ nodeName: "acme-issuing-01" }),
    );
    expect(status).toEqual({
      activeSha256: "aaaa",
      previousSha256: "bbbb",
      rebootPending: true,
      runningSha256: "cccc",
      runningVersion: "0.2.0",
    });
  });

  it("stageNodeImage forwards image_url, sha256 and signature unchanged", async () => {
    const signature = new Uint8Array([1, 2, 3]);
    await stageNodeImageLib("acme-issuing-01", {
      imageUrl: "https://images.example.org/x.img",
      sha256: "deadbeef",
      signature,
    });
    expect(stageNodeImage).toHaveBeenCalledWith({
      imageUrl: "https://images.example.org/x.img",
      nodeName: "acme-issuing-01",
      sha256: "deadbeef",
      signature,
    });
  });

  it("activateNodeImage forwards the echoed CN", async () => {
    await activateNodeImageLib("acme-issuing-01", "ACME Root CA G1");
    expect(activateNodeImage).toHaveBeenCalledWith({
      confirmCaCn: "ACME Root CA G1",
      nodeName: "acme-issuing-01",
    });
  });

  it("rollbackNodeImage forwards the node name only", async () => {
    await rollbackNodeImageLib("acme-issuing-01");
    expect(rollbackNodeImage).toHaveBeenCalledWith({ nodeName: "acme-issuing-01" });
  });
});
