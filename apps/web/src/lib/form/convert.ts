import type {
	GetFormDetailResponse,
	GetProjectFormResponse,
} from "@sos26/shared";
import type { Form } from "@/components/form/type";

export function projectFormToForm(form: GetProjectFormResponse): Form {
	const detail = form.form;
	return {
		id: detail.formId,
		name: detail.title,
		description: detail.description ?? undefined,
		items: [...detail.items]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(item => ({
				id: item.id,
				label: item.label,
				type: item.type,
				description: item.description ?? undefined,
				required: item.required,
				options: item.options
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(opt => ({
						id: opt.id,
						label: opt.label,
					})),
			})),
	};
}

export function formDetailToForm(formDetail: GetFormDetailResponse): Form {
	const detail = formDetail.form;
	return {
		id: detail.id,
		name: detail.title,
		description: detail.description ?? undefined,
		items: [...detail.items]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(item => ({
				id: item.id,
				label: item.label,
				description: item.description ?? undefined,
				type: item.type,
				required: item.required,
				options: item.options
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(opt => ({
						id: opt.id,
						label: opt.label,
					})),
			})),
	};
}
