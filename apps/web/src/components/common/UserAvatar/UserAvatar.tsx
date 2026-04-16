import BoringAvatar from "boring-avatars";
import { useStorageUrl } from "@/lib/storage";
import styles from "./UserAvatar.module.scss";

type UserAvatarProps = {
	name: string;
	avatarFileId?: string | null;
	size?: number;
};

export function UserAvatar({ name, avatarFileId, size = 28 }: UserAvatarProps) {
	const url = useStorageUrl(avatarFileId ?? "", true);

	if (avatarFileId && url) {
		return (
			<img
				src={url}
				alt={name}
				width={size}
				height={size}
				className={styles.image}
				style={{ width: size, height: size }}
			/>
		);
	}

	return <BoringAvatar size={size} name={name} variant="beam" />;
}
