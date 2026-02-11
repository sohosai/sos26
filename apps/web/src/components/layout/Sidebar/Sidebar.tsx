import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import styles from "./Sidebar.module.scss";

type SidebarItem = {
	label: string;
	to: string;
};

type SidebarProps = {
	items: SidebarItem[];
	children: ReactNode;
};

export function Sidebar({ items, children }: SidebarProps) {
	return (
		<div className={styles.container}>
			<aside className={styles.sidebar}>
				<nav className={styles.nav}>
					{items.map(item => (
						<Link
							key={item.to}
							to={item.to}
							className={styles.link}
							activeProps={{ className: styles.active }}
						>
							{item.label}
						</Link>
					))}
				</nav>
			</aside>
			<main className={styles.main}>{children}</main>
		</div>
	);
}
