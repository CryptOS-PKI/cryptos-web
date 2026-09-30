/*
Apache License 2.0

Copyright 2026 Shane

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

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { __resetCerts, certsFor } from "@/lib/certs";
import { NodeCertDetailPage } from "@/pages/node-cert-detail";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeCertDetailPage />} path="/nodes/:name/certs/:serial" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeCertDetailPage", () => {
  beforeEach(() => __resetCerts());

  it("shows the certificate's subject CN and serial", () => {
    const cert = certsFor("acme-issuing-01")[0];
    renderAt(`/nodes/acme-issuing-01/certs/${cert.serial}`);
    // subjectCn appears in the heading and may repeat in the sans row (mock data); use getAllByText.
    expect(screen.getAllByText(cert.subjectCn)[0]).toBeInTheDocument();
    expect(screen.getByText(cert.serial)).toBeInTheDocument();
  });
});
