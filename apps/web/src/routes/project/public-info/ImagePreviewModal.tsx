import { Dialog, Flex } from "@radix-ui/themes";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/primitives";
import { getFileContentUrl } from "@/lib/api/files";
import styles from "./route.module.scss";

type Props = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	fileIds: string[];
	currentIndex: number;
	onChangeIndex: (index: number) => void;
};

export function ImagePreviewModal({
	isOpen,
	onOpenChange,
	fileIds,
	currentIndex,
	onChangeIndex,
}: Props) {
	const total = fileIds.length;
	const hasPrev = currentIndex > 0;
	const hasNext = currentIndex < total - 1;

	// キーボードナビ
	useEffect(() => {
		if (!isOpen) return;
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" && hasPrev) {
				onChangeIndex(currentIndex - 1);
			} else if (e.key === "ArrowRight" && hasNext) {
				onChangeIndex(currentIndex + 1);
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [isOpen, currentIndex, hasPrev, hasNext, onChangeIndex]);

	if (!fileIds.length) return null;

	return (
		<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Content
				className={styles.previewModalContent}
				aria-label="画像プレビュー"
			>
				{/* 閉じるボタン */}
				<button
					type="button"
					className={styles.previewCloseBtn}
					onClick={() => onOpenChange(false)}
					aria-label="閉じる"
				>
					<IconX size={20} />
				</button>

				{/* 画像 */}
				<div className={styles.previewImageWrap}>
					<img
						key={fileIds[currentIndex] ?? ""}
						src={getFileContentUrl(fileIds[currentIndex] ?? "")}
						alt={`Map ${currentIndex + 1}`}
						className={styles.previewImage}
					/>
				</div>

				{/* ナビ */}
				<Flex
					align="center"
					justify="between"
					gap="3"
					className={styles.previewNav}
				>
					<Button
						intent="secondary"
						disabled={!hasPrev}
						onClick={() => onChangeIndex(currentIndex - 1)}
					>
						<IconChevronLeft size={16} />
						前へ
					</Button>
					<span className={styles.previewCounter}>
						{currentIndex + 1} / {total}
					</span>
					<Button
						intent="secondary"
						disabled={!hasNext}
						onClick={() => onChangeIndex(currentIndex + 1)}
					>
						次へ
						<IconChevronRight size={16} />
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
