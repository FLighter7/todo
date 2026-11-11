// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { encode } from 'uqr';
import QrCode from '../QrCode.vue';

const TEXT = 'wsrv1.eyJ2IjoxfQ';

function mountCode() {
	return mount(QrCode, { props: { value: TEXT, label: 'Pairing code for Desk' } });
}

describe('QrCode', () => {
	it('is a picture with a name', () => {
		const svg = mountCode().get('svg');

		expect(svg.attributes('role')).toBe('img');
		expect(svg.attributes('aria-label')).toBe('Pairing code for Desk');
	});

	it('draws every dark module of the code, inside a quiet zone of four', () => {
		const { size, data } = encode(TEXT, { ecc: 'L', border: 4 });
		const wrapper = mountCode();

		expect(wrapper.get('svg').attributes('viewBox')).toBe(`0 0 ${size} ${size}`);
		const drawn = new Set<string>();
		const runs = wrapper
			.get('path')
			.attributes('d')!
			.matchAll(/M(\d+) (\d+)h(\d+)/g);
		for (const [, x, y, width] of runs) {
			for (let step = 0; step < Number(width); step++) drawn.add(`${Number(x) + step},${y}`);
		}

		const dark = data.flatMap((row, y) =>
			row.flatMap((isDark, x) => (isDark ? [`${x},${y}`] : [])),
		);
		expect([...drawn].sort()).toEqual(dark.sort());
		expect([...drawn].every((cell) => cell.split(',').every((n) => Number(n) >= 4))).toBe(true);
	});

	it('stays black on white whatever the theme', () => {
		const wrapper = mountCode();

		expect(wrapper.get('rect').attributes('fill')).toBe('#ffffff');
		expect(wrapper.get('path').attributes('fill')).toBe('#000000');
	});
});
