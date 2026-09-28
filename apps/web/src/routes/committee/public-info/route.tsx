import { Badge, Flex, Heading, Text } from "@radix-ui/themes";
import type {
	CommitteePublicInfoItem,
	ProjectDeletionStatus,
	ProjectPublicInfoField,
	ProjectType,
} from "@sos26/shared";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { DataTable } from "@/components/patterns";
import { Button, Checkbox, Select } from "@/components/primitives";
import { listCommitteePublicInfo } from "@/lib/api/committee-public-info";
import { ForbiddenError, useAuthStore } from "@/lib/auth";
import { formatProjectNumber } from "@/lib/format";
import { PublicInfoDetailDialog } from "./-components/PublicInfoDetailDialog";
import { FieldStatusBadges, SNS_FIELDS } from "./-components/shared";
import styles from "./route.module.scss";

export const Route = createFileRoute("/committee/public-info")({
	// サイドバーでも非表示にしている画面なので、URL直打ちでも同じ扱いにする。
	// 権限は GET /auth/me で取得済みのため再取得しない。
	beforeLoad: () => {
		const { permissions } = useAuthStore.getState();
		if (!permissions?.has("MAP_APP_SETTING_EDIT")) {
			throw new ForbiddenError();
		}
	},
	loader: async () => {
		const { items } = await listCommitteePublicInfo();
		return { items };
	},
	component: PublicInfoListPage,
	head: () => ({
		meta: [
			{ title: "企画情報 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "企画が入力した企画情報の確認・管理" },
		],
	}),
});

const PROJECT_TYPE_LABEL = {
	STAGE: "ステージ企画",
	FOOD: "食品企画",
	NORMAL: "普通企画",
} satisfies Record<ProjectType, string>;

const DELETION_STATUS_LABEL = {
	LOTTERY_LOSS: "落選",
	DELETED: "企画中止",
	PROJECT_WITHDRAWN: "企画辞退",
} satisfies Record<ProjectDeletionStatus, string>;

type Row = {
	projectId: string;
	number: string;
	name: string;
	organizationName: string;
	type: ProjectType;
	isRegistered: boolean;
	hiddenCount: number;
	correctedCount: number;
	item: CommitteePublicInfoItem;
};

function toRow(item: CommitteePublicInfoItem): Row {
	const countOf = (kind: "HIDDEN" | "CORRECTED") =>
		item.moderations.filter(m => m.kind === kind).length;
	return {
		projectId: item.project.id,
		number: formatProjectNumber(item.project.number),
		name: item.project.name,
		organizationName: item.project.organizationName,
		type: item.project.type,
		isRegistered: item.publicInfo !== null,
		hiddenCount: countOf("HIDDEN") + item.hiddenMapImageFileIds.length,
		correctedCount: countOf("CORRECTED"),
		item,
	};
}

const columnHelper = createColumnHelper<Row>();

function FieldCell({
	item,
	field,
	children,
}: {
	item: CommitteePublicInfoItem;
	field: ProjectPublicInfoField;
	children: React.ReactNode;
}) {
	return (
		<Flex direction="column" gap="1" align="start">
			{children}
			<FieldStatusBadges item={item} field={field} />
		</Flex>
	);
}

function Empty() {
	return (
		<Text size="2" color="gray">
			—
		</Text>
	);
}

type RegistrationFilter = "ALL" | "REGISTERED" | "UNREGISTERED";
type TypeFilter = "ALL" | ProjectType;

function PublicInfoListPage() {
	const { items: loadedItems } = Route.useLoaderData();
	// 詳細ダイアログでの変更をそのまま一覧に反映するため、手元で持つ
	const [items, setItems] = useState(loadedItems);
	const [loadedFrom, setLoadedFrom] = useState(loadedItems);
	if (loadedFrom !== loadedItems) {
		setLoadedFrom(loadedItems);
		setItems(loadedItems);
	}

	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		null
	);
	const selectedItem =
		items.find(item => item.project.id === selectedProjectId) ?? null;

	const [registrationFilter, setRegistrationFilter] =
		useState<RegistrationFilter>("ALL");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
	const [onlyModerated, setOnlyModerated] = useState(false);
	const [includeInactive, setIncludeInactive] = useState(false);

	const rows = useMemo(
		() =>
			items
				.filter(item => includeInactive || item.project.deletionStatus === null)
				.map(toRow)
				.filter(
					row =>
						(registrationFilter === "ALL" ||
							row.isRegistered === (registrationFilter === "REGISTERED")) &&
						(typeFilter === "ALL" || row.type === typeFilter) &&
						(!onlyModerated || row.hiddenCount + row.correctedCount > 0)
				),
		[items, includeInactive, registrationFilter, typeFilter, onlyModerated]
	);

	const handleItemChange = (updated: CommitteePublicInfoItem) => {
		setItems(current =>
			current.map(item =>
				item.project.id === updated.project.id ? updated : item
			)
		);
	};

	const columns = [
		columnHelper.accessor("number", { header: "企画番号" }),
		columnHelper.accessor("name", {
			header: "企画名",
			cell: ({ row }) => {
				const { deletionStatus } = row.original.item.project;
				return (
					<Flex align="center" gap="2">
						<Text size="2">{row.original.name}</Text>
						{deletionStatus && (
							<Badge color="gray" variant="soft">
								{DELETION_STATUS_LABEL[deletionStatus]}
							</Badge>
						)}
					</Flex>
				);
			},
		}),
		columnHelper.accessor("organizationName", { header: "団体名" }),
		columnHelper.accessor("type", {
			header: "企画区分",
			cell: ctx => PROJECT_TYPE_LABEL[ctx.getValue()],
		}),
		columnHelper.accessor("isRegistered", {
			header: "登録状況",
			cell: ctx =>
				ctx.getValue() ? (
					<Badge color="green" variant="soft">
						登録済み
					</Badge>
				) : (
					<Badge color="gray" variant="soft">
						未登録
					</Badge>
				),
		}),
		columnHelper.display({
			id: "icon",
			header: "アイコン",
			cell: ({ row }) => {
				const { item } = row.original;
				if (!item.publicInfo?.iconFileId) return <Empty />;
				return (
					<FieldCell item={item} field="ICON">
						<UserAvatar
							size={32}
							name={item.project.name}
							avatarFileId={item.publicInfo.iconFileId}
						/>
					</FieldCell>
				);
			},
		}),
		columnHelper.display({
			id: "description",
			header: "紹介文",
			cell: ({ row }) => {
				const { item } = row.original;
				if (!item.publicInfo?.description) return <Empty />;
				return (
					<FieldCell item={item} field="DESCRIPTION">
						<Text size="2" className={styles.description}>
							{item.publicInfo.description}
						</Text>
					</FieldCell>
				);
			},
		}),
		columnHelper.display({
			id: "sns",
			header: "SNSリンク",
			cell: ({ row }) => {
				const { item } = row.original;
				const { publicInfo } = item;
				const registered = SNS_FIELDS.filter(
					({ key }) => (publicInfo?.[key].length ?? 0) > 0
				);
				if (registered.length === 0) return <Empty />;
				return (
					<Flex direction="column" gap="1">
						{registered.map(({ key, field, label }) => (
							<Flex key={key} align="center" gap="1" wrap="wrap">
								<Text size="2">{label}</Text>
								<FieldStatusBadges item={item} field={field} />
							</Flex>
						))}
					</Flex>
				);
			},
		}),
		columnHelper.display({
			id: "mapImages",
			header: "掲載画像",
			cell: ({ row }) => {
				const { item } = row.original;
				const count = item.publicInfo?.mapImageFileIds.length ?? 0;
				if (count === 0) return <Empty />;
				const hidden = item.hiddenMapImageFileIds.length;
				return (
					<Text size="2">
						{count}枚{hidden > 0 && `（非表示${hidden}）`}
					</Text>
				);
			},
		}),
		columnHelper.display({
			id: "moderation",
			header: "非表示・修正",
			cell: ({ row }) => {
				const { hiddenCount, correctedCount } = row.original;
				if (hiddenCount + correctedCount === 0) return <Empty />;
				return (
					<Flex gap="1" wrap="wrap">
						{hiddenCount > 0 && (
							<Badge color="red" variant="soft">
								非表示 {hiddenCount}
							</Badge>
						)}
						{correctedCount > 0 && (
							<Badge color="blue" variant="soft">
								修正 {correctedCount}
							</Badge>
						)}
					</Flex>
				);
			},
		}),
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Button
					intent="ghost"
					size="1"
					onClick={() => setSelectedProjectId(row.original.projectId)}
				>
					<IconEye size={16} />
					詳細
				</Button>
			),
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">企画情報</Heading>
				<Text size="2" color="gray">
					企画が入力した企画情報を確認し、項目ごとに非表示・修正できます。変更は企画検索システムにすぐ反映されます。
				</Text>
			</div>

			<DataTable<Row>
				data={rows}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				toolbarExtra={
					<Flex gap="3" align="center" wrap="wrap">
						<Select
							aria-label="登録状況"
							size="1"
							value={registrationFilter}
							onValueChange={value =>
								setRegistrationFilter(value as RegistrationFilter)
							}
							options={[
								{ value: "ALL", label: "登録状況: すべて" },
								{ value: "REGISTERED", label: "登録済み" },
								{ value: "UNREGISTERED", label: "未登録" },
							]}
						/>
						<Select
							aria-label="企画区分"
							size="1"
							value={typeFilter}
							onValueChange={value => setTypeFilter(value as TypeFilter)}
							options={[
								{ value: "ALL", label: "企画区分: すべて" },
								...Object.entries(PROJECT_TYPE_LABEL).map(([value, label]) => ({
									value,
									label,
								})),
							]}
						/>
						<Checkbox
							label="非表示・修正ありのみ"
							checked={onlyModerated}
							onCheckedChange={setOnlyModerated}
						/>
						<Checkbox
							label="落選・中止・辞退を含める"
							checked={includeInactive}
							onCheckedChange={setIncludeInactive}
						/>
					</Flex>
				}
			/>

			{selectedItem && (
				<PublicInfoDetailDialog
					open
					onOpenChange={open => {
						if (!open) setSelectedProjectId(null);
					}}
					item={selectedItem}
					onItemChange={handleItemChange}
				/>
			)}
		</div>
	);
}
