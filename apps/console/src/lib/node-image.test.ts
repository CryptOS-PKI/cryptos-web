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

import { describe, expect, it } from "vitest";

import {
  activateNodeImage,
  getNodeImageStatus,
  rollbackNodeImage,
  stageNodeImage,
} from "@/lib/node-image";

describe("getNodeImageStatus (mock mode)", () => {
  it("returns a deterministic demo status", async () => {
    const status = await getNodeImageStatus("acme-issuing-01");
    expect(status.runningSha256).not.toBe("");
    expect(status.runningVersion).not.toBe("");
  });
});

describe("stageNodeImage", () => {
  it("requires an image URL before any call", async () => {
    await expect(
      stageNodeImage("acme-issuing-01", {
        imageUrl: "  ",
        sha256: "",
        signature: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/image url/i);
  });

  it("requires a signature before any call", async () => {
    await expect(
      stageNodeImage("acme-issuing-01", {
        imageUrl: "https://images.example.org/cryptos.img",
        sha256: "",
        signature: new Uint8Array(0),
      }),
    ).rejects.toThrow(/signature/i);
  });

  it("is a no-op that resolves in mock mode", async () => {
    await expect(
      stageNodeImage("acme-issuing-01", {
        imageUrl: "https://images.example.org/cryptos.img",
        sha256: "",
        signature: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("activateNodeImage", () => {
  it("requires the confirmation CN before any call", async () => {
    await expect(activateNodeImage("acme-issuing-01", "  ")).rejects.toThrow(/CA CN/i);
  });

  it("is a no-op that resolves in mock mode", async () => {
    await expect(activateNodeImage("acme-issuing-01", "ACME Root CA G1")).resolves.toBeUndefined();
  });
});

describe("rollbackNodeImage", () => {
  it("is a no-op that resolves in mock mode", async () => {
    await expect(rollbackNodeImage("acme-issuing-01")).resolves.toBeUndefined();
  });
});
