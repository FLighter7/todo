# Todo

A todo list with an Eisenhower matrix. Built for personal use: no backend of its own, everything is stored in the browser, works on desktop and phone, and syncs between devices through your own [workspace-server](https://github.com/FLighter7/workspace-server) on the local network.

Folder structure and architectural rules are documented in [.claude/Architecture.md](.claude/Architecture.md).

## Commands

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm install`      | Install dependencies                                  |
| `pnpm run dev`      | Dev server with hot reload                            |
| `pnpm dev --host`   | The same, reachable from other devices on the network |
| `pnpm run build`    | Type check and production build into `dist/`          |
| `pnpm run preview`  | Serve the built app locally                           |
| `pnpm test`         | Unit tests                                            |
| `pnpm run lint`     | ESLint                                                |
| `pnpm run format`   | Prettier                                              |
| `pnpm run test:e2e` | Playwright e2e tests, accessibility probes included   |
| `pnpm run test:sr`  | NVDA screen reader scenarios, Windows only            |

## Where the data lives and when it disappears

Tasks are stored in the **IndexedDB** of whichever browser the app is open in. Not in the cloud and not in a file: another device keeps its own independent list, and bringing them together is what the Sync page is for.

Three things about durability are worth knowing up front.

**Safari deletes site data after 7 days without a visit.** This covers IndexedDB, localStorage and the service worker registration. Open the app in a Safari tab, stay away for a week, and the tasks are gone. Web apps added to the **home screen** are counted separately and the rule does not apply to them — which is why on iPhone the app should be installed rather than kept as a tab. Details are in [WebKit's post on storage policy changes](https://webkit.org/blog/14403/updates-to-storage-policy/).

**By default storage is best-effort.** The browser may clear it when the device runs low on space. The app asks for persistent mode through `navigator.storage.persist()`, but the decision stays with the browser: Chrome usually grants it to installed apps, Safari when the app is added to the home screen.

**Backups are manual.** The menu in the app bar has two actions: save every task to a JSON file, and restore them from one. There are no automatic copies, so once the list is worth anything it is worth exporting a file now and then.

Restoring **replaces** the whole list with the contents of the file rather than adding to it, so a confirmation with counts appears first. A damaged file cannot hurt the list: the app validates the contents completely before it writes anything.

**Closed records are not erased at once.** Marking a record done or cancelled is the only way to remove it, and the closed record itself stays behind as the marker: without it sync would bring it back, because "closed here" and "not created yet" would look identical. It leaves the active list but stays in the database, in backup files and on the sync server until it is older than the cleanup window chosen in Settings (30, 60 or 90 days), and only then is it deleted for good. Worth keeping in mind for anything sensitive.

## Syncing between devices

Devices sync through **workspace-server**, a small program you run on your own computer (later perhaps a home server). It keeps a copy of your data in a folder on that computer and passes changes between your devices. It knows nothing about tasks: it stores the app's document and tells devices when it changed. Nothing goes over the internet.

1. **Install and run the server.** Download it from [its repository](https://github.com/FLighter7/workspace-server) and follow its guide; it opens its own page in the browser on that computer.
2. **Pair each device once.** On the server's page press "Pair a device". In the app open the Sync page and scan the code with the camera, or paste it — on the server's own computer the clipboard is shared, so no camera is needed. A code works once and for ten minutes. On iPhone, pair inside the app installed to the home screen: it keeps its storage apart from Safari.
3. **That is all.** While the app is on screen it stays connected and syncs on its own: when it opens, a few seconds after an edit, and as soon as another device changes something. The Sync page shows the state, the time of the last sync, a Sync now button and Disconnect from server.

**The server and the devices must be on the same network.** The connection runs over the local network, without STUN or TURN, and will not work across the internet; guest Wi-Fi with client isolation blocks it too. Away from home the app works offline as always and catches up once it can reach the server again.

When merging, the version edited later wins for each record, and the marks on a recurring task are merged one occurrence at a time, so marks made on two devices are both kept. Closing a record counts as an edit, so a task closed on one device is closed on the others too — unless another device edited it even later.

**Settings are not synced.** Each device keeps its own theme, language, text size and page choices; a backup file still carries them.

The copy on the server is a normal backup file (`apps/todo/data.json` in the server's folder), and the server keeps its previous versions too, so it can be restored through Settings → Restore like any backup.

## Installing as an app

The app installs onto the device and works without a network.

**On a computer.** Open it in Chrome or Edge and press the install icon in the address bar. This works with a local `pnpm run preview` as well, but the installed app then stays bound to `localhost:4173` and only opens while that server runs — for everyday use, install from a deployed address.

**On a phone.** iOS: open in Safari, Share → "Add to Home Screen". Android: Chrome offers the install itself, or use menu → "Install app".

## Testing the PWA locally

**`pnpm run dev` never registers a service worker, on purpose.** `vite-plugin-pwa` only wires one up in a production build; under the dev server `registerSW()` resolves to a no-op, so nothing gets cached and closing the dev server takes the page down with it. That is expected, not a bug — use the build below to see or test offline behavior.

A service worker requires a secure context. HTTPS qualifies, and browsers also trust `http://localhost` and `http://127.0.0.1` — specifically for development. So all of it can be checked locally:

```bash
pnpm run build
pnpm run preview
```

Open `http://localhost:4173/todo/`. The service worker registers, the install icon appears, and offline mode is checked in DevTools: Application → Service Workers, or Network → Offline followed by a reload.

**A phone will not work this way.** `pnpm dev --host` serves an address like `http://192.168.1.5:3000`, and that is already an insecure context: the service worker will not register and there will be no install. Two options remain — a temporary HTTPS tunnel (Cloudflare Tunnel, ngrok) or a deployment. The Chrome flag for trusting an insecure origin does not exist on iOS.

**If offline mode does not work, suspect the browser first.** Run this in the console:

```js
caches.open('t' + Math.random()).then((c) => c.put('/x', new Response('hi')));
```

It should complete silently. If it throws `InvalidAccessError: Entry already exists`, the Cache API in that browser build is broken and the app is not at fault. That is exactly how Chrome 150.0.7871.189 behaved while this stage was being built; Edge was fine. Try another browser before looking for the cause in the code.

## Deployment

The app targets GitHub Pages and builds with the base path `/todo/`, so the address will look like `https://<user>.github.io/todo/`. For different hosting the base path is the `base` option in [vite.config.ts](vite.config.ts); hosting at a domain root needs only `'/'`.

Deployment is automatic: the `deploy` job in [.github/workflows/ci.yml](.github/workflows/ci.yml) builds and publishes `dist/` via GitHub's Pages Actions (`actions/deploy-pages`) on every push to `main`, once `test` passes. This requires a one-time repo setting: Settings → Pages → Source → "GitHub Actions".

## Documentation

Durable rationale and conventions from finished build stages live in [docs/decisions.md](docs/decisions.md).

The accessibility audit (WCAG 2.2 AA), its findings, the backlog it left, and how to rerun it are in [docs/accessibility-audit.md](docs/accessibility-audit.md).
