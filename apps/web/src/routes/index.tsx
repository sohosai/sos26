import { Heading } from "@radix-ui/themes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/primitives";
import { useAuthStore } from "@/lib/auth";
import styles from "./index.module.scss";

export const Route = createFileRoute("/")({
	component: Index,
	head: () => ({
		meta: [
			{
				title: "雙峰祭オンラインシステム",
			},
			{
				name: "description",
				content: "Sohosai Online System",
			},
		],
	}),
});

function Index() {
	const { signOut, isLoggedIn, user } = useAuthStore();

	return (
		<div className={styles.container}>
			{isLoggedIn ? (
				<>
					<Heading size="6">
						Welcome, {user?.lastName} {user?.firstName}
					</Heading>
					<Button onClick={signOut}>ログアウト</Button>
				</>
			) : (
				<>
					<Heading size="6">Please log in to continue.</Heading>
					<Link to="/auth/login">
						<Button>ログイン</Button>
					</Link>
				</>
			)}
		</div>
	);
}
