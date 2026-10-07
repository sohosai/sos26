import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./presign", () => ({
	getObject: vi.fn(),
	putObject: vi.fn(),
}));

import { AppError } from "../error";
import { getOriginalImage, getResizedImage } from "./image-resize";
import { getObject, putObject } from "./presign";

const mockGetObject = vi.mocked(getObject);
const mockPutObject = vi.mocked(putObject);

const ORIGINAL_KEY = "user/original.png";
const findOriginal = async () => ({ key: ORIGINAL_KEY, size: 1000 });

function noSuchKey(): Error {
	const error = new Error("The specified key does not exist.");
	error.name = "NoSuchKey";
	return error;
}

async function makePng(width: number, height: number): Promise<Uint8Array> {
	return sharp({
		create: { width, height, channels: 3, background: "#ff0000" },
	})
		.png()
		.toBuffer();
}

function mockStorage(original: Uint8Array) {
	mockGetObject.mockImplementation(async key => {
		if (key !== ORIGINAL_KEY) throw noSuchKey();
		return {
			Body: { transformToByteArray: async () => original },
		} as never;
	});
}

describe("getResizedImage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPutObject.mockResolvedValue();
	});

	it("変換済みの画像があれば元画像を引かずに返す", async () => {
		const stream = new ReadableStream();
		mockGetObject.mockResolvedValue({
			Body: { transformToWebStream: () => stream },
		} as never);
		const find = vi.fn();

		const body = await getResizedImage("file-1", "320", find);

		expect(body).toBe(stream);
		expect(mockGetObject).toHaveBeenCalledWith("resized/file-1/w320.webp");
		expect(find).not.toHaveBeenCalled();
	});

	it("変換済みの画像がなければ縦横比を保って縮小した WebP を保存して返す", async () => {
		mockStorage(await makePng(800, 400));

		const body = await getResizedImage("file-1", "320", findOriginal);

		const meta = await sharp(body as Uint8Array).metadata();
		expect(meta).toMatchObject({ format: "webp", width: 320, height: 160 });
		expect(mockPutObject).toHaveBeenCalledWith(
			"resized/file-1/w320.webp",
			body,
			"image/webp"
		);
	});

	it("元画像より大きい幅を指定しても拡大しない", async () => {
		mockStorage(await makePng(100, 50));

		const body = await getResizedImage("file-1", "640", findOriginal);

		const meta = await sharp(body as Uint8Array).metadata();
		expect(meta.width).toBe(100);
	});

	it("元画像が見つからない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		const body = await getResizedImage("file-1", "320", async () => null);

		expect(body).toBeNull();
	});

	it("DB にあっても S3 に元画像がない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		const body = await getResizedImage("file-1", "320", findOriginal);

		expect(body).toBeNull();
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("ファイルサイズが上限を超える画像は取得せずに INVALID_REQUEST を投げる", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		await expect(
			getResizedImage("file-1", "320", async () => ({
				key: ORIGINAL_KEY,
				size: 100_000_000,
			}))
		).rejects.toBeInstanceOf(AppError);
		expect(mockGetObject).not.toHaveBeenCalledWith(ORIGINAL_KEY);
	});

	it("画素数が上限を超える画像は INVALID_REQUEST を投げる", async () => {
		mockStorage(await makePng(10_000, 6_000));

		await expect(
			getResizedImage("file-1", "320", findOriginal)
		).rejects.toBeInstanceOf(AppError);
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("申告された MIME タイプに関わらず、中身が対応形式でなければ INVALID_REQUEST を投げる", async () => {
		const svg = new TextEncoder().encode(
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
		);
		mockStorage(svg);

		await expect(
			getResizedImage("file-1", "320", findOriginal)
		).rejects.toBeInstanceOf(AppError);
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("同じ画像・幅への同時リクエストでは変換を1回にまとめる", async () => {
		mockStorage(await makePng(800, 400));
		const [a, b] = await Promise.all([
			getResizedImage("file-1", "320", findOriginal),
			getResizedImage("file-1", "320", findOriginal),
		]);

		expect(a).toBe(b);
		expect(mockPutObject).toHaveBeenCalledTimes(1);
	});

	it("変換済みの画像の保存に失敗しても変換結果を返す", async () => {
		mockStorage(await makePng(800, 400));
		mockPutObject.mockRejectedValue(new Error("S3 down"));
		vi.spyOn(console, "error").mockImplementation(() => {});

		const body = await getResizedImage("file-1", "320", findOriginal);

		expect(body).toBeInstanceOf(Uint8Array);
	});
});

describe("getOriginalImage", () => {
	it("S3 に元画像がない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		expect(await getOriginalImage(ORIGINAL_KEY)).toBeNull();
	});
});
