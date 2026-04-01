import { Button, Heading, Text } from "@radix-ui/themes";
import styles from "./EmptyProjectState.module.scss";

type EmptyProjectStateProps = {
	onCreateProject: () => void;
	onJoinProject: () => void;
};

export function EmptyProjectState({
	onCreateProject,
	onJoinProject,
}: EmptyProjectStateProps) {
	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<Heading size="5" className={styles.heading}>
					企画に参加していません
				</Heading>
				<Text as="p" size="2" color="gray" className={styles.description}>
					新規作成するか、企画参加コードを企画責任者から受け取って、企画に参加してください。
				</Text>
				<div className={styles.actions}>
					<Button size="3" onClick={onCreateProject}>
						新しい企画を作成
					</Button>
					<Button size="3" variant="outline" onClick={onJoinProject}>
						企画参加コードで参加
					</Button>
				</div>
			</div>
		</div>
	);
}
