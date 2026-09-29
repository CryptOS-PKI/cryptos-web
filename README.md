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

**Pre-alpha.** This repo currently contains only the LICENSE and this README. Vite + React + TypeScript scaffolding lands in a follow-up PR when Phase 2 frontend work begins.

The build phases (project-wide):

1. 🪨 Phase 1 — Core OS + single-node Root CA MVP (in progress; no frontend work yet)
2. 🔌 **Phase 2 — Role-aware API + protocol adapters + Fleet Manager.** This repo's first real scaffolding lands here.
3. 🛡️ Phase 3 — Pool, HA, extensions, isolation, recovery.

## 🧭 Companion repos

- 🛰️ [`manager`](https://github.com/CryptOS-PKI/manager) — the Fleet Manager backend. Serves this bundle.
- 📡 [`api`](https://github.com/CryptOS-PKI/api) — shared `.proto` definitions; this repo consumes its generated TypeScript stubs.
- 🧠 [`cryptos`](https://github.com/CryptOS-PKI/cryptos) — the OS / engine that runs the CAs this UI manages (indirectly, via `manager/`).

## 🛠️ Build

Requires Node 24+ and npm. All dependencies are self-hosted (fonts bundled as woff2, no runtime CDN).

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server
npm run build    # type-check and produce the static bundle in dist/
npm run lint     # eslint (typescript-eslint) + prettier --check
npm test         # vitest
```

The pre-push gate runs `npm run lint`, `npm test`, and `task license` (Apache 2.0 headers).

## 📄 License

[Apache License 2.0](LICENSE). Copyright 2026 Shane.
