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

// shortFingerprint shows the first 8 bytes of a lowercase hex SHA-256 in the
// colon form operators compare against OpenSSL output.
export const shortFingerprint = (sha256: string): string =>
  sha256 === "" ? "-" : `${(sha256.slice(0, 16).match(/../g) ?? []).join(":").toUpperCase()}…`;

// colonFingerprint is the full fingerprint in openssl's form: AB:CD:...
export const colonFingerprint = (sha256: string): string =>
  (sha256.match(/../g) ?? []).join(":").toUpperCase();

// normalizeFingerprint drops everything but the hex digits, so a pasted
// "sha256 Fingerprint=AB:CD:..." line compares with a bare lowercase hex one.
export const normalizeFingerprint = (input: string): string =>
  input
    .replace(/^.*=/, "")
    .replaceAll(/[^0-9a-f]/gi, "")
    .toLowerCase();
