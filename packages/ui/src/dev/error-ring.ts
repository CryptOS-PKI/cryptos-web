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

import type { RingError } from "./ui-issue";

export interface ErrorRing {
  all: () => RingError[];
  last: () => RingError | undefined;
  push: (e: RingError) => void;
}

// A fixed-size ring of the most recent client errors: push drops the oldest
// once the ring is full, so a chatty error loop can't grow this without bound.
export const createErrorRing = (size = 5): ErrorRing => {
  const buf: RingError[] = [];
  return {
    all: () => [...buf],
    last: () => buf.at(-1),
    push: (e) => {
      buf.push(e);
      if (buf.length > size) {
        buf.shift();
      }
    },
  };
};
