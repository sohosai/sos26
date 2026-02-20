import type { Project } from "@sos26/shared";
import { create } from "zustand";

type ProjectStore = {
	projects: Project[];
	selectedProjectId: string | null;
	setProjects: (projects: Project[]) => void;
	setSelectedProjectId: (id: string | null) => void;
};

export const useProjectStore = create<ProjectStore>(set => ({
	projects: [],
	selectedProjectId: null,
	setProjects: projects => set({ projects }),
	setSelectedProjectId: selectedProjectId => set({ selectedProjectId }),
}));

/**
 * 選択中のプロジェクトを返す。未選択の場合は例外を投げる。
 * 旧 ProjectContext の useProject() の代替。
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
