import { createProjectRequestSchema } from "@sos26/shared";
import type { z } from "zod";
import type { Form, FormAnswers } from "@/components/form/type";

export const projectRegisterMockForm: Form = {
	id: "project-register-form",
	name: "企画登録フォーム",
	description:
		"学園祭への企画参加に必要な情報を入力してください。必須項目はすべてご記入ください。",
	items: [
		{
			id: "name",
			label: "企画名",
			type: "text",
			required: true,
		},
		{
			id: "namePhonetic",
			label: "企画名（ふりがな）",
			type: "text",
			required: true,
		},
		{
			id: "organizationName",
			label: "企画団体名",
			type: "text",
			required: true,
		},
		{
			id: "organizationNamePhonetic",
			label: "企画団体名（ふりがな）",
			type: "text",
			required: true,
		},
		{
			id: "type",
			label: "企画区分",
			type: "select",
			required: true,
			options: [
				{ id: "NORMAL", label: "通常企画" },
				{ id: "STAGE", label: "ステージ企画" },
				{ id: "FOOD", label: "食品企画" },
			],
		},
		// デザイン確認用
		// {
		// 	id: "project-description",
		// 	label: "企画内容",
		// 	type: "textarea",
		// 	required: true,
		// },
		// デザイン確認用
		// {
		// 	id: "expected-members",
		// 	label: "参加予定人数",
		// 	type: "number",
		// 	required: false,
		// },
		// デザイン確認用
		// {
		// 	id: "proposal-pdf",
		// 	label: "企画提案書（PDF）",
		// 	type: "file",
		// 	required: false,
		// },
		// デザイン確認用
		// {
		// 	id: "agreement",
		// 	label: "注意事項の確認",
		// 	type: "checkbox",
		// 	required: true,
		// 	options: [
		// 		{
		// 			id: "fire",
		// 			label: "火気使用の有無について正しく申告します",
		// 		},
		// 		{
		// 			id: "noise",
		// 			label: "騒音・音量に関する規定を遵守します",
		// 		},
		// 		{
		// 			id: "rules",
		// 			label: "学園祭の企画運営ルールを確認しました",
		// 		},
		// 	],
		// },
	],
};
export const isCreateProjectFormAnswers = (
	answers: FormAnswers
): answers is z.infer<typeof createProjectRequestSchema> =>
	createProjectRequestSchema.safeParse(answers).success;
