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
