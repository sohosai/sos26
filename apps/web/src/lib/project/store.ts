import type { MyProject } from "@sos26/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ProjectStore = {
	projects: MyProject[];
	selectedProjectId: string | null;
	setProjects: (projects: MyProject[]) => void;
	setSelectedProjectId: (id: string | null) => void;
	/** 保存直後にサイドバーのアイコンへ即時反映するための更新 */
	setIconFileId: (projectId: string, iconFileId: string | null) => void;
};

export const useProjectStore = create<ProjectStore>()(
	persist(
		set => ({
			projects: [],
			selectedProjectId: null,
			setProjects: projects => set({ projects }),
			setSelectedProjectId: selectedProjectId => set({ selectedProjectId }),
			setIconFileId: (projectId, iconFileId) =>
				set(state => ({
					projects: state.projects.map(p =>
						p.id === projectId ? { ...p, iconFileId } : p
					),
				})),
		}),
		{
			name: "sos26-project-store",
			storage: createJSONStorage(() => localStorage),
			// 企画データ自体は毎回サーバーから取り直す。
			// localStorage に残すと古い内容や別ユーザーの情報が表示されるため。
			partialize: state => ({ selectedProjectId: state.selectedProjectId }),
		}
	)
);

/**
 * 選択中の企画を返す。未選択の場合は例外を投げる。
 */
export function useProject(): MyProject {
	const project = useProjectStore(s =>
		s.projects.find(p => p.id === s.selectedProjectId)
	);
	if (!project) {
		throw new Error("No project selected");
	}
	return project;
}
