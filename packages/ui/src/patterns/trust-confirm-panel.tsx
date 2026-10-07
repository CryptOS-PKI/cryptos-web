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

import { Button } from "../components/button";
import { Fingerprint, FingerprintConfirm } from "../components/fingerprint";

export interface TrustConfirmPanelProps {
  /** Disables Confirm and Reject while the decision is in flight. */
  busy?: boolean;
  fingerprint: string;
  label: string;
  onConfirm: () => void;
  onReject: () => void;
}

// TrustConfirmPanel pairs a fingerprint with the confirm/reject decision an
// operator makes on first contact: #158's FingerprintConfirm supplies the
// panel's chrome (icon, title, warning tone), its Fingerprint shows the value
// in groups of four with a copy action, and two Buttons carry the decision.
export const TrustConfirmPanel = ({
  busy = false,
  fingerprint,
  label,
  onConfirm,
  onReject,
}: TrustConfirmPanelProps) => (
  <FingerprintConfirm
    actions={
      <>
        <Button loading={busy} loadingLabel="Confirming…" onClick={onConfirm}>
          Confirm
        </Button>
        <Button disabled={busy} onClick={onReject} variant="outline-danger">
          Reject
        </Button>
      </>
    }
    title={label}
    tone="warning"
  >
    <Fingerprint copyable value={fingerprint} />
  </FingerprintConfirm>
);
