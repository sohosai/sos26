import type { User } from "@prisma/client";

/**
 * ファイルアクセスチェッカーの型
 *
 * @param fileId - チェック対象のファイル ID
 * @param user   - アクセスを要求しているユーザー
 * @returns
 *   - true  → アクセス許可
 *   - false → このチェッカーでは判定不能（次のチェッカーへ）
 *
 * ※ 注意: true は「許可」、false は「拒否」ではなく「わからない」の意味。
 *   すべてのチェッカーが false を返した場合のみアクセス拒否になる。
 */
type FileAccessChecker = (fileId: string, user: User) => Promise<boolean>;

/** 登録済みのチェッカー一覧 */
const checkers: FileAccessChecker[] = [];

/**
 * アクセスチェッカーを登録する
 *
 * 各機能モジュール（お知らせ、フォーム等）の初期化時に呼び出す。
 * 登録順にチェックされ、最初に true を返したチェッカーでアクセスが許可される。
 */
export function registerFileAccessChecker(checker: FileAccessChecker): void {
	checkers.push(checker);
}

/**
 * ユーザーがファイルにアクセスできるかチェックする
 *
 * 登録済みの全チェッカーを順にチェックし、1つでも true を返せばアクセス許可。
 * すべて false なら false を返す（アクセス拒否）。
 *
 * ※ アップローダー本人のチェックはここでは行わない（呼び出し元で先にチェックする）
 */
export async function canAccessFile(
	fileId: string,
	user: User
): Promise<boolean> {
	for (const checker of checkers) {
		if (await checker(fileId, user)) {
			return true;
		}
	}
	return false;
}

/**
 * 登録済みチェッカーをすべてクリアする（テスト用）
 */
export function clearFileAccessCheckers(): void {
	checkers.length = 0;
}
