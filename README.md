# cryptos-web 🎨

> 🖥️ The web frontend for the [CryptOS-PKI](https://github.com/CryptOS-PKI) Fleet Manager. React + TypeScript, built with Vite to a static bundle that [`cryptos-manager`](https://github.com/CryptOS-PKI/cryptos-manager) embeds and serves on its own TLS listener.

> [!WARNING]
> 🚧 **Pre-1.0: any release can change fundamentally.** CryptOS is pre-1.0. Until v1.0.0, any release may change configuration, APIs, on-disk and state formats, trust setup, and upgrade paths, sometimes with no migration path. If you run it in production, you accept that risk. Read [each release's upgrade notes](https://github.com/CryptOS-PKI/cryptos-web/releases) before you upgrade.

## ✨ What it is

This is the **only** web UI in the project, by design. CryptOS CA nodes ([`cryptos-node`](https://github.com/CryptOS-PKI/cryptos-node)) do not ship a web frontend in the OS image — they expose mTLS gRPC and that's it. When a fleet operator wants a web UI, they stand up the Fleet Manager (`manager/` backend + this frontend), link nodes to it, and use this UI for day-to-day operations.

Conceptually `manager/` and `web/` are one application split across two repos. The split exists so the backend and frontend can be built, tested, and released on their own cadences while still ending up in a single deployable container image (the frontend bundle is pinned to a specific commit and embedded into `manager/` via `embed.FS`).

## 📂 Layout

An npm workspaces monorepo. Each app builds on its own; the packages are shared source, not published.

- 🖥️ **`apps/console`** — the Fleet Manager UI (`@cryptos-pki/console`), the bundle the manager embeds.
- 🎨 **`packages/ui`** — the CryptOS UI kit (`@cryptos-pki/ui`). Today it holds the design tokens (`tokens.css`, the light and dark palettes); the shared components move in with the redesign.
- 📡 **`packages/api-client`** — the generated TypeScript stubs for both APIs (`@cryptos-pki/api-client`), imported as `@cryptos-pki/api-client/cryptos/node/v1/<file>_pb` and `@cryptos-pki/api-client/cryptos/fleet/v1/<file>_pb`.

## 🧱 Stack

- ⚛️ **React + TypeScript**
- ⚡ **Vite** (bundler)
- 🔌 **Talks to `manager/` via Connect-Web** (gRPC-over-HTTP/2), using the TS stubs in `packages/api-client`. protoc-gen-es builds them from the node API ([`cryptos-node/proto`](https://github.com/CryptOS-PKI/cryptos-node/tree/main/proto)) and the fleet API ([`cryptos-manager/proto`](https://github.com/CryptOS-PKI/cryptos-manager/tree/main/proto)) at the commits pinned in `packages/api-client/proto-refs.env`, and checked in, so a config edited here keeps every field the node sends
- 🔐 **Browser-side mTLS** for operator authentication (smart-card or YubiKey-backed client cert in the OS cert store; no passwords)
- 🛡️ **Strict CSP**, no third-party JS, no CDN fetches at runtime — the bundle is fully self-contained so the project stays air-gap-friendly

## 🎯 Role-aware UI

The same bundle adapts at runtime based on the role of the node being viewed:

- 🪨 **Root nodes** — ceremony driving, M-of-N quorum signing, recovery, re-key. No issuance UI.
- 🔌 **Intermediate / Issuing nodes** — issuance profiles, certificate inventory, CSR review, CRL / OCSP status, adapter health, audit log tail.
- 👁️ **All nodes** — live status, configuration view (read-only when the node is linked to FM, which is the normal mode).

## 🚀 First run

A new Fleet Manager with no operator CA configured starts in first run. Before sign-in the web UI asks the manager for its first-run state. While it is open, a wizard takes the single-use bootstrap token from the manager's log (after a check of the server certificate's fingerprint), registers your external operator CA with its CRL source and OCSP mode once you confirm its fingerprint, and gets the first admin certificate. Path A makes the key in the browser, with a mandatory encrypted key backup, then builds the PKCS#12 once your CA signs the CSR. Path B gives the OpenSSL recipe and an optional pre-flight. It ends with install steps for each OS. The session secret stays in memory only.

## 🪪 Operator credentials

Operator certificates come from your own external operator CA (an offline OpenSSL CA or an enterprise CA). The Fleet Manager never signs one; it records them and can deny them.

- 📝 **Request credential** (Operators page, admin) makes a P-384 key and CSR in the browser, with a mandatory encrypted key backup whose passphrase is shown once, or takes a CSR the holder made. It returns the CSR, the OpenSSL extension section for the level and the `openssl ca` command for the CA operator.
- ✅ **Complete** records the signed certificate against its request and, when this browser can open the key backup, builds the PKCS#12 locally with the same passphrase. **Record certificate** imports one made entirely at the CA.
- ⛔ **Deny at the Fleet Manager** puts a credential on the Fleet Manager's denylist, with an RFC 5280 reason and a note. It doesn't revoke at the CA, and says so.
- 🏛️ **Operator CAs** (admin) lists the trusted CAs with their CRL and OCSP state, registers a new one after you confirm its SHA-256 fingerprint against the CA machine, retires one (the manager refuses the last active CA, and asks before locking you out), and changes the CRL source, uploads a CRL or sets the OCSP mode. Banners flag a CA whose revocations aren't observed, a CRL expiring or expired, and an OCSP responder that isn't answering.
- 🙋 **Make a credential request** at `/request-credential` is an anonymous page where a future operator makes their own key, key backup and CSR, and later builds their PKCS#12. It makes no network calls.

## 🤖 Agent access (MCP)

The Fleet Manager serves an MCP endpoint so AI agents can manage the fleet. An agent never gets more than the operator who let it in, and this UI is where that consent happens:

- 🔑 **Sign-in consent** at `/oauth/consent?req=<id>`. An MCP client's OAuth sign-in lands here in the operator's browser. The page shows the client's name, the loopback host the code returns to, and the operator certificate that will own the key, and lets the operator pick a level ceiling (up to their own level) and a label before choosing Approve or Deny. It sits outside the console's Log in step, because the manager authenticates the request with the certificate the browser presents. It talks to the manager's `/oauth2/consent/<id>` endpoint as plain JSON on the same origin.
- 🗝️ **Agent keys** (next to Operators) lists your keys with their client, ceiling, creation time, last use and status, and lets you revoke one. An admin can switch to every operator's keys. **Create key** mints a key for a client that cannot open the browser sign-in. The key is shown once, with a copy button, and is discarded when the dialog closes; the manager keeps only a hash of it.
- ✋ **Approvals** (next to Agent keys, with a count of pending requests) is where a person decides the step-up requests an agent raises before a tool that changes the fleet runs. It lists pending requests by default, and a status filter switches to approved, denied, expired, used or all. Each row shows the tool, a summary, who asked (CN), the agent key, the required level, when it was created and expires, and its status. **Approve** and **Deny** each ask for confirmation, repeating the approval ID and summary so they can be matched against what the agent showed you. The request digest (SHA-256 of the call's arguments) is shown as a detail; the agent never receives it, and the audit log records it. The buttons are disabled unless the request is pending and your level is at least the one it requires; the manager enforces the same rule, and an agent key can never list or decide an approval. The manager's approval link opens `/approvals?id=<id>`, which shows every status and highlights that request.
- 📜 **Audit** shows who acted (the certificate CN, and whether it acted directly or through an agent key), the surface it came through (web, mcp or api), the MCP tool and the outcome. Entries recorded before the manager captured an actor show a dash.

A key is bound to the operator certificate that created it. It stops working when that certificate is revoked or renewed, and its effective level is the certificate's live level or its ceiling, whichever is lower.

## 🚦 Status

**Pre-alpha**, working toward v1.0.0. The fleet console is built and runs against a real manager: the fleet overview and topology, nodes (config, profiles, issuance, re-key), certificates, issuance profiles, protocol adapters, enrollment and adoption, operators, the Root CA pages and the audit log. Sign-in is an explicit Log in step that reads the operator's identity and level from the client certificate the browser presented.

It has two data sources, chosen at build time with `VITE_FLEET_MODE`:

- 📡 **`live`** (the default) reads everything from the manager over Connect. `VITE_FLEET_API` is the manager's address (default `http://localhost:8080`).
- 🧪 **`mock`** keeps every page on the in-memory fixtures in `apps/console/src/lib/mock.ts`, for UI work without a manager or a client certificate. The test suite runs in this mode.

To run it locally:

**Linux / macOS**

```bash
npm ci                            # install exactly what the lockfile pins
VITE_FLEET_MODE=mock npm run dev  # offline, on the fixtures
npm run dev                       # live, against a manager at VITE_FLEET_API
```

**Windows (PowerShell)**

```powershell
npm ci                                                             # install exactly what the lockfile pins
$env:VITE_FLEET_MODE = "mock"; npm run dev                         # offline, on the fixtures
Remove-Item Env:VITE_FLEET_MODE -ErrorAction SilentlyContinue; npm run dev  # live, against a manager at VITE_FLEET_API
```

The build phases (project-wide):

1. 🪨 Phase 1 — Core OS + single-node Root CA MVP (no frontend in this phase)
2. 🔌 **Phase 2 — Role-aware API + protocol adapters + Fleet Manager.** This repo is Phase 2 work.
3. 🛡️ Phase 3 — Pool, HA, extensions, isolation, recovery.

## 🧭 Companion repos

- 🛰️ [`cryptos-manager`](https://github.com/CryptOS-PKI/cryptos-manager) — the Fleet Manager backend, and the home of the fleet API. Serves this bundle.
- 🧠 [`cryptos-node`](https://github.com/CryptOS-PKI/cryptos-node) — the OS / engine that runs the CAs this UI manages (indirectly, via `manager/`), and the home of the node API.

## 🛠️ Build

Requires Node 22 LTS (the version CI builds on) and npm, plus [`buf`](https://buf.build) to regenerate the stubs. Bump a ref in `packages/api-client/proto-refs.env`, run `npm run generate`, and commit `packages/api-client/src/gen` in the same change. All dependencies are self-hosted (fonts bundled as woff2, no runtime CDN).

```bash
npm ci            # install every workspace from the one lockfile
npm run dev       # start the console's Vite dev server
npm run build     # type-check and build every app (the console bundle lands in apps/console/dist/)
npm run lint      # eslint (typescript-eslint) + prettier --check, across the repo
npm run format    # prettier --write
npm test          # vitest, in every workspace
npm run generate  # regenerate packages/api-client from the pinned node and fleet protos (needs buf)
task license      # check the Apache 2.0 headers (task license:fix adds them)
```

The pre-push hook runs `npm run lint` and `npm test`. CI runs lint, test, build and a check that the generated stubs match the pinned protos on every pull request, and checks the license headers with `task license`.

After a stacked pull request is retargeted onto `main`, CI starts on its next push, or when it is toggled to draft and back to ready.

## 📄 License

[Apache License 2.0](LICENSE). Copyright The CryptOS Authors.
