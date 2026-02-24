import {
	IconBell,
	IconFileText,
	IconMessageCircleQuestion,
	IconTable,
	IconUsers,
} from "@tabler/icons-react";
import type { MenuItem } from "./Sidebar";

export const projectMenuItems: MenuItem[] = [
	{
		label: "メンバー管理",
		icon: <IconUsers size={18} />,
		to: "/project/members",
	},
	{
		label: "フォーム",
		icon: <IconFileText size={18} />,
		to: "/project/forms",
	},
	{
		label: "問い合わせ",
		icon: <IconMessageCircleQuestion size={18} />,
		to: "/project/support",
	},
	{
		label: "お知らせ",
		icon: <IconBell size={18} />,
		to: "/project/notice",
	},
];

export const committeeMenuItems: MenuItem[] = [
	{
		label: "メンバー管理",
		icon: <IconUsers size={18} />,
		to: "/committee/members",
	},
	{
		label: "マスターシート",
		icon: <IconTable size={18} />,
		to: "/committee/mastersheet",
	},
	{
		label: "フォーム",
		icon: <IconFileText size={18} />,
		to: "/committee/forms",
	},
	{
		label: "問い合わせ",
		icon: <IconMessageCircleQuestion size={18} />,
		to: "/committee/support",
	},
	{ label: "お知らせ", icon: <IconBell size={18} />, to: "/committee/notice" },
];
