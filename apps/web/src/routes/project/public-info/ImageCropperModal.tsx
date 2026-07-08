import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useRef, useState } from "react";
import ReactCrop, {
	type Crop,
	centerCrop,
	makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

function centerAspectCrop(
	mediaWidth: number,
	mediaHeight: number,
	aspect: number
) {
	return centerCrop(
		makeAspectCrop(
			{
				unit: "%",
				width: 90,
			},
			aspect,
			mediaWidth,
			mediaHeight
		),
		mediaWidth,
		mediaHeight
	);
}

type Props = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	imageSrc: string;
	onCropComplete: (blob: Blob) => void;
};

export function ImageCropperModal({
	isOpen,
	onOpenChange,
	imageSrc,
	onCropComplete,
}: Props) {
	const [crop, setCrop] = useState<Crop>();
	const imgRef = useRef<HTMLImageElement>(null);

	const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const { width, height } = e.currentTarget;
		setCrop(centerAspectCrop(width, height, 1));
	};

	const handleComplete = async () => {
		if (!imgRef.current || !crop) {
			onOpenChange(false);
			return;
		}

		const image = imgRef.current;
		const canvas = document.createElement("canvas");

		// crop は % 単位（0〜100）なので、表示ピクセルに変換してから自然サイズへスケール
		const displayWidth = image.width;
		const displayHeight = image.height;
		const scaleX = image.naturalWidth / displayWidth;
		const scaleY = image.naturalHeight / displayHeight;

		const cropXPx = (crop.x / 100) * displayWidth;
		const cropYPx = (crop.y / 100) * displayHeight;
		const cropWidthPx = (crop.width / 100) * displayWidth;
		const cropHeightPx = (crop.height / 100) * displayHeight;

		// canvas は自然解像度で出力
		const outputWidth = cropWidthPx * scaleX;
		const outputHeight = cropHeightPx * scaleY;
		canvas.width = outputWidth;
		canvas.height = outputHeight;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// 円形クリッピング
		ctx.beginPath();
		ctx.arc(
			outputWidth / 2,
			outputHeight / 2,
			Math.min(outputWidth, outputHeight) / 2,
			0,
			Math.PI * 2
		);
		ctx.closePath();
		ctx.clip();

		ctx.drawImage(
			image,
			cropXPx * scaleX,
			cropYPx * scaleY,
			outputWidth,
			outputHeight,
			0,
			0,
			outputWidth,
			outputHeight
		);

		canvas.toBlob(blob => {
			if (blob) {
				onCropComplete(blob);
			}
			onOpenChange(false);
		}, "image/png");
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Content style={{ maxWidth: 450 }}>
				<Dialog.Title>アイコンのトリミング</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					画像を円形にトリミングして設定します。
				</Dialog.Description>

				<Flex direction="column" gap="4" align="center">
					{imageSrc && (
						<ReactCrop
							crop={crop}
							onChange={(_, percentCrop) => setCrop(percentCrop)}
							aspect={1}
							circularCrop
						>
							{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Handled by ReactCrop */}
							<img
								ref={imgRef}
								src={imageSrc}
								onLoad={onImageLoad}
								style={{ maxHeight: "60vh", objectFit: "contain" }}
								alt="Crop me"
							/>
						</ReactCrop>
					)}
					<Flex gap="3" justify="end" width="100%">
						<Button
							variant="soft"
							color="gray"
							onClick={() => onOpenChange(false)}
						>
							キャンセル
						</Button>
						<Button onClick={handleComplete}>確定する</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
