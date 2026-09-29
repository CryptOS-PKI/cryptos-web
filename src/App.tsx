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

import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/layout/auth-gate";
import { AdoptPage } from "@/pages/adopt";
import { AgentKeysPage } from "@/pages/agent-keys";
import { AuditPage } from "@/pages/audit";
import { CertificatesPage } from "@/pages/certificates";
import { DashboardPage } from "@/pages/dashboard";
import { EnrollmentPage } from "@/pages/enrollment";
import { EnrollmentDetailPage } from "@/pages/enrollment-detail";
import { FleetPage } from "@/pages/fleet";
import { NodeCertDetailPage } from "@/pages/node-cert-detail";
import { NodeConfigPage } from "@/pages/node-config";
import { NodeDetailPage } from "@/pages/node-detail";
import { NodeIssuePage } from "@/pages/node-issue";
import { NodeProfilesPage } from "@/pages/node-profiles";
import { NodeRekeyPage } from "@/pages/node-rekey";
import { NodesPage } from "@/pages/nodes";
import { NotFoundPage } from "@/pages/not-found";
import { OAuthConsentPage } from "@/pages/oauth-consent";
import { OperatorsPage } from "@/pages/operators";
import { ProfileDetailPage } from "@/pages/profile-detail";
import { ProfileNewPage } from "@/pages/profile-new";
import { ProfilesPage } from "@/pages/profiles";
import { ProtocolDetailPage } from "@/pages/protocol-detail";
import { ProtocolsPage } from "@/pages/protocols";
import { RootPage } from "@/pages/root";
import { RootDetailPage } from "@/pages/root-detail";

export const App = () => {
  return (
    <Routes>
      <Route element={<OAuthConsentPage />} path="oauth/consent" />
      <Route
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route element={<DashboardPage />} index />
        <Route element={<FleetPage />} path="fleet" />
        <Route element={<NodesPage />} path="nodes" />
        <Route element={<NodeDetailPage />} path="nodes/:name" />
        <Route element={<NodeConfigPage />} path="nodes/:name/config" />
        <Route element={<NodeProfilesPage />} path="nodes/:name/profiles" />
        <Route element={<NodeIssuePage />} path="nodes/:name/issue" />
        <Route element={<NodeRekeyPage />} path="nodes/:name/rekey" />
        <Route element={<NodeCertDetailPage />} path="nodes/:name/certs/:serial" />
        <Route element={<RootPage />} path="root" />
        <Route element={<RootDetailPage />} path="root/:name" />
        <Route element={<EnrollmentPage />} path="enrollment" />
        <Route element={<EnrollmentDetailPage />} path="enrollment/:id" />
        <Route element={<AuditPage />} path="audit" />
        <Route element={<OperatorsPage />} path="operators" />
        <Route element={<AgentKeysPage />} path="agent-keys" />
        <Route element={<AdoptPage />} path="adopt" />
        <Route element={<CertificatesPage />} path="certificates" />
        <Route element={<ProfilesPage />} path="profiles" />
        <Route element={<ProtocolsPage />} path="protocols" />
        <Route element={<ProtocolDetailPage />} path="protocols/:kind" />
        <Route element={<ProfileNewPage />} path="profiles/new" />
        <Route element={<ProfileDetailPage />} path="profiles/:name" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
};
