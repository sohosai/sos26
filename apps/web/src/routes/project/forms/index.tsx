import { Badge, Heading, Text } from "@radix-ui/themes";
import { IconEdit } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listProjectForms } from "@/lib/api/project-form";
import { useProjectStore } from "@/lib/project/store";
import { ProjectFormAnswerDialog } from "./-components/ProjectFormAnswerDialog";
import styles from "./index.module.scss";

type FormRow = {
	formDeliveryId: string;
	title: string;
	description: string | null;
	scheduledSendAt: Date;
	deadlineAt: Date | null;
	allowLateResponse: boolean;
	required: boolean;
	responseId: string | null;
	submittedAt: Date | null;
};

const columnHelper = createColumnHelper<FormRow>();

export const Route = createFileRoute("/project/forms/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "申請回答 | 雙峰祭オンラインシステム" }],
	}),
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) return { forms: [] as FormRow[] };
		const res = await listProjectForms(selectedProjectId);
		return {
			forms: res.forms.map(f => ({
				formDeliveryId: f.formDeliveryId,
				title: f.title,
				description: f.description,
				scheduledSendAt: f.scheduledSendAt,
				deadlineAt: f.deadlineAt,
				allowLateResponse: f.allowLateResponse,
				required: f.required,
				responseId: f.response?.id ?? null,
				submittedAt: f.response?.submittedAt ?? null,
			})),
		};
	},
});

function RouteComponent() {
	const { forms: initialForms } = Route.useLoaderData();
	const [forms, setForms] = useState<FormRow[]>(initialForms);
	const { selectedProjectId } = useProjectStore();

	useEffect(() => {
		setForms(initialForms);
	}, [initialForms]);

	const [answeringDeliveryId, setAnsweringDeliveryId] = useState<string | null>(
		null
	);

	const handleDraftSaved = useCallback(
		(deliveryId: string, responseId: string) => {
			setForms(prev =>
				prev.map(f =>
					f.formDeliveryId === deliveryId ? { ...f, responseId } : f
				)
			);
		},
		[]
	);

	const handleSubmitSuccess = useCallback(
		(deliveryId: string, submittedAt: Date | null) => {
			setForms(prev =>
				prev.map(f =>
					f.formDeliveryId === deliveryId ? { ...f, submittedAt } : f
				)
			);
			setAnsweringDeliveryId(null);
		},
		[]
	);

	const columns = [
		columnHelper.accessor("title", {
			header: "フォーム名",
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
				const { allowLateResponse, deadlineAt, responseId } = ctx.row.original;
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
					// submittedAt,
					allowLateResponse,
					deadlineAt,
					formDeliveryId,
					responseId,
				} = row.original;
				const isExpired =
					deadlineAt && !allowLateResponse && new Date() > deadlineAt;
				const isDisabled = !!isExpired;

				return (
					<Button
						intent="secondary"
						size="1"
						onClick={() => setAnsweringDeliveryId(formDeliveryId)}
						disabled={isDisabled}
					>
						<IconEdit size={16} />
						{responseId ? "回答を編集" : "回答する"}
					</Button>
				);
			},
			enableSorting: false,
		}),
	];

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">申請回答</Heading>
				<Text size="2" color="gray">
					実委人から配信されたフォームに回答できます。
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

			{answeringDeliveryId && selectedProjectId && (
				<ProjectFormAnswerDialog
					open={!!answeringDeliveryId}
					onOpenChange={open => {
						if (!open) setAnsweringDeliveryId(null);
					}}
					projectId={selectedProjectId}
					formDeliveryId={answeringDeliveryId}
					onSubmitSuccess={(submittedAt: Date | null) =>
						handleSubmitSuccess(answeringDeliveryId, submittedAt)
					}
					onDraftSaved={responseId =>
						handleDraftSaved(answeringDeliveryId, responseId)
					}
				/>
			)}
		</div>
	);
}
