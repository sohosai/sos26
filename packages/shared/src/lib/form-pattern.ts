export const PATTERN_REGEXES: Record<string, RegExp> = {
	katakana: /^[\u30A0-\u30FF\u30FCー]+$/,
	hiragana: /^[\u3040-\u309F\u30FC]+$/,
	alphanumeric: /^[a-zA-Z0-9]+$/,
};

export const PATTERN_LABELS: Record<string, string> = {
	katakana: "全角カタカナ",
	hiragana: "ひらがな",
	alphanumeric: "半角英数字",
};
