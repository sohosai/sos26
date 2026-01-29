import type { User } from "@prisma/client";

export type AuthEnv = {
	Variables: {
		user: User;
		regTicketRaw: string;
	};
};
