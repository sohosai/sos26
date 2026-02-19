import { Badge, Dialog, Text } from "@radix-ui/themes";
import type {
	GetNoticeStatusResponse,
	NoticeAuthorizationStatus,
} from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/primitives";
import { getNoticeStatus } from "@/lib/api/committee-notice";
import styles from "./DeliveryStatusDialog.module.scss";

type Delivery = GetNoticeStatusResponse["deliveries"][number];

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	noticeId: string;
};

export function DeliveryStatusDialog({ open, onOpenChange, noticeId }: Props) {
	const [deliveries, setDeliveries] = useState<Delivery[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setIsLoading(true);
		setError(null);
		getNoticeStatus(noticeId)
			.then(res => {
				if (!cancelled) setDeliveries(res.deliveries);
			})
			.catch(() => {
				if (!cancelled) setError("配信状況の取得に失敗しました。");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, noticeId]);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="520px">
				<div className={styles.header}>
					<Dialog.Title mb="0">配信状況</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="4" color="gray">
					企画ごとのお知らせ既読状況を表示しています。
				</Dialog.Description>

				{isLoading ? (
					<Text size="2" color="gray">
						読み込み中...
					</Text>
				) : error ? (
					<Text size="2" color="red">
						{error}
					</Text>
				) : deliveries.length === 0 ? (
					<Text size="2" color="gray">
						配信先がありません。
					</Text>
				) : (
					<div className={styles.list}>
						{deliveries.map(d => (
							<div key={d.id} className={styles.deliveryRow}>
								<div className={styles.projectInfo}>
									<Text size="2" weight="medium">
										{d.project.name}
									</Text>
									<StatusBadge status={d.authorization.status} />
								</div>
								<div className={styles.readRate}>
									<Text size="2" color="gray">
										既読: {d.readCount} / {d.memberCount}
									</Text>
									<ReadRateBar
										readCount={d.readCount}
										memberCount={d.memberCount}
									/>
								</div>
							</div>
						))}
					</div>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}

function StatusBadge({ status }: { status: NoticeAuthorizationStatus }) {
	switch (status) {
		case "APPROVED":
			return (
				<Badge variant="soft" size="1" color="green">
					承認済み
				</Badge>
			);
		case "PENDING":
			return (
				<Badge variant="soft" size="1" color="orange">
					承認待ち
				</Badge>
			);
		case "REJECTED":
			return (
				<Badge variant="soft" size="1" color="red">
					却下
				</Badge>
			);
	}
}

function ReadRateBar({
	readCount,
	memberCount,
}: {
	readCount: number;
	memberCount: number;
}) {
	const rate = memberCount > 0 ? (readCount / memberCount) * 100 : 0;
	return (
		<div className={styles.rateBar}>
			<div className={styles.rateFill} style={{ width: `${rate}%` }} />
		</div>
	);
}
