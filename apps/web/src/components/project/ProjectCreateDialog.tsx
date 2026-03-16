import { Callout, Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type {
	GetActiveProjectRegistrationFormsResponse,
	Project,
	ProjectLocation,
	ProjectType,
	RegistrationFormAnswersInput,
} from "@sos26/shared";
import {
	isBlankProjectDisplayName,
	isValidProjectDisplayName,
	PROJECT_DISPLAY_NAME_RULE_MESSAGE,
	projectLocationSchema,
	projectTypeSchema,
} from "@sos26/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import {
	createEmptyFileAnswerValue,
	type FormAnswers,
	type FormAnswerValue,
	isFileAnswerValue,
} from "@/components/form/type";
import { RadioGroup, RadioGroupItem } from "@/components/patterns";
import { Button, Checkbox, TextField } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import { createProject } from "@/lib/api/project";
import { getActiveProjectRegistrationForms } from "@/lib/api/project-registration-form";
import {
	PROJECT_LOCATION_OPTIONS,
	PROJECT_TYPE_OPTIONS,
} from "@/lib/project/options";
import styles from "./ProjectCreateDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (project: Project) => void;
};

type Step1State = {
	name: string;
	namePhonetic: string;
	organizationName: string;
	organizationNamePhonetic: string;
	type: string;
	location: string;
};

type Step1Errors = Partial<Record<keyof Step1State, string>>;

type RegForm = GetActiveProjectRegistrationFormsResponse["forms"][number];
type RegFormItem = RegForm["items"][number];
type RegFormAnswer = RegistrationFormAnswersInput["answers"][number];
type RegFormAnswerType = RegFormAnswer["type"];

const EMPTY_STEP1: Step1State = {
	name: "",
	namePhonetic: "",
	organizationName: "",
	organizationNamePhonetic: "",
	type: "",
	location: "",
};

function getDefaultAnswerValue(type: string): FormAnswerValue {
	if (type === "CHECKBOX") return [];
	if (type === "FILE") return createEmptyFileAnswerValue();
	if (type === "NUMBER") return null;
	return "";
}

function initFormAnswers(items: RegForm["items"]): FormAnswers {
	const answers: FormAnswers = {};
	for (const item of items) {
		answers[item.id] = getDefaultAnswerValue(item.type);
	}
	return answers;
}

function normalizeSelectedOptionIds(value: FormAnswerValue): string[] {
	if (Array.isArray(value)) {
		return value.filter(v => v !== "");
	}
	if (typeof value === "string" && value !== "") {
		return [value];
	}
	return [];
}

function buildRegFormAnswer(
	item: RegFormItem,
	answers: FormAnswers
): RegFormAnswer {
	const value = answers[item.id] ?? getDefaultAnswerValue(item.type);
	const type = item.type as RegFormAnswerType;
	const formItemId = item.id;

	switch (type) {
		case "TEXT":
		case "TEXTAREA":
			return { type, formItemId, textValue: value as string | null };
		case "NUMBER":
			return { type, formItemId, numberValue: value as number | null };
		case "SELECT":
		case "CHECKBOX":
			return {
				type,
				formItemId,
				selectedOptionIds: normalizeSelectedOptionIds(value),
			};
		case "FILE":
			if (!isFileAnswerValue(value)) {
				throw new Error(`FILE回答の型が不正です: ${formItemId}`);
			}
			return {
				type,
				formItemId,
				fileId: value.uploadedFile?.fileId ?? null,
			};
		default: {
			const _exhaustive: never = type;
			throw new Error(`Unsupported type: ${_exhaustive}`);
		}
	}
}

function buildRegFormAnswers(
	forms: RegForm[],
	formAnswers: FormAnswers[]
): RegistrationFormAnswersInput[] {
	return forms.map((form, fi) => {
		const answers = formAnswers[fi] ?? {};
		return {
			formId: form.id,
			answers: form.items.map(item => buildRegFormAnswer(item, answers)),
		};
	});
}

async function prepareRegFormAnswersForSubmit(
	forms: RegForm[],
	formAnswers: FormAnswers[]
): Promise<FormAnswers[]> {
	const preparedAnswers = formAnswers.map(answers => ({ ...answers }));

	await Promise.all(
		forms.map(async (form, formIndex) => {
			const answers = preparedAnswers[formIndex] ?? {};

			for (const item of form.items) {
				if (item.type !== "FILE") continue;

				const value = answers[item.id];
				if (!isFileAnswerValue(value)) {
					throw new Error(`FILE回答の型が不正です: ${item.id}`);
				}

				if (value.pendingFile instanceof File) {
					const result = await uploadFile(value.pendingFile);
					answers[item.id] = {
						pendingFile: null,
						uploadedFile: {
							fileId: result.file.id,
							fileName: result.file.fileName,
							mimeType: result.file.mimeType,
							isPublic: result.file.isPublic,
						},
					};
				}
			}

			preparedAnswers[formIndex] = answers;
		})
	);

	return preparedAnswers;
}

function validateRegFormAnswers(
	items: RegForm["items"],
	answers: FormAnswers
): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const item of items) {
		if (!item.required) continue;
		const val = answers[item.id];
		if (item.type === "FILE") {
			if (
				!isFileAnswerValue(val) ||
				(val.pendingFile === null && val.uploadedFile === null)
			) {
				errors[item.id] = "この項目は必須です";
			}
			continue;
		}
		if (
			val === undefined ||
			val === null ||
			val === "" ||
			(Array.isArray(val) && val.length === 0)
		) {
			errors[item.id] = "この項目は必須です";
		}
	}
	return errors;
}

type RegFormStepProps = {
	form: RegForm;
	answers: FormAnswers;
	errors: Record<string, string>;
	step: number;
	totalSteps: number;
	isSubmitting: boolean;
	onAnswerChange: (itemId: string, value: FormAnswerValue) => void;
	onSubmit: (e: React.FormEvent) => void;
	onBack: () => void;
	onNext: () => void;
};

function RegFormStep({
	form,
	answers,
	errors,
	step,
	totalSteps,
	isSubmitting,
	onAnswerChange,
	onSubmit,
	onBack,
	onNext,
}: RegFormStepProps) {
	return (
		<form className={styles.form} onSubmit={onSubmit} noValidate>
			<div className={styles.header}>
				<Text size="5" weight="bold">
					{form.title}
				</Text>
				{form.description && (
					<Text size="2" color="gray">
						{form.description}
					</Text>
				)}
				{totalSteps > 2 && (
					<Text size="1" color="gray">
						ステップ {step} / {totalSteps - 1}
					</Text>
				)}
			</div>

			<div className={styles.fields}>
				{[...form.items]
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(item => (
						<div key={item.id} className={styles.field}>
							<AnswerField
								item={{
									id: item.id,
									label: item.label,
									description: item.description ?? undefined,
									type: item.type as Parameters<
										typeof AnswerField
									>[0]["item"]["type"],
									required: item.required,
									options: item.options,
								}}
								value={answers[item.id]}
								onChange={val => onAnswerChange(item.id, val)}
							/>
							{errors[item.id] && (
								<Text size="1" color="red">
									{errors[item.id]}
								</Text>
							)}
						</div>
					))}
			</div>

			<div className={styles.footer}>
				<Button
					type="button"
					intent="secondary"
					onClick={onBack}
					disabled={isSubmitting}
				>
					戻る
				</Button>
				<Button type="button" onClick={onNext} disabled={isSubmitting}>
					次へ
				</Button>
			</div>
		</form>
	);
}

type ConsentStepProps = {
	consented1: boolean;
	consented2: boolean;
	errors: { consented1?: string; consented2?: string };
	isSubmitting: boolean;
	onConsent1Change: (checked: boolean) => void;
	onConsent2Change: (checked: boolean) => void;
	onSubmit: (e: React.FormEvent) => void;
	onBack: () => void;
};

function ConsentStep({
	consented1,
	consented2,
	errors,
	isSubmitting,
	onConsent1Change,
	onConsent2Change,
	onSubmit,
	onBack,
}: ConsentStepProps) {
	return (
		<form className={styles.form} onSubmit={onSubmit} noValidate>
			<div className={styles.header}>
				<Text size="5" weight="bold">
					同意事項
				</Text>
				<Text size="2" color="gray">
					以下の事項をご確認の上、同意してください。
				</Text>
			</div>

			<div className={styles.fields}>
				<div className={styles.field}>
					<Checkbox
						label="企画登録に回答した方は、別の企画団体の企画責任者または副企画責任者になることはできません。"
						checked={consented1}
						onCheckedChange={onConsent1Change}
					/>
					{errors.consented1 && (
						<Text size="1" color="red">
							{errors.consented1}
						</Text>
					)}
				</div>

				<div className={styles.field}>
					<Checkbox
						label="ここで回答した内容(企画区分・企画実施場所・企画名・企画団体名)の修正・変更は、企画応募期間が終了すると簡単に行うことができません。"
						checked={consented2}
						onCheckedChange={onConsent2Change}
					/>
					{errors.consented2 && (
						<Text size="1" color="red">
							{errors.consented2}
						</Text>
					)}
				</div>
			</div>

			<div className={styles.footer}>
				<Button
					type="button"
					intent="secondary"
					onClick={onBack}
					disabled={isSubmitting}
				>
					戻る
				</Button>
				<Button type="submit" loading={isSubmitting}>
					登録する
				</Button>
			</div>
		</form>
	);
}

function resolveLocation(newType: string, prevLocation: string): string {
	if (newType === "STAGE") return "STAGE";
	if (prevLocation === "STAGE") return "";
	return prevLocation;
}

function buildStep1Errors(step1: Step1State): Step1Errors {
	const errs: Step1Errors = {};
	if (isBlankProjectDisplayName(step1.name)) errs.name = "企画名は必須です";
	else if (!isValidProjectDisplayName(step1.name)) {
		errs.name = PROJECT_DISPLAY_NAME_RULE_MESSAGE;
	}
	if (!step1.namePhonetic) errs.namePhonetic = "企画名（ふりがな）は必須です";
	if (isBlankProjectDisplayName(step1.organizationName))
		errs.organizationName = "企画団体名は必須です";
	else if (!isValidProjectDisplayName(step1.organizationName)) {
		errs.organizationName = PROJECT_DISPLAY_NAME_RULE_MESSAGE;
	}
	if (!step1.organizationNamePhonetic)
		errs.organizationNamePhonetic = "企画団体名（ふりがな）は必須です";
	if (!step1.type) errs.type = "企画区分は必須です";
	if (!step1.location) errs.location = "企画実施場所は必須です";
	return errs;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 企画登録マルチステップフォームのロジック
export function ProjectCreateDialog({ open, onOpenChange, onCreated }: Props) {
	// ステップ: 0 = 基本情報, 1〜N = 企画登録フォーム, N+1 = 同意事項
	const [step, setStep] = useState(0);
	const [step1, setStep1] = useState<Step1State>(EMPTY_STEP1);
	const [step1Errors, setStep1Errors] = useState<Step1Errors>({});
	const [regForms, setRegForms] = useState<RegForm[]>([]);
	// regForms[i] に対応する回答
	const [regFormAnswers, setRegFormAnswers] = useState<FormAnswers[]>([]);
	const [regFormErrors, setRegFormErrors] = useState<Record<string, string>[]>(
		[]
	);
	const [consented1, setConsented1] = useState(false);
	const [consented2, setConsented2] = useState(false);
	const [consentErrors, setConsentErrors] = useState<{
		consented1?: string;
		consented2?: string;
	}>({});
	const [isFetching, setIsFetching] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const isStage = step1.type === "STAGE";
	const totalSteps = 1 + regForms.length; // step0 + regForms (同意ステップは含まない)
	const isConsentStep = step > 0 && step === 1 + regForms.length;

	const handleClose = () => {
		onOpenChange(false);
		// リセット
		setStep(0);
		setStep1(EMPTY_STEP1);
		setStep1Errors({});
		setRegForms([]);
		setRegFormAnswers([]);
		setRegFormErrors([]);
		setConsented1(false);
		setConsented2(false);
		setConsentErrors({});
	};

	// ─── Step 1 ───

	const handleTypeChange = (value: string) => {
		setStep1(prev => ({
			...prev,
			type: value,
			location: resolveLocation(value, prev.location),
		}));
		setStep1Errors(prev => ({ ...prev, type: undefined, location: undefined }));
	};

	const handleStep1Change = (field: keyof Step1State) => (value: string) => {
		setStep1(prev => ({ ...prev, [field]: value }));
		setStep1Errors(prev => ({ ...prev, [field]: undefined }));
	};

	const validateStep1 = (): boolean => {
		const errs = buildStep1Errors(step1);
		setStep1Errors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleNext = async () => {
		if (!validateStep1()) return;
		const parsed = projectTypeSchema.safeParse(step1.type);
		const parsedLoc = projectLocationSchema.safeParse(step1.location);
		if (!parsed.success || !parsedLoc.success) return;

		setIsFetching(true);
		try {
			const { forms } = await getActiveProjectRegistrationForms(
				parsed.data as ProjectType,
				parsedLoc.data as ProjectLocation
			);
			setRegForms(forms);
			setRegFormAnswers(forms.map(f => initFormAnswers(f.items)));
			setRegFormErrors(forms.map(() => ({})));
			setStep(1);
		} catch {
			toast.error("追加フォームの取得に失敗しました");
		} finally {
			setIsFetching(false);
		}
	};

	// ─── Registration form steps ───

	const updateRegAnswer = (
		formIndex: number,
		itemId: string,
		value: FormAnswerValue
	) => {
		setRegFormAnswers(prev => {
			const next = [...prev];
			next[formIndex] = { ...next[formIndex], [itemId]: value };
			return next;
		});
		setRegFormErrors(prev => {
			const next = [...prev];
			const errs = { ...next[formIndex] };
			delete errs[itemId];
			next[formIndex] = errs;
			return next;
		});
	};

	const validateRegStep = (formIndex: number): boolean => {
		const form = regForms[formIndex];
		const answers = regFormAnswers[formIndex] ?? {};
		if (!form) return true;
		const errs = validateRegFormAnswers(form.items, answers);
		setRegFormErrors(prev => {
			const next = [...prev];
			next[formIndex] = errs;
			return next;
		});
		return Object.keys(errs).length === 0;
	};

	const handleRegNext = () => {
		const formIndex = step - 1;
		if (!validateRegStep(formIndex)) return;
		setStep(s => s + 1);
	};

	const handleBack = () => {
		if (step > 0) setStep(s => s - 1);
	};

	// ─── Final submit ───

	const submitProject = async (
		type: ProjectType,
		location: ProjectLocation,
		forms: RegForm[],
		formAnswers: FormAnswers[]
	) => {
		setIsSubmitting(true);
		try {
			const preparedRegAnswers = await prepareRegFormAnswersForSubmit(
				forms,
				formAnswers
			);
			setRegFormAnswers(preparedRegAnswers);

			const res = await createProject({
				name: step1.name,
				namePhonetic: step1.namePhonetic,
				organizationName: step1.organizationName,
				organizationNamePhonetic: step1.organizationNamePhonetic,
				type,
				location,
				registrationFormAnswers:
					forms.length > 0
						? buildRegFormAnswers(forms, preparedRegAnswers)
						: undefined,
				agreedToRegistrationConstraints: true,
				agreedToInfoImmutability: true,
			});
			onCreated(res.project);
			handleClose();
		} catch {
			toast.error("企画の作成に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleFinalSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs: { consented1?: string; consented2?: string } = {};
		if (!consented1) errs.consented1 = "同意が必要です";
		if (!consented2) errs.consented2 = "同意が必要です";
		setConsentErrors(errs);
		if (Object.keys(errs).length > 0) return;

		const parsed = projectTypeSchema.safeParse(step1.type);
		const parsedLoc = projectLocationSchema.safeParse(step1.location);
		if (!parsed.success || !parsedLoc.success) return;

		await submitProject(
			parsed.data as ProjectType,
			parsedLoc.data as ProjectLocation,
			regForms,
			regFormAnswers
		);
	};

	// ─── Render ───

	const currentRegForm = step > 0 && !isConsentStep ? regForms[step - 1] : null;
	const currentRegAnswers = step > 0 ? (regFormAnswers[step - 1] ?? {}) : {};
	const currentRegErrors = step > 0 ? (regFormErrors[step - 1] ?? {}) : {};

	return (
		<Dialog.Root open={open} onOpenChange={handleClose}>
			<Dialog.Content maxWidth="520px">
				<VisuallyHidden>
					<Dialog.Title>企画登録</Dialog.Title>
				</VisuallyHidden>

				{step === 0 ? (
					/* ─── ステップ1: 基本情報 ─── */
					<div className={styles.form}>
						<div className={styles.header}>
							<Text size="5" weight="bold">
								企画登録フォーム
							</Text>
							<Text size="2" color="gray">
								学園祭への企画参加に必要な情報を入力してください。必須項目はすべてご記入ください。
							</Text>
						</div>

						<div className={styles.fields}>
							<Text size="1" color="gray">
								{PROJECT_DISPLAY_NAME_RULE_MESSAGE}
							</Text>

							<div className={styles.field}>
								<TextField
									label="企画名 *"
									value={step1.name}
									onChange={handleStep1Change("name")}
									placeholder="例：○○研究会"
									error={step1Errors.name}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画名（ふりがな）*"
									value={step1.namePhonetic}
									onChange={handleStep1Change("namePhonetic")}
									placeholder="例：まるまるけんきゅうかい"
									error={step1Errors.namePhonetic}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画団体名 *"
									value={step1.organizationName}
									onChange={handleStep1Change("organizationName")}
									placeholder="例：○○サークル"
									error={step1Errors.organizationName}
								/>
							</div>

							<div className={styles.field}>
								<TextField
									label="企画団体名（ふりがな）*"
									value={step1.organizationNamePhonetic}
									onChange={handleStep1Change("organizationNamePhonetic")}
									placeholder="例：まるまるさーくる"
									error={step1Errors.organizationNamePhonetic}
								/>
							</div>

							<div className={styles.field}>
								<RadioGroup
									label="企画区分"
									value={step1.type}
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
								{step1Errors.type && (
									<Text size="1" color="red">
										{step1Errors.type}
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
											value={step1.location}
											onValueChange={handleStep1Change("location")}
											required
											name="location"
											disabled={!step1.type}
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
										{!step1.type && (
											<Text size="1" color="gray">
												企画区分を選択してください。
											</Text>
										)}
									</>
								)}
								{step1Errors.location && (
									<Text size="1" color="red">
										{step1Errors.location}
									</Text>
								)}
							</div>
						</div>

						<div className={styles.footer}>
							<Button
								type="button"
								intent="secondary"
								onClick={handleClose}
								disabled={isFetching}
							>
								キャンセル
							</Button>
							<Button type="button" onClick={handleNext} loading={isFetching}>
								次へ
							</Button>
						</div>
					</div>
				) : isConsentStep ? (
					/* ─── 同意事項ステップ ─── */
					<ConsentStep
						consented1={consented1}
						consented2={consented2}
						errors={consentErrors}
						isSubmitting={isSubmitting}
						onConsent1Change={checked => {
							setConsented1(checked);
							setConsentErrors(prev => ({ ...prev, consented1: undefined }));
						}}
						onConsent2Change={checked => {
							setConsented2(checked);
							setConsentErrors(prev => ({ ...prev, consented2: undefined }));
						}}
						onSubmit={handleFinalSubmit}
						onBack={handleBack}
					/>
				) : (
					/* ─── ステップ2〜N: 企画登録フォーム ─── */
					currentRegForm && (
						<RegFormStep
							form={currentRegForm}
							answers={currentRegAnswers}
							errors={currentRegErrors}
							step={step}
							totalSteps={totalSteps}
							isSubmitting={isSubmitting}
							onAnswerChange={(itemId, val) =>
								updateRegAnswer(step - 1, itemId, val)
							}
							onSubmit={handleFinalSubmit}
							onBack={handleBack}
							onNext={handleRegNext}
						/>
					)
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
