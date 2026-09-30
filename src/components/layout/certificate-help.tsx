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

// Install instructions for the operator certificate, shown when the browser
// presented none (#81).
//
// This exists because the alternative is guesswork: the store a browser reads
// differs per platform, and Firefox keeps its own regardless of platform, which
// is the usual reason an import appears to do nothing. The browser asks for the
// certificate during the TLS handshake, so this page cannot trigger the prompt
// -- hence the reload step, which is the part people otherwise miss.

const FIRST_CREDENTIAL_GUIDE =
  "https://github.com/CryptOS-PKI/manager/blob/main/docs/deploying-standalone.md#3-the-operator-ca-does-not-have-to-be-a-cryptos-node";

interface Platform {
  /** Shell command that performs the import, where one exists. */
  command?: string;
  name: string;
  note?: string;
  steps: string[];
}

const platforms: Platform[] = [
  {
    command: "certutil -user -importPFX -p <passphrase> operator-admin.p12",
    name: "Windows",
    note: "Chrome and Edge read this store.",
    steps: [
      "Double-click the .p12 file to open the Certificate Import Wizard.",
      'Choose store location "Current User", not "Local Machine".',
      'Accept the default "Personal" store and enter the passphrase.',
    ],
  },
  {
    command: "security import operator-admin.p12 -k ~/Library/Keychains/login.keychain-db",
    name: "macOS",
    note: "Safari, Chrome and Edge read the keychain.",
    steps: [
      "Double-click the .p12 file to add it to your login keychain.",
      "Enter the passphrase when Keychain Access asks for it.",
    ],
  },
  {
    command: "pk12util -d sql:$HOME/.pki/nssdb -i operator-admin.p12",
    name: "Linux",
    note: "For Chrome and Edge. Needs libnss3-tools (Debian, Ubuntu) or nss-tools (Fedora, RHEL).",
    steps: ["Import into the per-user NSS store with the command below."],
  },
  {
    name: "Firefox",
    note: "Firefox keeps its own certificate store on every platform and ignores the operating system one, so importing into Windows, macOS or NSS is not enough.",
    steps: [
      "Settings, then Privacy & Security.",
      "Under Certificates, choose View Certificates.",
      "On the Your Certificates tab, choose Import and select the .p12 file.",
    ],
  },
];

export const CertificateHelp = () => (
  <div className="flex w-full max-w-2xl flex-col gap-5 text-left font-mono text-xs text-muted-foreground">
    <p>
      Your fleet operator issues the certificate as a <code>.p12</code> file with a passphrase.
      Install it, then <strong>reload this page</strong> and choose it when your browser asks -- the
      request happens during the TLS handshake, so this page cannot prompt you for it.
    </p>

    {platforms.map((p) => (
      <div className="flex flex-col gap-1" key={p.name}>
        <h3 className="text-primary">{p.name}</h3>
        <ol className="list-decimal pl-5">
          {p.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {p.command ? (
          <code className="mt-1 block overflow-x-auto rounded bg-muted px-2 py-1">{p.command}</code>
        ) : null}
        {p.note ? <p className="italic">{p.note}</p> : null}
      </div>
    ))}

    {/* On a fleet nobody has logged in to yet there is no one to issue the
        certificate but the reader, and this page cannot mint it (#70). */}
    <div className="flex flex-col gap-1">
      <h3 className="text-primary">Standing up a new fleet?</h3>
      <p>
        No operator certificate exists until the first one is issued. Issue it yourself from the
        operator CA this manager trusts (<code>operatorCAPath</code> in its config), with the admin
        level extension, then install it as above. The{" "}
        <a
          className="text-primary underline underline-offset-2"
          href={FIRST_CREDENTIAL_GUIDE}
          rel="noreferrer"
          target="_blank"
        >
          deployment guide
        </a>
        , section 3, has the full OpenSSL recipe.
      </p>
    </div>
  </div>
);
