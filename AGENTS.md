# AGENTS.md - web

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

Fleet Manager web frontend for CryptOS-PKI. React + TypeScript, built with Vite, served by manager/.

This is a leaf application (a static bundle). It is **UI-first with mock data**: there is no backend
wiring yet. Live surfaces talk to the manager through Connect-Web using the TypeScript stubs in
`src/gen/fleet/`; mock mode reads typed fixtures from `src/lib/mock.ts` that stand in for the
manager's gRPC responses. The whole
bundle is self-contained (fonts bundled as woff2, strict CSP, no runtime CDN) for air-gap use.

## Layout

- `src/main.tsx` - entry; mounts the theme + auth providers and the router.
- `src/App.tsx` - route table (Fleet `/`, Nodes `/nodes`, node detail `/nodes/:name`, Audit, 404).
- `src/components/layout/` - app shell: header, sidebar nav, wordmark, theme toggle, auth gate.
- `src/components/ui/` - shadcn/ui primitives (button, card, badge, separator).
- `src/context/` - `theme.tsx` (dark/light, persisted) and `auth.tsx` (browser-mTLS gate stub).
- `src/lib/` - `mock.ts` (typed Node model + fixtures) and `utils.ts` (the `cn` helper).
- `src/pages/` - the routed views. `src/test/` - vitest setup.

## Build, test, lint

- Build: `npm run build` (`tsc -b` then `vite build`)
- Test: `npm test` (vitest; no external service required)
- Lint: `npm run lint` (eslint + `prettier --check`); `npm run format` to fix
- License headers: `task license` (golic; `.golic.yaml` adds the .ts/.tsx rules)

## Conventions and gotchas

- See `CLAUDE.md` for the branch/commit/PR rules; they are enforced by the git hooks in
  `.claude/hooks` (run `bash .claude/hooks/install.sh` once per clone).
- Open every PR as a draft. CI skips drafts, so run the full checks locally, push once they pass,
  and mark the PR ready when the work is finished; see CLAUDE.md "CI and Actions minutes".
- `src/gen/fleet/` is a copy of the api repo's `gen/ts/cryptos/` at its current `main`; never edit
  it by hand. Refresh it whenever an api change adds a field. Connect-Web decodes JSON with unknown
  fields ignored, so a stale stub drops a new field without an error, and a config read, edited and
  applied through the UI then clears that field on the node. `src/lib/wire-fields.test.ts` pins
  the newer fields; extend it when you refresh.
