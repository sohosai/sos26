import { Callout, Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type { Project } from "@sos26/shared";
import { projectLocationSchema, projectTypeSchema } from "@sos26/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/patterns";
import { Button, TextField } from "@/components/primitives";
import { createProject } from "@/lib/api/project";
import styles from "./ProjectCreateDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (project: Project) => void;
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

const TYPE_OPTIONS = [
	{ id: "NORMAL", label: "通常企画" },
	{ id: "FOOD", label: "食品企画" },
	{ id: "STAGE", label: "ステージ企画" },
];

const LOCATION_OPTIONS_DEFAULT = [
	{ id: "INDOOR", label: "屋内" },
	{ id: "OUTDOOR", label: "屋外" },
];

export function ProjectCreateDialog({ open, onOpenChange, onCreated }: Props) {
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

	const isStage = form.type === "STAGE";

	const handleTypeChange = (value: string) => {
		setForm(prev => ({
			...prev,
			type: value,
			// STAGE企画の場合は実施場所をSTAGEに自動設定し、非STAGE時はリセット
			location:
				value === "STAGE"
					? "STAGE"
					: prev.location === "STAGE"
						? ""
						: prev.location,
		}));
		setErrors(prev => ({ ...prev, type: undefined, location: undefined }));
	};

	const handleChange = (field: keyof FormState) => (value: string) => {
		setForm(prev => ({ ...prev, [field]: value }));
		setErrors(prev => ({ ...prev, [field]: undefined }));
	};

	const validate = (): boolean => {
		const newErrors: FormErrors = {};
		if (!form.name) newErrors.name = "企画名は必須です";
		if (!form.namePhonetic)
			newErrors.namePhonetic = "企画名（ふりがな）は必須です";
		if (!form.organizationName)
			newErrors.organizationName = "企画団体名は必須です";
		if (!form.organizationNamePhonetic)
			newErrors.organizationNamePhonetic = "企画団体名（ふりがな）は必須です";
		if (!form.type) newErrors.type = "企画区分は必須です";
		if (!form.location) newErrors.location = "企画実施場所は必須です";
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		const parsed = projectTypeSchema.safeParse(form.type);
		const parsedLocation = projectLocationSchema.safeParse(form.location);
		if (!parsed.success || !parsedLocation.success) return;

		setIsSubmitting(true);
		try {
			const res = await createProject({
				name: form.name,
				namePhonetic: form.namePhonetic,
				organizationName: form.organizationName,
				organizationNamePhonetic: form.organizationNamePhonetic,
				type: parsed.data,
				location: parsedLocation.data,
			});
			onCreated(res.project);
			onOpenChange(false);
			setForm({
				name: "",
				namePhonetic: "",
				organizationName: "",
				organizationNamePhonetic: "",
				type: "",
				location: "",
			});
		} catch {
			toast.error("企画の作成に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="520px">
				<VisuallyHidden>
					<Dialog.Title>企画登録</Dialog.Title>
				</VisuallyHidden>
				<form className={styles.form} onSubmit={handleSubmit} noValidate>
					<div className={styles.header}>
						<Text size="5" weight="bold">
							企画登録フォーム
						</Text>
						<Text size="2" color="gray">
							学園祭への企画参加に必要な情報を入力してください。必須項目はすべてご記入ください。
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
								{TYPE_OPTIONS.map(opt => (
									<RadioGroupItem key={opt.id} value={opt.id}>
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
										{LOCATION_OPTIONS_DEFAULT.map(opt => (
											<RadioGroupItem key={opt.id} value={opt.id}>
												{opt.label}
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
							登録する
						</Button>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	);
}
