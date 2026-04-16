import { TextField as RadixTextField, Text } from "@radix-ui/themes";
import type { UserSummary } from "@sos26/shared";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { searchUsers } from "@/lib/api/user";
import styles from "./UserSearchSelect.module.scss";

type UserSearchSelectProps = {
	label: string;
	selected: UserSummary[];
	onSelect: (user: UserSummary) => void;
	onRemove: (userId: string) => void;
	required?: boolean;
	/** 検索結果から除外するユーザーID（既に委員であるユーザーなど） */
	excludeIds?: string[];
};

export function UserSearchSelect({
	label,
	selected,
	onSelect,
	onRemove,
	required,
	excludeIds,
}: UserSearchSelectProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<UserSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const doSearch = useCallback(async (search: string) => {
		if (search.length === 0) {
			setResults([]);
			return;
		}
		setLoading(true);
		try {
			const data = await searchUsers({ search, limit: 10 });
			setResults(data.users);
		} catch {
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		clearTimeout(debounceRef.current);
		if (query.trim().length === 0) {
			setResults([]);
			return;
		}
		debounceRef.current = setTimeout(() => {
			doSearch(query.trim());
		}, 300);
		return () => clearTimeout(debounceRef.current);
	}, [query, doSearch]);

	const selectedIds = new Set(selected.map(u => u.id));
	const excludeSet = new Set(excludeIds ?? []);

	const handleSelect = (user: UserSummary) => {
		if (selectedIds.has(user.id)) return;
		onSelect(user);
	};

	return (
		<div className={styles.container}>
			<Text as="label" size="2" weight="medium">
				{label}
				{required && <span aria-hidden="true"></span>}
			</Text>

			{selected.length > 0 && (
				<div className={styles.selectedUsers}>
					{selected.map(user => (
						<button
							key={user.id}
							type="button"
							className={styles.selectedChip}
							onClick={() => onRemove(user.id)}
						>
							<UserAvatar
								size={16}
								name={user.name}
								avatarFileId={user.avatarFileId}
							/>
							{user.name}
							<IconX size={12} />
						</button>
					))}
				</div>
			)}

			<div className={styles.search}>
				<RadixTextField.Root
					placeholder="名前・メールアドレスで検索..."
					aria-label="ユーザーを検索"
					size="2"
					value={query}
					onChange={e => setQuery(e.target.value)}
				>
					<RadixTextField.Slot>
						<IconSearch size={16} />
					</RadixTextField.Slot>
				</RadixTextField.Root>
			</div>

			<div className={styles.list}>
				{query.trim().length === 0 ? (
					<Text size="2" color="gray" className={styles.empty}>
						名前やメールアドレスを入力して検索
					</Text>
				) : loading ? (
					<Text size="2" color="gray" className={styles.empty}>
						検索中...
					</Text>
				) : results.length === 0 ? (
					<Text size="2" color="gray" className={styles.empty}>
						該当するユーザーが見つかりません
					</Text>
				) : (
					results
						.filter(user => !excludeSet.has(user.id))
						.map(user => (
							<button
								key={user.id}
								type="button"
								className={`${styles.userRow} ${selectedIds.has(user.id) ? styles.selected : ""}`}
								onClick={() => handleSelect(user)}
								disabled={selectedIds.has(user.id)}
							>
								<UserAvatar
									size={28}
									name={user.name}
									avatarFileId={user.avatarFileId}
								/>
								<div className={styles.userInfo}>
									<Text size="2" weight="medium">
										{user.name}
									</Text>
									<Text size="1" color="gray">
										{user.email}
									</Text>
								</div>
							</button>
						))
				)}
			</div>
		</div>
	);
}
