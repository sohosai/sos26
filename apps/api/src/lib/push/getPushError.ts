import { z } from "zod";

const pushErrorSchema = z
	.object({
		statusCode: z.number().optional(),
		status: z.number().optional(),
	})
	.loose(); // 未定義キーを削除されると、後で利用する際に困る可能性があるため、その他のプロパティも許可

/**
 * Push通知のエラーからステータスコードを取得する
 */
export function getStatusCode(error: unknown): number | undefined {
	try {
		// エラーの形はブラウザによって異なるため、statusCodeとstatusの両方を試す
		const parsed = pushErrorSchema.parse(error);
		return parsed.statusCode ?? parsed.status;
	} catch {
		return undefined;
	}
}
