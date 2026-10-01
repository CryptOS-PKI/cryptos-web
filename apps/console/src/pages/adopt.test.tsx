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

import type { MachineConfig } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdoptPage } from "@/pages/adopt";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

const previewAdoption = vi.fn();
const adoptNode = vi.fn();
const listInstallDisks = vi.fn();
const confirmAdoptionFingerprint = vi.fn();
vi.mock("@/lib/adopt", () => ({
  adoptNode: (...a: unknown[]) => adoptNode(...a),
  AWAITING_FINGERPRINT: "awaiting-fingerprint-confirmation",
  confirmAdoptionFingerprint: (...a: unknown[]) => confirmAdoptionFingerprint(...a),
  fetchParentAnchor: vi.fn(),
  formatDiskSize: (b: bigint) => `${b}`,
  formatFingerprint: (fp: string) => `fmt(${fp})`,
  listInstallDisks: (...a: unknown[]) => listInstallDisks(...a),
  previewAdoption: (...a: unknown[]) => previewAdoption(...a),
}));

const startAdoption = async () => {
  fireEvent.change(screen.getByLabelText(/endpoint/i), { target: { value: "host:9000" } });
  fireEvent.click(screen.getByRole("button", { name: /preview/i }));
  await waitFor(() => screen.getByRole("button", { name: /confirm fingerprint/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm fingerprint/i }));
  fireEvent.change(screen.getByLabelText(/node name/i), { target: { value: "acme-edge-07" } });
  fireEvent.change(screen.getByLabelText(/install disk/i), { target: { value: "/dev/nvme0n1" } });
  fireEvent.click(screen.getByRole("button", { name: /adopt node/i }));
};

describe("AdoptPage", () => {
  it("gates the whole wizard behind admin level", () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AdoptPage />);
    expect(screen.getByText(/requires admin level/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/endpoint/i)).not.toBeInTheDocument();
  });

  it("previews the fingerprint, requires an explicit confirm, then reveals step 2", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    render(<AdoptPage />);

    fireEvent.change(screen.getByLabelText(/endpoint/i), { target: { value: "host:9000" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => expect(screen.getByText(/AB:CD:EF/)).toBeInTheDocument());
    // Step 2 is hidden until the operator confirms the fingerprint.
    expect(screen.queryByLabelText(/node name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm fingerprint/i }));
    expect(screen.getByText(/pinned for this adoption/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/node name/i)).toBeInTheDocument();
  });

  it("streams phase progress and shows the node established", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    // No discovered disks here, so the form falls back to the manual disk field.
    listInstallDisks.mockResolvedValue([]);
    adoptNode.mockReturnValue(
      (async function* () {
        yield { detail: "Applying.", done: false, phase: "applying-config" };
        yield { detail: "Done.", done: true, phase: "established" };
      })(),
    );
    render(<AdoptPage />);

    fireEvent.change(screen.getByLabelText(/endpoint/i), { target: { value: "host:9000" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => screen.getByRole("button", { name: /confirm fingerprint/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm fingerprint/i }));

    fireEvent.change(screen.getByLabelText(/node name/i), { target: { value: "acme-edge-07" } });
    fireEvent.change(screen.getByLabelText(/install disk/i), { target: { value: "/dev/nvme0n1" } });
    fireEvent.click(screen.getByRole("button", { name: /adopt node/i }));

    await waitFor(() =>
      expect(screen.getByText(/acme-edge-07 is established/i)).toBeInTheDocument(),
    );
    expect(adoptNode).toHaveBeenCalledWith(
      "host:9000",
      "AB:CD:EF",
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it("sends the DNS nameservers and search domains in the initial config", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    listInstallDisks.mockResolvedValue([]);
    adoptNode.mockReset().mockReturnValue(
      (async function* () {
        yield { detail: "Done.", done: true, phase: "established" };
      })(),
    );
    render(<AdoptPage />);

    fireEvent.change(screen.getByLabelText(/endpoint/i), { target: { value: "host:9000" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => screen.getByRole("button", { name: /confirm fingerprint/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm fingerprint/i }));

    fireEvent.change(screen.getByLabelText(/node name/i), { target: { value: "acme-edge-07" } });
    fireEvent.change(screen.getByLabelText(/install disk/i), { target: { value: "/dev/nvme0n1" } });
    fireEvent.change(screen.getByLabelText(/dns nameservers/i), {
      target: { value: "10.0.0.53, 10.0.1.53" },
    });
    fireEvent.change(screen.getByLabelText(/dns search domains/i), {
      target: { value: "pki.acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adopt node/i }));

    await waitFor(() => expect(adoptNode).toHaveBeenCalledTimes(1));
    const config = adoptNode.mock.calls[0][2] as MachineConfig;
    expect(config.network?.nameservers).toEqual(["10.0.0.53", "10.0.1.53"]);
    expect(config.network?.search).toEqual(["pki.acme"]);
  });

  it("shows the installed node's fingerprint and confirms it for the adoption", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    listInstallDisks.mockResolvedValue([]);
    confirmAdoptionFingerprint.mockReset().mockImplementation(async () => {});
    adoptNode.mockReset().mockReturnValue(
      (async function* () {
        yield {
          adoptionId: "adopt-1",
          detail: "Waiting.",
          done: false,
          phase: "awaiting-fingerprint-confirmation",
          presentedCertSha256: "5f5f",
        };
      })(),
    );
    render(<AdoptPage />);
    await startAdoption();

    await waitFor(() => expect(screen.getByText("fmt(5f5f)")).toBeInTheDocument());
    expect(screen.getByText(/mgmt sha-256/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /matches the console/i }));

    await waitFor(() => expect(confirmAdoptionFingerprint).toHaveBeenCalledWith("adopt-1", "5f5f"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /matches the console/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("surfaces a refused fingerprint confirm inline", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    listInstallDisks.mockResolvedValue([]);
    confirmAdoptionFingerprint.mockReset().mockRejectedValue(new Error("fingerprint mismatch"));
    adoptNode.mockReset().mockReturnValue(
      (async function* () {
        yield {
          adoptionId: "adopt-1",
          detail: "",
          done: false,
          phase: "awaiting-fingerprint-confirmation",
          presentedCertSha256: "5f5f",
        };
      })(),
    );
    render(<AdoptPage />);
    await startAdoption();

    await waitFor(() => screen.getByRole("button", { name: /matches the console/i }));
    fireEvent.click(screen.getByRole("button", { name: /matches the console/i }));
    await waitFor(() => expect(screen.getByText(/fingerprint mismatch/i)).toBeInTheDocument());
  });

  it("cancels the adoption when the fingerprint does not match", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockResolvedValue({ certSha256: "AB:CD:EF", subject: "CN=maintenance" });
    listInstallDisks.mockResolvedValue([]);
    confirmAdoptionFingerprint.mockReset();
    let signal: AbortSignal | undefined;
    adoptNode.mockReset().mockImplementation((...a: unknown[]) => {
      signal = a[3] as AbortSignal;
      return (async function* () {
        yield {
          adoptionId: "adopt-1",
          detail: "",
          done: false,
          phase: "awaiting-fingerprint-confirmation",
          presentedCertSha256: "5f5f",
        };
        await new Promise((_, reject) =>
          signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        );
      })();
    });
    render(<AdoptPage />);
    await startAdoption();

    await waitFor(() => screen.getByRole("button", { name: /does not match/i }));
    fireEvent.click(screen.getByRole("button", { name: /does not match/i }));

    expect(signal?.aborted).toBe(true);
    expect(confirmAdoptionFingerprint).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/adoption cancelled/i)).toBeInTheDocument());
  });

  it("surfaces a preview error inline", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    previewAdoption.mockRejectedValue(new Error("endpoint unreachable"));
    render(<AdoptPage />);
    fireEvent.change(screen.getByLabelText(/endpoint/i), { target: { value: "host:9000" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/unreachable/i)).toBeInTheDocument());
  });
});
