import { type Bureau, bureauLabelMap } from "@sos26/shared";
import BoringAvatar from "boring-avatars";
import { useStorageUrl } from "@/lib/storage";
import styles from "./UserAvatar.module.scss";

const BUREAU_COLORS: Record<Bureau, string> = {
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
	bureau?: Bureau | string | null;
};

export function UserAvatar({
	name,
	avatarFileId,
	size = 28,
	role,
	bureau,
}: UserAvatarProps) {
	const url = useStorageUrl(avatarFileId ?? "", true);

	let validBureau: Bureau | undefined;
	if (bureau) {
		if (bureau in BUREAU_COLORS) {
			validBureau = bureau as Bureau;
		} else {
			const entry = Object.entries(bureauLabelMap).find(
				([_, label]) => label === bureau
			);
			if (entry) {
				validBureau = entry[0] as Bureau;
			}
		}
	}

	const ringColor =
		role === "committee" && validBureau
			? BUREAU_COLORS[validBureau]
			: undefined;

	return (
		<span
			className={`${styles.avatarWrapper} ${ringColor ? styles.withRing : ""}`}
			style={
				{
					width: size,
					height: size,
					...(ringColor ? { "--ring-color": ringColor } : {}),
				} as React.CSSProperties
			}
		>
			{avatarFileId && url ? (
				<img
					src={url}
					alt={name}
					width={size}
					height={size}
					className={styles.image}
				/>
			) : (
				<div className={styles.fallbackContainer}>
					<BoringAvatar size={size} name={name} variant="beam" />
				</div>
			)}
		</span>
	);
}
