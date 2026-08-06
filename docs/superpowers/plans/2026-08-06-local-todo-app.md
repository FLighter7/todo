# Local Todo App — Implementation Plan (этапы 1–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать локальное todo-приложение без бэкенда: заведение дела, плоская таблица и матрица Эйзенхауэра, с сохранением в IndexedDB между перезагрузками.

**Architecture:** Три слоя с узкими границами. `TodoStorage` — интерфейс из трёх методов, за которым прячется IndexedDB (и in-memory реализация для тестов и режима деградации). Pinia store держит весь список в памяти и синхронно отражает его в хранилище. Представления (таблица и матрица) читают один и тот же store и не знают ничего о персистентности.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5, TypeScript 6.0, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4, SCSS-модули, idb 8.

Спек: [docs/superpowers/specs/2026-08-06-local-todo-app-design.md](../specs/2026-08-06-local-todo-app-design.md)

## Global Constraints

Эти требования действуют во всех задачах без исключения.

- **TypeScript строго `6.0.3`.** Не `7.x`. `typescript-eslint@8.66.0` объявляет `typescript: ">=4.8.4 <6.1.0"` — с TS 7 команда `npm run lint` не запустится вовсе. `6.0.3` — максимальная стабильная версия внутри диапазона, и она удовлетворяет Pinia (`>=5.6.0`) и Vuetify (`>=4.7`).
- **Точные версии зависимостей** (проверены в реестре npm на 2026-08-06):
  - runtime: `vue@3.5.41`, `vue-router@5.2.0`, `pinia@4.0.2`, `vuetify@4.1.7`, `vue-i18n@11.4.8`, `idb@8.0.3`, `@mdi/font@7.4.47`
  - dev: `vite@8.2.0`, `@vitejs/plugin-vue@6.0.8`, `vite-plugin-vuetify@2.1.3`, `sass-embedded@1.100.0`, `typescript@~6.0.3`, `@types/node`, `vue-tsc@3.3.9`, `vitest@4.1.10`, `fake-indexeddb@6.2.5`, `eslint@10.8.0`, `@eslint/js@10.0.1` (нумеруется независимо от самого ESLint), `eslint-plugin-vue@10.10.0`, `@vue/eslint-config-typescript@14.9.0`, `@vue/eslint-config-prettier@10.2.0`, `prettier@3.9.6`, `globals@16.5.0`
- **Отступы — символы табуляции**, `tabWidth: 2`. Кавычки одинарные. Это относится и к коду, и к JSON-конфигам в этом плане: копируй блоки как есть.
- **Порядок секций в SFC: `style`, затем `template`, затем `script`.** Всегда. Проверяется правилом `vue/block-order`.
- **`<style lang="scss" module>` и `<script setup lang="ts">`** — во всех без исключения компонентах, даже если секция стилей пустая (в этом случае секцию просто не пишем, но если стили есть — только так).
- **Язык.** Идентификаторы, имена файлов, комментарии и сообщения коммитов — английский. Русский текст допустим только в `src/i18n/ru.ts` и в документации `docs/`.
- **Никаких строк интерфейса в компонентах.** Любой текст, который увидит пользователь, идёт через `t('...')`.
- **Алиас `@` указывает на `src/`** и настроен одновременно в `vite.config.ts` и `tsconfig.json`. Импорты внутри `src/` — через алиас, кроме импортов внутри одной папки (там относительные).
- **Тесты запускаются в окружении `node`**, не jsdom. Тестируется только логика (store и хранилище), компоненты не тестируются. Это осознанное решение: убирает зависимость от jsdom и вопрос о наличии `crypto.randomUUID` в нём.
- **Модель данных временная.** Она пересматривается на этапе 6. Не добавлять поля «на будущее»: ни `updated`, ни тегов, ни частоты повторения, ни истории выполнений.

---

## Файловая структура

Что создаётся и за что отвечает.

| Файл                                  | Ответственность                                                          |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `src/types/todo.ts`                   | Тип `Todo` и `TodoPeriod`. Единственный источник правды по форме записи. |
| `src/services/storage/types.ts`       | Интерфейс `TodoStorage`, ошибка `StorageUnavailableError`.               |
| `src/services/storage/in-memory.ts`   | Реализация в памяти: тесты и режим деградации.                           |
| `src/services/storage/indexed-db.ts`  | Реализация на `idb`.                                                     |
| `src/stores/todos.ts`                 | Pinia store: список, действия, геттер квадрантов.                        |
| `src/router/index.ts`                 | Два маршрута.                                                            |
| `src/i18n/index.ts`, `en.ts`, `ru.ts` | Локализация и выбор языка.                                               |
| `src/plugins/vuetify.ts`              | Инициализация Vuetify, темы.                                             |
| `src/views/TodoListView.vue`          | Страница списка.                                                         |
| `src/views/MatrixView.vue`            | Страница матрицы.                                                        |
| `src/components/TodoForm.vue`         | Диалог создания и редактирования дела.                                   |
| `src/components/TodoQuadrant.vue`     | Один квадрант матрицы.                                                   |
| `src/App.vue`                         | Каркас, навигация, переключатели, баннер и snackbar.                     |

---

# Этап 1. Каркас проекта

## Task 1: Проект, сборка и пустая страница

**Files:**

- Create: `package.json`, `.gitignore`, `.gitattributes`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/App.vue`, `src/env.d.ts`

**Interfaces:**

- Consumes: ничего, это первая задача.
- Produces: алиас `@` → `src/`; точка входа `src/main.ts`; корневой компонент `src/App.vue`; скрипты `npm run dev`, `npm run build`, `npm run preview`.

- [ ] **Step 1: Создать package.json**

Файл `package.json`:

```json
{
	"name": "todo",
	"version": "0.1.0",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite",
		"build": "vue-tsc --noEmit && vite build",
		"preview": "vite preview"
	}
}
```

- [ ] **Step 2: Установить зависимости**

```bash
npm install vue@3.5.41
npm install -D vite@8.2.0 @vitejs/plugin-vue@6.0.8 typescript@6.0.3 vue-tsc@3.3.9
npm install -D sass-embedded@1.100.0 @types/node
```

`sass-embedded` нужен уже здесь, а не вместе с Vuetify: `App.vue` из шага 8 использует `<style lang="scss">`, и без препроцессора сборка упадёт. `@types/node` нужен, потому что `vite.config.ts` импортирует `node:url`.

После установки замени в `package.json` версию TypeScript с `^6.0.3` на `~6.0.3`. Каретка разрешила бы 6.1.x, а это ровно тот диапазон, который ломает линтер.

- [ ] **Step 3: Создать .gitignore и .gitattributes**

Файл `.gitignore`:

```gitignore
node_modules
dist
coverage
*.local
.DS_Store
```

Файл `.gitattributes`:

```gitattributes
* text=auto eol=lf
```

`.gitattributes` обязателен: репозиторий на Windows, а git уже предупреждал про замену LF на CRLF. Без него при работе с другой машины получим ложные диффы на весь файл.

- [ ] **Step 4: Создать tsconfig.json**

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"lib": ["ES2022", "DOM", "DOM.Iterable"],
		"types": ["vite/client", "node"],
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"noEmit": true,
		"isolatedModules": true,
		"verbatimModuleSyntax": true,
		"skipLibCheck": true,
		"resolveJsonModule": true,
		"jsx": "preserve",
		"paths": {
			"@/*": ["./src/*"]
		}
	},
	"include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

- [ ] **Step 5: Создать vite.config.ts**

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
```

- [ ] **Step 6: Создать env.d.ts**

Файл `src/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Создать index.html**

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
		<title>Todo</title>
	</head>
	<body>
		<div id="app"></div>
		<script type="module" src="/src/main.ts"></script>
	</body>
</html>
```

`viewport-fit=cover` нужен, чтобы на iPhone контент корректно вёл себя с вырезом экрана.

- [ ] **Step 8: Создать App.vue и main.ts**

Файл `src/App.vue` — обрати внимание на порядок секций:

```vue
<style lang="scss" module>
.root {
	font-family: system-ui, sans-serif;
	padding: 1rem;
}
</style>

<template>
	<div :class="$style.root">Todo</div>
</template>

<script setup lang="ts"></script>
```

Файл `src/main.ts`:

```ts
import { createApp } from 'vue';
import App from '@/App.vue';

createApp(App).mount('#app');
```

- [ ] **Step 9: Проверить dev-сервер**

Run: `npm run dev`
Expected: сервер стартует, на открытой странице видно слово «Todo». Останови сервер.

- [ ] **Step 10: Проверить сборку**

Run: `npm run build`
Expected: `vue-tsc` не находит ошибок типов, Vite собирает в `dist/` без ошибок.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + vue 3 + typescript project"
```

---

## Task 2: ESLint и Prettier

**Files:**

- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (скрипты `lint`, `lint:fix`, `format`)

**Interfaces:**

- Consumes: структура проекта из Task 1.
- Produces: команды `npm run lint` и `npm run format`; правило `vue/block-order` со значением `['style', 'template', 'script']`, которое дальше проверяет каждый компонент.

- [ ] **Step 1: Установить пакеты**

```bash
npm install -D eslint@10.8.0 @eslint/js@10.0.1 eslint-plugin-vue@10.10.0 @vue/eslint-config-typescript@14.9.0 @vue/eslint-config-prettier@10.2.0 prettier@3.9.6 globals@16.5.0
```

- [ ] **Step 2: Создать eslint.config.js**

```js
import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
	{
		name: 'app/files-to-lint',
		files: ['**/*.{ts,mts,vue}'],
	},
	{
		name: 'app/files-to-ignore',
		ignores: ['dist/**', 'coverage/**'],
	},
	{
		name: 'app/globals',
		files: ['**/*.{ts,mts,vue}'],
		languageOptions: {
			globals: { ...globals.browser },
		},
	},
	js.configs.recommended,
	pluginVue.configs['flat/recommended'],
	vueTsConfigs.recommended,
	skipFormatting,
	{
		name: 'app/rules',
		rules: {
			'vue/block-order': ['error', { order: ['style', 'template', 'script'] }],
		},
	},
);
```

`skipFormatting` идёт последним намеренно: он гасит правила ESLint, конфликтующие с Prettier. Если поставить его выше, конфликты вернутся.

- [ ] **Step 3: Создать .prettierrc.json и .prettierignore**

Файл `.prettierrc.json`:

```json
{
	"useTabs": true,
	"tabWidth": 2,
	"singleQuote": true,
	"semi": true,
	"printWidth": 100,
	"trailingComma": "all"
}
```

Файл `.prettierignore`:

```gitignore
dist
coverage
package-lock.json
```

- [ ] **Step 4: Добавить скрипты в package.json**

В секцию `scripts` добавить:

```json
		"lint": "eslint .",
		"lint:fix": "eslint . --fix",
		"format": "prettier --write ."
```

- [ ] **Step 5: Проверить, что правило порядка секций работает**

Временно поменяй в `src/App.vue` местами секции `style` и `template`, затем запусти:

Run: `npm run lint`
Expected: FAIL с ошибкой правила `vue/block-order`.

Верни порядок обратно (`style`, `template`, `script`) и запусти снова:

Run: `npm run lint`
Expected: PASS, ноль ошибок.

Эта проверка обязательна: она подтверждает, что нестандартный порядок секций действительно контролируется, а не просто записан в документе.

- [ ] **Step 6: Прогнать форматирование**

Run: `npm run format`
Затем: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add eslint flat config and prettier"
```

---

## Task 3: Vuetify и переключатель темы

**Files:**

- Create: `src/plugins/vuetify.ts`
- Modify: `vite.config.ts`, `src/main.ts`, `src/App.vue`

**Interfaces:**

- Consumes: `src/main.ts`, `src/App.vue` из Task 1.
- Produces: экспорт по умолчанию из `@/plugins/vuetify` — инстанс Vuetify; именованные экспорты `type AppTheme = 'light' | 'dark' | 'system'` и `persistTheme(theme: AppTheme): void`.

- [ ] **Step 1: Установить пакеты**

```bash
npm install vuetify@4.1.7 @mdi/font@7.4.47
npm install -D vite-plugin-vuetify@2.1.3
```

`sass-embedded` уже стоит с Task 1.

- [ ] **Step 2: Подключить плагин в vite.config.ts**

Замени содержимое `vite.config.ts` на:

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
	plugins: [vue(), vuetify({ autoImport: true })],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
```

`autoImport: true` подключает компоненты Vuetify по факту использования в шаблоне. Поэтому нигде не нужно импортировать `vuetify/components` — это раздуло бы бандл.

- [ ] **Step 3: Создать src/plugins/vuetify.ts**

```ts
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

const THEME_STORAGE_KEY = 'todo.theme';

export type AppTheme = 'light' | 'dark' | 'system';

function readStoredTheme(): AppTheme {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function persistTheme(theme: AppTheme): void {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default createVuetify({
	theme: {
		defaultTheme: readStoredTheme(),
	},
});
```

Значение `'system'` — штатная возможность Vuetify 4: тема следует за настройкой операционной системы, руками подписываться на `prefers-color-scheme` не нужно.

- [ ] **Step 4: Подключить Vuetify в main.ts**

```ts
import { createApp } from 'vue';
import App from '@/App.vue';
import vuetify from '@/plugins/vuetify';

createApp(App).use(vuetify).mount('#app');
```

- [ ] **Step 5: Переписать App.vue с каркасом Vuetify и переключателем темы**

```vue
<style lang="scss" module>
.main {
	padding-bottom: env(safe-area-inset-bottom);
}
</style>

<template>
	<v-app>
		<v-app-bar title="Todo" density="comfortable">
			<template #append>
				<v-btn :icon="themeIcon" aria-label="Toggle theme" @click="toggleTheme" />
			</template>
		</v-app-bar>

		<v-main :class="$style.main">
			<v-container>
				<v-btn color="primary">Vuetify works</v-btn>
			</v-container>
		</v-main>
	</v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { persistTheme } from '@/plugins/vuetify';

const theme = useTheme();

const themeIcon = computed(() =>
	theme.global.name.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny',
);

function toggleTheme(): void {
	const next = theme.global.name.value === 'dark' ? 'light' : 'dark';
	theme.global.name.value = next;
	persistTheme(next);
}
</script>
```

Тексты здесь пока английские строки — vue-i18n появится в Task 5, и они уедут в файлы сообщений.

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: страница с шапкой и синей кнопкой «Vuetify works», шрифт иконок подгружен (иконка солнца или луны видна, а не пустой квадрат). Нажми переключатель — тема меняется. Перезагрузи страницу — выбранная тема сохранилась.

- [ ] **Step 7: Проверить сборку и линт**

Run: `npm run build`
Expected: успех.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add vuetify with persisted theme toggle"
```

---

## Task 4: Маршрутизация и две страницы

**Files:**

- Create: `src/router/index.ts`, `src/views/TodoListView.vue`, `src/views/MatrixView.vue`
- Modify: `src/main.ts`, `src/App.vue`

**Interfaces:**

- Consumes: `@/plugins/vuetify` из Task 3.
- Produces: маршруты с именами `'list'` (путь `/`) и `'matrix'` (путь `/matrix'`); компоненты-заглушки `TodoListView` и `MatrixView`, которые наполняются в Task 10 и Task 13.

- [ ] **Step 1: Установить vue-router**

```bash
npm install vue-router@5.2.0
```

- [ ] **Step 2: Создать страницы-заглушки**

Файл `src/views/TodoListView.vue`:

```vue
<template>
	<v-container>
		<h1 class="text-h5">List</h1>
	</v-container>
</template>

<script setup lang="ts"></script>
```

Файл `src/views/MatrixView.vue`:

```vue
<template>
	<v-container>
		<h1 class="text-h5">Matrix</h1>
	</v-container>
</template>

<script setup lang="ts"></script>
```

Секции `style` здесь нет намеренно: своих стилей у заглушек нет, а пустой блок `<style module>` Vue не любит.

- [ ] **Step 3: Создать роутер**

Файл `src/router/index.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import TodoListView from '@/views/TodoListView.vue';

const routes: RouteRecordRaw[] = [
	{ path: '/', name: 'list', component: TodoListView },
	{ path: '/matrix', name: 'matrix', component: () => import('@/views/MatrixView.vue') },
];

export default createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
```

Стартовая страница импортируется статически, матрица — ленивым импортом: она нужна не при каждом открытии.

- [ ] **Step 4: Подключить роутер в main.ts**

```ts
import { createApp } from 'vue';
import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';

createApp(App).use(router).use(vuetify).mount('#app');
```

- [ ] **Step 5: Добавить навигацию в App.vue**

Замени блок `<v-main>` в `src/App.vue` на:

```vue
<v-main :class="$style.main">
			<router-view />
		</v-main>
```

И добавь вкладки внутрь `<v-app-bar>`, сразу после блока `<template #append>`:

```vue
<template #extension>
	<v-tabs>
		<v-tab :to="{ name: 'list' }">List</v-tab>
		<v-tab :to="{ name: 'matrix' }">Matrix</v-tab>
	</v-tabs>
</template>
```

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: две вкладки в шапке. Клик по «Matrix» меняет адрес на `/matrix` и заголовок на «Matrix». Кнопка «назад» в браузере возвращает на список. Прямое открытие `/matrix` работает.

- [ ] **Step 7: Проверить сборку и линт**

Run: `npm run build`
Expected: успех.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add router with list and matrix pages"
```

---

## Task 5: Локализация

**Files:**

- Create: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`
- Modify: `src/main.ts`, `src/App.vue`, `src/views/TodoListView.vue`, `src/views/MatrixView.vue`

**Interfaces:**

- Consumes: `App.vue` и страницы из Task 4.
- Produces: именованные экспорты `i18n` (инстанс), `type AppLocale = 'en' | 'ru'`, `setLocale(locale: AppLocale): void`, `SUPPORTED_LOCALES`. Полный словарь ключей, которым пользуются все последующие задачи.

- [ ] **Step 1: Установить vue-i18n**

```bash
npm install vue-i18n@11.4.8
```

- [ ] **Step 2: Создать английский словарь**

Файл `src/i18n/en.ts` — здесь сразу все ключи, которые понадобятся до конца плана, чтобы к ним не возвращаться:

```ts
export default {
	app: {
		title: 'Todo',
		toggleTheme: 'Toggle theme',
		toggleLanguage: 'Switch language',
	},
	nav: {
		list: 'List',
		matrix: 'Matrix',
	},
	storage: {
		unavailable: 'Persistent storage is unavailable. Changes will be lost when you close the app.',
		writeFailed: 'Could not save the change.',
	},
	todo: {
		title: 'Title',
		note: 'Note',
		period: 'Period',
		created: 'Created',
		important: 'Important',
		urgent: 'Urgent',
		done: 'Done',
		actions: 'Actions',
	},
	period: {
		'one-time': 'One-time',
		periodic: 'Periodic',
	},
	form: {
		add: 'Add task',
		edit: 'Edit task',
		save: 'Save',
		cancel: 'Cancel',
		titleRequired: 'Title is required',
	},
	list: {
		empty: 'No tasks yet. Add the first one.',
	},
	quadrant: {
		do: 'Do',
		schedule: 'Schedule',
		delegate: 'Delegate',
		eliminate: 'Eliminate',
		empty: 'Empty',
	},
};
```

Без `as const`: он сделал бы объект глубоко readonly, а `createI18n` ожидает изменяемые сообщения — получили бы ошибку типов на ровном месте.

- [ ] **Step 3: Создать русский словарь**

Файл `src/i18n/ru.ts`:

```ts
export default {
	app: {
		title: 'Дела',
		toggleTheme: 'Переключить тему',
		toggleLanguage: 'Сменить язык',
	},
	nav: {
		list: 'Список',
		matrix: 'Матрица',
	},
	storage: {
		unavailable: 'Постоянное хранилище недоступно. Изменения пропадут после закрытия приложения.',
		writeFailed: 'Не удалось сохранить изменение.',
	},
	todo: {
		title: 'Название',
		note: 'Описание',
		period: 'Периодичность',
		created: 'Создано',
		important: 'Важное',
		urgent: 'Срочное',
		done: 'Сделано',
		actions: 'Действия',
	},
	period: {
		'one-time': 'Разовое',
		periodic: 'Периодическое',
	},
	form: {
		add: 'Новое дело',
		edit: 'Изменить дело',
		save: 'Сохранить',
		cancel: 'Отмена',
		titleRequired: 'Название обязательно',
	},
	list: {
		empty: 'Дел пока нет. Заведи первое.',
	},
	quadrant: {
		do: 'Сделать',
		schedule: 'Запланировать',
		delegate: 'Делегировать',
		eliminate: 'Удалить',
		empty: 'Пусто',
	},
};
```

- [ ] **Step 4: Создать точку входа i18n**

Файл `src/i18n/index.ts`:

```ts
import { createI18n } from 'vue-i18n';
import en from './en';
import ru from './ru';

const LOCALE_STORAGE_KEY = 'todo.locale';

export const SUPPORTED_LOCALES = ['en', 'ru'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(value: string | null): value is AppLocale {
	return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function detectLocale(): AppLocale {
	const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
	if (isSupported(stored)) {
		return stored;
	}
	return navigator.language.startsWith('ru') ? 'ru' : 'en';
}

export const i18n = createI18n({
	legacy: false,
	locale: detectLocale(),
	fallbackLocale: 'en',
	messages: { en, ru },
});

export function setLocale(locale: AppLocale): void {
	i18n.global.locale.value = locale;
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
```

`legacy: false` обязателен — только в этом режиме работает Composition API (`useI18n`), и `i18n.global.locale` становится записываемым `ref`.

- [ ] **Step 5: Подключить i18n в main.ts**

```ts
import { createApp } from 'vue';
import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';

createApp(App).use(router).use(vuetify).use(i18n).mount('#app');
```

- [ ] **Step 6: Перевести App.vue и добавить переключатель языка**

Полное содержимое `src/App.vue`:

```vue
<style lang="scss" module>
.main {
	padding-bottom: env(safe-area-inset-bottom);
}
</style>

<template>
	<v-app>
		<v-app-bar :title="t('app.title')" density="comfortable">
			<template #append>
				<v-btn :icon="themeIcon" :aria-label="t('app.toggleTheme')" @click="toggleTheme" />
				<v-btn icon="mdi-translate" :aria-label="t('app.toggleLanguage')" @click="toggleLanguage" />
			</template>

			<template #extension>
				<v-tabs>
					<v-tab :to="{ name: 'list' }">{{ t('nav.list') }}</v-tab>
					<v-tab :to="{ name: 'matrix' }">{{ t('nav.matrix') }}</v-tab>
				</v-tabs>
			</template>
		</v-app-bar>

		<v-main :class="$style.main">
			<router-view />
		</v-main>
	</v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { persistTheme } from '@/plugins/vuetify';
import { setLocale } from '@/i18n';

const { t, locale } = useI18n();
const theme = useTheme();

const themeIcon = computed(() =>
	theme.global.name.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny',
);

function toggleTheme(): void {
	const next = theme.global.name.value === 'dark' ? 'light' : 'dark';
	theme.global.name.value = next;
	persistTheme(next);
}

function toggleLanguage(): void {
	setLocale(locale.value === 'ru' ? 'en' : 'ru');
}
</script>
```

- [ ] **Step 7: Перевести заголовки страниц**

В `src/views/TodoListView.vue`:

```vue
<template>
	<v-container>
		<h1 class="text-h5">{{ t('nav.list') }}</h1>
	</v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
```

В `src/views/MatrixView.vue` — то же самое, но с ключом `t('nav.matrix')`.

- [ ] **Step 8: Проверить в браузере**

Run: `npm run dev`
Expected: интерфейс на языке системы. Нажатие на иконку перевода меняет весь текст — шапку, вкладки, заголовок страницы. Перезагрузка сохраняет выбранный язык.

- [ ] **Step 9: Проверить сборку и линт**

Run: `npm run build`
Expected: успех.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add i18n with english and russian locales"
```

**Этап 1 завершён.** Дальше — данные.

---

# Этап 2. Список дел

## Task 6: Модель данных, интерфейс хранилища и реализация в памяти

**Files:**

- Create: `src/types/todo.ts`, `src/services/storage/types.ts`, `src/services/storage/in-memory.ts`, `src/services/storage/in-memory.test.ts`
- Modify: `vite.config.ts` (секция `test`), `package.json` (скрипты тестов)

**Interfaces:**

- Consumes: ничего из предыдущих задач, это новый слой.
- Produces:
  - `interface Todo { id: string; title: string; note?: string; created: string; period: TodoPeriod; important: boolean; urgent: boolean; done: boolean }`
  - `type TodoPeriod = 'one-time' | 'periodic'`
  - `interface TodoStorage { getAll(): Promise<Todo[]>; put(todo: Todo): Promise<void>; remove(id: string): Promise<void> }`
  - `class StorageUnavailableError extends Error`
  - `createInMemoryStorage(seed?: Todo[]): TodoStorage`

- [ ] **Step 1: Установить Vitest**

```bash
npm install -D vitest@4.1.10
```

- [ ] **Step 2: Настроить Vitest в vite.config.ts**

Замени содержимое `vite.config.ts` на:

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
	plugins: [vue(), vuetify({ autoImport: true })],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
```

Изменилась только строка импорта `defineConfig` — теперь из `vitest/config`, он расширяет конфиг Vite полем `test`. Окружение `node`, а не `jsdom`: тестируется только логика, DOM не нужен.

- [ ] **Step 3: Добавить скрипты тестов в package.json**

В секцию `scripts`:

```json
		"test": "vitest run",
		"test:watch": "vitest"
```

- [ ] **Step 4: Создать тип Todo**

Файл `src/types/todo.ts`:

```ts
export type TodoPeriod = 'one-time' | 'periodic';

export interface Todo {
	id: string;
	title: string;
	note?: string;
	/** ISO 8601 timestamp in UTC. */
	created: string;
	period: TodoPeriod;
	important: boolean;
	urgent: boolean;
	done: boolean;
}
```

- [ ] **Step 5: Создать интерфейс хранилища**

Файл `src/services/storage/types.ts`:

```ts
import type { Todo } from '@/types/todo';

export interface TodoStorage {
	getAll(): Promise<Todo[]>;
	put(todo: Todo): Promise<void>;
	remove(id: string): Promise<void>;
}

export class StorageUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Persistent storage is unavailable', { cause });
		this.name = 'StorageUnavailableError';
	}
}
```

- [ ] **Step 6: Написать падающий тест на реализацию в памяти**

Файл `src/services/storage/in-memory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { createInMemoryStorage } from './in-memory';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		...overrides,
	};
}

describe('createInMemoryStorage', () => {
	it('returns an empty list when created without a seed', async () => {
		const storage = createInMemoryStorage();

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('returns seeded items', async () => {
		const todo = makeTodo();
		const storage = createInMemoryStorage([todo]);

		await expect(storage.getAll()).resolves.toEqual([todo]);
	});

	it('stores a new item', async () => {
		const storage = createInMemoryStorage();
		const todo = makeTodo();

		await storage.put(todo);

		await expect(storage.getAll()).resolves.toEqual([todo]);
	});

	it('replaces an item with the same id instead of duplicating it', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.put(makeTodo({ title: 'Buy oat milk' }));

		const items = await storage.getAll();
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe('Buy oat milk');
	});

	it('does not expose its internal object to callers', async () => {
		const storage = createInMemoryStorage();
		const todo = makeTodo();

		await storage.put(todo);
		todo.title = 'Mutated after the call';

		const items = await storage.getAll();
		expect(items[0].title).toBe('Buy milk');
	});

	it('removes an item by id', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.remove('id-1');

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('ignores removal of an unknown id', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.remove('missing');

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});
});
```

- [ ] **Step 7: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — модуль `./in-memory` не найден.

- [ ] **Step 8: Реализовать хранилище в памяти**

Файл `src/services/storage/in-memory.ts`:

```ts
import type { Todo } from '@/types/todo';
import type { TodoStorage } from './types';

export function createInMemoryStorage(seed: Todo[] = []): TodoStorage {
	const items = new Map<string, Todo>(seed.map((todo) => [todo.id, todo]));

	return {
		async getAll() {
			return [...items.values()].map((todo) => ({ ...todo }));
		},
		async put(todo) {
			items.set(todo.id, { ...todo });
		},
		async remove(id) {
			items.delete(id);
		},
	};
}
```

Копирование объектов на входе и выходе — не перестраховка: без него тест на мутацию падает, а вызывающий код смог бы менять содержимое хранилища в обход `put`.

- [ ] **Step 9: Запустить тесты и убедиться, что они проходят**

Run: `npm test`
Expected: PASS, 7 тестов.

- [ ] **Step 10: Проверить линт**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add todo model and in-memory storage with tests"
```

---

## Task 7: Хранилище на IndexedDB

**Files:**

- Create: `src/services/storage/indexed-db.ts`, `src/services/storage/indexed-db.test.ts`

**Interfaces:**

- Consumes: `Todo` из `@/types/todo`; `TodoStorage` и `StorageUnavailableError` из `./types` (Task 6).
- Produces: `createIndexedDbStorage(): Promise<TodoStorage>` — асинхронная фабрика, бросающая `StorageUnavailableError`, если IndexedDB недоступна.

- [ ] **Step 1: Установить idb и fake-indexeddb**

```bash
npm install idb@8.0.3
npm install -D fake-indexeddb@6.2.5
```

- [ ] **Step 2: Написать падающий тест**

Файл `src/services/storage/indexed-db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Todo } from '@/types/todo';
import { StorageUnavailableError } from './types';
import { createIndexedDbStorage } from './indexed-db';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		...overrides,
	};
}

afterEach(async () => {
	await deleteDB('todo');
});

describe('createIndexedDbStorage', () => {
	it('starts empty', async () => {
		const storage = await createIndexedDbStorage();

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('persists an item across separate connections', async () => {
		const first = await createIndexedDbStorage();
		await first.put(makeTodo());

		const second = await createIndexedDbStorage();

		await expect(second.getAll()).resolves.toEqual([makeTodo()]);
	});

	it('replaces an item with the same id', async () => {
		const storage = await createIndexedDbStorage();

		await storage.put(makeTodo());
		await storage.put(makeTodo({ done: true }));

		const items = await storage.getAll();
		expect(items).toHaveLength(1);
		expect(items[0].done).toBe(true);
	});

	it('removes an item by id', async () => {
		const storage = await createIndexedDbStorage();
		await storage.put(makeTodo());

		await storage.remove('id-1');

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('throws StorageUnavailableError when indexedDB is missing', async () => {
		const original = globalThis.indexedDB;
		// @ts-expect-error deliberately removing the global to simulate a browser without IndexedDB
		delete globalThis.indexedDB;

		try {
			await expect(createIndexedDbStorage()).rejects.toBeInstanceOf(StorageUnavailableError);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
```

- [ ] **Step 3: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — модуль `./indexed-db` не найден.

- [ ] **Step 4: Реализовать хранилище**

Файл `src/services/storage/indexed-db.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Todo } from '@/types/todo';
import { StorageUnavailableError, type TodoStorage } from './types';

const DB_NAME = 'todo';
const DB_VERSION = 1;
const STORE_NAME = 'todos';

interface TodoDbSchema extends DBSchema {
	todos: {
		key: string;
		value: Todo;
	};
}

async function open(): Promise<IDBPDatabase<TodoDbSchema>> {
	if (typeof indexedDB === 'undefined') {
		throw new StorageUnavailableError();
	}

	try {
		const database = await openDB<TodoDbSchema>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			},
		});

		// Another tab upgrading or deleting the database stays blocked until every
		// other connection closes, so release ours as soon as it asks.
		database.addEventListener('versionchange', () => database.close());

		return database;
	} catch (error) {
		throw new StorageUnavailableError(error);
	}
}

export async function createIndexedDbStorage(): Promise<TodoStorage> {
	const database = await open();

	return {
		async getAll() {
			return database.getAll(STORE_NAME);
		},
		async put(todo) {
			await database.put(STORE_NAME, todo);
		},
		async remove(id) {
			await database.delete(STORE_NAME, id);
		},
	};
}
```

Два момента, которые легко упустить.

Проверка `typeof indexedDB === 'undefined'` нужна отдельно от `try`: в Safari при жёстких настройках приватности объект отсутствует целиком, и обращение к нему бросит `ReferenceError`, а не отвергнутый промис.

Подписка на `versionchange` обязательна. Открытое соединение блокирует и удаление базы, и переход на новую версию схемы: запрос просто повисает, пока соединение не закроют. В браузере это выстрелит при двух открытых вкладках, а в тестах — на `deleteDB` в `afterEach` (все тесты уйдут в таймаут).

- [ ] **Step 5: Запустить тесты**

Run: `npm test`
Expected: PASS, 12 тестов суммарно.

- [ ] **Step 6: Проверить линт**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add indexeddb storage implementation"
```

---

## Task 8: Pinia store

**Files:**

- Create: `src/stores/todos.ts`, `src/stores/todos.test.ts`
- Modify: `src/main.ts`

**Interfaces:**

- Consumes: `Todo`, `TodoPeriod`, `TodoStorage`, `createInMemoryStorage`, `createIndexedDbStorage`.
- Produces:
  - `interface TodoDraft { title: string; note?: string; period: TodoPeriod; important: boolean; urgent: boolean }`
  - `useTodosStore()` со свойствами `items: Todo[]`, `loading: boolean`, `persistent: boolean`, `lastError: string | null`
  - действия `load(createStorage?)`, `add(draft): Promise<Todo>`, `update(id, patch)`, `toggleDone(id)`, `remove(id)`, `dismissError()`
  - Геттер квадрантов добавляется отдельно, в Task 12.

- [ ] **Step 1: Установить Pinia**

```bash
npm install pinia@4.0.2
```

- [ ] **Step 2: Написать падающий тест**

Файл `src/stores/todos.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Todo } from '@/types/todo';
import type { TodoStorage } from '@/services/storage/types';
import { StorageUnavailableError } from '@/services/storage/types';
import { createInMemoryStorage } from '@/services/storage/in-memory';
import { useTodosStore, type TodoDraft } from './todos';

function makeDraft(overrides: Partial<TodoDraft> = {}): TodoDraft {
	return {
		title: 'Buy milk',
		period: 'one-time',
		important: false,
		urgent: false,
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'seeded',
		title: 'Seeded task',
		created: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useTodosStore', () => {
	it('loads existing items from storage', async () => {
		const storage = createInMemoryStorage([makeTodo()]);
		const store = useTodosStore();

		await store.load(async () => storage);

		expect(store.items).toHaveLength(1);
		expect(store.persistent).toBe(true);
		expect(store.loading).toBe(false);
	});

	it('falls back to memory when storage is unavailable', async () => {
		const store = useTodosStore();

		await store.load(async () => {
			throw new StorageUnavailableError();
		});

		expect(store.persistent).toBe(false);
		expect(store.items).toEqual([]);
	});

	it('adds a task with a generated id, a creation timestamp and done=false', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage());

		const created = await store.add(makeDraft({ important: true }));

		expect(created.id).not.toBe('');
		expect(Number.isNaN(Date.parse(created.created))).toBe(false);
		expect(created.done).toBe(false);
		expect(created.important).toBe(true);
		expect(store.items).toHaveLength(1);
	});

	it('writes an added task through to storage', async () => {
		const storage = createInMemoryStorage();
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.add(makeDraft());

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('updates an existing task', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.update('seeded', { title: 'Renamed' });

		expect(store.items[0].title).toBe('Renamed');
	});

	it('ignores updates for an unknown id', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.update('missing', { title: 'Renamed' });

		expect(store.items[0].title).toBe('Seeded task');
	});

	it('toggles done in both directions', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.toggleDone('seeded');
		expect(store.items[0].done).toBe(true);

		await store.toggleDone('seeded');
		expect(store.items[0].done).toBe(false);
	});

	it('removes a task from memory and from storage', async () => {
		const storage = createInMemoryStorage([makeTodo()]);
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.remove('seeded');

		expect(store.items).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('reports a write failure without losing the in-memory change', async () => {
		const failing: TodoStorage = {
			async getAll() {
				return [];
			},
			async put() {
				throw new Error('quota exceeded');
			},
			async remove() {},
		};
		const store = useTodosStore();
		await store.load(async () => failing);

		await store.add(makeDraft());

		expect(store.lastError).toBe('storage.writeFailed');
		expect(store.items).toHaveLength(1);
	});

	it('clears the last error on dismiss', async () => {
		const store = useTodosStore();
		await store.load(async () => {
			throw new StorageUnavailableError();
		});
		store.lastError = 'storage.writeFailed';

		store.dismissError();

		expect(store.lastError).toBeNull();
	});
});
```

- [ ] **Step 3: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — модуль `./todos` не найден.

- [ ] **Step 4: Реализовать store**

Файл `src/stores/todos.ts`:

```ts
import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Todo, TodoPeriod } from '@/types/todo';
import type { TodoStorage } from '@/services/storage/types';
import { createInMemoryStorage } from '@/services/storage/in-memory';
import { createIndexedDbStorage } from '@/services/storage/indexed-db';

export interface TodoDraft {
	title: string;
	note?: string;
	period: TodoPeriod;
	important: boolean;
	urgent: boolean;
}

type StorageFactory = () => Promise<TodoStorage>;

export const useTodosStore = defineStore('todos', () => {
	const items = ref<Todo[]>([]);
	const loading = ref(false);
	const persistent = ref(true);
	const lastError = ref<string | null>(null);

	let storage: TodoStorage = createInMemoryStorage();

	async function persist(write: () => Promise<void>): Promise<void> {
		try {
			await write();
		} catch {
			lastError.value = 'storage.writeFailed';
		}
	}

	async function load(createStorage: StorageFactory = createIndexedDbStorage): Promise<void> {
		loading.value = true;

		try {
			storage = await createStorage();
			persistent.value = true;
		} catch {
			storage = createInMemoryStorage();
			persistent.value = false;
		}

		items.value = await storage.getAll();
		loading.value = false;
	}

	async function add(draft: TodoDraft): Promise<Todo> {
		const todo: Todo = {
			id: crypto.randomUUID(),
			title: draft.title,
			note: draft.note,
			created: new Date().toISOString(),
			period: draft.period,
			important: draft.important,
			urgent: draft.urgent,
			done: false,
		};

		items.value.push(todo);
		await persist(() => storage.put(todo));

		return todo;
	}

	async function update(id: string, patch: Partial<Omit<Todo, 'id'>>): Promise<void> {
		const index = items.value.findIndex((item) => item.id === id);
		if (index === -1) {
			return;
		}

		const updated: Todo = { ...items.value[index], ...patch };
		items.value[index] = updated;
		await persist(() => storage.put(updated));
	}

	async function toggleDone(id: string): Promise<void> {
		const todo = items.value.find((item) => item.id === id);
		if (!todo) {
			return;
		}

		await update(id, { done: !todo.done });
	}

	async function remove(id: string): Promise<void> {
		items.value = items.value.filter((item) => item.id !== id);
		await persist(() => storage.remove(id));
	}

	function dismissError(): void {
		lastError.value = null;
	}

	return {
		items,
		loading,
		persistent,
		lastError,
		load,
		add,
		update,
		toggleDone,
		remove,
		dismissError,
	};
});
```

Обрати внимание: сначала меняется массив в памяти, потом идёт запись. Если запись упала, изменение остаётся видимым, а пользователь получает сообщение — терять введённое дело из-за отказа диска нельзя.

- [ ] **Step 5: Запустить тесты**

Run: `npm test`
Expected: PASS, 22 теста суммарно.

- [ ] **Step 6: Подключить Pinia в main.ts**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';

createApp(App).use(createPinia()).use(router).use(vuetify).use(i18n).mount('#app');
```

Pinia подключается первой: роутер версии 5 умеет опционально опираться на неё.

- [ ] **Step 7: Проверить линт и сборку**

Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: успех.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add todos pinia store with storage fallback"
```

---

## Task 9: Форма дела

**Files:**

- Create: `src/components/TodoForm.vue`

**Interfaces:**

- Consumes: `TodoDraft` из `@/stores/todos`; ключи i18n `form.*`, `todo.*`, `period.*`.
- Produces: компонент `TodoForm` с моделью открытия `defineModel<boolean>()`, пропом `initial?: Partial<TodoDraft>`, пропом `mode: 'add' | 'edit'` и событием `submit` с полезной нагрузкой `TodoDraft`.

- [ ] **Step 1: Создать компонент**

Файл `src/components/TodoForm.vue`:

```vue
<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<v-dialog v-model="open" max-width="480">
		<v-card>
			<v-card-title>{{ mode === 'edit' ? t('form.edit') : t('form.add') }}</v-card-title>

			<v-card-text>
				<v-text-field
					v-model="title"
					:label="t('todo.title')"
					:error-messages="titleError"
					autofocus
					@keyup.enter="submit"
				/>

				<v-textarea v-model="note" :label="t('todo.note')" rows="3" />

				<v-select v-model="period" :label="t('todo.period')" :items="periodItems" />

				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('todo.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('todo.urgent')" color="primary" hide-details />
				</div>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="open = false">{{ t('form.cancel') }}</v-btn>
				<v-btn color="primary" variant="flat" @click="submit">{{ t('form.save') }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TodoPeriod } from '@/types/todo';
import type { TodoDraft } from '@/stores/todos';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TodoDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'add' },
);

const emit = defineEmits<{ submit: [draft: TodoDraft] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const title = ref('');
const note = ref('');
const period = ref<TodoPeriod>('one-time');
const important = ref(false);
const urgent = ref(false);
const showErrors = ref(false);

const periodItems = computed(() => [
	{ title: t('period.one-time'), value: 'one-time' satisfies TodoPeriod },
	{ title: t('period.periodic'), value: 'periodic' satisfies TodoPeriod },
]);

const titleError = computed(() =>
	showErrors.value && title.value.trim() === '' ? t('form.titleRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	title.value = props.initial.title ?? '';
	note.value = props.initial.note ?? '';
	period.value = props.initial.period ?? 'one-time';
	important.value = props.initial.important ?? false;
	urgent.value = props.initial.urgent ?? false;
	showErrors.value = false;
});

function submit(): void {
	if (title.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('submit', {
		title: title.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		period: period.value,
		important: important.value,
		urgent: urgent.value,
	});

	open.value = false;
}
</script>
```

Поля сбрасываются в watcher на открытие, а не при создании компонента: диалог живёт в дереве постоянно, и без сброса второе открытие показало бы прошлый ввод.

- [ ] **Step 2: Проверить типы и линт**

Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: успех. Компонент пока никем не используется, но `vue-tsc` уже проверяет его типы.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add todo form dialog component"
```

---

## Task 10: Страница списка

**Files:**

- Modify: `src/views/TodoListView.vue`

**Interfaces:**

- Consumes: `useTodosStore` (Task 8), `TodoForm` (Task 9), ключи i18n `todo.*`, `list.*`, `form.*`, `period.*`.
- Produces: рабочую страницу списка с созданием, редактированием по клику на строку, отметкой выполнения и удалением. Дальше её не меняем.

- [ ] **Step 1: Переписать TodoListView.vue**

```vue
<style lang="scss" module>
.fab {
	position: fixed;
	right: 1rem;
	bottom: calc(1rem + env(safe-area-inset-bottom));
}

.doneRow {
	opacity: 0.55;
	text-decoration: line-through;
}
</style>

<template>
	<v-container>
		<v-data-table
			:headers="headers"
			:items="store.items"
			:loading="store.loading"
			:no-data-text="t('list.empty')"
			density="comfortable"
			item-value="id"
			hover
			@click:row="onRowClick"
		>
			<template #[`item.done`]="{ item }">
				<v-checkbox-btn
					:model-value="item.done"
					:aria-label="t('todo.done')"
					@click.stop
					@update:model-value="store.toggleDone(item.id)"
				/>
			</template>

			<template #[`item.title`]="{ item }">
				<span :class="item.done ? $style.doneRow : undefined">{{ item.title }}</span>
			</template>

			<template #[`item.period`]="{ item }">{{ t(`period.${item.period}`) }}</template>

			<template #[`item.important`]="{ item }">
				<v-icon v-if="item.important" icon="mdi-check" />
			</template>

			<template #[`item.urgent`]="{ item }">
				<v-icon v-if="item.urgent" icon="mdi-check" />
			</template>

			<template #[`item.created`]="{ item }">{{ formatDate(item.created) }}</template>

			<template #[`item.actions`]="{ item }">
				<v-btn
					icon="mdi-delete-outline"
					variant="text"
					density="comfortable"
					:aria-label="t('todo.actions')"
					@click.stop="store.remove(item.id)"
				/>
			</template>
		</v-data-table>

		<v-btn
			:class="$style.fab"
			icon="mdi-plus"
			color="primary"
			size="large"
			:aria-label="t('form.add')"
			@click="openAdd"
		/>

		<todo-form
			v-model="dialogOpen"
			:initial="initialDraft"
			:mode="editing === null ? 'add' : 'edit'"
			@submit="handleSubmit"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataTableHeader } from 'vuetify';
import TodoForm from '@/components/TodoForm.vue';
import type { Todo } from '@/types/todo';
import { useTodosStore, type TodoDraft } from '@/stores/todos';

const { t, locale } = useI18n();
const store = useTodosStore();

const dialogOpen = ref(false);
const editing = ref<Todo | null>(null);

const initialDraft = computed<Partial<TodoDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { title, note, period, important, urgent } = editing.value;

	return { title, note, period, important, urgent };
});

function openAdd(): void {
	editing.value = null;
	dialogOpen.value = true;
}

function openEdit(todo: Todo): void {
	editing.value = todo;
	dialogOpen.value = true;
}

function onRowClick(_event: Event, context: { item: Todo }): void {
	openEdit(context.item);
}

async function handleSubmit(draft: TodoDraft): Promise<void> {
	if (editing.value === null) {
		await store.add(draft);
		return;
	}

	await store.update(editing.value.id, draft);
	editing.value = null;
}

const headers = computed<DataTableHeader[]>(() => [
	{ title: t('todo.done'), key: 'done', sortable: false, width: 56 },
	{ title: t('todo.title'), key: 'title' },
	{ title: t('todo.period'), key: 'period' },
	{ title: t('todo.important'), key: 'important' },
	{ title: t('todo.urgent'), key: 'urgent' },
	{ title: t('todo.created'), key: 'created' },
	{ title: t('todo.actions'), key: 'actions', sortable: false, align: 'end' },
]);

function formatDate(value: string): string {
	return new Date(value).toLocaleString(locale.value);
}
</script>
```

Даты форматируются через `toLocaleString` с текущей локалью — хранится UTC, показывается местное время.

- [ ] **Step 2: Загрузить данные при старте приложения**

В `src/App.vue` добавь в конец блока `<script setup lang="ts">`:

```ts
import { onMounted } from 'vue';
import { useTodosStore } from '@/stores/todos';

const store = useTodosStore();

onMounted(() => {
	void store.load();
});
```

Импорт `onMounted` объедини с уже существующим импортом `computed` из `vue` в одну строку.

- [ ] **Step 3: Проверить в браузере**

Run: `npm run dev`
Expected:

- страница списка показывает текст «Дел пока нет», кнопка «плюс» в правом нижнем углу;
- по кнопке открывается диалог с заголовком «Новое дело»; сохранение с пустым названием показывает ошибку и не закрывает диалог;
- заполненное дело появляется в таблице со всеми колонками;
- чекбокс зачёркивает название и **не** открывает диалог редактирования;
- клик по самой строке открывает диалог с заголовком «Изменить дело» и заполненными полями; сохранение меняет существующую строку, а не создаёт вторую;
- перезагрузка страницы — дело на месте, изменения сохранились;
- кнопка удаления убирает строку и **не** открывает диалог; после перезагрузки строка не возвращается;
- переключение языка меняет заголовки колонок и значение периодичности.

- [ ] **Step 4: Проверить линт, типы и тесты**

Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: успех.
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add todo list page with persistence"
```

---

## Task 11: Сообщения о проблемах с хранилищем

**Files:**

- Modify: `src/App.vue`

**Interfaces:**

- Consumes: `store.persistent`, `store.lastError`, `store.dismissError` (Task 8); ключи `storage.unavailable`, `storage.writeFailed`.
- Produces: видимую реакцию на отказ хранилища. Финальный вид `App.vue`.

- [ ] **Step 1: Добавить баннер и snackbar**

В `src/App.vue` замени содержимое `<v-main>` на:

```vue
<v-main :class="$style.main">
			<v-alert
				v-if="!store.persistent"
				type="warning"
				variant="tonal"
				class="ma-4"
				:text="t('storage.unavailable')"
			/>

			<router-view />

			<v-snackbar
				:model-value="store.lastError !== null"
				color="error"
				timeout="5000"
				@update:model-value="store.dismissError()"
			>
				{{ store.lastError === null ? '' : t(store.lastError) }}
			</v-snackbar>
		</v-main>
```

`store.lastError` хранит ключ локализации, а не готовый текст. Так store остаётся свободным от пользовательских строк и не зависит от текущего языка.

- [ ] **Step 2: Проверить путь деградации**

Отказ хранилища надо увидеть глазами, а не только в юнит-тестах. В `src/App.vue` временно замени вызов загрузки на заведомо падающую фабрику:

```ts
onMounted(() => {
	void store.load(async () => {
		throw new Error('forced failure');
	});
});
```

Run: `npm run dev`
Expected: приложение открывается и работает, сверху жёлтый баннер о недоступности хранилища, дело добавляется и видно в таблице, но после перезагрузки список пуст.

- [ ] **Step 3: Вернуть штатную загрузку**

Верни в `src/App.vue` вызов без аргумента:

```ts
onMounted(() => {
	void store.load();
});
```

Run: `npm run dev`
Expected: баннера нет, добавленное дело переживает перезагрузку.

Этот возврат — отдельный шаг намеренно: временную заглушку легко забыть в коде, и приложение молча останется без сохранения данных.

- [ ] **Step 4: Проверить линт, тесты и сборку**

Run: `npm run lint`
Expected: PASS.
Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: успех.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: surface storage failures in the ui"
```

**Этап 2 завершён.**

---

# Этап 3. Матрица Эйзенхауэра

## Task 12: Разбиение по квадрантам

**Files:**

- Modify: `src/stores/todos.ts`, `src/stores/todos.test.ts`

**Interfaces:**

- Consumes: `items` из store (Task 8).
- Produces:
  - `type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate'`
  - `QUADRANT_KEYS: readonly QuadrantKey[]`
  - `quadrantOf(todo: Todo): QuadrantKey`
  - геттер store `quadrants: Record<QuadrantKey, Todo[]>`
  - `quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean }`

- [ ] **Step 1: Добавить падающие тесты**

Допиши в конец `src/stores/todos.test.ts`, а также добавь `quadrantOf`, `quadrantFlags` и тип `QuadrantKey` в существующий импорт из `./todos`:

```ts
describe('quadrantOf', () => {
	it('maps important and urgent to do', () => {
		expect(quadrantOf(makeTodo({ important: true, urgent: true }))).toBe('do');
	});

	it('maps important and not urgent to schedule', () => {
		expect(quadrantOf(makeTodo({ important: true, urgent: false }))).toBe('schedule');
	});

	it('maps not important and urgent to delegate', () => {
		expect(quadrantOf(makeTodo({ important: false, urgent: true }))).toBe('delegate');
	});

	it('maps not important and not urgent to eliminate', () => {
		expect(quadrantOf(makeTodo({ important: false, urgent: false }))).toBe('eliminate');
	});
});

describe('quadrantFlags', () => {
	it('is the inverse of quadrantOf for every quadrant', () => {
		const keys: QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

		for (const key of keys) {
			expect(quadrantOf(makeTodo(quadrantFlags(key)))).toBe(key);
		}
	});
});

describe('useTodosStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage());

		expect(Object.keys(store.quadrants).sort()).toEqual([
			'delegate',
			'do',
			'eliminate',
			'schedule',
		]);
	});

	it('groups every task into its quadrant', async () => {
		const store = useTodosStore();
		await store.load(async () =>
			createInMemoryStorage([
				makeTodo({ id: 'a', important: true, urgent: true }),
				makeTodo({ id: 'b', important: true, urgent: false }),
				makeTodo({ id: 'c', important: false, urgent: true }),
				makeTodo({ id: 'd', important: false, urgent: false }),
				makeTodo({ id: 'e', important: true, urgent: true }),
			]),
		);

		expect(store.quadrants.do.map((todo) => todo.id)).toEqual(['a', 'e']);
		expect(store.quadrants.schedule.map((todo) => todo.id)).toEqual(['b']);
		expect(store.quadrants.delegate.map((todo) => todo.id)).toEqual(['c']);
		expect(store.quadrants.eliminate.map((todo) => todo.id)).toEqual(['d']);
	});

	it('moves a task between quadrants when its flags change', async () => {
		const store = useTodosStore();
		await store.load(async () =>
			createInMemoryStorage([makeTodo({ id: 'a', important: false, urgent: false })]),
		);

		await store.update('a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test`
Expected: FAIL — `quadrantOf` не экспортируется из `./todos`.

- [ ] **Step 3: Реализовать разбиение**

В `src/stores/todos.ts` добавь после объявления `TodoDraft`:

```ts
export type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const QUADRANT_KEYS: readonly QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function quadrantOf(todo: Todo): QuadrantKey {
	if (todo.important) {
		return todo.urgent ? 'do' : 'schedule';
	}

	return todo.urgent ? 'delegate' : 'eliminate';
}

export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean } {
	return {
		important: key === 'do' || key === 'schedule',
		urgent: key === 'do' || key === 'delegate',
	};
}
```

Внутри `defineStore` добавь геттер (импорт `computed` из `vue` объедини с уже существующим импортом `ref`):

```ts
const quadrants = computed<Record<QuadrantKey, Todo[]>>(() => {
	const groups: Record<QuadrantKey, Todo[]> = {
		do: [],
		schedule: [],
		delegate: [],
		eliminate: [],
	};

	for (const todo of items.value) {
		groups[quadrantOf(todo)].push(todo);
	}

	return groups;
});
```

И добавь `quadrants` в объект, возвращаемый из `defineStore`.

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS, 30 тестов суммарно.

- [ ] **Step 5: Проверить линт**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add eisenhower quadrant grouping to the store"
```

---

## Task 13: Страница матрицы

**Files:**

- Create: `src/components/TodoQuadrant.vue`
- Modify: `src/views/MatrixView.vue`

**Interfaces:**

- Consumes: `useTodosStore`, `QuadrantKey`, `QUADRANT_KEYS`, `quadrantFlags` (Task 12); `TodoForm` (Task 9); ключи `quadrant.*`.
- Produces: рабочую страницу матрицы. Последняя задача плана.

- [ ] **Step 1: Создать компонент квадранта**

Файл `src/components/TodoQuadrant.vue`:

```vue
<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 12rem;
}

.list {
	flex: 1 1 auto;
	overflow-y: auto;
}

.done {
	opacity: 0.55;
	text-decoration: line-through;
}
</style>

<template>
	<v-card :class="$style.card" variant="tonal" :color="color">
		<v-card-title class="d-flex align-center">
			<span class="text-subtitle-1">{{ t(`quadrant.${quadrant}`) }}</span>
			<v-spacer />
			<v-btn
				icon="mdi-plus"
				variant="text"
				density="comfortable"
				:aria-label="t('form.add')"
				@click="emit('add', quadrant)"
			/>
		</v-card-title>

		<v-list :class="$style.list" bg-color="transparent" density="compact">
			<v-list-item v-if="items.length === 0" :title="t('quadrant.empty')" disabled />

			<v-list-item v-for="todo in items" :key="todo.id">
				<template #prepend>
					<v-checkbox-btn
						:model-value="todo.done"
						:aria-label="t('todo.done')"
						@update:model-value="emit('toggle', todo.id)"
					/>
				</template>

				<v-list-item-title :class="todo.done ? $style.done : undefined">
					{{ todo.title }}
				</v-list-item-title>
			</v-list-item>
		</v-list>
	</v-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Todo } from '@/types/todo';
import type { QuadrantKey } from '@/stores/todos';

defineProps<{
	quadrant: QuadrantKey;
	items: Todo[];
	color: string;
}>();

const emit = defineEmits<{
	add: [quadrant: QuadrantKey];
	toggle: [id: string];
}>();

const { t } = useI18n();
</script>
```

- [ ] **Step 2: Переписать MatrixView.vue**

```vue
<style lang="scss" module>
.grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 1rem;
}

@media (max-width: 600px) {
	.grid {
		grid-template-columns: 1fr;
	}
}
</style>

<template>
	<v-container>
		<div :class="$style.grid">
			<todo-quadrant
				v-for="key in QUADRANT_KEYS"
				:key="key"
				:quadrant="key"
				:items="store.quadrants[key]"
				:color="colors[key]"
				@add="openFor"
				@toggle="store.toggleDone($event)"
			/>
		</div>

		<todo-form v-model="dialogOpen" :initial="initialDraft" @submit="store.add($event)" />
	</v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TodoForm from '@/components/TodoForm.vue';
import TodoQuadrant from '@/components/TodoQuadrant.vue';
import {
	QUADRANT_KEYS,
	quadrantFlags,
	useTodosStore,
	type QuadrantKey,
	type TodoDraft,
} from '@/stores/todos';

const store = useTodosStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TodoDraft>>({});

const colors: Record<QuadrantKey, string> = {
	do: 'error',
	schedule: 'primary',
	delegate: 'warning',
	eliminate: 'surface-variant',
};

function openFor(quadrant: QuadrantKey): void {
	initialDraft.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
</script>
```

Кнопка «плюс» в квадранте открывает ту же форму, что и на странице списка, но с уже проставленными флагами важности и срочности — это единственная причина, по которой `quadrantFlags` существует.

- [ ] **Step 3: Проверить в браузере**

Run: `npm run dev`
Expected:

- страница матрицы показывает четыре карточки в сетке 2×2, каждая своего цвета, пустые подписаны «Пусто»;
- дела, заведённые на странице списка, лежат в квадрантах согласно флагам;
- «плюс» в квадранте «Сделать» открывает форму с уже включёнными переключателями важности и срочности; сохранённое дело появляется в этом же квадранте;
- чекбокс в квадранте зачёркивает дело, и на странице списка оно тоже отмечено;
- на узком экране (в инструментах разработчика режим телефона) сетка перестраивается в одну колонку.

- [ ] **Step 4: Финальная проверка**

Run: `npm test`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: успех.
Run: `npm run preview`
Expected: продакшен-сборка открывается, обе страницы работают, данные на месте.

- [ ] **Step 5: Проверить на телефоне**

Run: `npm run dev -- --host`
Открой показанный адрес в локальной сети с телефона.
Expected: таблица прокручивается по горизонтали и читаема, матрица в одну колонку, кнопка добавления не перекрыта системной панелью снизу.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add eisenhower matrix page"
```

**Этапы 1–3 завершены.**

---

## Итоговая приёмка

Полный прогон после последней задачи:

```bash
npm run lint
npm test
npm run build
npm run preview
```

Сценарий вручную, одной последовательностью:

1. Завести дело на странице списка, отметив его важным и срочным.
2. Перейти на матрицу — дело в квадранте «Сделать».
3. Отметить его сделанным прямо в матрице.
4. Вернуться в список — отметка на месте, название зачёркнуто.
5. Кликнуть по строке, сменить название и снять признак срочности, сохранить.
6. Вернуться на матрицу — дело переехало в квадрант «Запланировать».
7. Добавить дело кнопкой «плюс» внутри квадранта «Делегировать» — оно появляется именно там.
8. Перезагрузить страницу — оба дела на месте со всеми признаками.
9. Сменить язык и тему, перезагрузить — выбор сохранился.
10. Удалить оба дела в списке, перезагрузить — список пуст.

## Что осталось за пределами плана

Теги, сроки, горизонты, цели и мечты, частота повторения, история выполнений, PWA и офлайн, синхронизация устройств, экспорт и импорт файла.

Отдельно стоит отметить: редактирование дела есть только на странице списка (клик по строке). В матрице клик по делу ничего не открывает — там доступны лишь отметка выполнения и создание. Это осознанное упрощение, а не упущение.
