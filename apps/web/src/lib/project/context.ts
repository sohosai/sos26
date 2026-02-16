import type { Project } from "@sos26/shared";
import { createContext, useContext } from "react";

export const ProjectContext = createContext<Project | null>(null);

export function useProject() {
	const project = useContext(ProjectContext);
	if (!project) {
		throw new Error("useProject must be used within ProjectContext.Provider");
	}
	return project;
}
