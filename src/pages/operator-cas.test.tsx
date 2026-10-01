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

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as cas from "@/lib/operator-cas";
import { OperatorCAsPage } from "@/pages/operator-cas";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

const admin = { commonName: "admin@example.org", level: "admin", serial: "01" };

const rowOf = async (text: RegExp) => {
  const table = await screen.findByRole("table");
  const cell = await within(table).findByText(text);
  return cell.closest("tr") as HTMLElement;
};

beforeEach(() => {
  cas.__resetOperatorCAs();
  useAuth.mockReturnValue({ operator: admin });
});
afterEach(() => vi.restoreAllMocks());

describe("OperatorCAsPage", () => {
  it("lists every CA with its state, CRL and OCSP, and the banners that need action", async () => {
    render(<OperatorCAsPage />);
    const g2 = await rowOf(/Example Operator CA G2/);
    expect(within(g2).getByText("active")).toBeInTheDocument();
    expect(within(g2).getByText(/fleetos-operator.crl/)).toBeInTheDocument();
    const g1 = await rowOf(/Example Operator CA G1/);
    expect(within(g1).getByText("retiring")).toBeInTheDocument();
    const banners = screen.getByRole("region", { name: /needs attention/i });
    expect(within(banners).getByText("CRL expiring")).toBeInTheDocument();
    expect(within(banners).getByText("CA revocations not observed")).toBeInTheDocument();
  });

  it("retires a retiring CA, and explains the guard on the last active one", async () => {
    render(<OperatorCAsPage />);
    fireEvent.click(
      within(await rowOf(/Example Operator CA G1/)).getByRole("button", { name: /retire/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^retire this ca$/i }));
    await waitFor(async () =>
      expect(
        within(await rowOf(/Example Operator CA G1/)).getByText("retired"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      within(await rowOf(/Example Operator CA G2/)).getByRole("button", { name: /retire/i }),
    );
    expect(screen.getByLabelText(/lock myself out/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^retire this ca$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no trusted active CA/);
  });

  it("switches the CRL source to none only with the acknowledgement", async () => {
    render(<OperatorCAsPage />);
    fireEvent.click(
      within(await rowOf(/Example Operator CA G2/)).getByRole("button", { name: /crl source/i }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/^no crl/i));
    const save = within(dialog).getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText(/MCP is unavailable/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/I understand revocations/i));
    fireEvent.click(save);
    await waitFor(async () =>
      expect(within(await rowOf(/Example Operator CA G2/)).getByText("none")).toBeInTheDocument(),
    );
  });

  it("needs a responder URL for OCSP url mode", async () => {
    const spy = vi.spyOn(cas, "setOperatorCAOcsp");
    render(<OperatorCAsPage />);
    fireEvent.click(
      within(await rowOf(/Example Operator CA G2/)).getByRole("button", { name: /ocsp/i }),
    );
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText(/ocsp mode/i) as HTMLSelectElement).value).toBe("aia");
    fireEvent.change(within(dialog).getByLabelText(/ocsp mode/i), { target: { value: "url" } });
    const save = within(dialog).getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/responder url/i), {
      target: { value: "http://ocsp.example.org/" },
    });
    fireEvent.click(save);
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith("2b".repeat(32), "url", "http://ocsp.example.org/"),
    );
    expect(await within(dialog).findByText(/delegated responder/)).toBeInTheDocument();
  });

  it("offers Upload CRL only for an upload-source CA", async () => {
    render(<OperatorCAsPage />);
    const g2 = await rowOf(/Example Operator CA G2/);
    expect(within(g2).queryByRole("button", { name: /upload crl/i })).not.toBeInTheDocument();
    fireEvent.click(within(g2).getByRole("button", { name: /crl source/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/^upload/i));
    fireEvent.change(within(dialog).getByLabelText(/crl file/i), {
      target: { files: [new File(["crl"], "op.crl")] },
    });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /save/i })).toBeEnabled(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));
    await waitFor(async () =>
      expect(
        within(await rowOf(/Example Operator CA G2/)).getByRole("button", { name: /upload crl/i }),
      ).toBeInTheDocument(),
    );
  });

  it("opens the register form for an admin", async () => {
    render(<OperatorCAsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /register operator ca/i }));
    expect(screen.getByRole("button", { name: /check the ca/i })).toBeInTheDocument();
  });

  it("shows a config-managed CA read-only", async () => {
    const seeded = await cas.listOperatorCAs();
    vi.spyOn(cas, "listOperatorCAs").mockResolvedValue([{ ...seeded[0], managedByConfig: true }]);
    render(<OperatorCAsPage />);
    const g2 = await rowOf(/Example Operator CA G2/);
    expect(within(g2).getByText(/config file/i)).toBeInTheDocument();
    expect(within(g2).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register operator ca/i })).not.toBeInTheDocument();
  });

  it("gives a non-admin no actions", async () => {
    useAuth.mockReturnValue({ operator: { ...admin, level: "operator" } });
    render(<OperatorCAsPage />);
    const g2 = await rowOf(/Example Operator CA G2/);
    expect(within(g2).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register operator ca/i })).not.toBeInTheDocument();
  });
});
