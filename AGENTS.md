# AGENTS.md - web

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

Fleet Manager web frontend for CryptOS-PKI. React + TypeScript, built with Vite, served by manager/.

This is a leaf application (a static bundle). Live mode (the default) is wired to the manager: live
surfaces talk to it through Connect-Web using the TypeScript stubs in `src/gen/fleet/`. Mock mode
(`VITE_FLEET_MODE=mock`, which the test suite pins) reads typed fixtures from `src/lib/mock.ts` that
stand in for the manager's gRPC responses. The whole bundle is self-contained (fonts bundled as
woff2, strict CSP, no runtime CDN) for air-gap use.

## Layout

- `src/main.tsx` - entry; mounts the theme + auth providers and the router.
- `src/App.tsx` - route table (Fleet `/`, Nodes `/nodes`, node detail `/nodes/:name`, Operator CAs `/operator-cas`, Operators,
  Agent keys `/agent-keys`, Approvals `/approvals` (accepts `?id=<approval>` from the manager's
  approval link), Audit, 404). The MCP sign-in consent page `/oauth/consent` is routed
  outside the auth gate on purpose: the manager authenticates that request with the browser's
  client certificate, and it talks to `/oauth2/consent/<id>` with plain `fetch`, not Connect.
  The "Make a credential request" page `/request-credential` is outside the gate too, and makes
  no network calls at all: it must not import the Fleet Manager client.
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
- The manager puts a stable numeric code on every error it returns (metadata key
  `x-cryptos-error-code`; the table is the manager's `docs/error-codes.md`). Branch on it with
  `errorCode()` from `src/lib/fleet/error-code.ts`, never on the message text, and add a code to
  its `ErrorCode` map when a page handles one. The Operators page does this for 1400 (no operator
  CA configured) and shows a not-configured view instead of the refusal. The 1600-1611 block
  (first run, operator CAs, operator credentials) also carries a sub-reason
  (`x-cryptos-error-reason`, read with `errorReason()`); `src/lib/fleet/error-copy.ts` maps every
  code and sub-reason to a message, and `fleetErrorMessage()` is what those screens show.
- Operator private keys never leave the browser. `src/lib/crypto/key-backup.ts` writes the
  encrypted key backup (PBES2 PKCS#8), reads it back, and builds the PKCS#12 with the backup's
  own passphrase; the credential wizards hold only the encrypted backup in memory. Tests assert
  on the request bodies that neither the key nor the passphrase is ever sent.
- Operator CA registration is a preview then a confirm with `confirm_sha256`.
  `OperatorCARegisterForm` takes the submit call as a prop, so the admin page and first run share
  it; `registerRequestFields()` builds the body both RegisterOperatorCA RPCs take.
  `operatorCABanners()` decides the CRL and OCSP banners from `ListOperatorCAs`.
- The Approvals nav badge counts pending approvals through `listApprovals`. It recounts on every
  navigation, every 30 seconds, and when `decideApproval` dispatches the `APPROVALS_CHANGED`
  window event (`src/lib/approvals.ts`). A new surface that changes an approval should go through
  `decideApproval` so the badge stays current.
