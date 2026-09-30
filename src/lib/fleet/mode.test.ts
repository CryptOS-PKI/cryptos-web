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

import { afterEach, describe, expect, it } from "vitest";

import { fleetMode } from "@/lib/fleet/mode";

const original = import.meta.env.VITE_FLEET_MODE;

afterEach(() => {
  import.meta.env.VITE_FLEET_MODE = original;
});

describe("fleetMode", () => {
  it("defaults to live when unset", () => {
    import.meta.env.VITE_FLEET_MODE = undefined;
    expect(fleetMode()).toBe("live");
  });

  it("returns live for an unrecognized value", () => {
    import.meta.env.VITE_FLEET_MODE = "bogus";
    expect(fleetMode()).toBe("live");
  });

  it("returns mock only when explicitly set", () => {
    import.meta.env.VITE_FLEET_MODE = "mock";
    expect(fleetMode()).toBe("mock");
  });

  it("returns live for live", () => {
    import.meta.env.VITE_FLEET_MODE = "live";
    expect(fleetMode()).toBe("live");
  });

  it("returns live-auth for live-auth", () => {
    import.meta.env.VITE_FLEET_MODE = "live-auth";
    expect(fleetMode()).toBe("live-auth");
  });
});
