import { Text, Tooltip } from "@radix-ui/themes";
import {
	IconArrowsExchange,
	IconBug,
	IconHelp,
	IconLayoutSidebar,
	IconLogout,
	IconSettings,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { IconButton } from "@/components/primitives";
import { listCommitteeMemberPermissions } from "@/lib/api/committee-member";
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
	projectSelector?: ReactNode;
	projectId?: string | null;
};

const commonItems: MenuItem[] = [
	{ label: "設定", icon: <IconSettings size={18} />, to: "/settings" },
	{
		label: "説明書",
		icon: <IconHelp size={18} />,
		to: "/docs",
	},
	{
		label: "不具合報告",
		icon: <IconBug size={18} />,
		to: "https://forms.sohosai.com/support",
	},
];

function getRoleSwitchItem(
	pathname: string,
	menuItems: MenuItem[],
	isCommitteeMember: boolean
): MenuItem | null {
	// menuItems のパスからどのロールか判定（/settings 等でも正しく動作）
	const hasProjectMenu = menuItems.some(item => item.to.startsWith("/project"));
	const hasCommitteeMenu = menuItems.some(item =>
		item.to.startsWith("/committee")
	);

	if (
		pathname.startsWith("/project") ||
		(!pathname.startsWith("/committee") && hasProjectMenu)
	) {
		if (!isCommitteeMember) return null;

		return {
			label: "実委人に切り替え",
			icon: <IconArrowsExchange size={18} />,
			to: "/committee",
		};
	}
	if (
		pathname.startsWith("/committee") ||
		(!pathname.startsWith("/project") && hasCommitteeMenu)
	) {
		return {
			label: "企画人に切り替え",
			icon: <IconArrowsExchange size={18} />,
			to: "/project",
		};
	}
	return null;
}

export function Sidebar({
	collapsed,
	onToggle,
	menuItems,
	projectSelector,
}: SidebarProps) {
	const { location } = useRouterState();
	const navigate = useNavigate();
	const { committeeMember, isCommitteeMember, signOut } = useAuthStore();
	const [hasMemberEditPermission, setHasMemberEditPermission] = useState<
		boolean | null
	>(null);
	const shouldCheckMemberEdit = menuItems.some(
		item => item.to === "/committee/members"
	);

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/auth/login" });
	};

	useEffect(() => {
		if (!shouldCheckMemberEdit || !committeeMember?.id) {
			setHasMemberEditPermission(null);
			return;
		}

		let cancelled = false;

		const loadPermissions = async () => {
			try {
				const res = await listCommitteeMemberPermissions(committeeMember.id);
				if (!cancelled) {
					setHasMemberEditPermission(
						res.permissions.some(p => p.permission === "MEMBER_EDIT")
					);
				}
			} catch {
				// 判定不能な場合は現状維持で表示する
				if (!cancelled) {
					setHasMemberEditPermission(null);
				}
			}
		};

		void loadPermissions();

		return () => {
			cancelled = true;
		};
	}, [committeeMember?.id, shouldCheckMemberEdit]);

	const roleSwitchItem = getRoleSwitchItem(
		location.pathname,
		menuItems,
		isCommitteeMember
	);
	const footerItems = roleSwitchItem
		? [roleSwitchItem, ...commonItems]
		: commonItems;
	const visibleMenuItems =
		hasMemberEditPermission === false
			? menuItems.filter(item => item.to !== "/committee/members")
			: menuItems;

	const renderItem = (item: MenuItem) => {
		const active = location.pathname.startsWith(item.to);
		const external = item.to.startsWith("http");

		const inner = (
			<div className={`${styles.item} ${active ? styles.active : ""}`}>
				<span className={styles.icon}>{item.icon}</span>
				{!collapsed && <Text size="2">{item.label}</Text>}
			</div>
		);

		const content = external ? (
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

		return (
			<div key={item.to}>
				{collapsed ? (
					<Tooltip content={item.label} side="right">
						{content}
					</Tooltip>
				) : (
					content
				)}
			</div>
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
					onClick={onToggle}
					aria-label={collapsed ? "メニューを展開" : "メニューを折りたたむ"}
				>
					<IconLayoutSidebar size={18} />
				</IconButton>
				{!collapsed && (
					<Link to="/">
						<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
					</Link>
				)}
			</div>

			{projectSelector && (
				<div className={styles.projectSelector}>{projectSelector}</div>
			)}

			<nav className={styles.nav}>{visibleMenuItems.map(renderItem)}</nav>

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
