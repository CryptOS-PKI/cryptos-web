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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// ValidateCertificateChainResult reports whether a submitted certificate
// chains to a managed node's CA. A certificate that does not chain is a
// result, not a thrown error.
export interface ValidateCertificateChainResult {
  issuer: string;
  nodeCaSubject: string;
  reason: string;
  subject: string;
  valid: boolean;
}

// A deterministic mock: mock mode has no node to ask, so this stands in for
// ValidateCertificateChain. A certificate carrying the UNTRUSTED marker
// exercises the "does not chain" path the way a mismatched fingerprint
// exercises the adopt wizard's failure path in mock mode.
const mockValidate = (certificatePem: string, nodeName: string): ValidateCertificateChainResult => {
  const nodeCaSubject = `CN=${nodeName}`;
  if (certificatePem.includes("UNTRUSTED")) {
    return {
      issuer: "CN=untrusted-issuer.example",
      nodeCaSubject,
      reason: "certificate's issuer does not match the node's CA",
      subject: "CN=mock-leaf.acme.example",
      valid: false,
    };
  }
  return {
    issuer: nodeCaSubject,
    nodeCaSubject,
    reason: "",
    subject: "CN=mock-leaf.acme.example",
    valid: true,
  };
};

// validateCertificateChain checks whether certificatePem chains to a managed
// node's CA through the manager's ValidateCertificateChain.
export const validateCertificateChain = async (
  nodeName: string,
  certificatePem: string,
): Promise<ValidateCertificateChainResult> => {
  if (fleetMode() === "mock") {
    return mockValidate(certificatePem, nodeName);
  }

  const response = await fleetClient().validateCertificateChain({ certificatePem, nodeName });
  return {
    issuer: response.issuer,
    nodeCaSubject: response.nodeCaSubject,
    reason: response.reason,
    subject: response.subject,
    valid: response.valid,
  };
};
