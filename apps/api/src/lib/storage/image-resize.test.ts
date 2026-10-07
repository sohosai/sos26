import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./presign", () => ({
	deleteObject: vi.fn(),
	getObject: vi.fn(),
	putObject: vi.fn(),
}));

import {
	deleteResizedImages,
	getOriginalImage,
	getResizedImage,
} from "./image-resize";
import { deleteObject, getObject, putObject } from "./presign";

const mockDeleteObject = vi.mocked(deleteObject);
const mockGetObject = vi.mocked(getObject);
const mockPutObject = vi.mocked(putObject);

const ORIGINAL = {
	key: "user/original.png",
	mimeType: "image/png",
	size: 1000,
};
const findOriginal = async () => ORIGINAL;

function noSuchKey(): Error {
	const error = new Error("The specified key does not exist.");
	error.name = "NoSuchKey";
	return error;
}

async function makePng(width: number, height: number): Promise<Uint8Array> {
	const png = await sharp({
		create: { width, height, channels: 3, background: "#ff0000" },
	})
		.png()
		.toBuffer();
	return new Uint8Array(png);
}

function mockStorage(original: Uint8Array, stream = new ReadableStream()) {
	mockGetObject.mockImplementation(async key => {
		if (key !== ORIGINAL.key) throw noSuchKey();
		return {
			Body: {
				transformToByteArray: async () => original,
				transformToWebStream: () => stream,
			},
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

		const image = await getResizedImage("file-1", "320", find);

		expect(image).toEqual({ body: stream, contentType: "image/webp" });
		expect(mockGetObject).toHaveBeenCalledWith("resized/file-1/w320.webp");
		expect(find).not.toHaveBeenCalled();
	});

	it("変換済みの画像がなければ縦横比を保って縮小した WebP を保存して返す", async () => {
		mockStorage(await makePng(800, 400));

		const image = await getResizedImage("file-1", "320", findOriginal);

		expect(image?.contentType).toBe("image/webp");
		const meta = await sharp(image?.body as Uint8Array).metadata();
		expect(meta).toMatchObject({ format: "webp", width: 320, height: 160 });
		expect(mockPutObject).toHaveBeenCalledWith(
			"resized/file-1/w320.webp",
			image?.body,
			"image/webp"
		);
	});

	it("元画像より大きい幅を指定しても拡大しない", async () => {
		mockStorage(await makePng(100, 50));

		const image = await getResizedImage("file-1", "640", findOriginal);

		const meta = await sharp(image?.body as Uint8Array).metadata();
		expect(meta.width).toBe(100);
	});

	it("元画像が見つからない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		const image = await getResizedImage("file-1", "320", async () => null);

		expect(image).toBeNull();
	});

	it("DB にあっても S3 に元画像がない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		const image = await getResizedImage("file-1", "320", findOriginal);

		expect(image).toBeNull();
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("ファイルサイズが上限を超える画像は、メモリに載せずに元画像をそのまま返す", async () => {
		const stream = new ReadableStream();
		mockStorage(new Uint8Array(), stream);

		const image = await getResizedImage("file-large", "320", async () => ({
			...ORIGINAL,
			size: 100_000_000,
		}));

		expect(image).toEqual({ body: stream, contentType: "image/png" });
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("画素数が上限を超える画像は元画像をそのまま返す", async () => {
		const original = await makePng(10_000, 6_000);
		mockStorage(original);

		const image = await getResizedImage("file-huge", "320", findOriginal);

		expect(image?.contentType).toBe("image/png");
		expect(Buffer.compare(image?.body as Uint8Array, original)).toBe(0);
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("申告された MIME タイプに関わらず、中身が対応形式でなければ元画像をそのまま返す", async () => {
		const svg = new TextEncoder().encode(
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
		);
		mockStorage(svg);

		const image = await getResizedImage("file-svg", "320", findOriginal);

		expect(image?.contentType).toBe("image/png");
		expect(image?.body).toEqual(svg);
		expect(mockPutObject).not.toHaveBeenCalled();
	});

	it("一度縮小できなかった画像は、幅を変えても変換を試みずに元画像を返す", async () => {
		const stream = new ReadableStream();
		mockStorage(new TextEncoder().encode("not an image"), stream);
		await getResizedImage("file-broken", "320", findOriginal);
		mockGetObject.mockClear();

		const image = await getResizedImage("file-broken", "640", findOriginal);

		expect(image).toEqual({ body: stream, contentType: "image/png" });
		expect(mockGetObject).toHaveBeenCalledTimes(1);
		expect(mockGetObject).toHaveBeenCalledWith(ORIGINAL.key);
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

		const image = await getResizedImage("file-1", "320", findOriginal);

		expect(image?.body).toBeInstanceOf(Uint8Array);
	});
});

describe("getOriginalImage", () => {
	it("S3 に元画像がない場合は null を返す", async () => {
		mockGetObject.mockRejectedValue(noSuchKey());

		expect(await getOriginalImage(ORIGINAL)).toBeNull();
	});
});

describe("deleteResizedImages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("すべての幅の変換済み画像を削除する", async () => {
		mockDeleteObject.mockResolvedValue();

		await deleteResizedImages(["file-1"]);

		expect(mockDeleteObject.mock.calls.map(([key]) => key)).toEqual([
			"resized/file-1/w160.webp",
			"resized/file-1/w320.webp",
			"resized/file-1/w640.webp",
			"resized/file-1/w1280.webp",
		]);
	});

	it("削除に失敗しても例外を投げない", async () => {
		mockDeleteObject.mockRejectedValue(new Error("S3 down"));
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(deleteResizedImages(["file-1"])).resolves.toBeUndefined();
	});
});
