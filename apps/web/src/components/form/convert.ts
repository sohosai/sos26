import type { GetFormDetailResponse } from "@sos26/shared";
import type { Form } from "@/components/form/type";

type FormDetail = GetFormDetailResponse["form"];

export function formDetailToForm(detail: FormDetail): Form {
	return {
		id: detail.id,
		name: detail.title,
		description: detail.description ?? undefined,
		items: [...detail.items]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(item => ({
				id: item.id,
				label: item.label,
				type: item.type.toLowerCase() as Lowercase<typeof item.type>,
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
