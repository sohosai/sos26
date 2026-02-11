import { IconButton, Text, Tooltip } from "@radix-ui/themes";
import {
	IconArrowsExchange,
	IconBug,
	IconHelp,
	IconLayoutSidebar,
	IconLogout,
	IconSettings,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuthStore } from "@/lib/auth";
import styles from "./Sidebar.module.scss";

export type MenuItem = {
	label: string;
	icon: ReactNode;
	to: string;
};

type SidebarProps = {
	collapsed: boolean;
	onToggle: () => void;
	menuItems: MenuItem[];
};

const commonItems: MenuItem[] = [
	{ label: "設定", icon: <IconSettings size={18} />, to: "/settings" },
	{
		label: "説明書",
		icon: <IconHelp size={18} />,
		to: "https://docs.sohosai.com",
	},
	{
		label: "不具合報告",
		icon: <IconBug size={18} />,
		to: "https://forms.sohosai.com/support",
	},
];

function getRoleSwitchItem(pathname: string): MenuItem | null {
	if (pathname.startsWith("/project")) {
		return {
			label: "実委人に切り替え",
			icon: <IconArrowsExchange size={18} />,
			to: "/committee",
		};
	}
	if (pathname.startsWith("/committee")) {
		return {
			label: "企画人に切り替え",
			icon: <IconArrowsExchange size={18} />,
			to: "/project",
		};
	}
	return null;
}

export function Sidebar({ collapsed, onToggle, menuItems }: SidebarProps) {
	const { location } = useRouterState();
	const navigate = useNavigate();
	const { signOut } = useAuthStore();

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/auth/login" });
	};

	const roleSwitchItem = getRoleSwitchItem(location.pathname);
	const footerItems = roleSwitchItem
		? [...commonItems, roleSwitchItem]
		: commonItems;

	const renderItem = (item: MenuItem) => {
		const active = location.pathname.startsWith(item.to);
		const external = item.to.startsWith("http");

		const inner = (
			<div className={`${styles.item} ${active ? styles.active : ""}`}>
				<span className={styles.icon}>{item.icon}</span>
				{!collapsed && <Text size="2">{item.label}</Text>}
			</div>
		);

		const el = external ? (
			<a
				key={item.to}
				href={item.to}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.link}
			>
				{inner}
			</a>
		) : (
			<Link key={item.to} to={item.to} className={styles.link}>
				{inner}
			</Link>
		);

		return collapsed ? (
			<Tooltip key={item.to} content={item.label} side="right">
				{el}
			</Tooltip>
		) : (
			el
		);
	};

	const logoutButton = (
		<button type="button" className={styles.link} onClick={handleSignOut}>
			<div className={styles.item}>
				<span className={styles.icon}>
					<IconLogout size={18} />
				</span>
				{!collapsed && <Text size="2">ログアウト</Text>}
			</div>
		</button>
	);

	return (
		<aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
			<div className={styles.header}>
				<IconButton
					variant="ghost"
					size="2"
					onClick={onToggle}
					aria-label={collapsed ? "メニューを展開" : "メニューを折りたたむ"}
				>
					<IconLayoutSidebar size={18} />
				</IconButton>
				{!collapsed && (
					<Link to="/">
						<img
							src="/sos.svg"
							alt="雙峰祭オンラインシステム"
							className={styles.logo}
						/>
					</Link>
				)}
			</div>

			<nav className={styles.nav}>{menuItems.map(renderItem)}</nav>

			<div className={styles.footer}>
				{footerItems.map(renderItem)}
				{collapsed ? (
					<Tooltip content="ログアウト" side="right">
						{logoutButton}
					</Tooltip>
				) : (
					logoutButton
				)}
			</div>
		</aside>
	);
}
