import {
	IconBell,
	IconClipboardList,
	IconFileText,
	IconLayoutDashboard,
	IconMessageCircleQuestion,
	IconTable,
	IconUsers,
} from "@tabler/icons-react";
import type { MenuItem } from "./Sidebar";

export const projectMenuItems: MenuItem[] = [
	{
		label: "ダッシュボード",
		icon: <IconLayoutDashboard size={18} />,
		to: "/project/",
		exact: true,
	},
	{
		label: "申請",
		icon: <IconFileText size={18} />,
		to: "/project/forms",
	},
	{
		label: "お問い合わせ",
		icon: <IconMessageCircleQuestion size={18} />,
		to: "/project/support",
	},
	{
		label: "お知らせ",
		icon: <IconBell size={18} />,
		to: "/project/notice",
	},
	{
		label: "メンバー管理",
		icon: <IconUsers size={18} />,
		to: "/project/members",
	},
];

export const committeeMenuItems: MenuItem[] = [
	{
		label: "マスターシート",
		icon: <IconTable size={18} />,
		to: "/committee/mastersheet",
	},
	{
		label: "申請",
		icon: <IconFileText size={18} />,
		to: "/committee/forms",
	},
	{
		label: "お問い合わせ",
		icon: <IconMessageCircleQuestion size={18} />,
		to: "/committee/support",
	},
	{ label: "お知らせ", icon: <IconBell size={18} />, to: "/committee/notice" },
	{
		label: "メンバー管理",
		icon: <IconUsers size={18} />,
		to: "/committee/members",
	},
	{
		label: "企画登録管理",
		icon: <IconClipboardList size={18} />,
		to: "/committee/project-registration",
	},
];
