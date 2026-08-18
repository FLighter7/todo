/**
 * Russian and Polish share the same cardinal-number plural structure for
 * integers: "one" (ends in 1, not 11), "few" (ends in 2-4, not 12-14), and
 * "many" (everything else, including 0). vue-i18n's built-in rule only knows
 * singular/plural, so a message with three pipe-separated forms needs this
 * registered explicitly (`createI18n({ pluralRules: { ru, pl } })`), matching
 * vue-i18n's `PluralizationRule` signature: return the index into the
 * message's plural forms to use.
 */
export function slavicPluralRule(choice: number, choicesLength: number): number {
	const value = Math.abs(choice);

	if (choicesLength < 3) {
		return value === 1 ? 0 : 1;
	}

	const lastDigit = value % 10;
	const lastTwoDigits = value % 100;

	if (lastDigit === 1 && lastTwoDigits !== 11) {
		return 0;
	}

	if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
		return 1;
	}

	return 2;
}
