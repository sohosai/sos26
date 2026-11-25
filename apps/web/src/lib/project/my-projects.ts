import { listMyProjects } from "@/lib/api/project";
import { useProjectStore } from "./store";

/**
 * 自分の企画一覧を取り直す。選択中の企画が一覧になければ（企画から外されたときなど）先頭の企画に切り替え、
 * 企画が 1 つもなければ選択を外す。
 * /project に入ったときのほか、企画一覧が変わりうる操作のあとに呼ぶ。
 */
export async function refreshMyProjects(): Promise<void> {
	const res = await listMyProjects();

	const store = useProjectStore.getState();
	const currentId = store.selectedProjectId;
	const isValid = currentId && res.projects.some(p => p.id === currentId);

	store.setProjects(res.projects);
	if (!isValid) {
		store.setSelectedProjectId(res.projects[0]?.id ?? null);
	}
}
