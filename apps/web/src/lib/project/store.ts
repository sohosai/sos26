import type { Project } from "@sos26/shared";
import { create } from "zustand";
import { getProjectDetail } from "../api/project";

type ProjectStore = {
	selectedProjectId: string | null;
	project: Project | null;
	setSelectedProjectId: (id: string | null) => void;
	fetchProjectDetail: () => Promise<void>;
	clear: () => void;
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
	selectedProjectId: null,
	project: null,

	setSelectedProjectId: (id: string | null) => {
		set({ selectedProjectId: id, project: null });
	},

	fetchProjectDetail: async () => {
		const { selectedProjectId } = get();
		if (!selectedProjectId) return;
		const { project } = await getProjectDetail(selectedProjectId);
		set({ project });
	},

	clear: () => {
		set({ selectedProjectId: null, project: null });
	},
}));
