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
			type: "TEXT",
			required: true,
		},
		{
			id: "namePhonetic",
			label: "企画名（ふりがな）",
			type: "TEXT",
			required: true,
		},
		{
			id: "organizationName",
			label: "企画団体名",
			type: "TEXT",
			required: true,
		},
		{
			id: "organizationNamePhonetic",
			label: "企画団体名（ふりがな）",
			type: "TEXT",
			required: true,
		},
		{
			id: "type",
			label: "企画区分",
			type: "SELECT",
			required: true,
			options: [
				{ id: "NORMAL", label: "通常企画" },
				{ id: "STAGE", label: "ステージ企画" },
				{ id: "FOOD", label: "食品企画" },
			],
		},
	],
};
export const isCreateProjectFormAnswers = (
	answers: FormAnswers
): answers is z.infer<typeof createProjectRequestSchema> =>
	createProjectRequestSchema.safeParse(answers).success;
