# Todo

A todo list with an Eisenhower matrix. Built for personal use: no backend, everything is stored in the browser, works on desktop and phone.

Folder structure and architectural rules are documented in [.claude/Architecture.md](.claude/Architecture.md).

## Commands

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm install`           | Install dependencies                                  |
| `npm run dev`           | Dev server with hot reload                            |
| `npm run dev -- --host` | The same, reachable from other devices on the network |
| `npm run build`         | Type check and production build into `dist/`          |
| `npm run preview`       | Serve the built app locally                           |
| `npm test`              | Unit tests                                            |
| `npm run lint`          | ESLint                                                |
| `npm run format`        | Prettier                                              |
| `npm run test:e2e`      | Playwright e2e tests, accessibility probes included   |
| `npm run test:sr`       | NVDA screen reader scenarios, Windows only            |

## Where the data lives and when it disappears

Tasks are stored in the **IndexedDB** of whichever browser the app is open in. Not in the cloud and not in a file: another device keeps its own independent list, and bringing the two together is what the sync tab is for.

Three things about durability are worth knowing up front.

**Safari deletes site data after 7 days without a visit.** This covers IndexedDB, localStorage and the service worker registration. Open the app in a Safari tab, stay away for a week, and the tasks are gone. Web apps added to the **home screen** are counted separately and the rule does not apply to them — which is why on iPhone the app should be installed rather than kept as a tab. Details are in [WebKit's post on storage policy changes](https://webkit.org/blog/14403/updates-to-storage-policy/).

**By default storage is best-effort.** The browser may clear it when the device runs low on space. The app asks for persistent mode through `navigator.storage.persist()`, but the decision stays with the browser: Chrome usually grants it to installed apps, Safari when the app is added to the home screen.

**Backups are manual.** The menu in the app bar has two actions: save every task to a JSON file, and restore them from one. There are no automatic copies, so once the list is worth anything it is worth exporting a file now and then.

Restoring **replaces** the whole list with the contents of the file rather than adding to it, so a confirmation with counts appears first. A damaged file cannot hurt the list: the app validates the contents completely before it writes anything.

**Deleted tasks are not physically erased.** A deletion marker stays behind instead: without it sync would bring deleted tasks back, because "deleted here" and "not created yet" would look identical. Such tasks disappear from the list but remain in the database and in backup files. Worth keeping in mind when deleting something sensitive.

## Syncing between devices

The Sync tab connects two devices directly over WebRTC. There is no server: the data travels between the devices and nowhere else.

It goes like this. On the first device press "Start on this device" — a QR code appears. On the second choose "Join another device" and scan that code; the second device then shows a reply code for the first one to scan. After that both lists are merged in both directions.

**Both devices must be on the same network.** The connection is made directly over the local network, without STUN or TURN, and will not work across the internet. The address inside the code is an mDNS name of the form `xxxxx.local`, so on networks where multicast DNS is blocked or client isolation is on — typical of guest Wi-Fi — the connection will not come up.

**A camera is not always needed.** Every code has a copy button underneath, and the scanner has a paste field. For a phone paired with a computer that has no webcam this is the main path: the code is short, around 300 characters.

When merging, the version edited later wins for each task. Deletion counts as an edit, so a task deleted on one device is deleted on the other too — unless the other device edited it even later.

## Installing as an app

The app installs onto the device and works without a network.

**On a computer.** Open it in Chrome or Edge and press the install icon in the address bar. This works with a local `npm run preview` as well, but the installed app then stays bound to `localhost:4173` and only opens while that server runs — for everyday use, install from a deployed address.

**On a phone.** iOS: open in Safari, Share → "Add to Home Screen". Android: Chrome offers the install itself, or use menu → "Install app".

## Testing the PWA locally

**`npm run dev` never registers a service worker, on purpose.** `vite-plugin-pwa` only wires one up in a production build; under the dev server `registerSW()` resolves to a no-op, so nothing gets cached and closing the dev server takes the page down with it. That is expected, not a bug — use the build below to see or test offline behavior.

A service worker requires a secure context. HTTPS qualifies, and browsers also trust `http://localhost` and `http://127.0.0.1` — specifically for development. So all of it can be checked locally:

```bash
npm run build
npm run preview
```

Open `http://localhost:4173/todo/`. The service worker registers, the install icon appears, and offline mode is checked in DevTools: Application → Service Workers, or Network → Offline followed by a reload.

**A phone will not work this way.** `npm run dev -- --host` serves an address like `http://192.168.1.5:3000`, and that is already an insecure context: the service worker will not register and there will be no install. Two options remain — a temporary HTTPS tunnel (Cloudflare Tunnel, ngrok) or a deployment. The Chrome flag for trusting an insecure origin does not exist on iOS.

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
