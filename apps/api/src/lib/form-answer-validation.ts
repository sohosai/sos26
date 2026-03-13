import type { FormAnswerInput, FormAnswerValidationItem } from "@sos26/shared";
import { Errors } from "./error";

// ─────────────────────────────────────────────────────────────
// 重複チェック: 同じ設問への回答が複数ないか
// ─────────────────────────────────────────────────────────────
export function assertNoDuplicateAnswers(answers: FormAnswerInput[]) {
	const seen = new Set<string>();
	for (const answer of answers) {
		if (seen.has(answer.formItemId)) {
			throw Errors.invalidRequest(
				`同じ設問への回答が重複しています（formItemId: ${answer.formItemId}）`
			);
		}
		seen.add(answer.formItemId);
	}
}

// ─────────────────────────────────────────────────────────────
// 設問IDチェック: 存在しない設問への回答がないか
// ─────────────────────────────────────────────────────────────
export function assertNoExtraAnswers(
	formItems: FormAnswerValidationItem[],
	answers: FormAnswerInput[]
) {
	const itemIds = new Set(formItems.map(i => i.id));
	for (const answer of answers) {
		if (!itemIds.has(answer.formItemId)) {
			throw Errors.invalidRequest(
				`不正な設問IDです（formItemId: ${answer.formItemId}）`
			);
		}
	}
}

// ─────────────────────────────────────────────────────────────
// 型チェック: 回答の type がフォーム設問の type と一致するか
// ─────────────────────────────────────────────────────────────
export function assertAnswerTypes(
	formItems: FormAnswerValidationItem[],
	answers: FormAnswerInput[]
) {
	const itemTypeMap = new Map(formItems.map(i => [i.id, i.type]));
	for (const answer of answers) {
		const expectedType = itemTypeMap.get(answer.formItemId);
		if (!expectedType) continue; // assertNoExtraAnswers で別途チェック
		if (expectedType !== answer.type) {
			throw Errors.invalidRequest(
				`設問タイプと回答タイプが一致しません（formItemId: ${answer.formItemId}）`
			);
		}
	}
}

// ─────────────────────────────────────────────────────────────
// 選択肢IDチェック: SELECT/CHECKBOX の selectedOptionIds が正しいか
// ─────────────────────────────────────────────────────────────
export function assertSelectedOptionsValid(
	formItems: FormAnswerValidationItem[],
	answers: FormAnswerInput[]
) {
	const optionMap = new Map(
		formItems.map(item => [item.id, new Set(item.options.map(o => o.id))])
	);

	for (const answer of answers) {
		if (answer.type !== "SELECT" && answer.type !== "CHECKBOX") continue;

		const validOptionIds = optionMap.get(answer.formItemId);
		if (!validOptionIds) continue; // assertNoExtraAnswers で別途チェック

		for (const id of answer.selectedOptionIds ?? []) {
			if (!validOptionIds.has(id)) {
				throw Errors.invalidRequest(
					`不正な選択肢IDです（formItemId: ${answer.formItemId}）`
				);
			}
		}
	}
}

// ─────────────────────────────────────────────────────────────
// 必須チェック: required な設問が回答されているか
// ─────────────────────────────────────────────────────────────
export function assertRequiredAnswered(
	formItems: FormAnswerValidationItem[],
	answers: FormAnswerInput[]
) {
	const answerMap = new Map(answers.map(a => [a.formItemId, a]));

	for (const item of formItems) {
		if (!item.required) continue;

		const answer = answerMap.get(item.id);

		const isEmpty = (() => {
			if (!answer) return true;

			switch (answer.type) {
				case "TEXT":
				case "TEXTAREA":
					return !answer.textValue;

				case "NUMBER":
					return answer.numberValue == null;

				case "FILE":
					return !answer.fileId;

				case "SELECT":
				case "CHECKBOX":
					return (
						!answer.selectedOptionIds || answer.selectedOptionIds.length === 0
					);

				default:
					return true;
			}
		})();

		if (isEmpty) {
			throw Errors.invalidRequest(
				`必須項目が未入力です（formItemId: ${item.id}）`
			);
		}
	}
}

// ─────────────────────────────────────────────────────────────
// 全チェックをまとめて実行（常に適用するもの）
// ─────────────────────────────────────────────────────────────
export function assertFormAnswersValid(
	formItems: FormAnswerValidationItem[],
	answers: FormAnswerInput[]
) {
	assertNoDuplicateAnswers(answers);
	assertNoExtraAnswers(formItems, answers);
	assertAnswerTypes(formItems, answers);
	assertSelectedOptionsValid(formItems, answers);
}
