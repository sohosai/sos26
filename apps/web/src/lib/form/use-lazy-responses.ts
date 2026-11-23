import { useCallback, useEffect, useRef, useState } from "react";
import { reportHandledError } from "@/lib/error/report";

/**
 * enabled になったときに回答一覧を取得し、formId ごとに保持する。
 * loader で取ると詳細画面の再取得（router.invalidate）のたびに全回答を取り直すため、回答タブを開くまで取らない。
 * 取得中に enabled が false になっても結果は保存し、失敗したときは次に enabled になったときに取り直す。
 * 応答は最後に出したリクエストの分だけ反映する。フォームの切替や続けての取り直しで、古い応答が新しい結果を上書きしないようにするため。
 */
export function useLazyResponses<T>(
	formId: string,
	enabled: boolean,
	fetchResponses: (formId: string) => Promise<{ responses: T[] }>
) {
	const [loaded, setLoaded] = useState<{
		formId: string;
		responses: T[];
	} | null>(null);
	const [error, setError] = useState<{
		formId: string;
		message: string;
	} | null>(null);
	const latestRequestIdRef = useRef(0);
	const pendingRef = useRef<{ formId: string; requestId: number } | null>(null);

	const responses = loaded?.formId === formId ? loaded.responses : null;
	const needsFetch = enabled && responses === null;

	const request = useCallback(
		(onError: (error: unknown) => void) => {
			latestRequestIdRef.current += 1;
			const requestId = latestRequestIdRef.current;
			const promise = fetchResponses(formId)
				.then(res => {
					if (requestId !== latestRequestIdRef.current) return;
					setLoaded({ formId, responses: res.responses });
					setError(null);
				})
				.catch(error => {
					if (requestId === latestRequestIdRef.current) onError(error);
				});
			return { requestId, promise };
		},
		[formId, fetchResponses]
	);

	useEffect(() => {
		if (!needsFetch || pendingRef.current?.formId === formId) return;
		setError(null);
		const { requestId, promise } = request(error => {
			reportHandledError({
				error,
				operation: "read",
				userMessage: "回答の取得に失敗しました",
				ui: {
					type: "inline",
					setError: message => setError({ formId, message }),
				},
				context: { formId },
			});
		});
		pendingRef.current = { formId, requestId };
		promise.finally(() => {
			if (pendingRef.current?.requestId === requestId)
				pendingRef.current = null;
		});
	}, [needsFetch, formId, request]);

	// 回答を編集したあとに、表示中の一覧を残したまま取り直す
	const reload = useCallback(() => {
		request(error => {
			reportHandledError({
				error,
				operation: "read",
				userMessage: "回答一覧の更新に失敗しました",
				ui: { type: "toast" },
				context: { formId },
			});
		});
	}, [formId, request]);

	return {
		responses,
		reload,
		error: error?.formId === formId ? error.message : null,
	};
}
