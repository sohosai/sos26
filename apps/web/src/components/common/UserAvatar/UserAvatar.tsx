import BoringAvatar from "boring-avatars";
import { useStorageUrl } from "@/lib/storage";
import styles from "./UserAvatar.module.scss";

const BUREAU_COLORS: Record<string, string> = {
	EXECUTIVE_BOARD: "#e07798",
	FINANCE: "#fbe983",
	GENERAL_AFFAIRS: "#16a765",
	PUBLIC_RELATIONS: "#ffad46",
	EXTERNAL: "#3c78d8",
	PROMOTION: "#16a765",
	PLANNING: "#16a765",
	STAGE_MANAGEMENT: "#a479e2",
	HQ_PLANNING: "#16a765",
	INFO_SYSTEM: "#3c78d8",
};

export type UserAvatarRole = "project" | "committee";

type UserAvatarProps = {
	name: string;
	avatarFileId?: string | null;
	size?: number;
	role?: UserAvatarRole;
	bureau?: string | null;
};

export function UserAvatar({
	name,
	avatarFileId,
	size = 28,
	role,
	bureau,
}: UserAvatarProps) {
	const url = useStorageUrl(avatarFileId ?? "", true);

	const ringColor =
		role === "committee" && bureau ? BUREAU_COLORS[bureau] : undefined;
	const dynamicStyle = ringColor
		? { boxShadow: `0 0 0 2px ${ringColor}` }
		: undefined;

	if (avatarFileId && url) {
		return (
			<img
				src={url}
				alt={name}
				width={size}
				height={size}
				className={`${styles.image} ${ringColor ? styles.withRing : ""}`}
				style={{ width: size, height: size, ...dynamicStyle }}
			/>
		);
	}

	return (
		<div
			className={`${styles.fallbackContainer} ${ringColor ? styles.withRing : ""}`}
			style={{ width: size, height: size, ...dynamicStyle }}
		>
			<BoringAvatar size={size} name={name} variant="beam" />
		</div>
	);
}
