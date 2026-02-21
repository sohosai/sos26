import {
	IconBell,
	IconFileText,
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
	{ label: "お知らせ", icon: <IconBell size={18} />, to: "/committee/notice" },
];
