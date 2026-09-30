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

import { cn } from "@/lib/utils";

// The CryptOS wordmark: shield mark plus a mono wordmark with the "OS" in the
// hero color (Shield Blue, --primary).
export const Wordmark = ({ className }: { className?: string }) => {
  return (
    <span className={cn("flex items-center gap-2 font-mono text-lg font-bold", className)}>
      <span aria-hidden="true" className="text-xl leading-none">
        {"\u{1F6E1}\u{FE0F}"}
      </span>
      <span className="tracking-tight">
        Crypt<span className="text-primary">OS</span>
      </span>
    </span>
  );
};
