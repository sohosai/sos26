import pLimit from "p-limit";
import sharp from "sharp";
import { Errors } from "../error";
import { getObject, putObject } from "./presign";

/**
 * 指定できる幅の候補
 *
 * 任意の幅を受け付けると、認証なしのリクエストで変換と保存を際限なく発生させられるため、
 * 段階を固定する。
 */
export const IMAGE_RESIZE_WIDTHS = ["160", "320", "640", "1280"] as const;
export type ImageResizeWidth = (typeof IMAGE_RESIZE_WIDTHS)[number];

export const RESIZED_IMAGE_MIME_TYPE = "image/webp";

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

export type OriginalImage = { key: string; size: number };

// libvips は1回の変換で全コアを使うため、pLimit で並列数を絞っても API 全体の CPU を奪ってしまう
sharp.concurrency(1);

// 変換は CPU を占有するため、未変換の画像にリクエストが集中しても API 全体が詰まらないようにする
const limit = pLimit(2);
const inFlight = new Map<string, Promise<Uint8Array<ArrayBuffer> | null>>();

function resizedKey(fileId: string, width: ImageResizeWidth): string {
	return `resized/${fileId}/w${width}.webp`;
}

function unresizable() {
	return Errors.invalidRequest("この画像は縮小できません");
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

async function resize(
	input: Uint8Array,
	width: ImageResizeWidth
): Promise<Uint8Array<ArrayBuffer>> {
	const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
	const { format } = await image.metadata().catch(() => {
		throw unresizable();
	});
	if (!format || !RESIZABLE_FORMATS.has(format)) throw unresizable();

	const resized = await image
		// スマートフォンで撮影した写真は EXIF の向き情報で回転させないと横倒しになる
		.rotate()
		.resize({ width: Number(width), withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer()
		.catch(() => {
			throw unresizable();
		});
	return new Uint8Array(resized);
}

async function resizeAndStore(
	originalKey: string,
	key: string,
	width: ImageResizeWidth
): Promise<Uint8Array<ArrayBuffer> | null> {
	const original = await getObjectOrNull(originalKey);
	const input = await original?.Body?.transformToByteArray();
	if (!input) return null;

	const output = await resize(input, width);

	// 保存に失敗しても変換結果は返せるため、次回のリクエストで再変換させる
	await putObject(key, output, RESIZED_IMAGE_MIME_TYPE).catch(error => {
		console.error(
			`[image-resize] 変換済み画像の保存に失敗しました: ${key}`,
			error
		);
	});
	return output;
}

/**
 * 変換済みの画像があればそれを返し、なければ元画像を変換・保存して返す。
 * 元画像が見つからなければ null を返し、縮小できない画像なら INVALID_REQUEST を投げる。
 *
 * 変換済みの画像があるときは DB を引かずに返せるよう、元画像の情報は関数で受け取る。
 * 変換済みの画像は、元画像と同じく S3 から削除しない。
 */
export async function getResizedImage(
	fileId: string,
	width: ImageResizeWidth,
	findOriginal: () => Promise<OriginalImage | null>
): Promise<ImageBody | null> {
	const key = resizedKey(fileId, width);
	const cached = await getObjectStream(key);
	if (cached) return cached;

	const original = await findOriginal();
	if (!original) return null;
	// 元画像を取得する前に弾き、巨大なファイルをメモリに載せない
	if (original.size > MAX_INPUT_BYTES) {
		throw unresizable();
	}

	let task = inFlight.get(key);
	if (!task) {
		task = limit(() => resizeAndStore(original.key, key, width)).finally(() =>
			inFlight.delete(key)
		);
		inFlight.set(key, task);
	}
	return task;
}

/** 元画像をそのまま返す。S3 上に見つからなければ null を返す。 */
export function getOriginalImage(key: string): Promise<ImageBody | null> {
	return getObjectStream(key);
}
