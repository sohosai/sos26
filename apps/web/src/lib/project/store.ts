import type { Project } from "@sos26/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ProjectStore = {
	projects: Project[];
	selectedProjectId: string | null;
	setProjects: (projects: Project[]) => void;
	setSelectedProjectId: (id: string | null) => void;
};

export const useProjectStore = create<ProjectStore>()(
	persist(
		set => ({
			projects: [],
			selectedProjectId: null,
			setProjects: projects => set({ projects }),
			setSelectedProjectId: selectedProjectId => set({ selectedProjectId }),
		}),
		{
			name: "sos26-project-store",
			storage: createJSONStorage(() => localStorage),
			partialize: state => ({ selectedProjectId: state.selectedProjectId }),
		}
	)
);

/**
 * 選択中の企画を返す。未選択の場合は例外を投げる。
 */
export function useProject(): Project {
	const project = useProjectStore(s =>
		s.projects.find(p => p.id === s.selectedProjectId)
	);
	if (!project) {
		throw new Error("No project selected");
	}
	return project;
}
