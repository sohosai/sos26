import { Text } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { Checkbox } from "@/components/primitives";
import {
	PROJECT_LOCATION_OPTIONS,
	PROJECT_TYPE_OPTIONS,
} from "@/lib/project/options";

type Selection = {
	types: ProjectType[];
	locations: ProjectLocation[];
};

type Props = {
	selectedTypes: ProjectType[];
	selectedLocations: ProjectLocation[];
	onChange: (next: Selection) => void;
	typeLabel: string;
	locationLabel: string;
	fieldClassName?: string;
	checkboxGroupClassName?: string;
};

export function ProjectCategorySelector({
	selectedTypes,
	selectedLocations,
	onChange,
	typeLabel,
	locationLabel,
	fieldClassName,
	checkboxGroupClassName,
}: Props) {
	const updateSelection = (next: Selection) => {
		onChange(next);
	};

	const handleStageTypeToggle = () => {
		if (!selectedTypes.includes("STAGE")) {
			updateSelection({ types: ["STAGE"], locations: ["STAGE"] });
		} else {
			updateSelection({
				types: selectedTypes.filter(t => t !== "STAGE"),
				locations: selectedLocations.filter(l => l !== "STAGE"),
			});
		}
	};

	const handleNormalTypeToggle = (value: ProjectType) => {
		if (selectedTypes.includes("STAGE")) {
			updateSelection({
				types: [value],
				locations: selectedLocations.filter(l => l !== "STAGE"),
			});
			return;
		}

		const nextTypes = selectedTypes.includes(value)
			? selectedTypes.filter(t => t !== value)
			: [...selectedTypes, value];
		const nextLocations =
			nextTypes.length > 0 && !nextTypes.includes("STAGE")
				? selectedLocations.filter(l => l !== "STAGE")
				: selectedLocations;
		updateSelection({ types: nextTypes, locations: nextLocations });
	};

	const toggleType = (value: ProjectType) => {
		if (value === "STAGE") {
			handleStageTypeToggle();
		} else {
			handleNormalTypeToggle(value);
		}
	};

	const toggleLocation = (value: ProjectLocation) => {
		updateSelection({
			types: selectedTypes,
			locations: selectedLocations.includes(value)
				? selectedLocations.filter(l => l !== value)
				: [...selectedLocations, value],
		});
	};

	return (
		<>
			<div className={fieldClassName}>
				<Text as="label" size="2" weight="medium">
					{typeLabel}
				</Text>
				<div className={checkboxGroupClassName}>
					{PROJECT_TYPE_OPTIONS.map(opt => (
						<Checkbox
							key={opt.value}
							label={opt.label}
							checked={selectedTypes.includes(opt.value)}
							onCheckedChange={() => toggleType(opt.value)}
						/>
					))}
				</div>
			</div>
			<div className={fieldClassName}>
				<Text as="label" size="2" weight="medium">
					{locationLabel}
				</Text>
				<div className={checkboxGroupClassName}>
					{PROJECT_LOCATION_OPTIONS.map(opt => {
						const isStageOpt = opt.value === "STAGE";
						const stageTypeSelected = selectedTypes.includes("STAGE");
						const nonStageTypeSelected = selectedTypes.some(t => t !== "STAGE");
						const disabled = isStageOpt
							? selectedTypes.length > 0 && !stageTypeSelected
							: stageTypeSelected && !nonStageTypeSelected;
						return (
							<Checkbox
								key={opt.value}
								label={opt.label}
								checked={selectedLocations.includes(opt.value)}
								onCheckedChange={() => !disabled && toggleLocation(opt.value)}
								disabled={disabled}
							/>
						);
					})}
				</div>
			</div>
		</>
	);
}
