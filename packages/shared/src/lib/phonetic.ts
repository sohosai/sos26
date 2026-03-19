/**
 * カタカナをひらがなに変換する
 *
 * Unicode のカタカナ範囲 (U+30A1〜U+30F6) を
 * ひらがな範囲 (U+3041〜U+3096) にシフトする。
 * 長音「ー」やその他の文字はそのまま保持する。
 */
export function toHiragana(str: string): string {
	return str.replace(/[\u30A1-\u30F6]/g, ch =>
		String.fromCharCode(ch.charCodeAt(0) - 0x60)
	);
}

/** かな（ひらがな・カタカナ・長音ー・スペース）のみかを判定 */
const KANA_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u3000 ]+$/;
export function isKana(str: string): boolean {
	return KANA_REGEX.test(str);
}
