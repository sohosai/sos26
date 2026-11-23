import { Badge, Heading, Text } from "@radix-ui/themes";
import type { ListProjectFormsResponse } from "@sos26/shared";
import { IconEdit, IconLock } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { refreshNotificationDot } from "@/lib/project/notification-status";
import { useProjectStore } from "@/lib/project/store";
import { syncSelectedProjectFromSearch } from "@/lib/project/sync";
import { queryClient } from "@/lib/query/client";
import { projectFormsQuery } from "@/lib/query/project";
import { ProjectFormAnswerDialog } from "./-components/ProjectFormAnswerDialog";
import styles from "./index.module.scss";

const searchSchema = z.object({
	projectId: z.string().optional(),
});

type FormRow = {
	formDeliveryId: string;
	title: string;
	description: string | null;
	scheduledSendAt: Date;
	deadlineAt: Date | null;
	allowLateResponse: boolean;
	required: boolean;
	restricted: boolean;
	responseId: string | null;
	submittedAt: Date | null;
};

type ProjectFormListItem = ListProjectFormsResponse["forms"][number];

function toFormRow(f: ProjectFormListItem): FormRow {
	return {
		formDeliveryId: f.formDeliveryId,
		title: f.title,
		description: f.description,
		scheduledSendAt: f.scheduledSendAt,
		deadlineAt: f.deadlineAt,
		allowLateResponse: f.allowLateResponse,
		required: f.required,
		restricted: f.restricted,
		responseId: f.response?.id ?? null,
		submittedAt: f.response?.submittedAt ?? null,
	};
}

/** 回答の保存結果を一覧のキャッシュに反映する */
function setFormResponse(
	projectId: string,
	deliveryId: string,
	update: (
		prev: ProjectFormListItem["response"]
	) => NonNullable<ProjectFormListItem["response"]>
) {
	queryClient.setQueryData(projectFormsQuery(projectId).queryKey, prev =>
		prev
			? {
					...prev,
					forms: prev.forms.map(f =>
						f.formDeliveryId === deliveryId
							? { ...f, response: update(f.response) }
							: f
					),
				}
			: prev
	);
}

const columnHelper = createColumnHelper<FormRow>();

export const Route = createFileRoute("/project/forms/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "申請 | 雙峰祭オンラインシステム" }],
	}),
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => {
		syncSelectedProjectFromSearch(search.projectId);
	},
	loader: async ({ context }) => {
		// 新着があれば一覧が古くなっているので、確認を待ってから読む
		await context.notificationStatusCheck;
		const { selectedProjectId } = useProjectStore.getState();
		if (selectedProjectId) {
			await queryClient.fetchQuery(projectFormsQuery(selectedProjectId));
		}
		return { projectId: selectedProjectId };
	},
});

function RouteComponent() {
	const { projectId } = Route.useLoaderData();
	return projectId ? <ProjectFormsPage projectId={projectId} /> : null;
}

/**
 * 企画は loader が取得したものを使う。企画を切り替えたときに、新しい loader が終わるまで前の企画の一覧を出したままにするため
 */
function ProjectFormsPage({ projectId }: { projectId: string }) {
	const { data } = useSuspenseQuery(projectFormsQuery(projectId));
	const forms = useMemo(() => data.forms.map(toFormRow), [data]);

	const [answeringDeliveryId, setAnsweringDeliveryId] = useState<string | null>(
		null
	);

	const handleDraftSaved = useCallback(
		(deliveryId: string, responseId: string) => {
			setFormResponse(projectId, deliveryId, prev => ({
				id: responseId,
				submittedAt: prev?.submittedAt ?? null,
			}));
		},
		[projectId]
	);

	const handleSubmitSuccess = useCallback(
		(deliveryId: string, responseId: string, submittedAt: Date | null) => {
			setFormResponse(projectId, deliveryId, () => ({
				id: responseId,
				submittedAt,
			}));
			setAnsweringDeliveryId(null);
			void refreshNotificationDot();
		},
		[projectId]
	);

	const columns = [
		columnHelper.accessor("title", {
			header: "申請名",
		}),
		columnHelper.accessor("scheduledSendAt", {
			header: "配信日時",
			cell: DateCell,
			meta: { dateFormat: "datetime" },
		}),
		columnHelper.accessor("required", {
			header: "回答必須",
			cell: ctx => (
				<Badge variant="soft" color={ctx.getValue() ? "red" : "gray"}>
					{ctx.getValue() ? "必須" : "任意"}
				</Badge>
			),
		}),
		columnHelper.accessor("deadlineAt", {
			header: "回答期限",
			cell: ctx => {
				const val = ctx.getValue();
				if (!val)
					return (
						<Text size="2" color="gray">
							なし
						</Text>
					);
				return <DateCell {...ctx} />;
			},
			meta: { dateFormat: "datetime" },
		}),
		columnHelper.accessor("submittedAt", {
			header: "回答状況",
			cell: ctx => {
				const submittedAt = ctx.getValue();
				const { allowLateResponse, deadlineAt, responseId, restricted } =
					ctx.row.original;

				if (restricted) {
					return (
						<Badge variant="soft" color="orange">
							<IconLock size={12} />
							閲覧制限
						</Badge>
					);
				}

				const isExpired =
					deadlineAt && !allowLateResponse && new Date() > deadlineAt;

				if (submittedAt) {
					return (
						<Badge variant="soft" color="green">
							提出済み
						</Badge>
					);
				}
				if (isExpired) {
					return (
						<Badge variant="soft" color="red">
							期限切れ
						</Badge>
					);
				}
				if (responseId) {
					return (
						<Badge variant="soft" color="yellow">
							下書きあり
						</Badge>
					);
				}
				return (
					<Badge variant="soft" color="gray">
						未回答
					</Badge>
				);
			},
		}),
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => {
				const {
					allowLateResponse,
					deadlineAt,
					formDeliveryId,
					responseId,
					restricted,
				} = row.original;
				const isExpired = !!(
					deadlineAt &&
					!allowLateResponse &&
					new Date() > deadlineAt
				);
				const canViewExpiredResponse = isExpired && responseId;
				const isDisabled = restricted || (isExpired && !responseId);

				return (
					<Button
						intent="secondary"
						size="1"
						onClick={() => setAnsweringDeliveryId(formDeliveryId)}
						disabled={isDisabled}
					>
						{restricted ? (
							<>
								<IconLock size={16} />
								閲覧制限
							</>
						) : canViewExpiredResponse ? (
							<>
								<IconEdit size={16} />
								回答を確認
							</>
						) : (
							<>
								<IconEdit size={16} />
								{responseId ? "回答を編集" : "回答する"}
							</>
						)}
					</Button>
				);
			},
			enableSorting: false,
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">申請</Heading>
				<Text size="2" color="gray">
					実委人から配信された申請に回答できます。
				</Text>
			</div>

			<DataTable<FormRow>
				data={forms}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				initialSorting={[{ id: "scheduledSendAt", desc: true }]}
			/>

			{answeringDeliveryId && (
				<ProjectFormAnswerDialog
					open={!!answeringDeliveryId}
					onOpenChange={open => {
						if (!open) setAnsweringDeliveryId(null);
					}}
					projectId={projectId}
					formDeliveryId={answeringDeliveryId}
					onSubmitSuccess={(responseId, submittedAt) =>
						handleSubmitSuccess(answeringDeliveryId, responseId, submittedAt)
					}
					onDraftSaved={responseId =>
						handleDraftSaved(answeringDeliveryId, responseId)
					}
				/>
			)}
		</div>
	);
}
