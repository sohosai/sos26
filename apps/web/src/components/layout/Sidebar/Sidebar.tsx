import { Text, Tooltip } from "@radix-ui/themes";
import {
	IconArrowsExchange,
	IconBug,
	IconLayoutSidebar,
	IconLogout,
	IconSettings,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { IconButton } from "@/components/primitives";
import { useAuthStore } from "@/lib/auth";
import styles from "./Sidebar.module.scss";

export type MenuItem = {
	label: string;
	icon: ReactNode;
	to: string;
	exact?: boolean;
	showNotificationDot?: boolean;
};

type SidebarProps = {
	collapsed: boolean;
	onToggle: () => void;
	menuItems: MenuItem[];
	projectSelector?: ReactNode;
	projectId?: string | null;
};

const MOBILE_BREAKPOINT = 900;

const commonItems: MenuItem[] = [
	{ label: "設定", icon: <IconSettings size={18} />, to: "/settings" },
	// 未完成のため、コメントアウト
	// {
	// 	label: "説明書",
	// 	icon: <IconHelp size={18} />,
	// 	to: "/docs",
	// },
	{
		label: "不具合報告",
		icon: <IconBug size={18} />,
		to: "/support",
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
			label: "企画者に切り替え",
			icon: <IconArrowsExchange size={18} />,
			to: "/project",
		};
	}
	return null;
}

function normalizePathname(path: string): string {
	if (path === "/") {
		return path;
	}
	return path.replace(/\/+$/, "");
}

type SidebarItemProps = {
	item: MenuItem;
	collapsed: boolean;
	pathname: string;
	onClick: () => void;
};

function SidebarItem({ item, collapsed, pathname, onClick }: SidebarItemProps) {
	const external = item.to.startsWith("http");
	const active = external
		? false
		: item.exact
			? normalizePathname(pathname) === normalizePathname(item.to)
			: pathname.startsWith(item.to);
	const linkAriaLabel = item.showNotificationDot
		? `${item.label} (has notifications)`
		: item.label;

	const itemInner = (
		<div className={`${styles.item} ${active ? styles.active : ""}`}>
			<span className={styles.icon}>
				{item.icon}
				{item.showNotificationDot && (
					<span className={styles.notificationDot} aria-hidden="true" />
				)}
			</span>
			{!collapsed && <Text size="2">{item.label}</Text>}
		</div>
	);

	const itemContent = external ? (
		<a
			key={item.to}
			href={item.to}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.link}
			aria-label={linkAriaLabel}
			onClick={onClick}
		>
			{itemInner}
		</a>
	) : (
		<Link
			key={item.to}
			to={item.to}
			className={styles.link}
			aria-label={linkAriaLabel}
			onClick={onClick}
		>
			{itemInner}
		</Link>
	);

	return (
		<div key={item.to}>
			{collapsed ? (
				<Tooltip content={item.label} side="right">
					{itemContent}
				</Tooltip>
			) : (
				itemContent
			)}
		</div>
	);
}

type MobileToggleProps = {
	isMobile: boolean;
	mobileOpen: boolean;
	onToggle: () => void;
	onClose: () => void;
};

function MobileToggle({
	isMobile,
	mobileOpen,
	onToggle,
	onClose,
}: MobileToggleProps) {
	if (!isMobile) {
		return null;
	}

	return (
		<>
			{!mobileOpen && (
				<div className={styles.mobileToggleShell}>
					<IconButton
						className={styles.mobileToggle}
						onClick={onToggle}
						aria-label="メニューを開く"
					>
						<IconLayoutSidebar size={20} />
					</IconButton>
				</div>
			)}

			{mobileOpen && (
				<button
					type="button"
					className={styles.backdrop}
					onClick={onClose}
					aria-label="サイドバーを閉じる"
				/>
			)}
		</>
	);
}

export function Sidebar({
	collapsed,
	onToggle,
	menuItems,
	projectSelector,
}: SidebarProps) {
	const { location } = useRouterState();
	const pathname = location.pathname;
	const navigate = useNavigate();
	const [isMobile, setIsMobile] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
	});
	const [mobileOpen, setMobileOpen] = useState(false);
	const {
		isCommitteeMember,
		hasMemberEditPermission,
		hasProjectRegistrationPermission,
		signOut,
	} = useAuthStore();
	const shouldCheckMemberEdit = menuItems.some(
		item => item.to === "/committee/members"
	);
	const shouldCheckProjectRegistration = menuItems.some(
		item => item.to === "/committee/project-registration"
	);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
		const handleMediaChange = () => {
			setIsMobile(mediaQuery.matches);
		};

		handleMediaChange();

		mediaQuery.addEventListener("change", handleMediaChange);
		return () => mediaQuery.removeEventListener("change", handleMediaChange);
	}, []);

	useEffect(() => {
		if (isMobile) {
			setMobileOpen(false);
		}
	}, [isMobile]);

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/auth/login" });
	};

	const closeMobileSidebar = () => {
		if (isMobile) {
			setMobileOpen(false);
		}
	};

	const toggleSidebar = () => {
		if (isMobile) {
			setMobileOpen(prev => !prev);
			return;
		}
		onToggle();
	};

	const roleSwitchItem = getRoleSwitchItem(
		pathname,
		menuItems,
		isCommitteeMember
	);
	const footerItems = roleSwitchItem
		? [roleSwitchItem, ...commonItems]
		: commonItems;
	const visibleMenuItems = menuItems.filter(item => {
		if (
			shouldCheckMemberEdit &&
			hasMemberEditPermission !== true &&
			item.to === "/committee/members"
		) {
			return false;
		}
		if (
			shouldCheckProjectRegistration &&
			hasProjectRegistrationPermission !== true &&
			item.to === "/committee/project-registration"
		) {
			return false;
		}
		return true;
	});
	const sidebarCollapsed = !isMobile && collapsed;

	const logoutButton = (
		<button
			type="button"
			className={styles.link}
			onClick={async () => {
				closeMobileSidebar();
				await handleSignOut();
			}}
		>
			<div className={styles.item}>
				<span className={styles.icon}>
					<IconLogout size={18} />
				</span>
				{!sidebarCollapsed && <Text size="2">ログアウト</Text>}
			</div>
		</button>
	);

	return (
		<>
			<MobileToggle
				isMobile={isMobile}
				mobileOpen={mobileOpen}
				onToggle={toggleSidebar}
				onClose={closeMobileSidebar}
			/>

			<aside
				id="global-sidebar"
				className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ""} ${isMobile ? styles.mobile : ""} ${mobileOpen ? styles.mobileOpen : ""}`}
			>
				<div className={styles.header}>
					<IconButton
						onClick={toggleSidebar}
						aria-label={
							sidebarCollapsed || !mobileOpen
								? "メニューを展開"
								: "メニューを折りたたむ"
						}
					>
						<IconLayoutSidebar size={18} />
					</IconButton>
					{!sidebarCollapsed && (
						<Link to="/" onClick={closeMobileSidebar}>
							<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
						</Link>
					)}
				</div>

				{projectSelector && (
					<div className={styles.projectSelector}>{projectSelector}</div>
				)}

				<nav className={styles.nav}>
					{visibleMenuItems.map(item => (
						<SidebarItem
							key={item.to}
							item={item}
							collapsed={sidebarCollapsed}
							pathname={pathname}
							onClick={closeMobileSidebar}
						/>
					))}
				</nav>

				<div className={styles.footer}>
					{footerItems.map(item => (
						<SidebarItem
							key={item.to}
							item={item}
							collapsed={sidebarCollapsed}
							pathname={pathname}
							onClick={closeMobileSidebar}
						/>
					))}
					{sidebarCollapsed ? (
						<Tooltip content="ログアウト" side="right">
							{logoutButton}
						</Tooltip>
					) : (
						logoutButton
					)}
				</div>
			</aside>
		</>
	);
}
