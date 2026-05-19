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
