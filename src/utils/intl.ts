const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A shared `Intl.DateTimeFormat` for this locale and these options.
 *
 * Building one resolves the locale and loads its calendar and zone data,
 * which costs far more than formatting with it, and a list formats a label
 * per row. A formatter keeps no state between calls, so one per distinct
 * locale and options serves every caller. The options are keyed as written,
 * and `undefined` members drop out of the key the way Intl ignores them.
 */
export function dateTimeFormat(
	locale: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let format = dateTimeFormats.get(key);
	if (format === undefined) {
		format = new Intl.DateTimeFormat(locale, options);
		dateTimeFormats.set(key, format);
	}

	return format;
}
