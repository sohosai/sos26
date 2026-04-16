import { Link as RadixLink, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import styles from "./Header.module.scss";

export function Header() {
	return (
		<header className={styles.header}>
			<div className={styles.logo}>
				<Link to="/">
					<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
				</Link>
			</div>
			<nav className={styles.nav}>
				{/* 未完成のため、コメントアウト */}
				{/* <RadixLink asChild>
					<Link to="/docs">
						<Text size="2">説明書</Text>
					</Link>
				</RadixLink> */}
				<RadixLink asChild>
					<Link to="/support">
						<Text size="2">不具合報告</Text>
					</Link>
				</RadixLink>
			</nav>
		</header>
	);
}
