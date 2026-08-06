# Todo — working notes

A personal todo list with an Eisenhower matrix. No backend: a web client only, everything lives in the browser. Targets desktop and phone (iPhone, Android), installs as a PWA, works offline, and syncs between devices manually over WebRTC via QR codes.

Stack: Vite 8 (Rolldown), Vue 3.5, TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4, SCSS modules, `idb`.

Every file in the repository is written in English — code, comments, docs, commit messages. The only exception is the localization files under `src/i18n/locales/`. Chat with the user happens in their language, which is Russian.

## Commands

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server                            |
| `npm run build`   | `vue-tsc --noEmit` + build to `dist/` |
| `npm run preview` | Serve the build on `localhost:4173`   |
| `npm test`        | Unit tests, single run                |
| `npm run lint`    | ESLint                                |
| `npm run format`  | Prettier                              |

Before calling work finished, run all three: `npm test`, `npm run lint`, `npm run build`.

## Conventions

Everything is English except `src/i18n/locales/ru.json`.

Formatting lives in [.prettierrc.json](../.prettierrc.json): tabs (`tabWidth: 2`), single quotes, `printWidth: 100`, `trailingComma: all`.

SFC sections go **style → template → script**, enforced by the `vue/block-order` rule in [eslint.config.js](../eslint.config.js). Always `<style lang="scss" module>` and `<script setup lang="ts">`. Reaching into Vuetify internals from a CSS module needs `:deep()` and `:global()`.

Imports inside `src` use the `@/` alias.

## Architecture

```
src/
	types/todo.ts          — the shape of the data, single source of truth
	services/
		storage/             — types.ts (interface), indexed-db.ts, in-memory.ts, persistence.ts
		backup/              — format.ts (envelope validation), file.ts (download/read)
		sync/                — signal.ts (pairing-code codec), connection.ts (WebRTC), merge.ts
	stores/todos.ts        — Pinia store
	views/                 — TodoListView, MatrixView, SyncView
	components/            — TodoForm, TodoQuadrant, BackupMenu, SyncCode, SyncScanner
	i18n/, plugins/, router/
```

Dependencies point one way: views → store → services. **The `services` layer knows nothing about Vue or Pinia** — that is what keeps its tests free of a browser environment and the storage swappable.

`TodoStorage` ([src/services/storage/types.ts](../src/services/storage/types.ts)) is the key boundary: `getAll / put / remove / clear`. The store does not know IndexedDB sits underneath; tests substitute the in-memory implementation.

The Eisenhower matrix is **a view of the same data**, not a separate entity: the `quadrants` getter splits `items` by `important` × `urgent` into `do / schedule / delegate / eliminate`.

## Data model

`Todo`: `id`, `title`, `note?`, `created`, `updated`, `period` (`one-time | periodic`), `important`, `urgent`, `done`, `deleted`.

Two things are easy to break without knowing them:

- **`updated` moves on every change** — sync merges on it, and the later version wins. Any new mutation has to advance it; `store.update()` does that itself, so records must never be mutated around it.
- **Deletion is soft.** `remove()` sets `deleted: true` and the record stays as a tombstone. Without it a merge cannot tell "deleted here" from "not created yet" and hands the task straight back. In the store, `records` holds everything including tombstones (sync needs them) and `items` holds what the user sees. Views only ever touch `items`.

The IndexedDB schema is at version 2. Changing the record shape means raising `DB_VERSION` and writing a migration that backfills old records without granting them an undeservedly fresh `updated`.

## Traps already paid for

**Anything new that writes data has to be exercised at least once in a real browser.** Unit tests do not catch this: the in-memory storage silently accepts Vue's reactive proxies while IndexedDB rejects them — structured clone throws. The symptom is data that renders correctly and vanishes on reload. Write only plain copies (`{ ...todo }`) to storage.

**Chrome on this machine cannot verify the PWA.** Build 150.0.7871.189 has a broken Cache API: `caches.open(...).put(...)` fails with `InvalidAccessError: Entry already exists` even on a clean profile. Use Edge. The diagnostic snippet is in the [README](../README.md#testing-the-pwa-locally).

**Vuetify's own strings** (pagination, "Items per page") are localized through Vuetify's locale system in [src/plugins/vuetify.ts](../src/plugins/vuetify.ts), not vue-i18n: the adapter would need the runtime message compiler that precompilation removes.

**The service worker precache must contain no duplicates.** A URL listed twice fails the install with `Entry already exists`, and offline mode silently does not work at all. Hence `includeManifestIcons: false` and no `includeAssets` in [vite.config.ts](../vite.config.ts).

**The IndexedDB connection must close on `versionchange`**, otherwise a second tab carrying a new schema version hangs.

**Sync only works within one network.** There are deliberately no ICE servers — that would be an internet dependency — so the address in the code is an mDNS `*.local` name. Guest Wi-Fi with client isolation will not pass it.

## Process

Intent and decisions live in `docs/superpowers/specs/`, step-by-step plans in `docs/superpowers/plans/`. Before changing behaviour, read the matching spec: it records why something was built the way it was.

Stages 1–5 are done and merged into `main`: core, list, matrix, PWA/offline, export-import, sync. Not done: stage 6 — reworking the data model (short/medium/long-term horizons, goals, dreams, recurrence frequency, completion history). That is a separate brainstorming conversation, not a queued task.

Remote and deployment are deliberately postponed; the user reviews the architecture themselves. Do not add a git remote or deploy without being asked.
