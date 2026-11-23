import { queryOptions } from "@tanstack/react-query";
import {
	getProjectNotificationStatus,
	listProjectMembers,
} from "../api/project";
import { listProjectForms } from "../api/project-form";
import { listProjectInquiries } from "../api/project-inquiry";
import { listProjectNotices } from "../api/project-notice";

/**
 * /project の中で画面を移るたびには一覧を取り直さない。
 * 新着は、画面を移るたびと定期的に notification-status を確かめ、変わっていたら取り直す
 */
const PROJECT_STALE_TIME = 30_000;

export const projectQueryKeys = {
	/** 企画ごとの query をまとめて無効にするときに使う */
	all: (projectId: string) => ["project", projectId] as const,
	notificationStatus: (projectId: string) =>
		["project", projectId, "notification-status"] as const,
	forms: (projectId: string) => ["project", projectId, "forms"] as const,
	notices: (projectId: string) => ["project", projectId, "notices"] as const,
	inquiries: (projectId: string) =>
		["project", projectId, "inquiries"] as const,
	members: (projectId: string) => ["project", projectId, "members"] as const,
};

export const projectNotificationStatusQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.notificationStatus(projectId),
		queryFn: () => getProjectNotificationStatus(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectFormsQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.forms(projectId),
		queryFn: () => listProjectForms(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectNoticesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.notices(projectId),
		queryFn: () => listProjectNotices(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectInquiriesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.inquiries(projectId),
		queryFn: () => listProjectInquiries(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectMembersQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.members(projectId),
		queryFn: () => listProjectMembers(projectId),
		staleTime: PROJECT_STALE_TIME,
	});
