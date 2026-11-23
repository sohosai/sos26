import { useEffect, useState } from "react";
import { reportHandledError } from "@/lib/error/report";

type Loaded<T> =
	| { formId: string; responses: T[]; error: null }
	| { formId: string; responses: null; error: string };

/**
 * enabled になったときに回答一覧を取得し、formId ごとに保持する。
 * loader で取ると詳細画面の再取得（router.invalidate）のたびに全回答を取り直すため、回答タブを開くまで取らない。
 */
export function useLazyResponses<T>(
	formId: string,
	enabled: boolean,
	fetchResponses: (formId: string) => Promise<{ responses: T[] }>
) {
	const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
	const current = loaded?.formId === formId ? loaded : null;
	const shouldFetch = enabled && current === null;

	useEffect(() => {
		if (!shouldFetch) return;
		let cancelled = false;
		fetchResponses(formId)
			.then(res => {
				if (!cancelled)
					setLoaded({ formId, responses: res.responses, error: null });
			})
			.catch(error => {
				if (cancelled) return;
				reportHandledError({
					error,
					operation: "read",
					userMessage: "回答の取得に失敗しました",
					ui: {
						type: "inline",
						setError: message =>
							setLoaded({ formId, responses: null, error: message }),
					},
					context: { formId },
				});
			});
		return () => {
			cancelled = true;
		};
	}, [shouldFetch, formId, fetchResponses]);

	return {
		responses: current?.responses ?? null,
		error: current?.error ?? null,
	};
}
