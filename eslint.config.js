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
			'vue/component-name-in-template-casing': [
				'error',
				'PascalCase',
				{ registeredComponentsOnly: false },
			],
		},
	},
);
