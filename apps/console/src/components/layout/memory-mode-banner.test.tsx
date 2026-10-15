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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthStatus } from "@/lib/health";

import { MemoryModeBanner } from "@/components/layout/memory-mode-banner";
import { expectNoA11yViolations } from "@/test/axe";

const fetchHealth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/health", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/health")>()),
  fetchHealth,
}));

const health = (overrides: Partial<HealthStatus["storage"]>): HealthStatus => ({
  status: "ok",
  storage: { mode: "postgres", state: "ok", ...overrides },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MemoryModeBanner", () => {
  it("shows a warning naming what is lost on restart when storage is memory", async () => {
    fetchHealth.mockResolvedValue(health({ mode: "memory", state: "degraded" }));
    render(<MemoryModeBanner />);

    await screen.findByText(/lost on restart/i);
    expect(screen.getByText(/operator registrations/i)).toBeInTheDocument();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });

  it("shows nothing when storage is postgres and healthy", async () => {
    fetchHealth.mockResolvedValue(health({ mode: "postgres", state: "ok" }));
    const { container } = render(<MemoryModeBanner />);

    await waitFor(() => expect(fetchHealth).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when /healthz can't be read", async () => {
    fetchHealth.mockResolvedValue(null);
    const { container } = render(<MemoryModeBanner />);

    await waitFor(() => expect(fetchHealth).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches /healthz exactly once, never polling", async () => {
    fetchHealth.mockResolvedValue(health({ mode: "memory", state: "degraded" }));
    render(<MemoryModeBanner />);

    await screen.findByText(/lost on restart/i);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchHealth).toHaveBeenCalledTimes(1);
  });

  it("dismisses for the session but a fresh mount shows it again", async () => {
    fetchHealth.mockResolvedValue(health({ mode: "memory", state: "degraded" }));
    const { unmount } = render(<MemoryModeBanner />);

    await screen.findByText(/lost on restart/i);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/lost on restart/i)).not.toBeInTheDocument();

    unmount();
    render(<MemoryModeBanner />);
    await screen.findByText(/lost on restart/i);
  });

  it("has no axe violations", async () => {
    fetchHealth.mockResolvedValue(health({ mode: "memory", state: "degraded" }));
    const { container } = render(<MemoryModeBanner />);

    await screen.findByText(/lost on restart/i);
    await expectNoA11yViolations(container);
  });
});
