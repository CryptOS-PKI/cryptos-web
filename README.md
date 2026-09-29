# web 🎨

> 🖥️ The web frontend for the [CryptOS-PKI](https://github.com/CryptOS-PKI) Fleet Manager. React + TypeScript, built with Vite to a static bundle that [`manager`](https://github.com/CryptOS-PKI/manager) embeds and serves on its own TLS listener.

## ✨ What it is

This is the **only** web UI in the project, by design. CryptOS CA nodes ([`cryptos`](https://github.com/CryptOS-PKI/cryptos)) do not ship a web frontend in the OS image — they expose mTLS gRPC and that's it. When a fleet operator wants a web UI, they stand up the Fleet Manager (`manager/` backend + this frontend), link nodes to it, and use this UI for day-to-day operations.

Conceptually `manager/` and `web/` are one application split across two repos. The split exists so the backend and frontend can be built, tested, and released on their own cadences while still ending up in a single deployable container image (the frontend bundle is pinned to a specific commit and embedded into `manager/` via `embed.FS`).

## 🧱 Stack

- ⚛️ **React + TypeScript**
- ⚡ **Vite** (bundler)
- 🔌 **Talks to `manager/` via Connect-Web** (gRPC-over-HTTP/2), using TS stubs generated from [`api/`](https://github.com/CryptOS-PKI/api). The stubs are checked in under `src/gen/fleet/` and copied from the api repo's `gen/ts/` whenever its protos change, so a config edited here keeps every field the node sends
- 🔐 **Browser-side mTLS** for operator authentication (smart-card or YubiKey-backed client cert in the OS cert store; no passwords)
- 🛡️ **Strict CSP**, no third-party JS, no CDN fetches at runtime — the bundle is fully self-contained so the project stays air-gap-friendly

## 🎯 Role-aware UI

The same bundle adapts at runtime based on the role of the node being viewed:

- 🪨 **Root nodes** — ceremony driving, M-of-N quorum signing, recovery, re-key. No issuance UI.
- 🔌 **Intermediate / Issuing nodes** — issuance profiles, certificate inventory, CSR review, CRL / OCSP status, adapter health, audit log tail.
- 👁️ **All nodes** — live status, configuration view (read-only when the node is linked to FM, which is the normal mode).

## 🚦 Status

**Pre-alpha**, working toward v1.0.0. The fleet console is built and runs against a real manager: the fleet overview and topology, nodes (config, profiles, issuance, re-key), certificates, issuance profiles, protocol adapters, enrollment and adoption, operators, the Root CA pages and the audit log. Sign-in is an explicit Log in step that reads the operator's identity and level from the client certificate the browser presented.

It has two data sources, chosen at build time with `VITE_FLEET_MODE`:

- 📡 **`live`** (the default) reads everything from the manager over Connect. `VITE_FLEET_API` is the manager's address (default `http://localhost:8080`).
- 🧪 **`mock`** keeps every page on the in-memory fixtures in `src/lib/mock.ts`, for UI work without a manager or a client certificate. The test suite runs in this mode.

To run it locally:

```bash
npm ci                            # install exactly what the lockfile pins
VITE_FLEET_MODE=mock npm run dev  # offline, on the fixtures
npm run dev                       # live, against a manager at VITE_FLEET_API
```

The build phases (project-wide):

1. 🪨 Phase 1 — Core OS + single-node Root CA MVP (no frontend in this phase)
2. 🔌 **Phase 2 — Role-aware API + protocol adapters + Fleet Manager.** This repo is Phase 2 work.
3. 🛡️ Phase 3 — Pool, HA, extensions, isolation, recovery.

## 🧭 Companion repos

- 🛰️ [`manager`](https://github.com/CryptOS-PKI/manager) — the Fleet Manager backend. Serves this bundle.
- 📡 [`api`](https://github.com/CryptOS-PKI/api) — shared `.proto` definitions; this repo consumes its generated TypeScript stubs.
- 🧠 [`cryptos`](https://github.com/CryptOS-PKI/cryptos) — the OS / engine that runs the CAs this UI manages (indirectly, via `manager/`).

## 🛠️ Build

Requires Node 22 LTS (the version CI builds on) and npm. All dependencies are self-hosted (fonts bundled as woff2, no runtime CDN).

```bash
npm ci           # install dependencies from the lockfile
npm run dev      # start the Vite dev server
npm run build    # type-check and produce the static bundle in dist/
npm run preview  # serve the built dist/ locally
npm run lint     # eslint (typescript-eslint) + prettier --check
npm run format   # prettier --write
npm test         # vitest
task license     # check the Apache 2.0 headers (task license:fix adds them)
```

The pre-push hook runs `npm run lint` and `npm test`. CI runs lint, test and build on every pull request, and checks the license headers with `task license`.

## 📄 License

[Apache License 2.0](LICENSE). Copyright 2026 Shane.
