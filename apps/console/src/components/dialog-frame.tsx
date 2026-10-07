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

import type { ReactNode } from "react";

// DialogFrame is the modal shell the operator credential dialogs share: a dim
// backdrop that closes on click, and a labelled dialog panel.
export const DialogFrame = ({
  children,
  labelId,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  labelId: string;
  onClose: () => void;
  wide?: boolean;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
    role="presentation"
  >
    <div
      aria-labelledby={labelId}
      aria-modal="true"
      className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] space-y-4 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl`}
      role="dialog"
    >
      {children}
    </div>
  </div>
);
