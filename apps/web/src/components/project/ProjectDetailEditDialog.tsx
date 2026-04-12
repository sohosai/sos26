import { Callout, Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type { Project } from "@sos26/shared";
import {
	isBlankProjectDisplayName,
	isKana,
	isValidProjectDisplayName,
	PROJECT_DISPLAY_NAME_RULE_MESSAGE,
	projectLocationSchema,
	projectTypeSchema,
} from "@sos26/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/patterns";
import { Button, TextField } from "@/components/primitives";
import { updateProjectDetail } from "@/lib/api/project";
import { reportHandledError } from "@/lib/error/report";
import {
	PROJECT_LOCATION_OPTIONS,
	PROJECT_TYPE_OPTIONS,
} from "@/lib/project/options";
import styles from "./ProjectDetailEditDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: Project;
	onUpdated: (project: Project) => void;
};

type FormState = {
	name: string;
	namePhonetic: string;
	organizationName: string;
	organizationNamePhonetic: string;
	type: string;
	location: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function resolveLocation(newType: string, prevLocation: string): string {
	if (newType === "STAGE") return "STAGE";
	if (prevLocation === "STAGE") return "";
	return prevLocation;
}

function buildErrors(state: FormState): FormErrors {
	const errs: FormErrors = {};
	if (isBlankProjectDisplayName(state.name)) errs.name = "企画名は必須です";
	else if (!isValidProjectDisplayName(state.name)) {
		errs.name = PROJECT_DISPLAY_NAME_RULE_MESSAGE;
	}
	if (!state.namePhonetic) errs.namePhonetic = "企画名（ふりがな）は必須です";
	else if (!isKana(state.namePhonetic))
		errs.namePhonetic = "ひらがなで入力してください";
	if (isBlankProjectDisplayName(state.organizationName))
		errs.organizationName = "企画団体名は必須です";
	else if (!isValidProjectDisplayName(state.organizationName)) {
		errs.organizationName = PROJECT_DISPLAY_NAME_RULE_MESSAGE;
	}
	if (!state.organizationNamePhonetic)
		errs.organizationNamePhonetic = "企画団体名（ふりがな）は必須です";
	else if (!isKana(state.organizationNamePhonetic))
		errs.organizationNamePhonetic = "ひらがなで入力してください";
	if (!state.type) errs.type = "企画区分は必須です";
	if (!state.location) errs.location = "企画実施場所は必須です";
	return errs;
}

export function ProjectDetailEditDialog({
	open,
	onOpenChange,
	project,
	onUpdated,
}: Props) {
	const [form, setForm] = useState<FormState>({
		name: "",
		namePhonetic: "",
		organizationName: "",
		organizationNamePhonetic: "",
		type: "",
		location: "",
	});
	const [errors, setErrors] = useState<FormErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) return;
		setForm({
			name: project.name,
			namePhonetic: project.namePhonetic,
			organizationName: project.organizationName,
			organizationNamePhonetic: project.organizationNamePhonetic,
			type: project.type,
			location: project.location,
		});
		setErrors({});
	}, [
		open,
		project.name,
		project.namePhonetic,
		project.organizationName,
		project.organizationNamePhonetic,
		project.type,
		project.location,
	]);

	const isStage = form.type === "STAGE";

	const handleChange = (key: keyof FormState) => (value: string) => {
		setForm(prev => ({ ...prev, [key]: value }));
		setErrors(prev => ({ ...prev, [key]: undefined }));
	};

	const handleTypeChange = (value: string) => {
		setForm(prev => ({
			...prev,
			type: value,
			location: resolveLocation(value, prev.location),
		}));
		setErrors(prev => ({ ...prev, type: undefined, location: undefined }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs = buildErrors(form);
		setErrors(errs);
		if (Object.keys(errs).length > 0) return;

		const parsedType = projectTypeSchema.safeParse(form.type);
		const parsedLoc = projectLocationSchema.safeParse(form.location);
		if (!parsedType.success || !parsedLoc.success) return;

		setIsSubmitting(true);
		try {
			const updated = await updateProjectDetail(project.id, {
				name: form.name,
				namePhonetic: form.namePhonetic,
				organizationName: form.organizationName,
				organizationNamePhonetic: form.organizationNamePhonetic,
				type: parsedType.data,
				location: parsedLoc.data,
			});
			onUpdated(updated.project);
			onOpenChange(false);
		} catch (error) {
			reportHandledError({
				error,
				operation: "save",
				userMessage: "企画情報の更新に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
				},
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="640px" className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>企画基本情報の編集</Dialog.Title>
				</VisuallyHidden>
				<form className={styles.form} onSubmit={handleSubmit} noValidate>
					<div className={styles.content}>
						<div className={styles.header}>
							<Text size="5" weight="bold">
								企画基本情報の編集
							</Text>
							<Text size="2" color="gray">
								企画応募期間内のみ編集できます。
							</Text>
						</div>

						<div className={styles.fields}>
							<div className={styles.field}>
								<TextField
									label="企画名 *"
									value={form.name}
									onChange={handleChange("name")}
									placeholder="例：○○研究会"
									error={errors.name}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画名（ふりがな）*"
									value={form.namePhonetic}
									onChange={handleChange("namePhonetic")}
									placeholder="例：まるまるけんきゅうかい"
									error={errors.namePhonetic}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画団体名 *"
									value={form.organizationName}
									onChange={handleChange("organizationName")}
									placeholder="例：○○サークル"
									error={errors.organizationName}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画団体名（ふりがな）*"
									value={form.organizationNamePhonetic}
									onChange={handleChange("organizationNamePhonetic")}
									placeholder="例：まるまるさーくる"
									error={errors.organizationNamePhonetic}
								/>
							</div>

							<div className={styles.field}>
								<RadioGroup
									label="企画区分"
									value={form.type}
									onValueChange={handleTypeChange}
									required
									name="type"
								>
									{PROJECT_TYPE_OPTIONS.map(opt => (
										<RadioGroupItem key={opt.value} value={opt.value}>
											{opt.label}
										</RadioGroupItem>
									))}
								</RadioGroup>
								{errors.type && (
									<Text size="1" color="red">
										{errors.type}
									</Text>
								)}
							</div>

							<div className={styles.field}>
								{isStage ? (
									<>
										<RadioGroup
											label="企画実施場所"
											value="STAGE"
											required
											name="location"
											disabled
										>
											<RadioGroupItem value="STAGE">ステージ</RadioGroupItem>
										</RadioGroup>
										<Callout.Root size="1" color="blue" variant="soft">
											<Callout.Icon>
												<IconInfoCircle size={14} />
											</Callout.Icon>
											<Callout.Text>
												ステージ企画の実施場所はステージに自動設定されます。
											</Callout.Text>
										</Callout.Root>
									</>
								) : (
									<>
										<RadioGroup
											label="企画実施場所"
											value={form.location}
											onValueChange={handleChange("location")}
											required
											name="location"
											disabled={!form.type}
										>
											{PROJECT_LOCATION_OPTIONS.filter(
												opt => opt.value !== "STAGE"
											).map(opt => (
												<RadioGroupItem key={opt.value} value={opt.value}>
													<span className={styles.locationLabel}>
														{opt.label}
														<Text as="span" size="1" color="gray">
															{opt.caption}
														</Text>
													</span>
												</RadioGroupItem>
											))}
										</RadioGroup>
										{!form.type && (
											<Text size="1" color="gray">
												企画区分を選択してください。
											</Text>
										)}
									</>
								)}
								{errors.location && (
									<Text size="1" color="red">
										{errors.location}
									</Text>
								)}
							</div>
						</div>
					</div>

					<div className={styles.footer}>
						<Button
							type="button"
							intent="secondary"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							キャンセル
						</Button>
						<Button type="submit" loading={isSubmitting}>
							保存する
						</Button>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	);
}
