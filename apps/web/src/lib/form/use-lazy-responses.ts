import { useEffect, useRef, useState } from "react";
import { reportHandledError } from "@/lib/error/report";

/**
 * enabled になったときに回答一覧を取得し、formId ごとに保持する。
 * loader で取ると詳細画面の再取得（router.invalidate）のたびに全回答を取り直すため、回答タブを開くまで取らない。
 * 取得中に enabled が false になっても結果は保存し、失敗したときは次に enabled になったときに取り直す。
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
	const fetchingFormIdRef = useRef<string | null>(null);
	const currentFormIdRef = useRef(formId);
	currentFormIdRef.current = formId;

	const responses = loaded?.formId === formId ? loaded.responses : null;
	const needsFetch = enabled && responses === null;

	useEffect(() => {
		if (!needsFetch || fetchingFormIdRef.current === formId) return;
		fetchingFormIdRef.current = formId;
		setError(null);
		fetchResponses(formId)
			.then(res => {
				if (currentFormIdRef.current === formId)
					setLoaded({ formId, responses: res.responses });
			})
			.catch(error => {
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
			})
			.finally(() => {
				if (fetchingFormIdRef.current === formId)
					fetchingFormIdRef.current = null;
			});
	}, [needsFetch, formId, fetchResponses]);

	return {
		responses,
		error: error?.formId === formId ? error.message : null,
	};
}
