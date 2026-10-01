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

import type { OperatorCABanner } from "@/lib/operator-cas";

import { cn } from "@/lib/utils";

// OperatorCABanners shows what an admin has to act on for the trusted
// operator CAs: no view of the CA's revocations, a CRL near or past its
// nextUpdate, or an OCSP responder that isn't answering.
export const OperatorCABanners = ({ banners }: { banners: OperatorCABanner[] }) =>
  banners.length === 0 ? null : (
    <section aria-label="Operator CAs: needs attention" className="space-y-2">
      {banners.map((b) => (
        <div
          className={cn(
            "rounded-md border p-3",
            b.tone === "danger"
              ? "border-destructive/40 bg-destructive/5"
              : "border-warning/40 bg-warning/10",
          )}
          key={`${b.sha256}/${b.title}`}
          role="status"
        >
          <p className="text-sm font-semibold text-foreground">{b.title}</p>
          <p className="text-xs text-muted-foreground">{b.detail}</p>
        </div>
      ))}
    </section>
  );
