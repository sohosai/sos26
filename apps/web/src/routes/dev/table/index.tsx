import { Box, Dialog, Heading, IconButton, Separator } from "@radix-ui/themes";
import { IconPencil } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { z } from "zod";
import {
	CheckboxGroup,
	CheckboxGroupItem,
	DataTable,
	DateCell,
	EditableCell,
	NameCell,
	SelectCell,
	TagCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import styles from "./index.module.scss";

export const Route = createFileRoute("/dev/table/")({
	component: TableDemoPage,
	head: () => ({
		meta: [{ title: "DataTable サンプル" }],
	}),
});

// ─── サンプル1: ユーザー管理（フル機能） ────────────────

type User = {
	id: number;
	name: string;
	age: number;
	email: string;
	department: string;
};

const userData: User[] = [
	{
		id: 1,
		name: "田中太郎",
		age: 28,
		email: "tanaka@example.com",
		department: "営業部",
	},
	{
		id: 2,
		name: "鈴木花子",
		age: 34,
		email: "suzuki@example.com",
		department: "開発部",
	},
	{
		id: 3,
		name: "佐藤一郎",
		age: 45,
		email: "sato@example.com",
		department: "人事部",
	},
	{
		id: 4,
		name: "高橋美咲",
		age: 29,
		email: "takahashi@example.com",
		department: "開発部",
	},
	{
		id: 5,
		name: "山田健太",
		age: 38,
		email: "yamada@example.com",
		department: "営業部",
	},
];

const userColumnHelper = createColumnHelper<User>();

const userColumns = [
	userColumnHelper.accessor("id", {
		header: "ID",
		cell: EditableCell,
		meta: { editable: false },
	}),
	userColumnHelper.accessor("name", {
		header: "名前",
		cell: NameCell,
	}),
	userColumnHelper.accessor("age", {
		header: "年齢",
		cell: EditableCell,
		meta: {
			editable: true,
			type: "number",
			schema: z.coerce.number().int().min(0).max(150),
		},
	}),
	userColumnHelper.accessor("email", {
		header: "メールアドレス",
		cell: EditableCell,
		meta: {
			editable: true,
			schema: z.email(),
		},
	}),
	userColumnHelper.accessor("department", {
		header: "部署",
		cell: SelectCell,
		meta: {
			editable: true,
			options: ["営業部", "開発部", "人事部", "総務部", "経理部"],
		},
	}),
];

// ─── サンプル2: 商品一覧（編集可能・選択コピー無効） ────

type Product = {
	sku: string;
	productName: string;
	price: number;
	stock: number;
	category: string;
};

const productData: Product[] = [
	{
		sku: "A-001",
		productName: "ワイヤレスマウス",
		price: 3980,
		stock: 150,
		category: "家電",
	},
	{
		sku: "A-002",
		productName: "USB-Cケーブル",
		price: 1280,
		stock: 300,
		category: "家電",
	},
	{
		sku: "B-001",
		productName: "ノート A5",
		price: 280,
		stock: 500,
		category: "文房具",
	},
	{
		sku: "B-002",
		productName: "ボールペン 3色",
		price: 180,
		stock: 800,
		category: "文房具",
	},
	{
		sku: "C-001",
		productName: "デスクライト",
		price: 5480,
		stock: 60,
		category: "家具",
	},
];

const productColumnHelper = createColumnHelper<Product>();

const productColumns = [
	productColumnHelper.accessor("sku", {
		header: "SKU",
		cell: EditableCell,
		meta: { editable: false },
	}),
	productColumnHelper.accessor("productName", {
		header: "商品名",
		cell: EditableCell,
		meta: { editable: true },
	}),
	productColumnHelper.accessor("price", {
		header: "価格",
		cell: EditableCell,
		meta: { editable: true, type: "number" },
	}),
	productColumnHelper.accessor("stock", {
		header: "在庫数",
		cell: EditableCell,
		meta: { editable: true, type: "number" },
	}),
	productColumnHelper.accessor("category", {
		header: "カテゴリ",
		cell: SelectCell,
		meta: { editable: true, options: ["家電", "文房具", "家具", "食品"] },
	}),
];

// ─── サンプル3: ログ（読み取り専用・ソート検索のみ） ────

type Log = {
	timestamp: string;
	level: string;
	message: string;
};

const logData: Log[] = [
	{ timestamp: "2026-02-10 09:00:01", level: "INFO", message: "サーバー起動" },
	{
		timestamp: "2026-02-10 09:01:23",
		level: "WARN",
		message: "メモリ使用量 80% 超過",
	},
	{
		timestamp: "2026-02-10 09:05:45",
		level: "ERROR",
		message: "DB接続タイムアウト",
	},
	{
		timestamp: "2026-02-10 09:06:00",
		level: "INFO",
		message: "DB接続リトライ成功",
	},
];

const logColumnHelper = createColumnHelper<Log>();

const logColumns = [
	logColumnHelper.accessor("timestamp", { header: "日時" }),
	logColumnHelper.accessor("level", { header: "レベル" }),
	logColumnHelper.accessor("message", { header: "メッセージ" }),
];

// ─── サンプル4: タスク一覧（初期ソート・検索付き） ──────

type Task = {
	taskId: string;
	title: string;
	status: string;
	priority: number;
	assignee: string;
};

const taskData: Task[] = [
	{
		taskId: "T-001",
		title: "ログイン画面デザイン",
		status: "完了",
		priority: 1,
		assignee: "田中",
	},
	{
		taskId: "T-002",
		title: "API認証機能実装",
		status: "進行中",
		priority: 3,
		assignee: "鈴木",
	},
	{
		taskId: "T-003",
		title: "単体テスト追加",
		status: "未着手",
		priority: 2,
		assignee: "佐藤",
	},
	{
		taskId: "T-004",
		title: "DB マイグレーション",
		status: "進行中",
		priority: 3,
		assignee: "高橋",
	},
	{
		taskId: "T-005",
		title: "CI パイプライン構築",
		status: "未着手",
		priority: 1,
		assignee: "山田",
	},
	{
		taskId: "T-006",
		title: "パフォーマンス改善",
		status: "進行中",
		priority: 2,
		assignee: "田中",
	},
];

const taskColumnHelper = createColumnHelper<Task>();

const taskColumns = [
	taskColumnHelper.accessor("taskId", { header: "タスクID" }),
	taskColumnHelper.accessor("title", { header: "タイトル" }),
	taskColumnHelper.accessor("status", { header: "ステータス" }),
	taskColumnHelper.accessor("priority", { header: "優先度" }),
	taskColumnHelper.accessor("assignee", { header: "担当者" }),
];

// ─── サンプル5: イベント一覧（DateCell・TagCell・タグ編集）

type Event = {
	id: number;
	title: string;
	date: Date;
	createdAt: Date;
	tags: string[];
};

const ALL_TAGS = [
	"式典",
	"全体",
	"ステージ",
	"音楽",
	"模擬店",
	"表彰",
] as const;

const TAG_COLORS: Record<string, string> = {
	式典: "blue",
	全体: "green",
	ステージ: "purple",
	音楽: "violet",
	模擬店: "orange",
	表彰: "amber",
};

const eventData: Event[] = [
	{
		id: 1,
		title: "開会式",
		date: new Date(2026, 10, 1),
		createdAt: new Date(2026, 8, 15, 10, 30),
		tags: ["式典", "全体"],
	},
	{
		id: 2,
		title: "ステージ発表",
		date: new Date(2026, 10, 1),
		createdAt: new Date(2026, 8, 20, 14, 0),
		tags: ["ステージ", "音楽"],
	},
	{
		id: 3,
		title: "模擬店営業",
		date: new Date(2026, 10, 2),
		createdAt: new Date(2026, 9, 1, 9, 15),
		tags: ["模擬店"],
	},
	{
		id: 4,
		title: "閉会式",
		date: new Date(2026, 10, 2),
		createdAt: new Date(2026, 9, 5, 16, 45),
		tags: ["式典", "全体", "表彰"],
	},
];

const eventColumnHelper = createColumnHelper<Event>();

const eventBaseColumns = [
	eventColumnHelper.accessor("id", { header: "ID" }),
	eventColumnHelper.accessor("title", { header: "イベント名" }),
	eventColumnHelper.accessor("date", {
		header: "開催日",
		cell: DateCell,
		meta: { dateFormat: "date" },
	}),
	eventColumnHelper.accessor("createdAt", {
		header: "登録日時",
		cell: DateCell,
		meta: { dateFormat: "datetime" },
	}),
	eventColumnHelper.accessor("tags", {
		header: "タグ",
		cell: TagCell,
		meta: { tagColors: TAG_COLORS },
	}),
];

// ─── Page ────────────────────────────────────────────────

function TableDemoPage() {
	const [users, setUsers] = useState(userData);
	const [products, setProducts] = useState(productData);
	const [events, setEvents] = useState(eventData);
	const [editingEvent, setEditingEvent] = useState<Event | null>(null);
	const [editingTags, setEditingTags] = useState<string[]>([]);

	const openTagEditor = (event: Event) => {
		setEditingEvent(event);
		setEditingTags([...event.tags]);
	};

	const saveTags = () => {
		if (!editingEvent) return;
		setEvents(prev =>
			prev.map(e =>
				e.id === editingEvent.id ? { ...e, tags: editingTags } : e
			)
		);
		setEditingEvent(null);
	};

	const eventColumns = [
		...eventBaseColumns,
		eventColumnHelper.display({
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<IconButton
					variant="ghost"
					size="1"
					onClick={() => openTagEditor(row.original)}
				>
					<IconPencil size={16} />
				</IconButton>
			),
		}),
	];

	return (
		<Box p="5">
			<Heading size="6" mb="5">
				DataTable サンプル
			</Heading>

			{/* サンプル1: ユーザー管理（フル機能） */}
			<Heading size="4" mb="3">
				ユーザー管理（フル機能）
			</Heading>
			<DataTable
				data={users}
				columns={userColumns}
				onCellEdit={(rowIndex, columnId, value) => {
					setUsers(prev =>
						prev.map((row, i) =>
							i === rowIndex ? { ...row, [columnId]: value } : row
						)
					);
				}}
			/>

			<Separator my="6" size="4" />

			{/* サンプル2: 商品一覧（編集可能・選択コピー無効） */}
			<Heading size="4" mb="3">
				商品一覧（編集可能・選択コピー無効）
			</Heading>
			<DataTable
				data={products}
				columns={productColumns}
				features={{ selection: false, copy: false }}
				onCellEdit={(rowIndex, columnId, value) => {
					setProducts(prev =>
						prev.map((row, i) =>
							i === rowIndex ? { ...row, [columnId]: value } : row
						)
					);
				}}
			/>

			<Separator my="6" size="4" />

			{/* サンプル3: ログ（読み取り専用・ソート検索のみ） */}
			<Heading size="4" mb="3">
				ログ（読み取り専用・ソート検索のみ）
			</Heading>
			<DataTable
				data={logData}
				columns={logColumns}
				features={{
					selection: false,
					copy: false,
					columnVisibility: false,
					csvExport: false,
				}}
			/>

			<Separator my="6" size="4" />

			{/* サンプル4: タスク一覧（初期ソート・検索付き） */}
			<Heading size="4" mb="3">
				タスク一覧（初期ソート・検索付き）
			</Heading>
			<DataTable
				data={taskData}
				columns={taskColumns}
				initialSorting={[{ id: "priority", desc: true }]}
				initialGlobalFilter="進行中"
				features={{ selection: false, copy: false }}
			/>

			<Separator my="6" size="4" />

			{/* サンプル5: イベント一覧（DateCell・TagCell・タグ編集） */}
			<Heading size="4" mb="3">
				イベント一覧（DateCell・TagCell・タグ編集）
			</Heading>
			<DataTable
				data={events}
				columns={eventColumns}
				features={{ selection: false, copy: false }}
			/>

			{/* タグ編集 Dialog */}
			<Dialog.Root
				open={editingEvent !== null}
				onOpenChange={open => {
					if (!open) setEditingEvent(null);
				}}
			>
				<Dialog.Content maxWidth="400px">
					<Dialog.Title>タグ編集</Dialog.Title>
					<Dialog.Description size="2" color="gray" mb="4">
						{editingEvent?.title}
					</Dialog.Description>
					<CheckboxGroup
						label="タグ"
						value={editingTags}
						onValueChange={setEditingTags}
					>
						{ALL_TAGS.map(tag => (
							<CheckboxGroupItem key={tag} value={tag}>
								{tag}
							</CheckboxGroupItem>
						))}
					</CheckboxGroup>
					<div className={styles.dialogActions}>
						<Dialog.Close>
							<Button intent="secondary">キャンセル</Button>
						</Dialog.Close>
						<Button onClick={saveTags}>保存</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</Box>
	);
}
