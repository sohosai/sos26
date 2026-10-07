import pLimit from "p-limit";
import sharp from "sharp";
import { deleteObject, getObject, putObject } from "./presign";

/**
 * 指定できる幅の候補
 *
 * 任意の幅を受け付けると、認証なしのリクエストで変換と保存を際限なく発生させられるため、
 * 段階を固定する。
 */
export const IMAGE_RESIZE_WIDTHS = ["160", "320", "640", "1280"] as const;
export type ImageResizeWidth = (typeof IMAGE_RESIZE_WIDTHS)[number];

const RESIZED_IMAGE_MIME_TYPE = "image/webp";

/**
 * 変換する元画像の上限
 *
 * 元画像はメモリに載せて展開するため、小さなファイルでも巨大な画素数に展開される画像で
 * メモリを使い切られないよう、ファイルサイズと画素数の両方で制限する。
 * 画素数はスマートフォンの 48MP 撮影を通す値にしている。
 */
const MAX_INPUT_BYTES = 30_000_000;
const MAX_INPUT_PIXELS = 50_000_000;

// MIME タイプはアップロード時の申告値でしかないため、実際の中身の形式で判定する
const RESIZABLE_FORMATS: ReadonlySet<string> = new Set([
	"jpeg",
	"png",
	"gif",
	"webp",
]);

type ImageBody = ReadableStream | Uint8Array<ArrayBuffer>;

export type Image = { body: ImageBody; contentType: string };
export type OriginalImage = { key: string; mimeType: string; size: number };

// libvips は1回の変換で全コアを使うため、pLimit で並列数を絞っても API 全体の CPU を奪ってしまう
sharp.concurrency(1);

// 変換は CPU を占有するため、未変換の画像にリクエストが集中しても API 全体が詰まらないようにする
const limit = pLimit(2);
const inFlight = new Map<string, Promise<Image | null>>();

/**
 * 縮小できなかった画像の fileId
 *
 * 失敗は S3 に残らないため、覚えておかないとリクエストのたびに元画像の取得と展開をやり直してしまう。
 * 縮小できるかは幅によらず画像で決まり、ファイルの中身は変わらないため、プロセスが続く限り保持する。
 */
const unresizableFileIds = new Set<string>();

function resizedKey(fileId: string, width: ImageResizeWidth): string {
	return `resized/${fileId}/w${width}.webp`;
}

function isNoSuchKey(error: unknown): boolean {
	return error instanceof Error && error.name === "NoSuchKey";
}

async function getObjectOrNull(key: string) {
	try {
		return await getObject(key);
	} catch (error) {
		if (isNoSuchKey(error)) return null;
		throw error;
	}
}

async function getObjectStream(key: string): Promise<ImageBody | null> {
	const res = await getObjectOrNull(key);
	// AWS SDK の ReadableStream 型は DOM 型なしでは Response のボディ型と一致しないため変換する
	return (res?.Body?.transformToWebStream() ?? null) as ReadableStream | null;
}

/** 縮小できない画像なら null を返す */
async function resize(
	input: Uint8Array,
	width: ImageResizeWidth
): Promise<Uint8Array<ArrayBuffer> | null> {
	const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
	try {
		const { format } = await image.metadata();
		if (!format || !RESIZABLE_FORMATS.has(format)) return null;

		const resized = await image
			// スマートフォンで撮影した写真は EXIF の向き情報で回転させないと横倒しになる
			.rotate()
			.resize({ width: Number(width), withoutEnlargement: true })
			.webp({ quality: 80 })
			.toBuffer();
		return new Uint8Array(resized);
	} catch {
		return null;
	}
}

async function resizeAndStore(
	fileId: string,
	original: OriginalImage,
	width: ImageResizeWidth
): Promise<Image | null> {
	const res = await getObjectOrNull(original.key);
	const input = await res?.Body?.transformToByteArray();
	if (!input) return null;

	const output = await resize(input, width);
	if (!output) {
		unresizableFileIds.add(fileId);
		return { body: new Uint8Array(input), contentType: original.mimeType };
	}

	const key = resizedKey(fileId, width);
	// 保存に失敗しても変換結果は返せるため、次回のリクエストで再変換させる
	await putObject(key, output, RESIZED_IMAGE_MIME_TYPE).catch(error => {
		console.error(
			`[image-resize] 変換済み画像の保存に失敗しました: ${key}`,
			error
		);
	});
	return { body: output, contentType: RESIZED_IMAGE_MIME_TYPE };
}

/**
 * 変換済みの画像があればそれを返し、なければ元画像を変換・保存して返す。
 * 縮小できない画像（巨大・非対応形式など）は元画像をそのまま返す。
 * 元画像が見つからなければ null を返す。
 *
 * 変換済みの画像があるときは DB を引かずに返せるよう、元画像の情報は関数で受け取る。
 */
export async function getResizedImage(
	fileId: string,
	width: ImageResizeWidth,
	findOriginal: () => Promise<OriginalImage | null>
): Promise<Image | null> {
	const key = resizedKey(fileId, width);
	const resizable = !unresizableFileIds.has(fileId);
	if (resizable) {
		const cached = await getObjectStream(key);
		if (cached) return { body: cached, contentType: RESIZED_IMAGE_MIME_TYPE };
	}

	const original = await findOriginal();
	if (!original) return null;
	// 元画像を取得する前に弾き、巨大なファイルをメモリに載せない
	if (!resizable || original.size > MAX_INPUT_BYTES) {
		return getOriginalImage(original);
	}

	let task = inFlight.get(key);
	if (!task) {
		task = limit(() => resizeAndStore(fileId, original, width)).finally(() =>
			inFlight.delete(key)
		);
		inFlight.set(key, task);
	}
	return task;
}

/** 元画像をそのまま返す。S3 上に見つからなければ null を返す。 */
export async function getOriginalImage(
	original: OriginalImage
): Promise<Image | null> {
	const body = await getObjectStream(original.key);
	return body && { body, contentType: original.mimeType };
}

/**
 * 変換済みの画像を S3 から削除する。
 *
 * 変換済みの画像は元画像から作り直せるため、削除に失敗しても呼び出し元の処理は止めない。
 */
export async function deleteResizedImages(fileIds: string[]): Promise<void> {
	const keys = fileIds.flatMap(fileId =>
		IMAGE_RESIZE_WIDTHS.map(width => resizedKey(fileId, width))
	);
	const results = await Promise.allSettled(keys.map(key => deleteObject(key)));
	results.forEach((result, i) => {
		if (result.status === "rejected") {
			console.error(
				`[image-resize] 変換済み画像の削除に失敗しました: ${keys[i]}`,
				result.reason
			);
		}
	});
}
