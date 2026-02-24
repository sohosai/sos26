import { Badge, type BadgeProps, Heading, Text } from "@radix-ui/themes";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable, DateCell, NameCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { getFormDetail, listFormResponses } from "@/lib/api/committee-form";

type AnswerRow = {
	id: string;
	// respondentName: string;
	projectName: string;
	submittedAt: Date | null;
	answers: Record<string, string | TagValue[]>;
};

type TagValue = {
	label: string;
	color: BadgeProps["color"];
};
const TAG_COLORS = [
	"gray",
	"blue",
	"green",
	"orange",
	"purple",
	"teal",
	"red",
] as const;

function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash);
}

function getOptionColor(optionId: string): BadgeProps["color"] {
	return TAG_COLORS[hashString(optionId) % TAG_COLORS.length];
}

export const Route = createFileRoute("/committee/forms/$formId/answers/")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const [formRes, responseRes] = await Promise.all([
			getFormDetail(params.formId),
			listFormResponses(params.formId),
		]);
		const items = formRes.form.items;

		const rows: AnswerRow[] = responseRes.responses.map(r => {
			const map: Record<string, string | TagValue[]> = {};

			for (const a of r.answers) {
				if (a.textValue != null) {
					map[a.formItemId] = a.textValue;
				} else if (a.numberValue != null) {
					map[a.formItemId] = String(a.numberValue);
				} else if (a.selectedOptions.length > 0) {
					map[a.formItemId] = a.selectedOptions.map(o => {
						return {
							label: o.label,
							color: getOptionColor(o.id),
						};
					});
				} else if (a.fileUrl) {
					map[a.formItemId] = "ファイル";
				} else {
					map[a.formItemId] = "";
				}
			}

			return {
				id: r.id,
				projectName: r.project.name,
				submittedAt: r.submittedAt,
				answers: map,
			};
		});

		return { items, rows };
	},

	head: () => ({
		meta: [{ title: "回答一覧 | 雙峰祭オンラインシステム" }],
	}),
});

function RouteComponent() {
	const { items, rows } = Route.useLoaderData();
	const formId = Route.useParams().formId;
	const columnHelper = createColumnHelper<AnswerRow>();

	const columns = [
		columnHelper.accessor("projectName", {
			header: "企画",
			cell: NameCell,
		}),
		columnHelper.accessor("submittedAt", {
			header: "提出日時",
			cell: DateCell,
			meta: { dateFormat: "datetime" },
		}),

		// 設問ごとの動的カラム
		...items.map(item =>
			columnHelper.accessor(row => row.answers[item.id] ?? "", {
				id: item.id,
				header: item.label,
				cell: ctx => {
					const value = ctx.getValue();
					if (!value || (Array.isArray(value) && value.length === 0)) {
						return (
							<Text size="2" color="gray">
								—
							</Text>
						);
					}

					if (Array.isArray(value)) {
						return (
							<div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
								{value.map(v => (
									<Badge key={v.label} variant="soft" color={v.color}>
										{v.label}
									</Badge>
								))}
							</div>
						);
					}

					if (item.type === "FILE") {
						return (
							<Text size="2" color="gray">
								ファイルあり
							</Text>
						);
					}

					// ▼ TEXT / NUMBER
					return (
						<Text size="2" truncate>
							{value as string}
						</Text>
					);
				},
			})
		),

		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Link
					to="/committee/forms/$formId/answers/$answerId"
					params={{
						formId,
						answerId: row.original.id,
					}}
				>
					<Button intent="ghost" size="1">
						<IconEye size={16} />
						詳細
					</Button>
				</Link>
			),
		}),
	];

	return (
		<div>
			<div style={{ marginBottom: 16 }}>
				<Heading size="5">回答一覧</Heading>
				<Text size="2" color="gray">
					フォームに送信された回答の一覧です。
				</Text>
			</div>

			<DataTable<AnswerRow>
				data={rows}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: true,
				}}
			/>
		</div>
	);
}
