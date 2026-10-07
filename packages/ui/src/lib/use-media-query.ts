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

import { useEffect, useState } from "react";

// The kit's desktop breakpoint (Tailwind `md`). Layouts that render different
// markup for phones (the shell's drawer, the table's stacked cards) ask this
// instead of hiding one copy with CSS, so a page never holds the same content
// twice.
export const DESKTOP_QUERY = "(min-width: 768px)";

const read = (query: string): boolean =>
  typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query).matches : true;

/** True while the media query matches; true when the browser has no matchMedia. */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => read(query));

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return;
    const list = globalThis.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener?.("change", onChange);
    return () => list.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
};

export const useIsDesktop = (): boolean => useMediaQuery(DESKTOP_QUERY);
