if (typeof window !== 'undefined') {
	class ResizeObserverStub {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}

	window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

	window.matchMedia ??= (query: string): MediaQueryList =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;

	if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
		const store: Record<string, string> = {};
		window.localStorage = {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => {
				store[key] = value;
			},
			removeItem: (key: string) => {
				delete store[key];
			},
			clear: () => {
				for (const key of Object.keys(store)) {
					delete store[key];
				}
			},
			key: (index: number) => Object.keys(store)[index] ?? null,
			length: 0,
		};
	}
}
