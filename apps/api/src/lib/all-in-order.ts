/**
 * Promise.all と同じく並べて待つ。失敗があれば、完了した順ではなく渡した順で最初の失敗を投げる。
 * 確認を並べて実行しても、返すエラーが応答の速さで変わらないようにするために使う。
 */
export async function allInOrder<T extends readonly unknown[]>(
	promises: readonly [...T]
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
	const results = await Promise.allSettled(promises);
	for (const result of results) {
		if (result.status === "rejected") throw result.reason;
	}
	return results.map(result =>
		result.status === "fulfilled" ? result.value : undefined
	) as { -readonly [K in keyof T]: Awaited<T[K]> };
}
