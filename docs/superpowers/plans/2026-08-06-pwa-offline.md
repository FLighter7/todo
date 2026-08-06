# PWA and Offline — Implementation Plan (этап 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать приложение устанавливаемым на устройство и работающим без сети, чтобы на iPhone его данные не удалялись через семь дней.

**Architecture:** `vite-plugin-pwa` генерирует манифест и сервис-воркер на Workbox из результата сборки. Стратегия одна — предзагрузка всех файлов сборки плюс запасной вариант навигации на `index.html`. Правил кеширования времени выполнения нет: у приложения нет сетевых запросов после загрузки.

**Tech Stack:** vite-plugin-pwa 1.3.0, Workbox 7, Vite 8.

Спек: [docs/superpowers/specs/2026-08-06-pwa-offline-design.md](../specs/2026-08-06-pwa-offline-design.md)

## Global Constraints

- Наследуются все ограничения плана этапов 1–3: табы с шириной 2, одинарные кавычки, порядок секций SFC `style` → `template` → `script`, английский в коде, русский только в `src/i18n/locales/ru.json`.
- **Базовый путь сборки — `/todo/`.** GitHub Pages отдаёт сайт репозитория по подпути. После изменения `base` локальный адрес превью становится `http://localhost:4173/todo/`.
- **Никаких правил кеширования времени выполнения.** Только `precache` и `navigateFallback`.
- Иконки коммитятся в репозиторий как готовые файлы, а не генерируются при каждой сборке.
- Версия `vite-plugin-pwa` — ровно `1.3.0`, её peer-диапазон включает Vite 8.

---

## Task 1: Базовый путь и иконки

**Files:**
- Create: `public/favicon.svg`, `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`, `public/apple-touch-icon.png`
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- Produces: набор иконок в `public/`, доступный манифесту из Task 2; базовый путь `/todo/`.

- [ ] **Step 1: Задать базовый путь**

В `vite.config.ts` добавить в объект конфигурации перед `plugins`:

```ts
	base: '/todo/',
```

- [ ] **Step 2: Нарисовать исходную иконку**

Файл `public/favicon.svg` — скруглённый квадрат основного цвета темы с белой галочкой:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" rx="112" fill="#1867C0" />
	<path
		d="M136 268 L214 346 L376 184"
		fill="none"
		stroke="#FFFFFF"
		stroke-width="56"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
```

- [ ] **Step 3: Сделать маскируемый вариант**

Android обрезает иконку под форму системы, поэтому рисунок должен умещаться в круг диаметром 80% стороны. Временный файл `public/maskable-source.svg` — тот же знак, но уменьшенный и на сплошной заливке:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="#1867C0" />
	<path
		d="M166 274 L226 334 L346 214"
		fill="none"
		stroke="#FFFFFF"
		stroke-width="44"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
```

- [ ] **Step 4: Растеризовать иконки**

Нативная зависимость ради пяти файлов не нужна — растеризуем headless-браузером, который уже есть в системе. Скрипт кладём во временную папку, а не в репозиторий: он одноразовый.

Запустить Chrome с отладочным портом, затем для каждой пары «исходник → размер» открыть data-URL со страницей нужного размера и снять скриншот:

- `favicon.svg` → `pwa-192.png` (192), `pwa-512.png` (512), `apple-touch-icon.png` (180)
- `maskable-source.svg` → `pwa-maskable-512.png` (512)

После генерации удалить `public/maskable-source.svg` — в сборку он попадать не должен.

Expected: пять файлов в `public/`, каждый непустой, размеры совпадают с заявленными.

- [ ] **Step 5: Прописать иконки в index.html**

В `<head>` добавить:

```html
		<link rel="icon" type="image/svg+xml" href="/todo/favicon.svg" />
		<link rel="apple-touch-icon" href="/todo/apple-touch-icon.png" />
		<meta name="theme-color" content="#1867C0" />
```

- [ ] **Step 6: Проверить сборку**

Run: `npm run build`
Expected: успех, в `dist/` лежат все пять иконок, пути к ассетам начинаются с `/todo/`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add app icons and set the github pages base path"
```

---

## Task 2: Манифест и сервис-воркер

**Files:**
- Modify: `vite.config.ts`, `src/main.ts`

**Interfaces:**
- Consumes: иконки из Task 1.
- Produces: `dist/manifest.webmanifest`, `dist/sw.js`; регистрацию воркера при старте приложения.

- [ ] **Step 1: Установить плагин**

```bash
npm install -D vite-plugin-pwa@1.3.0
```

- [ ] **Step 2: Настроить плагин**

В `vite.config.ts` добавить импорт и плагин после `vueI18n(...)`:

```ts
import { VitePWA } from 'vite-plugin-pwa';
```

```ts
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: 'Todo',
				short_name: 'Todo',
				description: 'Личный список дел с матрицей Эйзенхауэра',
				lang: 'ru',
				// standalone обязателен: именно он выводит установленное приложение
				// из-под семидневного удаления данных в Safari.
				display: 'standalone',
				orientation: 'portrait',
				background_color: '#FFFFFF',
				theme_color: '#1867C0',
				icons: [
					{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'pwa-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
				navigateFallback: '/todo/index.html',
				cleanupOutdatedCaches: true,
			},
		}),
```

Пути иконок относительные: плагин сам подставит базовый путь в `start_url`, `scope` и `icons`.

- [ ] **Step 3: Зарегистрировать воркер**

В `src/main.ts` добавить импорт первой строкой блока импортов приложения:

```ts
import { registerSW } from 'virtual:pwa-register';
```

и вызов после `mount`:

```ts
registerSW({ immediate: true });
```

- [ ] **Step 4: Объявить типы виртуального модуля**

В `src/env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 5: Проверить сборку**

Run: `npm run build`
Expected: успех; в `dist/` появились `manifest.webmanifest`, `sw.js` и `workbox-*.js`.

Проверить содержимое манифеста: `display` равен `standalone`, `start_url` и `scope` начинаются с `/todo/`, перечислены три иконки.

- [ ] **Step 6: Проверить линт и тесты**

Run: `npm run lint`
Expected: PASS.
Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add web app manifest and offline service worker"
```

---

## Task 3: Постоянное хранилище

**Files:**
- Create: `src/services/storage/persistence.ts`, `src/services/storage/persistence.test.ts`
- Modify: `src/App.vue`

**Interfaces:**
- Produces: `requestPersistentStorage(): Promise<boolean>` — запрашивает постоянный режим, возвращает результат, никогда не бросает.

- [ ] **Step 1: Написать падающий тест**

Файл `src/services/storage/persistence.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistence';

const original = globalThis.navigator;

afterEach(() => {
	Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
});

function stubNavigator(storage: unknown): void {
	Object.defineProperty(globalThis, 'navigator', {
		value: { storage },
		configurable: true,
	});
}

describe('requestPersistentStorage', () => {
	it('returns true when the browser grants persistence', async () => {
		stubNavigator({ persisted: async () => false, persist: async () => true });

		await expect(requestPersistentStorage()).resolves.toBe(true);
	});

	it('returns false when the browser refuses', async () => {
		stubNavigator({ persisted: async () => false, persist: async () => false });

		await expect(requestPersistentStorage()).resolves.toBe(false);
	});

	it('does not ask again when storage is already persistent', async () => {
		const persist = vi.fn(async () => true);
		stubNavigator({ persisted: async () => true, persist });

		await expect(requestPersistentStorage()).resolves.toBe(true);
		expect(persist).not.toHaveBeenCalled();
	});

	it('returns false when the api is missing', async () => {
		stubNavigator(undefined);

		await expect(requestPersistentStorage()).resolves.toBe(false);
	});

	it('returns false instead of throwing when the api rejects', async () => {
		stubNavigator({
			persisted: async () => false,
			persist: async () => {
				throw new Error('denied');
			},
		});

		await expect(requestPersistentStorage()).resolves.toBe(false);
	});
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — модуль `./persistence` не найден.

- [ ] **Step 3: Реализовать**

Файл `src/services/storage/persistence.ts`:

```ts
/**
 * Asks the browser to keep this origin's storage out of automatic eviction.
 * Refusal is a normal outcome, not an error: the decision is the browser's.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	const storage = navigator.storage;
	if (!storage?.persist || !storage.persisted) {
		return false;
	}

	try {
		if (await storage.persisted()) {
			return true;
		}

		return await storage.persist();
	} catch {
		return false;
	}
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS, 35 тестов суммарно.

- [ ] **Step 5: Вызвать при старте**

В `src/App.vue` в блоке `onMounted` добавить вызов рядом с загрузкой store:

```ts
onMounted(() => {
	void store.load();
	void requestPersistentStorage();
});
```

и импорт:

```ts
import { requestPersistentStorage } from '@/services/storage/persistence';
```

- [ ] **Step 6: Проверить линт и сборку**

Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: успех.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: request persistent storage on startup"
```

---

## Task 4: Проверка офлайна в браузере

**Files:** без изменений в исходниках; временный скрипт проверки во временной папке.

- [ ] **Step 1: Собрать и поднять превью**

```bash
npm run build
```

Запустить `npm run preview` отдельным процессом (в PowerShell — через `Start-Process`, потому что фоновые задания не переживают вызов) и дождаться ответа `http://127.0.0.1:4173/todo/`.

- [ ] **Step 2: Прогнать сценарий в headless Chrome**

`http://127.0.0.1` — безопасный контекст, поэтому сервис-воркер регистрируется без HTTPS. Проверить по протоколу CDP:

1. Открыть приложение, дождаться `navigator.serviceWorker.ready`.
2. Прочитать `manifest.webmanifest`: `display === 'standalone'`, `start_url` и `scope` начинаются с `/todo/`, три иконки.
3. Завести дело, чтобы в IndexedDB что-то лежало.
4. Включить офлайн через `Network.emulateNetworkConditions` с `offline: true`.
5. Перезагрузить страницу — приложение открывается, дело на месте.
6. Открыть напрямую адрес матрицы — страница отдаётся из кеша, работает запасной вариант навигации.
7. Снять скриншоты офлайн-состояния и посмотреть их.
8. Вернуть сеть, проверить `console --errors`.

Expected: все пункты проходят, ошибок в консоли нет.

- [ ] **Step 3: Остановить процессы**

Остановить превью по владельцу порта 4173 и закрыть Chrome.

- [ ] **Step 4: Commit**

Если по итогам проверки менялись исходники — коммит с описанием исправления. Если нет — коммита нет.

---

## Проверка результата этапа

1. `npm run lint`, `npm test`, `npm run build` — чисто.
2. Офлайн-сценарий из Task 4 пройден, скриншоты просмотрены.
3. `npm run preview`, открыть `http://localhost:4173/todo/` в Chrome — в адресной строке появляется иконка установки.
4. README описывает, где живут данные и как проверять PWA локально.

## Вне области этапа

Синхронизация устройств, экспорт и импорт резервной копии, push-уведомления, фоновая синхронизация, диалог «доступно обновление», настройка GitHub Actions для деплоя.
