import { Link } from "@tanstack/react-router";
import styles from "./Header.module.scss";

export function Header() {
	return (
		<header className={styles.header}>
			<Link to="/" className={styles.logo}>
				sos26
			</Link>
		</header>
	);
}
