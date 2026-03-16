const URL_REGEX = /https?:\/\/[^\s<>&]+/g;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function textToHtml(text: string): string {
	return escapeHtml(text)
		.replace(URL_REGEX, url => `<a href="${url}">${url}</a>`)
		.replace(/\n/g, "<br />");
}
