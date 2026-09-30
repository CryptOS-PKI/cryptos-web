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

// Browser downloads of bytes the page made itself (a CSR, a key backup, a
// PKCS#12). The object URL is revoked straight away.
export const downloadBytes = (filename: string, contents: Uint8Array, type: string): void => {
  const copy = new Uint8Array(contents.length);
  copy.set(contents);
  const url = URL.createObjectURL(new Blob([copy], { type }));
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (filename: string, text: string, type = "text/plain"): void =>
  downloadBytes(filename, new TextEncoder().encode(text), type);

// readFileBytes reads a chosen file. FileReader keeps it working where
// Blob.arrayBuffer is missing.
export const readFileBytes = (file: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(new Uint8Array(reader.result as ArrayBuffer)));
    reader.addEventListener("error", () => reject(new Error("The file could not be read.")));
    reader.readAsArrayBuffer(file);
  });
