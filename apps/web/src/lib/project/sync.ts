import { useProjectStore } from "./store";

/**
 * URLクエリの projectId が所属企画に含まれていれば、選択中企画を切り替える。
 * メール内リンクから遷移してきた際に、対象企画を自動選択するために使う。
 *
 * 不正な値や所属外企画の場合は何もしない（親ルートの fallback に委ねる）。
 */
export function syncSelectedProjectFromSearch(
	searchProjectId: string | undefined
) {
	if (!searchProjectId) return;
	const store = useProjectStore.getState();
	const isValid = store.projects.some(p => p.id === searchProjectId);
	if (isValid && store.selectedProjectId !== searchProjectId) {
		store.setSelectedProjectId(searchProjectId);
	}
}

/**
 * 画面を開いたあとに選ばれる企画を返す。URL の projectId が所属企画にあればその企画、なければ選択中の企画。
 * loaderDeps に使い、企画ごとに別の画面として扱わせる（beforeLoad より先に評価されるため、ここで URL も見る）
 */
export function resolveProjectIdForLoaderDeps(
	searchProjectId: string | undefined
): string | null {
	const { projects, selectedProjectId } = useProjectStore.getState();
	if (searchProjectId && projects.some(p => p.id === searchProjectId)) {
		return searchProjectId;
	}
	return selectedProjectId;
}
