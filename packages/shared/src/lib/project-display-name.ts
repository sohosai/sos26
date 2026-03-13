export const PROJECT_DISPLAY_NAME_MAX_KANA_LENGTH = 20;
const KANA_LENGTH_UNIT = 3;
const ALNUM_OR_HALF_WIDTH_SYMBOL_LENGTH_UNIT = 2;

const halfWidthAlnumOrSymbolPattern = /^[\u0020-\u007E]$/u;
const fullWidthAlnumPattern = /^[Ａ-Ｚａ-ｚ０-９]$/u;
const emojiPattern =
	/(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|[#*0-9]\uFE0F?\u20E3)/u;

export const PROJECT_DISPLAY_NAME_RULE_MESSAGE =
	"企画名・企画団体名は20文字以内で登録してください。半角・全角英数字及び半角記号は3文字で仮名2文字としてカウントします。絵文字は企画名・企画団体名に使用しないでください。";

function isAlnumOrHalfWidthSymbol(char: string): boolean {
	return (
		halfWidthAlnumOrSymbolPattern.test(char) || fullWidthAlnumPattern.test(char)
	);
}

export function hasEmojiInProjectDisplayName(value: string): boolean {
	return emojiPattern.test(value);
}

export function isBlankProjectDisplayName(value: string): boolean {
	return value.trim().length === 0;
}

export function calculateProjectDisplayNameLengthUnits(value: string): number {
	let units = 0;

	for (const char of value) {
		units += isAlnumOrHalfWidthSymbol(char)
			? ALNUM_OR_HALF_WIDTH_SYMBOL_LENGTH_UNIT
			: KANA_LENGTH_UNIT;
	}

	return units;
}

export function isValidProjectDisplayName(value: string): boolean {
	if (isBlankProjectDisplayName(value)) return false;
	if (hasEmojiInProjectDisplayName(value)) return false;

	return (
		calculateProjectDisplayNameLengthUnits(value) <=
		PROJECT_DISPLAY_NAME_MAX_KANA_LENGTH * KANA_LENGTH_UNIT
	);
}
