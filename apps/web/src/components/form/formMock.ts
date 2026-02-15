import type { Form } from "@/components/form/type";

// デザイン等確認用
export const volunteerEntryFormMock: Form = {
	id: "volunteer-entry-form",
	name: "ボランティアスタッフ応募フォーム",
	description:
		"学園祭を一緒に盛り上げてくれるスタッフを募集しています。以下の項目に回答し、応募を完了してください。",
	items: [
		{
			id: "fullName",
			label: "氏名",
			type: "text",
			required: true,
		},
		{
			id: "department",
			label: "所属学部・学科",
			type: "select",
			required: true,
			options: [
				{ id: "LIT", label: "文学部" },
				{ id: "SCI", label: "理学部" },
				{ id: "ENG", label: "工学部" },
				{ id: "ART", label: "芸術専門学群" },
				{ id: "OTHER", label: "その他" },
			],
		},
		{
			id: "age",
			label: "年齢",
			type: "number",
			required: true,
		},
		{
			id: "motivation",
			label: "志望動機",
			type: "textarea",
			required: true,
		},
		{
			id: "idCardCopy",
			label: "学生証の写し（PDFまたは画像）",
			type: "file",
			required: true,
		},
		{
			id: "availableRoles",
			label: "希望する担当業務（複数選択可）",
			type: "checkbox",
			required: true,
			options: [
				{ id: "RECEPTION", label: "受付・案内" },
				{ id: "SECURITY", label: "警備・見回り" },
				{ id: "CLEANUP", label: "清掃・美化" },
				{ id: "STAGE", label: "ステージ進行補助" },
			],
		},
		{
			id: "previousExperience",
			label: "過去のボランティア経験回数",
			type: "number",
			required: false,
		},
		{
			id: "notes",
			label: "特記事項・連絡事項",
			type: "textarea",
			required: false,
		},
		{
			id: "termsAgreed",
			label: "規約への同意",
			type: "checkbox",
			required: true,
			options: [
				{
					id: "agree",
					label: "プライバシーポリシーおよび活動規約に同意します",
				},
			],
		},
	],
};
