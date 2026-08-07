# Design: testing strategy

Date: 2026-08-07

## Context

The project has gone through 5 stages (core, list, matrix, PWA/offline, export-import, sync) under one
testing policy that was never reconsidered: Vitest unit tests only, `environment: 'node'`, covering
`stores/`, `services/`, `repositories/`. No `.vue` file, `SyncConnection.ts` (the WebRTC peer wrapper),
`BackupFile.ts`, CI, or coverage reporting has any test coverage. This was a deliberate choice early on
— the original spec states "component and e2e tests are not done at these stages" — and the most recent
spec (`2026-08-07-project-architecture-design.md`) explicitly listed "redesigning the test strategy or
coverage" as out of scope for that refactor, deferring it rather than resolving it.

This design resolves that deferral, through a brainstorming session with the user that settled three
scope questions: whether to expand automated coverage beyond logic into components and e2e, whether e2e
should attempt the hardest scenario (WebRTC sync between two devices) or stay local-only, and whether to
add CI now despite the repository having no git remote yet.

## Decisions

**Expand coverage to components and e2e**, not just keep the existing logic-only / manual-UI split.
The user chose to invest in this now rather than continue deferring it.

**E2E includes the WebRTC sync flow**, not just local CRUD/matrix/PWA scenarios. This is the scenario
unit tests structurally cannot reach — it requires two independent peers negotiating a real
`RTCPeerConnection`.

**Add CI (GitHub Actions) now**, even though the repository has no git remote. The workflow file will
sit inert until a remote exists, consistent with the project's rule against adding a remote or deploying
without being asked — adding the workflow now just means it's ready to fire the moment a remote exists.
**No coverage threshold or gate**: tests must pass; no numeric target is enforced.

## Tooling

**Component tests: `@vue/test-utils` + `happy-dom`.** `@vue/test-utils` (mount/find/trigger) is the
official, low-level API and is more predictable than `@testing-library/vue`'s role/label-based queries
when the component tree includes Vuetify's teleported overlays (menus, dialogs, selects render outside
the component's own DOM subtree). `happy-dom` over `jsdom` for speed — the common modern pairing with
Vitest. Existing logic tests stay on `environment: 'node'` (fast, unchanged); new component test files
opt into DOM via a per-file `// @vitest-environment happy-dom` docblock, so no global Vitest config
split (workspace/projects) is needed for what is currently a handful of files. Vuetify's own globals
(`ResizeObserver`, `matchMedia`) will likely need stubbing in a small test setup file — a known friction
point when mounting Vuetify components, to be resolved during implementation.

**E2E: Playwright (`@playwright/test`).** The decisive reason is multi-context support: Playwright can
run several independent browser contexts within a single test, which is exactly what's needed to
simulate two devices pairing over WebRTC in one e2e run. Cypress runs one tab per spec and has no clean
equivalent for two peers negotiating a real connection against each other. Playwright also has
first-class TypeScript support, auto-wait, and a trace viewer for debugging flaky e2e failures.

Playwright's bundled Chromium is a separate binary from the system Chrome build that has the local
broken-Cache-API bug (CLAUDE.md), so e2e PWA/offline tests should work against it directly; if not,
Playwright can target the `msedge` channel instead.

## What gets tested

**Component tests** — co-located `Component.test.ts` next to `Component.vue`, per Architecture.md's
already-stated (until now unfulfilled) convention. Priority goes to components with real
interaction/logic over pure presentational wrappers: `TodoForm`, `TodoQuadrant`/`MatrixBoard`,
`BackupMenu`, `SyncFlow`/`SyncCode`/`SyncScanner`. This list is representative, not exhaustive.

**E2E** — a new top-level `e2e/` directory (Playwright's own convention, distinct from the co-located
unit/component tests since a scenario spans multiple files/pages rather than one unit):

- CRUD + matrix: add/edit/delete a todo, toggle important/urgent, verify quadrant placement.
- PWA: build + preview, verify the service worker registers, verify offline reload works
  (`context.setOffline()`).
- Sync: two browser contexts in one test, exchange the SDP/QR payload, verify the merge result appears
  on both sides. Implementation should first check whether the sync UI already has a manual paste-code
  fallback to camera scanning — if so, the e2e test drives that directly; if not, a minimal test-only
  hook to inject the SDP text is needed. This is not resolved here — it's the first thing to confirm
  when writing the actual e2e test.

**`SyncConnection.ts` is deliberately left without a unit test.** Mocking `RTCPeerConnection`
end-to-end is brittle and low-value; its real behavior is exercised by the e2e sync scenario instead.
This is a considered decision, recorded here so it isn't later flagged as an oversight.

## CI

A new `.github/workflows/ci.yml`, triggered on push/PR: `npm ci` → `npm run lint` → `npm test` (Vitest,
unit + component) → `npm run build` → `npx playwright install --with-deps` → `npx playwright test`. No
coverage gate, no deploy step.

## New dependencies and scripts

devDependencies to add: `@vue/test-utils`, `happy-dom`, `@playwright/test`. package.json: add
`test:e2e` (`playwright test`); an optional `test:e2e:ui` (`playwright test --ui`) for local debugging
can be added during implementation if useful, not a hard requirement of this design.

## Test policy: mandatory / desirable / unneeded

**Mandatory** (already policy, unchanged, or now enforced via CI):

1. Unit tests on `stores/`, `services/`, `repositories/` for any new code in those layers.
2. `npm test && npm run lint && npm run build` before calling work finished.
3. Manual verification in a real browser (Edge) of anything that writes data or touches PWA/service
   worker behavior — unit tests can't catch reactive-proxy-vs-structured-clone failures.
4. CI running lint + test + build on every push/PR once a remote exists.

**Desirable** (the scope this design adds):

5. Component tests for the interactive `.vue` files listed above.
6. E2E covering local CRUD/matrix, PWA/offline, and cross-context sync pairing.

**Unneeded** (explicitly out of scope):

- Visual regression / screenshot diffing — overkill for a solo project with no design team.
- Contract tests — no backend API exists.
- A unit test for `SyncConnection.ts` that mocks `RTCPeerConnection` — brittle, covered by e2e instead.
- A coverage threshold/gate in CI.

## Verification

Once implemented: `npm test`, `npm run lint`, `npm run build`, and `npx playwright test` all pass
locally; the new component tests fail before their component is fixed and pass after (TDD, per project
convention); the CI workflow is syntactically valid (`act` or GitHub's workflow linter) even though it
won't run for real until a remote exists.

## Out of scope

Actually writing the component tests, the `e2e/` directory, or the CI workflow file — this document is
the design, not the implementation. That's the subject of a follow-up implementation plan. Also out of
scope: stage 6 (the data-model rework) and revisiting decisions already settled in
`2026-08-07-project-architecture-design.md`.
