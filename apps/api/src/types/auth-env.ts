import type { CommitteeMember, Project, User } from "@prisma/client";

export type ProjectRole = "OWNER" | "SUB_OWNER" | "MEMBER";

export type AuthEnv = {
	Variables: {
		user: User;
		regTicketRaw: string;
		committeeMember: CommitteeMember;
		project: Project;
		projectRole: ProjectRole;
	};
};
