import type { CommitteeMember, Project, User } from "@prisma/client";
import type { CommitteePermission } from "@sos26/shared";

export type ProjectRole = "OWNER" | "SUB_OWNER" | "MEMBER";

export type AuthEnv = {
	Variables: {
		user: User;
		regTicketRaw: string;
		committeeMember: CommitteeMember | null;
		permissions: Set<CommitteePermission>;
		project: Project;
		projectRole: ProjectRole;
	};
};
