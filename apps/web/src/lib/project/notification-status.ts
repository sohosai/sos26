type RefreshDot = () => Promise<void>;

let refreshDot: RefreshDot | null = null;

/** /project のレイアウトが、サイドバーのドットを取り直す関数を登録する。戻り値で登録を外す */
export function registerNotificationDotRefresh(fn: RefreshDot): () => void {
	refreshDot = fn;
	return () => {
		if (refreshDot === fn) refreshDot = null;
	};
}

/**
 * 自分の操作で未回答・未確認の状態が変わったあとに、サイドバーのドットだけを取り直す。
 * 画面の loader は取り直さない
 */
export function refreshNotificationDot(): Promise<void> {
	return refreshDot?.() ?? Promise.resolve();
}
