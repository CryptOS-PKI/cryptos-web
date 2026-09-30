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

import { describe, expect, it } from "vitest";

import { generateLeafKeyAndCSR, MIN_PASSPHRASE_LENGTH } from "@/lib/crypto/leaf-key";
import { assemblePkcs12 } from "@/lib/crypto/pkcs12";

// A tiny self-signed-looking DER certificate is not required: assemblePkcs12
// treats the cert as opaque DER bytes it wraps in a CertBag, so any byte string
// exercises the envelope shape. The key, though, must be a real WebCrypto key so
// its PKCS#8 export and PBES2 shrouding run for real.
const dummyCertDer = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x2a]);

const STRONG = "correct-horse-battery-staple";

describe("assemblePkcs12", () => {
  it("rejects a passphrase shorter than the floor", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    await expect(assemblePkcs12(dummyCertDer, privateKey, "short")).rejects.toThrow(
      new RegExp(`${MIN_PASSPHRASE_LENGTH} characters`),
    );
  });

  it("emits a PKCS#12 PFX: an outer SEQUENCE with version 3", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);

    // PFX ::= SEQUENCE { version INTEGER {v3(3)}, authSafe, macData }
    expect(pfx[0]).toBe(0x30); // outer SEQUENCE
    // Walk the length octets, then the first inner element must be INTEGER 3.
    let i = 1;
    if (pfx[i] & 0x80) i += pfx[i] & 0x7f;
    i += 1;
    expect(pfx[i]).toBe(0x02); // INTEGER tag
    expect(pfx[i + 1]).toBe(0x01); // length 1
    expect(pfx[i + 2]).toBe(0x03); // version 3
  });

  it("does not embed the passphrase in the output bytes", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    const asText = new TextDecoder("latin1").decode(pfx);
    expect(asText.includes(STRONG)).toBe(false);
  });

  it("is deterministic in structure but not in ciphertext (random salt/iv)", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const a = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    const b = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    // Both are valid PFX (same tag) but differ because salt/iv are random.
    expect(a[0]).toBe(0x30);
    expect(b[0]).toBe(0x30);
    expect(a.length).toBeGreaterThan(0);
    // Extremely unlikely to be byte-identical given random salts.
    const same = a.length === b.length && a.every((v, idx) => v === b[idx]);
    expect(same).toBe(false);
  });
});
